const express = require("express");
const PDFDocument = require("pdfkit");
let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch (_error) {
  puppeteer = require("puppeteer-core");
}
const { PassThrough } = require("stream");
const fs = require("fs");
const { spawnSync } = require("child_process");
const pool = require("../db/db");
const { isEmailConfigured, sendMail } = require("../utils/email");
const {
  createQuotationWithItems,
  getCustomerOutstanding,
  normalizeOrderStatus,
  normalizeDeliveryType,
  logOrderEvent,
  computeQuotationTotals,
  reserveInventoryForItems,
  restoreInventoryForItems,
  createQuotationVersionSnapshot,
  toAmount,
  getSellerCustomQuotationColumns,
  getPlatformUnitConversionMap,
  validateQuotationItemRateLimits,
  validateCustomQuotationFields,
  applyComputedQuotationFields,
  evaluateQuotationApproval,
  supersedeActiveApprovalRequest,
  createQuotationApprovalRequest,
  applyQuotationItemDisplayConfig
} = require("../services/quotationService");
const {
  applyFrozenPresentationToQuotation,
  buildFrozenQuotationCalculationSnapshot,
  buildFrozenQuotationDocumentSnapshot,
  getDefaultDocumentTemplate,
  getQuotationDocumentSnapshot
} = require("../services/quotationSnapshotService");
const {
  getQuotationCustomFieldEntries,
  getQuotationItemDimensionText,
  getQuotationItemQuantityValue,
  getQuotationItemRateValue,
  getQuotationItemTitle,
  getQuotationItemTotalValue,
  getQuotationSummaryRows
} = require("../services/quotationViewService");
const {
  getRichTextHtml,
  measureRichTextPdfHeight,
  parseRichTextBlocks,
  plainTextToRichText,
  renderRichTextPdf,
  richTextToPlainText,
  sanitizeLimitedRichText
} = require("../services/richTextService");
const { getTenantId } = require("../middleware/auth");
const { getCurrentSubscription } = require("../services/subscriptionService");
const { PERMISSIONS, hasPermission, requirePermission } = require("../rbac/permissions");

const router = express.Router();

function normalizeCustomQuotationNumber(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
  return normalized || null;
}

function fillTemplate(template, data) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : "";
  });
}

function renderTemplateText(template, data) {
  return fillTemplate(template, data);
}

function toDisplayString(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function getQuotationNumberValue(quotation) {
  return quotation.custom_quotation_number || quotation.seller_quotation_number || quotation.quotation_number || "";
}

function quotationLabel(quotation) {
  const visibleNumber = getQuotationNumberValue(quotation);
  return visibleNumber ? `${visibleNumber} (Ver.${quotation.version_no || 1})` : `Ver.${quotation.version_no || 1}`;
}

function quotationFileStem(quotation) {
  const visibleNumber = getQuotationNumberValue(quotation) || "quotation";
  const version = quotation.version_no || 1;
  return `${String(visibleNumber).replace(/[^a-zA-Z0-9-_]+/g, "_")}-V${version}`;
}

function normalizeDocumentTitle(value) {
  const fallback = "QUOTATION";
  const source = String(value || "").trim() || fallback;
  const replaced = source.replace(/invoice/ig, "Quotation");
  return replaced || fallback;
}

function normalizeReferenceRequestId(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
  return normalized || null;
}

const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function formatDateIST(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return IST_DATE_FORMATTER.format(parsed).replace(/\//g, "-");
  }
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return raw;
}

function amountToWordsIndian(value) {
  const ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  const tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
  const integer = Math.max(0, Math.round(Number(value || 0)));
  if (!integer) return "ZERO RUPEES ONLY";

  const twoDigits = (n) => {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`.trim();
  };
  const threeDigits = (n) => {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    const head = hundred ? `${ones[hundred]} HUNDRED` : "";
    const tail = rest ? twoDigits(rest) : "";
    return `${head}${head && tail ? " " : ""}${tail}`.trim();
  };

  const parts = [];
  const crore = Math.floor(integer / 10000000);
  const lakh = Math.floor((integer % 10000000) / 100000);
  const thousand = Math.floor((integer % 100000) / 1000);
  const hundred = integer % 1000;

  if (crore) parts.push(`${twoDigits(crore)} CRORE`);
  if (lakh) parts.push(`${twoDigits(lakh)} LAKH`);
  if (thousand) parts.push(`${twoDigits(thousand)} THOUSAND`);
  if (hundred) parts.push(threeDigits(hundred));

  return `${parts.join(" ").trim()} RUPEES ONLY`;
}

function getFriendlyQuotationPersistenceError(error) {
  if (String(error?.code || "") === "22003") {
    return {
      message: "Numeric value is too large for one of these fields: Quantity, Rate, Width, Height, Amount, Discount, or Advance. Please reduce the entered value.",
      field: "amounts"
    };
  }
  return null;
}

function normalizeQuotationColumnKey(value) {
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

function getQuotationItemPrimaryName(item = {}) {
  return toDisplayString(
    item.material_name ||
    item.materialName ||
    item.material_type ||
    item.materialType ||
    item.design_name ||
    item.designName ||
    item.sku ||
    "Item"
  );
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

function getEffectiveCustomerGstin(quotation = {}) {
  const customerGstin = String(quotation.customer_gst_number || quotation.gst_number || quotation.customer_gstin || "").trim().toUpperCase();
  const shippingAddresses = Array.isArray(quotation.customer_shipping_addresses) ? quotation.customer_shipping_addresses : [];
  const deliveryAddress = normalizeComparableAddress(quotation.delivery_address);
  const deliveryPincode = String(quotation.delivery_pincode || "").trim();

  const matchingShippingAddress = shippingAddresses.find((entry) => {
    const entryAddress = normalizeComparableAddress(entry?.address);
    const entryPincode = String(entry?.pincode || "").trim();
    return (
      String(entry?.gstNumber || "").trim() &&
      ((deliveryAddress && entryAddress && deliveryAddress === entryAddress) ||
        (deliveryPincode && entryPincode && deliveryPincode === entryPincode))
    );
  });

  return String(matchingShippingAddress?.gstNumber || customerGstin || "-").trim().toUpperCase() || "-";
}

function isGstQuotationActive(quotation = {}) {
  if (quotation.gst_mode !== undefined && quotation.gst_mode !== null) {
    return Boolean(quotation.gst_mode);
  }
  return Number(quotation.gst_amount || quotation.tax_amount || 0) > 0;
}

function getCustomerDisplayName(quotation = {}) {
  return quotation.firm_name || quotation.customer_name || "Customer";
}

function getCustomerDisplayAddress(quotation = {}) {
  return String(
    quotation.customer_address
    || quotation.address
    || quotation.delivery_address
    || "-"
  ).trim() || "-";
}

function getCompanyPhoneDisplay(template = {}, seller = {}, quotation = {}) {
  return String(template?.company_phone || seller?.mobile || quotation?.seller_mobile || "-").trim() || "-";
}

function isTemplateSectionVisible(template = {}, key, fallback = true) {
  const raw = template?.[key];
  if (raw === undefined || raw === null) return fallback;
  return Boolean(raw);
}

function getTemplateNotesText(template = {}) {
  return String(template?.notes_text || "-").trim() || "-";
}

function getTemplateTermsText(template = {}) {
  return String(template?.terms_text || "-").trim() || "-";
}

function getTemplateNotesRichText(template = {}) {
  return getRichTextHtml(template?.notes_rich_text, template?.notes_text || "");
}

function getTemplateTermsRichText(template = {}) {
  return getRichTextHtml(template?.terms_rich_text, template?.terms_text || "");
}

function isDataImageString(value) {
  return /^data:image\//i.test(String(value || "").trim());
}

function getPrintableFooterText(template = {}) {
  const value = String(template?.footer_text || "").trim();
  if (!value) return "";
  if (isDataImageString(value)) return "";
  return value;
}

function resolveQuotationDocumentContext(quotation, fallback = {}) {
  const snapshot = getQuotationDocumentSnapshot(quotation);
  if (!snapshot) {
    return {
      template: fallback.template || getDefaultDocumentTemplate(),
      seller: fallback.seller || null,
      pdfConfig: fallback.pdfConfig || { modules: {}, columns: [], allPdfColumns: [] }
    };
  }

  return {
    template: {
      ...getDefaultDocumentTemplate(),
      ...(snapshot.template || {})
    },
    seller: snapshot.seller || fallback.seller || null,
    pdfConfig: {
      modules: snapshot.pdf?.modules || fallback.pdfConfig?.modules || {},
      columns: snapshot.pdf?.columns || fallback.pdfConfig?.columns || [],
      allPdfColumns: snapshot.pdf?.allPdfColumns || fallback.pdfConfig?.allPdfColumns || snapshot.pdf?.columns || fallback.pdfConfig?.columns || []
    }
  };
}

function normalizeGstin(value) {
  return String(value || "").trim().toUpperCase();
}

function isValidGstinFormat(value) {
  return /^[0-9A-Z]{15}$/.test(normalizeGstin(value));
}

function enrichQuotationTaxData(quotation = {}, sellerRow = null) {
  const frozenAwareQuotation = applyFrozenPresentationToQuotation(quotation);
  return {
    ...frozenAwareQuotation,
    gstin: String(frozenAwareQuotation.gstin || sellerRow?.gst_number || frozenAwareQuotation.seller_gst_number || "-").trim().toUpperCase() || "-",
    customer_gstin: getEffectiveCustomerGstin(frozenAwareQuotation)
  };
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
      key: normalizeQuotationColumnKey(column.column_key),
      label: column.label || column.column_key || "Column",
      type: column.column_type || "text",
      helpTextInPdf: Boolean(column.help_text_in_pdf)
    }));

  if (visibleColumns.length) {
    const tableColumns = visibleColumns.filter((column) => !column.helpTextInPdf || normalizeQuotationColumnKey(column.key) === "material_name");
    if (!tableColumns.some((column) => normalizeQuotationColumnKey(column.key) === "material_name")) {
      tableColumns.unshift({ key: "material_name", label: "Item", type: "text" });
    }
    if (!tableColumns.length) {
      tableColumns.push({ key: "material_name", label: "Item", type: "text" });
    }
    return { modules, columns: tableColumns, allPdfColumns: visibleColumns };
  }

  return {
    modules,
    allPdfColumns: [
      { key: "material_name", label: "Item", type: "text" },
      { key: "quantity", label: "Qty", type: "number" },
      { key: "rate", label: "Rate", type: "number" },
      { key: "amount", label: "Amount", type: "formula" }
    ],
    columns: [
      { key: "material_name", label: "Item", type: "text" },
      { key: "quantity", label: "Qty", type: "number" },
      { key: "rate", label: "Rate", type: "number" },
      { key: "amount", label: "Amount", type: "formula" }
    ]
  };
}

function getQuotationPdfColumnValue(item, columnKey, options = {}) {
  const pdfNumberFormat = options.pdfNumberFormat && typeof options.pdfNumberFormat === "object"
    ? options.pdfNumberFormat
    : {};
  const resolvePdfMode = (fieldKey) => {
    const normalized = normalizeQuotationColumnKey(fieldKey);
    const mode = String(pdfNumberFormat[normalized] || pdfNumberFormat[fieldKey] || "normal").trim().toLowerCase();
    return mode === "roundoff" ? "roundoff" : "normal";
  };
  const formatNumberValue = (value, fieldKey) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return "0";
    return resolvePdfMode(fieldKey) === "roundoff"
      ? Math.round(numeric).toLocaleString("en-IN")
      : numeric.toLocaleString("en-IN");
  };
  const formatCurrencyValue = (value, fieldKey) => `Rs ${formatNumberValue(value, fieldKey)}`;

  const customFields = item.custom_fields || item.customFields || {};
  const normalizedKey = normalizeQuotationColumnKey(columnKey);
  const directRaw = customFields[columnKey] ?? customFields[normalizedKey];
  const fallbackEntry = Object.entries(customFields).find(([key]) => normalizeQuotationColumnKey(key) === normalizedKey);
  const customRaw = directRaw ?? (fallbackEntry ? fallbackEntry[1] : undefined);
  const hasCustomValue = customRaw !== undefined && customRaw !== null && String(customRaw).trim() !== "";

  switch (normalizeQuotationColumnKey(columnKey)) {
    case "material_name": {
      const configuredTitle = String(item.item_display_text || item.itemDisplayText || customFields.item_display_text || "").trim();
      if (configuredTitle) return configuredTitle;
      return getQuotationItemTitle(item) || getQuotationItemPrimaryName(item) || "-";
    }
    case "uom":
    case "unit":
    case "unit_type":
      return item.dimension_unit || item.dimensionUnit || item.unit_type || item.unitType || "-";
    case "thickness":
      return item.thickness || "-";
    case "dimension":
      return getQuotationItemDimensionText(item);
    case "width":
      return item.dimension_width ?? item.dimensionWidth ?? item.width ?? "-";
    case "height":
      return item.dimension_height ?? item.dimensionHeight ?? item.height ?? "-";
    case "quantity":
      if (hasCustomValue) return formatNumberValue(customRaw, normalizedKey);
      return formatNumberValue(getQuotationItemQuantityValue(item), normalizedKey);
    case "rate":
    case "unit_price":
      if (hasCustomValue) return formatCurrencyValue(customRaw, normalizedKey);
      return formatCurrencyValue(getQuotationItemRateValue(item), normalizedKey);
    case "amount":
    case "total":
    case "total_rate":
    case "total_price":
      if (hasCustomValue) return formatCurrencyValue(customRaw, normalizedKey);
      return formatCurrencyValue(getQuotationItemTotalValue(item), normalizedKey);
    case "color_name":
      return item.color_name || item.colorName || item.imported_color_note || item.importedColorNote || "-";
    case "ps": {
      const raw = customRaw;
      if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
        return typeof raw === "boolean" ? (raw ? "Yes" : "No") : String(raw);
      }
      return item.ps_included ?? item.psIncluded ?? item.ps ? "Yes" : "-";
    }
    case "note":
    case "item_note":
      return item.item_note || item.itemNote || "-";
    default: {
      if (!hasCustomValue) return "-";
      if (typeof customRaw === "number" || (String(customRaw).trim() !== "" && Number.isFinite(Number(customRaw)))) {
        return formatNumberValue(customRaw, normalizedKey);
      }
      return typeof customRaw === "boolean" ? (customRaw ? "Yes" : "No") : String(customRaw);
    }
  }
}

function getPdfColumnAlignment(columnKey) {
  switch (normalizeQuotationColumnKey(columnKey)) {
    case "quantity":
      return "center";
    case "rate":
    case "unit_price":
    case "amount":
    case "total":
    case "total_rate":
    case "total_price":
    case "width":
    case "height":
      return "right";
    default:
      return "left";
  }
}

function getDefaultTemplateTableColumns(configuredColumns, tableWidth) {
  const normalizedColumns = (Array.isArray(configuredColumns) ? configuredColumns : [])
    .map((column) => ({
      ...column,
      key: normalizeQuotationColumnKey(column.key),
      align: getPdfColumnAlignment(column.key)
    }))
    .filter((column) => column.key);

  if (!normalizedColumns.some((column) => column.key === "material_name")) {
    normalizedColumns.unshift({ key: "material_name", label: "Item", type: "text", align: "left" });
  }

  const srWidth = Math.max(34, Math.floor(tableWidth * 0.05));
  const remainingAfterSr = Math.max(120, tableWidth - srWidth);
  const materialColumnIndex = normalizedColumns.findIndex((column) => column.key === "material_name");
  const materialColumnCount = normalizedColumns.length;

  let materialWidth = Math.floor(tableWidth * 0.30);
  if (materialColumnCount === 1) {
    materialWidth = remainingAfterSr;
  } else {
    materialWidth = Math.max(120, Math.min(materialWidth, remainingAfterSr - 64 * (materialColumnCount - 1)));
  }

  const restCount = Math.max(0, materialColumnCount - 1);
  const restWidthPool = Math.max(0, remainingAfterSr - materialWidth);
  const eachRestWidth = restCount ? Math.floor(restWidthPool / restCount) : 0;

  const tableColumns = [{ key: "sr_no", label: "Sr.", width: srWidth, align: "center" }];
  normalizedColumns.forEach((column, index) => {
    const isMaterial = index === materialColumnIndex;
    tableColumns.push({
      ...column,
      width: isMaterial ? materialWidth : Math.max(56, eachRestWidth)
    });
  });

  const allocated = tableColumns.reduce((sum, column) => sum + column.width, 0);
  if (allocated !== tableWidth) {
    tableColumns[tableColumns.length - 1].width += tableWidth - allocated;
  }
  return tableColumns;
}

function toSingleLinePdfValue(value, limit = 36) {
  const normalized = String(value ?? "-")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "-";
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}...` : normalized;
}

function createPdfDebugLogger(enabled, context = {}) {
  const startedAt = Date.now();
  const prefix = `[PDF][q:${context.quotationId || "-"}][s:${context.sellerId || "-"}]`;
  return {
    enabled,
    log(stage, detail = "") {
      if (!enabled) return;
      const elapsed = Date.now() - startedAt;
      const suffix = detail ? ` ${detail}` : "";
      console.log(`${prefix}[${elapsed}ms] ${stage}${suffix}`);
    }
  };
}

function createPdfPerfLogger(context = {}) {
  const enabled = String(process.env.PDF_PERF_LOG || "1") === "1";
  const startedAt = Date.now();
  let finalized = false;
  return {
    mark(res, renderer = "unknown") {
      if (!enabled || finalized) return;
      finalized = true;
      const elapsedMs = Date.now() - startedAt;
      console.log(
        `[PDF][perf] quotation=${context.quotationId || "-"} seller=${context.sellerId || "-"} renderer=${renderer} status=${res?.statusCode || "-"} duration_ms=${elapsedMs}`
      );
    }
  };
}

function collectStreamBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function getHelpingTextEntries(item, pdfColumns = [], options = {}) {
  const internalPdfHelpKeys = new Set([
    "area_sqm",
    "area_sqft",
    "area_sqin",
    "line_amount",
    "line_amount_std",
    "line_amount_sqft",
    "line_amount_sqin",
    "line_amount_final",
    "base_price",
    "limit_rate_edit",
    "category"
  ]);
  return pdfColumns
    .filter((column) => {
      const normalizedKey = normalizeQuotationColumnKey(column.key);
      if (!Boolean(column.helpTextInPdf) || normalizedKey === "material_name") return false;
      if (internalPdfHelpKeys.has(normalizedKey)) return false;
      return true;
    })
    .map((column) => ({
      key: column.key,
      label: column.label || column.key,
      value: getQuotationPdfColumnValue(item, column.key, options)
    }))
    .filter((entry) => {
      const normalizedValue = String(entry.value ?? "").trim();
      return normalizedValue && normalizedValue !== "-";
    });
}

async function getQuotationItems(clientOrPool, quotationId, sellerId) {
  const values = [quotationId];
  let where = "qi.quotation_id = $1";

  if (sellerId) {
    values.push(sellerId);
    where += " AND qi.seller_id = $2";
  }

  const result = await clientOrPool.query(
    `SELECT qi.*, p.material_name, pv.variant_name
     FROM quotation_items qi
     LEFT JOIN products p ON p.id = qi.product_id
     LEFT JOIN product_variants pv ON pv.id = qi.variant_id
     WHERE ${where}
     ORDER BY qi.id`,
    values
  );

  return result.rows;
}

async function getQuotationVersions(clientOrPool, quotationId, sellerId) {
  const values = [quotationId];
  let where = "qv.quotation_id = $1";

  if (sellerId) {
    values.push(sellerId);
    where += " AND qv.seller_id = $2";
  }

  const result = await clientOrPool.query(
    `SELECT qv.*, u.name AS actor_name
     FROM quotation_versions qv
     LEFT JOIN users u ON u.id = qv.actor_user_id
     WHERE ${where}
     ORDER BY qv.version_no DESC, qv.created_at DESC`,
    values
  );

  return result.rows;
}

async function getApprovalRequestReasons(clientOrPool, approvalRequestId) {
  const result = await clientOrPool.query(
    `SELECT id, reason_type, item_index, product_id, requested_value, allowed_value, base_value, meta_json, created_at
     FROM quotation_approval_reasons
     WHERE approval_request_id = $1
     ORDER BY id ASC`,
    [approvalRequestId]
  );
  return result.rows;
}

function canAccessApprovals(user = {}) {
  return hasPermission(user, PERMISSIONS.APPROVAL_VIEW_TEAM)
    || hasPermission(user, PERMISSIONS.APPROVAL_VIEW_OWN)
    || hasPermission(user, PERMISSIONS.APPROVAL_OVERRIDE);
}

function requireApprovalAccess(req, res, next) {
  if (!canAccessApprovals(req.user)) {
    return res.status(403).json({ message: "Permission denied: approval access" });
  }
  return next();
}

async function getCustomerOutstandingInTransaction(client, customerId, sellerId) {
  const result = await client.query(
    `SELECT
      COALESCE((SELECT SUM(COALESCE(q.balance_amount, q.total_amount)) FROM quotations q WHERE q.customer_id = $1 AND q.seller_id = $2), 0) AS invoiced,
      COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.customer_id = $1 AND p.seller_id = $2), 0) AS paid`,
    [customerId, sellerId]
  );

  const row = result.rows[0] || { invoiced: 0, paid: 0 };
  return toAmount(row.invoiced) - toAmount(row.paid);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function imageBufferFromDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  if (dataUrl.length > 2_000_000) return null;
  const base64Match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (base64Match) {
    try {
      const buffer = Buffer.from(base64Match[2], "base64");
      if (buffer.length > 1_500_000) return null;
      return buffer;
    } catch (_error) {
      return null;
    }
  }

  const utf8Match = dataUrl.match(/^data:(image\/svg\+xml)(?:;charset=[^;,]+)?,(.+)$/i);
  if (!utf8Match) return null;
  try {
    const buffer = Buffer.from(decodeURIComponent(utf8Match[2]), "utf8");
    if (buffer.length > 1_500_000) return null;
    return buffer;
  } catch (_error) {
    return null;
  }
}

function normalizeTemplatePreset(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "default" || normalized === "default_template") return "default";
  if (normalized === "invoice_classic") return "invoice_classic";
  if (normalized === "executive_boardroom") return "executive_boardroom";
  if (normalized === "industrial_invoice") return "industrial_invoice";
  if (normalized === "html_puppeteer") return "html_puppeteer";
  return "commercial_offer";
}

const QUOTATION_THEME_OPTIONS = {
  default: {
    key: "default",
    accessTier: "FREE",
    accent: "#737373",
    header: "#4B5563",
    surface: "#F3F4F6",
    border: "#D1D5DB",
    text: "#111827",
    muted: "#6B7280"
  },
  royal_blue: {
    key: "royal_blue",
    accessTier: "PAID",
    accent: "#1D4ED8",
    header: "#1D4ED8",
    surface: "#DBEAFE",
    border: "#93C5FD",
    text: "#1E3A8A",
    muted: "#475569"
  },
  slate_professional: {
    key: "slate_professional",
    accessTier: "PAID",
    accent: "#374151",
    header: "#1F2937",
    surface: "#F3F4F6",
    border: "#CBD5E1",
    text: "#111827",
    muted: "#6B7280"
  },
  warm_ivory: {
    key: "warm_ivory",
    accessTier: "PAID",
    accent: "#0F3D56",
    header: "#0F3D56",
    surface: "#F8F3EC",
    border: "#E0D4C5",
    text: "#4B3B2F",
    muted: "#7A6A58"
  },
  forest_ledger: {
    key: "forest_ledger",
    accessTier: "PAID",
    accent: "#166534",
    header: "#166534",
    surface: "#DCFCE7",
    border: "#86EFAC",
    text: "#14532D",
    muted: "#4D6B57"
  },
  steel_grid: {
    key: "steel_grid",
    accessTier: "PAID",
    accent: "#334155",
    header: "#334155",
    surface: "#E2E8F0",
    border: "#94A3B8",
    text: "#1F2937",
    muted: "#475569"
  },
  frosted_aura: {
    key: "frosted_aura",
    accessTier: "PAID",
    accent: "#5C7E8F",
    header: "#5C7E8F",
    surface: "#D4DDE2",
    border: "#A2A2A2",
    text: "#374151",
    muted: "#6B7280"
  },
  sorbet: {
    key: "sorbet",
    accessTier: "PREMIUM",
    accent: "#BA9A91",
    header: "#B7C396",
    surface: "#EDECEC",
    border: "#CCCCCC",
    text: "#4B5563",
    muted: "#7A6E68"
  },
  calcite: {
    key: "calcite",
    accessTier: "PREMIUM",
    accent: "#FD7B41",
    header: "#3C4044",
    surface: "#EDBF9B",
    border: "#DDDCDB",
    text: "#3C4044",
    muted: "#7C5E4E"
  },
  lapis_velvet_evening: {
    key: "lapis_velvet_evening",
    accessTier: "PREMIUM",
    accent: "#893172",
    header: "#213885",
    surface: "#ECDFD2",
    border: "#CCCACC",
    text: "#213885",
    muted: "#5B6475"
  },
  opaline: {
    key: "opaline",
    accessTier: "PREMIUM",
    accent: "#FF634A",
    header: "#FF634A",
    surface: "#E7E7E7",
    border: "#D2D2D4",
    text: "#374151",
    muted: "#6B7280"
  },
  tropical_heat: {
    key: "tropical_heat",
    accessTier: "NICHE",
    accent: "#EB4203",
    header: "#00CEC8",
    surface: "#FCEFC3",
    border: "#FF9C5F",
    text: "#8A3600",
    muted: "#0C6663"
  },
  honey_opal_sunset: {
    key: "honey_opal_sunset",
    accessTier: "NICHE",
    accent: "#ECB914",
    header: "#4F3D35",
    surface: "#F6D579",
    border: "#CBB8A0",
    text: "#4F3D35",
    muted: "#7C5D26"
  },
  seashell_garnet_afternoon: {
    key: "seashell_garnet_afternoon",
    accessTier: "NICHE",
    accent: "#09A1A1",
    header: "#30525C",
    surface: "#ACC0D3",
    border: "#D396A6",
    text: "#30525C",
    muted: "#7F4E60"
  }
};

function createFixedFreeFooterBannerDataUrl() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="120" viewBox="0 0 1600 120">
      <defs>
        <linearGradient id="qbg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="70%" stop-color="#f8fbff"/>
          <stop offset="100%" stop-color="#d9e8ff"/>
        </linearGradient>
        <linearGradient id="qwave" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
          <stop offset="100%" stop-color="#7fb4ff" stop-opacity="0.9"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="120" rx="8" fill="url(#qbg)"/>
      <rect x="0.5" y="0.5" width="1599" height="119" rx="7.5" fill="none" stroke="#d5dbe6"/>
      <path d="M1170 120 C1290 48 1430 156 1600 26 L1600 120 Z" fill="url(#qwave)"/>
      <path d="M1040 118 C1210 86 1355 96 1600 68" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.85"/>
      <path d="M1100 106 C1270 80 1410 82 1600 50" fill="none" stroke="#fff7d6" stroke-width="3" opacity="0.7"/>
      <text x="120" y="72" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#0f2a4d">Quotsy</text>
      <text x="280" y="72" font-family="Arial, sans-serif" font-size="18" fill="#445066">Powered by Quotsy - Simplify your quoting process</text>
      <text x="1455" y="46" font-family="Arial, sans-serif" font-size="20" fill="#d4a938">✦</text>
      <text x="1490" y="60" font-family="Arial, sans-serif" font-size="14" fill="#e5c56a">✦</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const FIXED_FREE_FOOTER_BANNER = createFixedFreeFooterBannerDataUrl();

function normalizeTemplateThemeKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return QUOTATION_THEME_OPTIONS[normalized] ? normalized : "default";
}

function getQuotationThemeConfig(themeKey, accentOverride = null) {
  const config = QUOTATION_THEME_OPTIONS[normalizeTemplateThemeKey(themeKey)] || QUOTATION_THEME_OPTIONS.default;
  return {
    ...config,
    accent: accentOverride || config.accent
  };
}

function getSubscriptionTemplateAccessTier(subscription) {
  if (!subscription) return "FREE";
  if (Boolean(subscription.is_demo_plan)) return "FREE";
  const tier = String(subscription.template_access_tier || "").trim().toUpperCase();
  return ["FREE", "PAID", "PREMIUM", "NICHE"].includes(tier) ? tier : "FREE";
}

function isThemeAccessibleForTier(themeTier, planTier) {
  const order = { FREE: 0, PAID: 1, PREMIUM: 2, NICHE: 3 };
  const normalizedThemeTier = order[themeTier] !== undefined ? themeTier : "FREE";
  const normalizedPlanTier = order[planTier] !== undefined ? planTier : "FREE";
  return order[normalizedPlanTier] >= order[normalizedThemeTier];
}

function applyTemplateAccessPolicy(template, subscription) {
  const currentPlanTier = getSubscriptionTemplateAccessTier(subscription);
  const requestedThemeKey = normalizeTemplateThemeKey(template?.template_theme_key);
  const themeConfig = getQuotationThemeConfig(requestedThemeKey, template?.accent_color || null);
  const accessible = isThemeAccessibleForTier(themeConfig.accessTier, currentPlanTier);

  if (!accessible || currentPlanTier === "FREE") {
    const freeTheme = getQuotationThemeConfig("default");
    return {
      ...template,
      template_preset: "default",
      template_theme_key: "default",
      accent_color: freeTheme.accent,
      footer_image_data: FIXED_FREE_FOOTER_BANNER,
      show_footer_image: true
    };
  }

  return {
    ...template,
    template_preset: normalizeTemplatePreset(template?.template_preset || "default"),
    template_theme_key: requestedThemeKey,
    accent_color: themeConfig.accent
  };
}

function getPuppeteerExecutablePath() {
  const envCandidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_EXECUTABLE_PATH
  ].filter(Boolean);
  for (const candidate of envCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  try {
    if (typeof puppeteer?.executablePath === "function") {
      const bundledPath = String(puppeteer.executablePath() || "").trim();
      if (bundledPath && fs.existsSync(bundledPath)) return bundledPath;
    }
  } catch (_error) {
    // Ignore bundled browser path lookup failures.
  }

  const candidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const commandCandidates = process.platform === "win32"
    ? ["chrome", "msedge"]
    : ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"];
  const locatorCommand = process.platform === "win32" ? "where" : "which";
  for (const candidate of commandCandidates) {
    try {
      const lookup = spawnSync(locatorCommand, [candidate], { encoding: "utf8" });
      if (lookup.status === 0) {
        const resolved = String(lookup.stdout || "").split(/\r?\n/).map((entry) => entry.trim()).find(Boolean);
        if (resolved) return resolved;
      }
    } catch (_error) {
      // Ignore lookup failures and continue checking other candidates.
    }
  }
  return "";
}

function getPuppeteerLaunchArgs() {
  const args = ["--disable-gpu", "--hide-scrollbars"];
  if (process.platform !== "win32") {
    args.push("--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage");
  }
  return args;
}

function buildHtmlPuppeteerTemplate({ quotation, items, template, seller = null, pdfColumns = [], allPdfColumns = [], pdfModules = {} }) {
  const customerName = getCustomerDisplayName(quotation);
  const customerAddress = getCustomerDisplayAddress(quotation);
  const gstActive = isGstQuotationActive(quotation);
  const companyPhone = getCompanyPhoneDisplay(template, seller, quotation);
  const quotationNo = getQuotationNumberValue(quotation) || "-";
  const headerImage = template?.show_header_image ? template?.header_image_data : null;
  const showTextHeader = !headerImage;
  const logoImage = !headerImage && template?.show_logo_only ? template?.logo_image_data : null;
  const sellerName = String(seller?.business_name || seller?.name || "Quotation");
  const documentTitle = normalizeDocumentTitle(template?.header_text || "QUOTATION");
  const sellerAddressLines = String(template?.company_address || "").split(/\r?\n/).filter(Boolean);
  const showBankDetails = isTemplateSectionVisible(template, "show_bank_details", true);
  const showNotes = isTemplateSectionVisible(template, "show_notes", true);
  const showTerms = isTemplateSectionVisible(template, "show_terms", true);
  const notesText = getTemplateNotesText(template);
  const termsText = getTemplateTermsText(template);
  const notesRichText = getTemplateNotesRichText(template);
  const termsRichText = getTemplateTermsRichText(template);
  const bodyCopy = renderTemplateText(
    template?.body_template || "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your review.",
    quotation
  );

  const columns = Array.isArray(pdfColumns) && pdfColumns.length ? pdfColumns : [
    { key: "material_name", label: "Item" },
    { key: "quantity", label: "Qty" },
    { key: "rate", label: "Rate" },
    { key: "amount", label: "Amount" }
  ];
  const hasMaterialColumn = columns.some((column) => normalizeQuotationColumnKey(column.key) === "material_name");
  const nonMaterialColumnsCount = columns.filter((column) => normalizeQuotationColumnKey(column.key) !== "material_name").length;
  const equalNonMaterialWidth = nonMaterialColumnsCount > 0 ? `${(65 / nonMaterialColumnsCount).toFixed(2)}%` : "65%";
  const getColumnWidth = (columnKey) => {
    const key = normalizeQuotationColumnKey(columnKey);
    if (key === "material_name" && hasMaterialColumn) return "30%";
    return equalNonMaterialWidth;
  };
  const visiblePdfColumns = Array.isArray(allPdfColumns) && allPdfColumns.length ? allPdfColumns : columns;
  const combineHelpingTextInItemColumn = Boolean(pdfModules.combineHelpingTextInItemColumn);
  const pdfNumberFormat = pdfModules?.pdfNumberFormat && typeof pdfModules.pdfNumberFormat === "object"
    ? pdfModules.pdfNumberFormat
    : {};

  const getItemHelpingText = (item) => {
    if (combineHelpingTextInItemColumn) return "";
    const helping = getHelpingTextEntries(item, visiblePdfColumns, { combineHelpingTextInItemColumn: false, pdfNumberFormat })
      .map((entry) => `${entry.label}: ${entry.value}`)
      .join(", ");
    if (!helping) return "";
    return `<div class="item-help">${escapeHtml(helping)}</div>`;
  };

  const getCellValue = (item, columnKey, isItemColumn) => {
    const rawValue = getQuotationPdfColumnValue(item, columnKey, { combineHelpingTextInItemColumn, pdfNumberFormat });
    if (isItemColumn) {
      const itemValue = String(rawValue ?? "").trim();
      return escapeHtml(itemValue || "-");
    }
    return escapeHtml(toSingleLinePdfValue(rawValue || "-", 80));
  };

  const itemRows = items.map((item, index) => {
    const itemHelpingText = getItemHelpingText(item);
    return `
      <tr>
        <td class="sr">${index + 1}</td>
        ${columns.map((column) => {
          const key = normalizeQuotationColumnKey(column.key);
          const isItemColumn = key === "material_name";
          const value = getCellValue(item, column.key, isItemColumn);
          const numberClass = ["amount", "total", "total_rate", "total_price", "rate", "unit_price", "quantity"].includes(key) ? "num" : "";
          const className = isItemColumn ? "item" : numberClass;
          return `<td class="${className}"><div class="cell">${value}</div>${isItemColumn ? itemHelpingText : ""}</td>`;
        }).join("")}
      </tr>
    `;
  }).join("");

  const summaryRows = getQuotationSummaryRows({
    subtotalAmount: quotation.subtotal || quotation.total_amount,
    totalAmount: quotation.total_amount,
    gstAmount: quotation.gst_amount || quotation.tax_amount || 0,
    discountAmount: quotation.discount_amount,
    advanceAmount: quotation.advance_amount,
    balanceAmount: quotation.balance_amount || quotation.total_amount
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 14mm 10mm 12mm 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; }
    .doc { width: 100%; }
    .header-image { width: 100%; margin: 0 0 10px; line-height: 0; }
    .header-image img { width: 100%; height: auto; display: block; object-fit: cover; }
    .top { display: grid; grid-template-columns: 1fr auto; gap: 16px; border-bottom: 1px solid #d1d5db; padding-bottom: 8px; margin-bottom: 8px; }
    .seller-name { font-size: 24px; font-weight: 800; letter-spacing: .02em; color: #1e3a8a; text-transform: uppercase; }
    .seller-sub { font-size: 11px; color: #374151; margin-top: 4px; }
    .seller-meta { font-size: 11px; color: #374151; margin-top: 6px; line-height: 1.35; }
    .logo img { max-height: 72px; max-width: 140px; object-fit: contain; }
    .titlebar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; margin: 8px 0 10px; border: 1px solid #d1d5db; padding: 6px 8px; }
    .titlebar .left, .titlebar .right { font-size: 11px; color: #374151; }
    .titlebar .right { text-align: right; }
    .titlebar .center { font-size: 20px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border: 1px solid #d1d5db; margin-bottom: 10px; }
    .card { padding: 8px 10px; min-height: 110px; }
    .card + .card { border-left: 1px solid #d1d5db; }
    .card h4 { margin: 0 0 8px; font-size: 12px; color: #111827; text-transform: uppercase; }
    .line { font-size: 11px; line-height: 1.35; margin-bottom: 3px; }
    .body-copy { font-size: 11px; color: #374151; margin: 6px 0 10px; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #d1d5db; padding: 6px; vertical-align: top; }
    th { font-size: 10px; font-weight: 700; background: #f3f4f6; white-space: nowrap; }
    td { font-size: 11px; font-weight: 400; }
    td.sr { width: 5%; text-align: center; font-weight: 700; }
    td.item .cell { font-size: 11px; font-weight: 700; }
    td.num { text-align: right; }
    .cell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    td.item .cell {
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
      word-break: break-word;
    }
    .item-help { margin-top: 4px; font-size: 10px; font-style: italic; color: #4b5563; white-space: normal; }
    .summary { margin-top: 10px; margin-left: auto; width: 320px; border: 1px solid #d1d5db; }
    .summary-row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
    .summary-row:last-child { border-bottom: none; font-weight: 700; }
    .footer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-top: 10px; }
    .footer-card { border: 1px solid #d1d5db; padding: 8px 10px; min-height: 90px; }
    .footer-card h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; }
    .footer-text { font-size: 10px; line-height: 1.4; color: #374151; }
    .sign { margin-top: 10px; border-top: 1px solid #d1d5db; padding-top: 8px; text-align: right; font-size: 11px; color: #374151; }
  </style>
</head>
<body>
  <div class="doc">
    ${headerImage ? `<div class="header-image"><img src="${headerImage}" alt="Header" /></div>` : ""}
    ${showTextHeader ? `
      <div class="top">
        <div>
          <div class="seller-name">${escapeHtml(sellerName)}</div>
          ${getPrintableFooterText(template) ? `<div class="seller-sub">${escapeHtml(getPrintableFooterText(template))}</div>` : ""}
          <div class="seller-meta">
            ${sellerAddressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
            ${companyPhone && companyPhone !== "-" ? `<div>Tel: ${escapeHtml(companyPhone)}</div>` : ""}
            ${template?.company_email ? `<div>Email: ${escapeHtml(template.company_email)}</div>` : ""}
          </div>
        </div>
        <div class="logo">${logoImage ? `<img src="${logoImage}" alt="Logo" />` : ""}</div>
      </div>
    ` : ""}

    <div class="titlebar">
      <div class="left">${gstActive ? `GSTIN: ${escapeHtml(String(quotation.gstin || "-"))}` : ""}</div>
      <div class="center">QUOTATION</div>
      <div class="right">ORIGINAL FOR RECIPIENT</div>
    </div>

    <div class="meta">
      <div class="card">
        <h4>Customer Detail</h4>
        <div class="line"><strong>M/S:</strong> ${escapeHtml(customerName)}</div>
        <div class="line"><strong>Address:</strong> ${escapeHtml(toSingleLinePdfValue(customerAddress, 120))}</div>
        <div class="line"><strong>Phone:</strong> ${escapeHtml(String(quotation.mobile || "-"))}</div>
        ${gstActive ? `<div class="line"><strong>GSTIN:</strong> ${escapeHtml(String(quotation.customer_gstin || "-"))}</div>` : ""}
      </div>
      <div class="card">
        <h4>Quotation Info</h4>
        <div class="line"><strong>Quotation No:</strong> ${escapeHtml(quotationNo)}</div>
        <div class="line"><strong>Date:</strong> ${escapeHtml(formatDateIST(quotation.created_at) || "-")}</div>
        <div class="line"><strong>Version:</strong> ${escapeHtml(String(quotation.version_no || 1))}</div>
        <div class="line"><strong>Delivery Date:</strong> ${escapeHtml(formatDateIST(quotation.delivery_date) || "-")}</div>
        <div class="line"><strong>Delivery Type:</strong> ${escapeHtml(String(quotation.delivery_type || "-"))}</div>
      </div>
    </div>

    ${bodyCopy ? `<div class="body-copy">${nl2br(bodyCopy)}</div>` : ""}

    <table>
      <colgroup>
        <col style="width:5%" />
        ${columns.map((column) => `<col style="width:${getColumnWidth(column.key)}" />`).join("")}
      </colgroup>
      <thead>
        <tr>
          <th style="width:5%">Sr</th>
          ${columns.map((column) => `<th>${escapeHtml(toSingleLinePdfValue(column.label || "", 36))}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="summary">
      ${summaryRows.map((row) => `
        <div class="summary-row">
          <span>${escapeHtml(row.label)}</span>
          <strong>Rs ${Number(row.value || 0).toLocaleString("en-IN")}</strong>
        </div>
      `).join("")}
    </div>

    <div class="footer-grid">
      <div class="footer-card">
        <h4>Amount In Words</h4>
        <div class="footer-text">${escapeHtml(amountToWordsIndian(Number(quotation.total_amount || 0)))}</div>
        ${showBankDetails ? `
          <h4 style="margin-top:10px;">Bank Details</h4>
          <div class="footer-text">
            <div><strong>Bank Name:</strong> ${escapeHtml(seller?.bank_name || "-")}</div>
            <div><strong>Branch:</strong> ${escapeHtml(seller?.bank_branch || "-")}</div>
            <div><strong>Account No:</strong> ${escapeHtml(seller?.bank_account_no || "-")}</div>
            <div><strong>IFSC:</strong> ${escapeHtml(seller?.bank_ifsc || "-")}</div>
          </div>
        ` : ""}
      </div>
      ${showTerms ? `
      <div class="footer-card">
        <h4>Terms & Conditions</h4>
        <div class="footer-text">${termsRichText || nl2br(termsText)}</div>
      </div>
      ` : ""}
      ${showNotes ? `
      <div class="footer-card">
        <h4>Notes</h4>
        <div class="footer-text">${notesRichText || nl2br(notesText)}</div>
      </div>
      ` : ""}
    </div>

    <div class="sign">
      <div>For ${escapeHtml(sellerName)}</div>
      <div style="margin-top:8px;">Authorised Signatory</div>
    </div>
  </div>
</body>
</html>`;
}

async function buildHtmlPuppeteerPdf({ quotation, items, template, seller = null, pdfColumns = [], allPdfColumns = [], pdfModules = {}, res }) {
  const executablePath = getPuppeteerExecutablePath();
  const launchOptions = {
    headless: true,
    args: getPuppeteerLaunchArgs()
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }
  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    const html = buildHtmlPuppeteerTemplate({ quotation, items, template, seller, pdfColumns, allPdfColumns, pdfModules });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=${quotationFileStem(quotation)}.pdf`);
    res.send(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function buildQuotationHtml({ quotation, items, template, pdfColumns }) {
  const accent = template.accent_color || "#2563eb";
  const showBankDetails = isTemplateSectionVisible(template, "show_bank_details", true);
  const showNotes = isTemplateSectionVisible(template, "show_notes", true);
  const showTerms = isTemplateSectionVisible(template, "show_terms", true);
  const notesText = getTemplateNotesText(template);
  const termsText = getTemplateTermsText(template);
  const customerName = quotation.firm_name || quotation.customer_name || "Customer";
  const watermarkText = quotation.watermark_text || "";
  const totalsRows = getQuotationSummaryRows({
    subtotalAmount: quotation.subtotal || quotation.total_amount,
    totalAmount: quotation.total_amount,
    gstAmount: quotation.gst_amount || quotation.tax_amount || 0,
    discountAmount: quotation.discount_amount,
    advanceAmount: quotation.advance_amount,
    balanceAmount: quotation.balance_amount || quotation.total_amount
  }).map((row) => `<div class="totals-row ${row.accent ? "grand" : ""}"><span>${escapeHtml(row.label)}</span><strong>Rs ${Number(row.value || 0).toLocaleString("en-IN")}</strong></div>`);
    const itemRows = items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          ${pdfColumns.map((column) => {
            const normalizedKey = normalizeQuotationColumnKey(column.key);
            const rawValue = getQuotationPdfColumnValue(item, column.key);
            const hiddenMeta = normalizedKey === "material_name" ? getHiddenQuotationItemMeta(item, pdfColumns) : [];
            const metaHtml = hiddenMeta.length ? `<div class="custom-meta">${escapeHtml(hiddenMeta.map((entry) => `${entry.label}: ${entry.value}`).join(", "))}</div>` : "";
            const cellClass = normalizedKey === "material_name" ? "item-cell" : "value-cell";
            return `<td class="${cellClass}"><div class="cell-line">${escapeHtml(rawValue)}</div>${metaHtml}</td>`;
          }).join("")}
        </tr>
      `).join("");

  const body = fillTemplate(template.body_template, {
    quotation_number: getQuotationNumberValue(quotation),
    customer_name: customerName,
    customer_mobile: quotation.mobile || "",
    total_amount: Number(quotation.total_amount || 0).toLocaleString("en-IN"),
    payment_status: quotation.payment_status,
    order_status: quotation.order_status,
    delivery_type: quotation.delivery_type,
    delivery_date: formatDateIST(quotation.delivery_date),
    delivery_address: quotation.delivery_address || "",
    delivery_pincode: quotation.delivery_pincode || ""
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Quotation ${escapeHtml(getQuotationNumberValue(quotation) || quotationLabel(quotation))}</title>
  <style>
    :root { --accent: ${escapeHtml(accent)}; --ink: #102033; --muted: #5b6b7f; --line: #dbe4f0; --paper: #ffffff; --soft: #f5f9ff; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #eef4fb; color: var(--ink); font-family: Inter, Arial, sans-serif; }
    .page { max-width: 980px; margin: 24px auto; padding: 15px; background: var(--paper); border-radius: 24px; box-shadow: 0 20px 60px rgba(16,32,51,.12); overflow: hidden; }
    .hero { padding: 32px; background: linear-gradient(135deg, var(--accent), #8ec5ff); color: #fff; border-radius: 18px 18px 0 0; }
    .hero-top { display: flex; justify-content: space-between; gap: 24px; align-items: start; }
    .brand h1 { margin: 0; font-size: 30px; }
    .brand p { margin: 8px 0 0; opacity: .9; max-width: 520px; line-height: 1.5; }
    .meta { background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.24); border-radius: 18px; padding: 16px 18px; min-width: 260px; }
    .meta strong, .label { display: block; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; opacity: .8; }
    .meta div + div { margin-top: 10px; }
    .content { padding: 28px 32px 32px; }
    .info-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; margin-bottom: 22px; }
    .card { background: var(--soft); border: 1px solid var(--line); border-radius: 18px; padding: 18px; }
    .card h3 { margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
    .customer-name { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
    .body-copy { margin: 0 0 18px; line-height: 1.7; color: #314154; text-align: left; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; overflow: hidden; border-radius: 16px; }
    thead th {
      background: #eaf3ff;
      color: #355174;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .04em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.15;
    }
    th, td { padding: 14px 12px; border-bottom: 1px solid var(--line); text-align: left; }
    td { font-size: 11px; font-weight: 400; line-height: 1.2; }
    td.item-cell .cell-line { font-size: 11px; font-weight: 700; }
    td.value-cell .cell-line { font-size: 11px; font-weight: 400; }
    tbody tr:last-child td { border-bottom: none; }
    .custom-meta { margin-top: 4px; font-size: 11px; color: var(--muted); line-height: 1.5; }
    .totals { margin-top: 20px; margin-left: auto; width: min(100%, 360px); }
    .totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed var(--line); white-space: nowrap; gap: 16px; }
    .totals-row.grand { border-bottom: none; font-size: 16px; font-weight: 700; color: var(--accent); padding-top: 16px; white-space: nowrap; }
    .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 24px; }
    .foot-note { line-height: 1.6; color: var(--muted); }
    .watermark {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      font-size: 52px;
      font-weight: 800;
      color: rgba(17, 35, 56, 0.08);
      transform: rotate(-28deg);
      letter-spacing: .08em;
      text-transform: uppercase;
      z-index: 0;
    }
    .page { position: relative; z-index: 1; }
    @media print { body { background: #fff; } .page { margin: 0; box-shadow: none; border-radius: 0; } }
    @media (max-width: 720px) { .hero-top, .info-grid, .footer-grid { grid-template-columns: 1fr; display: grid; } .meta { min-width: 0; } }
  </style>
</head>
<body>
  ${watermarkText ? `<div class="watermark">${escapeHtml(watermarkText)}</div>` : ""}
  <div class="page">
    <div class="hero">
      <div class="hero-top">
        <div class="brand">
          <div class="label">${escapeHtml(template.header_text || "Commercial Offer")}</div>
          <h1>${escapeHtml(template.header_text || "Commercial Offer")}</h1>
          <p>${nl2br(getPrintableFooterText(template) || "Thank you for the opportunity. Please find our commercial offer below.")}</p>
        </div>
        <div class="meta">
          <div><strong>Quotation No.</strong>${escapeHtml(getQuotationNumberValue(quotation) || "-")}</div>
          <div><strong>Date</strong>${escapeHtml(formatDateIST(quotation.created_at))}</div>
          <div><strong>Total Value</strong>Rs ${Number(quotation.total_amount || 0).toLocaleString("en-IN")}</div>
        </div>
      </div>
    </div>
    <div class="content">
      <div class="info-grid">
        <div class="card">
          <h3>Customer</h3>
          <div class="customer-name">${escapeHtml(customerName)}</div>
          <div>${escapeHtml(quotation.customer_name || "")}</div>
          <div>${escapeHtml(quotation.mobile || "")}</div>
          <div><strong>Delivery Date:</strong> ${escapeHtml(formatDateIST(quotation.delivery_date) || "-")}</div>
          <div>${escapeHtml(getCustomerDisplayAddress(quotation) || "")}</div>
          <div>${escapeHtml(quotation.delivery_pincode || "")}</div>
        </div>
        <div class="card">
          <h3>Contact</h3>
          ${template.show_logo_only && template.logo_image_data
            ? `<div><img src="${template.logo_image_data}" alt="Logo" style="max-width:140px;max-height:70px;object-fit:contain;" /></div>
          <div><strong>Phone:</strong> ${escapeHtml(template.company_phone || quotation.seller_mobile || "")}</div>
          <div><strong>Email:</strong> ${escapeHtml(template.company_email || "")}</div>
          <div><strong>Address:</strong> ${nl2br(template.company_address || "")}</div>`
            : template.show_header_image && template.header_image_data
            ? `<div><img src="${template.header_image_data}" alt="Header" style="max-width:100%;max-height:90px;object-fit:contain;" /></div>`
            : `<div><strong>Phone:</strong> ${escapeHtml(template.company_phone || quotation.seller_mobile || "")}</div>
          <div><strong>Email:</strong> ${escapeHtml(template.company_email || "")}</div>
          <div><strong>Address:</strong> ${nl2br(template.company_address || "")}</div>`}
        </div>
      </div>

      <p class="body-copy">${nl2br(body)}</p>

        <table>
          <thead>
            <tr>
              <th>Sr. No.</th>
              ${pdfColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
            </tr>
          </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="totals">
        ${totalsRows.join("")}
      </div>

      ${showBankDetails || showNotes || showTerms ? `
      <div class="footer-grid">
        ${showBankDetails ? `
        <div class="card">
          <h3>Bank Details</h3>
          <div class="foot-note"><strong>Bank Name:</strong> -</div>
          <div class="foot-note"><strong>Branch:</strong> -</div>
          <div class="foot-note"><strong>Account No:</strong> -</div>
          <div class="foot-note"><strong>IFSC:</strong> -</div>
        </div>
        ` : ""}
        ${showNotes ? `
        <div class="card">
          <h3>Notes</h3>
          <div class="foot-note">${notesRichText || nl2br(notesText)}</div>
        </div>
        ` : ""}
        ${showTerms ? `
        <div class="card">
          <h3>Terms</h3>
          <div class="foot-note">${termsRichText || nl2br(termsText)}</div>
        </div>
        ` : ""}
      </div>
      ` : ""}
    </div>
  </div>
</body>
</html>`;
}


//---------old code ----------------
/*
function buildQuotationPdf({ quotation, items, template, pdfColumns, pdfModules = {}, res, debugLogger }) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const accent = template.accent_color || "#2563eb";
  const customerName = quotation.firm_name || quotation.customer_name || "Customer";
  const watermarkText = quotation.watermark_text || "";
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelColor = "#5b6b7f";
  const textColor = "#102033";
  const lineColor = "#d7e1ec";
  const bodyCopy = fillTemplate(template.body_template, {
    quotation_number: getQuotationNumberValue(quotation),
    customer_name: customerName,
    customer_mobile: quotation.mobile || "",
    total_amount: Number(quotation.total_amount || 0).toLocaleString("en-IN"),
    payment_status: quotation.payment_status,
    order_status: quotation.order_status,
    delivery_type: quotation.delivery_type,
    delivery_date: formatDateIST(quotation.delivery_date),
    delivery_address: quotation.delivery_address || "",
    delivery_pincode: quotation.delivery_pincode || ""
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${quotationFileStem(quotation)}.pdf`);
  debugLogger?.log("headers-set", `items=${items.length} columns=${pdfColumns?.length || 0}`);
  doc.on("error", (error) => {
    debugLogger?.log("doc-error", error.message);
  });
  res.on("finish", () => {
    debugLogger?.log("response-finish");
  });
  res.on("close", () => {
    debugLogger?.log("response-close");
  });
  doc.pipe(res);
  debugLogger?.log("pipe-open");

  if (watermarkText) {
    debugLogger?.log("watermark-start");
    doc.save();
    doc.rotate(-28, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.fillColor("#cfd8e3").opacity(0.25).font("Helvetica-Bold").fontSize(42).text(watermarkText, 40, doc.page.height / 2 - 20, {
      align: "center",
      width: doc.page.width - 80
    });
    doc.opacity(1);
    doc.restore();
    debugLogger?.log("watermark-done");
  }
  debugLogger?.log("header-start");
  doc.fillColor(textColor).font("Helvetica-Bold").fontSize(22).text(template.header_text || "Commercial Offer", { width: pageWidth });
  if (getPrintableFooterText(template)) {
    doc.moveDown(0.2);
    doc.fillColor(labelColor).font("Helvetica").fontSize(11).text(getPrintableFooterText(template), { width: pageWidth });
  }
  if (template.company_address || template.company_phone || template.company_email || quotation.seller_mobile) {
    doc.moveDown(0.5);
    doc.fillColor(labelColor).font("Helvetica").fontSize(10);
    if (template.company_address) doc.text(template.company_address, { width: pageWidth });
    if (template.company_phone || quotation.seller_mobile) doc.text(`Phone: ${template.company_phone || quotation.seller_mobile}`);
    if (template.company_email) doc.text(`Email: ${template.company_email}`);
  }

  doc.moveDown(0.8);
  doc.strokeColor(lineColor).lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.8);

  doc.fillColor(textColor).font("Helvetica-Bold").fontSize(11);
  doc.text(`Quotation No: ${getQuotationNumberValue(quotation) || "-"}`, { width: pageWidth / 2, continued: true });
  doc.text(`Quotation Date: ${formatDateIST(quotation.created_at) || "-"}`, { width: pageWidth / 2, align: "right" });
  doc.moveDown(0.4);

  doc.fillColor(textColor).font("Helvetica").fontSize(10.5);
  doc.text(`Customer: ${customerName}`, { width: pageWidth / 2, continued: true });
  doc.text(`Delivery Type: ${quotation.delivery_type || "-"}`, { width: pageWidth / 2, align: "right" });
  doc.moveDown(0.2);
  doc.text(`Mobile: ${quotation.mobile || "-"}`, { width: pageWidth / 2, continued: true });
  doc.text(`Delivery Date: ${formatDateIST(quotation.delivery_date) || "-"}`, { width: pageWidth / 2, align: "right" });
  if (quotation.delivery_address || quotation.delivery_pincode) {
    doc.moveDown(0.2);
    doc.text(`Delivery Address: ${quotation.delivery_address || "-"}`, { width: pageWidth });
    doc.text(`Delivery Pincode: ${quotation.delivery_pincode || "-"}`, { width: pageWidth });
  }

  doc.moveDown(0.8);
  debugLogger?.log("header-done");

  if (bodyCopy && bodyCopy.trim()) {
    debugLogger?.log("body-start", `length=${bodyCopy.length}`);
    doc.font("Helvetica").fontSize(10.5).fillColor(textColor).text(bodyCopy, {
      width: pageWidth,
      lineGap: 3,
      align: "left"
    });
    doc.moveDown(1);
    debugLogger?.log("body-done");
  }
  const configuredColumns = Array.isArray(pdfColumns) && pdfColumns.length ? pdfColumns : [
    { key: "material_name", label: "Item" },
    { key: "quantity", label: "Qty" },
    { key: "rate", label: "Rate" },
    { key: "amount", label: "Amount" }
  ];
  const combineHelpingTextInItemColumn = Boolean(pdfModules.combineHelpingTextInItemColumn);
  const getColumnWeight = (key) => {
    switch (normalizeQuotationColumnKey(key)) {
      case "material_name":
      case "note":
      case "item_note":
        return 3.2;
      case "amount":
      case "total":
      case "total_rate":
      case "total_price":
        return 1.5;
      case "rate":
      case "unit_price":
      case "dimension":
        return 1.3;
      case "quantity":
        return 0.9;
      default:
        return 1.1;
    }
  };
  const weights = configuredColumns.map((column) => getColumnWeight(column.key));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  const serialWidth = 34;
  const availableDynamicWidth = pageWidth - serialWidth;
  const minimumColumnWidth = configuredColumns.length > 6 ? 30 : 60;
  const columns = [
    { key: "sr_no", label: "Sr.", width: serialWidth },
    ...configuredColumns.map((column, index) => ({
      ...column,
      width: Math.max(minimumColumnWidth, Math.floor((availableDynamicWidth * weights[index]) / totalWeight))
    }))
  ];
  let allocatedWidth = columns.reduce((sum, column) => sum + column.width, 0);
  if (allocatedWidth > pageWidth) {
    let overflow = allocatedWidth - pageWidth;
    for (let index = columns.length - 1; index >= 1 && overflow > 0; index -= 1) {
      const floorWidth = index === 1 ? Math.max(80, minimumColumnWidth) : minimumColumnWidth;
      const reducible = Math.max(0, columns[index].width - floorWidth);
      if (!reducible) continue;
      const reduceBy = Math.min(reducible, overflow);
      columns[index].width -= reduceBy;
      overflow -= reduceBy;
    }
    allocatedWidth = columns.reduce((sum, column) => sum + column.width, 0);
  }
  if (allocatedWidth !== pageWidth) {
    columns[columns.length - 1].width += pageWidth - allocatedWidth;
  }
  debugLogger?.log("table-widths", columns.map((column) => `${column.key}:${column.width}`).join(", "));
  const drawTableHeader = () => {
    let headerX = doc.page.margins.left;
    const headerY = doc.y;
    doc.save();
    doc.fillColor("#f6f9fd").rect(doc.page.margins.left, headerY, pageWidth, 24).fill();
    doc.restore();
    columns.forEach((column) => {
      doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(8.5).text(column.label, headerX + 6, headerY + 7, {
        width: column.width - 12,
        align: column.key === "sr_no" ? "center" : getPdfColumnAlignment(column.key),
        lineBreak: false
      });
      headerX += column.width;
    });
    doc.moveDown(1.5);
  };

  debugLogger?.log("table-header-start");
  drawTableHeader();
  debugLogger?.log("table-header-done");
  items.forEach((item, index) => {
    debugLogger?.log("table-row-start", `row=${index + 1}`);
    if (doc.y > doc.page.height - doc.page.margins.bottom - 120) {
      doc.addPage();
      debugLogger?.log("page-add", `before-row=${index + 1}`);
      drawTableHeader();
    }
    let rowX = doc.page.margins.left;
    const rowY = doc.y;
    const hiddenMetaSummary = getHelpingTextEntries(item, configuredColumns)
      .map((entry) => `${entry.label}: ${entry.value}`)
      .join(", ");
    const itemColumnIndex = columns.findIndex((column) => column.key === "material_name");
    const rowValues = [
      String(index + 1),
      ...configuredColumns.map((column) => toSingleLinePdfValue(getQuotationPdfColumnValue(item, column.key, { combineHelpingTextInItemColumn, pdfNumberFormat })))
    ];
    rowValues.forEach((value, valueIndex) => {
      doc.fillColor(textColor).font("Helvetica").fontSize(9).text(String(value || "-"), rowX + 6, rowY, {
        width: columns[valueIndex].width - 12,
        align: columns[valueIndex].key === "sr_no" ? "center" : getPdfColumnAlignment(columns[valueIndex].key),
        lineBreak: false
      });
      rowX += columns[valueIndex].width;
    });
    if (hiddenMetaSummary && itemColumnIndex > 0) {
      let itemColumnX = doc.page.margins.left;
      for (let i = 0; i < itemColumnIndex; i += 1) itemColumnX += columns[i].width;
      doc.fillColor(labelColor).font("Helvetica").fontSize(7.5).text(toSingleLinePdfValue(hiddenMetaSummary, 80), itemColumnX + 6, rowY + 11, {
        width: columns[itemColumnIndex].width - 12,
        lineBreak: false
      });
    }
    doc.y = rowY + (hiddenMetaSummary ? 24 : 16);
    doc.strokeColor(lineColor).lineWidth(0.6).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.4);
    debugLogger?.log("table-row-done", `row=${index + 1}`);
  });

  debugLogger?.log("totals-start");
  doc.moveDown(0.6);
  let currentY = doc.y;
  const totalsWidth = Math.min(220, pageWidth);
  const totalsLabelWidth = 100;
  const totalsValueWidth = totalsWidth - totalsLabelWidth - 10;
  const totalsX = doc.page.margins.left + pageWidth - totalsWidth;
  const totals = getQuotationSummaryRows({
    subtotalAmount: quotation.subtotal || quotation.total_amount,
    totalAmount: quotation.total_amount,
    gstAmount: quotation.gst_amount || quotation.tax_amount || 0,
    discountAmount: quotation.discount_amount,
    advanceAmount: quotation.advance_amount,
    balanceAmount: quotation.balance_amount || quotation.total_amount
  });

  totals.filter((row) => !row.accent).forEach((row) => {
    doc.fillColor(labelColor).font("Helvetica").fontSize(10).text(row.label, totalsX, currentY, { width: totalsLabelWidth, lineBreak: false });
    doc.fillColor(textColor).font("Helvetica-Bold").text(`Rs ${Number(row.value || 0).toLocaleString("en-IN")}`, totalsX + totalsLabelWidth + 10, currentY, { width: totalsValueWidth, align: "right", lineBreak: false });
    currentY += 16;
  });

  doc.moveTo(totalsX, currentY + 2).lineTo(totalsX + totalsWidth, currentY + 2).strokeColor(lineColor).stroke();
  currentY += 10;
  const accentRow = totals.find((row) => row.accent) || { label: "Balance Amount", value: quotation.balance_amount || quotation.total_amount || 0 };
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(10).text(accentRow.label, totalsX, currentY, { width: totalsLabelWidth, lineBreak: false });
  doc.text(`Rs ${Number(accentRow.value || 0).toLocaleString("en-IN")}`, totalsX + totalsLabelWidth + 10, currentY, { width: totalsValueWidth, align: "right", lineBreak: false });
  debugLogger?.log("totals-done");

  debugLogger?.log("notes-start");
  doc.moveDown(2);
  doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(10).text("Notes", doc.page.margins.left, doc.y);
  doc.moveDown(0.3);
  doc.fillColor(textColor).font("Helvetica").fontSize(9.5).text(template.notes_text || "-", {
    width: pageWidth,
    lineGap: 2
  });
  debugLogger?.log("notes-done");

  debugLogger?.log("terms-start");
  doc.moveDown(0.8);
  doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(10).text("Terms", doc.page.margins.left, doc.y);
  doc.moveDown(0.3);
  doc.fillColor(textColor).font("Helvetica").fontSize(9.5).text(template.terms_text || "-", {
    width: pageWidth,
    lineGap: 2
  });
  debugLogger?.log("terms-done");

  debugLogger?.log("doc-end");
  doc.end();
}
  */

//--------- old code ended -----------

//--------- new code with template preset variations and improved layout stability -----------

function buildQuotationPdf({ quotation, items, template, pdfColumns, pdfModules = {}, res, debugLogger }) {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const accent = template.accent_color || "#2563eb";
  const showNotes = isTemplateSectionVisible(template, "show_notes", true);
  const showTerms = isTemplateSectionVisible(template, "show_terms", true);
  const notesText = getTemplateNotesText(template);
  const termsText = getTemplateTermsText(template);
  const notesRichText = getTemplateNotesRichText(template);
  const termsRichText = getTemplateTermsRichText(template);
  const customerName = getCustomerDisplayName(quotation);
  const customerAddress = getCustomerDisplayAddress(quotation);
  const gstActive = isGstQuotationActive(quotation);
  const companyPhone = getCompanyPhoneDisplay(template, null, quotation);
  const watermarkText = quotation.watermark_text || "";
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const labelColor = "#667085";
  const textColor = "#101828";
  const subtleText = "#475467";
  const lineColor = "#dbe4ee";
  const softFill = "#f8fbff";
  const softFill2 = "#f2f6fc";

  const bodyCopy = fillTemplate(template.body_template, {
    quotation_number: getQuotationNumberValue(quotation),
    customer_name: customerName,
    customer_mobile: quotation.mobile || "",
    total_amount: Number(quotation.total_amount || 0).toLocaleString("en-IN"),
    payment_status: quotation.payment_status,
    order_status: quotation.order_status,
    delivery_type: quotation.delivery_type,
    delivery_date: formatDateIST(quotation.delivery_date),
    delivery_address: quotation.delivery_address || "",
    delivery_pincode: quotation.delivery_pincode || ""
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${quotationFileStem(quotation)}.pdf`);

  debugLogger?.log("headers-set", `items=${items.length} columns=${pdfColumns?.length || 0}`);

  doc.on("error", (error) => {
    debugLogger?.log("doc-error", error.message);
  });
  res.on("finish", () => {
    debugLogger?.log("response-finish");
  });
  res.on("close", () => {
    debugLogger?.log("response-close");
  });

  doc.pipe(res);
  debugLogger?.log("pipe-open");

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const drawRoundedBox = (x, y, w, h, fill = "#ffffff", stroke = lineColor, radius = 10) => {
    doc.save();
    doc.roundedRect(x, y, w, h, radius).fillAndStroke(fill, stroke);
    doc.restore();
  };

  const drawSectionHeading = (title, x = doc.page.margins.left, y = doc.y) => {
    doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(9).text(String(title).toUpperCase(), x, y, {
      width: pageWidth
    });
  };

  const drawTopAccent = () => {
    const topY = doc.page.margins.top - 18;
    doc.save();
    doc.rect(0, topY, doc.page.width, 10).fill(accent);
    doc.restore();
  };

  const ensurePageSpace = (requiredHeight = 100) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - requiredHeight) {
      doc.addPage();
      drawTopAccent();
      return true;
    }
    return false;
  };

  // ---------------------------------------------------------------------------
  // Decorative top line
  // ---------------------------------------------------------------------------
  drawTopAccent();

  // ---------------------------------------------------------------------------
  // Watermark
  // ---------------------------------------------------------------------------
  if (watermarkText) {
    debugLogger?.log("watermark-start");
    doc.save();
    doc.rotate(-28, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.fillColor("#cfd8e3").opacity(0.16).font("Helvetica-Bold").fontSize(46).text(
      watermarkText,
      40,
      doc.page.height / 2 - 20,
      {
        align: "center",
        width: doc.page.width - 80
      }
    );
    doc.opacity(1);
    doc.restore();
    debugLogger?.log("watermark-done");
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------
  debugLogger?.log("header-start");

  const headerStartY = doc.y;

  // Left side: company / document header
  doc.fillColor(textColor).font("Helvetica-Bold").fontSize(24).text(template.header_text || "Commercial Offer", doc.page.margins.left, headerStartY, {
    width: pageWidth - 180
  });

  if (getPrintableFooterText(template)) {
    doc.moveDown(0.15);
    doc.fillColor(subtleText).font("Helvetica").fontSize(10.5).text(getPrintableFooterText(template), {
      width: pageWidth - 180,
      lineGap: 2
    });
  }

  // Right side: quotation meta card
  const metaCardWidth = 170;
  const metaCardX = doc.page.margins.left + pageWidth - metaCardWidth;
  const metaCardY = headerStartY;
  drawRoundedBox(metaCardX, metaCardY, metaCardWidth, 74, softFill, lineColor, 10);

  doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(8.5).text("QUOTATION NO", metaCardX + 12, metaCardY + 10, {
    width: metaCardWidth - 24
  });
  doc.fillColor(textColor).font("Helvetica-Bold").fontSize(12).text(getQuotationNumberValue(quotation) || "-", metaCardX + 12, metaCardY + 22, {
    width: metaCardWidth - 24
  });

  doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(8.5).text("DATE", metaCardX + 12, metaCardY + 42, {
    width: 60
  });
  doc.fillColor(textColor).font("Helvetica").fontSize(10).text(formatDateIST(quotation.created_at) || "-", metaCardX + 60, metaCardY + 42, {
    width: metaCardWidth - 72,
    align: "right"
  });

  doc.y = Math.max(doc.y, metaCardY + 86);

  if (template.company_address || template.company_phone || template.company_email || quotation.seller_mobile) {
    doc.moveDown(0.3);
    doc.fillColor(labelColor).font("Helvetica").fontSize(9.5);
    if (template.company_address) doc.text(template.company_address, { width: pageWidth - 180, lineGap: 1 });
    if (template.company_phone || quotation.seller_mobile) doc.text(`Phone: ${template.company_phone || quotation.seller_mobile}`, { width: pageWidth - 180 });
    if (template.company_email) doc.text(`Email: ${template.company_email}`, { width: pageWidth - 180 });
  }

  doc.moveDown(0.8);
  doc.strokeColor(lineColor).lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.8);

  // ---------------------------------------------------------------------------
  // Info cards
  // ---------------------------------------------------------------------------
  const cardY = doc.y;
  const gap = 14;
  const leftCardW = (pageWidth - gap) / 2;
  const rightCardW = (pageWidth - gap) / 2;
  const leftCardX = doc.page.margins.left;
  const rightCardX = leftCardX + leftCardW + gap;
  const infoCardH = 88;

  drawRoundedBox(leftCardX, cardY, leftCardW, infoCardH, "#ffffff", lineColor, 10);
  drawRoundedBox(rightCardX, cardY, rightCardW, infoCardH, "#ffffff", lineColor, 10);

  // Left card - customer
  doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(8.5).text("BILL TO", leftCardX + 12, cardY + 10, {
    width: leftCardW - 24
  });
  doc.fillColor(textColor).font("Helvetica-Bold").fontSize(13).text(customerName, leftCardX + 12, cardY + 24, {
    width: leftCardW - 24
  });
  doc.fillColor(subtleText).font("Helvetica").fontSize(9.5);
  doc.text(`Mobile: ${quotation.mobile || "-"}`, leftCardX + 12, cardY + 44, {
    width: leftCardW - 24
  });
  doc.text(`Quotation Date: ${formatDateIST(quotation.created_at) || "-"}`, leftCardX + 12, cardY + 58, {
    width: leftCardW - 24
  });

  // Right card - dispatch / delivery
  doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(8.5).text("SUPPLY / DISPATCH", rightCardX + 12, cardY + 10, {
    width: rightCardW - 24
  });
  doc.fillColor(subtleText).font("Helvetica").fontSize(9.5);
  doc.text(`Delivery Type: ${quotation.delivery_type || "-"}`, rightCardX + 12, cardY + 26, {
    width: rightCardW - 24
  });
  doc.text(`Delivery Date: ${formatDateIST(quotation.delivery_date) || "-"}`, rightCardX + 12, cardY + 42, {
    width: rightCardW - 24
  });
  doc.text(`Pincode: ${quotation.delivery_pincode || "-"}`, rightCardX + 12, cardY + 58, {
    width: rightCardW - 24
  });

  doc.y = cardY + infoCardH + 14;

  if (quotation.delivery_address) {
    doc.fillColor(subtleText).font("Helvetica").fontSize(9.3).text(`Delivery Address: ${quotation.delivery_address}`, {
      width: pageWidth,
      lineGap: 1
    });
    doc.moveDown(0.5);
  }

  debugLogger?.log("header-done");

  // ---------------------------------------------------------------------------
  // Intro/body text
  // ---------------------------------------------------------------------------
  if (bodyCopy && bodyCopy.trim()) {
    debugLogger?.log("body-start", `length=${bodyCopy.length}`);
    drawSectionHeading("Message");
    doc.moveDown(0.35);
    doc.fillColor(textColor).font("Helvetica").fontSize(10.3).text(bodyCopy, {
      width: pageWidth,
      lineGap: 3,
      align: "left"
    });
    doc.moveDown(0.9);
    debugLogger?.log("body-done");
  }

  // ---------------------------------------------------------------------------
  // Table configuration
  // ---------------------------------------------------------------------------
  const configuredColumns = Array.isArray(pdfColumns) && pdfColumns.length ? pdfColumns : [
    { key: "material_name", label: "Item" },
    { key: "quantity", label: "Qty" },
    { key: "rate", label: "Rate" },
    { key: "amount", label: "Amount" }
  ];

  const combineHelpingTextInItemColumn = Boolean(pdfModules.combineHelpingTextInItemColumn);

  const getColumnWeight = (key) => {
    switch (normalizeQuotationColumnKey(key)) {
      case "material_name":
      case "note":
      case "item_note":
        return 3.2;
      case "amount":
      case "total":
      case "total_rate":
      case "total_price":
        return 1.5;
      case "rate":
      case "unit_price":
      case "dimension":
        return 1.3;
      case "quantity":
        return 0.9;
      default:
        return 1.1;
    }
  };

  const weights = configuredColumns.map((column) => getColumnWeight(column.key));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  const serialWidth = 34;
  const availableDynamicWidth = pageWidth - serialWidth;
  const minimumColumnWidth = configuredColumns.length > 6 ? 30 : 60;

  const columns = [
    { key: "sr_no", label: "Sr.", width: serialWidth },
    ...configuredColumns.map((column, index) => ({
      ...column,
      width: Math.max(minimumColumnWidth, Math.floor((availableDynamicWidth * weights[index]) / totalWeight))
    }))
  ];

  let allocatedWidth = columns.reduce((sum, column) => sum + column.width, 0);
  if (allocatedWidth > pageWidth) {
    let overflow = allocatedWidth - pageWidth;
    for (let index = columns.length - 1; index >= 1 && overflow > 0; index -= 1) {
      const floorWidth = index === 1 ? Math.max(80, minimumColumnWidth) : minimumColumnWidth;
      const reducible = Math.max(0, columns[index].width - floorWidth);
      if (!reducible) continue;
      const reduceBy = Math.min(reducible, overflow);
      columns[index].width -= reduceBy;
      overflow -= reduceBy;
    }
    allocatedWidth = columns.reduce((sum, column) => sum + column.width, 0);
  }
  if (allocatedWidth !== pageWidth) {
    columns[columns.length - 1].width += pageWidth - allocatedWidth;
  }

  debugLogger?.log("table-widths", columns.map((column) => `${column.key}:${column.width}`).join(", "));

  const drawTableHeader = () => {
    let headerX = doc.page.margins.left;
    const headerY = doc.y;

    doc.save();
    doc.roundedRect(doc.page.margins.left, headerY, pageWidth, 24, 6).fill(accent);
    doc.restore();

    columns.forEach((column) => {
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5).text(column.label, headerX + 6, headerY + 7, {
        width: column.width - 12,
        align: column.key === "sr_no" ? "center" : getPdfColumnAlignment(column.key),
        lineBreak: false
      });
      headerX += column.width;
    });

    doc.moveDown(1.5);
  };

  drawSectionHeading("Items");
  doc.moveDown(0.3);

  debugLogger?.log("table-header-start");
  drawTableHeader();
  debugLogger?.log("table-header-done");

  items.forEach((item, index) => {
    debugLogger?.log("table-row-start", `row=${index + 1}`);

    if (doc.y > doc.page.height - doc.page.margins.bottom - 125) {
      doc.addPage();
      drawTopAccent();
      debugLogger?.log("page-add", `before-row=${index + 1}`);
      drawSectionHeading("Items");
      doc.moveDown(0.3);
      drawTableHeader();
    }

    let rowX = doc.page.margins.left;
    const rowY = doc.y;

    const hiddenMetaSummary = getHelpingTextEntries(item, configuredColumns)
      .map((entry) => `${entry.label}: ${entry.value}`)
      .join(", ");

    const itemColumnIndex = columns.findIndex((column) => column.key === "material_name");

    const rowValues = [
      String(index + 1),
      ...configuredColumns.map((column) =>
        toSingleLinePdfValue(getQuotationPdfColumnValue(item, column.key, { combineHelpingTextInItemColumn, pdfNumberFormat }))
      )
    ];

    const rowHeight = hiddenMetaSummary ? 28 : 20;

    // zebra row
    if (index % 2 === 0) {
      doc.save();
      doc.rect(doc.page.margins.left, rowY - 2, pageWidth, rowHeight).fill(softFill);
      doc.restore();
    }

    rowValues.forEach((value, valueIndex) => {
      doc.fillColor(textColor).font(valueIndex === itemColumnIndex ? "Helvetica-Bold" : "Helvetica").fontSize(9).text(
        String(value || "-"),
        rowX + 6,
        rowY,
        {
          width: columns[valueIndex].width - 12,
          align: columns[valueIndex].key === "sr_no" ? "center" : getPdfColumnAlignment(columns[valueIndex].key),
          lineBreak: false
        }
      );
      rowX += columns[valueIndex].width;
    });

    if (hiddenMetaSummary && itemColumnIndex > 0) {
      let itemColumnX = doc.page.margins.left;
      for (let i = 0; i < itemColumnIndex; i += 1) itemColumnX += columns[i].width;

      doc.fillColor(labelColor).font("Helvetica").fontSize(7.4).text(
        toSingleLinePdfValue(hiddenMetaSummary, 80),
        itemColumnX + 6,
        rowY + 12,
        {
          width: columns[itemColumnIndex].width - 12,
          lineBreak: false
        }
      );
    }

    doc.y = rowY + rowHeight;
    doc.strokeColor(lineColor).lineWidth(0.5).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.25);

    debugLogger?.log("table-row-done", `row=${index + 1}`);
  });

  // ---------------------------------------------------------------------------
  // Totals
  // ---------------------------------------------------------------------------
  debugLogger?.log("totals-start");
  ensurePageSpace(120);

  doc.moveDown(0.6);

  const totals = getQuotationSummaryRows({
    subtotalAmount: quotation.subtotal || quotation.total_amount,
    totalAmount: quotation.total_amount,
    gstAmount: quotation.gst_amount || quotation.tax_amount || 0,
    discountAmount: quotation.discount_amount,
    advanceAmount: quotation.advance_amount,
    balanceAmount: quotation.balance_amount || quotation.total_amount
  });

  const totalsWidth = Math.min(240, pageWidth);
  const totalsX = doc.page.margins.left + pageWidth - totalsWidth;
  const totalsY = doc.y;
  const totalsBoxHeight = Math.max(70, 18 * totals.length + 18);

  drawRoundedBox(totalsX, totalsY, totalsWidth, totalsBoxHeight, softFill2, lineColor, 10);

  let currentY = totalsY + 12;
  const totalsLabelWidth = 110;
  const totalsValueWidth = totalsWidth - totalsLabelWidth - 18;

  totals.filter((row) => !row.accent).forEach((row) => {
    doc.fillColor(labelColor).font("Helvetica").fontSize(9.5).text(row.label, totalsX + 10, currentY, {
      width: totalsLabelWidth,
      lineBreak: false
    });
    doc.fillColor(textColor).font("Helvetica-Bold").fontSize(9.8).text(
      `Rs ${Number(row.value || 0).toLocaleString("en-IN")}`,
      totalsX + totalsLabelWidth + 8,
      currentY,
      {
        width: totalsValueWidth,
        align: "right",
        lineBreak: false
      }
    );
    currentY += 16;
  });

  doc.strokeColor(lineColor).lineWidth(0.8).moveTo(totalsX + 10, currentY + 2).lineTo(totalsX + totalsWidth - 10, currentY + 2).stroke();
  currentY += 10;

  const accentRow = totals.find((row) => row.accent) || {
    label: "Balance Amount",
    value: quotation.balance_amount || quotation.total_amount || 0
  };

  doc.fillColor(accent).font("Helvetica-Bold").fontSize(10.5).text(accentRow.label, totalsX + 10, currentY, {
    width: totalsLabelWidth,
    lineBreak: false
  });
  doc.text(`Rs ${Number(accentRow.value || 0).toLocaleString("en-IN")}`, totalsX + totalsLabelWidth + 8, currentY, {
    width: totalsValueWidth,
    align: "right",
    lineBreak: false
  });

  doc.y = totalsY + totalsBoxHeight + 16;
  debugLogger?.log("totals-done");

  const notesBlocks = [
    ...(showNotes ? [{ title: "NOTES", body: notesText, bodyHtml: notesRichText }] : []),
    ...(showTerms ? [{ title: "TERMS", body: termsText, bodyHtml: termsRichText }] : [])
  ];
  if (notesBlocks.length) {
    debugLogger?.log("notes-start");
    const bottomBoxW = pageWidth;
    const titleBandHeight = 24;
    const boxPadding = 12;
    const bottomGap = 10;

    notesBlocks.forEach((block) => {
      const bodyHtml = block.bodyHtml || plainTextToRichText(block.body);
      const bodyHeight = measureRichTextPdfHeight(doc, bodyHtml, {
        width: bottomBoxW - (boxPadding * 2),
        fontSize: 9,
        lineGap: 2,
        blockGap: 4,
        listIndent: 16
      });
      const boxHeight = Math.max(52, Math.ceil(titleBandHeight + boxPadding + bodyHeight + 10));
      ensurePageSpace(boxHeight + 20);

      const blockY = doc.y;
      drawRoundedBox(doc.page.margins.left, blockY, bottomBoxW, boxHeight, "#ffffff", lineColor, 10);
      doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(8.5).text(block.title, doc.page.margins.left + boxPadding, blockY + 8, {
        width: bottomBoxW - (boxPadding * 2)
      });
      doc.y = blockY + titleBandHeight;
      renderRichTextPdf(doc, bodyHtml, {
        x: doc.page.margins.left + boxPadding,
        width: bottomBoxW - (boxPadding * 2),
        fontSize: 9,
        lineGap: 2,
        blockGap: 4,
        listIndent: 16,
        bulletGap: 12,
        color: textColor
      });
      doc.y = blockY + boxHeight + bottomGap;
    });
    debugLogger?.log("notes-done");
  }

  // ---------------------------------------------------------------------------
  // Footer line
  // ---------------------------------------------------------------------------
  doc.strokeColor(lineColor).lineWidth(0.8).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(0.35);
  doc.fillColor(labelColor).font("Helvetica").fontSize(8.5).text(
    "System generated quotation",
    doc.page.margins.left,
    doc.y,
    { width: pageWidth, align: "right" }
  );

  debugLogger?.log("doc-end");
  doc.end();
}


//---- new code ended 

function buildSimpleQuotationPdf({ quotation, items, template, seller = null, pdfColumns = [], allPdfColumns = [], pdfModules = {}, res }) {
  const doc = new PDFDocument({ size: "A4", margin: 16 });
  const customerName = getCustomerDisplayName(quotation);
  const customerAddress = getCustomerDisplayAddress(quotation);
  const gstActive = isGstQuotationActive(quotation);
  const companyPhone = getCompanyPhoneDisplay(template, seller, quotation);
  const quotationNo = getQuotationNumberValue(quotation) || "-";
  const templatePreset = normalizeTemplatePreset(template?.template_preset);
  const accent = template?.accent_color || "#2563eb";
  const showBankDetails = isTemplateSectionVisible(template, "show_bank_details", true);
  const showNotes = isTemplateSectionVisible(template, "show_notes", true);
  const showTerms = isTemplateSectionVisible(template, "show_terms", true);
  const notesText = getTemplateNotesText(template);
  const termsText = getTemplateTermsText(template);
  const notesRichText = getTemplateNotesRichText(template);
  const termsRichText = getTemplateTermsRichText(template);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const leftX = doc.page.margins.left;
  const rightX = leftX + pageWidth - 190;
  const headerImageBuffer = imageBufferFromDataUrl(template?.show_header_image ? template?.header_image_data : null);
  const logoBuffer = !headerImageBuffer ? imageBufferFromDataUrl(template?.show_logo_only ? template?.logo_image_data : null) : null;
  let fullWidthHeaderHeight = 0;
  if (headerImageBuffer) {
    try {
      const headerImage = doc.openImage(headerImageBuffer);
      const proportionalHeight = headerImage?.width ? (pageWidth * headerImage.height) / headerImage.width : 88;
      fullWidthHeaderHeight = Math.min(Math.max(proportionalHeight, 72), 150);
    } catch (_error) {
      fullWidthHeaderHeight = 88;
    }
  }
  const bodyCopy = renderTemplateText(
    template?.body_template || "Dear {{customer_name}}, thank you for your enquiry. Please find our offer for quotation {{quotation_number}}.",
    quotation
  );
  const configuredColumns = Array.isArray(pdfColumns) && pdfColumns.length ? pdfColumns : [
    { key: "material_name", label: "Item", type: "text" },
    { key: "quantity", label: "Qty", type: "number" },
    { key: "rate", label: "Rate", type: "number" },
    { key: "amount", label: "Amount", type: "formula" }
  ];
  const visiblePdfColumns = Array.isArray(allPdfColumns) && allPdfColumns.length ? allPdfColumns : configuredColumns;
  const combineHelpingTextInItemColumn = Boolean(pdfModules.combineHelpingTextInItemColumn);
  const pdfNumberFormat = pdfModules?.pdfNumberFormat && typeof pdfModules.pdfNumberFormat === "object"
    ? pdfModules.pdfNumberFormat
    : {};

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${quotationFileStem(quotation)}.pdf`);
  doc.pipe(res);

  if (templatePreset === "default") {
    const themeConfig = getQuotationThemeConfig(template?.template_theme_key, template?.accent_color || null);
    const accent = themeConfig.accent;
    const dark = themeConfig.text;
    const muted = themeConfig.muted;
    const line = themeConfig.border;
    const surface = themeConfig.surface;
    const headerFill = themeConfig.header;
    const borderWidth = 0.5;
    const sellerName = template?.company_name || seller?.business_name || seller?.name || template?.header_text || "Quotation";
    const footerRaw = String(
      template?.show_footer_image && template?.footer_image_data
        ? template.footer_image_data
        : (getPrintableFooterText(template) || "")
    ).trim();
    const footerImage = imageBufferFromDataUrl(footerRaw);
    const footerRawIsImagePayload = isDataImageString(footerRaw);
    const footerReserve = footerRaw ? 54 : 0;
    const pageBottom = doc.page.height - doc.page.margins.bottom - footerReserve;
    let y = doc.page.margins.top;

    const drawFooterForCurrentPage = () => {
      if (!footerRaw) return;
      const footerBaselineY = doc.page.height - doc.page.margins.bottom - 2;

      if (footerImage) {
        try {
          const imageMeta = doc.openImage(footerImage);
          const maxFooterHeight = 46;
          let drawWidth = pageWidth;
          let drawHeight = Number((imageMeta.height * (drawWidth / imageMeta.width)).toFixed(2));

          if (!Number.isFinite(drawHeight) || drawHeight <= 0) {
            drawHeight = maxFooterHeight;
          }

          if (drawHeight > maxFooterHeight) {
            drawHeight = maxFooterHeight;
            drawWidth = Number((imageMeta.width * (drawHeight / imageMeta.height)).toFixed(2));
          }

          const drawX = leftX + Math.max(0, (pageWidth - drawWidth) / 2);
          const drawY = footerBaselineY - drawHeight;
          doc.image(footerImage, drawX, drawY, {
            width: drawWidth,
            height: drawHeight
          });
          return;
        } catch (_error) {
          // If image rendering fails, try plain text fallback below.
        }
      }

      if (!footerRawIsImagePayload) {
        doc.font("Helvetica").fontSize(9).fillColor(accent).text(toSingleLinePdfValue(footerRaw, 140), leftX, footerBaselineY - 8, {
          width: pageWidth,
          align: "center",
          lineBreak: false
        });
      }
    };

    const addPageWithFooter = () => {
      drawFooterForCurrentPage();
      doc.addPage();
      y = doc.page.margins.top;
    };

    if (headerImageBuffer) {
      try {
        const headerHeight = fullWidthHeaderHeight || 90;
        doc.image(headerImageBuffer, leftX, y, { width: pageWidth, height: headerHeight });
        y += headerHeight + 8;
      } catch (_error) {
        doc.font("Helvetica-Bold").fontSize(17).fillColor(dark).text(sellerName, leftX, y, { width: pageWidth * 0.66 });
        y += 28;
      }
    } else {
      doc.font("Helvetica-Bold").fontSize(17).fillColor(dark).text(sellerName, leftX, y, { width: pageWidth * 0.66 });
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, leftX + pageWidth - 108, y, { fit: [102, 52], align: "right" });
        } catch (_error) {
          // Ignore invalid logo and continue.
        }
      }
      const companyLines = [
        template?.company_address || null,
        companyPhone && companyPhone !== "-" ? `Tel: ${companyPhone}` : null,
        template?.company_email ? `Email: ${template.company_email}` : null
      ].filter(Boolean);
      doc.font("Helvetica").fontSize(9.5).fillColor(muted);
      let companyY = y + 20;
      companyLines.forEach((lineText) => {
        doc.text(lineText, leftX, companyY, { width: pageWidth * 0.66, lineBreak: false });
        companyY += 12;
      });
      y = Math.max(companyY + 2, y + 56);
    }

    const stripHeight = 28;
    doc.lineWidth(borderWidth);
    doc.rect(leftX, y, pageWidth, stripHeight).fillAndStroke(surface, line);
    if (gstActive) {
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(dark).text(`GSTIN: ${quotation.gstin || seller?.gst_number || "-"}`, leftX + 8, y + 9, {
        width: pageWidth * 0.42,
        lineBreak: false
      });
    }
    doc.text("QUOTATION NO:", leftX + pageWidth * 0.42, y + 9, { width: 102, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(dark).text(quotationNo, leftX + pageWidth * 0.42 + 88, y + 9, {
      width: 130,
      lineBreak: false
    });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(dark).text(`DATE: ${formatDateIST(quotation.created_at) || "-"}`, leftX + pageWidth - 152, y + 9, {
      width: 144,
      align: "right",
      lineBreak: false
    });
    y += stripHeight + 8;

    const pairGap = 10;
    const leftBoxWidth = Math.floor((pageWidth - pairGap) / 2);
    const rightBoxX = leftX + leftBoxWidth + pairGap;
    const rightBoxWidth = pageWidth - leftBoxWidth - pairGap;
    const boxHeadingOffset = 24;
    const boxInnerPadding = 8;
    const minBoxHeight = 110;

    const normalizeWrappedValue = (value) => String(value || "")
      .replace(/\r?\n+/g, ", ")
      .replace(/\s+/g, " ")
      .trim() || "-";

    const measureRowsHeight = (rows, width) => {
      let total = 0;
      rows.forEach((row) => {
        const lineText = `${row.label}: ${normalizeWrappedValue(row.value)}`;
        const lineHeight = Math.max(14, Math.ceil(doc.heightOfString(lineText, { width })));
        total += lineHeight + 1;
      });
      return total;
    };

    const drawRows = (rows, x, startY, width) => {
      let currentY = startY;
      rows.forEach((row) => {
        const lineText = `${row.label}: ${normalizeWrappedValue(row.value)}`;
        const lineHeight = Math.max(14, Math.ceil(doc.heightOfString(lineText, { width })));
        doc.font("Helvetica").fontSize(9.3).fillColor(dark).text(lineText, x, currentY, { width });
        currentY += lineHeight + 1;
      });
      return currentY;
    };

    const hasCustomerAddress = toDisplayString(customerAddress) && toDisplayString(customerAddress) !== "-";
    const placeOfSupplyValue = toDisplayString(quotation.delivery_address || quotation.place_of_supply || "");
    const hasPlaceOfSupply = Boolean(placeOfSupplyValue && placeOfSupplyValue !== "-");
    const customerRows = [
      { label: "Name", value: customerName },
      { label: "Phone", value: quotation.mobile || "-" }
    ];
    if (hasCustomerAddress) {
      customerRows.splice(1, 0, { label: "Address", value: customerAddress });
    }
    if (hasPlaceOfSupply) {
      customerRows.push({ label: "Place of Supply", value: placeOfSupplyValue });
    }
    if (gstActive) {
      customerRows.splice(hasCustomerAddress ? 2 : 1, 0, { label: "GSTIN", value: getEffectiveCustomerGstin(quotation) || "-" });
    }

    const referenceRequestId = normalizeReferenceRequestId(quotation.reference_request_id);
    const detailRows = [
      { label: "Version", value: `V${quotation.version_no || 1}` },
      { label: "Delivery Date", value: formatDateIST(quotation.delivery_date) || "-" },
      { label: "Delivery Type", value: quotation.delivery_type || "-" }
    ];
    if (referenceRequestId) {
      detailRows.splice(1, 0, { label: "Reference Request ID", value: referenceRequestId });
    }

    const customerContentHeight = measureRowsHeight(customerRows, leftBoxWidth - (boxInnerPadding * 2));
    const detailContentHeight = measureRowsHeight(detailRows, rightBoxWidth - (boxInnerPadding * 2));
    const boxHeight = Math.max(minBoxHeight, boxHeadingOffset + Math.max(customerContentHeight, detailContentHeight) + boxInnerPadding);

    doc.rect(leftX, y, leftBoxWidth, boxHeight).strokeColor(line).lineWidth(borderWidth).stroke();
    doc.rect(rightBoxX, y, rightBoxWidth, boxHeight).strokeColor(line).lineWidth(borderWidth).stroke();

    doc.font("Helvetica-Bold").fontSize(9.8).fillColor(accent).text("Customer Detail", leftX + boxInnerPadding, y + 8);
    drawRows(customerRows, leftX + boxInnerPadding, y + boxHeadingOffset, leftBoxWidth - (boxInnerPadding * 2));

    doc.font("Helvetica-Bold").fontSize(9.8).fillColor(accent).text("Quotation Detail", rightBoxX + boxInnerPadding, y + 8);
    drawRows(detailRows, rightBoxX + boxInnerPadding, y + boxHeadingOffset, rightBoxWidth - (boxInnerPadding * 2));

    y += boxHeight + 8;

    const tableColumns = getDefaultTemplateTableColumns(configuredColumns, pageWidth);
    const rowHeaderHeight = 22;
    const rowPaddingY = 3;
    const materialColumnIndex = tableColumns.findIndex((column) => normalizeQuotationColumnKey(column.key) === "material_name");
    const itemsBlockReserve = 220;

    const drawHeaderRow = () => {
      doc.lineWidth(borderWidth);
      doc.rect(leftX, y, pageWidth, rowHeaderHeight).fillAndStroke(headerFill, line);
      let hx = leftX;
      tableColumns.forEach((column) => {
        doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#ffffff").text(
          toSingleLinePdfValue(column.label || "-", 28),
          hx + 3,
          y + 6,
          { width: column.width - 6, align: column.align || "left", lineBreak: false }
        );
        hx += column.width;
      });
      y += rowHeaderHeight + 3;
    };

    if (y + rowHeaderHeight + 18 > pageBottom - itemsBlockReserve) {
      addPageWithFooter();
    }
    drawHeaderRow();

    (items || []).forEach((item, index) => {
      const helpingSummary = getHelpingTextEntries(item, visiblePdfColumns, {
        combineHelpingTextInItemColumn
      }).map((entry) => `${entry.label}: ${entry.value}`).join(", ");

      const rowValues = [
        String(index + 1),
        ...configuredColumns.map((column) => String(getQuotationPdfColumnValue(item, column.key, { combineHelpingTextInItemColumn, pdfNumberFormat }) || "-"))
      ];
      const materialText = materialColumnIndex >= 0 ? String(rowValues[materialColumnIndex] || "-") : "";
      const materialWidth = materialColumnIndex >= 0 ? tableColumns[materialColumnIndex].width - 8 : 220;
      const materialHeight = doc.heightOfString(materialText, { width: materialWidth });
      const helpingHeight = helpingSummary ? doc.heightOfString(helpingSummary, { width: materialWidth, lineGap: 1 }) : 0;
      const rowHeight = Math.max(16, Math.ceil(materialHeight + (helpingHeight ? helpingHeight + 2 : 0) + (rowPaddingY * 2)));

      if (y + rowHeight > pageBottom - itemsBlockReserve) {
        addPageWithFooter();
        drawHeaderRow();
      }

      let cx = leftX;
      tableColumns.forEach((column, columnIndex) => {
        const value = String(rowValues[columnIndex] || "-");
        const isMaterial = normalizeQuotationColumnKey(column.key) === "material_name";
        doc.font(isMaterial ? "Helvetica-Bold" : "Helvetica").fontSize(isMaterial ? 9 : 8).fillColor(dark).text(
          isMaterial ? value : toSingleLinePdfValue(value, 34),
          cx + 3,
          y + rowPaddingY,
          { width: column.width - 6, align: column.align || "left" }
        );
        if (isMaterial && helpingSummary) {
          doc.font("Helvetica").fontSize(7.4).fillColor(muted).text(helpingSummary, cx + 3, y + 13, {
            width: column.width - 6,
            lineGap: 1
          });
        }
        cx += column.width;
      });
      y += rowHeight;
    });

    doc.moveTo(leftX, y + 2).lineTo(leftX + pageWidth, y + 2).strokeColor(line).lineWidth(borderWidth).stroke();
    y += 12;

    const subtotal = Number(quotation.subtotal || quotation.total_amount || 0);
    const discount = Number(quotation.discount_amount || 0);
    const taxable = Math.max(0, subtotal - discount);
    const gst = Number(quotation.gst_amount || quotation.tax_amount || 0);
    const grandTotal = Number(quotation.total_amount || taxable + gst);
    const amountInWords = amountToWordsIndian(Number(quotation.total_amount || grandTotal || 0));

    const totalsGap = 10;
    const totalsLeftWidth = Math.floor((pageWidth - totalsGap) / 2);
    const totalsRightX = leftX + totalsLeftWidth + totalsGap;
    const totalsRightWidth = pageWidth - totalsLeftWidth - totalsGap;
    const totalsHeight = 90;
    if (y + totalsHeight + 120 > pageBottom) {
      addPageWithFooter();
    }

    doc.rect(leftX, y, totalsLeftWidth, totalsHeight).fillAndStroke("#ffffff", line);
    doc.rect(totalsRightX, y, totalsRightWidth, totalsHeight).fillAndStroke(surface, line);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(accent).text("Amount in words", leftX + 8, y + 8);
    doc.font("Helvetica").fontSize(9.2).fillColor(dark).text(amountInWords, leftX + 8, y + 24, { width: totalsLeftWidth - 16 });

    const totalsRows = getQuotationSummaryRows({
      subtotalAmount: subtotal,
      totalAmount: grandTotal,
      gstAmount: gst,
      discountAmount: discount,
      advanceAmount: quotation.advance_amount || 0,
      balanceAmount: quotation.balance_amount || grandTotal
    }).map((row) => [row.label, Number(row.value || 0)]);
    let ty = y + 8;
    totalsRows.forEach(([label, value], idx) => {
      const strong = idx === totalsRows.length - 1;
      doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 10.3 : 9.2).fillColor(dark).text(label, totalsRightX + 8, ty, {
        width: totalsRightWidth - 88,
        lineBreak: false
      });
      doc.text(`Rs ${Number(value || 0).toLocaleString("en-IN")}`, totalsRightX + totalsRightWidth - 84, ty, {
        width: 76,
        align: "right",
        lineBreak: false
      });
      ty += 15;
    });
    y += totalsHeight + 8;

    const hasCompleteBankDetails = Boolean(
      toDisplayString(seller?.bank_name) &&
      toDisplayString(seller?.bank_branch) &&
      toDisplayString(seller?.bank_account_no) &&
      toDisplayString(seller?.bank_ifsc)
    );
    const shouldShowBankDetailsSection = showBankDetails && hasCompleteBankDetails;

    const footerGap = 12;
    const leftColumnWidth = Math.floor(pageWidth * 0.7) - Math.floor(footerGap / 2);
    const rightColumnWidth = pageWidth - leftColumnWidth - footerGap;
    const rightColumnX = leftX + leftColumnWidth + footerGap;
    const notesContentFontSize = 6.7;
    const noteSectionGap = 8;
    const noteCardPadding = 8;
    const noteTitleHeight = 16;
    const signatoryHeight = 106;
    const signatoryPageY = y;

    if (signatoryPageY + signatoryHeight + 12 <= pageBottom) {
      doc.rect(rightColumnX, signatoryPageY, rightColumnWidth, signatoryHeight).fillAndStroke(surface, line);
      doc.font("Helvetica-Bold").fontSize(9.8).fillColor(dark).text(`For ${sellerName}`, rightColumnX + 8, signatoryPageY + 16, {
        width: rightColumnWidth - 16,
        align: "center"
      });
      doc.font("Helvetica").fontSize(8.5).fillColor(muted).text("This is computer generated quotation.", rightColumnX + 8, signatoryPageY + 42, {
        width: rightColumnWidth - 16,
        align: "center"
      });
      doc.font("Helvetica-Bold").fontSize(8.8).fillColor(dark).text("Authorised Signatory", rightColumnX + 8, signatoryPageY + signatoryHeight - 18, {
        width: rightColumnWidth - 16,
        align: "center"
      });
    }

    const flattenSectionEntries = (html) => {
      const blocks = parseRichTextBlocks(html);
      const entries = [];
      blocks.forEach((block) => {
        if (block.type === "paragraph") {
          const text = block.segments.map((segment) => String(segment?.text || "")).join("").trim();
          if (text) entries.push({ text, prefix: "" });
          return;
        }
        block.items.forEach((itemSegments, itemIndex) => {
          const text = itemSegments.map((segment) => String(segment?.text || "")).join("").trim();
          if (!text) return;
          entries.push({
            text,
            prefix: block.type === "ordered" ? `${itemIndex + 1}. ` : "\u2022 "
          });
        });
      });
      return entries;
    };

    const measureEntryHeight = (entry) => {
      return Math.ceil(doc.heightOfString(`${entry.prefix}${entry.text}`, {
        width: leftColumnWidth - (noteCardPadding * 2),
        size: notesContentFontSize,
        lineGap: 1
      }));
    };

    const renderSectionLines = (title, entries) => {
      let remainingEntries = [...entries];
      while (remainingEntries.length) {
        let availableHeight = pageBottom - y - 12;
        if (availableHeight < 40) {
          addPageWithFooter();
          continue;
        }
        const pageEntries = [];
        let usedHeight = 0;
        for (const entry of remainingEntries) {
          const entryHeight = Math.max(notesContentFontSize + 2, measureEntryHeight(entry));
          const nextHeight = usedHeight + entryHeight;
          if (pageEntries.length && (noteCardPadding + noteTitleHeight + 4 + nextHeight + 6) > availableHeight) {
            break;
          }
          pageEntries.push({ ...entry, entryHeight });
          usedHeight = nextHeight;
        }
        if (!pageEntries.length) {
          addPageWithFooter();
          continue;
        }
        const boxHeight = Math.max(36, noteCardPadding + noteTitleHeight + 4 + usedHeight + 6);
        doc.rect(leftX, y, leftColumnWidth, boxHeight).strokeColor(line).lineWidth(borderWidth).stroke();
        doc.font("Helvetica-Bold").fontSize(9.2).fillColor(accent).text(title, leftX + noteCardPadding, y + noteCardPadding, {
          width: leftColumnWidth - (noteCardPadding * 2),
          lineBreak: false
        });
        let lineY = y + noteCardPadding + noteTitleHeight;
        pageEntries.forEach((entry) => {
          doc.font("Helvetica").fontSize(notesContentFontSize).fillColor(dark).text(`${entry.prefix}${entry.text}`, leftX + noteCardPadding, lineY, {
            width: leftColumnWidth - (noteCardPadding * 2),
            lineGap: 1
          });
          lineY += entry.entryHeight;
        });
        y += boxHeight + noteSectionGap;
        remainingEntries = remainingEntries.slice(pageEntries.length);
        if (remainingEntries.length) {
          addPageWithFooter();
        }
      }
    };

    const termsEntries = showTerms ? flattenSectionEntries(termsRichText || plainTextToRichText(termsText)) : [];
    const notesEntries = showNotes ? flattenSectionEntries(notesRichText || plainTextToRichText(notesText)) : [];

    if (termsEntries.length) {
      renderSectionLines("Terms & Conditions", termsEntries);
    }

    if (shouldShowBankDetailsSection) {
      const bankEntries = [
        { prefix: "", text: `Bank: ${seller?.bank_name}` },
        { prefix: "", text: `Branch: ${seller?.bank_branch}` },
        { prefix: "", text: `A/C: ${seller?.bank_account_no}` },
        { prefix: "", text: `IFSC: ${seller?.bank_ifsc}` }
      ];
      renderSectionLines("Bank Details", bankEntries);
    }

    if (notesEntries.length) {
      renderSectionLines("Notes", notesEntries);
    }

    drawFooterForCurrentPage();

    doc.end();
    return;
  }

  // Legacy presets
  if (templatePreset === "executive") {
    const footerImage = imageBufferFromDataUrl(template?.show_footer_image ? template?.footer_image_data : null);
    const footerText = getPrintableFooterText(template);
    const footerRaw = footerImage ? "" : footerText;
    if (footerRaw) {
      const footerBaselineY = doc.page.height - doc.page.margins.bottom - 8;
      doc.font("Helvetica").fontSize(9).fillColor(accent).text(toSingleLinePdfValue(footerRaw, 140), leftX, footerBaselineY - 2, {
        width: pageWidth,
        align: "center",
        lineBreak: false
      });
    }
  }

  if (templatePreset === "executive_boardroom") {
    const dark = "#111827";
    const muted = "#667085";
    const light = "#98a2b3";
    const rule = "#d6d9df";
    const softRule = "#e8ecf2";
    const titleFont = "Times-Bold";
    const serifBodyFont = "Times-Roman";
    const titleBody = renderTemplateText(
      template?.body_template || "Dear {{customer_name}}, please find our commercial quotation {{quotation_number}} for your review.",
      quotation
    );
    const sellerName = template?.company_name || seller?.business_name || seller?.name || template?.header_text || "Quotation";
    const summaryRows = [
      { label: "SUB TOTAL", value: `Rs ${Number(quotation.subtotal || quotation.total_amount || 0).toLocaleString("en-IN")}` },
      ...(Number(quotation.discount_amount || 0) ? [{ label: "-DISCOUNT", value: `Rs ${Number(quotation.discount_amount || 0).toLocaleString("en-IN")}` }] : []),
      ...(Number(quotation.gst_amount || quotation.tax_amount || 0) ? [{ label: "GST", value: `Rs ${Number(quotation.gst_amount || quotation.tax_amount || 0).toLocaleString("en-IN")}` }] : []),
      { label: "TOTAL AMOUNT", value: `Rs ${Number(quotation.total_amount || 0).toLocaleString("en-IN")}` },
      ...(Number(quotation.advance_amount || 0) ? [{ label: "ADVANCE AMOUNT", value: `Rs ${Number(quotation.advance_amount || 0).toLocaleString("en-IN")}` }] : []),
      { label: "BALANCE AMOUNT", value: `Rs ${Number(quotation.balance_amount || quotation.total_amount || 0).toLocaleString("en-IN")}`, strong: true }
    ];
    const detailsTop = doc.page.margins.top;

    if (headerImageBuffer) {
      try {
        doc.image(headerImageBuffer, leftX, detailsTop, { width: pageWidth, height: fullWidthHeaderHeight });
        doc.y = detailsTop + fullWidthHeaderHeight + 14;
      } catch (_error) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor(dark).text(String(sellerName).toUpperCase(), leftX, detailsTop);
        doc.font("Helvetica").fontSize(11).fillColor(muted).text("Commercial Quotation", leftX, detailsTop + 20);
        doc.y = detailsTop + 46;
      }
    } else {
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, leftX, detailsTop + 4, { fit: [104, 38], align: "left" });
        } catch (_error) {
          // Keep document rendering stable if logo data is invalid.
        }
      }
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(dark).text(String(sellerName).toUpperCase(), leftX + (logoBuffer ? 120 : 0), detailsTop + 2);
      doc.font(serifBodyFont).fontSize(12).fillColor(muted).text("Commercial Quotation", leftX + (logoBuffer ? 120 : 0), detailsTop + 18);
      doc.y = detailsTop + 50;
    }

    doc.moveTo(leftX, doc.y).lineTo(leftX + pageWidth, doc.y).strokeColor(dark).lineWidth(1.5).stroke();
    doc.moveDown(1.05);

    const headerBlockTop = doc.y;
    doc.font(titleFont).fontSize(31).fillColor(dark).text("Quotation", leftX, headerBlockTop);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(light).text("QUOTATION NO.", leftX + pageWidth - 190, headerBlockTop + 3, {
      width: 190,
      align: "right"
    });
    doc.font("Helvetica-Bold").fontSize(18).fillColor(dark).text(quotationNo, leftX + pageWidth - 190, headerBlockTop + 16, {
      width: 190,
      align: "right"
    });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(light).text("VERSION", leftX + pageWidth - 190, headerBlockTop + 46, {
      width: 190,
      align: "right"
    });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(dark).text(String(quotation.version_no || 1), leftX + pageWidth - 190, headerBlockTop + 58, {
      width: 190,
      align: "right"
    });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(light).text("DATE", leftX + pageWidth - 190, headerBlockTop + 86, {
      width: 180,
      align: "right"
    });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(dark).text(formatDateIST(quotation.created_at) || "-", leftX + pageWidth - 190, headerBlockTop + 98, {
      width: 190,
      align: "right"
    });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(light).text("DELIVERY DATE", leftX + pageWidth - 190, headerBlockTop + 126, {
      width: 190,
      align: "right"
    });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(dark).text(formatDateIST(quotation.delivery_date) || "-", leftX + pageWidth - 190, headerBlockTop + 138, {
      width: 190,
      align: "right"
    });

    const sellerBlockTop = headerBlockTop + 168;
    doc.moveTo(leftX, sellerBlockTop).lineTo(leftX + pageWidth, sellerBlockTop).strokeColor(rule).lineWidth(1).stroke();
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(light).text("ISSUED BY", leftX, sellerBlockTop + 16);
    doc.font("Helvetica-Bold").fontSize(13.5).fillColor(dark).text(template?.company_name || sellerName, leftX, sellerBlockTop + 36, {
      width: 300
    });
    doc.font("Helvetica").fontSize(10).fillColor(muted);
    const sellerLines = [
      template?.company_address,
      (template?.company_phone || quotation?.seller_mobile) ? `Contact: ${template?.company_phone || quotation?.seller_mobile}` : null,
      template?.company_email ? `Email: ${template.company_email}` : null
    ].filter(Boolean);
    let sellerLineY = sellerBlockTop + 58;
    sellerLines.forEach((line) => {
      doc.text(line, leftX, sellerLineY, { width: 340 });
      sellerLineY += 15;
    });

    const issuedToX = leftX + 390;
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(light).text("ISSUED TO", issuedToX, sellerBlockTop + 16);
    doc.font("Helvetica-Bold").fontSize(13.5).fillColor(dark).text(customerName, issuedToX, sellerBlockTop + 36, { width: 300 });
    doc.font("Helvetica").fontSize(10).fillColor(muted);
    const customerLines = [
      quotation.mobile ? `Mobile: ${quotation.mobile}` : null,
      quotation.delivery_address || null,
      quotation.delivery_type ? `Delivery Type: ${quotation.delivery_type}` : null
    ].filter(Boolean);
    let customerLineY = sellerBlockTop + 58;
    customerLines.forEach((line) => {
      doc.text(line, issuedToX, customerLineY, { width: 320 });
      customerLineY += 15;
    });

    let y = sellerBlockTop + 122;
    doc.moveTo(leftX, y).lineTo(leftX + pageWidth, y).strokeColor(rule).lineWidth(1).stroke();
    y += 20;
    if (titleBody && titleBody.trim()) {
      doc.font(serifBodyFont).fontSize(12).fillColor(dark).text(titleBody, leftX, y, {
        width: pageWidth - 90,
        lineGap: 4,
        align: "left"
      });
      y = doc.y + 24;
    }

    doc.moveTo(leftX, y).lineTo(leftX + pageWidth, y).strokeColor(dark).lineWidth(1.5).stroke();
    y += 16;
    doc.font(titleFont).fontSize(19).fillColor(dark).text("Scope & Commercials", leftX, y);
    y += 34;

    const getBoardroomWeight = (key) => {
      switch (normalizeQuotationColumnKey(key)) {
        case "material_name":
          return 4.2;
        case "amount":
        case "total":
        case "total_rate":
        case "total_price":
          return 1.6;
        case "rate":
        case "unit_price":
          return 1.3;
        case "quantity":
        case "unit":
        case "uom":
        case "unit_type":
          return 1.1;
        default:
          return 1.25;
      }
    };

    const tableColumns = [
      { key: "sr_no", label: "SR.", width: 44, align: "center" },
      ...configuredColumns.map((column) => ({
        ...column,
        align: getPdfColumnAlignment(column.key)
      }))
    ];
    const dynamicColumns = tableColumns.slice(1);
    const totalWeight = dynamicColumns.reduce((sum, column) => sum + getBoardroomWeight(column.key), 0) || 1;
    const dynamicWidth = pageWidth - tableColumns[0].width;
    dynamicColumns.forEach((column) => {
      column.width = Math.max(68, Math.floor((dynamicWidth * getBoardroomWeight(column.key)) / totalWeight));
    });
    const allocated = tableColumns.reduce((sum, column) => sum + column.width, 0);
    if (allocated !== pageWidth) {
      tableColumns[tableColumns.length - 1].width += pageWidth - allocated;
    }

    let x = leftX;
    tableColumns.forEach((column) => {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(light).text(column.label, x + 4, y, {
        width: column.width - 8,
        align: column.align,
        lineBreak: false
      });
      x += column.width;
    });
    y += 15;
    doc.moveTo(leftX, y).lineTo(leftX + pageWidth, y).strokeColor(dark).lineWidth(1.5).stroke();
    y += 14;

    items.forEach((item, index) => {
      const helpingText = getHelpingTextEntries(item, visiblePdfColumns, {
        combineHelpingTextInItemColumn,
        pdfNumberFormat
      }).map((entry) => `${entry.label}: ${entry.value}`).join(", ");
      const rowHeight = helpingText ? 58 : 34;
      if (y > doc.page.height - doc.page.margins.bottom - 190) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      let rowX = leftX;
      const rowValues = [
        String(index + 1),
        ...configuredColumns.map((column) => String(getQuotationPdfColumnValue(item, column.key, { combineHelpingTextInItemColumn, pdfNumberFormat }) || "-"))
      ];
      rowValues.forEach((value, valueIndex) => {
        const column = tableColumns[valueIndex];
        const isItemColumn = valueIndex > 0 && normalizeQuotationColumnKey(tableColumns[valueIndex].key) === "material_name";
        doc.fillColor(dark).font(isItemColumn ? "Helvetica-Bold" : "Helvetica").fontSize(10.5).text(
          toSingleLinePdfValue(value, isItemColumn ? 58 : 22),
          rowX + 4,
          y + 2,
          {
            width: column.width - 8,
            align: column.align,
            lineBreak: false
          }
        );
        rowX += column.width;
      });
      if (helpingText) {
        let itemX = leftX + tableColumns[0].width;
        const itemWidth = tableColumns[1]?.width || 260;
        doc.fillColor(muted).font("Helvetica").fontSize(8.3).text(toSingleLinePdfValue(helpingText, 120), itemX + 4, y + 24, {
          width: itemWidth - 8,
          lineBreak: false
        });
      }
      y += rowHeight;
      doc.moveTo(leftX, y).lineTo(leftX + pageWidth, y).strokeColor(softRule).lineWidth(1).stroke();
      y += 10;
    });

    y += 22;
    summaryRows.forEach((row, index) => {
      const value = typeof row.value === "number" ? `Rs ${Number(row.value || 0).toLocaleString("en-IN")}` : row.value;
      doc.font("Helvetica-Bold").fontSize(row.strong ? 10 : 8.5).fillColor(row.strong ? dark : light).text(row.label, leftX + pageWidth - 290, y + (index * 34), {
        width: 150,
        lineBreak: false
      });
      doc.font(row.strong ? "Helvetica-Bold" : "Helvetica").fontSize(row.strong ? 18 : 11).fillColor(dark).text(value, leftX + pageWidth - 120, y + (index * 34) - (row.strong ? 3 : 0), {
        width: 120,
        align: "right",
        lineBreak: false
      });
    });
    y += summaryRows.length * 34 + 30;

    const sections = [
      ...(showNotes ? [{ title: "Notes", body: notesText }] : []),
      ...(showTerms ? [{ title: "Terms & Conditions", body: termsText }] : [])
    ];
    sections.forEach((section) => {
      if (y > doc.page.height - doc.page.margins.bottom - 100) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      doc.moveTo(leftX, y).lineTo(leftX + pageWidth, y).strokeColor(rule).lineWidth(1).stroke();
      y += 20;
      doc.font(titleFont).fontSize(16.5).fillColor(dark).text(section.title, leftX, y);
      y += 24;
      doc.font("Helvetica").fontSize(10.2).fillColor(muted).text(section.body, leftX, y, {
        width: pageWidth - 240,
        lineGap: 4
      });
      y = Math.max(doc.y + 26, y + 64);
    });

    const signatureY = Math.min(y, doc.page.height - doc.page.margins.bottom - 78);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(light).text("AUTHORIZED BY", leftX + pageWidth - 180, signatureY);
    doc.moveTo(leftX + pageWidth - 180, signatureY + 32).bezierCurveTo(
      leftX + pageWidth - 150, signatureY - 6,
      leftX + pageWidth - 112, signatureY + 58,
      leftX + pageWidth - 66, signatureY + 12
    ).strokeColor(dark).lineWidth(2).stroke();
    doc.font("Helvetica").fontSize(10.2).fillColor(dark).text(template?.company_name || sellerName, leftX + pageWidth - 180, signatureY + 54, {
      width: 180
    });
    doc.end();
    return;
  }

  if (templatePreset === "industrial_invoice") {
    const contentLeft = 3;
    const contentTop = 3;
    const contentWidth = doc.page.width - 6;
    const ink = "#1f2c63";
    const teal = "#0f9f9b";
    const dark = "#111827";
    const muted = "#4b5563";
    const line = "#cfd6e1";
    const customerName = quotation.firm_name || quotation.customer_name || "Customer";
    const sellerName = template?.company_name || seller?.business_name || seller?.name || template?.header_text || "Quotation";
    const companyAddressLines = String(template?.company_address || "-").split(/\r?\n/).filter(Boolean);
    const metaTop = contentTop;

    if (headerImageBuffer) {
      try {
        doc.image(headerImageBuffer, contentLeft, metaTop, { width: contentWidth, height: fullWidthHeaderHeight });
        doc.y = metaTop + fullWidthHeaderHeight + 12;
      } catch (_error) {
        doc.font("Helvetica-Bold").fontSize(28).fillColor(ink).text(String(sellerName).toUpperCase(), contentLeft, metaTop);
        doc.y = metaTop + 42;
      }
    } else {
      doc.font("Helvetica-Bold").fontSize(28).fillColor(ink).text(String(sellerName).toUpperCase(), contentLeft, metaTop);
      if (getPrintableFooterText(template)) {
        doc.save();
        doc.rect(contentLeft, metaTop + 40, contentWidth - 160, 28).fill(teal);
        doc.restore();
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff").text(getPrintableFooterText(template), contentLeft + 10, metaTop + 48, {
          width: contentWidth - 180,
          lineBreak: false
        });
      }
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, contentLeft + contentWidth - 140, metaTop + 4, { fit: [120, 72], align: "right" });
        } catch (_error) {
          // Keep PDF stable if logo data is invalid.
        }
      }
      doc.font("Helvetica").fontSize(9.2).fillColor(dark);
      let addressY = metaTop + 74;
      companyAddressLines.forEach((lineText) => {
        doc.text(lineText, contentLeft, addressY, { width: 250, lineGap: 1 });
        addressY += 11;
      });
      const contactX = contentLeft + contentWidth - 290;
      const contacts = [
        (template?.company_phone || quotation?.seller_mobile) ? `Tel : ${template.company_phone || quotation.seller_mobile}` : null,
        sellerName ? `Web : ${String(sellerName).toLowerCase().replace(/\s+/g, "")}.com` : null,
        template?.company_email ? `Email : ${template.company_email}` : null
      ].filter(Boolean);
      let contactY = metaTop + 76;
      contacts.forEach((lineText) => {
        doc.text(lineText, contactX, contactY, { width: 250, align: "right", lineGap: 1 });
        contactY += 11;
      });
      doc.y = Math.max(addressY, contactY) + 10;
    }

    const titleBarY = doc.y;
    doc.moveTo(contentLeft, titleBarY).lineTo(contentLeft + contentWidth, titleBarY).strokeColor(line).lineWidth(1).stroke();
    if (gstActive) {
      doc.font("Helvetica-Bold").fontSize(10).fillColor(ink).text(`GSTIN : ${quotation.gstin || template?.gstin || "-"}`, contentLeft + 8, titleBarY + 8, { lineBreak: false });
    }
    doc.font("Helvetica-Bold").fontSize(10).fillColor(ink).text("QUOTATION", contentLeft + (contentWidth / 2) - 70, titleBarY + 6, {
      width: 140,
      align: "center",
      lineBreak: false
    });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(dark).text("ORIGINAL FOR CUSTOMER", contentLeft + contentWidth - 160, titleBarY + 10, {
      width: 150,
      align: "right",
      lineBreak: false
    });
    doc.moveTo(contentLeft, titleBarY + 32).lineTo(contentLeft + contentWidth, titleBarY + 32).strokeColor(line).lineWidth(1).stroke();

    const infoTop = titleBarY + 32;
    const leftInfoWidth = 280;
    const rightInfoX = contentLeft + leftInfoWidth;
    const sectionHeaderHeight = 28;
    const leftLabelWidth = 78;
    const leftValueWidth = leftInfoWidth - leftLabelWidth - 18;
    const leftRows = [
      { label: "M/S", value: customerName || "-" },
      { label: "Address", value: quotation.delivery_address || "-" },
      { label: "Phone", value: quotation.mobile || "-" },
      { label: "Place of Supply", value: quotation.delivery_address || "-" }
    ];
    const infoPairs = [
      ["Quotation No.", quotationNo, "Date", formatDateIST(quotation.created_at) || "-"],
      ["Version", String(quotation.version_no || 1), "Delivery Date", formatDateIST(quotation.delivery_date) || "-"],
      ["Delivery Type", quotation.delivery_type || "-", "Customer Mobile", quotation.mobile || "-"],
      ["Customer", customerName, "Pincode", quotation.delivery_pincode || "-"]
    ];

    const getRowHeight = (text, width, fontName = "Helvetica", fontSize = 10) => {
      doc.font(fontName).fontSize(fontSize);
      return Math.max(14, Math.ceil(doc.heightOfString(String(text || "-"), { width })));
    };

    const leftRowsHeight = leftRows.reduce((sum, row) => sum + getRowHeight(row.value, leftValueWidth, "Helvetica", 10) + 6, 0);
    const rightRowsHeight = infoPairs.length * 22;
    const infoHeight = Math.max(134, sectionHeaderHeight + Math.max(leftRowsHeight + 10, rightRowsHeight + 14));

    doc.moveTo(rightInfoX, infoTop).lineTo(rightInfoX, infoTop + infoHeight).strokeColor(line).lineWidth(1).stroke();
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(dark).text("Customer Detail", contentLeft + 110, infoTop + 8, {
      width: 110,
      align: "center"
    });
    doc.moveTo(contentLeft, infoTop + sectionHeaderHeight).lineTo(rightInfoX, infoTop + sectionHeaderHeight).strokeColor(line).lineWidth(1).stroke();

    let leftRowY = infoTop + sectionHeaderHeight + 10;
    leftRows.forEach((row) => {
      const rowHeight = getRowHeight(row.value, leftValueWidth, "Helvetica", 10);
      doc.font("Helvetica-Bold").fontSize(9.4).fillColor(dark).text(row.label, contentLeft + 8, leftRowY, { width: leftLabelWidth, lineBreak: false });
      doc.font("Helvetica").fontSize(10).fillColor(dark).text(String(row.value || "-"), contentLeft + leftLabelWidth + 12, leftRowY, {
        width: leftValueWidth
      });
      leftRowY += rowHeight + 6;
    });

    let pairY = infoTop + 10;
    infoPairs.forEach(([leftLabel, leftValue, rightLabel, rightValue]) => {
      doc.font("Helvetica").fontSize(9.4).fillColor(dark).text(leftLabel, rightInfoX + 8, pairY, { width: 100, lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(9.8).text(toSingleLinePdfValue(leftValue, 18), rightInfoX + 106, pairY, { width: 96, lineBreak: false });
      doc.font("Helvetica").fontSize(9.4).text(rightLabel, rightInfoX + 212, pairY, { width: 106, lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(9.8).text(toSingleLinePdfValue(rightValue, 20), rightInfoX + 316, pairY, { width: 118, align: "right", lineBreak: false });
      pairY += 22;
    });
    doc.moveTo(contentLeft, infoTop + infoHeight).lineTo(contentLeft + contentWidth, infoTop + infoHeight).strokeColor(line).lineWidth(1).stroke();

    let y = infoTop + infoHeight + 18;
    const configured = configuredColumns.length ? configuredColumns : [
      { key: "material_name", label: "Name of Product / Service", type: "text" },
      { key: "quantity", label: "Qty", type: "number" },
      { key: "rate", label: "Rate", type: "number" },
      { key: "amount", label: "Total", type: "formula" }
    ];
    const tableColumns = [
      { key: "sr_no", label: "Sr No.", width: 38, align: "center" },
      ...configured.map((column) => ({ ...column, align: getPdfColumnAlignment(column.key) }))
    ];
    const getWeight = (key) => {
      switch (normalizeQuotationColumnKey(key)) {
        case "material_name":
          return 4.4;
        case "amount":
        case "total":
        case "total_rate":
        case "total_price":
          return 1.5;
        case "rate":
        case "unit_price":
          return 1.2;
        case "quantity":
          return 1.0;
        default:
          return 1.15;
      }
    };
    const totalWeight = configured.reduce((sum, column) => sum + getWeight(column.key), 0) || 1;
    const remainingWidth = contentWidth - tableColumns[0].width;
    configured.forEach((column, index) => {
      tableColumns[index + 1].width = Math.max(66, Math.floor((remainingWidth * getWeight(column.key)) / totalWeight));
    });
    const allocatedWidth = tableColumns.reduce((sum, column) => sum + column.width, 0);
    if (allocatedWidth !== contentWidth) {
      tableColumns[tableColumns.length - 1].width += contentWidth - allocatedWidth;
    }

    doc.rect(contentLeft, y, contentWidth, 38).strokeColor(line).lineWidth(1).stroke();
    let tableX = contentLeft;
    tableColumns.forEach((column, index) => {
      if (index > 0) {
        doc.moveTo(tableX, y).lineTo(tableX, y + 38).strokeColor(line).lineWidth(1).stroke();
      }
      doc.font("Helvetica-Bold").fontSize(8.1).fillColor(dark).text(toSingleLinePdfValue(column.label || "", 28), tableX + 4, y + 14, {
        width: column.width - 8,
        align: "center",
        lineBreak: false
      });
      tableX += column.width;
    });
    y += 38;

    items.forEach((item, index) => {
      const helping = getHelpingTextEntries(item, visiblePdfColumns, {
        combineHelpingTextInItemColumn,
        pdfNumberFormat
      }).map((entry) => `${entry.label}: ${entry.value}`).join(", ");
      const rowHeight = helping ? 44 : 28;
      if (y > doc.page.height - 6 - 170) {
        doc.addPage();
        y = contentTop + 24;
      }
      doc.rect(contentLeft, y, contentWidth, rowHeight).strokeColor(line).lineWidth(1).stroke();
      let rowX = contentLeft;
      const rowValues = [
        String(index + 1),
        ...configured.map((column) => String(getQuotationPdfColumnValue(item, column.key, { combineHelpingTextInItemColumn: false, pdfNumberFormat }) || "-"))
      ];
      rowValues.forEach((value, valueIndex) => {
        const column = tableColumns[valueIndex];
        if (valueIndex > 0) {
          doc.moveTo(rowX, y).lineTo(rowX, y + rowHeight).strokeColor(line).lineWidth(1).stroke();
        }
        const normalizedKey = valueIndex > 0 ? normalizeQuotationColumnKey(tableColumns[valueIndex].key) : "";
        const isItem = normalizedKey === "material_name";
        doc.font(isItem ? "Helvetica-Bold" : "Helvetica").fontSize(10.2).fillColor(dark).text(
          toSingleLinePdfValue(value, isItem ? 60 : 18),
          rowX + 4,
          y + 7,
          {
            width: column.width - 8,
            align: column.align,
            lineBreak: false
          }
        );
        if (isItem && helping) {
          doc.font("Helvetica-Oblique").fontSize(7.6).fillColor(muted).text(
            toSingleLinePdfValue(helping, 120),
            rowX + 4,
            y + 20,
            {
              width: column.width - 8,
              lineBreak: false
            }
          );
        }
        rowX += column.width;
      });
      y += rowHeight;
    });

    y += 20;
    const footerGap = 10;
    const leftLowerWidth = Math.floor(contentWidth * 0.68);
    const rightLowerX = contentLeft + leftLowerWidth + footerGap;
    const rightLowerWidth = contentWidth - leftLowerWidth - footerGap;
    const sectionGap = 8;
    const cardPadding = 8;
    const titleBandHeight = 28;
    const minCardHeight = 42;
    const pageGuard = 14;

    const measureSimpleCellHeight = (width, title, bodyLines = []) => {
      let total = cardPadding * 2;
      if (title) total += titleBandHeight;
      bodyLines.forEach((lineItem) => {
        if (typeof lineItem === "string") {
          total += doc.heightOfString(lineItem, {
            width: width - 16,
            lineGap: 1,
            size: 9.2
          }) + 3;
          return;
        }
        const labelWidth = lineItem.labelWidth || Math.floor(width * 0.6);
        const valueHeight = doc.heightOfString(String(lineItem.value || "-"), {
          width: width - labelWidth - 16,
          size: lineItem.valueSize || 9.2
        });
        total += Math.max(valueHeight, lineItem.spacing || 14);
      });
      return Math.max(minCardHeight, Math.ceil(total));
    };

    const drawSimpleCell = (x, top, width, height, title, bodyLines = [], options = {}) => {
      doc.rect(x, top, width, height).strokeColor(line).lineWidth(1).stroke();
      if (title) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor(dark).text(title, x + 8, top + 8, {
          width: width - 16,
          align: options.titleAlign || "center",
          lineBreak: false
        });
        doc.moveTo(x, top + titleBandHeight).lineTo(x + width, top + titleBandHeight).strokeColor(line).lineWidth(1).stroke();
      }
      let textY = top + (title ? titleBandHeight + 8 : 10);
      bodyLines.forEach((lineItem) => {
        if (typeof lineItem === "string") {
          doc.font("Helvetica").fontSize(9.2).fillColor(dark).text(lineItem, x + 8, textY, {
            width: width - 16,
            lineGap: 1
          });
          textY = doc.y + 3;
          return;
        }
        const labelWidth = lineItem.labelWidth || Math.floor(width * 0.6);
        const valueX = x + labelWidth + 8;
        doc.font("Helvetica-Bold").fontSize(lineItem.labelSize || 8.2).fillColor(dark).text(lineItem.label, x + 8, textY, {
          width: labelWidth - 12,
          lineBreak: false
        });
        doc.font(lineItem.strong ? "Helvetica-Bold" : "Helvetica").fontSize(lineItem.valueSize || 9.2).text(lineItem.value, valueX, textY, {
          width: width - labelWidth - 16,
          align: lineItem.align || "left"
        });
        textY += lineItem.spacing || 14;
      });
    };

    const measureRichCellHeight = (width, title, html) => {
      const bodyHeight = measureRichTextPdfHeight(doc, html, {
        width: width - 16,
        fontSize: 7,
        lineGap: 1,
        blockGap: 4,
        listIndent: 14
      });
      return Math.max(minCardHeight, Math.ceil(cardPadding + titleBandHeight + bodyHeight + 8));
    };

    const drawRichCell = (x, top, width, height, title, html) => {
      doc.rect(x, top, width, height).strokeColor(line).lineWidth(1).stroke();
      doc.font("Helvetica-Bold").fontSize(10).fillColor(dark).text(title, x + 8, top + 8, {
        width: width - 16,
        align: "center",
        lineBreak: false
      });
      doc.moveTo(x, top + titleBandHeight).lineTo(x + width, top + titleBandHeight).strokeColor(line).lineWidth(1).stroke();
      doc.y = top + titleBandHeight + 8;
      renderRichTextPdf(doc, html, {
        x: x + 8,
        width: width - 16,
        fontSize: 7,
        lineGap: 1,
        blockGap: 4,
        listIndent: 14,
        bulletGap: 10,
        color: dark
      });
    };

    const ensureFooterSpace = (requiredHeight) => {
      if (y + requiredHeight + pageGuard > doc.page.height - 6) {
        doc.addPage();
        y = contentTop + 24;
      }
    };

    const totalInWords = amountToWordsIndian(quotation.balance_amount || quotation.total_amount || 0);
    const pdfTaxAmount = Number(quotation.tax_amount || 0);
    const taxSummaryRows = [
      { label: "Taxable Amount", value: `${Number(quotation.total_amount || 0).toLocaleString("en-IN")}`, labelWidth: 154, labelSize: 7.9, valueSize: 8.9, spacing: 13 },
      ...(pdfTaxAmount > 0
        ? [
            { label: "Add : GST", value: `${pdfTaxAmount.toLocaleString("en-IN")}`, labelWidth: 154, labelSize: 7.9, valueSize: 8.9, spacing: 13 },
            { label: "Total Tax", value: `${pdfTaxAmount.toLocaleString("en-IN")}`, labelWidth: 154, labelSize: 7.9, valueSize: 8.9, spacing: 13 }
          ]
        : []),
      { label: "Total Amount After Tax", value: `Rs ${Number((quotation.total_amount || 0) + pdfTaxAmount).toLocaleString("en-IN")}`, strong: true, spacing: 15, labelWidth: 176, labelSize: 7.2, valueSize: 9.1 }
    ];
    const totalWordsHeight = measureSimpleCellHeight(leftLowerWidth, "Total in words", [totalInWords]);
    const taxSummaryHeight = measureSimpleCellHeight(rightLowerWidth, "", taxSummaryRows);
    const topRowHeight = Math.max(totalWordsHeight, taxSummaryHeight);
    ensureFooterSpace(topRowHeight);
    drawSimpleCell(contentLeft, y, leftLowerWidth, topRowHeight, "Total in words", [totalInWords], { titleAlign: "center" });
    drawSimpleCell(rightLowerX, y, rightLowerWidth, topRowHeight, "", taxSummaryRows);
    y += topRowHeight + sectionGap;

    const leftSections = [];
    if (showTerms) {
      leftSections.push({
        title: "Terms and Conditions",
        html: termsRichText || plainTextToRichText(termsText)
      });
    }
    if (showNotes) {
      leftSections.push({
        title: "Notes",
        html: notesRichText || plainTextToRichText(notesText)
      });
    }

    const rightSections = [
      {
        title: "GST Payable on Reverse Charge",
        bodyLines: [
          { label: "", value: "N.A.", strong: true, align: "right", spacing: 18 },
          "Certified that the particulars given above are true and correct.",
          { label: "", value: `For ${toSingleLinePdfValue(sellerName, 32)}`, strong: true, align: "center", spacing: 18, valueSize: 8.8 }
        ],
        options: { titleAlign: "left" }
      },
      {
        title: "",
        bodyLines: [
          "This is computer generated quotation.",
          "No signature required.",
          { label: "", value: "Authorised Signatory", strong: true, align: "center", spacing: 22, valueSize: 8.5 }
        ],
        options: {}
      }
    ];

    let leftIndex = 0;
    let rightIndex = 0;
    let leftY = y;
    let rightY = y;

    while (leftIndex < leftSections.length || rightIndex < rightSections.length) {
      let drewOnPage = false;

      if (leftIndex < leftSections.length) {
        const section = leftSections[leftIndex];
        const leftHeight = measureRichCellHeight(leftLowerWidth, section.title, section.html);
        if (leftY + leftHeight + pageGuard <= doc.page.height - 6) {
          drawRichCell(contentLeft, leftY, leftLowerWidth, leftHeight, section.title, section.html);
          leftY += leftHeight + sectionGap;
          leftIndex += 1;
          drewOnPage = true;
        }
      }

      if (rightIndex < rightSections.length) {
        const rightSection = rightSections[rightIndex];
        const rightHeight = measureSimpleCellHeight(rightLowerWidth, rightSection.title, rightSection.bodyLines);
        if (rightY + rightHeight + pageGuard <= doc.page.height - 6) {
          drawSimpleCell(rightLowerX, rightY, rightLowerWidth, rightHeight, rightSection.title, rightSection.bodyLines, rightSection.options || {});
          rightY += rightHeight + sectionGap;
          rightIndex += 1;
          drewOnPage = true;
        }
      }

      if (!drewOnPage) {
        doc.addPage();
        leftY = contentTop + 24;
        rightY = contentTop + 24;
      }
    }

    y = Math.max(leftY, rightY);

    if (showBankDetails) {
      const bankLines = [
        { label: "Bank Name", value: seller?.bank_name || "State Bank of India" },
        { label: "Branch Name", value: seller?.bank_branch || "Main Branch" },
        { label: "Bank Account Number", value: seller?.bank_account_no || "2000000004512" },
        { label: "Bank Branch IFSC", value: seller?.bank_ifsc || "SBIN0000488" }
      ];
      const bankHeight = measureSimpleCellHeight(contentWidth, "Bank Details", bankLines);
      ensureFooterSpace(bankHeight);
      drawSimpleCell(contentLeft, y, contentWidth, bankHeight, "Bank Details", bankLines, { titleAlign: "center" });
      y += bankHeight + sectionGap;
    }
    doc.end();
    return;
  }

  if (templatePreset === "commercial_offer") {
    if (headerImageBuffer) {
      try {
        doc.image(headerImageBuffer, leftX, doc.y, { width: pageWidth, height: fullWidthHeaderHeight });
        doc.y += fullWidthHeaderHeight + 14;
      } catch (_error) {
        doc.font("Helvetica-Bold").fontSize(18).fillColor(accent).text(template?.header_text || "Commercial Offer", { align: "left" });
      }
    } else {
      doc.font("Helvetica-Bold").fontSize(18).fillColor(accent).text(template?.header_text || "Commercial Offer", { align: "left" });
    }
    doc.moveDown(0.8);
    doc.font("Helvetica").fontSize(11).fillColor("#111827");
    doc.text(`Quotation No: ${quotationNo}`);
    doc.text(`Version: ${quotation.version_no || 1}`);
    doc.text(`Date: ${formatDateIST(quotation.created_at) || "-"}`);
    doc.text(`Customer: ${customerName}`);
    doc.text(`Mobile: ${quotation.mobile || "-"}`);
    doc.text(`Delivery Type: ${quotation.delivery_type || "-"}`);
    doc.text(`Delivery Date: ${formatDateIST(quotation.delivery_date) || "-"}`);
    if (bodyCopy && bodyCopy.trim()) {
      doc.moveDown(0.6);
      doc.font("Helvetica").fontSize(10).fillColor("#374151").text(bodyCopy, {
        width: pageWidth,
        lineGap: 2,
        align: "left"
      });
    }
    doc.moveDown(1);
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12).text("Items");
    doc.moveDown(0.4);
    items.forEach((item, index) => {
      const itemTitle = getQuotationItemTitle(item) || getQuotationItemPrimaryName(item) || "-";
      const qty = Number(getQuotationItemQuantityValue(item) || 0).toLocaleString("en-IN");
      const rate = Number(getQuotationItemRateValue(item) || 0).toLocaleString("en-IN");
      const amount = Number(getQuotationItemTotalValue(item) || 0).toLocaleString("en-IN");
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(`${index + 1}. ${itemTitle}`);
      doc.font("Helvetica").fontSize(10).text(`Qty: ${qty}    Rate: Rs ${rate}    Amount: Rs ${amount}`);
      doc.moveDown(0.35);
    });
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(11).text(`Total Amount: Rs ${Number(quotation.total_amount || 0).toLocaleString("en-IN")}`);
    if (Number(quotation.discount_amount || 0)) {
      doc.font("Helvetica").fontSize(10).text(`Discount: Rs ${Number(quotation.discount_amount || 0).toLocaleString("en-IN")}`);
    }
    if (Number(quotation.advance_amount || 0)) {
      doc.font("Helvetica").fontSize(10).text(`Advance: Rs ${Number(quotation.advance_amount || 0).toLocaleString("en-IN")}`);
    }
    doc.font("Helvetica-Bold").fontSize(11).text(`Balance Amount: Rs ${Number(quotation.balance_amount || quotation.total_amount || 0).toLocaleString("en-IN")}`);
    if (showBankDetails) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(10).text("Bank Details");
      doc.font("Helvetica").fontSize(9.5).text(`Bank: ${seller?.bank_name || "-"}`);
      doc.font("Helvetica").fontSize(9.5).text(`Branch: ${seller?.bank_branch || "-"}`);
      doc.font("Helvetica").fontSize(9.5).text(`A/C: ${seller?.bank_account_no || "-"}`);
      doc.font("Helvetica").fontSize(9.5).text(`IFSC: ${seller?.bank_ifsc || "-"}`);
    }
    if (showNotes) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(10).text("Notes");
      renderRichTextPdf(doc, notesRichText || plainTextToRichText(notesText), {
        x: leftX,
        width: pageWidth,
        fontSize: 9.5,
        color: "#111827"
      });
    }
    if (showTerms) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(10).text("Terms");
      renderRichTextPdf(doc, termsRichText || plainTextToRichText(termsText), {
        x: leftX,
        width: pageWidth,
        fontSize: 9.5,
        color: "#111827"
      });
    }
    doc.end();
    return;
  }

  const lineColor = "#d7dee9";
  const muted = "#6b7280";
  const dark = "#111827";
  const cardFill = "#f8fafc";
  const headerTop = doc.y;
  if (headerImageBuffer) {
    try {
      doc.image(headerImageBuffer, leftX, headerTop, { width: pageWidth, height: fullWidthHeaderHeight });
      doc.y = headerTop + fullWidthHeaderHeight;
    } catch (_error) {
      // Ignore invalid header image data and continue with text-based header.
    }
  } else if (logoBuffer) {
    try {
      doc.image(logoBuffer, leftX, headerTop, { fit: [120, 56], align: "left" });
    } catch (_error) {
      // Ignore invalid logo data and keep document generation stable.
    }
  }

  if (!headerImageBuffer) {
    doc.fillColor(accent).font("Helvetica-Bold").fontSize(24).text(template?.header_text || "Quotation", rightX, headerTop, {
      width: 190,
      align: "right"
    });
    doc.fillColor(muted).font("Helvetica").fontSize(9).text(template?.company_address || "-", rightX, headerTop + 28, {
      width: 190,
      align: "right"
    });
    doc.text(`Phone: ${companyPhone || "-"}`, rightX, doc.y + 2, { width: 190, align: "right" });
    doc.text(`Email: ${template?.company_email || "-"}`, rightX, doc.y + 2, { width: 190, align: "right" });
  }

  const metaTop = Math.max(headerTop + (headerImageBuffer ? fullWidthHeaderHeight + 14 : 70), doc.y + 12);
  doc.save();
  doc.roundedRect(leftX, metaTop, pageWidth, 64, 8).fillAndStroke(cardFill, lineColor);
  doc.restore();
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(10).text("Quotation Details", leftX + 14, metaTop + 10);
  doc.font("Helvetica").fontSize(9.5);
  doc.text(`Quotation No: ${quotationNo}`, leftX + 14, metaTop + 28);
  doc.text(`Version: ${quotation.version_no || 1}`, leftX + 14, metaTop + 43);
  doc.text(`Date: ${formatDateIST(quotation.created_at) || "-"}`, leftX + 220, metaTop + 28);
  doc.text(`Delivery Date: ${formatDateIST(quotation.delivery_date) || "-"}`, leftX + 220, metaTop + 43);

  const billTop = metaTop + 82;
  const cardWidth = (pageWidth - 14) / 2;
  const cardGap = 14;
  const cardPadding = 12;
  const titleOffset = 10;
  const contentStartOffset = 28;
  const lineSpacing = 4;
  const leftContentWidth = cardWidth - (cardPadding * 2);
  const rightContentWidth = cardWidth - (cardPadding * 2);

  const leftRows = [
    customerName || "-",
    `Mobile: ${quotation.mobile || "-"}`,
    customerAddress || "-"
  ];
  const rightRows = [
    `Delivery Type: ${quotation.delivery_type || "-"}`,
    `Pincode: ${quotation.delivery_pincode || "-"}`,
    template?.footer_text || "Thank you for your business."
  ];
  const getRowsHeight = (rows, width) => rows.reduce((sum, rowText) => (
    sum + Math.max(12, Math.ceil(doc.heightOfString(String(rowText || "-"), { width }))) + lineSpacing
  ), 0);
  const leftRowsHeight = getRowsHeight(leftRows, leftContentWidth);
  const rightRowsHeight = getRowsHeight(rightRows, rightContentWidth);
  const billCardHeight = Math.max(92, contentStartOffset + Math.max(leftRowsHeight, rightRowsHeight) + cardPadding);

  doc.save();
  doc.roundedRect(leftX, billTop, cardWidth, billCardHeight, 8).fillAndStroke("#ffffff", lineColor);
  doc.roundedRect(leftX + cardWidth + cardGap, billTop, cardWidth, billCardHeight, 8).fillAndStroke("#ffffff", lineColor);
  doc.restore();

  doc.fillColor(dark).font("Helvetica-Bold").fontSize(10).text("Bill To", leftX + cardPadding, billTop + titleOffset);
  doc.font("Helvetica").fontSize(9.5);
  let leftRowY = billTop + contentStartOffset;
  leftRows.forEach((rowText) => {
    const rowHeight = Math.max(12, Math.ceil(doc.heightOfString(String(rowText || "-"), { width: leftContentWidth })));
    doc.text(String(rowText || "-"), leftX + cardPadding, leftRowY, { width: leftContentWidth });
    leftRowY += rowHeight + lineSpacing;
  });

  const rightCardX = leftX + cardWidth + cardGap;
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(10).text("Supply / Dispatch", rightCardX + cardPadding, billTop + titleOffset);
  doc.font("Helvetica").fontSize(9.5);
  let rightRowY = billTop + contentStartOffset;
  rightRows.forEach((rowText) => {
    const rowHeight = Math.max(12, Math.ceil(doc.heightOfString(String(rowText || "-"), { width: rightContentWidth })));
    doc.text(String(rowText || "-"), rightCardX + cardPadding, rightRowY, { width: rightContentWidth });
    rightRowY += rowHeight + lineSpacing;
  });

  let y = billTop + billCardHeight + 16;
  if (bodyCopy && bodyCopy.trim()) {
    doc.fillColor(muted).font("Helvetica").fontSize(9.5).text(bodyCopy, leftX, y, {
      width: pageWidth,
      lineGap: 2,
      align: "left"
    });
    y = doc.y + 12;
  }

  const getColumnWeight = (key) => {
    switch (normalizeQuotationColumnKey(key)) {
      case "material_name":
      case "note":
      case "item_note":
        return 3.2;
      case "amount":
      case "total":
      case "total_rate":
      case "total_price":
        return 1.5;
      case "rate":
      case "unit_price":
      case "dimension":
        return 1.3;
      case "quantity":
        return 0.9;
      default:
        return 1.1;
    }
  };
  const weights = configuredColumns.map((column) => getColumnWeight(column.key));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
  const serialWidth = 34;
  const availableDynamicWidth = pageWidth - serialWidth;
  const minimumColumnWidth = configuredColumns.length > 6 ? 44 : 60;
  const tableColumns = [
    { key: "sr_no", label: "Sr.", width: serialWidth, align: "center" },
    ...configuredColumns.map((column, index) => ({
      ...column,
      width: Math.max(minimumColumnWidth, Math.floor((availableDynamicWidth * weights[index]) / totalWeight)),
      align: getPdfColumnAlignment(column.key)
    }))
  ];
  let allocatedWidth = tableColumns.reduce((sum, column) => sum + column.width, 0);
  if (allocatedWidth !== pageWidth) {
    tableColumns[tableColumns.length - 1].width += pageWidth - allocatedWidth;
  }

  const drawHeader = (top) => {
    let x = leftX;
    doc.save();
    doc.rect(leftX, top, pageWidth, 24).fill(accent);
    doc.restore();
    tableColumns.forEach((column) => {
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9).text(column.label, x + 6, top + 7, {
        width: column.width - 12,
        align: column.align,
        lineBreak: false
      });
      x += column.width;
    });
  };

  drawHeader(y);
  y += 24;

  items.forEach((item, index) => {
    const helpingText = getHelpingTextEntries(item, visiblePdfColumns, {
      combineHelpingTextInItemColumn,
      pdfNumberFormat
    })
      .map((entry) => `${entry.label}: ${entry.value}`)
      .join(", ");
    const itemColumnIndex = tableColumns.findIndex((column) => normalizeQuotationColumnKey(column.key) === "material_name");
    const rowHeight = helpingText ? 42 : 30;
    if (y > doc.page.height - doc.page.margins.bottom - 150) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader(y);
      y += 24;
    }
    let x = leftX;
    doc.save();
    doc.rect(leftX, y, pageWidth, rowHeight).stroke(lineColor);
    doc.restore();
    const rowValues = [
      String(index + 1),
      ...configuredColumns.map((column) => String(getQuotationPdfColumnValue(item, column.key, { combineHelpingTextInItemColumn, pdfNumberFormat }) || "-"))
    ];
    rowValues.forEach((value, valueIndex) => {
      const column = tableColumns[valueIndex];
      doc.fillColor(dark).font(valueIndex === itemColumnIndex ? "Helvetica-Bold" : "Helvetica").fontSize(9.5).text(value, x + 6, y + 10, {
        width: column.width - 12,
        align: column.align,
        lineBreak: false
      });
      x += column.width;
    });
    if (helpingText && itemColumnIndex > 0) {
      let itemColumnX = leftX;
      for (let i = 0; i < itemColumnIndex; i += 1) itemColumnX += tableColumns[i].width;
      doc.fillColor(muted).font("Helvetica").fontSize(7.8).text(toSingleLinePdfValue(helpingText, 110), itemColumnX + 6, y + 23, {
        width: tableColumns[itemColumnIndex].width - 12,
        lineBreak: false
      });
    }
    y += rowHeight;
  });

  y += 16;
  const summaryX = leftX + pageWidth - 220;
  const summaryRows = [
    { label: "Sub Total", value: quotation.subtotal || quotation.total_amount || 0 },
    ...(Number(quotation.discount_amount || 0) ? [{ label: "-Discount", value: quotation.discount_amount || 0 }] : []),
    ...(Number(quotation.gst_amount || quotation.tax_amount || 0) ? [{ label: "GST", value: quotation.gst_amount || quotation.tax_amount || 0 }] : []),
    { label: "Total Amount", value: quotation.total_amount || 0 },
    ...(Number(quotation.advance_amount || 0) ? [{ label: "Advance Amount", value: quotation.advance_amount || 0 }] : []),
    { label: "Balance Amount", value: quotation.balance_amount || quotation.total_amount || 0, accent: true }
  ];
  summaryRows.forEach((row, index) => {
    doc.fillColor(row.accent ? accent : dark).font(row.accent ? "Helvetica-Bold" : "Helvetica").fontSize(row.accent ? 11 : 10)
      .text(row.label, summaryX, y + (index * 18), { width: 100, lineBreak: false });
    doc.text(`Rs ${Number(row.value || 0).toLocaleString("en-IN")}`, summaryX + 110, y + (index * 18), {
      width: 110,
      align: "right",
      lineBreak: false
    });
  });
  y += summaryRows.length * 18 + 18;

  const notesBlocks = [
    ...(showNotes ? [{ title: "Notes", body: notesText }] : []),
    ...(showTerms ? [{ title: "Terms & Conditions", body: termsText }] : []),
    ...(showBankDetails
      ? [{
        title: "Bank Details",
        body: `Bank: ${seller?.bank_name || "-"}\nBranch: ${seller?.bank_branch || "-"}\nA/C: ${seller?.bank_account_no || "-"}\nIFSC: ${seller?.bank_ifsc || "-"}`
      }]
      : [])
  ];
  notesBlocks.forEach((block) => {
    if (y > doc.page.height - doc.page.margins.bottom - 90) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.save();
    doc.roundedRect(leftX, y, pageWidth, 54, 8).fillAndStroke(cardFill, lineColor);
    doc.restore();
    doc.fillColor(dark).font("Helvetica-Bold").fontSize(10).text(block.title, leftX + 12, y + 10);
    doc.font("Helvetica").fontSize(9).fillColor(muted).text(block.body, leftX + 12, y + 24, {
      width: pageWidth - 24,
      height: 20,
      ellipsis: true
    });
    y += 66;
  });

  doc.end();
}

router.get("/", requirePermission(PERMISSIONS.QUOTATION_SEARCH), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const values = [];
    const where = tenantId ? "WHERE q.seller_id = $1" : "";
    if (tenantId) values.push(tenantId);

    const result = await pool.query(
      `SELECT q.*, c.name AS customer_name, c.firm_name, c.mobile, c.address AS customer_address, c.gst_number AS customer_gst_number, c.shipping_addresses AS customer_shipping_addresses, s.gst_number AS seller_gst_number, s.mobile AS seller_mobile, u.name AS created_by_name
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       LEFT JOIN sellers s ON s.id = q.seller_id
       LEFT JOIN users u ON u.id = q.created_by
       ${where}
       ORDER BY q.id DESC`,
      values
    );

    res.json(result.rows.map((row) => enrichQuotationTaxData(row)));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id/versions", requirePermission(PERMISSIONS.QUOTATION_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const versions = await getQuotationVersions(pool, id, tenantId);
    res.json(versions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/approvals", requireApprovalAccess, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const showAll = req.user.isPlatformAdmin || hasPermission(req.user, PERMISSIONS.APPROVAL_OVERRIDE);
    const values = [tenantId];
    let where = "qar.seller_id = $1";
    if (!showAll) {
      values.push(req.user.id);
      const canViewTeam = hasPermission(req.user, PERMISSIONS.APPROVAL_VIEW_TEAM);
      const canViewOwn = hasPermission(req.user, PERMISSIONS.APPROVAL_VIEW_OWN);
      if (canViewTeam && canViewOwn) {
        where += " AND (qar.assigned_approver_user_id = $2 OR qar.requested_by_user_id = $2)";
      } else if (canViewTeam) {
        where += " AND qar.assigned_approver_user_id = $2";
      } else {
        where += " AND qar.requested_by_user_id = $2";
      }
    }

    const result = await pool.query(
      `SELECT
         qar.*,
         q.approval_status AS quotation_approval_status,
         q.total_amount,
         q.version_no AS current_version_no,
         q.custom_quotation_number,
         q.seller_quotation_number,
         q.quotation_number,
         q.active_approval_request_id,
         c.name AS customer_name,
         c.firm_name,
         requester.name AS requester_name,
         approver.name AS approver_name
       FROM quotation_approval_requests qar
       INNER JOIN quotations q ON q.id = qar.quotation_id AND q.seller_id = qar.seller_id
       LEFT JOIN customers c ON c.id = q.customer_id
       LEFT JOIN users requester ON requester.id = qar.requested_by_user_id
       LEFT JOIN users approver ON approver.id = qar.assigned_approver_user_id
       WHERE ${where}
       ORDER BY
         CASE qar.status
           WHEN 'pending' THEN 1
           WHEN 'rejected' THEN 2
           WHEN 'approved' THEN 3
           WHEN 'superseded' THEN 4
           ELSE 5
         END,
         qar.created_at DESC`,
      values
    );

    const approvals = await Promise.all(result.rows.map(async (row) => ({
      ...row,
      reasons: await getApprovalRequestReasons(pool, row.id),
      is_latest_request: Number(row.active_approval_request_id || 0) === Number(row.id),
      is_superseded_view: String(row.status || "").toLowerCase() === "superseded" || Number(row.current_version_no || 0) !== Number(row.quotation_version_no || 0)
    })));

    res.json(approvals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/approvals/:approvalId", requireApprovalAccess, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const approvalId = Number(req.params.approvalId);
    if (!tenantId || !approvalId) {
      return res.status(400).json({ message: "Valid sellerId and approvalId are required" });
    }

    const showAll = req.user.isPlatformAdmin || hasPermission(req.user, PERMISSIONS.APPROVAL_OVERRIDE);
    const values = [tenantId, approvalId];
    let where = "qar.seller_id = $1 AND qar.id = $2";
    if (!showAll) {
      values.push(req.user.id);
      const canViewTeam = hasPermission(req.user, PERMISSIONS.APPROVAL_VIEW_TEAM);
      const canViewOwn = hasPermission(req.user, PERMISSIONS.APPROVAL_VIEW_OWN);
      if (canViewTeam && canViewOwn) {
        where += " AND (qar.assigned_approver_user_id = $3 OR qar.requested_by_user_id = $3)";
      } else if (canViewTeam) {
        where += " AND qar.assigned_approver_user_id = $3";
      } else {
        where += " AND qar.requested_by_user_id = $3";
      }
    }

    const result = await pool.query(
      `SELECT
         qar.*,
         q.approval_status AS quotation_approval_status,
         q.total_amount,
         q.version_no AS current_version_no,
         q.custom_quotation_number,
         q.seller_quotation_number,
         q.quotation_number,
         q.active_approval_request_id,
         q.created_at AS quotation_created_at,
         c.name AS customer_name,
         c.firm_name,
         c.mobile,
         requester.name AS requester_name,
         approver.name AS approver_name
       FROM quotation_approval_requests qar
       INNER JOIN quotations q ON q.id = qar.quotation_id AND q.seller_id = qar.seller_id
       LEFT JOIN customers c ON c.id = q.customer_id
       LEFT JOIN users requester ON requester.id = qar.requested_by_user_id
       LEFT JOIN users approver ON approver.id = qar.assigned_approver_user_id
       WHERE ${where}
       LIMIT 1`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Approval request not found" });
    }

    const approval = result.rows[0];
    const reasons = await getApprovalRequestReasons(pool, approval.id);
    const quotationItems = await getQuotationItems(pool, approval.quotation_id, tenantId);
    const latestApproval = approval.active_approval_request_id
      ? await pool.query(
        `SELECT id, status, quotation_version_no
         FROM quotation_approval_requests
         WHERE id = $1
         LIMIT 1`,
        [approval.active_approval_request_id]
      )
      : { rows: [] };

    res.json({
      approval: {
        ...approval,
        reasons,
        is_latest_request: Number(approval.active_approval_request_id || 0) === Number(approval.id),
        is_superseded_view: String(approval.status || "").toLowerCase() === "superseded" || Number(approval.current_version_no || 0) !== Number(approval.quotation_version_no || 0)
      },
      latestRequest: latestApproval.rows[0] || null,
      quotationItems
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/approvals/:approvalId/decision", requirePermission(PERMISSIONS.APPROVAL_DECIDE), async (req, res) => {
  const client = await pool.connect();
  try {
    const tenantId = getTenantId(req);
    const approvalId = Number(req.params.approvalId);
    const decision = String(req.body?.decision || "").trim().toLowerCase();
    const decisionNote = String(req.body?.decisionNote || "").trim();

    if (!tenantId || !approvalId) {
      return res.status(400).json({ message: "Valid sellerId and approvalId are required" });
    }
    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({ message: "decision must be approved or rejected" });
    }

    await client.query("BEGIN");
    const approvalResult = await client.query(
      `SELECT qar.*, q.active_approval_request_id, q.version_no AS current_version_no
       FROM quotation_approval_requests qar
       INNER JOIN quotations q ON q.id = qar.quotation_id AND q.seller_id = qar.seller_id
       WHERE qar.id = $1
         AND qar.seller_id = $2
       LIMIT 1
       FOR UPDATE`,
      [approvalId, tenantId]
    );

    if (approvalResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Approval request not found" });
    }

    const approval = approvalResult.rows[0];
    const isLatestRequest = Number(approval.active_approval_request_id || 0) === Number(approval.id);
    const isSupersededView = String(approval.status || "").toLowerCase() === "superseded" || Number(approval.current_version_no || 0) !== Number(approval.quotation_version_no || 0);
    if (isSupersededView || !isLatestRequest) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This is not the latest version of the quotation. Please review the latest PDF before approving." });
    }

    const showAll = req.user.isPlatformAdmin || req.user.permissions?.includes(PERMISSIONS.APPROVAL_OVERRIDE);
    if (!showAll && Number(approval.assigned_approver_user_id || 0) !== Number(req.user.id)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You are not assigned to decide this approval request." });
    }

    if (String(approval.status || "").toLowerCase() !== "pending") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Only pending approval requests can be decided." });
    }

    const updatedApproval = await client.query(
      `UPDATE quotation_approval_requests
       SET status = $1,
           decision_note = $2,
           approved_at = CASE WHEN $1 = 'approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,
           approved_by_user_id = CASE WHEN $1 = 'approved' THEN $3 ELSE approved_by_user_id END,
           rejected_at = CASE WHEN $1 = 'rejected' THEN CURRENT_TIMESTAMP ELSE rejected_at END,
           rejected_by_user_id = CASE WHEN $1 = 'rejected' THEN $3 ELSE rejected_by_user_id END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [decision, decisionNote || null, req.user.id, approval.id]
    );

    const quotationUpdate = await client.query(
      `UPDATE quotations
       SET approval_status = $1,
           approval_required = TRUE,
           approved_for_download_at = CASE WHEN $1 = 'approved' THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = $2 AND seller_id = $3
       RETURNING *`,
      [decision, approval.quotation_id, tenantId]
    );

    const requesterNotification = await client.query(
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
        `Quotation ${decision === "approved" ? "approved" : "rejected"}`,
        `Your quotation approval request for version ${approval.quotation_version_no} has been ${decision}.${decisionNote ? ` Note: ${decisionNote}` : ""}`,
        tenantId,
        req.user.id
      ]
    );

    if (requesterNotification.rows?.[0]?.id) {
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
          requesterNotification.rows[0].id,
          tenantId,
          `Approval request ${decision} for requester ${approval.requested_by_user_id}.`
        ]
      );
    }

    await logOrderEvent(client, {
      sellerId: tenantId,
      quotationId: approval.quotation_id,
      eventType: decision === "approved" ? "QUOTATION_APPROVED" : "QUOTATION_REJECTED",
      eventNote: decisionNote || (decision === "approved" ? "Quotation approved" : "Quotation rejected"),
      actorUserId: req.user.id
    });

    await client.query("COMMIT");
    res.json({
      approval: updatedApproval.rows[0],
      quotation: quotationUpdate.rows[0],
      message: decision === "approved" ? "Quotation approved successfully." : "Quotation rejected successfully."
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.get("/:id", requirePermission(PERMISSIONS.QUOTATION_VIEW), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    const values = [id];
    let where = "q.id = $1";
    if (tenantId) {
      where += " AND q.seller_id = $2";
      values.push(tenantId);
    }

    const quotationResult = await pool.query(
      `SELECT q.*, c.name AS customer_name, c.firm_name, c.mobile, c.address AS customer_address, c.gst_number AS customer_gst_number, c.shipping_addresses AS customer_shipping_addresses, s.gst_number AS seller_gst_number, s.mobile AS seller_mobile
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       LEFT JOIN sellers s ON s.id = q.seller_id
       WHERE ${where}`,
      values
    );

    if (quotationResult.rowCount === 0) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    const itemValues = [id];
    let itemWhere = "qi.quotation_id = $1";
    if (tenantId) {
      itemWhere += " AND qi.seller_id = $2";
      itemValues.push(tenantId);
    }

    const itemsResult = { rows: await getQuotationItems(pool, id, tenantId) };

    const activeApprovalResult = await pool.query(
      `SELECT
         qar.id,
         qar.status,
         qar.quotation_version_no,
         qar.requested_by_user_id,
         qar.assigned_approver_user_id,
         qar.decision_note,
         requester.name AS requester_name,
         approver.name AS approver_name
       FROM quotation_approval_requests qar
       LEFT JOIN users requester ON requester.id = qar.requested_by_user_id
       LEFT JOIN users approver ON approver.id = qar.assigned_approver_user_id
       WHERE qar.quotation_id = $1
         AND qar.seller_id = $2
         AND qar.id = (
           SELECT active_approval_request_id
           FROM quotations
           WHERE id = $1
             AND seller_id = $2
           LIMIT 1
         )
       LIMIT 1`,
      [id, tenantId]
    );

    const eventsValues = [id];
    let eventsWhere = "quotation_id = $1";
    if (tenantId) {
      eventsValues.push(tenantId);
      eventsWhere += " AND oe.seller_id = $2";
    }

    const eventsResult = await pool.query(
      `SELECT oe.*, u.name AS actor_name
       FROM order_events oe
       LEFT JOIN users u ON u.id = oe.actor_user_id
       WHERE ${eventsWhere}
       ORDER BY oe.id DESC`,
      eventsValues
    );

    const outstanding = await getCustomerOutstanding(quotationResult.rows[0].customer_id, quotationResult.rows[0].seller_id);

    res.json({
      quotation: enrichQuotationTaxData(quotationResult.rows[0]),
      items: itemsResult.rows,
      events: eventsResult.rows,
      customerOutstanding: outstanding,
      activeApprovalRequest: activeApprovalResult.rows[0] || null
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/:id/download", requirePermission(PERMISSIONS.QUOTATION_DOWNLOAD_PDF), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const enablePdfDebug = String(req.query.debug || "") === "1";
    const debugLogger = createPdfDebugLogger(enablePdfDebug, { quotationId: id, sellerId: tenantId });
    const perfLogger = createPdfPerfLogger({ quotationId: id, sellerId: tenantId });
    let pdfRenderer = "none";
    res.once("finish", () => perfLogger.mark(res, pdfRenderer));
    res.once("close", () => perfLogger.mark(res, `${pdfRenderer}_close`));
    debugLogger.log("route-start", `simple=${String(req.query.simple || "") === "1"}`);

    const values = [id];
    let where = "q.id = $1";
    if (tenantId) {
      values.push(tenantId);
      where += " AND q.seller_id = $2";
    }

    const quotationResult = await pool.query(
      `SELECT q.*, c.name AS customer_name, c.firm_name, c.mobile, c.address AS customer_address, c.gst_number AS customer_gst_number, c.shipping_addresses AS customer_shipping_addresses, s.gst_number AS seller_gst_number, s.mobile AS seller_mobile
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       LEFT JOIN sellers s ON s.id = q.seller_id
       WHERE ${where}
       LIMIT 1`,
      values
    );

    if (quotationResult.rowCount === 0) {
      debugLogger.log("quotation-not-found");
      return res.status(404).json({ message: "Quotation not found" });
    }

    const quotation = enrichQuotationTaxData(quotationResult.rows[0]);
    debugLogger.log("quotation-loaded", `seller=${quotation.seller_id}`);
    const useSimplePdf = String(req.query.simple || "") === "1";
    const previewMode = String(req.query.preview || "") === "1";
    const normalizedApprovalStatus = String(quotation.approval_status || "not_required").toLowerCase();
    if (!useSimplePdf && !previewMode && ["pending", "rejected"].includes(normalizedApprovalStatus)) {
      debugLogger.log("download-blocked", `approval=${normalizedApprovalStatus}`);
      return res.status(403).json({ message: `Quotation is ${normalizedApprovalStatus} for approval. Final download is blocked until approval is complete.` });
    }
    const itemsResult = await pool.query(
      `SELECT qi.*, p.material_name, pv.variant_name
       FROM quotation_items qi
       LEFT JOIN products p ON p.id = qi.product_id
       LEFT JOIN product_variants pv ON pv.id = qi.variant_id
       WHERE qi.quotation_id = $1
       ORDER BY qi.id`,
      [id]
    );
    const itemsForPdf = await applyQuotationItemDisplayConfig(pool, quotation.seller_id, itemsResult.rows);
    debugLogger.log("items-loaded", `count=${itemsForPdf.length}`);

    const template = await pool.query(
      `SELECT *
       FROM quotation_templates
       WHERE seller_id = $1 AND template_name = 'default'
       LIMIT 1`,
      [quotation.seller_id]
    );
    debugLogger.log("template-loaded", `hasTemplate=${template.rowCount > 0}`);
    const sellerResult = await pool.query(
      `SELECT id, name, business_name, mobile, gst_number, bank_name, bank_branch, bank_account_no, bank_ifsc
       FROM sellers
       WHERE id = $1
       LIMIT 1`,
      [quotation.seller_id]
    );
    const sellerRow = sellerResult.rows[0] || null;

    const tpl = template.rows[0] || {
      template_preset: "default",
      template_theme_key: "default",
      header_text: "Quotation",
      body_template: "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your review.",
      footer_text: "Thank you for your business.",
      company_phone: "",
      company_email: "",
      company_address: "",
      header_image_data: null,
      show_header_image: false,
      logo_image_data: null,
      show_logo_only: false,
      footer_image_data: null,
      show_footer_image: false,
      accent_color: "#737373",
      notes_text: "",
      terms_text: "",
      show_bank_details: true,
      show_notes: true,
      show_terms: true
    };
    const subscription = await getCurrentSubscription(pool, quotation.seller_id).catch(() => null);
    const effectiveTemplate = applyTemplateAccessPolicy(tpl, subscription);
    const pdfConfig = await getPublishedQuotationPdfConfiguration(pool, quotation.seller_id);
    const documentContext = resolveQuotationDocumentContext(quotation, {
      template: effectiveTemplate,
      seller: sellerRow,
      pdfConfig
    });
    const templateForRender = documentContext.template;
    const sellerForRender = documentContext.seller;
    const pdfConfigForRender = documentContext.pdfConfig;
    const pdfColumns = pdfConfigForRender.columns || [];
    debugLogger.log("pdf-columns-loaded", `count=${pdfColumns.length} combineHelping=${Boolean(pdfConfigForRender.modules?.combineHelpingTextInItemColumn)}`);

    const templatePreset = normalizeTemplatePreset(templateForRender.template_preset);
    if (useSimplePdf || templatePreset === "default") {
      debugLogger.log("simple-pdf-start");
      pdfRenderer = "pdfkit_simple";
      buildSimpleQuotationPdf({
        quotation,
        items: itemsForPdf,
        template: templateForRender,
        seller: sellerForRender,
        pdfColumns,
        allPdfColumns: pdfConfigForRender.allPdfColumns || pdfColumns,
        pdfModules: pdfConfigForRender.modules || {},
        res
      });
      return;
    }

    if (templatePreset === "html_puppeteer") {
      debugLogger.log("html-puppeteer-start");
      try {
        pdfRenderer = "html_puppeteer";
        await buildHtmlPuppeteerPdf({
          quotation,
          items: itemsForPdf,
          template: templateForRender,
          seller: sellerForRender,
          pdfColumns,
          allPdfColumns: pdfConfigForRender.allPdfColumns || pdfColumns,
          pdfModules: pdfConfigForRender.modules || {},
          res
        });
      } catch (richPdfError) {
        console.error("[PDF][fallback][html_puppeteer]", richPdfError);
        debugLogger.log("html-puppeteer-fallback", richPdfError.message || "unknown_error");
        if (res.headersSent) return;
        pdfRenderer = "pdfkit_simple_fallback";
        buildSimpleQuotationPdf({
          quotation,
          items: itemsForPdf,
          template: templateForRender,
          seller: sellerForRender,
          pdfColumns,
          allPdfColumns: pdfConfigForRender.allPdfColumns || pdfColumns,
          pdfModules: pdfConfigForRender.modules || {},
          res
        });
      }
      return;
    }

    try {
      pdfRenderer = "pdfkit_rich";
      buildQuotationPdf({
          quotation,
          items: itemsForPdf,
          template: templateForRender,
        pdfColumns,
        pdfModules: pdfConfigForRender.modules || {},
        res,
        debugLogger
      });
    } catch (richPdfError) {
      console.error("[PDF][fallback][rich_pdf]", richPdfError);
      debugLogger.log("rich-pdf-fallback", richPdfError.message || "unknown_error");
      if (res.headersSent) return;
      pdfRenderer = "pdfkit_simple_fallback";
      buildSimpleQuotationPdf({
        quotation,
        items: itemsForPdf,
        template: templateForRender,
        seller: sellerForRender,
        pdfColumns,
        allPdfColumns: pdfConfigForRender.allPdfColumns || pdfColumns,
        pdfModules: pdfConfigForRender.modules || {},
        res
      });
    }
  } catch (error) {
    console.error("[PDF][route-error]", error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    } else {
      try {
        res.end();
      } catch (_error) {
        // Ignore secondary stream-end failures after a PDF stream has already started.
      }
    }
  }
});

router.post("/:id/send-email", requirePermission(PERMISSIONS.QUOTATION_SEND), async (req, res) => {
  try {
    if (!isEmailConfigured()) {
      return res.status(400).json({ message: "SMTP email settings are not configured yet." });
    }

    const { id } = req.params;
    const tenantId = getTenantId(req);
    const overrideToEmail = String(req.body?.toEmail || "").trim().toLowerCase();
    const ccEmail = String(req.body?.ccEmail || "").trim().toLowerCase();

    const quotationResult = await pool.query(
      `SELECT q.*, c.name AS customer_name, c.firm_name, c.mobile, c.email AS customer_email, c.address AS customer_address, c.gst_number AS customer_gst_number, c.shipping_addresses AS customer_shipping_addresses, s.gst_number AS seller_gst_number, s.mobile AS seller_mobile
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       LEFT JOIN sellers s ON s.id = q.seller_id
       WHERE q.id = $1
         AND q.seller_id = $2
       LIMIT 1`,
      [id, tenantId]
    );

    if (quotationResult.rowCount === 0) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    const quotation = enrichQuotationTaxData(quotationResult.rows[0]);
    if (["pending", "rejected"].includes(String(quotation.approval_status || "not_required").toLowerCase())) {
      return res.status(400).json({ message: "Quotation email can be sent only after approval is complete." });
    }

    const recipientEmail = overrideToEmail || String(quotation.customer_email || "").trim().toLowerCase();
    if (!recipientEmail) {
      return res.status(400).json({ message: "Customer email is required to send quotation." });
    }

    const items = await getQuotationItems(pool, id, tenantId);
    const templateResult = await pool.query(
      `SELECT *
       FROM quotation_templates
       WHERE seller_id = $1
         AND template_name = 'default'
       LIMIT 1`,
      [quotation.seller_id]
    );
    const sellerResult = await pool.query(
      `SELECT id, name, business_name, email, mobile, gst_number, bank_name, bank_branch, bank_account_no, bank_ifsc
       FROM sellers
       WHERE id = $1
       LIMIT 1`,
      [quotation.seller_id]
    );

    const sellerRow = sellerResult.rows[0] || null;
    const template = templateResult.rows[0] || {
      template_preset: "default",
      template_theme_key: "default",
      header_text: "Quotation",
      body_template: "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your review.",
      footer_text: "Thank you for your business.",
      company_phone: "",
      company_email: "",
      company_address: "",
      header_image_data: null,
      show_header_image: false,
      logo_image_data: null,
      show_logo_only: false,
      footer_image_data: null,
      show_footer_image: false,
      accent_color: "#737373",
      notes_text: "",
      terms_text: "",
      show_bank_details: true,
      show_notes: true,
      show_terms: true
    };
    const subscription = await getCurrentSubscription(pool, quotation.seller_id).catch(() => null);
    const effectiveTemplate = applyTemplateAccessPolicy(template, subscription);
    const pdfConfig = await getPublishedQuotationPdfConfiguration(pool, quotation.seller_id);
    const documentContext = resolveQuotationDocumentContext(quotation, {
      template: effectiveTemplate,
      seller: sellerRow,
      pdfConfig
    });

    const fakeResponse = new PassThrough();
    fakeResponse.setHeader = () => {};
    const pdfBufferPromise = collectStreamBuffer(fakeResponse);
    buildSimpleQuotationPdf({
      quotation,
      items,
      template: documentContext.template,
      seller: documentContext.seller,
      pdfColumns: documentContext.pdfConfig.columns || [],
      allPdfColumns: documentContext.pdfConfig.allPdfColumns || documentContext.pdfConfig.columns || [],
      pdfModules: documentContext.pdfConfig.modules || {},
      res: fakeResponse
    });
    const pdfBuffer = await pdfBufferPromise;

    const sellerDisplayName = sellerRow?.business_name || sellerRow?.name || "Quotsy";
    const replyToEmail = String(sellerRow?.email || template?.company_email || "").trim().toLowerCase() || undefined;
    const senderName = `${sellerDisplayName} Quotations`;
    const quotationNumber = getQuotationNumberValue(quotation) || `Quotation ${quotation.id}`;
    const customerName = quotation.firm_name || quotation.customer_name || "Customer";

    const mailMessage = {
      from: `"${senderName}" <${process.env.SMTP_FROM_EMAIL}>`,
      to: recipientEmail,
      subject: `${quotationNumber} from ${sellerDisplayName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <p>Dear ${escapeHtml(customerName)},</p>
          <p>Please find attached ${escapeHtml(quotationNumber)} from ${escapeHtml(sellerDisplayName)}.</p>
          <p>Total Amount: <strong>Rs ${Number(quotation.total_amount || 0).toLocaleString("en-IN")}</strong></p>
          <p>If you have any questions, you can reply directly to this email.</p>
          <p>Regards,<br />${escapeHtml(senderName)}</p>
        </div>
      `,
      text: `Dear ${customerName},\n\nPlease find attached ${quotationNumber} from ${sellerDisplayName}.\nTotal Amount: Rs ${Number(quotation.total_amount || 0).toLocaleString("en-IN")}\n\nRegards,\n${senderName}`,
      attachments: [
        {
          filename: `${quotationFileStem(quotation)}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf"
        }
      ]
    };

    if (replyToEmail) {
      mailMessage.replyTo = replyToEmail;
    }
    if (ccEmail) {
      mailMessage.cc = ccEmail;
    }

    await sendMail(mailMessage);

    await pool.query(
      `INSERT INTO order_events (seller_id, quotation_id, event_type, event_note, actor_user_id)
       VALUES ($1, $2, 'QUOTATION_EMAIL_SENT', $3, $4)`,
      [
        tenantId,
        quotation.id,
        `Quotation emailed to ${recipientEmail}${ccEmail ? ` with CC ${ccEmail}` : ""}`,
        req.user.id
      ]
    );

    return res.json({
      message: "Quotation email sent successfully.",
      to: recipientEmail,
      cc: ccEmail || null
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get("/templates/current", requirePermission(PERMISSIONS.SETTINGS_VIEW), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const result = await pool.query(
      `SELECT qt.*, s.business_address
       FROM quotation_templates qt
       LEFT JOIN sellers s ON s.id = qt.seller_id
       WHERE qt.seller_id = $1
         AND qt.template_name = 'default'
       LIMIT 1`,
      [tenantId]
    );
    const subscription = await getCurrentSubscription(pool, tenantId).catch(() => null);
    if (!result.rows[0]) {
      return res.json(null);
    }
    const templateRow = {
      ...result.rows[0],
      company_address: String(result.rows[0].business_address || result.rows[0].company_address || "").trim(),
      notes_rich_text: getRichTextHtml(result.rows[0].notes_rich_text, result.rows[0].notes_text || ""),
      terms_rich_text: getRichTextHtml(result.rows[0].terms_rich_text, result.rows[0].terms_text || ""),
      show_bank_details: result.rows[0].show_bank_details === undefined || result.rows[0].show_bank_details === null ? true : Boolean(result.rows[0].show_bank_details),
      show_notes: result.rows[0].show_notes === undefined || result.rows[0].show_notes === null ? true : Boolean(result.rows[0].show_notes),
      show_terms: result.rows[0].show_terms === undefined || result.rows[0].show_terms === null ? true : Boolean(result.rows[0].show_terms)
    };
    return res.json(applyTemplateAccessPolicy(templateRow, subscription));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/templates/current", requirePermission(PERMISSIONS.SETTINGS_EDIT), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const {
      templatePreset,
      templateThemeKey,
      headerText,
      bodyTemplate,
      footerText,
      companyPhone,
      companyEmail,
      headerImageData,
      showHeaderImage,
      logoImageData,
      showLogoOnly,
      footerImageData,
      showFooterImage,
      accentColor,
      notesText,
      notesRichText,
      termsText,
      termsRichText,
      showBankDetails,
      showNotes,
      showTerms,
      emailEnabled,
      whatsappEnabled
    } = req.body;

    const subscription = await getCurrentSubscription(pool, tenantId).catch(() => null);
    const planTier = getSubscriptionTemplateAccessTier(subscription);
    const normalizedThemeKey = normalizeTemplateThemeKey(templateThemeKey);
    const selectedTheme = getQuotationThemeConfig(normalizedThemeKey, accentColor || null);
    if (!isThemeAccessibleForTier(selectedTheme.accessTier, planTier)) {
      return res.status(403).json({ message: "This quotation theme requires a higher plan. Please contact the sales team." });
    }

    const effectiveThemeKey = planTier === "FREE" ? "default" : normalizedThemeKey;
    const effectiveTheme = getQuotationThemeConfig(effectiveThemeKey, accentColor || null);
    const effectiveFooterImageData = planTier === "FREE" ? FIXED_FREE_FOOTER_BANNER : (footerImageData || null);
    const effectiveShowFooterImage = planTier === "FREE" ? true : Boolean(showFooterImage);
    const sellerResult = await pool.query(
      `SELECT business_address
       FROM sellers
       WHERE id = $1::int
       LIMIT 1`,
      [tenantId]
    );
    const resolvedCompanyAddress = String(sellerResult.rows[0]?.business_address || "").trim() || null;

    const result = await pool.query(
      `INSERT INTO quotation_templates (seller_id, template_name, template_preset, template_theme_key, header_text, body_template, footer_text, company_phone, company_email, company_address, header_image_data, show_header_image, logo_image_data, show_logo_only, footer_image_data, show_footer_image, accent_color, notes_text, notes_rich_text, terms_text, terms_rich_text, show_bank_details, show_notes, show_terms, email_enabled, whatsapp_enabled)
       VALUES ($1::int, 'default', $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text, $9::text, $10::text, $11::boolean, $12::text, $13::boolean, $14::text, $15::boolean, $16::text, $17::text, $18::text, $19::text, $20::text, $21::boolean, $22::boolean, $23::boolean, $24::boolean, $25::boolean)
       ON CONFLICT (seller_id, template_name)
       DO UPDATE SET
          template_preset = EXCLUDED.template_preset,
          template_theme_key = EXCLUDED.template_theme_key,
          header_text = EXCLUDED.header_text,
          body_template = EXCLUDED.body_template,
          footer_text = EXCLUDED.footer_text,
          company_phone = EXCLUDED.company_phone,
          company_email = EXCLUDED.company_email,
          company_address = EXCLUDED.company_address,
          header_image_data = EXCLUDED.header_image_data,
          show_header_image = EXCLUDED.show_header_image,
          logo_image_data = EXCLUDED.logo_image_data,
          show_logo_only = EXCLUDED.show_logo_only,
          footer_image_data = EXCLUDED.footer_image_data,
          show_footer_image = EXCLUDED.show_footer_image,
          accent_color = EXCLUDED.accent_color,
          notes_text = EXCLUDED.notes_text,
          notes_rich_text = EXCLUDED.notes_rich_text,
          terms_text = EXCLUDED.terms_text,
          terms_rich_text = EXCLUDED.terms_rich_text,
          show_bank_details = EXCLUDED.show_bank_details,
          show_notes = EXCLUDED.show_notes,
          show_terms = EXCLUDED.show_terms,
          email_enabled = EXCLUDED.email_enabled,
          whatsapp_enabled = EXCLUDED.whatsapp_enabled,
          updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        tenantId,
        normalizeTemplatePreset(templatePreset || "default"),
        effectiveThemeKey,
        headerText || null,
        bodyTemplate || null,
        footerText || null,
        companyPhone || null,
        companyEmail || null,
        resolvedCompanyAddress,
        headerImageData || null,
        Boolean(showHeaderImage),
        logoImageData || null,
        Boolean(showLogoOnly),
        effectiveFooterImageData,
        effectiveShowFooterImage,
        effectiveTheme.accent,
        richTextToPlainText(getRichTextHtml(notesRichText, notesText || "")) || null,
        getRichTextHtml(notesRichText, notesText || "") || null,
        richTextToPlainText(getRichTextHtml(termsRichText, termsText || "")) || null,
        getRichTextHtml(termsRichText, termsText || "") || null,
        showBankDetails === undefined ? true : Boolean(showBankDetails),
        showNotes === undefined ? true : Boolean(showNotes),
        showTerms === undefined ? true : Boolean(showTerms),
        Boolean(emailEnabled),
        Boolean(whatsappEnabled)
      ]
    );

    res.json(applyTemplateAccessPolicy(result.rows[0], subscription));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/", requirePermission(PERMISSIONS.QUOTATION_CREATE), async (req, res) => {
  try {
    const tenantId = req.user.isPlatformAdmin ? Number(req.body.sellerId || getTenantId(req)) : getTenantId(req);
    const requestedCreatedBy = Number(req.body.createdBy);
    const effectiveCreatedBy =
      req.user.isPlatformAdmin && Number.isInteger(requestedCreatedBy) && requestedCreatedBy > 0
        ? requestedCreatedBy
        : req.user.id;
    const data = await createQuotationWithItems({
      ...req.body,
      sellerId: tenantId,
      createdBy: effectiveCreatedBy,
      sourceChannel: req.body.sourceChannel || "manual"
    });
    res.status(201).json(data);
  } catch (error) {
    const friendlyError = getFriendlyQuotationPersistenceError(error);
    if (friendlyError) {
      return res.status(400).json(friendlyError);
    }
    res.status(400).json({ message: error.message });
  }
});

router.patch("/:id/revise", requirePermission(PERMISSIONS.QUOTATION_REVISE), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const tenantId = req.user.isPlatformAdmin ? Number(req.body.sellerId || getTenantId(req)) : getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    await client.query("BEGIN");

    const quotationResult = await client.query(
      `SELECT *
       FROM quotations
       WHERE id = $1 AND seller_id = $2
       LIMIT 1
       FOR UPDATE`,
      [id, tenantId]
    );

    if (quotationResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Quotation not found" });
    }

    const quotation = quotationResult.rows[0];
    const normalizedCustomQuotationNumber = normalizeCustomQuotationNumber(req.body.customQuotationNumber);
    if (String(quotation.record_status || "").toLowerCase() === "confirmed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Confirmed quotation cannot be edited" });
    }
    const existingItems = await getQuotationItems(client, id, tenantId);
    const items = Array.isArray(req.body.items) ? req.body.items : [];

    const existingVersionRows = await getQuotationVersions(client, id, tenantId);
    if (existingVersionRows.length === 0) {
      await createQuotationVersionSnapshot(client, {
        sellerId: tenantId,
        quotation,
        items: existingItems,
        actorUserId: req.user.id
      });
    }

    if (items.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "At least one item is required" });
    }

    const normalizedDeliveryType = normalizeDeliveryType(req.body.deliveryType || quotation.delivery_type || "PICKUP");
    const deliveryAddress = req.body.deliveryAddress ?? quotation.delivery_address;
    const deliveryPincode = req.body.deliveryPincode ?? quotation.delivery_pincode;
    const normalizedReferenceRequestId = normalizeReferenceRequestId(req.body.referenceRequestId ?? quotation.reference_request_id);

    if (normalizedDeliveryType === "DOORSTEP") {
      if (!deliveryAddress || !deliveryPincode) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "deliveryAddress and deliveryPincode are required for DOORSTEP delivery" });
      }
      const normalizedPincode = String(deliveryPincode || "").trim();
      if (!/^\d{6}$/.test(normalizedPincode)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "deliveryPincode must be a 6-digit number" });
      }
    }

    const nextGstMode = Object.prototype.hasOwnProperty.call(req.body || {}, "gstMode")
      ? Boolean(req.body.gstMode)
      : Boolean(quotation.gst_mode);

    if (nextGstMode) {
      const gstContextResult = await client.query(
        `SELECT
           c.gst_number AS customer_gst_number,
           c.shipping_addresses AS customer_shipping_addresses,
           s.gst_number AS seller_gst_number
         FROM customers c
         INNER JOIN sellers s ON s.id = c.seller_id
         WHERE c.id = $1
           AND c.seller_id = $2
         LIMIT 1`,
        [quotation.customer_id, tenantId]
      );
      if (gstContextResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Customer not found for GST validation." });
      }
      const gstContext = gstContextResult.rows[0];
      if (!isValidGstinFormat(gstContext.seller_gst_number)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Seller GST is required and must be valid for GST quotation." });
      }
      const effectiveCustomerGst = getEffectiveCustomerGstin({
        customer_gst_number: gstContext.customer_gst_number,
        customer_shipping_addresses: gstContext.customer_shipping_addresses,
        delivery_address: deliveryAddress,
        delivery_pincode: deliveryPincode
      });
      if (String(effectiveCustomerGst || "").trim() && !isValidGstinFormat(effectiveCustomerGst)) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "Customer GST format is invalid. Enter valid GST or leave GST blank." });
      }
    }

    const normalizedItems = items.map((item) => ({
      product_id: item.productId || item.product_id || null,
      variant_id: item.variantId || item.variant_id || null,
      size: item.size || null,
      quantity: toAmount(item.quantity),
      unit_price: toAmount(item.unitPrice ?? item.unit_price),
      item_category: item.itemCategory || item.item_category || item.category || null,
      material_type: item.materialType || item.material_type || null,
      thickness: item.thickness || null,
      design_name: item.designName || item.design_name || null,
      sku: item.sku || null,
      color_name: item.colorName || item.color_name || null,
      imported_color_note: item.importedColorNote || item.imported_color_note || null,
      ps_included: Boolean(item.psIncluded ?? item.ps_included),
      dimension_height: item.dimensionHeight ?? item.dimension_height ?? null,
      dimension_width: item.dimensionWidth ?? item.dimension_width ?? null,
      dimension_unit: item.dimensionUnit || item.dimension_unit || null,
      item_note: item.itemNote || item.item_note || null,
      pricing_type: String(item.pricingType || item.pricing_type || "SFT").toUpperCase(),
      custom_fields: item.customFields || item.custom_fields || {}
    }));

    const customColumns = await getSellerCustomQuotationColumns(client, tenantId);
    const unitConversionMap = await getPlatformUnitConversionMap(client);
    const computedItems = applyComputedQuotationFields(normalizedItems, customColumns, { unitConversionMap });
    validateCustomQuotationFields(computedItems, customColumns);
    const displayReadyItems = await applyQuotationItemDisplayConfig(client, tenantId, computedItems);

    const totals = computeQuotationTotals({
      items: displayReadyItems,
      gstPercent: req.body.gstPercent ?? quotation.gst_percent ?? 0,
      gstMode: nextGstMode,
      transportCharges: req.body.transportCharges ?? quotation.transport_charges ?? 0,
      designCharges: req.body.designCharges ?? quotation.design_charges ?? 0,
      discountAmount: req.body.discountAmount ?? quotation.discount_amount ?? 0,
      advanceAmount: req.body.advanceAmount ?? quotation.advance_amount ?? 0,
      calculationColumns: customColumns
    });
    const approvalEvaluation = await evaluateQuotationApproval(client, {
      sellerId: tenantId,
      requesterUserId: req.user.id,
      totalAmount: totals.totalAmount,
      items: displayReadyItems
    });
    let documentSnapshot = getQuotationDocumentSnapshot(quotation);
    if (!documentSnapshot) {
      const [templateResult, sellerResult, customerResult, subscription, pdfConfig] = await Promise.all([
        client.query(
          `SELECT *
           FROM quotation_templates
           WHERE seller_id = $1
             AND template_name = 'default'
           LIMIT 1`,
          [tenantId]
        ),
        client.query(
          `SELECT id, name, business_name, email, mobile, gst_number, bank_name, bank_branch, bank_account_no, bank_ifsc
           FROM sellers
           WHERE id = $1
           LIMIT 1`,
          [tenantId]
        ),
        client.query(
          `SELECT id, name, firm_name, mobile, email, address, gst_number, monthly_billing, shipping_addresses
           FROM customers
           WHERE id = $1
             AND seller_id = $2
           LIMIT 1`,
          [quotation.customer_id, tenantId]
        ),
        getCurrentSubscription(client, tenantId).catch(() => null),
        getPublishedQuotationPdfConfiguration(client, tenantId)
      ]);
      documentSnapshot = buildFrozenQuotationDocumentSnapshot({
        template: applyTemplateAccessPolicy(templateResult.rows[0] || getDefaultDocumentTemplate(), subscription),
        seller: sellerResult.rows[0] || null,
        customer: customerResult.rows[0] || null,
        pdfConfig
      });
    }
    const nextNotesRichText = getRichTextHtml(req.body.notesRichText, documentSnapshot.template?.notes_rich_text || documentSnapshot.template?.notes_text || "");
    const nextTermsRichText = getRichTextHtml(req.body.termsRichText, documentSnapshot.template?.terms_rich_text || documentSnapshot.template?.terms_text || "");
    documentSnapshot = {
      ...documentSnapshot,
      template: {
        ...(documentSnapshot.template || {}),
        notes_rich_text: nextNotesRichText,
        notes_text: richTextToPlainText(nextNotesRichText),
        terms_rich_text: nextTermsRichText,
        terms_text: richTextToPlainText(nextTermsRichText)
      }
    };
    const calculationSnapshot = buildFrozenQuotationCalculationSnapshot({
      customColumns,
      unitConversionMap,
      totals,
      inputs: {
        gstPercent: req.body.gstPercent ?? quotation.gst_percent ?? 0,
        gstMode: nextGstMode,
        transportCharges: req.body.transportCharges ?? quotation.transport_charges ?? 0,
        designCharges: req.body.designCharges ?? quotation.design_charges ?? 0,
        discountAmount: req.body.discountAmount ?? quotation.discount_amount ?? 0,
        advanceAmount: req.body.advanceAmount ?? quotation.advance_amount ?? 0
      }
    });

    await restoreInventoryForItems(client, tenantId, existingItems);
    const inventoryWarnings = await reserveInventoryForItems(client, tenantId, totals.normalizedItems, { strict: false });

    await client.query(`DELETE FROM quotation_items WHERE quotation_id = $1 AND seller_id = $2`, [id, tenantId]);

    for (const item of totals.normalizedItems) {
      await client.query(
        `INSERT INTO quotation_items
         (quotation_id, seller_id, product_id, variant_id, size, quantity, unit_price, total_price, material_type, thickness, design_name, sku, color_name, imported_color_note, ps_included, dimension_height, dimension_width, dimension_unit, item_note, pricing_type, item_category, item_display_text, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, COALESCE($23::jsonb, '{}'::jsonb))`,
        [
          id,
          tenantId,
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

    const nextVersion = Number(quotation.version_no || 1) + 1;
    const previousApprovalRequestId = await supersedeActiveApprovalRequest(client, Number(id), tenantId);
    const updateResult = await client.query(
      `UPDATE quotations
       SET subtotal = $1,
            gst_amount = $2,
            gst_mode = $3,
            transport_charges = $4,
            design_charges = $5,
            total_amount = $6,
            discount_amount = $7,
            advance_amount = $8,
            balance_amount = $9,
            reference_request_id = $10,
            delivery_type = $11,
            delivery_date = $12,
            delivery_address = $13,
            delivery_pincode = $14,
            transportation_cost = $15,
            design_cost_confirmed = $16,
            order_status = $17,
            payment_status = $18,
            version_no = $19,
            custom_quotation_number = $20,
            approval_required = $21,
            approval_status = $22,
            active_approval_request_id = NULL,
            approved_for_download_at = CASE WHEN $21 THEN CURRENT_TIMESTAMP ELSE NULL END,
            document_snapshot = $23::jsonb,
            calculation_snapshot = $24::jsonb
       WHERE id = $25 AND seller_id = $26
       RETURNING *`,
      [
        totals.subtotal,
        totals.gstAmount,
        nextGstMode,
        totals.transport,
        totals.design,
        totals.totalAmount,
        totals.discountAmount,
        totals.advanceAmount,
        totals.balanceAmount,
        normalizedReferenceRequestId,
        normalizedDeliveryType,
        req.body.deliveryDate ?? quotation.delivery_date,
        deliveryAddress || null,
        deliveryPincode || null,
        req.body.transportationCost ?? quotation.transportation_cost ?? 0,
        req.body.designCostConfirmed ?? quotation.design_cost_confirmed ?? false,
        req.body.orderStatus ? normalizeOrderStatus(req.body.orderStatus) : quotation.order_status,
        req.body.paymentStatus || (totals.advanceAmount > 0 && totals.balanceAmount > 0 ? "partial" : quotation.payment_status),
        nextVersion,
        normalizedCustomQuotationNumber,
        approvalEvaluation.approvalStatus === "approved",
        approvalEvaluation.requiresApproval ? "pending" : approvalEvaluation.approvalStatus,
        JSON.stringify(documentSnapshot),
        JSON.stringify(calculationSnapshot),
        id,
        tenantId
      ]
    );

    let updatedQuotation = updateResult.rows[0];
    let activeApprovalRequest = null;
    if (approvalEvaluation.requiresApproval) {
      activeApprovalRequest = await createQuotationApprovalRequest(client, {
        sellerId: tenantId,
        quotationId: Number(id),
        quotationVersionNo: nextVersion,
        requestedByUserId: req.user.id,
        assignedApproverUserId: approvalEvaluation.assignedApprover?.id || null,
        requestedAmount: totals.totalAmount,
        reasons: approvalEvaluation.reasons,
        previousRequestId: previousApprovalRequestId
      });

      const approvalUpdate = await client.query(
        `UPDATE quotations
         SET active_approval_request_id = $1
         WHERE id = $2 AND seller_id = $3
         RETURNING *`,
        [activeApprovalRequest.id, id, tenantId]
      );
      updatedQuotation = approvalUpdate.rows[0];
    }
    const amountDifference = totals.balanceAmount - toAmount(quotation.balance_amount ?? quotation.total_amount);

    if (amountDifference !== 0) {
      const outstanding = await getCustomerOutstandingInTransaction(client, quotation.customer_id, tenantId);
      await client.query(
        `INSERT INTO ledger (seller_id, customer_id, quotation_id, debit, credit, balance)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tenantId,
          quotation.customer_id,
          id,
          amountDifference > 0 ? amountDifference : 0,
          amountDifference < 0 ? Math.abs(amountDifference) : 0,
          outstanding
        ]
      );
    }

    await logOrderEvent(client, {
      sellerId: tenantId,
      quotationId: id,
      eventType: "QUOTATION_REVISED",
      eventNote: `Updated to Ver.${nextVersion}`,
      actorUserId: req.user.id
    });

    await createQuotationVersionSnapshot(client, {
      sellerId: tenantId,
      quotation: updatedQuotation,
      items: totals.normalizedItems,
      actorUserId: req.user.id
    });

    await client.query("COMMIT");

    const detailResult = await pool.query(
      `SELECT q.*, c.name AS customer_name, c.firm_name, c.mobile, c.email, c.address AS customer_address, c.gst_number AS customer_gst_number, c.shipping_addresses AS customer_shipping_addresses, s.gst_number AS seller_gst_number, s.mobile AS seller_mobile
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       LEFT JOIN sellers s ON s.id = q.seller_id
       WHERE q.id = $1 AND q.seller_id = $2
       LIMIT 1`,
      [id, tenantId]
    );

    const versionRows = await getQuotationVersions(pool, id, tenantId);
    const detailItems = await getQuotationItems(pool, id, tenantId);

    res.json({
      quotation: enrichQuotationTaxData(detailResult.rows[0]),
      items: detailItems,
      versions: versionRows,
      inventoryWarnings,
      approval: {
        requiresApproval: approvalEvaluation.requiresApproval,
        approvalStatus: updatedQuotation.approval_status,
        assignedApprover: approvalEvaluation.assignedApprover
          ? {
            id: approvalEvaluation.assignedApprover.id,
            name: approvalEvaluation.assignedApprover.name || "-"
          }
          : null,
        activeApprovalRequestId: activeApprovalRequest?.id || null,
        reasons: approvalEvaluation.reasons
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    const friendlyError = getFriendlyQuotationPersistenceError(error);
    if (friendlyError) {
      return res.status(400).json(friendlyError);
    }
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.patch("/:id/confirm", requirePermission(PERMISSIONS.QUOTATION_EDIT), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    await client.query("BEGIN");

    const values = [id];
    let where = "id = $1";
    if (tenantId) {
      values.push(tenantId);
      where += " AND quotations.seller_id = $2";
    }

    const currentResult = await client.query(
      `SELECT *
       FROM quotations
       WHERE ${where}
       LIMIT 1
       FOR UPDATE`,
      values
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Quotation not found" });
    }

    const quotation = currentResult.rows[0];
    if (String(quotation.record_status || "").toLowerCase() === "confirmed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Quotation already confirmed" });
    }
    if (["pending", "rejected"].includes(String(quotation.approval_status || "not_required").toLowerCase())) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Quotation cannot be confirmed until approval is completed." });
    }

    const updateResult = await client.query(
      `UPDATE quotations
       SET record_status = 'confirmed'
       WHERE id = $1 AND seller_id = $2
       RETURNING *`,
      [id, quotation.seller_id]
    );

    await logOrderEvent(client, {
      sellerId: quotation.seller_id,
      quotationId: quotation.id,
      eventType: "QUOTATION_CONFIRMED",
      eventNote: "Quotation confirmed and locked",
      actorUserId: req.user.id
    });

    await client.query("COMMIT");
    res.json({ quotation: updateResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.patch("/:id/order-status", requirePermission(PERMISSIONS.QUOTATION_EDIT), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const normalizedStatus = normalizeOrderStatus(req.body.orderStatus);

    const values = [normalizedStatus, id];
    let where = "id = $2";

    if (tenantId) {
      values.push(tenantId);
      where += " AND quotations.seller_id = $3";
    }

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE quotations
       SET order_status = $1
       WHERE ${where}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Quotation not found" });
    }

    await logOrderEvent(client, {
      sellerId: result.rows[0].seller_id,
      quotationId: result.rows[0].id,
      eventType: "ORDER_STATUS_UPDATED",
      eventNote: `Status changed to ${normalizedStatus}`,
      actorUserId: req.user.id
    });

    await client.query("COMMIT");

    res.json({ quotation: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.patch("/:id/logistics", requirePermission(PERMISSIONS.QUOTATION_EDIT), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const deliveryType = normalizeDeliveryType(req.body.deliveryType);

    if (deliveryType === "DOORSTEP" && (!req.body.deliveryAddress || !req.body.deliveryPincode)) {
      return res.status(400).json({ message: "deliveryAddress and deliveryPincode are required for DOORSTEP" });
    }

    const values = [deliveryType, req.body.deliveryDate || null, req.body.deliveryAddress || null, req.body.deliveryPincode || null, id];
    let where = "id = $5";

    if (tenantId) {
      values.push(tenantId);
      where += " AND quotations.seller_id = $6";
    }

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE quotations
       SET delivery_type = $1,
           delivery_date = $2,
           delivery_address = $3,
           delivery_pincode = $4
       WHERE ${where}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Quotation not found" });
    }

    await logOrderEvent(client, {
      sellerId: result.rows[0].seller_id,
      quotationId: result.rows[0].id,
      eventType: "LOGISTICS_UPDATED",
      eventNote: `Delivery set to ${deliveryType}`,
      actorUserId: req.user.id
    });

    await client.query("COMMIT");

    res.json({ quotation: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.patch("/:id/mark-sent", requirePermission(PERMISSIONS.QUOTATION_SEND), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    const values = [id];
    let where = "id = $1";

    if (tenantId) {
      values.push(tenantId);
      where += " AND quotations.seller_id = $2";
    }

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE quotations
       SET quotation_sent = TRUE,
           quotation_sent_at = CURRENT_TIMESTAMP
       WHERE ${where}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Quotation not found" });
    }

    await logOrderEvent(client, {
      sellerId: result.rows[0].seller_id,
      quotationId: result.rows[0].id,
      eventType: "QUOTATION_SENT",
      eventNote: "Quotation marked sent",
      actorUserId: req.user.id
    });

    await client.query("COMMIT");

    res.json({ quotation: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.patch("/:id/payment-status", requirePermission(PERMISSIONS.QUOTATION_MARK_PAID), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const status = String(req.body.paymentStatus || "").toLowerCase();

    if (!["pending", "partial", "paid"].includes(status)) {
      return res.status(400).json({ message: "Invalid paymentStatus. Allowed: pending, partial, paid" });
    }

    const values = [status, id];
    let where = "id = $2";

    if (tenantId) {
      values.push(tenantId);
      where += " AND quotations.seller_id = $3";
    }

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE quotations
       SET payment_status = $1
       WHERE ${where}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Quotation not found" });
    }

    await logOrderEvent(client, {
      sellerId: result.rows[0].seller_id,
      quotationId: result.rows[0].id,
      eventType: "PAYMENT_STATUS_UPDATED",
      eventNote: `Payment status set to ${status}`,
      actorUserId: req.user.id
    });

    await client.query("COMMIT");

    res.json({ quotation: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
