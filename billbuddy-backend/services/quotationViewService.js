function toDisplayString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function humanizeQuotationFieldKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getQuotationCustomFieldEntries(customFields = {}) {
  return Object.entries(customFields || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => ({
      key,
      label: humanizeQuotationFieldKey(key),
      value: typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)
    }));
}

function getQuotationItemTitle(item = {}) {
  const parts = [];
  const color = toDisplayString(item.color_name || item.colorName || item.imported_color_note || item.importedColorNote || "");
  const name = toDisplayString(
    item.material_name ||
    item.materialName ||
    item.material_type ||
    item.materialType ||
    item.design_name ||
    item.designName ||
    item.sku ||
    "Item"
  );

  if (color) parts.push(color);
  if (name) parts.push(name);

  return parts.filter(Boolean).join(" ");
}

function getQuotationItemDimensionText(item = {}) {
  const width = item.dimension_width ?? item.dimensionWidth ?? item.width ?? null;
  const height = item.dimension_height ?? item.dimensionHeight ?? item.height ?? null;
  if (width || height) return `${width || 0} x ${height || 0}`;
  return toDisplayString(item.size) || "-";
}

function getQuotationItemQuantityValue(item = {}) {
  const quantity = item.quantity ?? 0;
  return Number.isFinite(Number(quantity)) ? Number(quantity) : 0;
}

function getQuotationItemRateValue(item = {}) {
  const rate = item.unit_price ?? item.unitPrice ?? item.rateValue ?? item.rate ?? 0;
  return Number.isFinite(Number(rate)) ? Number(rate) : 0;
}

function getQuotationItemTotalValue(item = {}) {
  const total = item.total_price ?? item.totalPrice ?? item.total ?? null;
  if (total !== null && total !== undefined && total !== "") {
    return Number.isFinite(Number(total)) ? Number(total) : 0;
  }
  return Number((getQuotationItemQuantityValue(item) * getQuotationItemRateValue(item)).toFixed(2));
}

function getQuotationSummaryRows({
  totalAmount = 0,
  discountAmount = 0,
  advanceAmount = 0,
  balanceAmount = 0
} = {}) {
  const rows = [{ label: "Total Amount", value: Number(totalAmount || 0) }];
  if (Number(discountAmount || 0) > 0) rows.push({ label: "Discount", value: Number(discountAmount || 0) });
  if (Number(advanceAmount || 0) > 0) rows.push({ label: "Advance", value: Number(advanceAmount || 0) });
  rows.push({ label: "Balance Amount", value: Number(balanceAmount || totalAmount || 0), accent: true });
  return rows;
}

module.exports = {
  getQuotationCustomFieldEntries,
  getQuotationItemDimensionText,
  getQuotationItemQuantityValue,
  getQuotationItemRateValue,
  getQuotationItemTitle,
  getQuotationItemTotalValue,
  getQuotationSummaryRows,
  humanizeQuotationFieldKey
};
