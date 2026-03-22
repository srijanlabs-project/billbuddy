const express = require("express");
const PDFDocument = require("pdfkit");
const puppeteer = require("puppeteer-core");
const pool = require("../db/db");
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
  validateQuotationItemRateLimits,
  validateCustomQuotationFields,
  applyComputedQuotationFields
} = require("../services/quotationService");
const {
  getQuotationCustomFieldEntries,
  getQuotationItemDimensionText,
  getQuotationItemQuantityValue,
  getQuotationItemRateValue,
  getQuotationItemTitle,
  getQuotationItemTotalValue,
  getQuotationSummaryRows
} = require("../services/quotationViewService");
const { getTenantId } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");

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
  return `${String(visibleNumber).replace(/[^a-zA-Z0-9-_]+/g, "_")}_ver_${version}`;
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

function enrichQuotationTaxData(quotation = {}, sellerRow = null) {
  return {
    ...quotation,
    gstin: String(quotation.gstin || sellerRow?.gst_number || quotation.seller_gst_number || "-").trim().toUpperCase() || "-",
    customer_gstin: getEffectiveCustomerGstin(quotation)
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
  switch (normalizeQuotationColumnKey(columnKey)) {
    case "material_name":
      return options.combineHelpingTextInItemColumn ? (getQuotationItemTitle(item) || "-") : (getQuotationItemPrimaryName(item) || "-");
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
      return Number(getQuotationItemQuantityValue(item)).toLocaleString("en-IN");
    case "rate":
    case "unit_price":
      return `Rs ${Number(getQuotationItemRateValue(item)).toLocaleString("en-IN")}`;
    case "amount":
    case "total":
    case "total_rate":
    case "total_price":
      return `Rs ${Number(getQuotationItemTotalValue(item)).toLocaleString("en-IN")}`;
    case "color_name":
      return item.color_name || item.colorName || item.imported_color_note || item.importedColorNote || "-";
    case "note":
    case "item_note":
      return item.item_note || item.itemNote || "-";
    default: {
      const customFields = item.custom_fields || item.customFields || {};
      const raw = customFields[columnKey];
      if (raw === undefined || raw === null || String(raw).trim() === "") return "-";
      return typeof raw === "boolean" ? (raw ? "Yes" : "No") : String(raw);
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

function getHelpingTextEntries(item, pdfColumns = [], options = {}) {
  return pdfColumns
    .filter((column) => {
      const normalizedKey = normalizeQuotationColumnKey(column.key);
      if (!Boolean(column.helpTextInPdf) || normalizedKey === "material_name") return false;
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
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  try {
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 1_500_000) return null;
    return buffer;
  } catch (_error) {
    return null;
  }
}

function normalizeTemplatePreset(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "invoice_classic") return "invoice_classic";
  if (normalized === "executive_boardroom") return "executive_boardroom";
  if (normalized === "industrial_invoice") return "industrial_invoice";
  if (normalized === "html_puppeteer") return "html_puppeteer";
  return "commercial_offer";
}

function getPuppeteerExecutablePath() {
  const candidates = [
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];
  for (const candidate of candidates) {
    if (require("fs").existsSync(candidate)) return candidate;
  }
  throw new Error("Chrome or Edge executable not found for html_puppeteer renderer.");
}

function buildHtmlPuppeteerTemplate({ quotation, items, template, seller = null, pdfColumns = [], allPdfColumns = [] }) {
  const customerName = quotation.firm_name || quotation.customer_name || "Customer";
  const quotationNo = getQuotationNumberValue(quotation) || "-";
  const headerImage = template?.show_header_image ? template?.header_image_data : null;
  const logoImage = !headerImage && template?.show_logo_only ? template?.logo_image_data : null;
  const bodyCopy = renderTemplateText(
    template?.body_template || "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your review.",
    quotation
  );
  const columns = Array.isArray(pdfColumns) && pdfColumns.length ? pdfColumns : [
    { key: "material_name", label: "Name of Product / Service" },
    { key: "quantity", label: "Qty" },
    { key: "rate", label: "Rate" },
    { key: "amount", label: "Total" }
  ];
  const visiblePdfColumns = Array.isArray(allPdfColumns) && allPdfColumns.length ? allPdfColumns : columns;
  const totalInWords = amountToWordsIndian((quotation.total_amount || 0) + Number(quotation.tax_amount || 0));
  const summaryAfterTax = Number((quotation.total_amount || 0) + Number(quotation.tax_amount || 0)).toLocaleString("en-IN");
  const totalAmount = Number(quotation.total_amount || 0);
  const discountAmount = Number(quotation.discount_amount || 0);
  const taxableAmount = Math.max(0, totalAmount - discountAmount);
  const taxAmount = Number(quotation.tax_amount || 0);
  const advanceAmount = Number(quotation.advance_amount || 0);
  const balanceAmount = Number(quotation.balance_amount || (taxableAmount + taxAmount - advanceAmount));
  const sellerName = String(seller?.business_name || seller?.name || template?.header_text || "Quotation");
  const sellerAddressLines = String(template?.company_address || "-").split(/\r?\n/).filter(Boolean);
  const termsLines = String(template?.terms_text || "-").split(/\r?\n/).filter(Boolean);
  const notesLines = String(template?.notes_text || "").split(/\r?\n/).filter(Boolean);
  const itemRows = items.map((item, index) => {
    const helping = getHelpingTextEntries(item, visiblePdfColumns, { combineHelpingTextInItemColumn: false })
      .map((entry) => `${entry.label}: ${entry.value}`)
      .join(" | ");
    return `
      <tr>
        <td class="num center">${index + 1}</td>
        ${columns.map((column) => {
          const key = normalizeQuotationColumnKey(column.key);
          const value = escapeHtml(toSingleLinePdfValue(getQuotationPdfColumnValue(item, column.key, { combineHelpingTextInItemColumn: false }) || "-", key === "material_name" ? 64 : 24));
          const extra = key === "material_name" && helping
            ? `<div class="item-help">${escapeHtml(toSingleLinePdfValue(helping, 140))}</div>`
            : "";
          const className = key === "material_name" ? "item-col" : (["amount","total","total_rate","total_price","rate","unit_price","quantity"].includes(key) ? "num right" : "");
          return `<td class="${className}"><div class="cell-line">${value}</div>${extra}</td>`;
        }).join("")}
      </tr>
    `;
  }).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: "Helvetica Neue", Arial, Helvetica, sans-serif;
      color: #111827;
      background: #fff;
    }
    .page {
      width: 100%;
      margin: 0;
      min-height: 100vh;
      padding: 0;
    }
    .header-image img {
      display: block;
      width: 100%;
      height: auto;
      max-height: 230px;
      object-fit: contain;
    }
    .header-image {
      line-height: 0;
      border-bottom: 1px solid #c7cfdc;
      margin-bottom: 8px;
      overflow: hidden;
      background: #fff;
    }
    .masthead {
      padding: 10px 14px 6px;
    }
    .masthead-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 220px;
      gap: 12px;
      align-items: start;
    }
    .brand-title {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 0.01em;
      color: #1f2c63;
      text-transform: uppercase;
      line-height: 1;
    }
    .brand-band {
      margin-top: 7px;
      background: #0f9f9b;
      color: #fff;
      padding: 8px 12px;
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .brand-address, .brand-contact {
      margin-top: 6px;
      display: grid;
      gap: 1px;
      font-size: 9.4px;
      line-height: 1.18;
    }
    .brand-contact { text-align: right; justify-items: end; }
    .brand-contact .logo-wrap img {
      max-width: 112px;
      max-height: 72px;
      object-fit: contain;
      display: block;
      margin-bottom: 4px;
    }
    .title-row {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 8px;
      align-items: center;
      border-bottom: 1px solid #c7cfdc;
      padding: 6px 10px;
      color: #1f2c63;
      font-weight: 700;
    }
    .title-row span {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 10.8px;
    }
    .title-row strong {
      justify-self: center;
      font-size: 19px;
      letter-spacing: 0.02em;
    }
    .title-row span:last-child {
      justify-self: end;
      color: #111827;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr);
      border-bottom: 1px solid #c7cfdc;
    }
    .customer-box {
      border-right: 1px solid #c7cfdc;
    }
    .customer-head {
      padding: 6px 10px;
      text-align: center;
      font-size: 9.8px;
      font-weight: 700;
      border-bottom: 1px solid #c7cfdc;
    }
    .customer-row {
      display: grid;
      grid-template-columns: 72px minmax(0, 1fr);
      gap: 8px;
      padding: 7px 10px 0;
      font-size: 9.6px;
      line-height: 1.05;
    }
    .customer-row strong, .meta-pair strong { font-weight: 700; }
    .meta-box {
      padding: 8px 10px 6px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 88px 86px 94px minmax(102px, 1fr);
      column-gap: 8px;
      row-gap: 10px;
      font-size: 9.4px;
      line-height: 1.05;
      align-items: center;
    }
    .meta-grid .value { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .body-copy {
      padding: 8px 10px 6px;
      font-size: 10px;
      line-height: 1.18;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .items-table th, .items-table td {
      border: 1px solid #c7cfdc;
      padding: 5px 6px;
      font-size: 9.4px;
      vertical-align: top;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .items-table th {
      background: #fbfcfe;
      font-weight: 700;
      text-align: center;
      font-size: 8.2px;
    }
    .items-table {
      border-bottom: 1px solid #c7cfdc;
    }
    .items-table tbody tr:last-child td {
      border-bottom: 1px solid #c7cfdc;
    }
    .items-table .item-col {
      white-space: normal;
    }
    .cell-line {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-help {
      margin-top: 2px;
      font-size: 7px;
      color: #4b5563;
      font-style: italic;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .num { font-weight: 700; }
    .center { text-align: center; }
    .right { text-align: right; }
    .footer-grid {
      display: grid;
      grid-template-columns: 62% 38%;
      border-top: 1px solid #c7cfdc;
    }
    .footer-left { border-right: 1px solid #c7cfdc; }
    .footer-left .footer-cell:last-child,
    .footer-left .notes-block + .footer-cell {
      border-bottom: 1px solid #c7cfdc;
    }
    .footer-cell {
      border-top: 1px solid #c7cfdc;
      padding: 6px 8px 7px;
      font-size: 8.5px;
      line-height: 1.12;
    }
    .footer-cell h4 {
      margin: 0 0 6px;
      text-align: center;
      font-size: 9.2px;
    }
    .kv {
      display: grid;
      grid-template-columns: minmax(122px, 1.2fr) minmax(0, 1fr);
      gap: 6px;
      margin-bottom: 4px;
      align-items: start;
    }
    .kv div:first-child {
      font-weight: 700;
      white-space: nowrap;
      font-size: 7.8px;
    }
    .kv div:last-child {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 8.4px;
    }
    .kv.grand div { font-weight: 700; font-size: 8.8px; }
    .terms-list { margin: 0; padding-left: 14px; }
    .terms-list li { margin: 0 0 1px; }
    .footer-note {
      text-align: center;
      line-height: 1.12;
      font-size: 8.2px;
    }
    .signatory {
      min-height: 84px;
      display: grid;
      align-content: space-between;
      justify-items: center;
      text-align: center;
      font-size: 8.2px;
    }
    .footer-bottom-line {
      border-top: 1px solid #c7cfdc;
      height: 0;
      width: 100%;
    }
    .footer-subtext {
      margin-top: 4px;
      font-size: 8px;
      line-height: 1.12;
    }
    .notes-block {
      border-top: 1px solid #c7cfdc;
      padding: 6px 8px;
      font-size: 8.2px;
      line-height: 1.12;
    }
    .notes-block strong {
      display: block;
      margin-bottom: 3px;
      font-size: 9px;
    }
  </style>
</head>
<body>
  <div class="page">
    ${headerImage ? `<div class="header-image"><img src="${headerImage}" alt="Header" /></div>` : `
      <div class="masthead">
        <div class="masthead-row">
          <div>
            <div class="brand-title">${escapeHtml(sellerName)}</div>
            ${template?.footer_text ? `<div class="brand-band">${escapeHtml(template.footer_text)}</div>` : ""}
            <div class="brand-address">
              ${(sellerAddressLines.length ? sellerAddressLines : ["-"]).map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
            </div>
          </div>
          <div class="brand-contact">
            ${logoImage ? `<div class="logo-wrap"><img src="${logoImage}" alt="Logo" /></div>` : ""}
            ${template?.company_phone ? `<span>Tel : ${escapeHtml(template.company_phone)}</span>` : ""}
            ${seller?.website ? `<span>Web : ${escapeHtml(seller.website)}</span>` : ""}
            ${template?.company_email ? `<span>Email : ${escapeHtml(template.company_email)}</span>` : ""}
          </div>
        </div>
      </div>
    `}
    <div class="title-row">
      <span>GSTIN : ${escapeHtml(String(quotation.gstin || template?.gstin || "-"))}</span>
      <strong>QUOTATION</strong>
      <span>ORIGINAL FOR CUSTOMER</span>
    </div>
    <div class="info-grid">
      <div class="customer-box">
        <div class="customer-head">Customer Detail</div>
        <div class="customer-row"><strong>M/S</strong><span>${escapeHtml(customerName)}</span></div>
        <div class="customer-row"><strong>Address</strong><span>${escapeHtml(toSingleLinePdfValue(quotation.delivery_address || "-", 56))}</span></div>
        <div class="customer-row"><strong>Phone</strong><span>${escapeHtml(String(quotation.mobile || "-"))}</span></div>
        <div class="customer-row"><strong>GSTIN</strong><span>${escapeHtml(String(quotation.customer_gstin || "-"))}</span></div>
        <div class="customer-row"><strong>Place of Supply</strong><span>${escapeHtml(String(quotation.delivery_pincode || "-"))}</span></div>
      </div>
      <div class="meta-box">
        <div class="meta-grid">
          <span>Quotation No.</span><span class="value">${escapeHtml(quotationNo)}</span>
          <span>Date</span><span class="value">${escapeHtml(formatDateIST(quotation.created_at) || "-")}</span>
          <span>Version</span><span class="value">${escapeHtml(String(quotation.version_no || 1))}</span>
          <span>Delivery Date</span><span class="value">${escapeHtml(formatDateIST(quotation.delivery_date) || "-")}</span>
          <span>Delivery Type</span><span class="value">${escapeHtml(String(quotation.delivery_type || "-"))}</span>
          <span>Customer</span><span class="value">${escapeHtml(customerName)}</span>
          <span>Pincode</span><span class="value">${escapeHtml(String(quotation.delivery_pincode || "-"))}</span>
          <span>Mobile</span><span class="value">${escapeHtml(String(quotation.mobile || "-"))}</span>
        </div>
      </div>
    </div>
    <div class="body-copy">${nl2br(bodyCopy)}</div>
    <table class="items-table">
      <colgroup>
        <col style="width:38px" />
        ${columns.map((column) => {
          const key = normalizeQuotationColumnKey(column.key);
          let width = "90px";
          if (key === "material_name") width = "38%";
          else if (["amount","total","total_rate","total_price"].includes(key)) width = "13%";
          else if (["rate","unit_price","quantity","unit","uom","unit_type"].includes(key)) width = "10%";
          return `<col style="width:${width}" />`;
        }).join("")}
      </colgroup>
      <thead>
        <tr>
          <th>Sr No.</th>
          ${columns.map((column) => `<th>${escapeHtml(toSingleLinePdfValue(column.label || "", 28))}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
    <div class="footer-grid">
      <div class="footer-left">
        <div class="footer-cell">
          <h4>Total in words</h4>
          <div class="footer-note">${escapeHtml(totalInWords)}</div>
        </div>
        <div class="footer-cell">
          <h4>Bank Details</h4>
          <div class="kv"><div>Bank Name</div><div>${escapeHtml(seller?.bank_name || "State Bank of India")}</div></div>
          <div class="kv"><div>Branch Name</div><div>${escapeHtml(seller?.bank_branch || "Main Branch")}</div></div>
          <div class="kv"><div>Bank Account Number</div><div>${escapeHtml(seller?.bank_account_no || "2000000004512")}</div></div>
          <div class="kv"><div>Bank Branch IFSC</div><div>${escapeHtml(seller?.bank_ifsc || "SBIN0000488")}</div></div>
        </div>
        ${notesLines.length ? `
          <div class="notes-block">
            <strong>Notes</strong>
            ${notesLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
          </div>
        ` : ""}
        <div class="footer-cell">
          <h4>Terms and Conditions</h4>
          <ol class="terms-list">
            ${(termsLines.length ? termsLines : ["-"]).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ol>
        </div>
      </div>
      <div>
        <div class="footer-cell">
          <div class="kv"><div>Total Amount</div><div class="right">${escapeHtml(totalAmount.toLocaleString("en-IN"))}</div></div>
          <div class="kv"><div>Discount</div><div class="right">${escapeHtml(discountAmount.toLocaleString("en-IN"))}</div></div>
          <div class="kv"><div>Taxable Amount</div><div class="right">${escapeHtml(taxableAmount.toLocaleString("en-IN"))}</div></div>
          <div class="kv"><div>Add : GST</div><div class="right">${escapeHtml(taxAmount.toLocaleString("en-IN"))}</div></div>
          <div class="kv"><div>Total Tax</div><div class="right">${escapeHtml(taxAmount.toLocaleString("en-IN"))}</div></div>
          <div class="kv"><div>Advance Amount</div><div class="right">${escapeHtml(advanceAmount.toLocaleString("en-IN"))}</div></div>
          <div class="kv grand"><div>Balance Amount</div><div class="right">Rs ${escapeHtml(balanceAmount.toLocaleString("en-IN"))}</div></div>
        </div>
        <div class="footer-cell">
          <h4 style="text-align:left">GST Payable on Reverse Charge</h4>
          <div class="kv"><div></div><div class="right"><strong>N.A.</strong></div></div>
          <div class="footer-note">Certified that the particulars given above are true and correct.</div>
          <div class="footer-note" style="margin-top:6px;"><strong>For ${escapeHtml(toSingleLinePdfValue(sellerName, 44))}</strong></div>
        </div>
        <div class="footer-cell signatory">
          <div class="footer-note">This is computer generated quotation.<br/>No signature required.</div>
          <strong>Authorised Signatory</strong>
        </div>
        <div class="footer-bottom-line"></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function buildHtmlPuppeteerPdf({ quotation, items, template, seller = null, pdfColumns = [], allPdfColumns = [], res }) {
  const executablePath = getPuppeteerExecutablePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--disable-gpu", "--hide-scrollbars"]
  });
  try {
    const page = await browser.newPage();
    const html = buildHtmlPuppeteerTemplate({ quotation, items, template, seller, pdfColumns, allPdfColumns });
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
  const customerName = quotation.firm_name || quotation.customer_name || "Customer";
  const watermarkText = quotation.watermark_text || "";
  const totalsRows = getQuotationSummaryRows({
    totalAmount: quotation.total_amount,
    discountAmount: quotation.discount_amount,
    advanceAmount: quotation.advance_amount,
    balanceAmount: quotation.balance_amount || quotation.total_amount
  }).map((row) => `<div class="totals-row ${row.accent ? "grand" : ""}"><span>${escapeHtml(row.label)}</span><strong>Rs ${Number(row.value || 0).toLocaleString("en-IN")}</strong></div>`);
    const itemRows = items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          ${pdfColumns.map((column) => {
            const rawValue = getQuotationPdfColumnValue(item, column.key);
            const hiddenMeta = normalizeQuotationColumnKey(column.key) === "material_name" ? getHiddenQuotationItemMeta(item, pdfColumns) : [];
            const metaHtml = hiddenMeta.length ? `<div class="custom-meta">${escapeHtml(hiddenMeta.map((entry) => `${entry.label}: ${entry.value}`).join(" | "))}</div>` : "";
            return `<td><div>${escapeHtml(rawValue)}</div>${metaHtml}</td>`;
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
    thead th { background: #eaf3ff; color: #355174; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    th, td { padding: 14px 12px; border-bottom: 1px solid var(--line); text-align: left; }
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
          <p>${nl2br(template.footer_text || "Thank you for the opportunity. Please find our commercial offer below.")}</p>
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
          <div>${escapeHtml(quotation.delivery_address || "")}</div>
          <div>${escapeHtml(quotation.delivery_pincode || "")}</div>
        </div>
        <div class="card">
          <h3>Contact</h3>
          ${template.show_logo_only && template.logo_image_data
            ? `<div><img src="${template.logo_image_data}" alt="Logo" style="max-width:140px;max-height:70px;object-fit:contain;" /></div>
          <div><strong>Phone:</strong> ${escapeHtml(template.company_phone || "")}</div>
          <div><strong>Email:</strong> ${escapeHtml(template.company_email || "")}</div>
          <div><strong>Address:</strong> ${nl2br(template.company_address || "")}</div>`
            : template.show_header_image && template.header_image_data
            ? `<div><img src="${template.header_image_data}" alt="Header" style="max-width:100%;max-height:90px;object-fit:contain;" /></div>`
            : `<div><strong>Phone:</strong> ${escapeHtml(template.company_phone || "")}</div>
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

      <div class="footer-grid">
        <div class="card">
          <h3>Notes</h3>
          <div class="foot-note">${nl2br(template.notes_text || "")}</div>
        </div>
        <div class="card">
          <h3>Terms</h3>
          <div class="foot-note">${nl2br(template.terms_text || "")}</div>
        </div>
      </div>
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
  if (template.footer_text) {
    doc.moveDown(0.2);
    doc.fillColor(labelColor).font("Helvetica").fontSize(11).text(template.footer_text, { width: pageWidth });
  }
  if (template.company_address || template.company_phone || template.company_email) {
    doc.moveDown(0.5);
    doc.fillColor(labelColor).font("Helvetica").fontSize(10);
    if (template.company_address) doc.text(template.company_address, { width: pageWidth });
    if (template.company_phone) doc.text(`Phone: ${template.company_phone}`);
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
      .join(" | ");
    const itemColumnIndex = columns.findIndex((column) => column.key === "material_name");
    const rowValues = [
      String(index + 1),
      ...configuredColumns.map((column) => toSingleLinePdfValue(getQuotationPdfColumnValue(item, column.key, { combineHelpingTextInItemColumn })))
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
    totalAmount: quotation.total_amount,
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
  const customerName = quotation.firm_name || quotation.customer_name || "Customer";
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

  if (template.footer_text) {
    doc.moveDown(0.15);
    doc.fillColor(subtleText).font("Helvetica").fontSize(10.5).text(template.footer_text, {
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

  if (template.company_address || template.company_phone || template.company_email) {
    doc.moveDown(0.3);
    doc.fillColor(labelColor).font("Helvetica").fontSize(9.5);
    if (template.company_address) doc.text(template.company_address, { width: pageWidth - 180, lineGap: 1 });
    if (template.company_phone) doc.text(`Phone: ${template.company_phone}`, { width: pageWidth - 180 });
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
      .join(" | ");

    const itemColumnIndex = columns.findIndex((column) => column.key === "material_name");

    const rowValues = [
      String(index + 1),
      ...configuredColumns.map((column) =>
        toSingleLinePdfValue(getQuotationPdfColumnValue(item, column.key, { combineHelpingTextInItemColumn }))
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
    totalAmount: quotation.total_amount,
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

  // ---------------------------------------------------------------------------
  // Notes & Terms
  // ---------------------------------------------------------------------------
  debugLogger?.log("notes-start");
  ensurePageSpace(120);

  const bottomStartY = doc.y;
  const bottomGap = 14;
  const bottomBoxW = (pageWidth - bottomGap) / 2;
  const bottomBoxH = 86;

  drawRoundedBox(doc.page.margins.left, bottomStartY, bottomBoxW, bottomBoxH, "#ffffff", lineColor, 10);
  drawRoundedBox(doc.page.margins.left + bottomBoxW + bottomGap, bottomStartY, bottomBoxW, bottomBoxH, "#ffffff", lineColor, 10);

  doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(8.5).text("NOTES", doc.page.margins.left + 12, bottomStartY + 10, {
    width: bottomBoxW - 24
  });
  doc.fillColor(textColor).font("Helvetica").fontSize(9.2).text(template.notes_text || "-", doc.page.margins.left + 12, bottomStartY + 24, {
    width: bottomBoxW - 24,
    height: 54,
    lineGap: 2,
    ellipsis: true
  });
  debugLogger?.log("notes-done");

  debugLogger?.log("terms-start");
  const rightBoxX = doc.page.margins.left + bottomBoxW + bottomGap;
  doc.fillColor(labelColor).font("Helvetica-Bold").fontSize(8.5).text("TERMS", rightBoxX + 12, bottomStartY + 10, {
    width: bottomBoxW - 24
  });
  doc.fillColor(textColor).font("Helvetica").fontSize(9.2).text(template.terms_text || "-", rightBoxX + 12, bottomStartY + 24, {
    width: bottomBoxW - 24,
    height: 54,
    lineGap: 2,
    ellipsis: true
  });
  debugLogger?.log("terms-done");

  doc.y = bottomStartY + bottomBoxH + 12;

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
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const customerName = quotation.firm_name || quotation.customer_name || "Customer";
  const quotationNo = getQuotationNumberValue(quotation) || "-";
  const templatePreset = normalizeTemplatePreset(template?.template_preset);
  const accent = template?.accent_color || "#2563eb";
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

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${quotationFileStem(quotation)}.pdf`);
  doc.pipe(res);

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
    const sellerName = template?.header_text || template?.company_name || "Quotation";
    const summaryRows = [
      { label: "SUBTOTAL", value: quotation.total_amount || 0 },
      ...(Number(quotation.discount_amount || 0) ? [{ label: "DISCOUNT", value: `- Rs ${Number(quotation.discount_amount || 0).toLocaleString("en-IN")}` }] : []),
      ...(Number(quotation.advance_amount || 0) ? [{ label: "ADVANCE", value: `- Rs ${Number(quotation.advance_amount || 0).toLocaleString("en-IN")}` }] : []),
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
      template?.company_phone ? `Contact: ${template.company_phone}` : null,
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
        combineHelpingTextInItemColumn
      }).map((entry) => `${entry.label}: ${entry.value}`).join(" | ");
      const rowHeight = helpingText ? 58 : 34;
      if (y > doc.page.height - doc.page.margins.bottom - 190) {
        doc.addPage();
        y = doc.page.margins.top;
      }
      let rowX = leftX;
      const rowValues = [
        String(index + 1),
        ...configuredColumns.map((column) => String(getQuotationPdfColumnValue(item, column.key, { combineHelpingTextInItemColumn }) || "-"))
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
      { title: "Notes", body: template?.notes_text || "-" },
      { title: "Terms & Conditions", body: template?.terms_text || "-" }
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
    const sellerName = template?.company_name || template?.header_text || "Quotation";
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
      if (template?.footer_text) {
        doc.save();
        doc.rect(contentLeft, metaTop + 40, contentWidth - 160, 28).fill(teal);
        doc.restore();
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff").text(template.footer_text, contentLeft + 10, metaTop + 48, {
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
        template?.company_phone ? `Tel : ${template.company_phone}` : null,
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
    doc.font("Helvetica-Bold").fontSize(10).fillColor(ink).text(`GSTIN : ${quotation.gstin || template?.gstin || "-"}`, contentLeft + 8, titleBarY + 8, { lineBreak: false });
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
    const infoHeight = 134;
    doc.moveTo(rightInfoX, infoTop).lineTo(rightInfoX, infoTop + infoHeight).strokeColor(line).lineWidth(1).stroke();
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor(dark).text("Customer Detail", contentLeft + 110, infoTop + 8, {
      width: 110,
      align: "center"
    });
    doc.moveTo(contentLeft, infoTop + 28).lineTo(rightInfoX, infoTop + 28).strokeColor(line).lineWidth(1).stroke();

    doc.font("Helvetica-Bold").fontSize(9.4).fillColor(dark).text("M/S", contentLeft + 8, infoTop + 42, { width: 70, lineBreak: false });
    doc.font("Helvetica").fontSize(10).text(customerName, contentLeft + 90, infoTop + 42, { width: leftInfoWidth - 98, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(9.4).text("Address", contentLeft + 8, infoTop + 64, { width: 70, lineBreak: false });
    doc.font("Helvetica").fontSize(10).text(toSingleLinePdfValue(quotation.delivery_address || "-", 48), contentLeft + 90, infoTop + 64, { width: leftInfoWidth - 98, lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(9.4).text("Phone", contentLeft + 8, infoTop + 94, { width: 70, lineBreak: false });
    doc.font("Helvetica").fontSize(10).text(quotation.mobile || "-", contentLeft + 90, infoTop + 94, { lineBreak: false });
    doc.font("Helvetica-Bold").fontSize(9.4).text("Place of Supply", contentLeft + 8, infoTop + 116, { width: 70, lineBreak: false });
    doc.font("Helvetica").fontSize(10).text(toSingleLinePdfValue(quotation.delivery_address || "-", 40), contentLeft + 90, infoTop + 116, { width: leftInfoWidth - 98, lineBreak: false });

    const infoPairs = [
      ["Quotation No.", quotationNo, "Date", formatDateIST(quotation.created_at) || "-"],
      ["Version", String(quotation.version_no || 1), "Delivery Date", formatDateIST(quotation.delivery_date) || "-"],
      ["Delivery Type", quotation.delivery_type || "-", "Customer Mobile", quotation.mobile || "-"],
      ["Customer", customerName, "Pincode", quotation.delivery_pincode || "-"]
    ];
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
        combineHelpingTextInItemColumn
      }).map((entry) => `${entry.label}: ${entry.value}`).join(" | ");
      const rowHeight = helping ? 44 : 28;
      if (y > doc.page.height - 6 - 170) {
        doc.addPage();
        y = contentTop + 24;
      }
      doc.rect(contentLeft, y, contentWidth, rowHeight).strokeColor(line).lineWidth(1).stroke();
      let rowX = contentLeft;
      const rowValues = [
        String(index + 1),
        ...configured.map((column) => String(getQuotationPdfColumnValue(item, column.key, { combineHelpingTextInItemColumn: false }) || "-"))
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
    const footerBlockHeight = 286;
    if (y > doc.page.height - 6 - footerBlockHeight) {
      doc.addPage();
      y = contentTop + 24;
    }
    const lowerTop = y;
    const leftLowerWidth = Math.floor(contentWidth * 0.62);
    const rightLowerX = contentLeft + leftLowerWidth;
    const rightLowerWidth = contentWidth - leftLowerWidth;

    const drawCell = (x, top, width, height, title, bodyLines = [], options = {}) => {
      doc.rect(x, top, width, height).strokeColor(line).lineWidth(1).stroke();
      if (title) {
        doc.font("Helvetica-Bold").fontSize(10).fillColor(dark).text(title, x + 8, top + 8, {
          width: width - 16,
          align: options.titleAlign || "center",
          lineBreak: false
        });
        doc.moveTo(x, top + 28).lineTo(x + width, top + 28).strokeColor(line).lineWidth(1).stroke();
      }
      let textY = top + 36;
      bodyLines.forEach((lineItem) => {
        if (typeof lineItem === "string") {
          doc.font("Helvetica").fontSize(9.2).fillColor(dark).text(lineItem, x + 8, textY, {
            width: width - 16,
            lineGap: 1
          });
        } else {
          const labelWidth = lineItem.labelWidth || Math.floor(width * 0.6);
          const valueX = x + labelWidth + 8;
          doc.font("Helvetica-Bold").fontSize(lineItem.labelSize || 8.2).fillColor(dark).text(lineItem.label, x + 8, textY, { width: labelWidth - 12, lineBreak: false });
          doc.font(lineItem.strong ? "Helvetica-Bold" : "Helvetica").fontSize(lineItem.valueSize || 9.2).text(lineItem.value, valueX, textY, {
            width: width - labelWidth - 16,
            align: lineItem.align || "left"
          });
        }
        textY += lineItem.spacing || 14;
      });
    };

    const totalInWords = amountToWordsIndian(quotation.balance_amount || quotation.total_amount || 0);
    drawCell(contentLeft, lowerTop, leftLowerWidth, 62, "Total in words", [totalInWords], { titleAlign: "center" });
    drawCell(rightLowerX, lowerTop, rightLowerWidth, 110, "", [
      { label: "Taxable Amount", value: `${Number(quotation.total_amount || 0).toLocaleString("en-IN")}`, labelWidth: 154, labelSize: 7.9, valueSize: 8.9, spacing: 13 },
      { label: "Add : GST", value: `${Number(quotation.tax_amount || 0).toLocaleString("en-IN")}`, labelWidth: 154, labelSize: 7.9, valueSize: 8.9, spacing: 13 },
      { label: "Total Tax", value: `${Number(quotation.tax_amount || 0).toLocaleString("en-IN")}`, labelWidth: 154, labelSize: 7.9, valueSize: 8.9, spacing: 13 },
      { label: "Total Amount After Tax", value: `Rs ${Number((quotation.total_amount || 0) + Number(quotation.tax_amount || 0)).toLocaleString("en-IN")}`, strong: true, spacing: 15, labelWidth: 176, labelSize: 7.2, valueSize: 9.1 }
    ]);

    const bankTop = lowerTop + 62;
    drawCell(contentLeft, bankTop, leftLowerWidth, 110, "Bank Details", [
      { label: "Bank Name", value: seller?.bank_name || "State Bank of India" },
      { label: "Branch Name", value: seller?.bank_branch || "Main Branch" },
      { label: "Bank Account Number", value: seller?.bank_account_no || "2000000004512" },
      { label: "Bank Branch IFSC", value: seller?.bank_ifsc || "SBIN0000488" }
    ], { titleAlign: "center" });

    const certTop = lowerTop + 110;
    drawCell(rightLowerX, certTop, rightLowerWidth, 122, "GST Payable on Reverse Charge", [
      { label: "", value: "N.A.", strong: true, align: "right", spacing: 18 },
      "Certified that the particulars given above are true and correct.",
      { label: "", value: `For ${toSingleLinePdfValue(sellerName, 32)}`, strong: true, align: "center", spacing: 18, valueSize: 8.8 }
    ], { titleAlign: "left" });

    const termsTop = bankTop + 110;
    drawCell(contentLeft, termsTop, leftLowerWidth, 122, "Terms and Conditions", String(template?.terms_text || "-").split(/\r?\n/).filter(Boolean).map((lineText, index) => `${index + 1}. ${lineText}`), { titleAlign: "center" });
    drawCell(rightLowerX, certTop + 122, rightLowerWidth, 122, "", [
      "This is computer generated quotation.",
      "No signature required.",
      { label: "", value: "Authorised Signatory", strong: true, align: "center", spacing: 22, valueSize: 8.5 }
    ]);
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
      const itemTitle = getQuotationItemPrimaryName(item) || getQuotationItemTitle(item) || "-";
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
    if (template?.notes_text) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(10).text("Notes");
      doc.font("Helvetica").fontSize(9.5).text(template.notes_text);
    }
    if (template?.terms_text) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(10).text("Terms");
      doc.font("Helvetica").fontSize(9.5).text(template.terms_text);
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
    doc.text(`Phone: ${template?.company_phone || "-"}`, rightX, doc.y + 2, { width: 190, align: "right" });
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
  doc.save();
  doc.roundedRect(leftX, billTop, cardWidth, 92, 8).fillAndStroke("#ffffff", lineColor);
  doc.roundedRect(leftX + cardWidth + 14, billTop, cardWidth, 92, 8).fillAndStroke("#ffffff", lineColor);
  doc.restore();
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(10).text("Bill To", leftX + 12, billTop + 10);
  doc.font("Helvetica").fontSize(9.5);
  doc.text(customerName, leftX + 12, billTop + 28, { width: cardWidth - 24 });
  doc.text(`Mobile: ${quotation.mobile || "-"}`, leftX + 12, billTop + 43, { width: cardWidth - 24 });
  doc.text(quotation.delivery_address || "-", leftX + 12, billTop + 58, { width: cardWidth - 24 });
  doc.fillColor(dark).font("Helvetica-Bold").fontSize(10).text("Supply / Dispatch", leftX + cardWidth + 26, billTop + 10);
  doc.font("Helvetica").fontSize(9.5);
  doc.text(`Delivery Type: ${quotation.delivery_type || "-"}`, leftX + cardWidth + 26, billTop + 28, { width: cardWidth - 24 });
  doc.text(`Pincode: ${quotation.delivery_pincode || "-"}`, leftX + cardWidth + 26, billTop + 43, { width: cardWidth - 24 });
  doc.text(template?.footer_text || "Thank you for your business.", leftX + cardWidth + 26, billTop + 58, { width: cardWidth - 24 });

  let y = billTop + 108;
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
      combineHelpingTextInItemColumn
    })
      .map((entry) => `${entry.label}: ${entry.value}`)
      .join(" | ");
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
      ...configuredColumns.map((column) => String(getQuotationPdfColumnValue(item, column.key, { combineHelpingTextInItemColumn }) || "-"))
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
    { label: "Total Amount", value: quotation.total_amount || 0 },
    ...(Number(quotation.discount_amount || 0) ? [{ label: "Discount", value: quotation.discount_amount || 0 }] : []),
    ...(Number(quotation.advance_amount || 0) ? [{ label: "Advance", value: quotation.advance_amount || 0 }] : []),
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
    { title: "Notes", body: template?.notes_text || "-" },
    { title: "Terms & Conditions", body: template?.terms_text || "-" }
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
      `SELECT q.*, c.name AS customer_name, c.firm_name, c.mobile, c.gst_number AS customer_gst_number, c.shipping_addresses AS customer_shipping_addresses, s.gst_number AS seller_gst_number, u.name AS created_by_name
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
      `SELECT q.*, c.name AS customer_name, c.firm_name, c.mobile, c.gst_number AS customer_gst_number, c.shipping_addresses AS customer_shipping_addresses, s.gst_number AS seller_gst_number
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
      customerOutstanding: outstanding
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
    debugLogger.log("route-start", `simple=${String(req.query.simple || "") === "1"}`);

    const values = [id];
    let where = "q.id = $1";
    if (tenantId) {
      values.push(tenantId);
      where += " AND q.seller_id = $2";
    }

    const quotationResult = await pool.query(
      `SELECT q.*, c.name AS customer_name, c.firm_name, c.mobile, c.gst_number AS customer_gst_number, c.shipping_addresses AS customer_shipping_addresses, s.gst_number AS seller_gst_number
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
    const itemsResult = await pool.query(
      `SELECT qi.*, p.material_name, pv.variant_name
       FROM quotation_items qi
       LEFT JOIN products p ON p.id = qi.product_id
       LEFT JOIN product_variants pv ON pv.id = qi.variant_id
       WHERE qi.quotation_id = $1
       ORDER BY qi.id`,
      [id]
    );
    debugLogger.log("items-loaded", `count=${itemsResult.rows.length}`);

    const template = await pool.query(
      `SELECT *
       FROM quotation_templates
       WHERE seller_id = $1 AND template_name = 'default'
       LIMIT 1`,
      [quotation.seller_id]
    );
    debugLogger.log("template-loaded", `hasTemplate=${template.rowCount > 0}`);
    const sellerResult = await pool.query(
      `SELECT id, name, business_name, gst_number, bank_name, bank_branch, bank_account_no, bank_ifsc
       FROM sellers
       WHERE id = $1
       LIMIT 1`,
      [quotation.seller_id]
    );
    const sellerRow = sellerResult.rows[0] || null;

    const tpl = template.rows[0] || {
      template_preset: "commercial_offer",
      header_text: "Commercial Offer",
      body_template: "Dear {{customer_name}}, thank you for your enquiry. Please find our offer for quotation {{quotation_number}}.",
      footer_text: "We look forward to working with you.",
      company_phone: "",
      company_email: "",
      company_address: "",
      header_image_data: null,
      show_header_image: false,
      logo_image_data: null,
      show_logo_only: false,
      accent_color: "#2563eb",
      notes_text: "",
      terms_text: ""
    };
    const pdfConfig = await getPublishedQuotationPdfConfiguration(pool, quotation.seller_id);
    const pdfColumns = pdfConfig.columns || [];
    debugLogger.log("pdf-columns-loaded", `count=${pdfColumns.length} combineHelping=${Boolean(pdfConfig.modules?.combineHelpingTextInItemColumn)}`);

    const useSimplePdf = String(req.query.simple || "") === "1";
    const templatePreset = normalizeTemplatePreset(tpl.template_preset);
    if (useSimplePdf) {
      debugLogger.log("simple-pdf-start");
      buildSimpleQuotationPdf({
        quotation,
        items: itemsResult.rows,
        template: tpl,
        seller: sellerRow,
        pdfColumns,
        allPdfColumns: pdfConfig.allPdfColumns || pdfColumns,
        pdfModules: pdfConfig.modules || {},
        res
      });
      return;
    }

    if (templatePreset === "html_puppeteer") {
      debugLogger.log("html-puppeteer-start");
      await buildHtmlPuppeteerPdf({
        quotation,
        items: itemsResult.rows,
        template: tpl,
        seller: sellerRow,
        pdfColumns,
        allPdfColumns: pdfConfig.allPdfColumns || pdfColumns,
        res
      });
      return;
    }

    buildQuotationPdf({
      quotation,
      items: itemsResult.rows,
      template: tpl,
      pdfColumns,
      pdfModules: pdfConfig.modules || {},
      res,
      debugLogger
    });
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

router.get("/templates/current", requirePermission(PERMISSIONS.SETTINGS_VIEW), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const result = await pool.query(
      `SELECT * FROM quotation_templates WHERE seller_id = $1 AND template_name = 'default' LIMIT 1`,
      [tenantId]
    );

    res.json(result.rows[0] || null);
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
      headerText,
      bodyTemplate,
      footerText,
      companyPhone,
      companyEmail,
      companyAddress,
      headerImageData,
      showHeaderImage,
      logoImageData,
      showLogoOnly,
      accentColor,
      notesText,
      termsText,
      emailEnabled,
      whatsappEnabled
    } = req.body;

    const result = await pool.query(
      `INSERT INTO quotation_templates (seller_id, template_name, template_preset, header_text, body_template, footer_text, company_phone, company_email, company_address, header_image_data, show_header_image, logo_image_data, show_logo_only, accent_color, notes_text, terms_text, email_enabled, whatsapp_enabled)
       VALUES ($1, 'default', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (seller_id, template_name)
       DO UPDATE SET
          template_preset = EXCLUDED.template_preset,
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
          accent_color = EXCLUDED.accent_color,
          notes_text = EXCLUDED.notes_text,
          terms_text = EXCLUDED.terms_text,
          email_enabled = EXCLUDED.email_enabled,
          whatsapp_enabled = EXCLUDED.whatsapp_enabled,
          updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        tenantId,
        normalizeTemplatePreset(templatePreset),
        headerText || null,
        bodyTemplate || null,
        footerText || null,
        companyPhone || null,
        companyEmail || null,
        companyAddress || null,
        headerImageData || null,
        Boolean(showHeaderImage),
        logoImageData || null,
        Boolean(showLogoOnly),
        accentColor || "#2563eb",
        notesText || null,
        termsText || null,
        Boolean(emailEnabled),
        Boolean(whatsappEnabled)
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/", requirePermission(PERMISSIONS.QUOTATION_CREATE), async (req, res) => {
  try {
    const tenantId = req.user.isPlatformAdmin ? Number(req.body.sellerId || getTenantId(req)) : getTenantId(req);
    const data = await createQuotationWithItems({
      ...req.body,
      sellerId: tenantId,
      createdBy: req.body.createdBy || req.user.id,
      sourceChannel: req.body.sourceChannel || "manual"
    });
    res.status(201).json(data);
  } catch (error) {
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

    if (normalizedDeliveryType === "DOORSTEP" && (!deliveryAddress || !deliveryPincode)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "deliveryAddress and deliveryPincode are required for DOORSTEP delivery" });
    }

    const normalizedItems = items.map((item) => ({
      product_id: item.productId || item.product_id || null,
      variant_id: item.variantId || item.variant_id || null,
      size: item.size || null,
      quantity: toAmount(item.quantity),
      unit_price: toAmount(item.unitPrice ?? item.unit_price),
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

    await validateQuotationItemRateLimits(client, tenantId, normalizedItems);

    const customColumns = await getSellerCustomQuotationColumns(client, tenantId);
    const computedItems = applyComputedQuotationFields(normalizedItems, customColumns);
    validateCustomQuotationFields(computedItems, customColumns);

    const totals = computeQuotationTotals({
      items: computedItems,
      gstPercent: req.body.gstPercent ?? quotation.gst_percent ?? 0,
      transportCharges: req.body.transportCharges ?? quotation.transport_charges ?? 0,
      designCharges: req.body.designCharges ?? quotation.design_charges ?? 0,
      discountAmount: req.body.discountAmount ?? quotation.discount_amount ?? 0,
      advanceAmount: req.body.advanceAmount ?? quotation.advance_amount ?? 0
    });

    await restoreInventoryForItems(client, tenantId, existingItems);
    const inventoryWarnings = await reserveInventoryForItems(client, tenantId, totals.normalizedItems, { strict: false });

    await client.query(`DELETE FROM quotation_items WHERE quotation_id = $1 AND seller_id = $2`, [id, tenantId]);

    for (const item of totals.normalizedItems) {
      await client.query(
        `INSERT INTO quotation_items
         (quotation_id, seller_id, product_id, variant_id, size, quantity, unit_price, total_price, material_type, thickness, design_name, sku, color_name, imported_color_note, ps_included, dimension_height, dimension_width, dimension_unit, item_note, pricing_type, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, COALESCE($21::jsonb, '{}'::jsonb))`,
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
          JSON.stringify(item.custom_fields || {})
        ]
      );
    }

    const nextVersion = Number(quotation.version_no || 1) + 1;
    const updateResult = await client.query(
      `UPDATE quotations
       SET subtotal = $1,
           gst_amount = $2,
           transport_charges = $3,
           design_charges = $4,
           total_amount = $5,
           discount_amount = $6,
           advance_amount = $7,
           balance_amount = $8,
           delivery_type = $9,
           delivery_date = $10,
           delivery_address = $11,
           delivery_pincode = $12,
           transportation_cost = $13,
           design_cost_confirmed = $14,
           order_status = $15,
           payment_status = $16,
           version_no = $17,
           custom_quotation_number = $18
       WHERE id = $19 AND seller_id = $20
       RETURNING *`,
      [
        totals.subtotal,
        totals.gstAmount,
        totals.transport,
        totals.design,
        totals.totalAmount,
        totals.discountAmount,
        totals.advanceAmount,
        totals.balanceAmount,
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
        id,
        tenantId
      ]
    );

    const updatedQuotation = updateResult.rows[0];
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
      `SELECT q.*, c.name AS customer_name, c.firm_name, c.mobile, c.email, c.gst_number AS customer_gst_number, c.shipping_addresses AS customer_shipping_addresses, s.gst_number AS seller_gst_number
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
      inventoryWarnings
    });
  } catch (error) {
    await client.query("ROLLBACK");
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
