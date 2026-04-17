const pool = require("../db/db");
const { assertQuotationCreationAllowed, getQuotationWatermark } = require("./subscriptionService");
const { buildConfiguredQuotationItemTitle, normalizeItemDisplayConfig } = require("./quotationViewService");
const { applyTemplateAccessPolicy, getRandomActivePlatformFooterBanner } = require("./quotationTemplatePolicy");
const {
  applyFrozenPresentationToQuotation,
  buildFrozenQuotationCalculationSnapshot,
  buildFrozenQuotationDocumentSnapshot,
  getDefaultDocumentTemplate
} = require("./quotationSnapshotService");
const { getRichTextHtml, richTextToPlainText } = require("./richTextService");

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

function normalizePdfColumnKey(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  if (["material", "service", "services", "service_name", "services_name", "service_title", "services_title", "item_name", "product_name"].includes(normalized)) {
    return "material_name";
  }
  if (normalized === "qty") return "quantity";
  return normalized;
}

function toAmount(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFormulaAmount(value) {
  if (value === null || value === undefined || value === "") return 1;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 1;
}

function normalizeCategoryToken(value) {
  return String(value || "").trim().toLowerCase();
}

function buildCategoryFormulaFlags(categoryValue) {
  const normalized = normalizeCategoryToken(categoryValue);
  const compact = normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return {
    normalized,
    compact
  };
}

function isColumnApplicableForItemCategory(column, itemCategory) {
  const configuredCategories = Array.isArray(column?.category_visibility)
    ? column.category_visibility
    : (Array.isArray(column?.categoryVisibility) ? column.categoryVisibility : []);
  const normalizedAllowed = configuredCategories
    .map((entry) => normalizeCategoryToken(entry))
    .filter(Boolean);
  if (!normalizedAllowed.length) return true;
  const normalizedCategory = normalizeCategoryToken(itemCategory);
  if (!normalizedCategory) return false;
  return normalizedAllowed.includes(normalizedCategory);
}

function parsePercentLike(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const numeric = Number(raw.replace(/%/g, "").trim());
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
}

const BASE_LINEAR_UNIT_METERS = Object.freeze({
  sqft: 0.3048,
  sqm: 1,
  sqin: 0.0254
});

function getDefaultUnitConversionMap() {
  return {
    mm: 0.001,
    cm: 0.01,
    in: 0.0254,
    ft: 0.3048,
    m: 1
  };
}

async function getPlatformUnitConversionMap(clientOrPool) {
  const result = await clientOrPool.query(
    `SELECT unit_code, to_meter_factor
     FROM platform_unit_conversions
     WHERE is_active = TRUE
     ORDER BY display_order ASC, unit_code ASC`
  );
  const map = getDefaultUnitConversionMap();
  result.rows.forEach((row) => {
    const unitCode = String(row.unit_code || "").trim().toLowerCase();
    const numeric = Number(row.to_meter_factor);
    if (!unitCode || !Number.isFinite(numeric) || numeric <= 0) return;
    map[unitCode] = numeric;
  });
  return map;
}

async function getPublishedQuotationPdfConfiguration(clientOrPool, sellerId) {
  const result = await clientOrPool.query(
    `SELECT
        scp.modules,
        sqc.column_key,
        sqc.label,
        sqc.column_type,
        sqc.visible_in_pdf,
        sqc.help_text_in_pdf,
        sqc.display_order
     FROM seller_configuration_profiles scp
     INNER JOIN seller_quotation_columns sqc ON sqc.profile_id = scp.id
     WHERE scp.seller_id = $1
       AND scp.status = 'published'
     ORDER BY sqc.display_order ASC, sqc.id ASC`,
    [sellerId]
  );

  const modules = result.rows[0]?.modules || {};
  const visibleColumns = result.rows
    .filter((column) => Boolean(column.visible_in_pdf))
    .map((column) => ({
      key: normalizePdfColumnKey(column.column_key),
      label: column.label || column.column_key || "Column",
      type: column.column_type || "text",
      helpTextInPdf: Boolean(column.help_text_in_pdf)
    }));

  if (visibleColumns.length) {
    const tableColumns = visibleColumns.filter((column) => !column.helpTextInPdf || normalizePdfColumnKey(column.key) === "material_name");
    if (!tableColumns.some((column) => normalizePdfColumnKey(column.key) === "material_name")) {
      tableColumns.unshift({ key: "material_name", label: "Item", type: "text" });
    }

    return {
      modules,
      columns: tableColumns,
      allPdfColumns: visibleColumns
    };
  }

  return {
    modules,
    allPdfColumns: [
      { key: "material_name", label: "Item", type: "text" },
      { key: "quantity", label: "Qty", type: "number" },
      { key: "rate", label: "Rate", type: "number" },
      { key: "amount", label: "Amount", type: "number" }
    ],
    columns: [
      { key: "material_name", label: "Item", type: "text" },
      { key: "quantity", label: "Qty", type: "number" },
      { key: "rate", label: "Rate", type: "number" },
      { key: "amount", label: "Amount", type: "number" }
    ]
  };
}

function getUnitMeterFactor(unit, conversionMap = null) {
  const map = conversionMap || getDefaultUnitConversionMap();
  const normalized = String(unit || "").trim().toLowerCase();
  const explicit = Number(map[normalized]);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const ftFallback = Number(map.ft);
  if (Number.isFinite(ftFallback) && ftFallback > 0) return ftFallback;
  return 0.3048;
}

function buildComputedFieldContext(item, contextOptions = {}) {
  const customFields = item.custom_fields || item.customFields || {};
  const rawWidth = item.dimension_width ?? item.dimensionWidth;
  const rawHeight = item.dimension_height ?? item.dimensionHeight;
  const hasWidth = rawWidth !== null && rawWidth !== undefined && rawWidth !== "";
  const hasHeight = rawHeight !== null && rawHeight !== undefined && rawHeight !== "";
  const width = toAmount(rawWidth);
  const height = toAmount(rawHeight);
  const unit = String(item.dimension_unit || item.dimensionUnit || item.unit || "ft").trim().toLowerCase();
  const conversionMap = contextOptions.unitConversionMap || getDefaultUnitConversionMap();
  const unitToMeter = getUnitMeterFactor(unit, conversionMap);
  const unitFactorSqft = Number((unitToMeter / BASE_LINEAR_UNIT_METERS.sqft).toFixed(8));
  const unitFactorSqm = Number((unitToMeter / BASE_LINEAR_UNIT_METERS.sqm).toFixed(8));
  const unitFactorSqin = Number((unitToMeter / BASE_LINEAR_UNIT_METERS.sqin).toFixed(8));

  const widthFt = hasWidth ? Number((width * unitFactorSqft).toFixed(6)) : null;
  const heightFt = hasHeight ? Number((height * unitFactorSqft).toFixed(6)) : null;
  const widthSqmBase = hasWidth ? Number((width * unitFactorSqm).toFixed(6)) : null;
  const heightSqmBase = hasHeight ? Number((height * unitFactorSqm).toFixed(6)) : null;
  const widthSqinBase = hasWidth ? Number((width * unitFactorSqin).toFixed(6)) : null;
  const heightSqinBase = hasHeight ? Number((height * unitFactorSqin).toFixed(6)) : null;

  const areaSqft = (!hasWidth && !hasHeight)
    ? null
    : Number((((widthFt ?? 1) * (heightFt ?? 1))).toFixed(6));
  const areaSqm = (!hasWidth && !hasHeight)
    ? null
    : Number((((widthSqmBase ?? 1) * (heightSqmBase ?? 1))).toFixed(6));
  const areaSqin = (!hasWidth && !hasHeight)
    ? null
    : Number((((widthSqinBase ?? 1) * (heightSqinBase ?? 1))).toFixed(6));
  const category = buildCategoryFormulaFlags(item.item_category || item.itemCategory || item.category);
  const context = {
    quantity: toAmount(item.quantity),
    rate: toAmount(item.unitPrice ?? item.unit_price),
    unit_price: toAmount(item.unitPrice ?? item.unit_price),
    amount: toAmount(item.totalPrice ?? item.total_price),
    total_price: toAmount(item.totalPrice ?? item.total_price),
    width,
    height,
    unit_factor: unitFactorSqft,
    unit_factor_sqft: unitFactorSqft,
    unit_factor_sqm: unitFactorSqm,
    unit_factor_sqin: unitFactorSqin,
    width_base_sqft: widthFt,
    height_base_sqft: heightFt,
    width_base_sqm: widthSqmBase,
    height_base_sqm: heightSqmBase,
    width_base_sqin: widthSqinBase,
    height_base_sqin: heightSqinBase,
    width_ft: widthFt,
    height_ft: heightFt,
    area_sqft: areaSqft,
    area_sqm: areaSqm,
    area_sqin: areaSqin,
    area_base: areaSqft,
    is_services: category.normalized === "services" || category.normalized === "service" ? 1 : 0,
    is_product: category.normalized === "product" ? 1 : 0,
    is_sheet: category.normalized === "sheet" ? 1 : 0
  };

  if (category.compact) {
    context[`is_category_${category.compact}`] = 1;
  }

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

  const replaced = source.replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, (token) => {
    if (Object.prototype.hasOwnProperty.call(context, token)) {
      return String(toFormulaAmount(context[token]));
    }
    if (token.startsWith("is_")) return "0";
    return String(toFormulaAmount(undefined));
  });
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

function normalizeComparableAddress(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeGstin(value) {
  return String(value || "").trim().toUpperCase();
}

function isValidGstinFormat(value) {
  return /^[0-9A-Z]{15}$/.test(normalizeGstin(value));
}

function getEffectiveCustomerGstinForQuotation(customer = {}, deliveryAddress = "", deliveryPincode = "") {
  const customerGstin = normalizeGstin(customer.gst_number);
  const shippingAddresses = Array.isArray(customer.shipping_addresses) ? customer.shipping_addresses : [];
  const normalizedDeliveryAddress = normalizeComparableAddress(deliveryAddress);
  const normalizedDeliveryPincode = String(deliveryPincode || "").trim();

  const matchingShippingAddress = shippingAddresses.find((entry) => {
    const shippingGstin = normalizeGstin(entry?.gstNumber || "");
    if (!shippingGstin) return false;
    const entryAddress = normalizeComparableAddress(entry?.address);
    const entryPincode = String(entry?.pincode || "").trim();
    return (
      (normalizedDeliveryAddress && entryAddress && normalizedDeliveryAddress === entryAddress) ||
      (normalizedDeliveryPincode && entryPincode && normalizedDeliveryPincode === entryPincode)
    );
  });

  return normalizeGstin(matchingShippingAddress?.gstNumber || customerGstin);
}

function normalizeCustomerShippingAddressEntry(entry = {}) {
  const label = String(entry?.label || "").trim();
  const address = String(entry?.address || "").trim();
  const pincode = String(entry?.pincode || "").trim();
  const gstNumber = normalizeGstin(entry?.gstNumber || "");
  if (!address) return null;
  return {
    label,
    address,
    pincode,
    gstNumber
  };
}

function normalizeCustomerShippingAddresses(addresses = []) {
  const normalized = (Array.isArray(addresses) ? addresses : [])
    .map((entry) => normalizeCustomerShippingAddressEntry(entry))
    .filter(Boolean);
  const deduped = [];
  const seen = new Set();
  normalized.forEach((entry) => {
    const key = `${normalizeComparableAddress(entry.address)}|${String(entry.pincode || "").trim()}`;
    if (!key || seen.has(key)) return;
    seen.add(key);
    deduped.push(entry);
  });
  return deduped;
}

function mergeCustomerShippingAddresses(existingAddresses = [], incomingAddresses = [], deliveryAddress = "", deliveryPincode = "") {
  const deliveryEntry = String(deliveryAddress || "").trim()
    ? [{
        label: "",
        address: String(deliveryAddress || "").trim(),
        pincode: String(deliveryPincode || "").trim(),
        gstNumber: ""
      }]
    : [];
  return normalizeCustomerShippingAddresses([
    ...(Array.isArray(existingAddresses) ? existingAddresses : []),
    ...(Array.isArray(incomingAddresses) ? incomingAddresses : []),
    ...deliveryEntry
  ]);
}

function normalizeQuotationItems(items = []) {
  return (items || []).map((item) => {
    const quantity = toAmount(item.quantity);
    const unitPrice = toAmount(item.unit_price ?? item.unitPrice);
    const rawTotalPrice = item.total_price ?? item.totalPrice;
    const hasExplicitTotalPrice = rawTotalPrice !== null && rawTotalPrice !== undefined && rawTotalPrice !== "";
    const totalPrice = hasExplicitTotalPrice ? toAmount(rawTotalPrice) : null;

    return {
      ...item,
      quantity,
      unitPrice,
      totalPrice,
      hasExplicitTotalPrice,
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
}

function computeQuotationTotals({ items, gstPercent, gstMode = false, transportCharges, designCharges, discountAmount, advanceAmount, calculationColumns = [] }) {
  const normalizedItems = normalizeQuotationItems(items);
  const calcColumns = Array.isArray(calculationColumns)
    ? calculationColumns.filter((column) => Boolean(column.included_in_calculation))
    : [];
  const calcKeys = calcColumns
    .map((column) => ({
      key: String(column.column_key || "").trim(),
      displayOrder: Number.isFinite(Number(column.display_order)) ? Number(column.display_order) : Number.MAX_SAFE_INTEGER
    }))
    .filter((entry) => Boolean(entry.key))
    .sort((left, right) => {
      if (left.displayOrder !== right.displayOrder) return left.displayOrder - right.displayOrder;
      return left.key.localeCompare(right.key);
    })
    .map((entry) => entry.key);

  const computedLineItems = normalizedItems.map((item) => {
    const quantity = toAmount(item.quantity);
    const unitPrice = toAmount(item.unitPrice);
    let totalPrice = item.hasExplicitTotalPrice ? toAmount(item.totalPrice) : 0;
    let usedCalcColumn = false;

    if (calcKeys.length) {
      const customFields = item.custom_fields || item.customFields || {};
      for (const key of calcKeys) {
        const value = customFields[key];
        if (value === undefined || value === null || value === "") continue;
        const numericValue = toAmount(value);
        if (!Number.isFinite(numericValue)) continue;
        totalPrice = Number(numericValue.toFixed(2));
        usedCalcColumn = true;
        break;
      }
    }

    if (!usedCalcColumn && item.hasExplicitTotalPrice) {
      totalPrice = toAmount(item.totalPrice);
    }

    if (!usedCalcColumn && !item.hasExplicitTotalPrice) {
      totalPrice = quantity * unitPrice;
    }

    return {
      ...item,
      totalPrice
    };
  });

  const subtotal = computedLineItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const gstPct = toAmount(gstPercent);
  const gstAmount = gstMode
    ? computedLineItems.reduce((sum, item) => {
      const customFields = item.custom_fields || item.customFields || {};
      const itemGstPercent = parsePercentLike(customFields.gst_percent);
      const lineTax = Number((toAmount(item.totalPrice) * (itemGstPercent / 100)).toFixed(2));
      return sum + lineTax;
    }, 0)
    : subtotal * (gstPct / 100);
  const transport = toAmount(transportCharges);
  const design = toAmount(designCharges);
  const discount = gstMode ? 0 : toAmount(discountAmount);
  const totalAmount = subtotal + gstAmount - discount;
  const advance = toAmount(advanceAmount);
  const balanceAmount = Math.max(Number((totalAmount - advance).toFixed(2)), 0);

  return {
    normalizedItems: computedLineItems,
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

function derivePrefixFromBusinessName(value) {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
  if (!normalized) return "QTN";
  return normalized.slice(0, 3).padEnd(3, "X");
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
    `SELECT quotation_number_prefix, business_name, name
     FROM sellers
     WHERE id = $1
     LIMIT 1`,
    [sellerId]
  );
  const sellerRow = sellerResult.rows[0] || {};
  const configuredPrefix = String(sellerRow.quotation_number_prefix || "").trim();
  const fallbackPrefix = derivePrefixFromBusinessName(sellerRow.business_name || sellerRow.name || "");
  const prefix = normalizeQuotationPrefix(configuredPrefix || fallbackPrefix);
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
     WHERE u.id = $1
       AND u.seller_id = $2
       AND COALESCE(u.is_platform_admin, FALSE) = FALSE
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
       AND COALESCE(u.is_platform_admin, FALSE) = FALSE
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

  const requesterApprovalMode = String(requester.approval_mode || "").toLowerCase();
  const requesterIsAdminRole = ["admin", "seller admin", "seller_admin"].includes(String(requester.role_name || "").toLowerCase());

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
  if (requesterIsAdminRole && ["approver", "both"].includes(requesterApprovalMode) && requester.can_approve_quotations) {
    if (!hasPriceException || requester.can_approve_price_exception) {
      return {
        requiresApproval: false,
        approvalStatus: "approved",
        assignedApprover: null,
        reasons
      };
    }
  }

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
      COALESCE((SELECT SUM(COALESCE(balance_amount, total_amount)) FROM quotations WHERE customer_id = $1 AND seller_id = $2 AND archived_at IS NULL AND COALESCE(record_status, 'submitted') <> 'archived'), 0) AS invoiced,
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
  const frozenQuotation = applyFrozenPresentationToQuotation(quotation);
  await client.query(
    `INSERT INTO quotation_versions
     (seller_id, quotation_id, version_no, quotation_snapshot, items_snapshot, actor_user_id)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
    [
      sellerId,
      frozenQuotation.id,
      frozenQuotation.version_no || 1,
      JSON.stringify(frozenQuotation),
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
    `SELECT sqc.column_key, sqc.label, sqc.column_type, sqc.option_values, sqc.definition_text, sqc.formula_expression, sqc.required, sqc.visible_in_form, sqc.included_in_calculation, sqc.category_visibility
     FROM seller_configuration_profiles scp
     INNER JOIN seller_quotation_columns sqc ON sqc.profile_id = scp.id
     WHERE scp.seller_id = $1
       AND scp.status = 'published'
     ORDER BY sqc.display_order ASC, sqc.id ASC`,
    [sellerId]
  );

  const sellerColumns = result.rows.filter((column) => !BUILT_IN_QUOTATION_KEYS.has(String(column.column_key || "").trim().toLowerCase()));

  const sellerMeta = await clientOrPool.query(
    `SELECT seller_type
     FROM sellers
     WHERE id = $1
     LIMIT 1`,
    [sellerId]
  );
  const isAdvancedSeller = String(sellerMeta.rows?.[0]?.seller_type || "BASIC").trim().toUpperCase() === "ADVANCED";

  const platformFormulasResult = await clientOrPool.query(
    `SELECT pfd.formula_key AS column_key,
            pfd.label,
            'formula'::varchar AS column_type,
            '[]'::jsonb AS option_values,
            pfd.definition_text,
            pfd.formula_expression,
            FALSE AS required,
            FALSE AS visible_in_form,
            pfd.included_in_calculation,
            '[]'::jsonb AS category_visibility,
            pfd.display_order,
            pfd.target_scope
     FROM platform_formula_definitions pfd
     WHERE pfd.is_active = TRUE
       AND (
         pfd.target_scope = 'GLOBAL'
         OR (pfd.target_scope = 'GLOBAL_ADVANCED' AND $2::boolean = TRUE)
         OR (pfd.target_scope = 'SELLER_ADVANCED' AND pfd.target_seller_id = $1 AND $2::boolean = TRUE)
       )
     ORDER BY
       CASE
         WHEN pfd.target_scope = 'SELLER_ADVANCED' THEN 1
         WHEN pfd.target_scope = 'GLOBAL_ADVANCED' THEN 2
         ELSE 3
       END,
       pfd.display_order ASC,
       pfd.id ASC`,
    [sellerId, isAdvancedSeller]
  );

  const merged = [];
  const seenKeys = new Set();

  platformFormulasResult.rows.forEach((column) => {
    const key = String(column.column_key || "").trim().toLowerCase();
    if (!key || BUILT_IN_QUOTATION_KEYS.has(key) || seenKeys.has(key)) return;
    seenKeys.add(key);
    merged.push(column);
  });

  sellerColumns.forEach((column) => {
    const key = String(column.column_key || "").trim().toLowerCase();
    if (!key || BUILT_IN_QUOTATION_KEYS.has(key)) return;
    const existingIndex = merged.findIndex((entry) => String(entry.column_key || "").trim().toLowerCase() === key);
    if (existingIndex >= 0) {
      merged[existingIndex] = column;
      return;
    }
    merged.push(column);
  });

  return merged;
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
        if (!isColumnApplicableForItemCategory(column, item.item_category || item.category)) {
          return;
        }
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

function applyComputedQuotationFields(items, customColumns = [], contextOptions = {}) {
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
      if (!isColumnApplicableForItemCategory(column, nextItem.item_category || nextItem.category)) return;
      const context = buildComputedFieldContext(nextItem, contextOptions);
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
    gstMode,
    customQuotationNumber,
    referenceRequestId,
    notesRichText,
    termsRichText,
    shippingAddresses
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
    const unitConversionMap = await getPlatformUnitConversionMap(client);

    const customerCheck = await client.query(
      `SELECT id, name, firm_name, mobile, email, address, gst_number, monthly_billing, shipping_addresses
       FROM customers
       WHERE id = $1 AND seller_id = $2 AND archived_at IS NULL
       LIMIT 1`,
      [customerId, sellerId]
    );
    if (customerCheck.rowCount === 0) {
      throw new Error("Customer does not belong to this seller");
    }

    const normalizedDeliveryType = normalizeDeliveryType(deliveryType || DELIVERY_TYPE.PICKUP);
    const customerRow = customerCheck.rows[0] || {};
    const mergedShippingAddresses = mergeCustomerShippingAddresses(
      customerRow.shipping_addresses,
      shippingAddresses,
      normalizedDeliveryType === DELIVERY_TYPE.DOORSTEP ? deliveryAddress : "",
      normalizedDeliveryType === DELIVERY_TYPE.DOORSTEP ? deliveryPincode : ""
    );
    if (normalizedDeliveryType === DELIVERY_TYPE.DOORSTEP) {
      if (!deliveryAddress || !deliveryPincode) {
        throw new Error("deliveryAddress and deliveryPincode are required for DOORSTEP delivery");
      }
      const normalizedPincode = String(deliveryPincode || "").trim();
      if (!/^\d{6}$/.test(normalizedPincode)) {
        throw new Error("deliveryPincode must be a 6-digit number");
      }
    }

    const nextGstMode = Boolean(gstMode);
    if (nextGstMode) {
      const sellerResult = await client.query(
        `SELECT gst_number
         FROM sellers
         WHERE id = $1
         LIMIT 1`,
        [sellerId]
      );
      const sellerGstin = normalizeGstin(sellerResult.rows[0]?.gst_number || "");
      if (!isValidGstinFormat(sellerGstin)) {
        throw new Error("Seller GST is required and must be valid for GST quotation.");
      }

      const effectiveCustomerGstin = getEffectiveCustomerGstinForQuotation({
        ...customerRow,
        shipping_addresses: mergedShippingAddresses
      }, deliveryAddress, deliveryPincode);
      if (effectiveCustomerGstin && !isValidGstinFormat(effectiveCustomerGstin)) {
        throw new Error("Customer GST format is invalid. Enter valid GST or leave GST blank.");
      }
    }

    const existingShippingAddresses = normalizeCustomerShippingAddresses(customerRow.shipping_addresses);
    if (JSON.stringify(existingShippingAddresses) !== JSON.stringify(mergedShippingAddresses)) {
      await client.query(
        `UPDATE customers
         SET shipping_addresses = COALESCE($1::jsonb, '[]'::jsonb),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
           AND seller_id = $3`,
        [JSON.stringify(mergedShippingAddresses), customerId, sellerId]
      );
    }

    const normalizedItems = normalizeQuotationItems(items);
    const computedItems = applyComputedQuotationFields(normalizedItems, customColumns, { unitConversionMap });
    validateCustomQuotationFields(computedItems, customColumns);
    const displayReadyItems = await applyQuotationItemDisplayConfig(client, sellerId, computedItems);
    const { normalizedItems: computedLineItems, subtotal, gstAmount, transport, design, totalAmount, discountAmount: discount, advanceAmount: advance, balanceAmount } =
      computeQuotationTotals({
        items: displayReadyItems,
        gstPercent,
        gstMode: nextGstMode,
        transportCharges: toAmount(transportCharges) + toAmount(transportationCost),
        designCharges,
        discountAmount,
        advanceAmount,
        calculationColumns: customColumns
      });
    const approvalEvaluation = await evaluateQuotationApproval(client, {
      sellerId,
      requesterUserId: createdBy,
      totalAmount,
      items: displayReadyItems
    });

    const inventoryWarnings = await reserveInventoryForItems(client, sellerId, displayReadyItems, { strict: false });

    const [
      templateResult,
      sellerResult,
      pdfConfig
    ] = await Promise.all([
      client.query(
        `SELECT *
         FROM quotation_templates
         WHERE seller_id = $1
           AND template_name = 'default'
         LIMIT 1`,
        [sellerId]
      ),
      client.query(
        `SELECT id, name, business_name, email, mobile, gst_number, bank_name, bank_branch, bank_account_no, bank_ifsc
         FROM sellers
         WHERE id = $1
         LIMIT 1`,
        [sellerId]
      ),
      getPublishedQuotationPdfConfiguration(client, sellerId)
    ]);
    const randomPlatformFooterBanner = await getRandomActivePlatformFooterBanner(client);
    const resolvedTemplate = applyTemplateAccessPolicy(
      templateResult.rows[0] || getDefaultDocumentTemplate(),
      currentSubscription,
      { freeFooterBanner: randomPlatformFooterBanner }
    );
    const documentSnapshot = buildFrozenQuotationDocumentSnapshot({
      template: {
        ...resolvedTemplate,
        notes_rich_text: getRichTextHtml(notesRichText, resolvedTemplate.notes_text || ""),
        notes_text: richTextToPlainText(getRichTextHtml(notesRichText, resolvedTemplate.notes_text || "")),
        terms_rich_text: getRichTextHtml(termsRichText, resolvedTemplate.terms_text || ""),
        terms_text: richTextToPlainText(getRichTextHtml(termsRichText, resolvedTemplate.terms_text || ""))
      },
      seller: sellerResult.rows[0] || null,
      customer: {
        ...(customerCheck.rows[0] || {}),
        shipping_addresses: mergedShippingAddresses
      },
      pdfConfig
    });
    const calculationSnapshot = buildFrozenQuotationCalculationSnapshot({
      customColumns,
      unitConversionMap,
      totals: {
        subtotal,
        gstAmount,
        transport,
        design,
        totalAmount,
        discountAmount: discount,
        advanceAmount: advance,
        balanceAmount
      },
      inputs: {
        gstPercent,
        gstMode: nextGstMode,
        transportCharges: toAmount(transportCharges) + toAmount(transportationCost),
        designCharges,
        discountAmount,
        advanceAmount
      }
    });

    const quotationNumber = await getNextQuotationNumber(client, sellerId);
    const { sellerQuotationSerial, sellerQuotationNumber } = await getNextSellerQuotationMeta(client, sellerId);
    const normalizedCustomQuotationNumber = normalizeCustomQuotationNumber(customQuotationNumber);
    const normalizedReferenceRequestId = String(referenceRequestId || "").trim().replace(/\s+/g, " ").slice(0, 120) || null;

    const quotationResult = await client.query(
      `INSERT INTO quotations
       (quotation_number, seller_quotation_serial, seller_quotation_number, custom_quotation_number, seller_id, customer_id, created_by, subtotal, gst_amount, gst_mode, transport_charges, design_charges, total_amount, discount_amount, advance_amount, balance_amount, reference_request_id, payment_status, order_status, quotation_sent, delivery_type, delivery_date, delivery_address, delivery_pincode, transportation_cost, design_cost_confirmed, source_channel, record_status, customer_monthly_billing, watermark_text, created_under_plan_id, document_snapshot, calculation_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, FALSE, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31::jsonb, $32::jsonb)
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
        nextGstMode,
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
        currentSubscription.plan_id,
        JSON.stringify(documentSnapshot),
        JSON.stringify(calculationSnapshot)
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

    for (const item of computedLineItems) {
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
      items: computedLineItems,
      actorUserId: createdBy
    });

    await client.query("COMMIT");

    return {
      quotation: applyFrozenPresentationToQuotation(quotation),
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
  getPlatformUnitConversionMap,
  validateQuotationItemRateLimits,
  collectQuotationPriceExceptionReasons,
  evaluateQuotationApproval,
  supersedeActiveApprovalRequest,
  createQuotationApprovalRequest,
  validateCustomQuotationFields,
  applyComputedQuotationFields,
  applyQuotationItemDisplayConfig
};
