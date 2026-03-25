function toDisplayString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function normalizeItemDisplayConfig(config = {}) {
  const categoryRules = Array.isArray(config.categoryRules) ? config.categoryRules : [];
  return {
    defaultPattern: String(config.defaultPattern || "").trim(),
    categoryRules: categoryRules
      .map((rule) => ({
        category: String(rule.category || "").trim(),
        pattern: String(rule.pattern || "").trim()
      }))
      .filter((rule) => rule.category && rule.pattern)
  };
}

function normalizeItemDisplayKey(key) {
  const normalized = String(key || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
  if (normalized === "colour" || normalized === "colour_name") return "color_name";
  if (normalized === "other_info") return "imported_color_note";
  if (normalized === "note") return "item_note";
  if (normalized === "material" || normalized === "material_type" || normalized === "product_name" || normalized === "service_name") return "material_name";
  return normalized;
}

export function getItemDisplayFieldValue(item = {}, key) {
  const normalizedKey = normalizeItemDisplayKey(key);
  if (!normalizedKey) return "";
  const customFields = item.custom_fields || item.customFields || {};
  const customFieldEntry = Object.entries(customFields).find(([customKey]) => normalizeItemDisplayKey(customKey) === normalizedKey);
  const customFieldValue = customFields[normalizedKey] ?? (customFieldEntry ? customFieldEntry[1] : undefined);
  const directValueMap = {
    material_name: item.material_name || item.materialName || item.material_type || item.materialType || item.design_name || item.designName || item.sku || "",
    category: item.item_category || item.itemCategory || item.category || "",
    sku: item.sku || "",
    color_name: item.color_name || item.colorName || "",
    thickness: item.thickness || "",
    size: customFieldValue ?? item.size ?? "",
    quantity: item.quantity,
    rate: item.unit_price ?? item.unitPrice ?? item.rate ?? "",
    unit_price: item.unit_price ?? item.unitPrice ?? item.rate ?? "",
    item_note: item.item_note || item.itemNote || "",
    imported_color_note: item.imported_color_note || item.importedColorNote || "",
    width: item.dimension_width ?? item.dimensionWidth ?? item.width ?? "",
    height: item.dimension_height ?? item.dimensionHeight ?? item.height ?? "",
    unit: item.dimension_unit || item.dimensionUnit || item.unit || ""
  };
  const rawValue = Object.prototype.hasOwnProperty.call(directValueMap, normalizedKey)
    ? directValueMap[normalizedKey]
    : customFieldValue;
  if (rawValue === undefined || rawValue === null) return "";
  if (typeof rawValue === "boolean") return rawValue ? "Yes" : "";
  return String(rawValue).trim();
}

export function buildConfiguredQuotationItemTitle(item = {}, config = {}) {
  const normalizedConfig = normalizeItemDisplayConfig(config);
  const itemCategory = toDisplayString(item.item_category || item.itemCategory || item.category);
  const categoryPattern = normalizedConfig.categoryRules.find(
    (rule) => toDisplayString(rule.category).toLowerCase() === itemCategory.toLowerCase()
  )?.pattern;
  const pattern = categoryPattern || normalizedConfig.defaultPattern;

  if (!pattern) {
    return "";
  }

  const tokens = [];
  const tokenRegex = /\{([^{}\[\]]+)\}|\[([^[\]{}]+)\]/g;
  let cursor = 0;
  let match = tokenRegex.exec(pattern);
  while (match) {
    if (match.index > cursor) {
      tokens.push({ type: "text", value: pattern.slice(cursor, match.index) });
    }
    tokens.push({ type: "field", value: (match[1] || match[2] || "").trim() });
    cursor = match.index + match[0].length;
    match = tokenRegex.exec(pattern);
  }
  if (cursor < pattern.length) {
    tokens.push({ type: "text", value: pattern.slice(cursor) });
  }

  const rendered = [];
  tokens.forEach((token) => {
    if (token.type === "text") {
      rendered.push(token.value);
      return;
    }
    const fieldValue = getItemDisplayFieldValue(item, token.value);
    if (fieldValue) {
      rendered.push(fieldValue);
      return;
    }
    if (rendered.length && typeof rendered[rendered.length - 1] === "string") {
      rendered.pop();
    }
  });

  return rendered
    .join("")
    .replace(/\s+/g, " ")
    .replace(/\s+([,/-])/g, "$1")
    .replace(/([/-])\s+/g, "$1 ")
    .trim();
}

export function humanizeQuotationFieldKey(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getQuotationCustomFieldEntries(customFields = {}) {
  return Object.entries(customFields || {})
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => ({
      key,
      label: humanizeQuotationFieldKey(key),
      value: typeof value === "boolean" ? (value ? "Yes" : "No") : String(value)
    }));
}

export function getQuotationItemTitle(item = {}) {
  const configuredTitle = toDisplayString(item.item_display_text || item.itemDisplayText || "");
  if (configuredTitle) return configuredTitle;

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
    item.descriptor ||
    "Item"
  );

  if (color) parts.push(color);
  if (name) parts.push(name);

  return parts.filter(Boolean).join(" ");
}

export function getQuotationItemDimensionText(item = {}) {
  const width = item.dimension_width ?? item.dimensionWidth ?? item.width ?? null;
  const height = item.dimension_height ?? item.dimensionHeight ?? item.height ?? null;
  if (width || height) return `${width || 0} x ${height || 0}`;
  return toDisplayString(item.size) || "-";
}

export function getQuotationItemQuantityValue(item = {}) {
  const quantity = item.quantity ?? 0;
  return Number.isFinite(Number(quantity)) ? Number(quantity) : 0;
}

export function getQuotationItemRateValue(item = {}) {
  const rate = item.unit_price ?? item.unitPrice ?? item.rateValue ?? item.rate ?? 0;
  return Number.isFinite(Number(rate)) ? Number(rate) : 0;
}

export function getQuotationItemTotalValue(item = {}) {
  const total = item.total_price ?? item.totalPrice ?? item.total ?? null;
  if (total !== null && total !== undefined && total !== "") {
    return Number.isFinite(Number(total)) ? Number(total) : 0;
  }
  return Number((getQuotationItemQuantityValue(item) * getQuotationItemRateValue(item)).toFixed(2));
}

export function getQuotationSummaryRows({
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
