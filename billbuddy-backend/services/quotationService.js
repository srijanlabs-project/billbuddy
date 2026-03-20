const pool = require("../db/db");
const { assertQuotationCreationAllowed, getQuotationWatermark } = require("./subscriptionService");

const ORDER_STATUS = {
  NEW: "NEW",
  READY_DISPATCH: "READY_DISPATCH",
  READY_PICKUP: "READY_PICKUP",
  DELIVERED: "DELIVERED"
};

const DELIVERY_TYPE = {
  PICKUP: "PICKUP",
  DOORSTEP: "DOORSTEP"
};

const BUILT_IN_QUOTATION_KEYS = new Set([
  "material_name",
  "category",
  "width",
  "height",
  "unit",
  "thickness",
  "color_name",
  "other_info",
  "ps",
  "quantity",
  "rate",
  "note"
]);

function toAmount(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getFeetFactor(unit) {
  const normalized = String(unit || "").trim().toLowerCase();
  if (normalized === "in") return 1 / 12;
  if (normalized === "mm") return 0.00328084;
  return 1;
}

function buildComputedFieldContext(item) {
  const customFields = item.custom_fields || item.customFields || {};
  const width = toAmount(item.dimension_width ?? item.dimensionWidth);
  const height = toAmount(item.dimension_height ?? item.dimensionHeight);
  const unit = String(item.dimension_unit || item.dimensionUnit || item.unit || "ft").trim().toLowerCase();
  const unitFactor = getFeetFactor(unit);
  const widthFt = Number((width * unitFactor).toFixed(6));
  const heightFt = Number((height * unitFactor).toFixed(6));
  const areaSqft = Number((widthFt * heightFt).toFixed(6));
  const context = {
    quantity: toAmount(item.quantity),
    rate: toAmount(item.unitPrice ?? item.unit_price),
    unit_price: toAmount(item.unitPrice ?? item.unit_price),
    amount: toAmount(item.totalPrice ?? item.total_price),
    total_price: toAmount(item.totalPrice ?? item.total_price),
    width,
    height,
    unit_factor: unitFactor,
    width_ft: widthFt,
    height_ft: heightFt,
    area_sqft: areaSqft
  };

  Object.entries(customFields).forEach(([key, value]) => {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) return;
    if (typeof value === "boolean") {
      context[normalizedKey] = value ? 1 : 0;
      return;
    }
    const numericValue = Number(value);
    if (!Number.isNaN(numericValue) && Number.isFinite(numericValue)) {
      context[normalizedKey] = numericValue;
    }
  });

  return context;
}

function evaluateFormulaExpression(expression, context) {
  const source = String(expression || "").trim();
  if (!source) return null;
  if (/[^0-9a-zA-Z_+\-*/().\s]/.test(source)) {
    throw new Error(`Unsupported characters in formula: ${source}`);
  }

  const replaced = source.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (token) => String(toAmount(context[token])));
  if (/[^0-9+\-*/().\s]/.test(replaced)) {
    throw new Error(`Formula could not be evaluated safely: ${source}`);
  }

  const result = Function(`"use strict"; return (${replaced});`)();
  if (!Number.isFinite(result)) {
    throw new Error(`Formula did not produce a finite number: ${source}`);
  }

  return Number(result.toFixed(2));
}

function normalizeOrderStatus(status) {
  const value = String(status || ORDER_STATUS.NEW).toUpperCase();
  if (!Object.values(ORDER_STATUS).includes(value)) {
    throw new Error("Invalid orderStatus. Allowed: NEW, READY_DISPATCH, READY_PICKUP, DELIVERED");
  }
  return value;
}

function normalizeDeliveryType(type) {
  const value = String(type || DELIVERY_TYPE.PICKUP).toUpperCase();
  if (!Object.values(DELIVERY_TYPE).includes(value)) {
    throw new Error("Invalid deliveryType. Allowed: PICKUP, DOORSTEP");
  }
  return value;
}

function computeQuotationTotals({ items, gstPercent, transportCharges, designCharges, discountAmount, advanceAmount }) {
  const normalizedItems = (items || []).map((item) => {
    const quantity = toAmount(item.quantity);
    const unitPrice = toAmount(item.unit_price ?? item.unitPrice);
    const totalPrice = toAmount(item.total_price ?? item.totalPrice) || (quantity * unitPrice);

    return {
      ...item,
      quantity,
      unitPrice,
      totalPrice,
      color_name: item.color_name || item.colorName || null,
      imported_color_note: item.imported_color_note || item.importedColorNote || null,
      ps_included: Boolean(item.ps_included ?? item.psIncluded),
      dimension_height: item.dimension_height ?? item.dimensionHeight ?? null,
      dimension_width: item.dimension_width ?? item.dimensionWidth ?? null,
      dimension_unit: item.dimension_unit || item.dimensionUnit || null,
      item_note: item.item_note || item.itemNote || null,
      pricing_type: String(item.pricing_type || item.pricingType || "SFT").toUpperCase(),
      custom_fields: item.custom_fields || item.customFields || {}
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const gstPct = toAmount(gstPercent);
  const gstAmount = subtotal * (gstPct / 100);
  const transport = toAmount(transportCharges);
  const design = toAmount(designCharges);
  const totalAmount = subtotal + gstAmount + transport + design;
  const discount = toAmount(discountAmount);
  const advance = toAmount(advanceAmount);
  const balanceAmount = Math.max(Number((totalAmount - discount - advance).toFixed(2)), 0);

  return {
    normalizedItems,
    subtotal,
    gstAmount,
    transport,
    design,
    totalAmount,
    discountAmount: discount,
    advanceAmount: advance,
    balanceAmount
  };
}

async function getNextQuotationNumber(client, sellerId) {
  const result = await client.query(`SELECT nextval('quotation_number_seq') AS next_number`);
  const next = Number(result.rows[0]?.next_number || 1);
  return `SL-${String(next).padStart(4, "0")}`;
}

function normalizeQuotationPrefix(value) {
  return (String(value || "QTN")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9/-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20)) || "QTN";
}

function normalizeCustomQuotationNumber(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120);
  return normalized || null;
}

async function getNextSellerQuotationMeta(client, sellerId) {
  const sellerResult = await client.query(
    `SELECT quotation_number_prefix
     FROM sellers
     WHERE id = $1
     LIMIT 1`,
    [sellerId]
  );
  const prefix = normalizeQuotationPrefix(sellerResult.rows[0]?.quotation_number_prefix);
  const serialResult = await client.query(
    `SELECT COALESCE(MAX(seller_quotation_serial), 0) + 1 AS next_serial
     FROM quotations
     WHERE seller_id = $1`,
    [sellerId]
  );
  const nextSerial = Number(serialResult.rows[0]?.next_serial || 1);
  return {
    sellerQuotationSerial: nextSerial,
    sellerQuotationNumber: `${prefix}-${String(nextSerial).padStart(4, "0")}`
  };
}

async function getCustomerOutstanding(customerId, sellerId) {
  const result = await pool.query(
    `SELECT
      COALESCE((SELECT SUM(COALESCE(balance_amount, total_amount)) FROM quotations WHERE customer_id = $1 AND seller_id = $2), 0) AS invoiced,
      COALESCE((SELECT SUM(amount) FROM payments WHERE customer_id = $1 AND seller_id = $2), 0) AS paid`,
    [customerId, sellerId]
  );

  const row = result.rows[0] || { invoiced: 0, paid: 0 };
  return toAmount(row.invoiced) - toAmount(row.paid);
}

async function logOrderEvent(client, { sellerId, quotationId, eventType, eventNote, actorUserId }) {
  await client.query(
    `INSERT INTO order_events (seller_id, quotation_id, event_type, event_note, actor_user_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [sellerId, quotationId, eventType, eventNote || null, actorUserId || null]
  );
}

async function createQuotationVersionSnapshot(client, { sellerId, quotation, items, actorUserId }) {
  await client.query(
    `INSERT INTO quotation_versions
     (seller_id, quotation_id, version_no, quotation_snapshot, items_snapshot, actor_user_id)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
    [
      sellerId,
      quotation.id,
      quotation.version_no || 1,
      JSON.stringify(quotation),
      JSON.stringify(items || []),
      actorUserId || null
    ]
  );
}

async function reserveInventoryForItems(client, sellerId, items, options = {}) {
  const { strict = true } = options;
  const warnings = [];
  for (const item of items) {
    if (!item.product_id) continue;

    const productResult = await client.query(
      `SELECT id, material_name, always_available, inventory_qty
       FROM products
       WHERE id = $1 AND seller_id = $2
       LIMIT 1
       FOR UPDATE`,
      [item.product_id, sellerId]
      );

      if (productResult.rowCount === 0) {
        if (strict) {
          throw new Error(`Product ${item.product_id} not found for seller`);
        }
        warnings.push(`Product ${item.product_id} not found for seller. Inventory was not updated for this item.`);
        continue;
      }

    const product = productResult.rows[0];
    if (product.always_available) {
      continue;
    }

      const current = toAmount(product.inventory_qty);
      if (current < item.quantity) {
        const message = `Inventory alert for ${product.material_name || "product"}: available ${current}, required ${item.quantity}. Quotation was created without inventory deduction.`;
        if (strict) {
          throw new Error(`Insufficient inventory for ${product.material_name || "product"}. Available ${current}, required ${item.quantity}`);
        }
        warnings.push(message);
        continue;
      }

      await client.query(
        `UPDATE products
         SET inventory_qty = inventory_qty - $1
         WHERE id = $2 AND seller_id = $3`,
        [item.quantity, item.product_id, sellerId]
      );
    }

  return warnings;
}

async function restoreInventoryForItems(client, sellerId, items) {
  for (const item of items) {
    if (!item.product_id) continue;

    const productResult = await client.query(
      `SELECT id, always_available
       FROM products
       WHERE id = $1 AND seller_id = $2
       LIMIT 1
       FOR UPDATE`,
      [item.product_id, sellerId]
    );

    if (productResult.rowCount === 0 || productResult.rows[0].always_available) {
      continue;
    }

    await client.query(
      `UPDATE products
       SET inventory_qty = inventory_qty + $1
       WHERE id = $2 AND seller_id = $3`,
      [toAmount(item.quantity), item.product_id, sellerId]
    );
  }
}

async function updateQuotationPaymentStatus(client, quotationId, sellerId) {
  const totals = await client.query(
    `SELECT
       q.total_amount,
       COALESCE(SUM(p.amount), 0) AS paid_amount
     FROM quotations q
     LEFT JOIN payments p ON p.quotation_id = q.id AND p.seller_id = q.seller_id
     WHERE q.id = $1 AND q.seller_id = $2
     GROUP BY q.id`,
    [quotationId, sellerId]
  );

  if (totals.rowCount === 0) {
    return;
  }

  const row = totals.rows[0];
  const totalAmount = toAmount(row.total_amount);
  const paidAmount = toAmount(row.paid_amount);

  let status = "pending";
  if (paidAmount >= totalAmount && totalAmount > 0) {
    status = "paid";
  } else if (paidAmount > 0) {
    status = "partial";
  }

  await client.query(
    `UPDATE quotations SET payment_status = $1 WHERE id = $2 AND seller_id = $3`,
    [status, quotationId, sellerId]
  );
}

async function getSellerCustomQuotationColumns(clientOrPool, sellerId) {
  const result = await clientOrPool.query(
    `SELECT sqc.column_key, sqc.label, sqc.column_type, sqc.option_values, sqc.definition_text, sqc.formula_expression, sqc.required, sqc.visible_in_form
     FROM seller_configuration_profiles scp
     INNER JOIN seller_quotation_columns sqc ON sqc.profile_id = scp.id
     WHERE scp.seller_id = $1
       AND scp.status = 'published'
     ORDER BY sqc.display_order ASC, sqc.id ASC`,
    [sellerId]
  );

  return result.rows.filter((column) => !BUILT_IN_QUOTATION_KEYS.has(String(column.column_key || "").trim().toLowerCase()));
}

function validateCustomQuotationFields(items, customColumns = []) {
  if (!Array.isArray(items) || items.length === 0 || !Array.isArray(customColumns) || customColumns.length === 0) {
    return;
  }

  items.forEach((item, index) => {
    const customFields = item.custom_fields || item.customFields || {};

    customColumns
      .filter((column) => Boolean(column.visible_in_form))
      .forEach((column) => {
        const fieldLabel = column.label || column.column_key || "Custom field";
        const fieldValue = customFields[column.column_key];
        const fieldType = String(column.column_type || "text").toLowerCase();

        if (fieldType === "formula") {
          return;
        }

        if (column.required) {
          if (fieldType === "checkbox") {
            if (fieldValue !== true) {
              throw new Error(`Item ${index + 1}: ${fieldLabel} is required.`);
            }
          } else if (fieldValue === undefined || fieldValue === null || String(fieldValue).trim() === "") {
            throw new Error(`Item ${index + 1}: ${fieldLabel} is required.`);
          }
        }

        if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
          if (fieldType === "number" && Number.isNaN(Number(fieldValue))) {
            throw new Error(`Item ${index + 1}: ${fieldLabel} must be numeric.`);
          }
          if (fieldType === "checkbox" && typeof fieldValue !== "boolean") {
            throw new Error(`Item ${index + 1}: ${fieldLabel} must be true or false.`);
          }
          if (fieldType === "dropdown") {
            const allowedOptions = Array.isArray(column.option_values)
              ? column.option_values.map((option) => String(option || "").trim()).filter(Boolean)
              : [];
            if (allowedOptions.length && !allowedOptions.includes(String(fieldValue).trim())) {
              throw new Error(`Item ${index + 1}: ${fieldLabel} must match one of the configured options.`);
            }
          }
        }
      });
  });
}

function applyComputedQuotationFields(items, customColumns = []) {
  if (!Array.isArray(items) || items.length === 0 || !Array.isArray(customColumns) || customColumns.length === 0) {
    return items;
  }

  const formulaColumns = customColumns.filter((column) => String(column.column_type || "").toLowerCase() === "formula");
  if (!formulaColumns.length) return items;

  return items.map((item) => {
    const nextItem = {
      ...item,
      custom_fields: {
        ...(item.custom_fields || item.customFields || {})
      }
    };

    formulaColumns.forEach((column) => {
      if (!column.column_key || !column.formula_expression) return;
      const context = buildComputedFieldContext(nextItem);
      const computedValue = evaluateFormulaExpression(column.formula_expression, context);
      if (computedValue !== null) {
        nextItem.custom_fields[column.column_key] = computedValue;
      }
    });

    return nextItem;
  });
}

async function createQuotationWithItems(payload) {
  const {
    sellerId,
    customerId,
    createdBy,
    items,
    gstPercent,
    transportCharges,
    designCharges,
    paymentStatus,
    orderStatus,
    deliveryType,
    deliveryDate,
    deliveryAddress,
    deliveryPincode,
    transportationCost,
    designCostConfirmed,
    sourceChannel,
    recordStatus,
    customerMonthlyBilling,
    discountAmount,
    advanceAmount,
    customQuotationNumber
  } = payload;

  if (!sellerId) {
    throw new Error("sellerId is required");
  }

  if (!customerId) {
    throw new Error("customerId is required");
  }

  if (!items || items.length === 0) {
    throw new Error("At least one item is required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentSubscription = await assertQuotationCreationAllowed(client, sellerId);
    const customColumns = await getSellerCustomQuotationColumns(client, sellerId);

    const customerCheck = await client.query(
      `SELECT id FROM customers WHERE id = $1 AND seller_id = $2 LIMIT 1`,
      [customerId, sellerId]
    );
    if (customerCheck.rowCount === 0) {
      throw new Error("Customer does not belong to this seller");
    }

    const normalizedDeliveryType = normalizeDeliveryType(deliveryType || DELIVERY_TYPE.PICKUP);
    if (normalizedDeliveryType === DELIVERY_TYPE.DOORSTEP && (!deliveryAddress || !deliveryPincode)) {
      throw new Error("deliveryAddress and deliveryPincode are required for DOORSTEP delivery");
    }

    const { normalizedItems, subtotal, gstAmount, transport, design, totalAmount, discountAmount: discount, advanceAmount: advance, balanceAmount } =
      computeQuotationTotals({
        items,
        gstPercent,
        transportCharges: toAmount(transportCharges) + toAmount(transportationCost),
        designCharges,
        discountAmount,
        advanceAmount
      });

    const computedItems = applyComputedQuotationFields(normalizedItems, customColumns);
    validateCustomQuotationFields(computedItems, customColumns);

    const inventoryWarnings = await reserveInventoryForItems(client, sellerId, computedItems, { strict: false });

    const quotationNumber = await getNextQuotationNumber(client, sellerId);
    const { sellerQuotationSerial, sellerQuotationNumber } = await getNextSellerQuotationMeta(client, sellerId);
    const normalizedCustomQuotationNumber = normalizeCustomQuotationNumber(customQuotationNumber);

    const quotationResult = await client.query(
      `INSERT INTO quotations
       (quotation_number, seller_quotation_serial, seller_quotation_number, custom_quotation_number, seller_id, customer_id, created_by, subtotal, gst_amount, transport_charges, design_charges, total_amount, discount_amount, advance_amount, balance_amount, payment_status, order_status, quotation_sent, delivery_type, delivery_date, delivery_address, delivery_pincode, transportation_cost, design_cost_confirmed, source_channel, record_status, customer_monthly_billing, watermark_text, created_under_plan_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, FALSE, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
       RETURNING *`,
      [
        quotationNumber,
        sellerQuotationSerial,
        sellerQuotationNumber,
        normalizedCustomQuotationNumber,
        sellerId,
        customerId,
        createdBy || null,
        subtotal,
        gstAmount,
        transport,
        design,
        totalAmount,
        discount,
        advance,
        balanceAmount,
        paymentStatus || (advance > 0 && balanceAmount > 0 ? "partial" : "pending"),
        normalizeOrderStatus(orderStatus || ORDER_STATUS.NEW),
        normalizedDeliveryType,
        deliveryDate || null,
        deliveryAddress || null,
        deliveryPincode || null,
        toAmount(transportationCost),
        Boolean(designCostConfirmed),
        sourceChannel || "manual",
        recordStatus || "submitted",
        Boolean(customerMonthlyBilling),
        getQuotationWatermark(currentSubscription),
        currentSubscription.plan_id
      ]
    );

    const quotation = quotationResult.rows[0];

    for (const item of computedItems) {
      await client.query(
        `INSERT INTO quotation_items
         (quotation_id, seller_id, product_id, variant_id, size, quantity, unit_price, total_price, material_type, thickness, design_name, sku, color_name, imported_color_note, ps_included, dimension_height, dimension_width, dimension_unit, item_note, pricing_type, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, COALESCE($21::jsonb, '{}'::jsonb))`,
        [
          quotation.id,
          sellerId,
          item.product_id || null,
          item.variant_id || null,
          item.size || null,
          item.quantity,
          item.unitPrice,
          item.totalPrice,
          item.material_type || null,
          item.thickness || null,
          item.design_name || null,
          item.sku || null,
          item.color_name || null,
          item.imported_color_note || null,
          Boolean(item.ps_included),
          item.dimension_height || null,
          item.dimension_width || null,
          item.dimension_unit || null,
          item.item_note || null,
          item.pricing_type || "SFT",
          JSON.stringify(item.custom_fields || {})
        ]
      );
    }

    const customerOutstanding = await getCustomerOutstanding(customerId, sellerId);

    await client.query(
      `INSERT INTO ledger (seller_id, customer_id, quotation_id, debit, credit, balance)
       VALUES ($1, $2, $3, $4, 0, $5)`,
      [sellerId, customerId, quotation.id, balanceAmount, customerOutstanding]
    );

    await logOrderEvent(client, {
      sellerId,
      quotationId: quotation.id,
      eventType: "ORDER_CREATED",
      eventNote: `Created from ${sourceChannel || "manual"}`,
      actorUserId: createdBy
    });

    await createQuotationVersionSnapshot(client, {
      sellerId,
      quotation,
      items: computedItems,
      actorUserId: createdBy
    });

    await client.query("COMMIT");

    return {
      quotation,
      items: computedItems,
      customerOutstanding,
      inventoryWarnings
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createPaymentEntry(payload) {
  const { sellerId, quotationId, customerId, amount, paymentMethod, paymentDate, referenceNumber, actorUserId } = payload;

  const paymentAmount = toAmount(amount);
  if (!sellerId || !quotationId || !customerId || paymentAmount <= 0) {
    throw new Error("sellerId, quotationId, customerId and positive amount are required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const paymentResult = await client.query(
      `INSERT INTO payments (seller_id, quotation_id, customer_id, amount, payment_method, payment_date, reference_number)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), $7)
       RETURNING *`,
      [
        sellerId,
        quotationId,
        customerId,
        paymentAmount,
        paymentMethod || "cash",
        paymentDate || null,
        referenceNumber || null
      ]
    );

    await updateQuotationPaymentStatus(client, quotationId, sellerId);

    const customerOutstanding = await getCustomerOutstanding(customerId, sellerId);

    await client.query(
      `INSERT INTO ledger (seller_id, customer_id, quotation_id, debit, credit, balance)
       VALUES ($1, $2, $3, 0, $4, $5)`,
      [sellerId, customerId, quotationId, paymentAmount, customerOutstanding]
    );

    await logOrderEvent(client, {
      sellerId,
      quotationId,
      eventType: "PAYMENT_UPDATED",
      eventNote: `Payment recorded: ${paymentAmount}`,
      actorUserId
    });

    await client.query("COMMIT");

    return {
      payment: paymentResult.rows[0],
      customerOutstanding
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  ORDER_STATUS,
  DELIVERY_TYPE,
  computeQuotationTotals,
  createQuotationWithItems,
  createPaymentEntry,
  getCustomerOutstanding,
  updateQuotationPaymentStatus,
  reserveInventoryForItems,
  restoreInventoryForItems,
  toAmount,
  normalizeOrderStatus,
  normalizeDeliveryType,
  logOrderEvent,
  createQuotationVersionSnapshot,
  getSellerCustomQuotationColumns,
  validateCustomQuotationFields,
  applyComputedQuotationFields
};
