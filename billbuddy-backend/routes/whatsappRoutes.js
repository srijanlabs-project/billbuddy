const express = require("express");
const pool = require("../db/db");
const { createQuotationWithItems, createPaymentEntry } = require("../services/quotationService");
const { getTenantId } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");

const router = express.Router();

const DEFAULT_RULES = {
  customerLine: 1,
  mobileLine: 2,
  itemLine: 3,
  deliveryDateLine: 4,
  deliveryTypeLine: 5,
  enabled: true
};

function parseAmount(text) {
  if (!text) return 0;
  const normalized = String(text).replace(/,/g, "").trim();
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  const value = match ? Number(match[0]) : 0;
  return Number.isFinite(value) ? value : 0;
}

function normalizeDeliveryType(input) {
  const value = String(input || "").toLowerCase();
  if (value.includes("door")) return "DOORSTEP";
  if (value.includes("pick")) return "PICKUP";
  return "";
}

function parseDimensions(input) {
  const match = String(input || "").match(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return {
    width,
    height,
    area: width * height
  };
}

function extractThickness(text) {
  const match = String(text || "").match(/(\d+(?:\.\d+)?)\s*mm/i);
  return match ? `${match[1]} mm` : null;
}

function normalizeProductName(text) {
  return String(text || "")
    .replace(/(\d+(?:\.\d+)?)\s*mm/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseItemLine(itemLine) {
  const parts = String(itemLine || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const rawProductName = parts[0] || "";
  const productName = normalizeProductName(rawProductName);
  const thickness = extractThickness(rawProductName);
  const unitToken = parts[1] || "";
  const rateToken = parts[2] || "";

  const dims = parseDimensions(unitToken);
  let quantity = 0;
  let inferredUnitType = "COUNT";
  let width = null;
  let height = null;

  if (dims) {
    inferredUnitType = "SFT";
    quantity = dims.area;
    width = dims.width;
    height = dims.height;
  } else {
    const unitText = unitToken.toLowerCase();
    const number = parseAmount(unitToken);

    if (unitText.includes("sft") || unitText.includes("sqft")) {
      inferredUnitType = "SFT";
      quantity = number;
    } else if (unitText.includes("count") || unitText.includes("pc") || unitText.includes("pcs")) {
      inferredUnitType = "COUNT";
      quantity = number;
    } else {
      quantity = number;
    }
  }

  return {
    productName,
    rawProductName,
    thickness,
    quantity,
    inferredUnitType,
    width,
    height,
    rate: parseAmount(rateToken)
  };
}

function isLikelyDate(line) {
  const value = String(line || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(value);
}

function parseKeyValueMessage(message) {
  const lines = String(message || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = {};
  for (const line of lines) {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      parsed[key] = match[2].trim();
    }
  }

  const fallback = lines.join(" ").toLowerCase();

  const messageData = {
    customerName: parsed.customer || parsed["customer name"] || (fallback.includes("walk-in") ? "Walk-in Customer" : null),
    mobile: parsed.phone || parsed.mobile || parsed["customer mobile"] || null,
    service: parsed.service || parsed.material || parsed["material type"] || "",
    materialType: parsed["material type"] || parsed.material || null,
    thickness: parsed.thickness || parsed["material thickness"] || null,
    designName: parsed.design || parsed["design name"] || null,
    sku: parsed.sku || parsed["product sku"] || null,
    quantity: parseAmount(parsed.qty || parsed.quantity || parsed.pcs || "0"),
    rate: parseAmount(parsed.rate || parsed.price || "0"),
    amount: parseAmount(parsed.amount || "0"),
    gstPercent: parseAmount(parsed.gst || "0"),
    transportCharges: parseAmount(parsed.transport || parsed["transportation cost"] || "0"),
    designCharges: parseAmount(parsed["design cost"] || parsed["design charges"] || "0"),
    paymentStatus: (parsed["payment status"] || "pending").toLowerCase(),
    deliveryDate: parsed["delivery date"] || parsed.delivery_date || null,
    deliveryType: normalizeDeliveryType(parsed["delivery type"] || parsed.delivery || ""),
    deliveryAddress: parsed["delivery address"] || parsed.address || null,
    deliveryPincode: parsed.pincode || parsed["delivery pincode"] || null,
    sourceChannel: parsed.source || "whatsapp",
    inferredUnitType: null,
    width: null,
    height: null
  };

  if (messageData.amount > 0 && messageData.rate <= 0 && messageData.quantity > 0) {
    messageData.rate = messageData.amount / messageData.quantity;
  }

  return messageData;
}

function parsePlainByRules(message, rules) {
  const lines = String(message || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const resolveIndex = (lineNo) => Math.max(0, Number(lineNo || 1) - 1);
  const getLine = (lineNo) => lines[resolveIndex(lineNo)] || "";

  const customerIndex = resolveIndex(rules.customer_line ?? rules.customerLine);
  const mobileIndex = resolveIndex(rules.mobile_line ?? rules.mobileLine);
  const itemIndex = resolveIndex(rules.item_line ?? rules.itemLine);
  const deliveryDateIndex = resolveIndex(rules.delivery_date_line ?? rules.deliveryDateLine);
  const deliveryTypeIndex = resolveIndex(rules.delivery_type_line ?? rules.deliveryTypeLine);

  const customerName = getLine(rules.customer_line ?? rules.customerLine);
  const mobile = getLine(rules.mobile_line ?? rules.mobileLine);
  let detectedDeliveryDateIndex = deliveryDateIndex;
  let detectedDeliveryTypeIndex = deliveryTypeIndex;

  for (let index = itemIndex + 1; index < lines.length; index += 1) {
    if (isLikelyDate(lines[index])) {
      detectedDeliveryDateIndex = index;
      break;
    }
  }

  for (let index = detectedDeliveryDateIndex + 1; index < lines.length; index += 1) {
    if (normalizeDeliveryType(lines[index])) {
      detectedDeliveryTypeIndex = index;
      break;
    }
  }

  const itemLines = lines.slice(itemIndex, detectedDeliveryDateIndex).filter(Boolean);
  const parsedItems = itemLines.map(parseItemLine).filter((item) => item.productName);
  const firstItem = parsedItems[0] || {
    productName: "",
    quantity: 0,
    inferredUnitType: "COUNT",
    width: null,
    height: null,
    rate: 0
  };

  const deliveryDate = lines[detectedDeliveryDateIndex] || "";
  const deliveryTypeLine = lines[detectedDeliveryTypeIndex] || "";
  const remainingLines = lines.filter((_, index) => ![
    customerIndex,
    mobileIndex,
    ...itemLines.map((_, offset) => itemIndex + offset),
    detectedDeliveryDateIndex,
    detectedDeliveryTypeIndex
  ].includes(index));

  let deliveryAddress = null;
  let deliveryPincode = null;
  let transportCharges = 0;
  let designCharges = 0;
  const normalizedDeliveryType = normalizeDeliveryType(deliveryTypeLine);

  if (normalizedDeliveryType === "DOORSTEP") {
    deliveryAddress = remainingLines.shift() || null;
    deliveryPincode = remainingLines.shift() || null;
  }

  if (remainingLines.length > 0) {
    transportCharges = parseAmount(remainingLines.shift());
  }

  if (remainingLines.length > 0) {
    designCharges = parseAmount(remainingLines.shift());
  }

  return {
    customerName: customerName || null,
    mobile: mobile || null,
    service: firstItem.productName,
    materialType: null,
    thickness: firstItem.thickness,
    designName: null,
    sku: null,
    quantity: firstItem.quantity,
    rate: firstItem.rate,
    amount: 0,
    gstPercent: 0,
    transportCharges,
    designCharges,
    paymentStatus: "pending",
    deliveryDate: deliveryDate || null,
    deliveryType: normalizedDeliveryType,
    deliveryAddress,
    deliveryPincode,
    sourceChannel: "whatsapp",
    inferredUnitType: firstItem.inferredUnitType,
    width: firstItem.width,
    height: firstItem.height,
    items: parsedItems.map((item) => ({
      service: item.productName,
      materialType: null,
      thickness: item.thickness,
      designName: null,
      sku: null,
      quantity: item.quantity,
      rate: item.rate,
      inferredUnitType: item.inferredUnitType,
      width: item.width,
      height: item.height,
      rawProductName: item.rawProductName
    }))
  };
}

async function getDecodeRules(sellerId) {
  const result = await pool.query(
    `SELECT * FROM message_decode_rules WHERE seller_id = $1 LIMIT 1`,
    [sellerId]
  );

  if (result.rowCount === 0) {
    return {
      ...DEFAULT_RULES,
      seller_id: sellerId
    };
  }

  return result.rows[0];
}

async function getLatestDeliveredAddress(sellerId, mobile) {
  if (!mobile) return null;

  const result = await pool.query(
    `SELECT q.delivery_address, q.delivery_pincode
     FROM quotations q
     JOIN customers c ON c.id = q.customer_id
     WHERE q.seller_id = $1
       AND c.mobile = $2
       AND q.delivery_type = 'DOORSTEP'
       AND q.delivery_address IS NOT NULL
     ORDER BY COALESCE(q.delivery_date::timestamp, q.created_at) DESC
     LIMIT 1`,
    [sellerId, mobile]
  );

  return result.rows[0] || null;
}

function collectMissingFields(parsed, options = {}) {
  const missing = [];
  const items = Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : [parsed];

  if (!parsed.customerName) missing.push("customerName");
  if (!parsed.mobile) missing.push("mobile");
  if (items.some((item) => !item.service)) missing.push("productName");
  if (items.some((item) => !item.quantity || item.quantity <= 0)) missing.push("quantity/unit");
  if (items.some((item) => !item.rate || item.rate <= 0)) missing.push("rate/amount");
  if (!parsed.deliveryDate) missing.push("deliveryDate");
  if (!parsed.deliveryType) missing.push("deliveryType (PICKUP or DOORSTEP)");

  if (parsed.deliveryType === "DOORSTEP") {
    if (!parsed.deliveryAddress) missing.push("deliveryAddress");
    if (!parsed.deliveryPincode) missing.push("deliveryPincode");
    if (!parsed.transportCharges || parsed.transportCharges <= 0) missing.push("transportationCost");
  }

  const hasDesignMention = parsed.designName || parsed.designCharges > 0;
  if (!hasDesignMention && !options.designCostConfirmed) {
    missing.push("designCostConfirmation");
  }

  return missing;
}

function buildPrompts(missingFields, latestAddress) {
  return missingFields.map((field) => {
    if (field === "designCostConfirmation") {
      return "Please confirm design cost. Reply with 'Design Cost: 0' or share actual cost.";
    }
    if (field === "deliveryAddress" && latestAddress?.delivery_address) {
      return `Delivery address missing. Latest delivered address: ${latestAddress.delivery_address} (${latestAddress.delivery_pincode || ""}). Confirm to reuse or send new address.`;
    }
    return `Please provide ${field}.`;
  });
}

function metaConfig() {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v20.0"
  };
}

function ensureMetaConfigured() {
  const cfg = metaConfig();
  if (!cfg.accessToken || !cfg.phoneNumberId) {
    throw new Error("Meta WhatsApp API is not configured. Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env");
  }
  return cfg;
}

async function sendMetaMessage(payload) {
  const cfg = ensureMetaConfigured();
  const response = await fetch(`https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error?.message || "Meta WhatsApp send failed");
  }

  return result;
}

async function ensureCustomer(sellerId, customerName, mobile, options = {}) {
  if (!customerName) throw new Error("Could not parse customer name from message");

  const existing = await pool.query(
    `SELECT * FROM customers WHERE seller_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1`,
    [sellerId, customerName]
  );

  if (existing.rowCount > 0) {
    if (mobile && existing.rows[0].mobile !== mobile) {
      await pool.query(`UPDATE customers SET mobile = $1 WHERE id = $2`, [mobile, existing.rows[0].id]);
      existing.rows[0].mobile = mobile;
    }
    return existing.rows[0];
  }

  if (!options.allowCreate) {
    throw new Error("Customer creation is not allowed for this user");
  }

  const created = await pool.query(
    `INSERT INTO customers (seller_id, name, mobile, firm_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [sellerId, customerName, mobile || null, customerName]
  );

  return created.rows[0];
}

async function ensureProduct(sellerId, data, options = {}) {
  const normalizedService = normalizeProductName(data.service);
  const normalizedThickness = String(data.thickness || "").trim().toLowerCase();
  const existing = await pool.query(
    `SELECT *
     FROM products
     WHERE seller_id = $1
       AND LOWER(material_name) = LOWER($2)
     ORDER BY
       CASE
         WHEN $3 <> '' AND LOWER(COALESCE(thickness, '')) = $3 THEN 0
         WHEN $3 = '' THEN 1
         ELSE 2
       END,
       id
     LIMIT 1`,
    [sellerId, normalizedService, normalizedThickness]
  );

  if (existing.rowCount > 0) {
    return existing.rows[0];
  }

  if (!options.allowCreate) {
    throw new Error("Secondary product creation is not allowed for this user");
  }

  const created = await pool.query(
    `INSERT INTO products (seller_id, material_name, category, base_price, gst_percent, sku, thickness, design_name, always_available, unit_type, default_width, default_height)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10, $11)
     RETURNING *`,
    [
      sellerId,
      normalizedService || data.service,
      data.materialType || "Service",
      data.rate || 0,
      data.gstPercent || 0,
      data.sku || null,
      data.thickness || null,
      data.designName || null,
      data.inferredUnitType || "COUNT",
      data.width || null,
      data.height || null
    ]
  );

  return created.rows[0];
}

function applyProductUnitRules(parsed, product) {
  const unitType = (product.unit_type || parsed.inferredUnitType || "COUNT").toUpperCase();
  let quantity = parsed.quantity;
  let note = null;

  if (unitType === "SFT") {
    if (parsed.width && parsed.height) {
      quantity = parsed.width * parsed.height;
    } else if (quantity > 0 && Number(product.default_width) > 0 && Number(product.default_height) > 0) {
      quantity = quantity * Number(product.default_width) * Number(product.default_height);
      note = `Computed SFT using default dimensions ${product.default_width}x${product.default_height}`;
    }
  }

  return {
    quantity,
    unitType,
    note
  };
}

function resolveItemPrice(item, product) {
  const messageRate = Number(item.rate || 0);
  if (messageRate > 0) {
    return {
      unitPrice: messageRate,
      priceSource: "message"
    };
  }

  const catalogueRate = Number(product.base_price || 0);
  if (catalogueRate > 0) {
    return {
      unitPrice: catalogueRate,
      priceSource: "catalogue"
    };
  }

  return {
    unitPrice: 0,
    priceSource: "missing"
  };
}

router.get("/meta/status", requirePermission(PERMISSIONS.SETTINGS_VIEW), (_req, res) => {
  const cfg = metaConfig();
  res.json({
    configured: Boolean(cfg.accessToken && cfg.phoneNumberId),
    phoneNumberIdSet: Boolean(cfg.phoneNumberId),
    accessTokenSet: Boolean(cfg.accessToken),
    apiVersion: cfg.apiVersion
  });
});

router.get("/decode-rules", requirePermission(PERMISSIONS.SETTINGS_VIEW), async (req, res) => {
  try {
    const sellerId = getTenantId(req);
    if (!sellerId) return res.status(400).json({ message: "sellerId is required" });

    const rules = await getDecodeRules(sellerId);
    res.json(rules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/decode-rules", requirePermission(PERMISSIONS.SETTINGS_EDIT), async (req, res) => {
  try {
    const sellerId = getTenantId(req);
    if (!sellerId) return res.status(400).json({ message: "sellerId is required" });

    const payload = {
      customerLine: Number(req.body.customerLine || DEFAULT_RULES.customerLine),
      mobileLine: Number(req.body.mobileLine || DEFAULT_RULES.mobileLine),
      itemLine: Number(req.body.itemLine || DEFAULT_RULES.itemLine),
      deliveryDateLine: Number(req.body.deliveryDateLine || DEFAULT_RULES.deliveryDateLine),
      deliveryTypeLine: Number(req.body.deliveryTypeLine || DEFAULT_RULES.deliveryTypeLine),
      enabled: req.body.enabled !== false
    };

    const result = await pool.query(
      `INSERT INTO message_decode_rules
       (seller_id, customer_line, mobile_line, item_line, delivery_date_line, delivery_type_line, enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (seller_id)
       DO UPDATE SET
         customer_line = EXCLUDED.customer_line,
         mobile_line = EXCLUDED.mobile_line,
         item_line = EXCLUDED.item_line,
         delivery_date_line = EXCLUDED.delivery_date_line,
         delivery_type_line = EXCLUDED.delivery_type_line,
         enabled = EXCLUDED.enabled,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        sellerId,
        payload.customerLine,
        payload.mobileLine,
        payload.itemLine,
        payload.deliveryDateLine,
        payload.deliveryTypeLine,
        payload.enabled
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/send-test", requirePermission(PERMISSIONS.SETTINGS_EDIT), async (req, res) => {
  try {
    const { to, message, templateName, languageCode = "en", templateParams = [] } = req.body;

    if (!to) return res.status(400).json({ message: "to is required" });

    let payload;
    if (templateName) {
      payload = {
        messaging_product: "whatsapp",
        to: String(to),
        type: "template",
        template: {
          name: String(templateName),
          language: { code: String(languageCode) },
          components: templateParams.length
            ? [
                {
                  type: "body",
                  parameters: templateParams.map((value) => ({ type: "text", text: String(value) }))
                }
              ]
            : undefined
        }
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        to: String(to),
        type: "text",
        text: {
          preview_url: false,
          body: String(message || "")
        }
      };
    }

    const result = await sendMetaMessage(payload);
    res.status(201).json({ message: "WhatsApp message sent", provider: "meta-cloud-api", result });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/parse", requirePermission(PERMISSIONS.QUOTATION_CREATE), async (req, res) => {
  try {
    const { message, createdBy, autoMarkPaid, sellerId, confirmations = {} } = req.body;

    if (!message) return res.status(400).json({ message: "message is required" });

    const tenantId = req.user.isPlatformAdmin ? Number(sellerId || getTenantId(req)) : getTenantId(req);
    if (!tenantId) return res.status(400).json({ message: "sellerId is required" });

    const rules = await getDecodeRules(tenantId);
    const isKeyValue = String(message).includes(":");

    const parsed = isKeyValue
      ? parseKeyValueMessage(message)
      : parsePlainByRules(message, rules.enabled ? rules : DEFAULT_RULES);

    const latestAddress = await getLatestDeliveredAddress(tenantId, parsed.mobile);
    if (parsed.deliveryType === "DOORSTEP" && !parsed.deliveryAddress && confirmations.useLatestAddress && latestAddress) {
      parsed.deliveryAddress = latestAddress.delivery_address;
      parsed.deliveryPincode = latestAddress.delivery_pincode;
    }

    const missingFields = collectMissingFields(parsed, confirmations);
    if (missingFields.length > 0) {
      return res.status(202).json({
        requiresConfirmation: true,
        missingFields,
        prompts: buildPrompts(missingFields, latestAddress),
        latestAddress,
        parsed
      });
    }

    const canCreateCustomer = Array.isArray(req.user?.permissions) && req.user.permissions.includes(PERMISSIONS.CUSTOMER_CREATE);
    const canCreateSecondaryProduct = Array.isArray(req.user?.permissions) && req.user.permissions.includes(PERMISSIONS.PRODUCT_SECONDARY_CREATE);
    const canMarkPaid = Array.isArray(req.user?.permissions) && req.user.permissions.includes(PERMISSIONS.QUOTATION_MARK_PAID);

    if ((autoMarkPaid || parsed.paymentStatus === "paid") && !canMarkPaid) {
      return res.status(403).json({ message: "You do not have permission to mark quotations as paid" });
    }

    const customer = await ensureCustomer(tenantId, parsed.customerName, parsed.mobile, {
      allowCreate: canCreateCustomer
    });
    const parsedItems = Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : [parsed];
    const resolvedItems = [];

    for (const item of parsedItems) {
      const product = await ensureProduct(tenantId, item, {
        allowCreate: canCreateSecondaryProduct
      });
      const unitResolved = applyProductUnitRules(item, product);
      const priceResolved = resolveItemPrice(item, product);
      resolvedItems.push({
        product,
        unitResolved,
        priceResolved,
        payload: {
          product_id: product.id,
          quantity: unitResolved.quantity,
          unit_price: priceResolved.unitPrice,
          size: item.width && item.height ? `${item.width}x${item.height}` : item.thickness || null,
          material_type: item.materialType,
          thickness: item.thickness,
          design_name: item.designName,
          sku: item.sku || product.sku || null
        }
      });
    }

    const quotationData = await createQuotationWithItems({
      sellerId: tenantId,
      customerId: customer.id,
      createdBy: createdBy || req.user.id,
      gstPercent: parsed.gstPercent,
      transportCharges: 0,
      transportationCost: parsed.transportCharges,
      designCharges: parsed.designCharges,
      designCostConfirmed: Boolean(confirmations.designCostConfirmed || parsed.designCharges >= 0),
      paymentStatus: parsed.paymentStatus,
      deliveryDate: parsed.deliveryDate,
      deliveryType: parsed.deliveryType,
      deliveryAddress: parsed.deliveryAddress,
      deliveryPincode: parsed.deliveryPincode,
      sourceChannel: parsed.sourceChannel || "whatsapp",
      items: resolvedItems.map((item) => item.payload)
    });

    let paymentData = null;
    if (autoMarkPaid || parsed.paymentStatus === "paid") {
      paymentData = await createPaymentEntry({
        sellerId: tenantId,
        quotationId: quotationData.quotation.id,
        customerId: customer.id,
        amount: quotationData.quotation.total_amount,
        paymentMethod: "whatsapp",
        referenceNumber: `WA-${quotationData.quotation.quotation_number}`,
        actorUserId: req.user.id
      });
    }

    res.status(201).json({
      requiresConfirmation: false,
      parsed,
      itemResolutions: resolvedItems.map((item) => ({
        product: item.product,
        unitResolved: item.unitResolved,
        priceResolved: item.priceResolved
      })),
      customer,
      quotation: quotationData,
      payment: paymentData
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;

