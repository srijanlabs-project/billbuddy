const pool = require("../db/db");
const { assertQuotationCreationAllowed, getQuotationWatermark } = require("./subscriptionService");
const { buildConfiguredQuotationItemTitle, normalizeItemDisplayConfig } = require("./quotationViewService");

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
      item_category: item.item_category || item.itemCategory || item.category || null,
      item_display_text: item.item_display_text || item.itemDisplayText || null,
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

async function validateQuotationItemRateLimits(clientOrPool, sellerId, items = []) {
  const productIds = [...new Set(
    (items || [])
      .map((item) => Number(item.product_id || item.productId || 0))
      .filter((value) => Number.isFinite(value) && value > 0)
  )];

  if (!productIds.length) return;

  const result = await clientOrPool.query(
    `SELECT id, material_name, base_price, limit_rate_edit, max_discount_percent, max_discount_type
     FROM products
     WHERE seller_id = $1
       AND id = ANY($2::int[])`,
    [sellerId, productIds]
  );

  const productMap = new Map(result.rows.map((row) => [Number(row.id), row]));

  for (const item of items || []) {
    const productId = Number(item.product_id || item.productId || 0);
    if (!productId || !productMap.has(productId)) continue;

    const product = productMap.get(productId);
    if (!product.limit_rate_edit) continue;

    const basePrice = toAmount(product.base_price);
    const rate = toAmount(item.unit_price ?? item.unitPrice);
    const maxDiscountValue = Math.max(0, toAmount(product.max_discount_percent));
    const maxDiscountType = String(product.max_discount_type || "percent").toLowerCase() === "amount" ? "amount" : "percent";
    if (basePrice <= 0 || rate <= 0) continue;

    const minimumAllowedRate = Number(
      Math.max(
        maxDiscountType === "percent"
          ? basePrice - (basePrice * maxDiscountValue / 100)
          : basePrice - maxDiscountValue,
        0
      ).toFixed(2)
    );
    if (rate + 0.0001 < minimumAllowedRate) {
      throw new Error(
        `${product.material_name || "Item"} cannot be added below Rs ${minimumAllowedRate.toLocaleString("en-IN")}. Maximum allowed discount is ${maxDiscountType === "percent" ? `${maxDiscountValue}%` : `Rs ${maxDiscountValue.toLocaleString("en-IN")}`}.`
      );
    }
  }
}

async function collectQuotationPriceExceptionReasons(clientOrPool, sellerId, items = []) {
  const productIds = [...new Set(
    (items || [])
      .map((item) => Number(item.product_id || item.productId || 0))
      .filter((value) => Number.isFinite(value) && value > 0)
  )];

  if (!productIds.length) return [];

  const result = await clientOrPool.query(
    `SELECT id, material_name, base_price, limit_rate_edit, max_discount_percent, max_discount_type
     FROM products
     WHERE seller_id = $1
       AND id = ANY($2::int[])`,
    [sellerId, productIds]
  );

  const productMap = new Map(result.rows.map((row) => [Number(row.id), row]));
  const reasons = [];

  (items || []).forEach((item, index) => {
    const productId = Number(item.product_id || item.productId || 0);
    if (!productId || !productMap.has(productId)) return;

    const product = productMap.get(productId);
    if (!product.limit_rate_edit) return;

    const basePrice = toAmount(product.base_price);
    const rate = toAmount(item.unit_price ?? item.unitPrice);
    const maxDiscountValue = Math.max(0, toAmount(product.max_discount_percent));
    const maxDiscountType = String(product.max_discount_type || "percent").toLowerCase() === "amount" ? "amount" : "percent";
    if (basePrice <= 0 || rate <= 0) return;

    const minimumAllowedRate = Number(
      Math.max(
        maxDiscountType === "percent"
          ? basePrice - (basePrice * maxDiscountValue / 100)
          : basePrice - maxDiscountValue,
        0
      ).toFixed(2)
    );

    if (rate + 0.0001 < minimumAllowedRate) {
      reasons.push({
        reasonType: "price_exception_below_min_rate",
        itemIndex: index,
        productId,
        requestedValue: rate,
        allowedValue: minimumAllowedRate,
        baseValue: basePrice,
        meta: {
          productName: product.material_name || "Item",
          maxDiscountValue,
          maxDiscountType
        }
      });
    }
  });

  return reasons;
}

async function getQuotationApprovalUser(client, sellerId, userId) {
  if (!sellerId || !userId) return null;
  const result = await client.query(
    `SELECT u.id, u.name, u.status, u.locked, u.approval_mode, u.approval_limit_amount,
            u.can_approve_quotations, u.can_approve_price_exception, r.role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND u.seller_id = $2
     LIMIT 1`,
    [userId, sellerId]
  );
  return result.rows[0] || null;
}

function canUserApproveQuotation(user, { totalAmount, hasPriceException }) {
  if (!user) return false;
  if (!user.status || user.locked) return false;
  const approvalMode = String(user.approval_mode || "").toLowerCase();
  if (!["approver", "both"].includes(approvalMode)) return false;
  if (!user.can_approve_quotations) return false;
  if (hasPriceException && !user.can_approve_price_exception) return false;
  const limit = toAmount(user.approval_limit_amount);
  return limit <= 0 ? false : totalAmount <= limit + 0.0001;
}

async function findFallbackSellerAdmin(client, sellerId, evaluationContext) {
  const { totalAmount, hasPriceException } = evaluationContext;
  const result = await client.query(
    `SELECT u.id, u.name, u.status, u.locked, u.approval_mode, u.approval_limit_amount,
            u.can_approve_quotations, u.can_approve_price_exception, r.role_name
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.seller_id = $1
       AND u.status = TRUE
       AND COALESCE(u.locked, FALSE) = FALSE
       AND LOWER(COALESCE(r.role_name, '')) IN ('seller admin', 'seller_admin', 'admin')
     ORDER BY u.id ASC`,
    [sellerId]
  );

  const eligible = result.rows.find((user) => canUserApproveQuotation(user, { totalAmount, hasPriceException }));
  return eligible || null;
}

async function findAssignedApprover(client, sellerId, requesterUserId, evaluationContext) {
  const visited = new Set();
  let currentRequesterId = Number(requesterUserId);

  while (currentRequesterId && !visited.has(currentRequesterId)) {
    visited.add(currentRequesterId);

    const mappingResult = await client.query(
      `SELECT approver_user_id
       FROM user_approval_mappings
       WHERE seller_id = $1
         AND requester_user_id = $2
         AND is_active = TRUE
       ORDER BY id DESC
       LIMIT 1`,
      [sellerId, currentRequesterId]
    );

    if (mappingResult.rowCount === 0) break;

    const approverUserId = Number(mappingResult.rows[0].approver_user_id);
    const approver = await getQuotationApprovalUser(client, sellerId, approverUserId);
    if (!approver) break;
    if (canUserApproveQuotation(approver, evaluationContext)) {
      return approver;
    }

    if (String(approver.approval_mode || "").toLowerCase() !== "both") {
      break;
    }
    currentRequesterId = approver.id;
  }

  return findFallbackSellerAdmin(client, sellerId, evaluationContext);
}

async function evaluateQuotationApproval(client, { sellerId, requesterUserId, totalAmount, items = [] }) {
  const requester = await getQuotationApprovalUser(client, sellerId, requesterUserId);
  if (!requester) {
    throw new Error("Quotation requester was not found for approval evaluation");
  }

  const priceExceptionReasons = await collectQuotationPriceExceptionReasons(client, sellerId, items);
  const reasons = [...priceExceptionReasons];
  const requesterLimit = Math.max(0, toAmount(requester.approval_limit_amount));
  if (totalAmount > requesterLimit + 0.0001) {
    reasons.unshift({
      reasonType: "amount_limit_exceeded",
      requestedValue: totalAmount,
      allowedValue: requesterLimit,
      baseValue: requesterLimit,
      meta: {
        requesterId: requester.id,
        requesterName: requester.name || "Requester"
      }
    });
  }

  if (!reasons.length) {
    return {
      requiresApproval: false,
      approvalStatus: "not_required",
      assignedApprover: null,
      reasons: []
    };
  }

  const hasPriceException = reasons.some((reason) => reason.reasonType === "price_exception_below_min_rate");
  if (canUserApproveQuotation(requester, { totalAmount, hasPriceException })) {
    return {
      requiresApproval: false,
      approvalStatus: "approved",
      assignedApprover: null,
      reasons
    };
  }

  const assignedApprover = await findAssignedApprover(client, sellerId, requester.id, { totalAmount, hasPriceException });
  if (!assignedApprover) {
    throw new Error("No approver configured for this user.");
  }

  return {
    requiresApproval: true,
    approvalStatus: "pending",
    assignedApprover,
    reasons
  };
}

async function getPublishedItemDisplayConfig(clientOrPool, sellerId) {
  const result = await clientOrPool.query(
    `SELECT modules
     FROM seller_configuration_profiles
     WHERE seller_id = $1
       AND status = 'published'
     ORDER BY published_at DESC NULLS LAST, updated_at DESC, id DESC
     LIMIT 1`,
    [sellerId]
  );

  return normalizeItemDisplayConfig(result.rows[0]?.modules?.itemDisplayConfig || {});
}

async function applyQuotationItemDisplayConfig(clientOrPool, sellerId, items = []) {
  const itemDisplayConfig = await getPublishedItemDisplayConfig(clientOrPool, sellerId);
  const productIdsNeedingCategory = [...new Set(
    (items || [])
      .filter((item) => !String(item.item_category || item.itemCategory || item.category || "").trim() && item.product_id)
      .map((item) => Number(item.product_id))
      .filter((id) => Number.isFinite(id) && id > 0)
  )];

  const productCategoryMap = new Map();
  if (productIdsNeedingCategory.length) {
    const result = await clientOrPool.query(
      `SELECT id, category
       FROM products
       WHERE seller_id = $1
         AND id = ANY($2::int[])`,
      [sellerId, productIdsNeedingCategory]
    );
    result.rows.forEach((row) => {
      productCategoryMap.set(Number(row.id), String(row.category || "").trim());
    });
  }

  return (items || []).map((item) => {
    const itemCategory = String(
      item.item_category
      || item.itemCategory
      || item.category
      || productCategoryMap.get(Number(item.product_id))
      || ""
    ).trim() || null;

    const itemWithCategory = {
      ...item,
      item_category: itemCategory
    };

    return {
      ...itemWithCategory,
      item_display_text: buildConfiguredQuotationItemTitle(itemWithCategory, itemDisplayConfig) || null
    };
  });
}

function getApprovalTypeSummary(reasons = []) {
  const reasonTypes = [...new Set((reasons || []).map((reason) => reason.reasonType))];
  if (reasonTypes.length > 1) return "combined";
  if (reasonTypes.includes("price_exception_below_min_rate")) return "price_exception";
  if (reasonTypes.includes("amount_limit_exceeded")) return "amount_limit";
  return null;
}

async function supersedeActiveApprovalRequest(client, quotationId, sellerId) {
  const result = await client.query(
    `SELECT id
     FROM quotation_approval_requests
     WHERE quotation_id = $1
       AND seller_id = $2
       AND superseded_at IS NULL
       AND status IN ('pending', 'approved', 'rejected')
     ORDER BY created_at DESC
     LIMIT 1`,
    [quotationId, sellerId]
  );

  if (result.rowCount === 0) {
    return null;
  }

  const requestId = Number(result.rows[0].id);
  await client.query(
    `UPDATE quotation_approval_requests
     SET status = 'superseded',
         superseded_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [requestId]
  );

  return requestId;
}

async function createQuotationApprovalRequest(client, { sellerId, quotationId, quotationVersionNo, requestedByUserId, assignedApproverUserId, requestedAmount, reasons = [], previousRequestId = null }) {
  const approvalResult = await client.query(
    `INSERT INTO quotation_approval_requests
     (seller_id, quotation_id, quotation_version_no, requested_by_user_id, assigned_approver_user_id, status, approval_type_summary, requested_amount)
     VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
     RETURNING *`,
    [
      sellerId,
      quotationId,
      quotationVersionNo,
      requestedByUserId || null,
      assignedApproverUserId || null,
      getApprovalTypeSummary(reasons),
      requestedAmount
    ]
  );

  const approvalRequest = approvalResult.rows[0];

  if (previousRequestId) {
    await client.query(
      `UPDATE quotation_approval_requests
       SET superseded_by_request_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [approvalRequest.id, previousRequestId]
    );
  }

  for (const reason of reasons) {
    await client.query(
      `INSERT INTO quotation_approval_reasons
       (approval_request_id, reason_type, item_index, product_id, requested_value, allowed_value, base_value, meta_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::jsonb, '{}'::jsonb))`,
      [
        approvalRequest.id,
        reason.reasonType,
        reason.itemIndex ?? null,
        reason.productId ?? null,
        reason.requestedValue ?? null,
        reason.allowedValue ?? null,
        reason.baseValue ?? null,
        JSON.stringify(reason.meta || {})
      ]
    );
  }

  const approvalSummary = getApprovalTypeSummary(reasons).replace(/_/g, " ");
  const notificationResult = await client.query(
    `INSERT INTO notifications (
       title,
       message,
       audience_type,
       channel,
       seller_id,
       sent_at,
       created_by
     )
     VALUES ($1, $2, 'specific_seller', 'in_app', $3, CURRENT_TIMESTAMP, $4)
     RETURNING id`,
    [
      `Approval required for quotation ${quotationId}`,
      `A quotation approval request has been raised for version ${quotationVersionNo}. Reason: ${approvalSummary}.`,
      sellerId,
      requestedByUserId || null
    ]
  );
  const notificationId = notificationResult.rows?.[0]?.id;
  if (notificationId) {
    await client.query(
      `INSERT INTO notification_logs (
         notification_id,
         seller_id,
         delivery_status,
         delivery_message,
         delivered_at
       )
       VALUES ($1, $2, 'sent', $3, CURRENT_TIMESTAMP)`,
      [
        notificationId,
        sellerId,
        `Approval request assigned${assignedApproverUserId ? ` to user ${assignedApproverUserId}` : ""}.`
      ]
    );
  }

  return approvalRequest;
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
    customQuotationNumber,
    referenceRequestId
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
    const displayReadyItems = await applyQuotationItemDisplayConfig(client, sellerId, computedItems);
    const approvalEvaluation = await evaluateQuotationApproval(client, {
      sellerId,
      requesterUserId: createdBy,
      totalAmount,
      items: displayReadyItems
    });

    const inventoryWarnings = await reserveInventoryForItems(client, sellerId, displayReadyItems, { strict: false });

    const quotationNumber = await getNextQuotationNumber(client, sellerId);
    const { sellerQuotationSerial, sellerQuotationNumber } = await getNextSellerQuotationMeta(client, sellerId);
    const normalizedCustomQuotationNumber = normalizeCustomQuotationNumber(customQuotationNumber);
    const normalizedReferenceRequestId = String(referenceRequestId || "").trim().replace(/\s+/g, " ").slice(0, 120) || null;

    const quotationResult = await client.query(
      `INSERT INTO quotations
       (quotation_number, seller_quotation_serial, seller_quotation_number, custom_quotation_number, seller_id, customer_id, created_by, subtotal, gst_amount, transport_charges, design_charges, total_amount, discount_amount, advance_amount, balance_amount, reference_request_id, payment_status, order_status, quotation_sent, delivery_type, delivery_date, delivery_address, delivery_pincode, transportation_cost, design_cost_confirmed, source_channel, record_status, customer_monthly_billing, watermark_text, created_under_plan_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, FALSE, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
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
        normalizedReferenceRequestId,
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

    let activeApprovalRequest = null;
    if (approvalEvaluation.requiresApproval) {
      activeApprovalRequest = await createQuotationApprovalRequest(client, {
        sellerId,
        quotationId: quotation.id,
        quotationVersionNo: quotation.version_no || 1,
        requestedByUserId: createdBy,
        assignedApproverUserId: approvalEvaluation.assignedApprover?.id || null,
        requestedAmount: totalAmount,
        reasons: approvalEvaluation.reasons
      });

      const quotationUpdateResult = await client.query(
        `UPDATE quotations
         SET approval_required = TRUE,
             approval_status = 'pending',
             active_approval_request_id = $1,
             approved_for_download_at = NULL
         WHERE id = $2
         RETURNING *`,
        [activeApprovalRequest.id, quotation.id]
      );
      Object.assign(quotation, quotationUpdateResult.rows[0]);
    } else {
      const quotationUpdateResult = await client.query(
        `UPDATE quotations
         SET approval_required = $1,
             approval_status = $2,
             active_approval_request_id = NULL,
             approved_for_download_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE approved_for_download_at END
         WHERE id = $3
         RETURNING *`,
        [approvalEvaluation.approvalStatus === "approved", approvalEvaluation.approvalStatus, quotation.id]
      );
      Object.assign(quotation, quotationUpdateResult.rows[0]);
    }

    for (const item of displayReadyItems) {
      await client.query(
        `INSERT INTO quotation_items
         (quotation_id, seller_id, product_id, variant_id, size, quantity, unit_price, total_price, material_type, thickness, design_name, sku, color_name, imported_color_note, ps_included, dimension_height, dimension_width, dimension_unit, item_note, pricing_type, item_category, item_display_text, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, COALESCE($23::jsonb, '{}'::jsonb))`,
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
          item.item_category || null,
          item.item_display_text || null,
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
      items: displayReadyItems,
      actorUserId: createdBy
    });

    await client.query("COMMIT");

    return {
      quotation,
      items: computedItems,
      customerOutstanding,
      inventoryWarnings,
      approval: {
        requiresApproval: approvalEvaluation.requiresApproval,
        approvalStatus: quotation.approval_status,
        assignedApprover: approvalEvaluation.assignedApprover
          ? {
            id: approvalEvaluation.assignedApprover.id,
            name: approvalEvaluation.assignedApprover.name || "-"
          }
          : null,
        activeApprovalRequestId: activeApprovalRequest?.id || null,
        reasons: approvalEvaluation.reasons
      }
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
  validateQuotationItemRateLimits,
  collectQuotationPriceExceptionReasons,
  evaluateQuotationApproval,
  supersedeActiveApprovalRequest,
  createQuotationApprovalRequest,
  validateCustomQuotationFields,
  applyComputedQuotationFields,
  applyQuotationItemDisplayConfig
};
