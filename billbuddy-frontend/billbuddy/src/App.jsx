import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./App.css";
import { apiFetch } from "./api";
import ResponsiveQuotationApp from "./ResponsiveQuotationApp";
import {
  getQuotationCustomFieldEntries,
  getQuotationItemDimensionText,
  getQuotationItemQuantityValue,
  getQuotationItemRateValue,
  getQuotationItemTitle,
  getQuotationItemTotalValue
} from "./utils/quotationView";
import quicksyLogo from "./assets/QUICKSY_1.png";
import samsonaLogo from "./assets/Samsona_Services_Logo_Transparent.png";
import srijanLabsLogo from "./assets/Srijan_Labs.png";
import srijanHero from "./assets/srijan_hero.png";
import spanLogo from "./assets/span.jpeg";

const SELLER_MODULES = [
  "Dashboard",
  "Users",
  "Orders",
  "Products",
  "Customers",
  "Configuration Studio",
  "Subscriptions",
  "Payments",
  "Reports & Analytics",
  "Settings"
];

const PLATFORM_MODULES = [
  "Dashboard",
  "Leads",
  "Sellers",
  "Configuration Studio",
  "Subscriptions",
  "Plans",
  "Notifications",
  "Users",
  "Settings"
];

const QUICK_ACTIONS = ["Create Order", "Add Customer"];

const THEME_OPTIONS = [
  { value: "matte-blue", label: "Matte Blue" },
  { value: "sky-blue", label: "Sky Blue" },
  { value: "deep-ocean", label: "Deep Ocean" },
  { value: "cobalt-frost", label: "Cobalt Frost" }
];

const SELLER_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected" },
  { value: "inactive", label: "Inactive" }
];

const BILLING_CYCLE_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" }
];

const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
  { value: "suspended", label: "Suspended" }
];

const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "demo_scheduled", label: "Demo Scheduled" },
  { value: "demo_created", label: "Demo Created" },
  { value: "follow_up", label: "Follow-up" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" }
];

const ORDER_STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "READY_DISPATCH", label: "Ready for Dispatched" },
  { value: "READY_PICKUP", label: "Ready for Pickup" },
  { value: "DELIVERED", label: "Delivered" }
];

const MODULE_META = {
  Dashboard: { eyebrow: "Control Center", title: "Operations Dashboard", subtitle: "A polished daily cockpit for orders, quotations, dispatch, and receivables." },
  Users: { eyebrow: "Access", title: "User Access Management", subtitle: "Create master users and team accounts with clear role control." },
  Orders: { eyebrow: "Workflow", title: "Order Tracker", subtitle: "Monitor quotation status, payment flow, and message-based order capture." },
  Products: { eyebrow: "Catalogue", title: "Product Catalogue", subtitle: "Manage upload-ready product structure for matching, inventory, and pricing." },
  Customers: { eyebrow: "CRM", title: "Customer Directory", subtitle: "Keep your customer master clean, searchable, and ready for quotation flow." },
  "Configuration Studio": { eyebrow: "Schema", title: "Configuration Studio", subtitle: "Configure seller-specific catalogue structure, quotation columns, preview, and publishing in one workspace." },
  Subscriptions: { eyebrow: "Plan", title: "Subscription History", subtitle: "Review active, expired, suspended, and historical subscriptions for this seller account." },
  Settings: { eyebrow: "Configuration", title: "Business Settings", subtitle: "Fine tune seller branding, message decoding, quotation design, and platform setup." }
};

const QUOTATION_TEMPLATE_PRESETS = {
  commercial_offer: {
    label: "Commercial Offer",
    description: "Offer-style quotation with softer narrative copy.",
    defaults: {
      header_text: "Commercial Offer",
      body_template: "Dear {{customer_name}}, thank you for your enquiry. Please find our offer for quotation {{quotation_number}}.",
      footer_text: "We look forward to working with you.",
      accent_color: "#2563eb",
      notes_text: "Delivery and installation charges are extra unless mentioned.",
      terms_text: "Payment terms and final scope will be confirmed at order stage."
    }
  },
  invoice_classic: {
    label: "Invoice Classic",
    description: "Structured invoice-like layout with logo, company block, and compact commercial summary.",
    defaults: {
      header_text: "Quotation",
      body_template: "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your review.",
      footer_text: "Thank you for the opportunity to serve you.",
      accent_color: "#0f4c81",
      notes_text: "Freight, unloading, and site execution are extra unless specifically included.",
      terms_text: "Rates are exclusive of applicable taxes unless otherwise stated. Validity and payment terms will apply as per final order confirmation."
    }
  },
  executive_boardroom: {
    label: "Executive Boardroom",
    description: "Formal, boardroom-style quotation with sharper hierarchy, flatter layout, and a proposal-like commercial summary.",
    defaults: {
      header_text: "Sai Laser Pvt. Ltd.",
      body_template: "Dear {{customer_name}}, please find our commercial quotation {{quotation_number}} for your review.",
      footer_text: "We appreciate the opportunity to work with you.",
      accent_color: "#111827",
      notes_text: "Freight, unloading, and site execution are extra unless specifically included.",
      terms_text: "Rates are exclusive of applicable taxes. Final scope, taxes, and payment terms apply as per confirmation."
    }
  },
  industrial_invoice: {
    label: "Industrial Invoice",
    description: "Structured GST-style quotation with a hard header band, dense customer/meta grid, and strict bordered item table.",
    defaults: {
      header_text: "Sai Laser Pvt. Ltd.",
      body_template: "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your review.",
      footer_text: "Manufacturing & Supply of Precision Components",
      accent_color: "#1f2c63",
      notes_text: "Freight, unloading, and site execution are extra unless specifically included.",
      terms_text: "Rates are exclusive of applicable taxes. Final scope, taxes, and payment terms apply as per final confirmation."
    }
  },
  html_puppeteer: {
    label: "HTML Puppeteer",
    description: "Browser-rendered quotation matching the structured invoice reference while preserving BillBuddy logic.",
    defaults: {
      header_text: "Sai Laser Pvt. Ltd.",
      body_template: "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your review.",
      footer_text: "Manufacturing & Supply of Precision Components",
      accent_color: "#1f2c63",
      notes_text: "Freight, unloading, and site execution are extra unless specifically included.",
      terms_text: "Rates are exclusive of applicable taxes. Final scope, taxes, and payment terms apply as per final confirmation."
    }
  }
};

const PLATFORM_MODULE_META = {
  Dashboard: { eyebrow: "Platform", title: "BillBuddy Control Plane", subtitle: "See seller growth, billing drivers, onboarding progress, and account health in one place." },
  Leads: { eyebrow: "Pipeline", title: "Lead Management", subtitle: "Capture, qualify, and progress prospective sellers from first touch to onboarding." },
  Sellers: { eyebrow: "Tenants", title: "Seller Management", subtitle: "Create sellers, review lifecycle, and manage tenant health from a dedicated operating screen." },
  "Configuration Studio": { eyebrow: "Schema", title: "Seller Configuration Studio", subtitle: "Configure catalogue fields, quotation columns, preview, and publishing as a full workspace instead of a modal." },
  Subscriptions: { eyebrow: "Entitlements", title: "Subscription Management", subtitle: "Review active seller plans, trial windows, and plan state without mixing it into seller profile edits." },
  Plans: { eyebrow: "Commercials", title: "Plan Management", subtitle: "Manage BillBuddy plans, feature limits, and upgrade paths in one place." },
  Notifications: { eyebrow: "Engagement", title: "Notification Center", subtitle: "Create platform notices for seller segments and review delivery logs in one place." },
  Users: { eyebrow: "Platform Access", title: "Platform User Management", subtitle: "Control platform-level user access, seller-side administrators, and access governance." },
  Settings: { eyebrow: "Platform Setup", title: "Platform Settings", subtitle: "Onboard sellers, manage lifecycle, and configure the SaaS operating model." }
};

const SUPPORTED_CATALOGUE_FIELD_META = {
  material_name: { formKey: "materialName", label: "Product / Service Name", inputType: "text", required: true },
  material_group: { formKey: "materialGroup", label: "Material Group", inputType: "text" },
  category: { formKey: "category", label: "Category", inputType: "text", required: true },
  color_name: { formKey: "colorName", label: "Colour Name", inputType: "text" },
  thickness: { formKey: "thickness", label: "Thickness", inputType: "text" },
  unit_type: { formKey: "unitType", label: "Unit Type", inputType: "unit-select" },
  pricing_type: { formKey: "pricingType", label: "Pricing Type", inputType: "pricing-select" },
  base_price: { formKey: "basePrice", label: "Base Price", inputType: "number", required: true },
  sku: { formKey: "sku", label: "SKU ID", inputType: "text", required: true },
  always_available: { formKey: "alwaysAvailable", label: "Always Available", inputType: "checkbox" },
  ps_supported: { formKey: "psSupported", label: "PS Supported", inputType: "checkbox" }
};

const MANDATORY_SYSTEM_CATALOGUE_KEYS = ["material_name", "category", "sku"];

const SUPPORTED_QUOTATION_COLUMN_META = {
  material_name: { formKey: "materialName", label: "Material Name", inputType: "text" },
  category: { formKey: "category", label: "Category", inputType: "category-select" },
  width: { formKey: "width", label: "Width", inputType: "number" },
  height: { formKey: "height", label: "Height", inputType: "number" },
  unit: { formKey: "unit", label: "Unit", inputType: "unit-select" },
  thickness: { formKey: "thickness", label: "Thickness", inputType: "text" },
  color_name: { formKey: "color", label: "Colour", inputType: "text" },
  other_info: { formKey: "otherInfo", label: "Other Info", inputType: "text" },
  ps: { formKey: "ps", label: "PS", inputType: "checkbox" },
  quantity: { formKey: "quantity", label: "Quantity", inputType: "number" },
  rate: { formKey: "rate", label: "Rate", inputType: "number" },
  note: { formKey: "note", label: "Item Note", inputType: "text", fullWidth: true }
};

function getStoredAuth() {
  try {
    let raw = sessionStorage.getItem("billbuddyAuth");
    if (!raw) {
      raw = localStorage.getItem("billbuddyAuth");
      if (raw) {
        sessionStorage.setItem("billbuddyAuth", raw);
      }
    }
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function formatDateIST(value) {
  if (!value) return "-";
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

function formatQuotationLabel(quotation) {
  const visibleNumber = quotation?.custom_quotation_number || quotation?.seller_quotation_number || quotation?.quotation_number;
  if (!visibleNumber) return "-";
  return `${visibleNumber} (Ver.${quotation.version_no || 1})`;
}

function getVisibleQuotationNumber(quotation) {
  return quotation?.custom_quotation_number || quotation?.seller_quotation_number || quotation?.quotation_number || "";
}

function getQuotationFileStem(quotation) {
  const visibleNumber = getVisibleQuotationNumber(quotation) || "quotation";
  const version = quotation?.version_no || 1;
  return `${String(visibleNumber).replace(/[^a-zA-Z0-9-_]+/g, "_")}_ver_${version}`;
}

function statusLabel(status) {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partial";
  return "Pending";
}

function orderStatusLabel(status) {
  if (status === "READY_DISPATCH") return "Ready for Dispatched";
  if (status === "READY_PICKUP") return "Ready for Pickup";
  if (status === "DELIVERED") return "Delivered";
  return "New";
}

function renderTemplateText(template, data) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : "";
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

function normalizeConfigKey(value) {
  const normalized = normalizeHeader(value);
  if (normalized === "colour") return "color_name";
  if (normalized === "colour_name") return "color_name";
  if (normalized === "material") return "material_name";
  if (normalized === "service") return "material_name";
  if (normalized === "services") return "material_name";
  if (normalized === "service_name") return "material_name";
  if (normalized === "services_name") return "material_name";
  if (normalized === "service_title") return "material_name";
  if (normalized === "services_title") return "material_name";
  if (normalized === "item_name") return "material_name";
  if (normalized === "product_name") return "material_name";
  if (normalized === "price") return "base_price";
  if (normalized === "item_note") return "note";
  return normalized;
}

function getSupportedCatalogueFields(configuration) {
  const configured = configuration?.catalogueFields || [];
  const fallbackFields = createDefaultSellerConfiguration().catalogueFields;
  const resolved = configured
    .map((field) => {
      const normalizedKey = normalizeConfigKey(field.key);
      if (!SUPPORTED_CATALOGUE_FIELD_META[normalizedKey]) return null;
      return {
        ...field,
        normalizedKey,
        meta: SUPPORTED_CATALOGUE_FIELD_META[normalizedKey]
      };
    })
    .filter(Boolean);

  if (resolved.length) {
    const mandatoryFallbacks = fallbackFields
      .filter((field) => MANDATORY_SYSTEM_CATALOGUE_KEYS.includes(normalizeConfigKey(field.key)))
      .filter((field) => !resolved.some((entry) => entry.normalizedKey === normalizeConfigKey(field.key)))
      .map((field) => ({
        ...field,
        normalizedKey: normalizeConfigKey(field.key),
        meta: SUPPORTED_CATALOGUE_FIELD_META[normalizeConfigKey(field.key)]
      }));
    return [...mandatoryFallbacks, ...resolved];
  }

  return fallbackFields
    .map((field) => ({
      ...field,
      normalizedKey: normalizeConfigKey(field.key),
      meta: SUPPORTED_CATALOGUE_FIELD_META[normalizeConfigKey(field.key)]
    }))
    .filter((field) => field.meta);
}

function getUnsupportedCatalogueFields(configuration) {
  return (configuration?.catalogueFields || []).filter((field) => !SUPPORTED_CATALOGUE_FIELD_META[normalizeConfigKey(field.key)]);
}

function sortConfigEntries(entries = []) {
  return [...entries].sort((a, b) => {
    const aOrder = Number.isFinite(Number(a?.displayOrder)) ? Number(a.displayOrder) : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(Number(b?.displayOrder)) ? Number(b.displayOrder) : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a?.label || a?.key || "").localeCompare(String(b?.label || b?.key || ""));
  });
}

function getSupportedQuotationColumns(configuration) {
  const configured = configuration?.quotationColumns || [];
  const resolved = configured
    .map((column) => {
      const normalizedKey = normalizeConfigKey(column.key);
      if (!SUPPORTED_QUOTATION_COLUMN_META[normalizedKey]) return null;
      return {
        ...column,
        normalizedKey,
        meta: SUPPORTED_QUOTATION_COLUMN_META[normalizedKey]
      };
    })
    .filter(Boolean);

  if (resolved.length) return resolved;

  return createDefaultSellerConfiguration().quotationColumns
    .map((column) => ({
      ...column,
      normalizedKey: normalizeConfigKey(column.key),
      meta: SUPPORTED_QUOTATION_COLUMN_META[normalizeConfigKey(column.key)]
    }))
    .filter((column) => column.meta);
}

function getUnsupportedQuotationColumns(configuration) {
  return (configuration?.quotationColumns || []).filter((column) => !SUPPORTED_QUOTATION_COLUMN_META[normalizeConfigKey(column.key)]);
}

function getProductPreviewFieldValue(row, field) {
  const normalizedKey = field.normalizedKey || normalizeConfigKey(field.key);
  switch (normalizedKey) {
    case "material_name":
      return row.materialName || "-";
    case "category":
      return row.category || "-";
    case "thickness":
      return row.thickness || "-";
    case "unit_type":
      return row.unitType || "-";
    case "base_price":
      return row.basePrice ?? 0;
    case "sku":
      return row.sku || "-";
    case "material_group":
      return row.materialGroup || "-";
    case "color_name":
      return row.colorName || "-";
    case "always_available":
      return row.alwaysAvailable ? "Yes" : "No";
    case "ps_supported":
      return row.psSupported ? "Yes" : "No";
    case "pricing_type":
      return row.pricingType || "-";
    default:
      return row.customFields?.[field.key] ?? "-";
  }
}

function getProductTemplateSampleValue(fieldKey, fieldLabel = "") {
  const label = String(fieldLabel || "").toLowerCase();
  switch (normalizeConfigKey(fieldKey)) {
    case "material_name":
      return label.includes("service") ? "Installation Service" : "Acrylic";
    case "material_group":
      return "Sheets";
    case "category":
      return "Sheet";
    case "color_name":
      return "White";
    case "thickness":
      return "2 mm";
    case "unit_type":
      return "SFT";
    case "pricing_type":
      return "SFT";
    case "base_price":
      return 15;
    case "sku":
      return "ACR-2";
    case "always_available":
      return true;
    case "ps_supported":
      return false;
    default:
      return "";
  }
}

function getProductConfigurationFieldValue(product, fieldKey) {
  if (!product) return "";
  const normalizedKey = normalizeConfigKey(fieldKey);
  switch (normalizedKey) {
    case "material_name":
      return product.material_name || "";
    case "category":
      return product.category || "";
    case "thickness":
      return product.thickness || "";
    case "unit_type":
      return product.unit_type || "";
    case "base_price":
      return product.base_price ?? "";
    case "sku":
      return product.sku || "";
    case "material_group":
      return product.material_group || "";
    case "color_name":
      return product.color_name || "";
    case "always_available":
      return Boolean(product.always_available);
    case "ps_supported":
      return Boolean(product.ps_supported);
    case "pricing_type":
      return product.pricing_type || "";
    default:
      return product.custom_fields?.[fieldKey] ?? product.custom_fields?.[normalizedKey] ?? "";
  }
}

function getCatalogueDrivenQuotationCustomFields(product, columns = [], currentCustomFields = {}) {
  const nextCustomFields = { ...(currentCustomFields || {}) };
  columns.forEach((column) => {
    const boundValue = getProductConfigurationFieldValue(product, column.key);
    if (boundValue !== "" && boundValue !== null && boundValue !== undefined) {
      nextCustomFields[column.key] = boundValue;
    }
  });
  return nextCustomFields;
}

function getProductFieldDisplayValue(product, fieldKey) {
  switch (normalizeConfigKey(fieldKey)) {
    case "material_name":
      return product.material_name || "-";
    case "material_group":
      return product.material_group || "-";
    case "category":
      return product.category || "-";
    case "color_name":
      return product.color_name || "-";
    case "thickness":
      return product.thickness || "-";
    case "unit_type":
      return product.unit_type || "-";
    case "pricing_type":
      return product.pricing_type || "-";
    case "base_price":
      return product.base_price || "-";
    case "sku":
      return product.sku || "-";
    case "always_available":
      return product.always_available ? "Yes" : "No";
    case "ps_supported":
      return product.ps_supported ? "Yes" : "No";
    default:
      return product.custom_fields?.[fieldKey] ?? "-";
  }
}

function getConfiguredOptions(field) {
  return Array.isArray(field?.options)
    ? field.options.map((option) => String(option || "").trim()).filter(Boolean)
    : [];
}

function getOptionsInputValue(field) {
  if (typeof field?.optionsText === "string") return field.optionsText;
  return getConfiguredOptions(field).join(", ");
}

function parseOptionsInput(rawValue) {
  return String(rawValue || "")
    .split(/[,\n|]/)
    .map((option) => option.trim())
    .filter(Boolean);
}

function getCustomProductValidationError(fields = [], customFields = {}) {
  for (const field of fields) {
    const value = customFields?.[field.key];
    const fieldLabel = field.label || field.key || "Custom field";
    const fieldType = String(field.type || "text").toLowerCase();

    if (field.required) {
      if (fieldType === "checkbox") {
        if (value !== true) return `${fieldLabel} is required.`;
      } else if (value === undefined || value === null || String(value).trim() === "") {
        return `${fieldLabel} is required.`;
      }
    }

    if (value !== undefined && value !== null && value !== "") {
      if (fieldType === "number" && Number.isNaN(Number(value))) {
        return `${fieldLabel} must be numeric.`;
      }
      if (fieldType === "checkbox" && typeof value !== "boolean") {
        return `${fieldLabel} must be true or false.`;
      }
      if (fieldType === "dropdown") {
        const allowedOptions = getConfiguredOptions(field);
        if (allowedOptions.length && !allowedOptions.includes(String(value).trim())) {
          return `${fieldLabel} must match one of the configured options.`;
        }
      }
    }
  }

  return "";
}

function getCustomQuotationValidationError(columns = [], customFields = {}) {
  for (const column of columns) {
    const value = customFields?.[column.key];
    const fieldLabel = column.label || column.key || "Custom field";
    const fieldType = String(column.type || "text").toLowerCase();

    if (column.required) {
      if (fieldType === "checkbox") {
        if (value !== true) return `${fieldLabel} is required.`;
      } else if (value === undefined || value === null || String(value).trim() === "") {
        return `${fieldLabel} is required.`;
      }
    }

    if (value !== undefined && value !== null && value !== "") {
      if (fieldType === "number" && Number.isNaN(Number(value))) {
        return `${fieldLabel} must be numeric.`;
      }
      if (fieldType === "checkbox" && typeof value !== "boolean") {
        return `${fieldLabel} must be true or false.`;
      }
      if (fieldType === "dropdown") {
        const allowedOptions = Array.isArray(column.options)
          ? column.options.map((option) => String(option || "").trim()).filter(Boolean)
          : [];
        if (allowedOptions.length && !allowedOptions.includes(String(value).trim())) {
          return `${fieldLabel} must match one of the configured options.`;
        }
      }
    }
  }

  return "";
}

function renderConfigurationPreviewControl(field, keySuffix = "preview") {
  const options = getConfiguredOptions(field);

  if (field.type === "checkbox") {
    return (
      <label className="seller-config-preview-checkbox">
        <input type="checkbox" disabled />
        <span>{field.label || field.key || "Checkbox field"}</span>
      </label>
    );
  }

  if (field.type === "dropdown") {
    return (
      <>
        <select disabled defaultValue="">
          <option value="">{field.label || field.key || "Select option"}</option>
          {options.map((option) => (
            <option key={`${field.id || field.key}-${keySuffix}-${option}`} value={option}>{option}</option>
          ))}
        </select>
        {options.length > 0 && (
          <div className="seller-config-option-chips">
            {options.map((option) => (
              <span key={`${field.id || field.key}-${keySuffix}-chip-${option}`} className="badge pending">{option}</span>
            ))}
          </div>
        )}
      </>
    );
  }

  if (field.type === "formula") {
    return (
      <>
        <input
          placeholder={field.formulaExpression || field.key || "formula_expression"}
          value="Computed automatically"
          readOnly
          disabled
        />
        {(field.definition || field.formulaExpression) && (
          <div className="seller-config-option-chips">
            {field.definition ? <span className="badge pending">{field.definition}</span> : null}
            {field.formulaExpression ? <span className="badge success">{field.formulaExpression}</span> : null}
          </div>
        )}
      </>
    );
  }

  return <input placeholder={field.key || "field_key"} disabled />;
}

function toBool(value) {
  return ["true", "yes", "1"].includes(String(value || "").trim().toLowerCase());
}

function rowHasExcelContent(row) {
  return Object.values(row || {}).some((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function mapProductRow(row) {
  const normalized = Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [normalizeHeader(key), value])
  );

  const primaryName =
    normalized.material_name ||
    normalized.material ||
    normalized.service ||
    normalized.services ||
    normalized.service_name ||
    normalized.services_name ||
    normalized.service_title ||
    normalized.services_title ||
    normalized.item_name ||
    normalized.product_name ||
    normalized.product ||
    normalized.name ||
    "";

  return {
    materialName: String(primaryName).trim(),
    category: String(normalized.category || "").trim() || null,
    thickness: String(normalized.thickness || "").trim() || null,
    unitType: String(normalized.unit_type || normalized.unit || normalized.uom || "COUNT").trim() || "COUNT",
    basePrice: Number(normalized.base_price || normalized.rate || normalized.price || 0),
    sku: String(normalized.sku || "").trim() || null,
    alwaysAvailable: toBool(normalized.always_available),
    materialGroup: String(normalized.material_group || normalized.material_type || "").trim() || null,
    colorName: String(normalized.color_name || normalized.colour_name || normalized.colour || normalized.color || "").trim() || null,
    psSupported: toBool(normalized.ps_supported),
    pricingType: String(normalized.pricing_type || "SFT").trim() || "SFT"
  };
}

function parseProductTextRows(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [materialName, category, thickness, unitType, basePrice, sku, alwaysAvailable] = line.split("|").map((part) => part.trim());
      return {
        materialName,
        category: category || null,
        thickness: thickness || null,
        unitType: unitType || "COUNT",
        basePrice: Number(basePrice || 0),
        sku: sku || null,
        alwaysAvailable: toBool(alwaysAvailable),
        materialGroup: null,
        colorName: null,
        psSupported: false,
        pricingType: "SFT"
      };
    })
    .filter((row) => row.materialName);
}

function validateProductRows(rows) {
  return rows.map((row, index) => {
    const issues = [];
    if (!row.materialName) issues.push("Missing primary item name");
    if (!String(row.category || "").trim()) issues.push("Category is required");
    if (!String(row.sku || "").trim()) issues.push("SKU ID is required");
    if (!["COUNT", "SFT"].includes(String(row.unitType || "").toUpperCase())) {
      issues.push("Unit Type should be COUNT or SFT");
    }
    if (Number.isNaN(Number(row.basePrice))) {
      issues.push("Base Price must be numeric");
    }

    return {
      ...row,
      unitType: String(row.unitType || "COUNT").toUpperCase(),
      basePrice: Number(row.basePrice || 0),
      pricingType: String(row.pricingType || "SFT").toUpperCase(),
      rowNumber: index + 1,
      issues
    };
  });
}

function buildOrderEditForm(details) {
  return {
    customQuotationNumber: details?.quotation?.custom_quotation_number || "",
    deliveryType: details?.quotation?.delivery_type || "PICKUP",
    deliveryDate: details?.quotation?.delivery_date || "",
    deliveryAddress: details?.quotation?.delivery_address || "",
    deliveryPincode: details?.quotation?.delivery_pincode || "",
    transportCharges: String(details?.quotation?.transport_charges || details?.quotation?.transportation_cost || 0),
    designCharges: String(details?.quotation?.design_charges || 0),
    items: (details?.items || []).map((item) => ({
      id: item.id,
      productId: item.product_id || "",
      variantId: item.variant_id || "",
      materialName: item.material_name || item.material_type || item.design_name || item.sku || "",
      materialType: item.material_type || "",
      thickness: item.thickness || "",
      size: item.size || "",
      quantity: String(item.quantity ?? ""),
      unitPrice: String(item.unit_price ?? ""),
      sku: item.sku || ""
    }))
  };
}

function normalizeForCompare(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value).trim().toLowerCase();
}

function getVersionLabel(version) {
  return `Ver.${version.version_no}`;
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDateTime(value) {
  return formatDateIST(value);
}

function formatAuditActionLabel(actionKey) {
  switch (String(actionKey || "").toLowerCase()) {
    case "seller_created":
      return "Seller created";
    case "seller_lifecycle_updated":
      return "Seller lifecycle updated";
    case "subscription_updated":
      return "Subscription updated";
    case "seller_upgrade_requested":
      return "Upgrade requested";
    case "user_password_reset":
      return "Password reset";
    case "lead_created":
      return "Lead created";
    case "lead_updated":
      return "Lead updated";
    case "note_added":
      return "Note added";
    case "demo_created":
      return "Demo created";
    case "seller_created_from_lead":
      return "Seller created from lead";
    default:
      return String(actionKey || "activity").replace(/_/g, " ");
  }
}

function getPaidPlanSuggestions(plans, currentPlanCode) {
  return (plans || [])
    .filter((plan) => Boolean(plan.is_active) && !plan.is_demo_plan && plan.plan_code !== currentPlanCode)
    .sort((left, right) => Number(left.price || 0) - Number(right.price || 0))
    .slice(0, 3);
}

function getSubscriptionBannerData(seller, plans = []) {
  const subscription = seller?.currentSubscription;
  if (!subscription) return null;

  const planName = subscription.plan_name || subscription.plan_code || seller?.subscription_plan || "Plan";
  const suggestedPlans = getPaidPlanSuggestions(plans, subscription.plan_code || seller?.subscription_plan);
  const trialDays = daysUntil(subscription.trial_end_at || seller?.trial_ends_at);
  const statusLabel = String(subscription.status || "").toLowerCase();
  const isTrial = String(subscription.status || "").toLowerCase() === "trial" || Boolean(subscription.is_demo_plan);
  const isExpired = Boolean(subscription.is_expired);

  if (isExpired) {
    return {
      tone: "error",
      title: `${planName} has expired`,
      message: subscription.quotation_creation_locked_after_expiry
        ? "Quotation creation is locked until the account is upgraded to a paid plan."
        : "Trial period has ended. Please upgrade the plan.",
      suggestedPlans,
      showUpgradeCta: true
    };
  }

  if (isTrial) {
    return {
      tone: "warning",
      title: `${planName} is active`,
      message: trialDays !== null
        ? `${Math.max(trialDays, 0)} day(s) remaining in trial. Trial quotations will carry a watermark.`
        : "Trial access is active. Trial quotations will carry a watermark.",
      suggestedPlans,
      showUpgradeCta: true
    };
  }

  return {
    tone: "info",
    title: `${planName} subscription is active`,
    message: statusLabel === "active"
      ? "Your seller account is currently running on the assigned paid subscription."
      : `Current subscription status: ${subscription.status || "active"}.`,
    suggestedPlans: [],
    showUpgradeCta: false
  };
}

function normalizeQuotationWizardCategory(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "product") return "Product";
  if (raw === "services" || raw === "service") return "Services";
  return "Sheet";
}

function createQuotationWizardItem(product = null) {
  return {
    id: null,
    productId: product?.id ? String(product.id) : "",
    materialName: product?.material_name || "",
    category: normalizeQuotationWizardCategory(product?.category),
    color: product?.color_name || "",
    otherInfo: "",
    ps: false,
    thickness: product?.thickness || "",
    height: "",
    width: "",
    unit: "ft",
    quantity: "1",
    rate: product?.base_price ? String(product.base_price) : "",
    note: "",
    customFields: {}
  };
}

function createInitialQuotationWizardState(firstProduct = null) {
  return {
    step: "customer",
    customerMode: "existing",
    customerSearch: "",
    selectedCustomerId: "",
    customer: {
      name: "",
      firmName: "",
      mobile: "",
      email: "",
      address: "",
      gstNumber: "",
      monthlyBilling: false
    },
    itemForm: createQuotationWizardItem(firstProduct),
    items: [],
    amounts: {
      discountAmount: "",
      advanceAmount: "",
      deliveryDate: ""
    },
    submittedQuotation: null
  };
}

function createInitialSingleProductForm() {
  return {
    materialName: "",
    category: "",
    thickness: "",
    unitType: "COUNT",
    basePrice: "",
    sku: "",
    alwaysAvailable: true,
    materialGroup: "",
    colorName: "",
    psSupported: false,
    pricingType: "SFT",
    customFields: {}
  };
}

function toQuotationWizardAmount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function quotationWizardToFeet(value, unit) {
  const numeric = toQuotationWizardAmount(value);
  if (unit === "in") return numeric / 12;
  if (unit === "mm") return numeric * 0.00328084;
  return numeric;
}

function getQuotationWizardRules(item) {
  const category = normalizeQuotationWizardCategory(item?.category);
  return {
    category,
    isSheet: category === "Sheet",
    isProduct: category === "Product",
    isServices: category === "Services"
  };
}

function resolveQuotationWizardRate(item) {
  return toQuotationWizardAmount(item?.rate);
}

function calculateQuotationWizardItemTotal(item) {
  const rules = getQuotationWizardRules(item);
  const rate = resolveQuotationWizardRate(item);
  const quantity = toQuotationWizardAmount(item?.quantity || 0);

  if (rules.isProduct || rules.isServices) {
    return Number((quantity * rate).toFixed(2));
  }

  const widthFeet = quotationWizardToFeet(item?.width, item?.unit);
  const heightFeet = quotationWizardToFeet(item?.height, item?.unit);
  return Number((widthFeet * heightFeet * quantity * rate).toFixed(2));
}

function validateQuotationWizardItem(item) {
  if (!item?.materialName) return false;
  if (resolveQuotationWizardRate(item) <= 0) return false;
  if (toQuotationWizardAmount(item?.quantity) <= 0) return false;
  const rules = getQuotationWizardRules(item);
  if (rules.isSheet) {
    return toQuotationWizardAmount(item?.width) > 0 && toQuotationWizardAmount(item?.height) > 0;
  }
  return true;
}

function buildQuotationWizardPayloadItems(items) {
  return (items || []).map((item) => {
    const rules = getQuotationWizardRules(item);
    const rate = resolveQuotationWizardRate(item);

    if (rules.isProduct || rules.isServices) {
      return {
        product_id: item.productId ? Number(item.productId) : null,
        size: item.note || "-",
        quantity: toQuotationWizardAmount(item.quantity || 0),
        unitPrice: rate,
        materialType: item.materialName,
        designName: item.note || item.materialName,
        thickness: item.thickness || null,
        sku: null,
        colorName: item.color || null,
        importedColorNote: item.otherInfo || null,
        psIncluded: false,
        itemNote: item.note || null,
        pricingType: "UNIT",
        customFields: item.customFields || {}
      };
    }

    const widthFeet = quotationWizardToFeet(item.width, item.unit);
    const heightFeet = quotationWizardToFeet(item.height, item.unit);
    const enteredQuantity = toQuotationWizardAmount(item.quantity || 0);
    const totalArea = Number((widthFeet * heightFeet).toFixed(2));
    const effectiveQuantity = totalArea * enteredQuantity;

    return {
      product_id: item.productId ? Number(item.productId) : null,
      size: `${item.width || 0} x ${item.height || 0}`,
      quantity: enteredQuantity,
      unitPrice: rate,
      totalPrice: Number((effectiveQuantity * rate).toFixed(2)),
      materialType: item.materialName,
      designName: item.note || item.materialName,
      thickness: item.thickness || null,
      sku: item.ps ? "PS" : null,
      colorName: item.color || null,
      importedColorNote: item.otherInfo || null,
      psIncluded: Boolean(item.ps),
      dimensionHeight: toQuotationWizardAmount(item.height),
      dimensionWidth: toQuotationWizardAmount(item.width),
      dimensionUnit: item.unit || "ft",
      itemNote: item.note || null,
      pricingType: "SFT",
      customFields: {
        ...(item.customFields || {}),
        total_area: totalArea
      }
    };
  });
}

function mapProductRowWithConfiguration(row, runtimeFields = [], unsupportedFields = []) {
  const baseRow = mapProductRow(row);
  const normalized = Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [normalizeHeader(key), value])
  );

  const customFields = {};
  unsupportedFields.forEach((field) => {
    const rawValue = normalized[normalizeHeader(field.label)] ?? normalized[normalizeHeader(field.key)];
    if (rawValue === undefined || rawValue === null || rawValue === "") return;
    customFields[field.key] = field.type === "checkbox" ? toBool(rawValue) : rawValue;
  });

  for (const field of runtimeFields) {
    const rawValue = normalized[normalizeHeader(field.label)] ?? normalized[normalizeHeader(field.key)];
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;

    switch (field.normalizedKey) {
      case "material_name":
        baseRow.materialName = String(rawValue).trim();
        break;
      case "material_group":
        baseRow.materialGroup = String(rawValue).trim();
        break;
      case "category":
        baseRow.category = String(rawValue).trim();
        break;
      case "color_name":
        baseRow.colorName = String(rawValue).trim();
        break;
      case "thickness":
        baseRow.thickness = String(rawValue).trim();
        break;
      case "unit_type":
        baseRow.unitType = String(rawValue).trim();
        break;
      case "pricing_type":
        baseRow.pricingType = String(rawValue).trim();
        break;
      case "base_price":
        baseRow.basePrice = Number(rawValue || 0);
        break;
      case "sku":
        baseRow.sku = String(rawValue).trim();
        break;
      case "always_available":
        baseRow.alwaysAvailable = toBool(rawValue);
        break;
      case "ps_supported":
        baseRow.psSupported = toBool(rawValue);
        break;
      default:
        break;
    }
  }

  return {
    ...baseRow,
    customFields
  };
}

function validateProductRowsWithConfiguration(rows, unsupportedFields = [], runtimeFields = []) {
  const primaryNameField = runtimeFields.find((field) => (field.normalizedKey || normalizeConfigKey(field.key)) === "material_name");
  const primaryLabel = primaryNameField?.label || "Primary item name";
  const categoryLabel = runtimeFields.find((field) => (field.normalizedKey || normalizeConfigKey(field.key)) === "category")?.label || "Category";
  const skuLabel = runtimeFields.find((field) => (field.normalizedKey || normalizeConfigKey(field.key)) === "sku")?.label || "SKU ID";
  return validateProductRows(rows).map((row) => {
    const issues = [...(row.issues || [])].map((issue) => {
      if (issue === "Missing primary item name") return `${primaryLabel} is required`;
      if (issue === "Category is required") return `${categoryLabel} is required`;
      if (issue === "SKU ID is required") return `${skuLabel} is required`;
      return issue;
    });
    unsupportedFields.forEach((field) => {
      const value = row.customFields?.[field.key];
      if (field.required && (value === undefined || value === null || String(value).trim() === "")) {
        issues.push(`${field.label} is required`);
      }
      if (field.type === "number" && value !== undefined && value !== null && value !== "" && Number.isNaN(Number(value))) {
        issues.push(`${field.label} must be numeric`);
      }
      if (field.type === "dropdown" && value !== undefined && value !== null && value !== "") {
        const allowedOptions = Array.isArray(field.options)
          ? field.options.map((option) => String(option || "").trim()).filter(Boolean)
          : [];
        if (allowedOptions.length && !allowedOptions.includes(String(value).trim())) {
          issues.push(`${field.label} must match one of the configured options`);
        }
      }
    });

    return {
      ...row,
      issues
    };
  });
}

function createDefaultSellerConfiguration(seller) {
  return {
    sellerId: seller?.id || null,
    profileId: null,
    profileName: `${seller?.name || "Seller"} Default Configuration`,
    status: "draft",
    publishedAt: null,
    updatedAt: null,
    versions: [],
      modules: {
        products: true,
        quotations: true,
        customers: true,
        payments: true,
        reports: true,
        quotationProductSelector: true,
        combineHelpingTextInItemColumn: false
      },
    catalogueFields: [
      { id: "cat-material-name", displayOrder: 1, key: "material_name", label: "Material Name", type: "text", options: [], required: true, visibleInList: true, uploadEnabled: true },
      { id: "cat-category", displayOrder: 2, key: "category", label: "Category", type: "dropdown", options: [], required: true, visibleInList: true, uploadEnabled: true },
      { id: "cat-sku", displayOrder: 3, key: "sku", label: "SKU ID", type: "text", options: [], required: true, visibleInList: true, uploadEnabled: true },
      { id: "cat-thickness", displayOrder: 4, key: "thickness", label: "Thickness", type: "text", options: [], required: false, visibleInList: true, uploadEnabled: true },
      { id: "cat-colour", displayOrder: 5, key: "colour", label: "Colour", type: "text", options: [], required: false, visibleInList: true, uploadEnabled: true },
      { id: "cat-base-price", displayOrder: 6, key: "base_price", label: "Base Price", type: "number", options: [], required: true, visibleInList: true, uploadEnabled: true }
    ],
    quotationColumns: [
        { id: "col-material", displayOrder: 1, key: "material_name", label: "Material", type: "text", options: [], definition: "", formulaExpression: "", required: true, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: false },
        { id: "col-thickness", displayOrder: 2, key: "thickness", label: "Thickness", type: "text", options: [], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: false },
        { id: "col-width", displayOrder: 3, key: "width", label: "Width", type: "number", options: [], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true },
        { id: "col-height", displayOrder: 4, key: "height", label: "Height", type: "number", options: [], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true },
        { id: "col-quantity", displayOrder: 5, key: "quantity", label: "Quantity", type: "number", options: [], definition: "", formulaExpression: "", required: true, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true },
        { id: "col-rate", displayOrder: 6, key: "rate", label: "Rate", type: "number", options: [], definition: "", formulaExpression: "", required: true, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true },
        { id: "col-amount", displayOrder: 7, key: "amount", label: "Amount", type: "formula", options: [], definition: "Calculated line amount", formulaExpression: "width * height * quantity * rate", required: false, visibleInForm: false, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true }
      ]
    };
}

function getQuotationTemplatePresetDefaults(presetKey) {
  return QUOTATION_TEMPLATE_PRESETS[presetKey]?.defaults || QUOTATION_TEMPLATE_PRESETS.commercial_offer.defaults;
}

function mapSellerConfigurationResponse(config, seller) {
  if (!config) {
    return createDefaultSellerConfiguration(seller);
  }

  const fallback = createDefaultSellerConfiguration(seller);

  return {
    ...fallback,
    sellerId: config.sellerId || seller?.id || null,
    profileId: config.profileId || null,
    profileName: config.profileName || fallback.profileName,
    status: config.status || fallback.status,
    publishedAt: config.publishedAt || null,
    updatedAt: config.updatedAt || null,
    versions: Array.isArray(config.versions) ? config.versions : [],
    modules: {
      ...fallback.modules,
      ...(config.modules || {})
    },
    catalogueFields: (Array.isArray(config.catalogueFields) && config.catalogueFields.length ? config.catalogueFields : fallback.catalogueFields)
      .map((field) => ({ ...field, options: Array.isArray(field.options) ? field.options : [] })),
    quotationColumns: (Array.isArray(config.quotationColumns) && config.quotationColumns.length ? config.quotationColumns : fallback.quotationColumns)
      .map((column) => ({
        ...column,
          options: Array.isArray(column.options) ? column.options : [],
          definition: column.definition || "",
          formulaExpression: column.formulaExpression || ""
          ,
          helpTextInPdf: Boolean(column.helpTextInPdf)
        }))
  };
}

function canConvertToPaid(planCode, status, plans) {
  if (String(status || "").toLowerCase() !== "trial") return false;
  const selectedPlan = (plans || []).find((plan) => plan.plan_code === planCode);
  return Boolean(selectedPlan && !selectedPlan.is_demo_plan);
}

function PublicLeadCapturePage({
  form,
  submitting,
  successMessage,
  errorMessage,
  onChange,
  onSubmit
}) {
  return (
    <div className="auth-wrap lead-capture-shell">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>
      <div className="auth-bg-glow" />
      <div className="auth-grid lead-capture-grid">
        <div className="glass-card hero-card">
          <p className="eyebrow">BillBuddy Lead Capture</p>
          <h1>Start with a quick lead form.</h1>
          <p>Share your business details and requirement. Our team will track your lead, schedule a demo if needed, and move you toward onboarding.</p>
          <div className="lead-capture-points">
            <div>
              <strong>No login needed</strong>
              <span>This page is open for direct lead capture.</span>
            </div>
            <div>
              <strong>Demo-friendly</strong>
              <span>Mark demo interest and we’ll route it into the platform lead workflow.</span>
            </div>
            <div>
              <strong>Sales-ready</strong>
              <span>Your form lands directly inside the platform Leads module.</span>
            </div>
          </div>
        </div>

        <form className="glass-card auth-card lead-capture-form" onSubmit={onSubmit}>
          <h2>Lead Form</h2>
          {successMessage && <div className="notice">{successMessage}</div>}
          {errorMessage && <div className="notice error">{errorMessage}</div>}
          <input placeholder="Name" value={form.name} onChange={(e) => onChange("name", e.target.value)} required />
          <input placeholder="Mobile Number" value={form.mobile} onChange={(e) => onChange("mobile", e.target.value)} required />
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => onChange("email", e.target.value)} />
          <input placeholder="Business Name" value={form.businessName} onChange={(e) => onChange("businessName", e.target.value)} />
          <input placeholder="City" value={form.city} onChange={(e) => onChange("city", e.target.value)} />
          <input placeholder="Business Type" value={form.businessType} onChange={(e) => onChange("businessType", e.target.value)} />
          <textarea rows={4} placeholder="Requirement" value={form.requirement} onChange={(e) => onChange("requirement", e.target.value)} />
          <label className="seller-toggle">
            <input type="checkbox" checked={form.interestedInDemo} onChange={(e) => onChange("interestedInDemo", e.target.checked)} style={{ width: "auto" }} />
            Interested in Demo
          </label>
          <button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit Lead"}</button>
          <a className="glass-btn lead-login-link" href="/login">Go to login</a>
        </form>
      </div>
    </div>
  );
}

function PublicDemoSignupPage({
  form,
  submitting,
  successMessage,
  errorMessage,
  onChange,
  onSubmit
}) {
  const demoValueCards = [
    {
      title: "Instant Demo Workspace",
      text: "Create your demo seller account in one step and start exploring the full workflow immediately.",
      tone: "blue"
    },
    {
      title: "14-Day Trial Access",
      text: "Get a ready-to-use BillBuddy workspace with the demo plan applied automatically for two weeks.",
      tone: "indigo"
    },
    {
      title: "Upgrade When Ready",
      text: "Move from demo to a paid seller journey once your team is comfortable with the platform.",
      tone: "mustard"
    }
  ];

  return (
    <div className="auth-wrap lead-capture-shell">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>
      <div className="auth-bg-glow" />
      <div className="auth-grid lead-capture-grid">
        <div className="glass-card hero-card auth-showcase-card">
          <p className="eyebrow">BillBuddy Demo</p>
          <h1>BillBuddy Demo</h1>
          <p>Start a 14-day trial with full access, watermark-enabled quotations, and a ready-to-use seller workspace without waiting for manual onboarding.</p>
          <div className="auth-value-stack">
            {demoValueCards.map((card) => (
              <div key={card.title} className={`auth-value-card auth-value-card-${card.tone}`}>
                <span className="auth-value-icon" aria-hidden="true" />
                <div>
                  <strong>{card.title}</strong>
                  <span>{card.text}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="landing-hero-actions auth-home-link-row">
            <a className="glass-btn lead-login-link" href="/">Back to Home</a>
          </div>
        </div>

        <div className="glass-card auth-card auth-panel-card lead-capture-form">
          <div className="auth-panel-tabs" role="tablist" aria-label="Demo and login navigation">
            <a className="auth-panel-tab auth-panel-tab-link" href="/login">Login</a>
            <span className="auth-panel-tab active">Register for Demo</span>
          </div>
          <div className="auth-panel-divider" />
          <div className="auth-panel-copy">
            <h2>Register for Demo</h2>
            <p>Create your demo seller workspace and start a 14-day trial instantly.</p>
          </div>
          {successMessage && <div className="notice">{successMessage}</div>}
          {errorMessage && <div className="notice error">{errorMessage}</div>}
          <form className="auth-form-shell" onSubmit={onSubmit}>
            <label className="auth-field">
              <span>Your Name</span>
              <input placeholder="Enter your name" value={form.name} onChange={(e) => onChange("name", e.target.value)} required />
            </label>
            <label className="auth-field">
              <span>Mobile Number</span>
              <input placeholder="Enter mobile number" value={form.mobile} onChange={(e) => onChange("mobile", e.target.value)} required />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <input placeholder="Create password" type="password" value={form.password} onChange={(e) => onChange("password", e.target.value)} required />
            </label>
            <label className="auth-field">
              <span>Email</span>
              <input placeholder="Enter email address" type="email" value={form.email} onChange={(e) => onChange("email", e.target.value)} />
            </label>
            <label className="auth-field">
              <span>Business Name</span>
              <input placeholder="Enter business name" value={form.businessName} onChange={(e) => onChange("businessName", e.target.value)} />
            </label>
            <label className="auth-field">
              <span>City</span>
              <input placeholder="Enter city" value={form.city} onChange={(e) => onChange("city", e.target.value)} />
            </label>
            <label className="auth-field">
              <span>State</span>
              <input placeholder="Enter state" value={form.state} onChange={(e) => onChange("state", e.target.value)} />
            </label>
            <label className="auth-field">
              <span>Business Category</span>
              <input placeholder="Enter business category" value={form.businessCategory} onChange={(e) => onChange("businessCategory", e.target.value)} />
            </label>
            <button type="submit" disabled={submitting}>{submitting ? "Creating demo..." : "Create Demo Account"}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function PublicLoginPage({
  bootstrapRequired,
  loginForm,
  setupForm,
  rememberMe,
  errorMessage,
  onLoginFormChange,
  onSetupFormChange,
  onRememberMeChange,
  onLogin,
  onBootstrapAdmin
}) {
  const showSetup = Boolean(bootstrapRequired);
  const showLogin = bootstrapRequired === false;
  const authTitle = showSetup ? "First-Time Setup" : "Login";
  const authSubtitle = showSetup
    ? "Create the first platform admin account to bootstrap BillBuddy."
    : "Sign in to manage quotations, customers, orders, and platform operations.";
  const valueCards = [
    {
      title: "Seller Workspace",
      text: "Manage quotations, customers, products, and orders from one connected workspace.",
      tone: "blue"
    },
    {
      title: "Platform Management",
      text: "Control sellers, subscriptions, onboarding, and governance from a single admin console.",
      tone: "indigo"
    },
    {
      title: "Faster Business",
      text: "Move MSME workflows out of scattered chats and sheets into a clean operating system.",
      tone: "mustard"
    }
  ];

  return (
    <div className="auth-wrap">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>
      <div className="auth-bg-glow" />
      <div className={`auth-grid ${showSetup || showLogin ? "auth-grid-duo" : ""}`}>
        <div className="glass-card hero-card auth-showcase-card">
          <p className="eyebrow">BillBuddy Multi-Tenant SaaS</p>
          <h1>BillBuddy Platform</h1>
          <p>Run your sales, quotations, customer operations, and multi-tenant governance from one connected workspace built for growing MSMEs.</p>
          <div className="auth-value-stack">
            {valueCards.map((card) => (
              <div key={card.title} className={`auth-value-card auth-value-card-${card.tone}`}>
                <span className="auth-value-icon" aria-hidden="true" />
                <div>
                  <strong>{card.title}</strong>
                  <span>{card.text}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="landing-hero-actions auth-home-link-row">
            <a className="glass-btn lead-login-link" href="/">Back to Home</a>
          </div>
        </div>

        <div className="glass-card auth-card auth-panel-card">
          <div className="auth-panel-tabs" role="tablist" aria-label="Authentication mode">
            {showSetup ? (
              <span className="auth-panel-tab active">First-Time Setup</span>
            ) : (
              <>
                <span className="auth-panel-tab active">Login</span>
                <a className="auth-panel-tab auth-panel-tab-link" href="/try-demo">Register for Demo</a>
              </>
            )}
          </div>
          <div className="auth-panel-divider" />
          <div className="auth-panel-copy">
            <h2>{authTitle}</h2>
            <p>{authSubtitle}</p>
          </div>

          {showLogin && (
            <form className="auth-form-shell" onSubmit={onLogin}>
              <label className="auth-field">
                <span>Mobile Number</span>
                <input placeholder="Enter your mobile number" value={loginForm.mobile} onChange={(e) => onLoginFormChange({ ...loginForm, mobile: e.target.value })} required />
              </label>
              <label className="auth-field">
                <span>Password</span>
                <input placeholder="Enter your password" type="password" value={loginForm.password} onChange={(e) => onLoginFormChange({ ...loginForm, password: e.target.value })} required />
              </label>
              <label className="auth-checkbox-row">
                <input type="checkbox" checked={rememberMe} onChange={(e) => onRememberMeChange(e.target.checked)} />
                <span>Remember me on this device</span>
              </label>
              <button type="submit">Sign In</button>
              <div className="auth-panel-footer-note">
                <span>Trusted by growing sellers and teams</span>
                <strong>Built by Srijan Labs</strong>
              </div>
            </form>
          )}

          {showSetup && (
            <form className="auth-form-shell" onSubmit={onBootstrapAdmin}>
              <label className="auth-field">
                <span>Admin Name</span>
                <input placeholder="Enter admin name" value={setupForm.name} onChange={(e) => onSetupFormChange({ ...setupForm, name: e.target.value })} required />
              </label>
              <label className="auth-field">
                <span>Mobile Number</span>
                <input placeholder="Enter admin mobile number" value={setupForm.mobile} onChange={(e) => onSetupFormChange({ ...setupForm, mobile: e.target.value })} required />
              </label>
              <label className="auth-field">
                <span>Password</span>
                <input placeholder="Create admin password" type="password" value={setupForm.password} onChange={(e) => onSetupFormChange({ ...setupForm, password: e.target.value })} required />
              </label>
              <button type="submit">Create Platform Admin</button>
              <div className="auth-panel-footer-note">
                <span>This setup appears only until the first user is created.</span>
                <strong>After setup, normal seller/admin login will appear here.</strong>
              </div>
            </form>
          )}
        </div>
      </div>
      {errorMessage && <div className="error-toast">{errorMessage}</div>}
    </div>
  );
}

function PublicLandingPage() {
  const products = [
    {
      name: "Quicksy",
      eyebrow: "Commerce Platform",
      title: "Smart order and operations management for MSMEs that need speed and control.",
      description:
        "Manage orders, customers, deliveries, and daily execution from one modern system designed to help MSMEs move beyond manual coordination.",
      bullets: [
        "Order management",
        "Customer management",
        "Delivery tracking",
        "Business dashboards"
      ],
      primaryHref: "/lead",
      primaryLabel: "Explore Quicksy"
    },
    {
      name: "BillBuddy",
      eyebrow: "Quotation & Billing SaaS",
      title: "Professional quotation and billing workflows for growing MSME teams.",
      description:
        "Create polished quotations faster, organize customer data, and run billing operations through a scalable multi-user SaaS platform built for digitization.",
      bullets: [
        "Quotation generation",
        "Customer database",
        "GST-ready workflow",
        "Multi-user access"
      ],
      primaryHref: "/try-demo",
      primaryLabel: "Explore BillBuddy"
    }
  ];

  const capabilities = [
    {
      title: "MSME Digitization",
      text: "We help MSMEs move from WhatsApp threads, registers, and scattered sheets into structured digital systems."
    },
    {
      title: "Operational Discipline",
      text: "Our products bring clarity to quotations, orders, follow-ups, and day-to-day business operations."
    },
    {
      title: "Commerce Enablement",
      text: "We build practical platforms for retail, distribution, fabrication, and service-led businesses that need real execution support."
    },
    {
      title: "Growth Readiness",
      text: "We create systems that help MSMEs become more reliable, more measurable, and more ready to scale."
    }
  ];

  const industries = [
    "Retail & Quick Commerce",
    "Manufacturing",
    "Distribution",
    "B2B Trade",
    "Service Businesses",
    "Digital-First Startups"
  ];

  const reasons = [
    {
      title: "Built for real MSME workflows",
      text: "Our products are shaped by how business owners, operators, and teams actually work on the ground."
    },
    {
      title: "Digitization that feels practical",
      text: "We focus on replacing friction with structure, so digitization feels useful from day one instead of overwhelming."
    },
    {
      title: "Ready to grow with you",
      text: "Our systems are secure, scalable, and designed to support future automation, analytics, and expansion."
    }
  ];

  const partners = [
    {
      name: "Samsona",
      role: "Sales & Service Partner",
      logo: samsonaLogo,
      description:
        "Samsona serves as the Sales and Service partner for Srijan Labs, supporting customer acquisition, onboarding, and ongoing service delivery. Their strong field presence and customer support capabilities ensure that businesses adopting our platforms receive timely assistance and smooth implementation.",
      bullets: [
        "Product consultation and onboarding",
        "Implementation support",
        "Customer service and training",
        "Ongoing operational assistance"
      ],
      closing:
        "This collaboration ensures that customers not only adopt our technology but also gain the guidance needed to use it effectively in their daily operations."
    },
    {
      name: "Span Media",
      role: "Hardware Partner – Digital Media Transformation",
      logo: spanLogo,
      description:
        "Span Media partners with Srijan Labs to provide the hardware infrastructure required for digital media transformation solutions. Their expertise in display technologies and digital hardware enables organizations to implement modern screen networks and smart media systems.",
      bullets: [
        "Digital display networks",
        "Commercial screen infrastructure",
        "Media hardware for digital signage",
        "Integrated hardware setups for content management platforms"
      ],
      closing:
        "With Span Media’s hardware capabilities and Srijan Labs’ software platforms, organizations can build complete end-to-end digital media ecosystems."
    }
  ];

  return (
    <div className="landing-shell">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>

      <header className="labs-topbar">
        <div className="labs-topbar-inner">
          <div className="labs-brand">
            <img className="labs-brand-logo" src={srijanLabsLogo} alt="Srijan Labs" />
            <div>
              <div className="labs-brand-title">Srijan Labs</div>
              <div className="labs-brand-subtitle">Digital platforms built to empower MSMEs</div>
            </div>
          </div>

          <nav className="labs-nav">
            <a href="#products">Products</a>
            <a href="#solutions">Solutions</a>
            <a href="#industries">Industries</a>
            <a href="#partners">Partners</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>

          <div className="labs-top-actions">
            <a className="labs-btn labs-btn-secondary" href="/login">Sign In</a>
            <a className="labs-btn labs-btn-primary" href="/try-demo">Get Started</a>
          </div>
        </div>
      </header>

      <main className="labs-main">
        <section className="labs-hero">
          <div className="labs-hero-copy">
            <div className="labs-pill">MSME Digitization · SaaS Products · Operational Systems</div>
            <h1>Empowering MSMEs through practical digitization and modern business software.</h1>
            <p>
              Srijan Labs builds modern SaaS products that help MSMEs digitize quotations, orders, customers,
              billing, and operations without losing the practical rhythm of how their business actually runs.
            </p>
            <div className="labs-hero-actions">
              <a className="labs-btn labs-btn-primary" href="#products">Explore Products</a>
              <a className="labs-btn labs-btn-secondary" href="/lead">Talk to Us</a>
            </div>
            <div className="labs-metrics">
              <div><span>2</span> flagship MSME platforms</div>
              <div><span>Digitization</span> with practical adoption</div>
              <div><span>Built for</span> real business workflows</div>
            </div>
          </div>

          <div className="labs-hero-visual-column">
            <div className="labs-hero-image-wrap">
              <div className="labs-hero-image-frame">
                <img className="labs-hero-image" src={srijanHero} alt="MSME digitization and business operations illustration" />
              </div>
            </div>

            <div className="labs-hero-support-grid">
              <article className="labs-hero-support-card">
                <p className="eyebrow">Quicksy</p>
                <img className="labs-product-logo" src={quicksyLogo} alt="Quicksy" />
                <h4>Commerce operations for MSME teams</h4>
                <div className="labs-mini-list">
                  <span>Orders · Customers · Deliveries</span>
                  <span>Inventory visibility</span>
                </div>
              </article>

              <article className="labs-hero-support-card">
                <p className="eyebrow">BillBuddy</p>
                <h4>Quotation intelligence for modern MSMEs</h4>
                <div className="labs-mini-list">
                  <span>Fast quotation creation</span>
                  <span>Customer database</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="products" className="labs-section">
          <div className="labs-section-head">
            <p className="eyebrow">Our Products</p>
            <h2>Products built to help MSMEs digitize and grow without bloated complexity.</h2>
            <p>A focused product ecosystem for commerce execution, quotation workflows, operational visibility, and everyday business discipline.</p>
          </div>

          <div className="labs-product-grid">
            {products.map((product) => (
              <article key={product.name} className="labs-product-card">
                <div className="labs-product-head">
                  <div>
                    <p className="eyebrow">{product.eyebrow}</p>
                    {product.name === "Quicksy" ? (
                      <img className="labs-product-logo large" src={quicksyLogo} alt="Quicksy" />
                    ) : (
                      <h3>{product.name}</h3>
                    )}
                  </div>
                  <div className="labs-flagship-badge">Flagship</div>
                </div>
                <p className="labs-product-title">{product.title}</p>
                <p className="labs-product-description">{product.description}</p>
                <div className="labs-product-bullets">
                  {product.bullets.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                <div className="labs-product-actions">
                  <a className="labs-btn labs-btn-green" href={product.primaryHref}>{product.primaryLabel}</a>
                  <span>See platform details</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="solutions" className="labs-section labs-section-soft">
          <div className="labs-section-head">
            <p className="eyebrow">Capabilities</p>
            <h2>What we are building for MSMEs moving from manual operations to digital systems.</h2>
          </div>
          <div className="labs-capability-grid">
            {capabilities.map((item) => (
              <article key={item.title} className="labs-capability-card">
                <div className="labs-icon-block" />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="labs-section">
          <div className="labs-dual-showcase">
            <article className="labs-showcase-card dark">
              <p className="eyebrow">Quicksy</p>
              <h3>The modern commerce platform for everyday execution.</h3>
              <p>Built for MSME teams that need operational speed across order management, customer tracking, and delivery orchestration.</p>
              <div className="labs-dark-kpis">
                <div><p>Orders Today</p><strong>284</strong></div>
                <div><p>Active Riders</p><strong>42</strong></div>
              </div>
              <div className="labs-bar-panel">
                <div />
                <div />
                <div />
                <div />
                <div />
              </div>
            </article>

            <article className="labs-showcase-card">
              <p className="eyebrow">BillBuddy</p>
              <h3>Smart quotation and billing control for growth-stage MSMEs.</h3>
              <p>Designed for businesses that need faster quotations, cleaner customer handling, and stronger billing discipline.</p>
              <div className="labs-quote-card">
                <div className="labs-quote-head">
                  <div>
                    <p>Quotation #BB-2048</p>
                    <span>Sai Laser Solutions</span>
                  </div>
                  <div className="labs-live-badge">GST Ready</div>
                </div>
                <div className="labs-quote-lines">
                  <div><span>Acrylic Sheet</span><strong>Rs 14,200</strong></div>
                  <div><span>Laser Cutting</span><strong>Rs 6,850</strong></div>
                  <div><span>GST</span><strong>Rs 3,789</strong></div>
                </div>
                <div className="labs-quote-total"><span>Total</span><strong>Rs 24,839</strong></div>
              </div>
            </article>
          </div>
        </section>

        <section id="partners" className="labs-section labs-section-soft">
          <div className="labs-section-head">
            <p className="eyebrow">Our Partners</p>
            <h2>Built on collaboration that helps businesses digitize faster and operate better.</h2>
            <p>
              At Srijan Labs, we collaborate with trusted partners who extend our ability to deliver reliable technology
              solutions and seamless customer experiences. Our partners help businesses adopt digital transformation
              faster and more efficiently.
            </p>
          </div>

          <div className="labs-partner-grid">
            {partners.map((partner) => (
              <article key={partner.name} className="labs-partner-card">
                <div className="labs-partner-head">
                  <img className="labs-partner-logo" src={partner.logo} alt={partner.name} />
                  <div>
                    <h3>{partner.name}</h3>
                    <p className="labs-partner-role">{partner.role}</p>
                  </div>
                </div>

                <p>{partner.description}</p>

                <div className="labs-partner-points">
                  {partner.bullets.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>

                <p className="labs-partner-closing">{partner.closing}</p>
              </article>
            ))}
          </div>

          <div className="labs-collaboration-note">
            <h3>Built on Collaboration</h3>
            <p>
              By combining technology innovation, strong service support, and reliable hardware infrastructure,
              Srijan Labs and its partners work together to deliver solutions that help businesses operate smarter and scale faster.
            </p>
          </div>
        </section>

        <section id="industries" className="labs-section labs-section-soft">
          <div className="labs-section-head">
            <p className="eyebrow">Industries</p>
            <h2>We are building for MSMEs across multiple business segments, not just one fashionable niche.</h2>
          </div>
          <div className="labs-industry-grid">
            {industries.map((industry) => (
              <div key={industry} className="labs-industry-chip">{industry}</div>
            ))}
          </div>
        </section>

        <section id="about" className="labs-section">
          <div className="labs-reason-grid">
            {reasons.map((reason) => (
              <article key={reason.title} className="labs-reason-card">
                <h3>{reason.title}</h3>
                <p>{reason.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="labs-section labs-contact-wrap">
          <div className="labs-contact-card">
            <div className="labs-contact-grid">
              <div>
                <p className="eyebrow">Let&apos;s Build</p>
                <h2>Ready to digitize business operations with software that actually helps MSMEs?</h2>
                <p>Explore Quicksy and BillBuddy, or connect with Srijan Labs to build the next digital layer your business actually needs.</p>
              </div>

              <div className="labs-contact-actions">
                <a className="labs-btn labs-btn-green" href="#products">Explore Products</a> &nbsp; &nbsp;
                <a className="labs-btn labs-btn-secondary-light" href="/lead">Contact Us</a>
                <div className="labs-contact-note">
                  Built for founders, operators, commercial teams, and businesses tired of fragmented systems.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="labs-footer">
        <div className="labs-footer-grid">
            <div>
              <div className="labs-brand footer">
              <img className="labs-brand-logo footer" src={srijanLabsLogo} alt="Srijan Labs" />
              <div>
                <div className="labs-brand-title">Srijan Labs</div>
                <div className="labs-brand-subtitle">Digital platforms built for MSME growth</div>
              </div>
            </div>
            <p className="labs-footer-copy">
              Building practical SaaS platforms for MSME digitization, commerce operations, quotation workflows, and operational control.
            </p>
          </div>

          <div>
            <h4>Products</h4>
            <div className="labs-footer-links">
              <a href="#products">Quicksy</a>
              <a href="#products">BillBuddy</a>
            </div>
          </div>

          <div>
            <h4>Solutions</h4>
            <div className="labs-footer-links">
              <a href="#solutions">Digital Transformation</a>
              <a href="#solutions">Commerce Platforms</a>
              <a href="#solutions">Product Development</a>
            </div>
          </div>

          <div>
            <h4>Company</h4>
            <div className="labs-footer-links">
              <a href="#about">About</a>
              <a href="#partners">Partners</a>
              <a href="#contact">Contact</a>
              <a href="/login">Login</a>
            </div>
          </div>
        </div>
        <div className="labs-footer-bottom">© 2026 Srijan Labs. All rights reserved.</div>
      </footer>
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState(getStoredAuth());
  const [authReady, setAuthReady] = useState(false);
  const [bootstrapRequired, setBootstrapRequired] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [activeModule, setActiveModule] = useState("Dashboard");
  const [dashboardRange, setDashboardRange] = useState("daily");
  const [search, setSearch] = useState("");
  const [orderSort, setOrderSort] = useState({ key: "created_at", direction: "desc" });

  const [loginForm, setLoginForm] = useState({ mobile: "", password: "" });
  const [setupForm, setSetupForm] = useState({ name: "", mobile: "", password: "" });
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return !sessionStorage.getItem("billbuddyAuth");
    } catch {
      return true;
    }
  });
  const [publicDemoForm, setPublicDemoForm] = useState({
    name: "",
    mobile: "",
    password: "",
    email: "",
    businessName: "",
    city: "",
    state: "",
    businessCategory: ""
  });
  const [publicLeadForm, setPublicLeadForm] = useState({
    name: "",
    mobile: "",
    email: "",
    businessName: "",
    city: "",
    businessType: "",
    requirement: "",
    interestedInDemo: false
  });
  const [publicLeadSubmitting, setPublicLeadSubmitting] = useState(false);
  const [publicLeadSuccess, setPublicLeadSuccess] = useState("");
  const [publicLeadError, setPublicLeadError] = useState("");
  const [publicDemoSubmitting, setPublicDemoSubmitting] = useState(false);
  const [publicDemoSuccess, setPublicDemoSuccess] = useState("");
  const [publicDemoError, setPublicDemoError] = useState("");

  const [dashboardData, setDashboardData] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);

  const [seller, setSeller] = useState(null);
  const [theme, setTheme] = useState("matte-blue");
  const [brandColor, setBrandColor] = useState("#2563eb");
  const [quotationNumberPrefix, setQuotationNumberPrefix] = useState("QTN");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  const [sellers, setSellers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [leads, setLeads] = useState([]);
  const [usageOverview, setUsageOverview] = useState(null);
  const [decodeRules, setDecodeRules] = useState({
    customer_line: 1,
    mobile_line: 2,
    item_line: 3,
    delivery_date_line: 4,
    delivery_type_line: 5,
    enabled: true
  });
  const [quotationTemplate, setQuotationTemplate] = useState({
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
    notes_text: "Delivery and installation charges are extra unless mentioned.",
    terms_text: "Payment terms and final scope will be confirmed at order stage.",
    email_enabled: false,
    whatsapp_enabled: true
  });

  const [sellerForm, setSellerForm] = useState({
    name: "",
    sellerCode: "",
    mobile: "",
    email: "",
    status: "pending",
    trialEndsAt: "",
    subscriptionPlan: "DEMO",
    maxUsers: "",
    maxOrdersPerMonth: "",
    isLocked: false,
    themeKey: "matte-blue",
    brandPrimaryColor: "#2563eb",
    masterName: "",
    masterMobile: "",
    masterPassword: ""
  });
  const [showSellerCreateModal, setShowSellerCreateModal] = useState(false);
  const [sellerSearch, setSellerSearch] = useState("");
  const [sellerLifecycleDrafts, setSellerLifecycleDrafts] = useState({});
  const [planDrafts, setPlanDrafts] = useState({});
  const [showPlanCreateModal, setShowPlanCreateModal] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [selectedSellerSubscription, setSelectedSellerSubscription] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionModalDraft, setSubscriptionModalDraft] = useState({
    subscriptionId: null,
    sellerId: null,
    planCode: "",
    status: "trial",
    trialEndAt: "",
    convertedFromTrial: false
  });
  const [selectedSellerDetail, setSelectedSellerDetail] = useState(null);
  const [showSellerDetailModal, setShowSellerDetailModal] = useState(false);
  const [sellerDetailLoading, setSellerDetailLoading] = useState(false);
  const [selectedSellerConfigSeller, setSelectedSellerConfigSeller] = useState(null);
  const [sellerConfigTab, setSellerConfigTab] = useState("dashboard");
  const [sellerConfigPreviewTab, setSellerConfigPreviewTab] = useState("product-form");
  const [sellerConfigurations, setSellerConfigurations] = useState({});
  const [currentSellerConfiguration, setCurrentSellerConfiguration] = useState(null);
  const [sellerConfigLoading, setSellerConfigLoading] = useState(false);
  const [sellerConfigSaving, setSellerConfigSaving] = useState(false);
  const [sellerConfigPublishing, setSellerConfigPublishing] = useState(false);
  const [selectedPlanDetail, setSelectedPlanDetail] = useState(null);
  const [showPlanDetailModal, setShowPlanDetailModal] = useState(false);
  const [upgradeRequestLoading, setUpgradeRequestLoading] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [selectedLeadDetail, setSelectedLeadDetail] = useState(null);
  const [leadDetailLoading, setLeadDetailLoading] = useState(false);
  const [leadActivityNote, setLeadActivityNote] = useState("");
  const [showLeadDetailModal, setShowLeadDetailModal] = useState(false);
  const [showLeadConvertModal, setShowLeadConvertModal] = useState(false);
  const [leadConvertSubmitting, setLeadConvertSubmitting] = useState(false);
  const [leadConvertForm, setLeadConvertForm] = useState({
    sellerName: "",
    businessName: "",
    sellerCode: "",
    city: "",
    state: "",
    businessCategory: "",
    masterUserName: "",
    masterUserMobile: "",
    masterUserPassword: ""
  });
  const [planForm, setPlanForm] = useState({
    planCode: "",
    planName: "",
    price: "",
    billingCycle: "monthly",
    isActive: true,
    isDemoPlan: false,
    trialEnabled: false,
    trialDurationDays: "14",
    watermarkText: "Quotsy - Trial Version",
    maxUsers: "",
    maxQuotations: "",
    maxCustomers: "",
    inventoryEnabled: true,
    reportsEnabled: true,
    gstEnabled: true,
    exportsEnabled: true,
    quotationWatermarkEnabled: true,
    quotationCreationLockedAfterExpiry: true
  });
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    message: "",
    audienceType: "all_sellers",
    channel: "in_app",
    sendNow: true,
    scheduledAt: "",
    sellerId: ""
  });
  const [showNotificationCreateModal, setShowNotificationCreateModal] = useState(false);
  const [selectedNotificationDetail, setSelectedNotificationDetail] = useState(null);
  const [showNotificationDetailModal, setShowNotificationDetailModal] = useState(false);
  const [notificationDetailLoading, setNotificationDetailLoading] = useState(false);
  const [showSellerNotificationsModal, setShowSellerNotificationsModal] = useState(false);

  const [userForm, setUserForm] = useState({
    name: "",
    mobile: "",
    password: "",
    roleId: "",
    createdBy: ""
  });
  const [customerForm, setCustomerForm] = useState({
    name: "",
    firmName: "",
    mobile: "",
    email: "",
    address: "",
    gstNumber: "",
    monthlyBilling: false
  });
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMessageSimulatorModal, setShowMessageSimulatorModal] = useState(false);
  const [quotationWizard, setQuotationWizard] = useState(() => createInitialQuotationWizardState());
  const [quotationWizardSubmitting, setQuotationWizardSubmitting] = useState(false);
  const [quotationPreviewUrl, setQuotationPreviewUrl] = useState("");
  const [showProductUploadModal, setShowProductUploadModal] = useState(false);
  const [showSingleProductModal, setShowSingleProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [singleProductForm, setSingleProductForm] = useState(() => createInitialSingleProductForm());
  const [productUploadText, setProductUploadText] = useState("");
  const [productPreviewRows, setProductPreviewRows] = useState([]);
  const [showProductPreviewModal, setShowProductPreviewModal] = useState(false);
  const [productUploadModalMessage, setProductUploadModalMessage] = useState("");
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [orderVersions, setOrderVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [isEditingQuotation, setIsEditingQuotation] = useState(false);
  const [quotationEditForm, setQuotationEditForm] = useState({
    customQuotationNumber: "",
    deliveryType: "PICKUP",
    deliveryDate: "",
    deliveryAddress: "",
    deliveryPincode: "",
    transportCharges: "0",
    designCharges: "0",
    items: []
  });
  const [orderPage, setOrderPage] = useState(1);
  const [sellerPage, setSellerPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const [userPage, setUserPage] = useState(1);

  const PAGE_SIZE = 10;
  const isPlatformAdmin = Boolean(auth?.user?.isPlatformAdmin);
  const currentModules = isPlatformAdmin ? PLATFORM_MODULES : SELLER_MODULES;
  const currentModuleMeta = isPlatformAdmin ? PLATFORM_MODULE_META : MODULE_META;
  const sellerSubscriptionBanner = getSubscriptionBannerData(seller, plans);
    const publicLeadPaths = new Set(["/lead", "/lead-capture"]);
  const publicDemoPaths = new Set(["/try-demo", "/demo-signup"]);
  const isPublicLandingPage = window.location.pathname === "/";
  const isPublicLeadPage = publicLeadPaths.has(window.location.pathname);
  const isPublicDemoPage = publicDemoPaths.has(window.location.pathname);

  function saveAuth(authData, shouldRemember = true) {
    sessionStorage.setItem("billbuddyAuth", JSON.stringify(authData));
    if (shouldRemember) {
      localStorage.setItem("billbuddyAuth", JSON.stringify(authData));
    }
    setAuth(authData);
  }

  function clearAuth(message = "") {
    const localRaw = localStorage.getItem("billbuddyAuth");
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        if (!auth?.token || parsed?.token === auth.token) {
          localStorage.removeItem("billbuddyAuth");
        }
      } catch {
        localStorage.removeItem("billbuddyAuth");
      }
    }
    sessionStorage.removeItem("billbuddyAuth");
    setAuth(null);
    if (message) setError(message);
  }

  async function handleApiError(err) {
    if (err?.status === 401) {
      clearAuth("Session expired. Please login again.");
      setAuthReady(true);
      return;
    }
    setError(err.message || "Something went wrong");
  }

  function updatePublicLeadField(field, value) {
    setPublicLeadForm((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  function updatePublicDemoField(field, value) {
    setPublicDemoForm((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  async function handleSubmitPublicLead(event) {
    event.preventDefault();
    try {
      setPublicLeadSubmitting(true);
      setPublicLeadError("");
      setPublicLeadSuccess("");
      const response = await apiFetch("/api/lead-capture", {
        method: "POST",
        body: JSON.stringify(publicLeadForm)
      });
      setPublicLeadSuccess(response.message || "Lead submitted successfully.");
      setPublicLeadForm({
        name: "",
        mobile: "",
        email: "",
        businessName: "",
        city: "",
        businessType: "",
        requirement: "",
        interestedInDemo: false
      });
    } catch (err) {
      setPublicLeadError(err.message || "Failed to submit lead");
    } finally {
      setPublicLeadSubmitting(false);
    }
  }

  async function loadSetupStatus() {
    try {
      const response = await apiFetch("/api/auth/setup-status");
      setBootstrapRequired(Boolean(response.bootstrapRequired));
    } catch {
      setBootstrapRequired(false);
    }
  }

  async function verifySession() {
    if (!auth?.token) {
      await loadSetupStatus();
      setAuthReady(true);
      return;
    }

    try {
      const me = await apiFetch("/api/auth/me");
      const localRaw = localStorage.getItem("billbuddyAuth");
      let shouldRemember = false;
      if (localRaw) {
        try {
          shouldRemember = JSON.parse(localRaw)?.token === auth.token;
        } catch {
          shouldRemember = false;
        }
      }
      saveAuth({ token: auth.token, user: me.user }, shouldRemember);
      setBootstrapRequired(false);
    } catch {
      clearAuth("Please login to continue.");
      await loadSetupStatus();
    } finally {
      setAuthReady(true);
    }
  }

  async function loadSellerSettings() {
    try {
      const [response, configResponse] = await Promise.all([
        apiFetch("/api/sellers/me"),
        apiFetch("/api/seller-configurations/current/me").catch(() => ({ config: null }))
      ]);
      const currentSeller = response?.seller || null;
      setSeller(currentSeller);
      setCurrentSellerConfiguration(configResponse?.config || null);
      if (currentSeller?.theme_key) {
        setTheme(currentSeller.theme_key);
      }
      if (currentSeller?.brand_primary_color) {
        setBrandColor(currentSeller.brand_primary_color);
      }
      if (currentSeller?.quotation_number_prefix) {
        setQuotationNumberPrefix(currentSeller.quotation_number_prefix);
      }
      setBankName(currentSeller?.bank_name || "");
      setBankBranch(currentSeller?.bank_branch || "");
      setBankAccountNo(currentSeller?.bank_account_no || "");
      setBankIfsc(currentSeller?.bank_ifsc || "");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function refreshCurrentSellerConfiguration() {
    if (!auth?.token || isPlatformAdmin) return;

    try {
      const configResponse = await apiFetch("/api/seller-configurations/current/me").catch(() => ({ config: null }));
      setCurrentSellerConfiguration(configResponse?.config || null);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function loadAdminData() {
    if (!auth?.user?.isPlatformAdmin) return;

    try {
      const [sellerRows, usage, planRows, leadRows, subscriptionRows, notificationRows] = await Promise.all([
        apiFetch("/api/sellers"),
        apiFetch("/api/sellers/usage/overview"),
        apiFetch("/api/plans"),
        apiFetch("/api/leads"),
        apiFetch("/api/subscriptions"),
        apiFetch("/api/notifications")
      ]);
      setSellers(sellerRows);
      setUsageOverview(usage);
      setPlans(Array.isArray(planRows) ? planRows : []);
      setLeads(Array.isArray(leadRows) ? leadRows : []);
      setSubscriptions(Array.isArray(subscriptionRows) ? subscriptionRows : []);
      setNotifications(Array.isArray(notificationRows) ? notificationRows : []);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleSubmitPublicDemo(event) {
    event.preventDefault();
    try {
      setPublicDemoSubmitting(true);
      setPublicDemoError("");
      setPublicDemoSuccess("");
      const response = await apiFetch("/api/auth/demo-signup", {
        method: "POST",
        body: JSON.stringify(publicDemoForm)
      });
      setPublicDemoSuccess(response.message || "Demo account created successfully.");
      saveAuth({ token: response.token, user: response.user });
      setPublicDemoForm({
        name: "",
        mobile: "",
        password: "",
        email: "",
        businessName: "",
        city: "",
        state: "",
        businessCategory: ""
      });
      window.history.replaceState({}, "", "/");
    } catch (err) {
      setPublicDemoError(err.message || "Failed to create demo account");
    } finally {
      setPublicDemoSubmitting(false);
    }
  }

  async function loadDashboardData(range = dashboardRange) {
    if (!auth?.token) return;

    setLoading(true);
    setError("");
    try {
      const [summary, quotationRows, productRows, customerRows, rolesData, usersData, templateData, decodeRulesData, planRows, notificationRows, subscriptionRows] = await Promise.all([
        apiFetch(`/api/dashboard/summary?range=${range}`),
        apiFetch("/api/quotations"),
        apiFetch("/api/products"),
        apiFetch("/api/customers"),
        apiFetch("/api/roles"),
        apiFetch("/api/users"),
        apiFetch("/api/quotations/templates/current").catch(() => null),
        apiFetch("/api/whatsapp/decode-rules").catch(() => null),
        apiFetch("/api/plans").catch(() => []),
        apiFetch("/api/notifications").catch(() => []),
        apiFetch("/api/subscriptions").catch(() => [])
      ]);

      setDashboardData(summary);
      setQuotations(quotationRows);
      setProducts(productRows);
      setCustomers(customerRows);
      setRoles(rolesData);
      setUsers(usersData);
      setPlans(Array.isArray(planRows) ? planRows : []);
      setNotifications(Array.isArray(notificationRows) ? notificationRows : []);
      setSubscriptions(Array.isArray(subscriptionRows) ? subscriptionRows : []);
      if (templateData) {
        setQuotationTemplate((prev) => ({
          ...prev,
          ...templateData
        }));
      }
      if (decodeRulesData) setDecodeRules(decodeRulesData);

      if (!userForm.roleId && rolesData[0]) {
        setUserForm((prev) => ({ ...prev, roleId: String(rolesData[0].id) }));
      }

      await loadSellerSettings();
      await loadAdminData();
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    verifySession();
  }, []);

  useEffect(() => {
    if (auth?.token && authReady) {
      loadDashboardData(dashboardRange);
    }
  }, [auth?.token, authReady, dashboardRange]);

  useEffect(() => {
    if (!isPlatformAdmin || activeModule !== "Leads") return;
    if (selectedLeadId) return;
    if (!leads.length) return;
    openLeadDetail(leads[0].id);
  }, [activeModule, isPlatformAdmin, leads, selectedLeadId]);

  useEffect(() => {
    if (!auth?.token || isPlatformAdmin) return;
    if (!["Products", "Dashboard", "Configuration Studio", "Subscriptions"].includes(activeModule)) return;
    refreshCurrentSellerConfiguration();
  }, [activeModule, auth?.token, isPlatformAdmin]);

  useEffect(() => {
    setSellerPage(1);
  }, [sellerSearch]);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (quotationPreviewUrl) {
        URL.revokeObjectURL(quotationPreviewUrl);
      }
    };
  }, [quotationPreviewUrl]);

  useEffect(() => {
    if (!currentModules.includes(activeModule)) {
      setActiveModule("Dashboard");
    }
  }, [activeModule, currentModules]);

  useEffect(() => {
    if (activeModule !== "Configuration Studio" || isPlatformAdmin || !seller?.id) return;
    if (selectedSellerConfigSeller?.id === seller.id) return;
    openSellerConfigurationStudio(seller);
  }, [activeModule, isPlatformAdmin, seller?.id, selectedSellerConfigSeller?.id]);

  const chartSeries = useMemo(() => {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const totals = Array(7).fill(0);

    quotations.forEach((quotation) => {
      const day = new Date(quotation.created_at).getDay();
      const idx = day === 0 ? 6 : day - 1;
      totals[idx] += Number(quotation.total_amount || 0);
    });

    const maxValue = Math.max(...totals, 1);
    return labels.map((label, index) => ({
      label,
      value: totals[index],
      height: Math.max(12, Math.round((totals[index] / maxValue) * 100))
    }));
  }, [quotations]);

  const lowStockItems = useMemo(() => {
    return products
      .map((product) => ({
        id: product.id,
        name: product.material_name,
        stock: (product.id * 7) % 28
      }))
      .filter((item) => item.stock < 12)
      .slice(0, 5);
  }, [products]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = quotations.filter((row) => {
      if (!term) return true;
      return (
        String(getVisibleQuotationNumber(row) || "").toLowerCase().includes(term) ||
        String(row.customer_name || "").toLowerCase().includes(term) ||
        String(row.firm_name || "").toLowerCase().includes(term)
      );
    });

    const { key, direction } = orderSort;
    return rows.sort((a, b) => {
      const va = a[key] ?? "";
      const vb = b[key] ?? "";

      if (key === "total_amount") {
        return direction === "asc" ? Number(va) - Number(vb) : Number(vb) - Number(va);
      }

      if (key === "created_at") {
        return direction === "asc" ? new Date(va).getTime() - new Date(vb).getTime() : new Date(vb).getTime() - new Date(va).getTime();
      }

      return direction === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [quotations, search, orderSort]);

  const filteredSellers = useMemo(() => {
    const term = sellerSearch.trim().toLowerCase();
    if (!term) return sellers;
    return sellers.filter((sellerRow) =>
      [
        sellerRow.name,
        sellerRow.business_name,
        sellerRow.mobile,
        sellerRow.email,
        sellerRow.seller_code,
        sellerRow.plan_name,
        sellerRow.subscription_plan,
        sellerRow.status
      ].some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [sellerSearch, sellers]);

  const filteredPlans = useMemo(() => {
    const term = planSearch.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((plan) =>
      [
        plan.plan_name,
        plan.plan_code,
        plan.billing_cycle,
        plan.is_demo_plan ? "demo" : "standard",
        plan.is_active ? "active" : "inactive"
      ].some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [planSearch, plans]);

  const filteredSubscriptions = useMemo(() => {
    const term = subscriptionSearch.trim().toLowerCase();
    if (!term) return subscriptions;
    return subscriptions.filter((subscription) =>
      [
        subscription.seller_name,
        subscription.seller_code,
        subscription.plan_name,
        subscription.plan_code,
        subscription.status
      ].some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [subscriptionSearch, subscriptions]);

  const currentSellerSubscription = useMemo(() => {
    return (subscriptions || []).find((subscription) => String(subscription.status || "").toLowerCase() === "active")
      || (subscriptions || []).find((subscription) => String(subscription.status || "").toLowerCase() === "trial")
      || null;
  }, [subscriptions]);
  const configurationStudioSeller = isPlatformAdmin ? selectedSellerConfigSeller : seller;
  const activeSellerConfiguration = configurationStudioSeller ? getSellerConfiguration(configurationStudioSeller) : null;
  const runtimeSellerConfiguration = useMemo(
    () => mapSellerConfigurationResponse(currentSellerConfiguration, seller),
    [currentSellerConfiguration, seller]
  );
  const runtimeCatalogueFields = useMemo(
    () => sortConfigEntries(getSupportedCatalogueFields(runtimeSellerConfiguration)),
    [runtimeSellerConfiguration]
  );
  const unsupportedRuntimeCatalogueFields = useMemo(
    () => sortConfigEntries(getUnsupportedCatalogueFields(runtimeSellerConfiguration)),
    [runtimeSellerConfiguration]
  );
  const visibleCatalogueTableFields = useMemo(
    () => [...runtimeCatalogueFields, ...unsupportedRuntimeCatalogueFields].filter((field) => field.visibleInList),
    [runtimeCatalogueFields, unsupportedRuntimeCatalogueFields]
  );
  const runtimeQuotationColumns = useMemo(
    () => sortConfigEntries(getSupportedQuotationColumns(runtimeSellerConfiguration)),
    [runtimeSellerConfiguration]
  );
  const unsupportedRuntimeQuotationColumns = useMemo(
    () => sortConfigEntries(getUnsupportedQuotationColumns(runtimeSellerConfiguration)),
    [runtimeSellerConfiguration]
  );
  const sellerCatalogueCategories = useMemo(() => {
    const options = new Set();
    products.forEach((product) => {
      const value = String(product?.category || "").trim();
      if (value) options.add(value);
    });
    if (!options.size) {
      ["Sheet", "Product", "Services"].forEach((value) => options.add(value));
    }
    return Array.from(options);
  }, [products]);

  const aiSuggestions = useMemo(() => {
    const pending = Number(dashboardData?.pendingOverall || 0);
    const walkin = Number(dashboardData?.totals?.walk_in_sales || 0);

    return [
      pending > 100000
        ? "Pending receivables are high. Prioritize follow-up on top 5 outstanding accounts today."
        : "Receivables are under control. Keep a 2-day payment reminder cadence.",
      walkin > 10000
        ? "Walk-in traffic is strong. Bundle quick-cut SKUs near checkout for upsell."
        : "Run a same-day offer on laser cutting to improve walk-in conversion.",
      lowStockItems.length > 0
        ? `Restock ${lowStockItems[0]?.name} and ${lowStockItems[1]?.name || "priority SKUs"} before weekend demand.`
        : "Inventory looks healthy. Keep reorder thresholds unchanged this week."
    ];
  }, [dashboardData, lowStockItems]);

  const topSelling = useMemo(() => {
    return (dashboardData?.salesByCategory || []).slice(0, 4);
  }, [dashboardData]);

  const pagedOrders = useMemo(() => filteredOrders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE), [filteredOrders, orderPage]);
  const pagedSellers = useMemo(() => filteredSellers.slice((sellerPage - 1) * PAGE_SIZE, sellerPage * PAGE_SIZE), [filteredSellers, sellerPage]);
  const pagedCustomers = useMemo(() => customers.slice((customerPage - 1) * PAGE_SIZE, customerPage * PAGE_SIZE), [customers, customerPage]);
  const pagedProducts = useMemo(() => products.slice((productPage - 1) * PAGE_SIZE, productPage * PAGE_SIZE), [products, productPage]);
  const pagedUsers = useMemo(() => users.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE), [users, userPage]);
  const unreadNotificationsCount = useMemo(() => {
    if (isPlatformAdmin) {
      return notifications.reduce((sum, notification) => sum + Number(notification.unread_count || 0), 0);
    }
    return notifications.reduce((sum, notification) => {
      return sum + (String(notification.delivery_status || "").toLowerCase() === "read" ? 0 : 1);
    }, 0);
  }, [isPlatformAdmin, notifications]);

  const quotationPreview = {
    quotation_number: "QTN-2403",
    customer_name: "Wanex Industries",
    customer_mobile: "9876543210",
    total_amount: "1,24,500",
    delivery_date: "2026-03-20",
    delivery_type: "DOORSTEP",
    delivery_address: "A903 The Orient",
    delivery_pincode: "410218"
  };

  const quotationWizardCustomerMatches = useMemo(() => {
    const term = quotationWizard.customerSearch.trim().toLowerCase();
    if (term.length < 2) return [];

    return (customers || [])
      .filter((customer) =>
        [
          customer.name,
          customer.firm_name,
          customer.mobile,
          customer.email
        ].some((value) => String(value || "").toLowerCase().includes(term))
      )
      .slice(0, 8);
  }, [customers, quotationWizard.customerSearch]);

  const quotationWizardSelectedProduct = useMemo(() => {
    return products.find((product) => String(product.id) === String(quotationWizard.itemForm.productId)) || null;
  }, [products, quotationWizard.itemForm.productId]);

  const quotationWizardItemRules = getQuotationWizardRules(quotationWizard.itemForm);
  const quotationWizardItemReady = validateQuotationWizardItem(quotationWizard.itemForm);
  const quotationWizardGrossTotal = useMemo(() => {
    return Number(
      quotationWizard.items.reduce((sum, item) => sum + calculateQuotationWizardItemTotal(item), 0).toFixed(2)
    );
  }, [quotationWizard.items]);
  const quotationWizardDiscountAmount = toQuotationWizardAmount(quotationWizard.amounts.discountAmount);
  const quotationWizardAdvanceAmount = toQuotationWizardAmount(quotationWizard.amounts.advanceAmount);
  const quotationWizardBalanceAmount = Math.max(
    Number((quotationWizardGrossTotal - quotationWizardDiscountAmount - quotationWizardAdvanceAmount).toFixed(2)),
    0
  );

  const selectedVersionRecord = orderVersions.find((version) => String(version.id) === String(selectedVersionId)) || orderVersions[0] || null;
  const displayedQuotation = selectedVersionRecord?.quotation_snapshot || selectedOrderDetails?.quotation || null;
  const displayedItems = selectedVersionRecord?.items_snapshot || selectedOrderDetails?.items || [];
  const selectedVersionIndex = selectedVersionRecord ? orderVersions.findIndex((version) => version.id === selectedVersionRecord.id) : -1;
  const previousVersionRecord = selectedVersionIndex >= 0 ? orderVersions[selectedVersionIndex + 1] || null : null;
  const comparisonQuotation = previousVersionRecord?.quotation_snapshot || null;
  const comparisonItems = previousVersionRecord?.items_snapshot || [];
  const shouldShowVersionSelector = Number(selectedOrderDetails?.quotation?.version_no || 1) > 1 || (orderVersions || []).length > 1;

  function quotationFieldChanged(field) {
    if (!displayedQuotation || !comparisonQuotation) return false;
    return normalizeForCompare(displayedQuotation[field]) !== normalizeForCompare(comparisonQuotation[field]);
  }

  function quotationItemFieldChanged(item, index, field) {
    const previousItem = comparisonItems[index];
    if (!item || !previousItem) return false;
    return normalizeForCompare(item[field]) !== normalizeForCompare(previousItem[field]);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    try {
      const result = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(loginForm)
      });
      saveAuth({ token: result.token, user: result.user }, rememberMe);
      setLoginForm({ mobile: "", password: "" });
      setBootstrapRequired(false);
      setAuthReady(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBootstrapAdmin(event) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/auth/bootstrap-admin", {
        method: "POST",
        body: JSON.stringify(setupForm)
      });
      setSetupForm({ name: "", mobile: "", password: "" });
      setBootstrapRequired(false);
      setError("Platform admin created. Please login.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout failures and clear local auth state.
    }
    clearAuth();
    setAuthReady(true);
  }

  async function handleSeedRoles() {
    try {
      await apiFetch("/api/roles/seed", { method: "POST" });
      const roleRows = await apiFetch("/api/roles");
      setRoles(roleRows);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    setError("");

    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: userForm.name,
          mobile: userForm.mobile,
          password: userForm.password,
          roleId: Number(userForm.roleId),
          createdBy: userForm.createdBy ? Number(userForm.createdBy) : null
        })
      });

      const usersData = await apiFetch("/api/users");
      setUsers(usersData);
      setUserForm((prev) => ({ ...prev, name: "", mobile: "", password: "", createdBy: "" }));
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleLockToggle(user) {
    try {
      await apiFetch(`/api/users/${user.id}/lock`, {
        method: "PATCH",
        body: JSON.stringify({ locked: !user.locked })
      });
      const usersData = await apiFetch("/api/users");
      setUsers(usersData);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleResetUserPassword(user) {
    const confirmed = window.confirm(`Generate a new temporary password for ${user.name}?`);
    if (!confirmed) return;

    try {
      const response = await apiFetch(`/api/users/${user.id}/reset-password`, {
        method: "PATCH"
      });

      window.alert(`Temporary password for ${response.user.name}: ${response.temporaryPassword}`);
      setError(`Temporary password generated for ${response.user.name}.`);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleCreateCustomer(event) {
    event.preventDefault();
    setError("");

    try {
      await apiFetch("/api/customers", {
        method: "POST",
        body: JSON.stringify(customerForm)
      });

      const customerRows = await apiFetch("/api/customers");
      setCustomers(customerRows);
      setCustomerForm({
        name: "",
        firmName: "",
        mobile: "",
        email: "",
        address: "",
        gstNumber: "",
        monthlyBilling: false
      });
      setShowCustomerModal(false);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleBulkProductUpload(event) {
    event.preventDefault();
    setError("");
    setProductUploadModalMessage("");

    try {
      const rows = validateProductRows(parseProductTextRows(productUploadText));

      if (rows.length === 0) {
        throw new Error("Please add at least one product row.");
      }
      setProductPreviewRows(rows);
      setShowProductPreviewModal(true);
    } catch (err) {
      setProductUploadModalMessage(err.message || "Something went wrong");
    }
  }

  async function handleCreateSingleProduct(event) {
    event.preventDefault();
    setError("");

    try {
      const missingRuntimeField = runtimeCatalogueFields.find((field) => {
        if (!field.meta?.required) return false;
        const value = singleProductForm[field.meta.formKey];
        return value === undefined || value === null || String(value).trim() === "";
      });
      if (missingRuntimeField) {
        throw new Error(`${missingRuntimeField.label} is required.`);
      }

      const customFieldError = getCustomProductValidationError(
        unsupportedRuntimeCatalogueFields,
        singleProductForm.customFields
      );

      if (customFieldError) {
        throw new Error(customFieldError);
      }

      const payload = {
        materialName: singleProductForm.materialName,
        category: singleProductForm.category,
        thickness: singleProductForm.thickness || null,
        unitType: singleProductForm.unitType,
        basePrice: Number(singleProductForm.basePrice || 0),
        sku: singleProductForm.sku || null,
        alwaysAvailable: Boolean(singleProductForm.alwaysAvailable),
        materialGroup: singleProductForm.materialGroup || null,
        colorName: singleProductForm.colorName || null,
        psSupported: Boolean(singleProductForm.psSupported),
        pricingType: singleProductForm.pricingType || "SFT",
        customFields: singleProductForm.customFields || {}
      };

      await apiFetch(editingProductId ? `/api/products/${editingProductId}` : "/api/products", {
        method: editingProductId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...payload
        })
      });

      const productRows = await apiFetch("/api/products");
      setProducts(productRows);
      setSingleProductForm(createInitialSingleProductForm());
      setEditingProductId(null);
      setShowSingleProductModal(false);
      setError(editingProductId ? "Product updated successfully." : "Single product created successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  function handleEditProduct(product) {
    const nextForm = createInitialSingleProductForm();
    runtimeCatalogueFields.forEach((field) => {
      if (field?.meta?.formKey) {
        nextForm[field.meta.formKey] = getProductConfigurationFieldValue(product, field.key);
      }
    });
    const nextCustomFields = { ...(product.custom_fields || {}) };
    unsupportedRuntimeCatalogueFields.forEach((field) => {
      nextCustomFields[field.key] = getProductConfigurationFieldValue(product, field.key);
    });
    setEditingProductId(product.id);
    setSingleProductForm({
      ...nextForm,
      customFields: nextCustomFields
    });
    setShowSingleProductModal(true);
  }

  function updateSingleProductField(field, value) {
    setSingleProductForm((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  function updateSingleProductCustomField(fieldKey, value) {
    setSingleProductForm((prev) => ({
      ...prev,
      customFields: {
        ...(prev.customFields || {}),
        [fieldKey]: value
      }
    }));
  }

  async function handleExcelProductUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setProductUploadModalMessage("");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" }).filter(rowHasExcelContent);
      const rows = validateProductRowsWithConfiguration(
        rawRows
          .map((row) => mapProductRowWithConfiguration(row, runtimeCatalogueFields, unsupportedRuntimeCatalogueFields))
          .filter((row) => rowHasExcelContent(row) || Object.keys(row.customFields || {}).length > 0),
        unsupportedRuntimeCatalogueFields,
        runtimeCatalogueFields
      );

      if (rows.length === 0) {
        throw new Error("No product rows were detected in the Excel file. Please fill at least one row under the template headers.");
      }
      setProductPreviewRows(rows);
      setShowProductPreviewModal(true);
    } catch (err) {
      setProductUploadModalMessage(err.message || "Something went wrong");
    } finally {
      event.target.value = "";
    }
  }

  async function handleConfirmProductUpload() {
    try {
      setProductUploadModalMessage("");
      const validRows = productPreviewRows.filter((row) => row.materialName && row.issues.length === 0);
      if (validRows.length === 0) {
        throw new Error("No valid product rows available for upload.");
      }

      await apiFetch("/api/products/bulk", {
        method: "POST",
        body: JSON.stringify({
          products: validRows.map((row) => ({
            materialName: row.materialName,
            category: row.category,
            thickness: row.thickness,
            unitType: row.unitType,
            basePrice: row.basePrice,
            sku: row.sku,
            alwaysAvailable: row.alwaysAvailable,
            materialGroup: row.materialGroup,
            colorName: row.colorName,
            psSupported: row.psSupported,
            pricingType: row.pricingType,
            customFields: row.customFields || {}
          }))
        })
      });

      const productRows = await apiFetch("/api/products");
      setProducts(productRows);
      setProductUploadText("");
      setProductPreviewRows([]);
      setShowProductPreviewModal(false);
      setProductUploadModalMessage("");
      setError(`Uploaded ${validRows.length} products successfully.`);
    } catch (err) {
      setProductUploadModalMessage(err.message || "Something went wrong");
    }
  }

  function handleDownloadProductTemplate() {
    const templateColumns = [
      ...runtimeCatalogueFields.filter((field) => field.uploadEnabled),
      ...unsupportedRuntimeCatalogueFields.filter((field) => field.uploadEnabled)
    ];
    const sampleRow = {};

    templateColumns.forEach((field) => {
      const headerLabel = field.label || field.normalizedKey || field.key;
      sampleRow[headerLabel] = getProductTemplateSampleValue(field.normalizedKey || field.key, field.label);
    });

    const validationRows = templateColumns.map((field) => ({
      field_label: field.label || field.normalizedKey || field.key,
      field_key: field.key || field.normalizedKey,
      required: field.required ? "Yes" : "No",
      data_type: field.type || "text",
      allowed_options: getConfiguredOptions(field).join(", ")
    }));

    const worksheet = XLSX.utils.json_to_sheet([sampleRow], { header: Object.keys(sampleRow) });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(validationRows), "Validation Rules");
    XLSX.writeFile(workbook, "billbuddy-product-template.xlsx");
  }

  async function handleSaveThemeSettings(event) {
    event.preventDefault();
    try {
      const response = await apiFetch("/api/sellers/me/settings", {
        method: "PUT",
        body: JSON.stringify({
          themeKey: theme,
          brandPrimaryColor: brandColor,
          quotationNumberPrefix,
          bankName,
          bankBranch,
          bankAccountNo,
          bankIfsc
        })
      });
      setSeller(response.seller);
      setError("Settings updated successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleCreateSeller(event) {
    event.preventDefault();

    try {
      await apiFetch("/api/sellers", {
        method: "POST",
        body: JSON.stringify({
          name: sellerForm.name,
          sellerCode: sellerForm.sellerCode,
          mobile: sellerForm.mobile,
          email: sellerForm.email,
          status: sellerForm.status,
          trialEndsAt: sellerForm.trialEndsAt || null,
          subscriptionPlan: sellerForm.subscriptionPlan || "DEMO",
          maxUsers: sellerForm.maxUsers || null,
          maxOrdersPerMonth: sellerForm.maxOrdersPerMonth || null,
          isLocked: Boolean(sellerForm.isLocked),
          themeKey: sellerForm.themeKey,
          brandPrimaryColor: sellerForm.brandPrimaryColor,
          masterUser: sellerForm.masterName && sellerForm.masterMobile ? {
            name: sellerForm.masterName,
            mobile: sellerForm.masterMobile,
            password: sellerForm.masterPassword
          } : null
        })
      });

      setSellerForm({
        name: "",
        sellerCode: "",
        mobile: "",
        email: "",
        status: "pending",
        trialEndsAt: "",
        subscriptionPlan: "DEMO",
        maxUsers: "",
        maxOrdersPerMonth: "",
        isLocked: false,
        themeKey: "matte-blue",
        brandPrimaryColor: "#2563eb",
        masterName: "",
        masterMobile: "",
        masterPassword: ""
      });

      await loadAdminData();
      setShowSellerCreateModal(false);
      setError("Seller created successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  function getSellerLifecycleDraft(sellerRow) {
    return sellerLifecycleDrafts[sellerRow.id] || {
      status: sellerRow.status || "pending",
      trialEndsAt: sellerRow.trial_ends_at ? String(sellerRow.trial_ends_at).slice(0, 10) : "",
      subscriptionPlan: sellerRow.plan_code || sellerRow.subscription_plan || "DEMO",
      subscriptionStatus: sellerRow.subscription_status || "trial",
      subscriptionId: sellerRow.subscription_id || null,
      maxUsers: sellerRow.max_users ?? "",
      maxOrdersPerMonth: sellerRow.max_orders_per_month ?? "",
      isLocked: Boolean(sellerRow.is_locked),
      onboardingStatus: sellerRow.onboarding_status || "active"
    };
  }

  function updateSellerLifecycleDraft(sellerId, field, value) {
    setSellerLifecycleDrafts((prev) => {
      const current = prev[sellerId] || {};
      return {
        ...prev,
        [sellerId]: {
          ...current,
          [field]: value
        }
      };
    });
  }

  function getPlanDraft(plan) {
    return planDrafts[plan.id] || {
      planCode: plan.plan_code || "",
      planName: plan.plan_name || "",
      price: String(plan.price ?? 0),
      billingCycle: plan.billing_cycle || "monthly",
      isActive: Boolean(plan.is_active),
      isDemoPlan: Boolean(plan.is_demo_plan),
      trialEnabled: Boolean(plan.trial_enabled),
      trialDurationDays: plan.trial_duration_days ? String(plan.trial_duration_days) : "",
      watermarkText: plan.watermark_text || "",
      maxUsers: plan.max_users ?? "",
      maxQuotations: plan.max_quotations ?? "",
      maxCustomers: plan.max_customers ?? "",
      inventoryEnabled: Boolean(plan.inventory_enabled),
      reportsEnabled: Boolean(plan.reports_enabled),
      gstEnabled: Boolean(plan.gst_enabled),
      exportsEnabled: Boolean(plan.exports_enabled),
      quotationWatermarkEnabled: Boolean(plan.quotation_watermark_enabled),
      quotationCreationLockedAfterExpiry: Boolean(plan.quotation_creation_locked_after_expiry)
    };
  }

  function updatePlanDraft(planId, field, value) {
    setPlanDrafts((prev) => ({
      ...prev,
      [planId]: {
        ...getPlanDraft(plans.find((plan) => plan.id === planId) || {}),
        ...(prev[planId] || {}),
        [field]: value
      }
    }));
  }

  async function handleSellerLifecycleSave(sellerId) {
    const draft = sellerLifecycleDrafts[sellerId];
    if (!draft) return;

    try {
      await apiFetch(`/api/sellers/${sellerId}/lifecycle`, {
        method: "PATCH",
        body: JSON.stringify({
          status: draft.status,
          trialEndsAt: draft.trialEndsAt || null,
          subscriptionPlan: draft.subscriptionPlan || null,
          maxUsers: draft.maxUsers,
          maxOrdersPerMonth: draft.maxOrdersPerMonth,
          isLocked: Boolean(draft.isLocked),
          onboardingStatus: draft.onboardingStatus || null
        })
      });

      if (draft.subscriptionId) {
        await apiFetch(`/api/subscriptions/${draft.subscriptionId}`, {
          method: "PATCH",
          body: JSON.stringify({
            planCode: draft.subscriptionPlan || null,
            status: draft.subscriptionStatus || null,
            trialEndAt: draft.trialEndsAt || null
          })
        });
      }

      await loadAdminData();
      setSellerLifecycleDrafts((prev) => {
        const next = { ...prev };
        delete next[sellerId];
        return next;
      });
      setError("Seller lifecycle updated successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleCreatePlan(event) {
    event.preventDefault();

    try {
      const response = await apiFetch("/api/plans", {
        method: "POST",
        body: JSON.stringify(planForm)
      });

      setPlans((prev) => [response.plan, ...prev]);
      setPlanForm({
        planCode: "",
        planName: "",
        price: "",
        billingCycle: "monthly",
        isActive: true,
        isDemoPlan: false,
        trialEnabled: false,
        trialDurationDays: "14",
        watermarkText: "Quotsy - Trial Version",
        maxUsers: "",
        maxQuotations: "",
        maxCustomers: "",
        inventoryEnabled: true,
        reportsEnabled: true,
        gstEnabled: true,
        exportsEnabled: true,
        quotationWatermarkEnabled: true,
        quotationCreationLockedAfterExpiry: true
      });
      setShowPlanCreateModal(false);
      setError("Plan created successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handlePlanSave(planId) {
    const draft = planDrafts[planId];
    if (!draft) return;

    try {
      const response = await apiFetch(`/api/plans/${planId}`, {
        method: "PATCH",
        body: JSON.stringify(draft)
      });
      setPlans((prev) => prev.map((plan) => (plan.id === planId ? response.plan : plan)));
      setPlanDrafts((prev) => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
      setSelectedPlanDetail((prev) => (prev && prev.id === planId ? response.plan : prev));
      setError("Plan updated successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function openSellerDetail(sellerRow) {
    try {
      setSellerDetailLoading(true);
      const detail = await apiFetch(`/api/sellers/${sellerRow.id}/detail`);
      setSelectedSellerDetail(detail);
      setShowSellerDetailModal(true);
    } catch (err) {
      handleApiError(err);
    } finally {
      setSellerDetailLoading(false);
    }
  }

  function closeSellerDetailModal() {
    setShowSellerDetailModal(false);
    setSelectedSellerDetail(null);
  }

  function getSellerConfiguration(sellerRow) {
    if (!sellerRow?.id) return createDefaultSellerConfiguration(sellerRow);
    return sellerConfigurations[sellerRow.id] || createDefaultSellerConfiguration(sellerRow);
  }

  function updateSellerConfiguration(sellerId, updater) {
    setSellerConfigurations((prev) => {
      const current = prev[sellerId] || createDefaultSellerConfiguration(configurationStudioSeller || { id: sellerId });
      return {
        ...prev,
        [sellerId]: typeof updater === "function" ? updater(current) : updater
      };
    });
  }

  async function openSellerConfigurationStudio(sellerRow) {
    setSelectedSellerConfigSeller(sellerRow);
    setSellerConfigTab("dashboard");
    setSellerConfigPreviewTab("product-form");
    setSellerConfigurations((prev) => ({
      ...prev,
      [sellerRow.id]: prev[sellerRow.id] || createDefaultSellerConfiguration(sellerRow)
    }));
    setActiveModule("Configuration Studio");

    try {
      setSellerConfigLoading(true);
      const response = await apiFetch(`/api/seller-configurations/${sellerRow.id}`);
      setSellerConfigurations((prev) => ({
        ...prev,
        [sellerRow.id]: mapSellerConfigurationResponse(response.config, sellerRow)
      }));
    } catch (err) {
      handleApiError(err);
    } finally {
      setSellerConfigLoading(false);
    }
  }

  function closeSellerConfigurationStudio() {
    if (isPlatformAdmin) {
      setSelectedSellerConfigSeller(null);
      setActiveModule("Sellers");
    } else {
      setActiveModule("Dashboard");
    }
    setSellerConfigTab("dashboard");
    setSellerConfigPreviewTab("product-form");
    setSellerConfigLoading(false);
    setSellerConfigSaving(false);
    setSellerConfigPublishing(false);
  }

  async function saveSellerConfigurationDraft() {
    if (!configurationStudioSeller?.id || !activeSellerConfiguration) return;

    try {
      setSellerConfigSaving(true);
      const response = await apiFetch(`/api/seller-configurations/${configurationStudioSeller.id}`, {
        method: "PUT",
        body: JSON.stringify({
          profileName: activeSellerConfiguration.profileName,
          status: "draft",
          modules: activeSellerConfiguration.modules,
          catalogueFields: activeSellerConfiguration.catalogueFields,
          quotationColumns: activeSellerConfiguration.quotationColumns
        })
      });

      setSellerConfigurations((prev) => ({
        ...prev,
        [configurationStudioSeller.id]: mapSellerConfigurationResponse(response.config, configurationStudioSeller)
      }));
      setError(response.message || "Seller configuration draft saved.");
    } catch (err) {
      handleApiError(err);
    } finally {
      setSellerConfigSaving(false);
    }
  }

  async function publishSellerConfiguration() {
    if (!configurationStudioSeller?.id) return;

    try {
      setSellerConfigPublishing(true);
      const response = await apiFetch(`/api/seller-configurations/${configurationStudioSeller.id}/publish`, {
        method: "POST"
      });
      setSellerConfigurations((prev) => ({
        ...prev,
        [configurationStudioSeller.id]: mapSellerConfigurationResponse(response.config, configurationStudioSeller)
      }));
      if (!isPlatformAdmin && seller?.id === configurationStudioSeller.id) {
        setCurrentSellerConfiguration(response.config || null);
      }
      setError(response.message || "Seller configuration published.");
    } catch (err) {
      handleApiError(err);
    } finally {
      setSellerConfigPublishing(false);
    }
  }

  function addCatalogueField() {
    if (!configurationStudioSeller?.id) return;
    updateSellerConfiguration(configurationStudioSeller.id, (current) => ({
      ...current,
      catalogueFields: [
        ...current.catalogueFields,
        {
          id: `cat-${Date.now()}`,
          displayOrder: current.catalogueFields.length + 1,
          key: "",
          label: "",
          type: "text",
          options: [],
          required: false,
          visibleInList: true,
          uploadEnabled: true
        }
      ]
    }));
  }

  function updateCatalogueField(fieldId, key, value) {
    if (!configurationStudioSeller?.id) return;
    updateSellerConfiguration(configurationStudioSeller.id, (current) => ({
      ...current,
      catalogueFields: current.catalogueFields.map((field) => (field.id === fieldId ? { ...field, [key]: value } : field))
    }));
  }

  function commitCatalogueFieldOptions(fieldId, rawValue) {
    if (!configurationStudioSeller?.id) return;
    const parsedOptions = parseOptionsInput(rawValue);
    updateSellerConfiguration(configurationStudioSeller.id, (current) => ({
      ...current,
      catalogueFields: current.catalogueFields.map((field) => (
        field.id === fieldId
          ? {
              ...field,
              options: parsedOptions,
              optionsText: parsedOptions.join(", ")
            }
          : field
      ))
    }));
  }

  function removeCatalogueField(fieldId) {
    if (!configurationStudioSeller?.id) return;
    updateSellerConfiguration(configurationStudioSeller.id, (current) => ({
      ...current,
      catalogueFields: current.catalogueFields.filter((field) => field.id !== fieldId)
    }));
  }

  function addQuotationColumn() {
    if (!configurationStudioSeller?.id) return;
    updateSellerConfiguration(configurationStudioSeller.id, (current) => ({
      ...current,
      quotationColumns: [
        ...current.quotationColumns,
        {
          id: `col-${Date.now()}`,
          displayOrder: current.quotationColumns.length + 1,
          key: "",
          label: "",
            type: "text",
            options: [],
            definition: "",
            formulaExpression: "",
            required: false,
            visibleInForm: true,
            visibleInPdf: true,
            helpTextInPdf: false,
            includedInCalculation: false
          }
        ]
    }));
  }

  function updateQuotationColumn(columnId, key, value) {
    if (!configurationStudioSeller?.id) return;
    updateSellerConfiguration(configurationStudioSeller.id, (current) => ({
      ...current,
      quotationColumns: current.quotationColumns.map((column) => (column.id === columnId ? { ...column, [key]: value } : column))
    }));
  }

  function commitQuotationColumnOptions(columnId, rawValue) {
    if (!configurationStudioSeller?.id) return;
    const parsedOptions = parseOptionsInput(rawValue);
    updateSellerConfiguration(configurationStudioSeller.id, (current) => ({
      ...current,
      quotationColumns: current.quotationColumns.map((column) => (
        column.id === columnId
          ? {
              ...column,
              options: parsedOptions,
              optionsText: parsedOptions.join(", ")
            }
          : column
      ))
    }));
  }

  function removeQuotationColumn(columnId) {
    if (!configurationStudioSeller?.id) return;
    updateSellerConfiguration(configurationStudioSeller.id, (current) => ({
      ...current,
      quotationColumns: current.quotationColumns.filter((column) => column.id !== columnId)
    }));
  }

  function updateSellerConfigurationModule(moduleKey, enabled) {
    if (!configurationStudioSeller?.id) return;
    updateSellerConfiguration(configurationStudioSeller.id, (current) => ({
      ...current,
      modules: {
        ...current.modules,
        [moduleKey]: enabled
      }
    }));
  }

  function openPlanDetail(plan) {
    setSelectedPlanDetail(plan);
    setShowPlanDetailModal(true);
  }

  function closePlanDetailModal() {
    setShowPlanDetailModal(false);
    setSelectedPlanDetail(null);
  }

  async function handleSellerDetailSave() {
    if (!selectedSellerDetail?.seller?.id) return;
    await handleSellerLifecycleSave(selectedSellerDetail.seller.id);
    await openSellerDetail(selectedSellerDetail.seller);
  }

  async function handlePlanDetailSave() {
    if (!selectedPlanDetail?.id) return;
    await handlePlanSave(selectedPlanDetail.id);
  }

  async function openSubscriptionDetail(sellerRow) {
    try {
      setShowSellerDetailModal(false);
      const [rows, detail] = await Promise.all([
        apiFetch(`/api/subscriptions?sellerId=${sellerRow.id}`),
        apiFetch(`/api/sellers/${sellerRow.id}/detail`).catch(() => null)
      ]);
      const current = Array.isArray(rows) && rows.length ? rows[0] : null;
      setSelectedSellerSubscription({
        seller: detail?.seller || sellerRow,
        subscriptions: rows || [],
        current,
        auditLogs: detail?.auditLogs || [],
        usage: detail?.usage || null
      });
      setSubscriptionModalDraft({
        subscriptionId: current?.id || null,
        sellerId: sellerRow.id,
        planCode: current?.plan_code || sellerRow.plan_code || sellerRow.subscription_plan || "DEMO",
        status: current?.status || sellerRow.subscription_status || "trial",
        trialEndAt: current?.trial_end_at ? String(current.trial_end_at).slice(0, 10) : (sellerRow.trial_end_at ? String(sellerRow.trial_end_at).slice(0, 10) : ""),
        convertedFromTrial: Boolean(current?.converted_from_trial)
      });
      setShowSubscriptionModal(true);
    } catch (err) {
      handleApiError(err);
    }
  }

  function closeSubscriptionModal() {
    setShowSubscriptionModal(false);
    setSelectedSellerSubscription(null);
    setSubscriptionModalDraft({
      subscriptionId: null,
      sellerId: null,
      planCode: "",
      status: "trial",
      trialEndAt: "",
      convertedFromTrial: false
    });
  }

  async function handleSaveSubscriptionModal() {
    if (!subscriptionModalDraft.subscriptionId || !subscriptionModalDraft.sellerId) return;

    try {
      await apiFetch(`/api/subscriptions/${subscriptionModalDraft.subscriptionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          planCode: subscriptionModalDraft.planCode,
          status: subscriptionModalDraft.status,
          trialEndAt: subscriptionModalDraft.trialEndAt || null,
          convertedFromTrial: Boolean(subscriptionModalDraft.convertedFromTrial)
        })
      });

      await apiFetch(`/api/sellers/${subscriptionModalDraft.sellerId}/lifecycle`, {
        method: "PATCH",
        body: JSON.stringify({
          subscriptionPlan: subscriptionModalDraft.planCode || null,
          trialEndsAt: subscriptionModalDraft.trialEndAt || null,
          status: subscriptionModalDraft.status === "active" ? "active" : undefined
        })
      });

      await loadAdminData();
      setError("Subscription updated successfully.");
      closeSubscriptionModal();
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleConvertToPaid() {
    if (!selectedSellerSubscription?.seller || !subscriptionModalDraft.subscriptionId) return;
    try {
      await apiFetch(`/api/subscriptions/${subscriptionModalDraft.subscriptionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          planCode: subscriptionModalDraft.planCode,
          status: "active",
          convertedFromTrial: true
        })
      });

      await apiFetch(`/api/sellers/${selectedSellerSubscription.seller.id}/lifecycle`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "active",
          subscriptionPlan: subscriptionModalDraft.planCode || null
        })
      });

      await loadAdminData();
      setError("Seller converted to paid plan successfully.");
      closeSubscriptionModal();
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleSellerUpgradeRequest(planCode) {
    if (!planCode) return;

    try {
      setUpgradeRequestLoading(true);
      const response = await apiFetch("/api/sellers/me/upgrade-request", {
        method: "POST",
        body: JSON.stringify({
          requestedPlanCode: planCode
        })
      });
      setError(response.message || "Upgrade request sent.");
    } catch (err) {
      handleApiError(err);
    } finally {
      setUpgradeRequestLoading(false);
    }
  }

  async function openLeadDetail(leadId) {
    try {
      setLeadDetailLoading(true);
      setSelectedLeadId(String(leadId));
      setShowLeadDetailModal(true);
      const detail = await apiFetch(`/api/leads/${leadId}`);
      setSelectedLeadDetail(detail);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLeadDetailLoading(false);
    }
  }

  function closeLeadDetailModal() {
    setShowLeadDetailModal(false);
  }

  async function handleLeadUpdate(leadId, updates) {
    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify(updates)
      });
      await loadAdminData();
      await openLeadDetail(leadId);
      setError("Lead updated successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleAddLeadActivity(event) {
    event.preventDefault();
    if (!selectedLeadId || !leadActivityNote.trim()) return;

    try {
      await apiFetch(`/api/leads/${selectedLeadId}/activity`, {
        method: "POST",
        body: JSON.stringify({
          note: leadActivityNote,
          activityType: "note_added"
        })
      });
      setLeadActivityNote("");
      await openLeadDetail(selectedLeadId);
      await loadAdminData();
      setError("Lead note added.");
    } catch (err) {
      handleApiError(err);
    }
  }

  function buildLeadSellerCode(lead) {
    return String(lead?.business_name || lead?.name || `LEAD-${lead?.id || ""}`)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
  }

  function openLeadConvertModal() {
    if (!selectedLeadDetail?.lead) return;
    const lead = selectedLeadDetail.lead;
    setLeadConvertForm({
      sellerName: lead.name || "",
      businessName: lead.business_name || lead.name || "",
      sellerCode: buildLeadSellerCode(lead),
      city: lead.city || "",
      state: "",
      businessCategory: lead.business_type || "",
      masterUserName: lead.name || "",
      masterUserMobile: lead.mobile || "",
      masterUserPassword: ""
    });
    setShowLeadConvertModal(true);
  }

  function closeLeadConvertModal() {
    setShowLeadConvertModal(false);
    setLeadConvertSubmitting(false);
  }

  async function handleConvertLeadToDemo(event) {
    event.preventDefault();
    if (!selectedLeadId) return;

    try {
      setLeadConvertSubmitting(true);
      const response = await apiFetch(`/api/leads/${selectedLeadId}/convert-demo`, {
        method: "POST",
        body: JSON.stringify(leadConvertForm)
      });
      await loadAdminData();
      await openLeadDetail(selectedLeadId);
      setError(response.message || "Lead converted to demo successfully.");
      closeLeadConvertModal();
    } catch (err) {
      handleApiError(err);
      setLeadConvertSubmitting(false);
    }
  }

  async function handleCreateNotification(event) {
    event.preventDefault();

    try {
      const response = await apiFetch("/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: notificationForm.title,
          message: notificationForm.message,
          audienceType: notificationForm.audienceType,
          channel: notificationForm.channel,
          sendNow: Boolean(notificationForm.sendNow),
          scheduledAt: notificationForm.sendNow ? null : (notificationForm.scheduledAt || null),
          sellerId: notificationForm.audienceType === "specific_seller" ? (notificationForm.sellerId || null) : null
        })
      });

      setNotifications((prev) => [response.notification, ...prev]);
      setNotificationForm({
        title: "",
        message: "",
        audienceType: "all_sellers",
        channel: "in_app",
        sendNow: true,
        scheduledAt: "",
        sellerId: ""
      });
      setShowNotificationCreateModal(false);
      setError(response.message || "Notification created successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function openNotificationDetail(notificationId) {
    try {
      setNotificationDetailLoading(true);
      const detail = await apiFetch(`/api/notifications/${notificationId}`);
      setSelectedNotificationDetail(detail);
      setShowNotificationDetailModal(true);
    } catch (err) {
      handleApiError(err);
    } finally {
      setNotificationDetailLoading(false);
    }
  }

  function closeNotificationDetailModal() {
    setShowNotificationDetailModal(false);
    setSelectedNotificationDetail(null);
  }

  async function handleOpenSellerNotification(notificationRow) {
    try {
      if (String(notificationRow.delivery_status || "").toLowerCase() !== "read") {
        const response = await apiFetch(`/api/notifications/logs/${notificationRow.id}/read`, {
          method: "PATCH"
        });
        setNotifications((prev) =>
          prev.map((row) => (row.id === notificationRow.id ? { ...row, ...response.notificationLog } : row))
        );
      }
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleOrderStatusUpdate(orderId, orderStatus) {
    try {
      await apiFetch(`/api/quotations/${orderId}/order-status`, {
        method: "PATCH",
        body: JSON.stringify({ orderStatus })
      });
      const quotationRows = await apiFetch("/api/quotations");
      setQuotations(quotationRows);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleMarkQuotationSent(orderId) {
    try {
      await apiFetch(`/api/quotations/${orderId}/mark-sent`, {
        method: "PATCH"
      });
      const quotationRows = await apiFetch("/api/quotations");
      setQuotations(quotationRows);
      setError("Quotation marked as sent.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleMarkPaid(orderId) {
    try {
      await apiFetch(`/api/quotations/${orderId}/payment-status`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus: "paid" })
      });
      const quotationRows = await apiFetch("/api/quotations");
      setQuotations(quotationRows);
    } catch (err) {
      handleApiError(err);
    }
  }

  function openQuotationWizard() {
    if (!auth?.user?.isPlatformAdmin) {
      setQuotationWizard(createInitialQuotationWizardState(products[0] || null));
      if (quotationPreviewUrl) {
        URL.revokeObjectURL(quotationPreviewUrl);
      }
      setQuotationPreviewUrl("");
      setShowMessageSimulatorModal(true);
      setError("");
    }
  }

  function closeQuotationWizard() {
    if (quotationPreviewUrl) {
      URL.revokeObjectURL(quotationPreviewUrl);
    }
    setQuotationPreviewUrl("");
    setQuotationWizard(createInitialQuotationWizardState(products[0] || null));
    setQuotationWizardSubmitting(false);
    setShowMessageSimulatorModal(false);
  }

  function updateQuotationWizardCustomerField(field, value) {
    setQuotationWizard((prev) => ({
      ...prev,
      customer: {
        ...prev.customer,
        [field]: value
      }
    }));
  }

  function updateQuotationWizardItemForm(field, value) {
    setQuotationWizard((prev) => ({
      ...prev,
      itemForm: {
        ...prev.itemForm,
        [field]: value
      }
    }));
  }

  function updateQuotationWizardCustomField(fieldKey, value) {
    setQuotationWizard((prev) => ({
      ...prev,
      itemForm: {
        ...prev.itemForm,
        customFields: {
          ...(prev.itemForm.customFields || {}),
          [fieldKey]: value
        }
      }
    }));
  }

  function handleQuotationWizardProductChange(productId) {
    const selectedProduct = products.find((product) => String(product.id) === String(productId)) || null;
    setQuotationWizard((prev) => ({
      ...prev,
      itemForm: {
        ...createQuotationWizardItem(selectedProduct),
        customFields: getCatalogueDrivenQuotationCustomFields(
          selectedProduct,
          unsupportedRuntimeQuotationColumns.filter((column) => column.visibleInForm && column.type !== "formula"),
          prev.itemForm.customFields
        )
      }
    }));
  }

  function handleAddQuotationWizardItem() {
    if (!quotationWizardItemReady) {
      setError("Please complete the selected item before adding it.");
      return;
    }

      const effectiveCustomFields = getCatalogueDrivenQuotationCustomFields(
        quotationWizardSelectedProduct,
        unsupportedRuntimeQuotationColumns.filter((column) => column.visibleInForm && column.type !== "formula"),
        quotationWizard.itemForm.customFields
      );
      const customFieldError = getCustomQuotationValidationError(
        unsupportedRuntimeQuotationColumns.filter((column) => column.visibleInForm && column.type !== "formula"),
        effectiveCustomFields
      );

    if (customFieldError) {
      setError(customFieldError);
      return;
    }

      const itemToAdd = {
        ...quotationWizard.itemForm,
        customFields: effectiveCustomFields,
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
      };

    setQuotationWizard((prev) => ({
      ...prev,
      items: [...prev.items, itemToAdd],
      itemForm: createQuotationWizardItem(quotationWizardSelectedProduct || products[0] || null)
    }));
    setError("");
  }

  function handleRemoveQuotationWizardItem(itemId) {
    setQuotationWizard((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId)
    }));
  }

  function handleQuotationWizardNext() {
    if (quotationWizard.step === "customer") {
      if (quotationWizard.customerMode === "existing" && !quotationWizard.selectedCustomerId) {
        setError("Please select a customer before continuing.");
        return;
      }
      if (quotationWizard.customerMode === "new" && !quotationWizard.customer.name.trim()) {
        setError("Please enter customer details before continuing.");
        return;
      }
      setQuotationWizard((prev) => ({ ...prev, step: "items" }));
      setError("");
      return;
    }

    if (quotationWizard.step === "items") {
      if (!quotationWizard.items.length) {
        setError("Please add at least one item before continuing.");
        return;
      }
      setQuotationWizard((prev) => ({ ...prev, step: "amounts" }));
      setError("");
    }
  }

  function handleQuotationWizardBack() {
    setError("");
    setQuotationWizard((prev) => ({
      ...prev,
      step: prev.step === "amounts" ? "items" : "customer"
    }));
  }

  async function ensureQuotationWizardCustomer() {
    if (quotationWizard.customerMode === "existing") {
      return Number(quotationWizard.selectedCustomerId);
    }

    const createdCustomer = await apiFetch("/api/customers", {
      method: "POST",
      body: JSON.stringify(quotationWizard.customer)
    });
    const customerRows = await apiFetch("/api/customers");
    setCustomers(customerRows);
    setQuotationWizard((prev) => ({
      ...prev,
      customerMode: "existing",
      selectedCustomerId: String(createdCustomer.id)
    }));
    return createdCustomer.id;
  }

  async function createQuotationPreviewUrl(quotationId) {
    const token = auth?.token;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    const response = await fetch(`${baseUrl}/api/quotations/${quotationId}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    if (!response.ok) {
      throw new Error("Failed to load quotation preview");
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async function handleSubmitQuotationWizard() {
    try {
      setQuotationWizardSubmitting(true);
      setError("");
      const customerId = await ensureQuotationWizardCustomer();
      const response = await apiFetch("/api/quotations", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          items: buildQuotationWizardPayloadItems(quotationWizard.items),
          gstPercent: 0,
          transportCharges: 0,
          designCharges: 0,
          discountAmount: quotationWizardDiscountAmount,
          advanceAmount: quotationWizardAdvanceAmount,
          deliveryDate: quotationWizard.amounts.deliveryDate || null,
          balanceAmount: quotationWizardBalanceAmount,
          paymentStatus: quotationWizardAdvanceAmount > 0 && quotationWizardBalanceAmount > 0 ? "partial" : "pending",
          orderStatus: "NEW",
          deliveryType: "PICKUP",
          sourceChannel: "seller-dashboard-modal",
          recordStatus: "submitted",
          customerMonthlyBilling: Boolean(quotationWizard.customer.monthlyBilling)
        })
      });

      setQuotationWizard((prev) => ({
        ...prev,
        submittedQuotation: response.quotation,
        step: "preview"
      }));
      setQuotationWizardSubmitting(false);

      try {
        const previewUrl = await createQuotationPreviewUrl(response.quotation.id);
        if (quotationPreviewUrl) {
          URL.revokeObjectURL(quotationPreviewUrl);
        }
        setQuotationPreviewUrl(previewUrl);
      } catch {
        setQuotationPreviewUrl("");
      }

      try {
        await loadDashboardData(dashboardRange);
      } catch {
        // Keep the created quotation visible even if dashboard refresh is delayed.
      }

      if (Array.isArray(response.inventoryWarnings) && response.inventoryWarnings.length > 0) {
        setError(`Quotation created successfully. ${response.inventoryWarnings.join(" ")}`);
      } else {
        setError("Quotation created successfully.");
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setQuotationWizardSubmitting(false);
    }
  }

  async function handleSaveDecodeRules(event) {
    event.preventDefault();
    try {
      const updated = await apiFetch("/api/whatsapp/decode-rules", {
        method: "PUT",
        body: JSON.stringify({
          customerLine: Number(decodeRules.customer_line || 1),
          mobileLine: Number(decodeRules.mobile_line || 2),
          itemLine: Number(decodeRules.item_line || 3),
          deliveryDateLine: Number(decodeRules.delivery_date_line || 4),
          deliveryTypeLine: Number(decodeRules.delivery_type_line || 5),
          enabled: Boolean(decodeRules.enabled)
        })
      });
      setDecodeRules(updated);
      setError("Decode formula updated.");
    } catch (err) {
      handleApiError(err);
    }
  }
  async function handleSaveQuotationTemplate(event) {
    event.preventDefault();
    try {
      await apiFetch("/api/quotations/templates/current", {
        method: "PUT",
        body: JSON.stringify({
          templatePreset: quotationTemplate.template_preset,
          headerText: quotationTemplate.header_text,
          bodyTemplate: quotationTemplate.body_template,
          footerText: quotationTemplate.footer_text,
          companyPhone: quotationTemplate.company_phone,
          companyEmail: quotationTemplate.company_email,
          companyAddress: quotationTemplate.company_address,
          headerImageData: quotationTemplate.header_image_data,
          showHeaderImage: quotationTemplate.show_header_image,
          logoImageData: quotationTemplate.logo_image_data,
          showLogoOnly: quotationTemplate.show_logo_only,
          accentColor: quotationTemplate.accent_color,
          notesText: quotationTemplate.notes_text,
          termsText: quotationTemplate.terms_text,
          emailEnabled: quotationTemplate.email_enabled,
          whatsappEnabled: quotationTemplate.whatsapp_enabled
        })
      });
      setError("Quotation format updated.");
    } catch (err) {
      handleApiError(err);
    }
  }

  function applyQuotationTemplatePreset(presetKey) {
    const defaults = getQuotationTemplatePresetDefaults(presetKey);
    setQuotationTemplate((prev) => ({
      ...prev,
      template_preset: presetKey,
      ...defaults
    }));
  }

  async function handleQuotationTemplateImageChange(event, targetField, defaultToggleField = null) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setQuotationTemplate((prev) => ({
        ...prev,
        [targetField]: dataUrl,
        ...(defaultToggleField ? { [defaultToggleField]: true } : {})
      }));
    } catch (err) {
      handleApiError(err);
    } finally {
      event.target.value = "";
    }
  }

  async function handleQuotationHeaderImageChange(event) {
    return handleQuotationTemplateImageChange(event, "header_image_data", "show_header_image");
  }

  async function handleQuotationLogoImageChange(event) {
    return handleQuotationTemplateImageChange(event, "logo_image_data", "show_logo_only");
  }

  async function handleDownloadQuotation(orderId) {
    try {
      const token = auth?.token || getStoredAuth()?.token || null;
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);
      const response = await fetch(`${baseUrl}/api/quotations/${orderId}/download`, {
        signal: controller.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      window.clearTimeout(timeoutId);

      if (!response.ok) throw new Error("Failed to download quotation");
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const filename = nameMatch?.[1] || `${getQuotationFileStem(selectedOrderDetails?.quotation || { id: orderId })}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err?.name === "AbortError") {
        setError("PDF download timed out, even after fallback. Please try again.");
        return;
      }
      handleApiError(err);
    }
  }

  async function handleDownloadRichPdfDebug(orderId) {
    try {
      const token = auth?.token || getStoredAuth()?.token || null;
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 20000);
      const response = await fetch(`${baseUrl}/api/quotations/${orderId}/download?debug=1`, {
        signal: controller.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      window.clearTimeout(timeoutId);
      if (!response.ok) throw new Error("Failed to run rich PDF debug");
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const filename = nameMatch?.[1] || `${getQuotationFileStem(selectedOrderDetails?.quotation || { id: orderId })}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err?.name === "AbortError") {
        setError("Rich PDF debug timed out. Please check backend logs for the last printed stage.");
        return;
      }
      handleApiError(err);
    }
  }

  async function handleDownloadQuotationSheet(orderId) {
    try {
      const details = await apiFetch(`/api/quotations/${orderId}`);
      const quotation = details?.quotation || {};
      const items = Array.isArray(details?.items) ? details.items : [];
      const rows = items.map((item) => ({
        "Customer name": quotation.firm_name || quotation.customer_name || "",
        "Customer Mobile Number": quotation.mobile || "",
        Material: item.material_name || item.design_name || item.sku || "",
        Thickness: item.thickness || "",
        Size: item.size || "",
        rate: Number(item.unit_price || 0)
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Quotation");
      XLSX.writeFile(workbook, `quotation-${getVisibleQuotationNumber(quotation) || orderId}.xlsx`);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleOpenOrderDetails(orderId) {
    try {
      const [details, versions] = await Promise.all([
        apiFetch(`/api/quotations/${orderId}`),
        apiFetch(`/api/quotations/${orderId}/versions`).catch(() => [])
      ]);
      setSelectedOrderDetails(details);
      const versionRows = Array.isArray(versions) ? versions : [];
      setOrderVersions(versionRows);
      setSelectedVersionId(versionRows[0] ? String(versionRows[0].id) : "");
      setQuotationEditForm(buildOrderEditForm(details));
      setIsEditingQuotation(false);
      setShowOrderDetailsModal(true);
    } catch (err) {
      handleApiError(err);
    }
  }

  function closeOrderDetailsModal() {
    setShowOrderDetailsModal(false);
    setSelectedOrderDetails(null);
    setOrderVersions([]);
    setSelectedVersionId("");
    setIsEditingQuotation(false);
  }

  function handleQuotationItemChange(index, field, value) {
    setQuotationEditForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [field]: value } : item
      ))
    }));
  }

  async function handleSaveQuotationRevision() {
    if (!selectedOrderDetails?.quotation?.id) return;

    try {
      const response = await apiFetch(`/api/quotations/${selectedOrderDetails.quotation.id}/revise`, {
        method: "PATCH",
        body: JSON.stringify({
          customQuotationNumber: quotationEditForm.customQuotationNumber || null,
          deliveryType: quotationEditForm.deliveryType,
          deliveryDate: quotationEditForm.deliveryDate || null,
          deliveryAddress: quotationEditForm.deliveryAddress || null,
          deliveryPincode: quotationEditForm.deliveryPincode || null,
          transportCharges: Number(quotationEditForm.transportCharges || 0),
          designCharges: Number(quotationEditForm.designCharges || 0),
          items: quotationEditForm.items.map((item) => ({
            productId: item.productId ? Number(item.productId) : null,
            variantId: item.variantId ? Number(item.variantId) : null,
            materialType: item.materialType || item.materialName || null,
            thickness: item.thickness || null,
            size: item.size || null,
            quantity: Number(item.quantity || 0),
            unitPrice: Number(item.unitPrice || 0),
            sku: item.sku || null
          }))
        })
      });

      const [quotationRows, summary] = await Promise.all([
        apiFetch("/api/quotations"),
        apiFetch(`/api/dashboard/summary?range=${dashboardRange}`)
      ]);

      setQuotations(quotationRows);
      setDashboardData(summary);
      setSelectedOrderDetails((prev) => ({
        ...prev,
        quotation: response.quotation,
        items: response.items
      }));
      setOrderVersions(response.versions || []);
      setSelectedVersionId(response.versions?.[0] ? String(response.versions[0].id) : "");
      setQuotationEditForm(buildOrderEditForm({
        quotation: response.quotation,
        items: response.items
      }));
      setIsEditingQuotation(false);
      setError("Quotation updated and saved as a new version.");
    } catch (err) {
      handleApiError(err);
    }
  }

  function changeSort(key) {
    setOrderSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
    }));
  }

  function renderPagination(page, setPage, total) {
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return (
      <div className="pagination-bar">
        <button type="button" className="ghost-btn" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>Prev</button>
        <span>Page {page} / {pageCount}</span>
        <button type="button" className="ghost-btn" onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))} disabled={page === pageCount}>Next</button>
      </div>
    );
  }

  if (!authReady) {
    return <div className="auth-wrap"><div className="glass-card">Preparing dashboard...</div></div>;
  }

  if (isPublicLeadPage) {
    return (
      <PublicLeadCapturePage
        form={publicLeadForm}
        submitting={publicLeadSubmitting}
        successMessage={publicLeadSuccess}
        errorMessage={publicLeadError}
        onChange={updatePublicLeadField}
        onSubmit={handleSubmitPublicLead}
      />
    );
  }

  if (isPublicDemoPage) {
    return (
      <PublicDemoSignupPage
        form={publicDemoForm}
        submitting={publicDemoSubmitting}
        successMessage={publicDemoSuccess}
        errorMessage={publicDemoError}
        onChange={updatePublicDemoField}
        onSubmit={handleSubmitPublicDemo}
      />
    );
  }

  if (!auth?.token) {
    if (isPublicLandingPage) {
      return <PublicLandingPage />;
    }
    return (
      <PublicLoginPage
        bootstrapRequired={bootstrapRequired}
        loginForm={loginForm}
        setupForm={setupForm}
        rememberMe={rememberMe}
        errorMessage={error}
        onLoginFormChange={setLoginForm}
        onSetupFormChange={setSetupForm}
        onRememberMeChange={setRememberMe}
        onLogin={handleLogin}
        onBootstrapAdmin={handleBootstrapAdmin}
      />
    );
  }

  const responsivePaths = new Set(["/web", "/mobile", "/responsive"]);
  const useResponsiveWorkspace = responsivePaths.has(window.location.pathname);
  if (useResponsiveWorkspace) {
    if (isPlatformAdmin) {
      return (
        <div className="auth-shell">
          <div className="auth-bg-glow" />
          <div className="auth-grid">
            <div className="glass-card hero-card">
              <p className="eyebrow">BillBuddy Platform</p>
              <h1>Platform admins use the control-plane interface.</h1>
              <p>The responsive `/web` workspace is reserved for seller-side quotation work. Please continue in the platform console for seller management and governance.</p>
              <div style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
                <a className="glass-btn" href="/">Open Platform Console</a>
                <button type="button" onClick={handleLogout}>Logout</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <ResponsiveQuotationApp
        auth={auth}
        seller={seller}
        plans={plans}
        customers={customers}
        products={products}
        quotationTemplate={quotationTemplate}
        onLogout={handleLogout}
        onCustomerCreated={(createdCustomer) => setCustomers((prev) => [createdCustomer, ...prev])}
      />
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>
      <aside className="sidebar glass-panel">
        <div className="brand-block">
          <div className="brand-dot" />
          <div>
            <h2>{isPlatformAdmin ? "BillBuddy Platform" : "BillBuddy"}</h2>
            <p>{isPlatformAdmin ? "Control Plane" : (seller?.name || "Seller Workspace")}</p>
          </div>
        </div>

        <nav className="nav-list">
          {currentModules.map((module) => (
            <button
              key={module}
              type="button"
              className={activeModule === module ? "nav-item active" : "nav-item"}
              onClick={() => {
                if (module === "Configuration Studio" && !isPlatformAdmin && seller) {
                  openSellerConfigurationStudio(seller);
                  return;
                }
                setActiveModule(module);
              }}
            >
              <span className="nav-mark" aria-hidden="true" />
              <span className="nav-label">{module}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar glass-panel">
          <div className="search-wrap">
            <input placeholder="Search orders, customers, products..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="top-actions">
            <button className="glass-btn alerts-btn" type="button">Alerts</button>
            <button
              className="glass-btn notifications-btn"
              type="button"
              onClick={() => {
                if (isPlatformAdmin) {
                  setActiveModule("Notifications");
                  return;
                }
                setShowSellerNotificationsModal(true);
              }}
            >
              Notifications
              {unreadNotificationsCount > 0 && (
                <span className="notification-count-pill">{unreadNotificationsCount}</span>
              )}
            </button>
            <div className="profile-menu-wrap">
              <button className="profile-chip profile-trigger" type="button" onClick={() => setShowProfileMenu((prev) => !prev)}>
                <span>{auth.user?.name}</span>
              </button>
              {showProfileMenu && (
                <div className="profile-dropdown glass-panel">
                  <strong>{auth.user?.name}</strong>
                  <span>{isPlatformAdmin ? "Platform Admin" : auth.user?.role}</span>
                  <button className="ghost-btn" type="button" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {loading && <div className="notice">Syncing latest data...</div>}
        {error && !showMessageSimulatorModal && <div className="notice error">{error}</div>}
        {!isPlatformAdmin && sellerSubscriptionBanner && (
          <div className={`notice ${sellerSubscriptionBanner.tone === "error" ? "error" : sellerSubscriptionBanner.tone === "info" ? "info" : ""}`}>
            <div className="notice-stack">
              <div>
                <strong>{sellerSubscriptionBanner.title}</strong> {sellerSubscriptionBanner.message}
              </div>
              {sellerSubscriptionBanner.showUpgradeCta && (
                <div className="banner-actions">
                  {(sellerSubscriptionBanner.suggestedPlans || []).map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      className="ghost-btn compact-btn"
                      disabled={upgradeRequestLoading}
                      onClick={() => handleSellerUpgradeRequest(plan.plan_code)}
                    >
                      {upgradeRequestLoading ? "Sending..." : `Upgrade to ${plan.plan_name}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeModule === "Leads" ? (
          <section className="module-placeholder glass-panel">
            <div className="page-banner">
              <div>
                <p className="eyebrow">{currentModuleMeta.Leads.eyebrow}</p>
                <h2>{currentModuleMeta.Leads.title}</h2>
                <p>{currentModuleMeta.Leads.subtitle}</p>
              </div>
              <div className="banner-stat">
                <span>Total Leads</span>
                <strong>{leads.length}</strong>
              </div>
            </div>

            <div className="section-head">
              <h3>Lead List</h3>
              <span>Click a row to open lead detail</span>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Name</th><th>Mobile</th><th>Business</th><th>City</th><th>Status</th><th>Demo</th><th>Source</th></tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr><td colSpan="7">No leads captured yet.</td></tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="lead-row" onClick={() => openLeadDetail(lead.id)}>
                      <td>{lead.name}</td>
                      <td>{lead.mobile}</td>
                      <td>{lead.business_name || "-"}</td>
                      <td>{lead.city || "-"}</td>
                      <td><span className="badge pending">{lead.status || "new"}</span></td>
                      <td>{lead.interested_in_demo ? "Yes" : "No"}</td>
                      <td>{lead.source || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {showLeadConvertModal && selectedLeadDetail?.lead && (
              <div className="modal-overlay" onClick={closeLeadConvertModal}>
                <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
                  <div className="section-head">
                    <h3>Convert Lead to Demo</h3>
                    <button type="button" className="ghost-btn" onClick={closeLeadConvertModal}>Close</button>
                  </div>
                  <form className="auth-card compact-form" onSubmit={handleConvertLeadToDemo}>
                    <input placeholder="Seller Name" value={leadConvertForm.sellerName} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, sellerName: e.target.value }))} required />
                    <input placeholder="Business Name" value={leadConvertForm.businessName} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, businessName: e.target.value }))} />
                    <input placeholder="Seller Code" value={leadConvertForm.sellerCode} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, sellerCode: e.target.value.toUpperCase() }))} required />
                    <input placeholder="City" value={leadConvertForm.city} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, city: e.target.value }))} />
                    <input placeholder="State" value={leadConvertForm.state} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, state: e.target.value }))} />
                    <input placeholder="Business Category" value={leadConvertForm.businessCategory} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, businessCategory: e.target.value }))} />
                    <input placeholder="Master User Name" value={leadConvertForm.masterUserName} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, masterUserName: e.target.value }))} />
                    <input placeholder="Master User Mobile" value={leadConvertForm.masterUserMobile} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, masterUserMobile: e.target.value }))} />
                    <input placeholder="Master User Password" type="password" value={leadConvertForm.masterUserPassword} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, masterUserPassword: e.target.value }))} />
                    <button type="submit" disabled={leadConvertSubmitting}>
                      {leadConvertSubmitting ? "Creating Demo..." : "Create Demo Account"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {showLeadDetailModal && (
              <div className="modal-overlay" onClick={closeLeadDetailModal}>
                <div className="modal-card modal-wide glass-panel lead-detail-modal" onClick={(event) => event.stopPropagation()}>
                  <div className="section-head">
                    <h3>Lead Detail</h3>
                    <button type="button" className="ghost-btn" onClick={closeLeadDetailModal}>Close</button>
                  </div>
                  {leadDetailLoading ? (
                    <p className="muted">Loading lead detail...</p>
                  ) : !selectedLeadDetail ? (
                    <p className="muted">Lead detail is unavailable right now.</p>
                  ) : (
                    <>
                      <div className="seller-detail-grid">
                        <article className="seller-detail-card">
                          <h4>Basic Info</h4>
                          <div className="seller-detail-list">
                            <div><span>Name</span><strong>{selectedLeadDetail.lead.name}</strong></div>
                            <div><span>Mobile</span><strong>{selectedLeadDetail.lead.mobile}</strong></div>
                            <div><span>Email</span><strong>{selectedLeadDetail.lead.email || "-"}</strong></div>
                            <div><span>Business</span><strong>{selectedLeadDetail.lead.business_name || "-"}</strong></div>
                            <div><span>City</span><strong>{selectedLeadDetail.lead.city || "-"}</strong></div>
                            <div><span>Business type</span><strong>{selectedLeadDetail.lead.business_type || "-"}</strong></div>
                          </div>
                        </article>

                        <article className="seller-detail-card">
                          <h4>Lifecycle</h4>
                          <div className="seller-detail-list">
                            <div><span>Status</span><strong>{selectedLeadDetail.lead.status || "new"}</strong></div>
                            <div><span>Source</span><strong>{selectedLeadDetail.lead.source || "-"}</strong></div>
                            <div><span>Interested in demo</span><strong>{selectedLeadDetail.lead.interested_in_demo ? "Yes" : "No"}</strong></div>
                            <div><span>Assigned user</span><strong>{selectedLeadDetail.lead.assigned_user_name || "-"}</strong></div>
                            <div><span>Linked seller</span><strong>{selectedLeadDetail.lead.seller_id || "-"}</strong></div>
                            <div><span>Created</span><strong>{formatDateTime(selectedLeadDetail.lead.created_at)}</strong></div>
                            <div><span>Updated</span><strong>{formatDateTime(selectedLeadDetail.lead.updated_at)}</strong></div>
                          </div>
                        </article>

                        <article className="seller-detail-card">
                          <h4>Requirement</h4>
                          <p>{selectedLeadDetail.lead.requirement || "No requirement added yet."}</p>
                        </article>
                      </div>

                      <article className="seller-detail-section">
                        <div className="section-head compact">
                          <h3>Activity History</h3>
                          <span>{selectedLeadDetail.activity?.length || 0} entries</span>
                        </div>
                        <form className="auth-card compact-form" onSubmit={handleAddLeadActivity} style={{ marginBottom: "14px" }}>
                          <textarea
                            rows={3}
                            placeholder="Add follow-up note"
                            value={leadActivityNote}
                            onChange={(e) => setLeadActivityNote(e.target.value)}
                          />
                          <button type="submit">Add Note</button>
                        </form>
                        <table className="data-table">
                          <thead>
                            <tr><th>When</th><th>Type</th><th>Actor</th><th>Note</th></tr>
                          </thead>
                          <tbody>
                            {(selectedLeadDetail.activity || []).length === 0 ? (
                              <tr><td colSpan="4">No activity yet.</td></tr>
                            ) : (
                              selectedLeadDetail.activity.map((entry) => (
                                <tr key={entry.id}>
                                  <td>{formatDateTime(entry.created_at)}</td>
                                  <td>{formatAuditActionLabel(entry.activity_type)}</td>
                                  <td>{entry.actor_name || entry.actor_mobile || "System"}</td>
                                  <td>{entry.note || "-"}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </article>

                      <div className="modal-fixed-actions">
                        <select
                          value={selectedLeadDetail.lead.status || "new"}
                          onChange={(e) => handleLeadUpdate(selectedLeadDetail.lead.id, { status: e.target.value })}
                        >
                          {LEAD_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                        <select
                          value={selectedLeadDetail.lead.assigned_user_id || ""}
                          onChange={(e) => handleLeadUpdate(selectedLeadDetail.lead.id, { assignedUserId: e.target.value || null })}
                        >
                          <option value="">Assign owner</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>{user.name} ({user.mobile})</option>
                          ))}
                        </select>
                        <button type="button" className="ghost-btn" onClick={() => handleLeadUpdate(selectedLeadDetail.lead.id, { status: "demo_created", note: "Lead moved to demo created stage." })}>
                          Mark Demo Created
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={openLeadConvertModal}
                          disabled={Boolean(selectedLeadDetail.lead.seller_id)}
                        >
                          {selectedLeadDetail.lead.seller_id ? "Demo Linked" : "Convert to Demo"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : activeModule === "Sellers" ? (
          <section className="module-placeholder glass-panel">
            <div className="page-banner">
              <div>
                <p className="eyebrow">{currentModuleMeta.Sellers.eyebrow}</p>
                <h2>{currentModuleMeta.Sellers.title}</h2>
                <p>{currentModuleMeta.Sellers.subtitle}</p>
              </div>
              <div className="banner-stat">
                <span>Total Sellers</span>
                <strong>{sellers.length}</strong>
              </div>
            </div>

            <div className="section-head">
              <h3>Seller List</h3>
              <div className="toolbar-controls">
                <input
                  type="search"
                  className="toolbar-search"
                  placeholder="Search seller, plan, code..."
                  value={sellerSearch}
                  onChange={(e) => setSellerSearch(e.target.value)}
                />
                <span>{filteredSellers.length} seller(s)</span>
                <button type="button" className="action-btn" onClick={() => setShowSellerCreateModal(true)}>Create New Seller</button>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr><th>Seller</th><th>Business</th><th>Mobile</th><th>Plan</th><th>Status</th><th>Trial End</th><th>Users</th><th>Orders</th></tr>
              </thead>
              <tbody>
                {pagedSellers.length === 0 ? (
                  <tr><td colSpan="8">No sellers created yet.</td></tr>
                ) : (
                  pagedSellers.map((sellerRow, index) => (
                    <tr key={sellerRow.id} className="lead-row" onClick={() => openSellerDetail(sellerRow)}>
                      <td>
                        <strong>{sellerRow.name}</strong>
                        <div className="seller-meta-stack">
                          <span>#{(sellerPage - 1) * PAGE_SIZE + index + 1}</span>
                          <span>{sellerRow.seller_code}</span>
                          <span>{sellerRow.email || "-"}</span>
                        </div>
                      </td>
                      <td>{sellerRow.business_name || "-"}</td>
                      <td>{sellerRow.mobile || "-"}</td>
                      <td>{sellerRow.plan_name || sellerRow.subscription_plan || "-"}</td>
                      <td><span className={`badge ${sellerRow.is_locked ? "pending" : "success"}`}>{sellerRow.is_locked ? "Locked" : (sellerRow.status || "active")}</span></td>
                      <td>{formatDateIST(sellerRow.trial_end_at)}</td>
                      <td>{sellerRow.user_count || 0}</td>
                      <td>{sellerRow.order_count || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {renderPagination(sellerPage, setSellerPage, filteredSellers.length)}

            {showSellerCreateModal && (
              <div className="modal-overlay" onClick={() => setShowSellerCreateModal(false)}>
                <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
                  <div className="section-head">
                    <h3>Create Seller</h3>
                    <button type="button" className="ghost-btn" onClick={() => setShowSellerCreateModal(false)}>Close</button>
                  </div>
                  <form className="auth-card compact-form" onSubmit={handleCreateSeller}>
                    <input placeholder="Seller Name" value={sellerForm.name} onChange={(e) => setSellerForm((prev) => ({ ...prev, name: e.target.value }))} required />
                    <input placeholder="Seller Code" value={sellerForm.sellerCode} onChange={(e) => setSellerForm((prev) => ({ ...prev, sellerCode: e.target.value }))} required />
                    <input placeholder="Business Name" value={sellerForm.businessName || ""} onChange={(e) => setSellerForm((prev) => ({ ...prev, businessName: e.target.value }))} />
                    <input placeholder="Mobile" value={sellerForm.mobile} onChange={(e) => setSellerForm((prev) => ({ ...prev, mobile: e.target.value }))} />
                    <input placeholder="Email" value={sellerForm.email} onChange={(e) => setSellerForm((prev) => ({ ...prev, email: e.target.value }))} />
                    <select value={sellerForm.status} onChange={(e) => setSellerForm((prev) => ({ ...prev, status: e.target.value }))}>
                      {SELLER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <input type="date" value={sellerForm.trialEndsAt} onChange={(e) => setSellerForm((prev) => ({ ...prev, trialEndsAt: e.target.value }))} />
                    <select value={sellerForm.subscriptionPlan} onChange={(e) => setSellerForm((prev) => ({ ...prev, subscriptionPlan: e.target.value }))}>
                      {plans.map((plan) => <option key={plan.id} value={plan.plan_code}>{plan.plan_name} ({plan.plan_code})</option>)}
                    </select>
                    <input placeholder="Max Users" type="number" min="0" value={sellerForm.maxUsers} onChange={(e) => setSellerForm((prev) => ({ ...prev, maxUsers: e.target.value }))} />
                    <input placeholder="Max Orders / Month" type="number" min="0" value={sellerForm.maxOrdersPerMonth} onChange={(e) => setSellerForm((prev) => ({ ...prev, maxOrdersPerMonth: e.target.value }))} />
                    <select value={sellerForm.themeKey} onChange={(e) => setSellerForm((prev) => ({ ...prev, themeKey: e.target.value }))}>
                      {THEME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <input type="color" value={sellerForm.brandPrimaryColor} onChange={(e) => setSellerForm((prev) => ({ ...prev, brandPrimaryColor: e.target.value }))} />
                    <label className="seller-toggle">
                      <input type="checkbox" checked={sellerForm.isLocked} onChange={(e) => setSellerForm((prev) => ({ ...prev, isLocked: e.target.checked }))} style={{ width: "auto" }} />
                      Locked
                    </label>
                    <input placeholder="Master User Name" value={sellerForm.masterName} onChange={(e) => setSellerForm((prev) => ({ ...prev, masterName: e.target.value }))} />
                    <input placeholder="Master User Mobile" value={sellerForm.masterMobile} onChange={(e) => setSellerForm((prev) => ({ ...prev, masterMobile: e.target.value }))} />
                    <input placeholder="Master User Password" type="password" value={sellerForm.masterPassword} onChange={(e) => setSellerForm((prev) => ({ ...prev, masterPassword: e.target.value }))} />
                    <button type="submit">Create Seller</button>
                  </form>
                </div>
              </div>
            )}
          </section>
        ) : activeModule === "Subscriptions" ? (
          <section className="module-placeholder glass-panel">
            <div className="page-banner">
              <div>
                <p className="eyebrow">{currentModuleMeta.Subscriptions.eyebrow}</p>
                <h2>{currentModuleMeta.Subscriptions.title}</h2>
                <p>{currentModuleMeta.Subscriptions.subtitle}</p>
              </div>
              <div className="banner-stat">
                <span>Total Subscriptions</span>
                <strong>{subscriptions.length}</strong>
              </div>
            </div>

            <div className="section-head">
              <h3>Subscription List</h3>
              <div className="toolbar-controls">
                <input
                  type="search"
                  className="toolbar-search"
                  placeholder={isPlatformAdmin ? "Search seller, plan, status..." : "Search plan, status, billing..."}
                  value={subscriptionSearch}
                  onChange={(e) => setSubscriptionSearch(e.target.value)}
                />
                <span>{filteredSubscriptions.length} subscription(s)</span>
              </div>
            </div>

            {!isPlatformAdmin && (
              <div className="seller-subscription-summary">
                {currentSellerSubscription ? (
                  <>
                    <div className="seller-subscription-summary-card">
                      <span className="eyebrow">Current Active Plan</span>
                      <h3>{currentSellerSubscription.plan_name || currentSellerSubscription.plan_code || "Plan"}</h3>
                      <div className="seller-detail-list">
                        <div><span>Status</span><strong>{currentSellerSubscription.status || "-"}</strong></div>
                        <div><span>Billing</span><strong>{currentSellerSubscription.billing_cycle || "-"}</strong></div>
                        <div><span>Trial End</span><strong>{formatDateIST(currentSellerSubscription.trial_end_at)}</strong></div>
                        <div><span>Start Date</span><strong>{formatDateIST(currentSellerSubscription.start_date)}</strong></div>
                      </div>
                    </div>
                    <div className="seller-subscription-summary-card">
                      <span className="eyebrow">Plan Visibility</span>
                      <p className="muted">This block always shows the currently active subscription for your seller account. Historical and expired subscriptions remain listed below.</p>
                    </div>
                  </>
                ) : (
                  <div className="seller-subscription-summary-card">
                    <span className="eyebrow">Current Active Plan</span>
                    <h3>No subscription activated</h3>
                    <p className="muted">No active or trial subscription record is currently linked to this seller account.</p>
                  </div>
                )}
              </div>
            )}

            <table className="data-table">
              <thead>
                <tr>
                  {isPlatformAdmin ? <th>Seller</th> : <th>Subscription</th>}
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Trial End</th>
                  <th>Start</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscriptions.length === 0 ? (
                  <tr><td colSpan="6">No subscriptions found.</td></tr>
                ) : (
                  filteredSubscriptions.map((subscription) => (
                    <tr
                      key={subscription.id}
                      className={`${isPlatformAdmin ? "lead-row " : ""}${String(subscription.status || "").toLowerCase() === "active" ? "subscription-row-active" : ""}`}
                      onClick={isPlatformAdmin ? () => openSubscriptionDetail({
                        id: subscription.seller_id,
                        name: subscription.seller_name,
                        seller_code: subscription.seller_code
                      }) : undefined}
                    >
                      <td>
                        <strong>{isPlatformAdmin ? subscription.seller_name : `Sub #${subscription.id}`}</strong>
                        <div className="seller-meta-stack">
                          <span>{isPlatformAdmin ? subscription.seller_code : (subscription.billing_cycle || "-")}</span>
                          <span>{isPlatformAdmin ? `Sub #${subscription.id}` : (subscription.updated_at ? `Updated ${formatDateIST(subscription.updated_at)}` : "History")}</span>
                        </div>
                      </td>
                      <td>
                        <strong>{subscription.plan_name || "-"}</strong>
                        <div className="seller-meta-stack">
                          <span>{subscription.plan_code || "-"}</span>
                          <span>{subscription.is_demo_plan ? "Demo plan" : "Standard plan"}</span>
                        </div>
                      </td>
                      <td><span className={`badge ${subscription.status === "active" ? "success" : "pending"}`}>{subscription.status || "-"}</span></td>
                      <td>{formatDateIST(subscription.trial_end_at)}</td>
                      <td>{formatDateIST(subscription.start_date)}</td>
                      <td>{formatDateIST(subscription.end_date)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        ) : activeModule === "Plans" ? (
          <section className="module-placeholder glass-panel">
            <div className="page-banner">
              <div>
                <p className="eyebrow">{currentModuleMeta.Plans.eyebrow}</p>
                <h2>{currentModuleMeta.Plans.title}</h2>
                <p>{currentModuleMeta.Plans.subtitle}</p>
              </div>
              <div className="banner-stat">
                <span>Total Plans</span>
                <strong>{plans.length}</strong>
              </div>
            </div>

            <div className="section-head">
              <h3>Plan List</h3>
              <div className="toolbar-controls">
                <input
                  type="search"
                  className="toolbar-search"
                  placeholder="Search plan, code, billing..."
                  value={planSearch}
                  onChange={(e) => setPlanSearch(e.target.value)}
                />
                <span>{filteredPlans.length} plan(s)</span>
                <button type="button" className="action-btn" onClick={() => setShowPlanCreateModal(true)}>Create New Plan</button>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr><th>Plan</th><th>Price</th><th>Billing</th><th>Trial</th><th>Users</th><th>Quotations</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filteredPlans.length === 0 ? (
                  <tr><td colSpan="7">No plans created yet.</td></tr>
                ) : (
                  filteredPlans.map((plan) => (
                    <tr key={plan.id} className="lead-row" onClick={() => openPlanDetail(plan)}>
                      <td>
                        <strong>{plan.plan_name}</strong>
                        <div className="seller-meta-stack">
                          <span>{plan.plan_code}</span>
                          <span>{plan.is_demo_plan ? "Demo plan" : "Paid/standard plan"}</span>
                        </div>
                      </td>
                      <td>{formatCurrency(plan.price || 0)}</td>
                      <td>{plan.billing_cycle || "-"}</td>
                      <td>{plan.trial_enabled ? `${plan.trial_duration_days || 0} days` : "No"}</td>
                      <td>{plan.max_users ?? "-"}</td>
                      <td>{plan.max_quotations ?? "-"}</td>
                      <td><span className={`badge ${plan.is_active ? "success" : "pending"}`}>{plan.is_active ? "Active" : "Inactive"}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {showPlanCreateModal && (
              <div className="modal-overlay" onClick={() => setShowPlanCreateModal(false)}>
                <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
                  <div className="section-head">
                    <h3>Create Plan</h3>
                    <button type="button" className="ghost-btn" onClick={() => setShowPlanCreateModal(false)}>Close</button>
                  </div>
                  <form className="auth-card compact-form" onSubmit={handleCreatePlan}>
                    <div className="seller-lifecycle-grid">
                      <input placeholder="Plan Code" value={planForm.planCode} onChange={(e) => setPlanForm((prev) => ({ ...prev, planCode: e.target.value.toUpperCase() }))} required />
                      <input placeholder="Plan Name" value={planForm.planName} onChange={(e) => setPlanForm((prev) => ({ ...prev, planName: e.target.value }))} required />
                      <input placeholder="Price" type="number" min="0" step="0.01" value={planForm.price} onChange={(e) => setPlanForm((prev) => ({ ...prev, price: e.target.value }))} />
                      <select value={planForm.billingCycle} onChange={(e) => setPlanForm((prev) => ({ ...prev, billingCycle: e.target.value }))}>
                        {BILLING_CYCLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      <input placeholder="Trial Days" type="number" min="0" value={planForm.trialDurationDays} onChange={(e) => setPlanForm((prev) => ({ ...prev, trialDurationDays: e.target.value }))} />
                      <input placeholder="Watermark Text" value={planForm.watermarkText} onChange={(e) => setPlanForm((prev) => ({ ...prev, watermarkText: e.target.value }))} />
                      <input placeholder="Max Users" type="number" min="0" value={planForm.maxUsers} onChange={(e) => setPlanForm((prev) => ({ ...prev, maxUsers: e.target.value }))} />
                      <input placeholder="Max Quotations" type="number" min="0" value={planForm.maxQuotations} onChange={(e) => setPlanForm((prev) => ({ ...prev, maxQuotations: e.target.value }))} />
                      <input placeholder="Max Customers" type="number" min="0" value={planForm.maxCustomers} onChange={(e) => setPlanForm((prev) => ({ ...prev, maxCustomers: e.target.value }))} />
                    </div>
                    <div className="seller-lifecycle-grid">
                      <label className="seller-toggle"><input type="checkbox" checked={planForm.isActive} onChange={(e) => setPlanForm((prev) => ({ ...prev, isActive: e.target.checked }))} style={{ width: "auto" }} />Active</label>
                      <label className="seller-toggle"><input type="checkbox" checked={planForm.isDemoPlan} onChange={(e) => setPlanForm((prev) => ({ ...prev, isDemoPlan: e.target.checked }))} style={{ width: "auto" }} />Demo Plan</label>
                      <label className="seller-toggle"><input type="checkbox" checked={planForm.trialEnabled} onChange={(e) => setPlanForm((prev) => ({ ...prev, trialEnabled: e.target.checked }))} style={{ width: "auto" }} />Trial Enabled</label>
                      <label className="seller-toggle"><input type="checkbox" checked={planForm.inventoryEnabled} onChange={(e) => setPlanForm((prev) => ({ ...prev, inventoryEnabled: e.target.checked }))} style={{ width: "auto" }} />Inventory</label>
                      <label className="seller-toggle"><input type="checkbox" checked={planForm.reportsEnabled} onChange={(e) => setPlanForm((prev) => ({ ...prev, reportsEnabled: e.target.checked }))} style={{ width: "auto" }} />Reports</label>
                      <label className="seller-toggle"><input type="checkbox" checked={planForm.gstEnabled} onChange={(e) => setPlanForm((prev) => ({ ...prev, gstEnabled: e.target.checked }))} style={{ width: "auto" }} />GST</label>
                      <label className="seller-toggle"><input type="checkbox" checked={planForm.exportsEnabled} onChange={(e) => setPlanForm((prev) => ({ ...prev, exportsEnabled: e.target.checked }))} style={{ width: "auto" }} />Exports</label>
                      <label className="seller-toggle"><input type="checkbox" checked={planForm.quotationWatermarkEnabled} onChange={(e) => setPlanForm((prev) => ({ ...prev, quotationWatermarkEnabled: e.target.checked }))} style={{ width: "auto" }} />Watermark</label>
                      <label className="seller-toggle"><input type="checkbox" checked={planForm.quotationCreationLockedAfterExpiry} onChange={(e) => setPlanForm((prev) => ({ ...prev, quotationCreationLockedAfterExpiry: e.target.checked }))} style={{ width: "auto" }} />Lock After Expiry</label>
                    </div>
                    <button type="submit">Create Plan</button>
                  </form>
                </div>
              </div>
            )}
          </section>
        ) : activeModule === "Notifications" ? (
          <section className="module-placeholder glass-panel">
            <div className="page-banner">
              <div>
                <p className="eyebrow">{currentModuleMeta.Notifications.eyebrow}</p>
                <h2>{currentModuleMeta.Notifications.title}</h2>
                <p>{currentModuleMeta.Notifications.subtitle}</p>
              </div>
              <div className="banner-stat">
                <span>Notifications</span>
                <strong>{notifications.length}</strong>
              </div>
            </div>

            <div className="section-head">
              <h3>Notification History</h3>
              <div className="toolbar-controls">
                <button type="button" className="action-btn" onClick={() => setShowNotificationCreateModal(true)}>Create Notification</button>
                <span>{notifications.length} record(s)</span>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr><th>Title</th><th>Audience</th><th>Channel</th><th>Created By</th><th>Recipients</th><th>Read</th><th>Status</th></tr>
              </thead>
              <tbody>
                {notifications.length === 0 ? (
                  <tr><td colSpan="7">No notifications created yet.</td></tr>
                ) : (
                  notifications.map((notification) => (
                    <tr key={notification.id} className="lead-row" onClick={() => openNotificationDetail(notification.id)}>
                      <td>
                        <strong>{notification.title}</strong>
                        <div className="seller-meta-stack">
                          <span>{notification.message}</span>
                          <span>{notification.created_at ? formatDateTime(notification.created_at) : "-"}</span>
                        </div>
                      </td>
                      <td>{notification.audience_type}</td>
                      <td>{notification.channel}</td>
                      <td>{notification.creator_name || "System"}</td>
                      <td>{notification.recipient_count ?? 0}</td>
                      <td>
                        <span className={`badge ${(notification.unread_count || 0) > 0 ? "pending" : "success"}`}>
                          {(notification.read_count || 0)}/{(notification.recipient_count || 0)} read
                        </span>
                      </td>
                      <td><span className={`badge ${notification.sent_at ? "success" : "pending"}`}>{notification.sent_at ? "Sent" : "Scheduled"}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        ) : activeModule === "Users" ? (
          <section className="module-placeholder glass-panel user-access">
            <div className="page-banner">
              <div>
                <p className="eyebrow">{currentModuleMeta.Users.eyebrow}</p>
                <h2>{currentModuleMeta.Users.title}</h2>
                <p>{isPlatformAdmin ? "Manage platform-visible user access, lock controls, and governance." : "Create seller-side users, seed roles, and keep access governance organized."}</p>
              </div>
            </div>
            <div className="section-head">
              <h3>User Access Management</h3>
              <div className="toolbar-controls">
                <button className="ghost-btn" type="button" onClick={handleSeedRoles}>Seed Roles</button>
                <button className="action-btn" type="button" onClick={() => setShowUserModal(true)}>Create New User</button>
              </div>
            </div>
            <div className="user-grid">
              <div>
                <table className="data-table">
                  <thead>
                    <tr><th>Sr.</th><th>Name</th><th>Mobile</th><th>Role</th><th>Status</th><th>Lock</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {pagedUsers.map((user, index) => (
                      <tr key={user.id}>
                        <td>{(userPage - 1) * PAGE_SIZE + index + 1}</td>
                        <td>{user.name}</td>
                        <td>{user.mobile}</td>
                        <td>{user.role_name || "-"}</td>
                        <td><span className={`badge ${user.status ? "success" : "pending"}`}>{user.status ? "Active" : "Inactive"}</span></td>
                        <td>
                          {auth.user?.isPlatformAdmin ? (
                            <button className="ghost-btn" type="button" onClick={() => handleLockToggle(user)}>{user.locked ? "Unlock" : "Lock"}</button>
                          ) : (
                            <span>{user.locked ? "Locked" : "Open"}</span>
                          )}
                        </td>
                        <td>
                          {isPlatformAdmin ? (
                            <button className="ghost-btn compact-btn" type="button" onClick={() => handleResetUserPassword(user)}>Reset Password</button>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {renderPagination(userPage, setUserPage, users.length)}
              </div>
            </div>

            {showUserModal && (
              <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
                <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
                  <div className="section-head">
                    <h3>Create User</h3>
                    <button type="button" className="ghost-btn" onClick={() => setShowUserModal(false)}>Close</button>
                  </div>
                  <form className="auth-card compact-form" onSubmit={handleCreateUser}>
                    <input placeholder="Name" value={userForm.name} onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))} required />
                    <input placeholder="Mobile" value={userForm.mobile} onChange={(event) => setUserForm((prev) => ({ ...prev, mobile: event.target.value }))} required />
                    <input placeholder="Password" type="password" value={userForm.password} onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))} />
                    <select value={userForm.roleId} onChange={(event) => setUserForm((prev) => ({ ...prev, roleId: event.target.value }))} required>
                      <option value="">Select Role</option>
                      {roles.map((role) => <option key={role.id} value={role.id}>{role.role_name}</option>)}
                    </select>
                    <select value={userForm.createdBy} onChange={(event) => setUserForm((prev) => ({ ...prev, createdBy: event.target.value }))}>
                      <option value="">Created By (Optional)</option>
                      {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                    </select>
                    <button type="submit">Create User</button>
                  </form>
                </div>
              </div>
            )}
          </section>
        ) : activeModule === "Orders" ? (
          <section className="module-placeholder glass-panel">
            <div className="page-banner">
              <div>
                <p className="eyebrow">Workflow</p>
                <h2>Order Tracker</h2>
                <p>See all orders, quotation status, and message-driven captures in one refined command view.</p>
              </div>
              <div className="banner-stat">
                <span>Active Orders</span>
                <strong>{filteredOrders.length}</strong>
              </div>
            </div>
            <div className="section-head"><h3>Order Tracker</h3><span>{filteredOrders.length} total</span></div>
            <table className="data-table order-table">
              <thead>
                <tr>
                  <th>Sr</th>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Quotation</th>
                  <th>Payment</th>
                  <th>Order Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map((order, index) => (
                  <tr key={order.id}>
                    <td>{(orderPage - 1) * PAGE_SIZE + index + 1}</td>
                    <td><button type="button" className="link-btn" onClick={() => handleOpenOrderDetails(order.id)}>{formatQuotationLabel(order)}</button></td>
                    <td>{order.firm_name || order.customer_name}</td>
                    <td>{formatCurrency(order.total_amount)}</td>
                    <td>
                      <span className={`badge ${order.quotation_sent ? "success" : "pending"}`}>
                        {order.quotation_sent ? "Sent" : "Not Sent"}
                      </span>
                    </td>
                    <td><span className={`badge ${order.payment_status === "paid" ? "success" : "pending"}`}>{statusLabel(order.payment_status)}</span></td>
                    <td>
                      <select value={order.order_status || "NEW"} onChange={(event) => handleOrderStatusUpdate(order.id, event.target.value)}>
                        {ORDER_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="order-actions">
                        <button type="button" className="ghost-btn order-action-btn" onClick={() => handleMarkQuotationSent(order.id)} disabled={order.quotation_sent}>Send</button>
                        <button type="button" className="ghost-btn order-action-btn" onClick={() => handleMarkPaid(order.id)} disabled={order.payment_status === "paid"}>Paid</button>
                        <button type="button" className="ghost-btn order-action-btn icon-btn" onClick={() => handleDownloadQuotationSheet(order.id)} title="Download XLSX">XLSX</button>
                        <button type="button" className="ghost-btn order-action-btn icon-btn" onClick={() => handleDownloadQuotation(order.id)} title="Download PDF">PDF</button>
                        <button type="button" className="ghost-btn order-action-btn" onClick={() => handleDownloadRichPdfDebug(order.id)} title="Run Rich PDF Debug">Rich PDF Debug</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {renderPagination(orderPage, setOrderPage, filteredOrders.length)}
          </section>
        ) : activeModule === "Customers" ? (
          <section className="module-placeholder glass-panel">
            <div className="page-banner">
              <div>
                <p className="eyebrow">CRM</p>
                <h2>Customer Directory</h2>
                <p>Every customer profile stays ready for repeat orders, quotation sending, and follow-up flow.</p>
              </div>
              <div className="banner-stat">
                <span>Total Customers</span>
                <strong>{customers.length}</strong>
              </div>
            </div>
            <div className="section-head">
              <h3>Customers</h3>
              <div className="toolbar-controls">
                <span>{customers.length} total</span>
                <button type="button" className="action-btn" onClick={() => setShowCustomerModal(true)}>Add Customer</button>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sr</th>
                  <th>Name</th>
                  <th>Firm</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th>GST</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="muted">No customers found yet.</td>
                  </tr>
                ) : (
                  pagedCustomers.map((customer, index) => (
                    <tr key={customer.id}>
                      <td>{(customerPage - 1) * PAGE_SIZE + index + 1}</td>
                      <td>{customer.name}</td>
                      <td>{customer.firm_name || "-"}</td>
                      <td>{customer.mobile || "-"}</td>
                      <td>{customer.email || "-"}</td>
                      <td>{customer.address || "-"}</td>
                      <td>{customer.gst_number || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {renderPagination(customerPage, setCustomerPage, customers.length)}

          </section>
        ) : activeModule === "Products" ? (
          <section className="module-placeholder glass-panel">
            <div className="page-banner">
              <div>
                <p className="eyebrow">Catalogue</p>
                <h2>Product Catalogue</h2>
                <p>Upload structured products for smarter order matching, inventory rules, and cleaner quotations.</p>
              </div>
              <div className="banner-stat">
                <span>Total Products</span>
                <strong>{products.length}</strong>
              </div>
            </div>
            <div className="section-head">
              <h3>Product Catalogue</h3>
              <div className="toolbar-controls">
                <span>{products.length} total</span>
                <button type="button" className="ghost-btn" onClick={handleDownloadProductTemplate}>Download Template</button>
                <label className="ghost-btn file-trigger">
                  Upload Product
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelProductUpload} />
                </label>
                <button type="button" className="action-btn" onClick={() => setShowSingleProductModal(true)}>Add Single Product</button>
                <button type="button" className="ghost-btn" onClick={() => setShowProductUploadModal(true)}>Bulk Paste</button>
              </div>
            </div>
            {!isPlatformAdmin && (
              <div className="notice info">
                Product form and template are using the seller&apos;s published catalogue configuration.
              </div>
            )}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sr</th>
                  {visibleCatalogueTableFields.map((field) => (
                    <th key={field.id}>{field.label}</th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={visibleCatalogueTableFields.length + 2} className="muted">No products uploaded yet.</td>
                  </tr>
                ) : (
                  pagedProducts.map((product, index) => (
                    <tr key={product.id}>
                      <td>{(productPage - 1) * PAGE_SIZE + index + 1}</td>
                      {visibleCatalogueTableFields.map((field) => (
                        <td key={`${product.id}-${field.id}`}>{getProductFieldDisplayValue(product, field.normalizedKey || field.key)}</td>
                      ))}
                      <td>
                        <button type="button" className="ghost-btn" onClick={() => handleEditProduct(product)}>Edit</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {renderPagination(productPage, setProductPage, products.length)}

            {showProductUploadModal && (
              <div className="modal-overlay" onClick={() => {
                setShowProductUploadModal(false);
                setProductUploadModalMessage("");
              }}>
                <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
                  <div className="section-head">
                    <h3>Bulk Paste Products</h3>
                    <button type="button" className="ghost-btn" onClick={() => {
                      setShowProductUploadModal(false);
                      setProductUploadModalMessage("");
                    }}>Close</button>
                  </div>
                  {productUploadModalMessage && <div className="notice error">{productUploadModalMessage}</div>}
                  <form className="auth-card" onSubmit={handleBulkProductUpload}>
                    <p>Paste one product per line using this format:</p>
                    <p><code>Product Name | Category | Thickness | Unit Type | Base Price | SKU | Always Available</code></p>
                    <p>Template download now follows the seller&apos;s published catalogue field configuration. Excel upload will validate the mapped runtime fields from that structure.</p>
                    <textarea
                      rows={10}
                      placeholder={"Acrylic | Sheet | 2 mm | SFT | 15 | ACR-2 | true\nName Plate | Signage | - | COUNT | 900 | NP-01 | true"}
                      value={productUploadText}
                      onChange={(e) => setProductUploadText(e.target.value)}
                      required
                    />
                    <button type="submit">Validate Product Upload</button>
                  </form>
                </div>
              </div>
            )}

            {showSingleProductModal && (
              <div className="modal-overlay" onClick={() => setShowSingleProductModal(false)}>
                <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
                  <div className="section-head">
                    <h3>{editingProductId ? "Edit Product" : "Add Single Product"}</h3>
                    <button type="button" className="ghost-btn" onClick={() => {
                      setShowSingleProductModal(false);
                      setEditingProductId(null);
                      setSingleProductForm(createInitialSingleProductForm());
                    }}>Close</button>
                  </div>
                  <form className="auth-card" onSubmit={handleCreateSingleProduct}>
                    {runtimeCatalogueFields.map((field) => {
                      const value = singleProductForm[field.meta.formKey];
                      if (field.type === "checkbox" || field.meta.inputType === "checkbox") {
                        return (
                          <label key={field.id} style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                            <input
                              type="checkbox"
                              checked={Boolean(value)}
                              onChange={(e) => updateSingleProductField(field.meta.formKey, e.target.checked)}
                              style={{ width: "auto" }}
                            />
                            {field.label}
                          </label>
                        );
                      }

                      if (field.type === "dropdown") {
                        return (
                          <select
                            key={field.id}
                            value={value ?? ""}
                            onChange={(e) => updateSingleProductField(field.meta.formKey, e.target.value)}
                            required={Boolean(field.required || field.meta.required)}
                          >
                            <option value="">{field.label}</option>
                            {getConfiguredOptions(field).map((option) => (
                              <option key={`${field.id}-${option}`} value={option}>{option}</option>
                            ))}
                          </select>
                        );
                      }

                      if (field.meta.inputType === "unit-select") {
                        return (
                          <select key={field.id} value={value} onChange={(e) => updateSingleProductField(field.meta.formKey, e.target.value)} required={Boolean(field.required || field.meta.required)}>
                            <option value="COUNT">{field.label}: COUNT</option>
                            <option value="SFT">{field.label}: SFT</option>
                          </select>
                        );
                      }

                      if (field.meta.inputType === "pricing-select") {
                        return (
                          <select key={field.id} value={value} onChange={(e) => updateSingleProductField(field.meta.formKey, e.target.value)} required={Boolean(field.required || field.meta.required)}>
                            <option value="SFT">{field.label}: SFT</option>
                            <option value="UNIT">{field.label}: UNIT</option>
                            <option value="FIXED">{field.label}: FIXED</option>
                          </select>
                        );
                      }

                      return (
                        <input
                          key={field.id}
                          type={field.meta.inputType === "number" ? "number" : "text"}
                          placeholder={field.label}
                          value={value}
                          onChange={(e) => updateSingleProductField(field.meta.formKey, e.target.value)}
                          required={Boolean(field.required || field.meta.required)}
                        />
                      );
                    })}
                    {unsupportedRuntimeCatalogueFields.length > 0 && (
                      <>
                        {unsupportedRuntimeCatalogueFields.map((field) => {
                          const value = singleProductForm.customFields?.[field.key];
                          if (field.type === "checkbox") {
                            return (
                              <label key={field.id} style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                                <input
                                  type="checkbox"
                                  checked={Boolean(value)}
                                  onChange={(e) => updateSingleProductCustomField(field.key, e.target.checked)}
                                  style={{ width: "auto" }}
                                />
                                {field.label}
                              </label>
                            );
                          }

                          if (field.type === "dropdown") {
                            return (
                              <select
                                key={field.id}
                                value={value ?? ""}
                                onChange={(e) => updateSingleProductCustomField(field.key, e.target.value)}
                                required={Boolean(field.required)}
                              >
                                <option value="">{field.label}</option>
                                {getConfiguredOptions(field).map((option) => (
                                  <option key={`${field.id}-${option}`} value={option}>{option}</option>
                                ))}
                              </select>
                            );
                          }

                          return (
                            <input
                              key={field.id}
                              type={field.type === "number" ? "number" : "text"}
                              placeholder={field.label}
                              value={value ?? ""}
                              onChange={(e) => updateSingleProductCustomField(field.key, e.target.value)}
                              required={Boolean(field.required)}
                            />
                          );
                        })}
                        <p className="muted">
                          Additional seller-specific catalogue fields are being stored in product custom data.
                        </p>
                      </>
                    )}
                    {editingProductId && <p className="muted">SKU stays unchanged unless you edit this field yourself.</p>}
                    <button type="submit">{editingProductId ? "Update Product" : "Save Product"}</button>
                  </form>
                </div>
              </div>
            )}

            {showProductPreviewModal && (
              <div className="modal-overlay" onClick={() => {
                setShowProductPreviewModal(false);
                setProductUploadModalMessage("");
              }}>
                <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
                  <div className="section-head">
                    <h3>Validate Product Upload</h3>
                    <button type="button" className="ghost-btn" onClick={() => {
                      setShowProductPreviewModal(false);
                      setProductUploadModalMessage("");
                    }}>Close</button>
                  </div>
                  {productUploadModalMessage && <div className="notice error">{productUploadModalMessage}</div>}
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Row</th>
                        {[...runtimeCatalogueFields, ...unsupportedRuntimeCatalogueFields]
                          .filter((field) => field.uploadEnabled)
                          .map((field) => (
                            <th key={`preview-head-${field.id}`}>{field.label}</th>
                          ))}
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productPreviewRows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td>{row.rowNumber}</td>
                          {[...runtimeCatalogueFields, ...unsupportedRuntimeCatalogueFields]
                            .filter((field) => field.uploadEnabled)
                            .map((field) => (
                              <td key={`${row.rowNumber}-${field.id}`}>{getProductPreviewFieldValue(row, field)}</td>
                            ))}
                          <td>{row.issues.length === 0 ? "Ready" : row.issues.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="toolbar-controls" style={{ marginTop: "14px" }}>
                    <button type="button" className="ghost-btn" onClick={() => {
                      setShowProductPreviewModal(false);
                      setProductUploadModalMessage("");
                    }}>Cancel</button>
                    <button type="button" onClick={handleConfirmProductUpload}>Confirm Upload</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : activeModule === "Settings" ? (
          <section className="module-placeholder glass-panel settings-grid">
            <div className="glass-panel page-banner settings-banner">
              <div>
                <p className="eyebrow">{currentModuleMeta.Settings.eyebrow}</p>
                <h2>{currentModuleMeta.Settings.title}</h2>
                <p>{isPlatformAdmin ? "Onboard sellers, manage lifecycle, and track platform-side controls." : "Shape branding, automation rules, quotation design, and seller setup in one premium admin space."}</p>
              </div>
              <div className="banner-stat">
                <span>{isPlatformAdmin ? "Mode" : "Theme"}</span>
                <strong>{isPlatformAdmin ? "Platform Admin" : (THEME_OPTIONS.find((option) => option.value === theme)?.label || "Custom")}</strong>
              </div>
            </div>
            {!isPlatformAdmin && (
            <>
            <div className="settings-card glass-panel">
              <h3>Branding & Theme</h3>
              <p>Seller-level design configuration for this tenant.</p>
              <form className="auth-card" onSubmit={handleSaveThemeSettings}>
                <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                  {THEME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
                <input
                  type="text"
                  placeholder="Quotation Prefix"
                  value={quotationNumberPrefix}
                  onChange={(e) => setQuotationNumberPrefix(e.target.value.toUpperCase())}
                />
                <input
                  type="text"
                  placeholder="Bank Name"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Bank Branch"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Bank Account Number"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Bank IFSC"
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                />
                <button type="submit">Save Seller Settings</button>
              </form>
            </div>            <div className="settings-card glass-panel">
              <h3>Message Decode Formula</h3>
              <p>Map line position for plain WhatsApp message format.</p>
              <form className="auth-card" onSubmit={handleSaveDecodeRules}>
                <input type="number" min="1" placeholder="Customer line" value={decodeRules.customer_line || 1} onChange={(e) => setDecodeRules((prev) => ({ ...prev, customer_line: e.target.value }))} />
                <input type="number" min="1" placeholder="Mobile line" value={decodeRules.mobile_line || 2} onChange={(e) => setDecodeRules((prev) => ({ ...prev, mobile_line: e.target.value }))} />
                <input type="number" min="1" placeholder="Item line" value={decodeRules.item_line || 3} onChange={(e) => setDecodeRules((prev) => ({ ...prev, item_line: e.target.value }))} />
                <input type="number" min="1" placeholder="Delivery date line" value={decodeRules.delivery_date_line || 4} onChange={(e) => setDecodeRules((prev) => ({ ...prev, delivery_date_line: e.target.value }))} />
                <input type="number" min="1" placeholder="Delivery type line" value={decodeRules.delivery_type_line || 5} onChange={(e) => setDecodeRules((prev) => ({ ...prev, delivery_type_line: e.target.value }))} />
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input type="checkbox" checked={Boolean(decodeRules.enabled)} onChange={(e) => setDecodeRules((prev) => ({ ...prev, enabled: e.target.checked }))} style={{ width: "auto" }} />
                  Enable line-based decode formula
                </label>
                <button type="submit">Save Decode Formula</button>
              </form>
            </div>



            
            <div className="settings-card glass-panel">
              <h3>Quotation Format</h3>
              <p>Configure default quotation format for download/share. Presets give sellers a starting point without hardcoding one layout for every tenant.</p>
              <form className="auth-card" onSubmit={handleSaveQuotationTemplate}>
                <label style={{ display: "grid", gap: "8px", color: "var(--muted)" }}>
                  Template preset
                  <select
                    value={quotationTemplate.template_preset || "commercial_offer"}
                    onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, template_preset: e.target.value }))}
                  >
                    {Object.entries(QUOTATION_TEMPLATE_PRESETS).map(([key, preset]) => (
                      <option key={key} value={key}>{preset.label}</option>
                    ))}
                  </select>
                </label>
                <div className="seller-config-help-card">
                  <strong>{QUOTATION_TEMPLATE_PRESETS[quotationTemplate.template_preset || "commercial_offer"]?.label || "Commercial Offer"}</strong>
                  <p className="muted">{QUOTATION_TEMPLATE_PRESETS[quotationTemplate.template_preset || "commercial_offer"]?.description || ""}</p>
                  <button type="button" className="ghost-btn" onClick={() => applyQuotationTemplatePreset(quotationTemplate.template_preset || "commercial_offer")}>
                    Apply Preset Defaults
                  </button>
                </div>
                <input
                  placeholder="Header text"
                  value={quotationTemplate.header_text || ""}
                  onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, header_text: e.target.value }))}
                />
                <input
                  placeholder="Company mobile number"
                  value={quotationTemplate.company_phone || ""}
                  onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, company_phone: e.target.value }))}
                />
                <input
                  placeholder="Company email"
                  value={quotationTemplate.company_email || ""}
                  onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, company_email: e.target.value }))}
                />
                <textarea
                  rows={3}
                  placeholder="Company address"
                  value={quotationTemplate.company_address || ""}
                  onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, company_address: e.target.value }))}
                />
                <label style={{ display: "grid", gap: "8px", color: "var(--muted)" }}>
                  Header image / logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQuotationHeaderImageChange}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(quotationTemplate.show_header_image)}
                    onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, show_header_image: e.target.checked }))}
                    style={{ width: "auto" }}
                  />
                  Use uploaded image in header
                </label>
                <label style={{ display: "grid", gap: "8px", color: "var(--muted)" }}>
                  Logo only
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQuotationLogoImageChange}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(quotationTemplate.show_logo_only)}
                    onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, show_logo_only: e.target.checked }))}
                    style={{ width: "auto" }}
                  />
                  Use uploaded logo in invoice-style header
                </label>
                {quotationTemplate.header_image_data && (
                  <div className="quotation-image-preview">
                    <img src={quotationTemplate.header_image_data} alt="Quotation header" />
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => setQuotationTemplate((prev) => ({
                        ...prev,
                        header_image_data: null,
                        show_header_image: false
                      }))}
                    >
                      Remove image
                    </button>
                  </div>
                )}
                {quotationTemplate.logo_image_data && (
                  <div className="quotation-image-preview">
                    <img src={quotationTemplate.logo_image_data} alt="Quotation logo" />
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => setQuotationTemplate((prev) => ({
                        ...prev,
                        logo_image_data: null,
                        show_logo_only: false
                      }))}
                    >
                      Remove logo
                    </button>
                  </div>
                )}
                <label style={{ display: "grid", gap: "8px", color: "var(--muted)" }}>
                  Accent color
                  <input
                    type="color"
                    value={quotationTemplate.accent_color || "#2563eb"}
                    onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, accent_color: e.target.value }))}
                  />
                </label>
                <textarea
                  rows={5}
                  placeholder="Body template. Use placeholders like {{quotation_number}}, {{customer_name}}, {{customer_mobile}}, {{total_amount}}"
                  value={quotationTemplate.body_template || ""}
                  onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, body_template: e.target.value }))}
                />
                <input
                  placeholder="Footer text"
                  value={quotationTemplate.footer_text || ""}
                  onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, footer_text: e.target.value }))}
                />
                <textarea
                  rows={3}
                  placeholder="Notes"
                  value={quotationTemplate.notes_text || ""}
                  onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, notes_text: e.target.value }))}
                />
                <textarea
                  rows={3}
                  placeholder="Terms & conditions"
                  value={quotationTemplate.terms_text || ""}
                  onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, terms_text: e.target.value }))}
                />
                {["industrial_invoice", "html_puppeteer"].includes(quotationTemplate.template_preset || "commercial_offer") ? (
                  <div className="quotation-preview-card industrial-invoice-preview">
                    {quotationTemplate.show_header_image && quotationTemplate.header_image_data ? (
                      <div className="industrial-header-image">
                        <img src={quotationTemplate.header_image_data} alt="Header preview" />
                      </div>
                    ) : (
                      <div className="industrial-top">
                        <div>
                          <h4>{quotationTemplate.header_text || "Sai Laser Pvt. Ltd."}</h4>
                          <div className="industrial-band">{quotationTemplate.footer_text || "Manufacturing & Supply of Precision Components"}</div>
                          <div className="industrial-address">
                            {(quotationTemplate.company_address || "Company address").split(/\n+/).map((line, index) => (
                              <span key={`addr-${index}`}>{line}</span>
                            ))}
                          </div>
                        </div>
                        <div className="industrial-contact">
                          {quotationTemplate.show_logo_only && quotationTemplate.logo_image_data && (
                            <div className="preview-image-wrap logo-mode">
                              <img src={quotationTemplate.logo_image_data} alt="Logo preview" />
                            </div>
                          )}
                          <span>Tel : {quotationTemplate.company_phone || "Add company mobile"}</span>
                          <span>Email : {quotationTemplate.company_email || "Email"}</span>
                        </div>
                      </div>
                    )}
                    <div className="industrial-title-row">
                      <span>GSTIN : 24HDE7487RE5RT4</span>
                      <strong>QUOTATION</strong>
                      <span>ORIGINAL FOR CUSTOMER</span>
                    </div>
                    <div className="industrial-info-grid">
                      <div className="industrial-customer-block">
                        <h5>Customer Detail</h5>
                        <div><strong>M/S</strong><span>{quotationPreview.customer_name}</span></div>
                        <div><strong>Address</strong><span>{quotationPreview.delivery_address}</span></div>
                        <div><strong>Phone</strong><span>{quotationPreview.customer_mobile}</span></div>
                        <div><strong>Place of Supply</strong><span>{quotationPreview.delivery_pincode}</span></div>
                      </div>
                      <div className="industrial-meta-block">
                        <div><span>Quotation No.</span><strong>{quotationPreview.quotation_number}</strong></div>
                        <div><span>Date</span><strong>{quotationPreview.delivery_date}</strong></div>
                        <div><span>Version</span><strong>1</strong></div>
                        <div><span>Delivery Type</span><strong>{quotationPreview.delivery_type}</strong></div>
                        <div><span>Customer Mobile</span><strong>{quotationPreview.customer_mobile}</strong></div>
                        <div><span>Pincode</span><strong>{quotationPreview.delivery_pincode}</strong></div>
                      </div>
                    </div>
                    <table className="industrial-preview-table">
                      <thead>
                        <tr>
                          <th>Sr. No.</th>
                          <th>Name of Product / Service</th>
                          <th>Qty</th>
                          <th>Rate</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>1</td>
                          <td>
                            <strong>Acrylic</strong>
                            <span>{renderTemplateText(quotationTemplate.body_template || "Width: 100 × Height: 100", { ...quotationPreview, quotation_number: "Width: 100 × Height: 100" })}</span>
                          </td>
                          <td>2</td>
                          <td>Rs 100</td>
                          <td>Rs 6,944</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="industrial-summary">
                      <div><span>Subtotal</span><strong>Rs 6,944</strong></div>
                      <div><span>Discount</span><strong>- Rs 100</strong></div>
                      <div><span>Advance</span><strong>- Rs 1,000</strong></div>
                      <div className="grand"><span>Balance</span><strong>Rs 5,844</strong></div>
                    </div>
                    <div className="industrial-footer-grid">
                      <div className="industrial-footer-left">
                        <div className="industrial-footer-cell">
                          <h5>Total in words</h5>
                          <p>Rupees Five Thousand Eight Hundred Forty-Four Only</p>
                        </div>
                        <div className="industrial-footer-cell">
                          <h5>Bank Details</h5>
                          <div className="industrial-kv-list">
                            <div><strong>Bank Name</strong><span>{bankName || "State Bank of India"}</span></div>
                            <div><strong>Branch Name</strong><span>{bankBranch || "Main Branch"}</span></div>
                            <div><strong>Bank Account Number</strong><span>{bankAccountNo || "2000000004512"}</span></div>
                            <div><strong>Bank Branch IFSC</strong><span>{bankIfsc || "SBIN0000488"}</span></div>
                          </div>
                        </div>
                        <div className="industrial-footer-cell">
                          <h5>Terms and Conditions</h5>
                          <p>{quotationTemplate.terms_text || "Add terms and conditions here."}</p>
                        </div>
                      </div>
                      <div className="industrial-footer-right">
                        <div className="industrial-footer-cell">
                          <div className="industrial-kv-list summary-mode">
                            <div><strong>Taxable Amount</strong><span>1,154.00</span></div>
                            <div><strong>Add : GST</strong><span>103.86</span></div>
                            <div><strong>Total Tax</strong><span>103.86</span></div>
                            <div className="grand"><strong>Total Amount After Tax</strong><span>Rs 1,258.00</span></div>
                          </div>
                        </div>
                        <div className="industrial-footer-cell">
                          <h5>GST Payable on Reverse Charge</h5>
                          <p className="industrial-right-strong">N.A.</p>
                          <p>Certified that the particulars given above are true and correct.</p>
                          <p className="industrial-right-strong">For {quotationTemplate.header_text || "Sai Laser Pvt. Ltd."}</p>
                        </div>
                        <div className="industrial-footer-cell industrial-signatory">
                          <p>This is computer generated quotation. No signature required.</p>
                          <strong>Authorised Signatory</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`quotation-preview-card preset-${quotationTemplate.template_preset || "commercial_offer"} ${quotationTemplate.show_header_image && quotationTemplate.header_image_data ? "has-header-image" : ""}`}
                    style={{ "--preview-accent": quotationTemplate.accent_color || "#2563eb" }}
                  >
                    <div className={`quotation-preview-hero ${quotationTemplate.show_header_image && quotationTemplate.header_image_data ? "header-image-mode" : ""}`}>
                      {quotationTemplate.show_logo_only && quotationTemplate.logo_image_data ? (
                        <>
                          <div>
                            <div className="preview-image-wrap logo-mode">
                              <img src={quotationTemplate.logo_image_data} alt="Logo preview" />
                            </div>
                            <div className="preview-kicker">{quotationTemplate.header_text || "Commercial Offer"}</div>
                            <h4>{quotationTemplate.header_text || "Commercial Offer"}</h4>
                            <p>{quotationTemplate.footer_text || "We look forward to working with you."}</p>
                          </div>
                          <div className="preview-meta">
                            <strong>{quotationPreview.quotation_number}</strong>
                            <span>Mobile: {quotationTemplate.company_phone || "Add company mobile"}</span>
                            <span>Total: Rs {quotationPreview.total_amount}</span>
                          </div>
                        </>
                      ) : quotationTemplate.show_header_image && quotationTemplate.header_image_data ? (
                        <div className="preview-image-wrap header-mode">
                          <img src={quotationTemplate.header_image_data} alt="Header preview" />
                        </div>
                      ) : (
                        <>
                          <div>
                            <div className="preview-kicker">{quotationTemplate.header_text || "Commercial Offer"}</div>
                            <h4>{quotationTemplate.header_text || "Commercial Offer"}</h4>
                            <p>{quotationTemplate.footer_text || "We look forward to working with you."}</p>
                          </div>
                          <div className="preview-meta">
                            <strong>{quotationPreview.quotation_number}</strong>
                            <span>Mobile: {quotationTemplate.company_phone || "Add company mobile"}</span>
                            <span>Total: Rs {quotationPreview.total_amount}</span>
                          </div>
                        </>
                      )}
                    </div>
                    {quotationTemplate.show_header_image && quotationTemplate.header_image_data && (
                      <div className="preview-meta preview-meta-row">
                        <strong>{quotationPreview.quotation_number}</strong>
                        <span>Mobile: {quotationTemplate.company_phone || "Add company mobile"}</span>
                        <span>Total: Rs {quotationPreview.total_amount}</span>
                      </div>
                    )}
                    <div className="quotation-preview-body">
                      <div className="preview-pane">
                        <h5>Customer</h5>
                        <strong>{quotationPreview.customer_name}</strong>
                        <span>{quotationPreview.customer_mobile}</span>
                        <span>{quotationPreview.delivery_address}</span>
                        <span>{quotationPreview.delivery_pincode}</span>
                      </div>
                      <div className="preview-pane">
                        <h5>Your Contact</h5>
                        <span>{quotationTemplate.company_phone || "Mobile number"}</span>
                        <span>{quotationTemplate.company_email || "Email"}</span>
                        <span>{quotationTemplate.company_address || "Company address"}</span>
                      </div>
                    </div>
                    <p className="preview-copy">
                      {renderTemplateText(quotationTemplate.body_template, quotationPreview)}
                    </p>
                    <div className="preview-grid">
                      <div>
                        <h5>Notes</h5>
                        <p>{quotationTemplate.notes_text || "Add commercial notes here."}</p>
                      </div>
                      <div>
                        <h5>Terms</h5>
                        <p>{quotationTemplate.terms_text || "Add terms and conditions here."}</p>
                      </div>
                    </div>
                  </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(quotationTemplate.email_enabled)}
                    onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, email_enabled: e.target.checked }))}
                    style={{ width: "auto" }}
                  />
                  Enable email sending
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(quotationTemplate.whatsapp_enabled)}
                    onChange={(e) => setQuotationTemplate((prev) => ({ ...prev, whatsapp_enabled: e.target.checked }))}
                    style={{ width: "auto" }}
                  />
                  Enable WhatsApp sending
                </label>
                <button type="submit">Save Quotation Format</button>
              </form>
            </div>
            </>
            )}
            {isPlatformAdmin && (
              <>
                <div className="settings-card glass-panel">
                  <h3>Platform Usage</h3>
                  <div className="kpi-grid kpi-admin">
                    <article className="kpi-card glass-panel"><p>Sellers</p><h3>{usageOverview?.sellersOnboarded || 0}</h3></article>
                    <article className="kpi-card glass-panel"><p>Active Users</p><h3>{usageOverview?.activeUsers || 0}</h3></article>
                    <article className="kpi-card glass-panel"><p>Total Orders</p><h3>{usageOverview?.totalOrders || 0}</h3></article>
                  </div>
                </div>

                <div className="settings-card glass-panel">
                  <h3>Platform Controls</h3>
                  <p>Seller onboarding, plan administration, and lead progression now live in dedicated modules so the platform journey stays clean.</p>
                  <div className="quick-action-grid">
                    <button type="button" className="action-btn quick-action-btn" onClick={() => setActiveModule("Sellers")}>
                      Open Seller Section
                    </button>
                    <button type="button" className="action-btn quick-action-btn" onClick={() => setActiveModule("Subscriptions")}>
                      Open Subscription Section
                    </button>
                    <button type="button" className="action-btn quick-action-btn" onClick={() => setActiveModule("Plans")}>
                      Open Plan Section
                    </button>
                    <button type="button" className="action-btn quick-action-btn" onClick={() => setActiveModule("Leads")}>
                      Open Lead Section
                    </button>
                  </div>
                </div>

                <div className="settings-card glass-panel">
                  <h3>Control Summary</h3>
                  <table className="data-table">
                    <thead><tr><th>Area</th><th>What to manage there</th><th>Status</th></tr></thead>
                    <tbody>
                      <tr>
                        <td><strong>Sellers</strong></td>
                        <td>Create sellers, review lifecycle, open seller detail, and manage subscription actions.</td>
                        <td><span className="badge success">Ready</span></td>
                      </tr>
                      <tr>
                        <td><strong>Subscriptions</strong></td>
                        <td>Review trial windows, active plan state, and open full subscription detail without entering seller profile first.</td>
                        <td><span className="badge success">Ready</span></td>
                      </tr>
                      <tr>
                        <td><strong>Plans</strong></td>
                        <td>Create plans, review feature limits, and update commercial rules in a dedicated modal flow.</td>
                        <td><span className="badge success">Ready</span></td>
                      </tr>
                      <tr>
                        <td><strong>Leads</strong></td>
                        <td>Capture public leads, add activity, and convert qualified prospects into demo accounts.</td>
                        <td><span className="badge success">Ready</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        ) : activeModule !== "Dashboard" ? (
          <section className="module-placeholder glass-panel">
            <h3>{activeModule}</h3>
            <p>This module keeps the same design system and is ready for functional workflows.</p>
          </section>
        ) : isPlatformAdmin ? (
          <main className="dashboard-grid">
            <section className="main-column">
              <div className="dashboard-hero-grid">
                <article className="glass-panel spotlight-card">
                  <div className="spotlight-copy">
                    <p className="eyebrow">Platform billing pulse</p>
                    <h2>{usageOverview?.sellersOnboarded || 0}</h2>
                    <p>Monitor tenant growth, active usage, and billable order volume without entering seller workflows.</p>
                  </div>
                  <div className="spotlight-stack">
                    <div>
                      <span>Active users</span>
                      <strong>{usageOverview?.activeUsers || 0}</strong>
                    </div>
                    <div>
                      <span>Total orders</span>
                      <strong>{usageOverview?.totalOrders || 0}</strong>
                    </div>
                    <div>
                      <span>Sellers onboarded</span>
                      <strong>{usageOverview?.sellersOnboarded || 0}</strong>
                    </div>
                  </div>
                </article>
                <article className="glass-panel quick-actions-panel">
                  <div className="section-head"><h3>Platform Actions</h3><span>Admin control</span></div>
                  <div className="quick-action-grid">
                    <button type="button" className="action-btn quick-action-btn" onClick={() => setActiveModule("Sellers")}>Onboard Seller</button>
                    <button type="button" className="action-btn quick-action-btn" onClick={() => setActiveModule("Subscriptions")}>Manage Subscriptions</button>
                    <button type="button" className="action-btn quick-action-btn" onClick={() => setActiveModule("Plans")}>Manage Plans</button>
                    <button type="button" className="action-btn quick-action-btn" onClick={() => setActiveModule("Users")}>Manage Users</button>
                  </div>
                </article>
              </div>

              <div className="kpi-grid">
                <article className="kpi-card glass-panel"><p>Sellers</p><h3>{usageOverview?.sellersOnboarded || 0}</h3></article>
                <article className="kpi-card glass-panel"><p>Active Users</p><h3>{usageOverview?.activeUsers || 0}</h3></article>
                <article className="kpi-card glass-panel"><p>Total Orders</p><h3>{usageOverview?.totalOrders || 0}</h3></article>
                <article className="kpi-card glass-panel"><p>Billing Scope</p><h3>{formatCurrency(quotations.reduce((sum, row) => sum + Number(row.total_amount || 0), 0))}</h3></article>
              </div>

              <section className="glass-panel table-card">
                <div className="section-head"><h3>Seller Accounts</h3><span>{sellers.length} sellers</span></div>
                <table className="data-table">
                  <thead>
                    <tr><th>Seller</th><th>Subscription</th><th>Status</th><th>Users</th><th>Orders</th><th>Revenue</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {sellers.map((sellerRow) => (
                      <tr key={sellerRow.id}>
                        <td>
                          <strong>{sellerRow.name}</strong>
                          <div className="seller-meta-stack">
                            <span>{sellerRow.seller_code}</span>
                            <span>{sellerRow.email || sellerRow.mobile || "-"}</span>
                          </div>
                        </td>
                        <td>
                          <div className="seller-meta-stack">
                            <span>{sellerRow.plan_name || sellerRow.subscription_plan || "-"}</span>
                            <span>{sellerRow.subscription_status || "-"}</span>
                            <span>{sellerRow.trial_end_at ? `Trial Ends ${formatDateIST(sellerRow.trial_end_at)}` : ""}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${sellerRow.is_locked ? "pending" : "success"}`}>
                            {sellerRow.is_locked ? "Locked" : (sellerRow.status || "active")}
                          </span>
                        </td>
                        <td>{sellerRow.user_count}</td>
                        <td>{sellerRow.order_count}</td>
                        <td>{formatCurrency(sellerRow.total_revenue)}</td>
                        <td>
                          <button type="button" className="ghost-btn compact-btn" onClick={() => openSellerDetail(sellerRow)}>View Detail</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </section>
          </main>
        ) : (
          <main className="dashboard-grid">
            <section className="main-column">
              <div className="dashboard-hero-grid">
                <article className="glass-panel spotlight-card">
                  <div className="spotlight-copy">
                    <p className="eyebrow">Today at a glance</p>
                    <h2>{formatCurrency(dashboardData?.totals?.total_sales)}</h2>
                    <p>Live order intake, quotation movement, and pending collection in one place for the seller team.</p>
                  </div>
                  <div className="spotlight-stack">
                    <div>
                      <span>Orders saved</span>
                      <strong>{dashboardData?.totals?.invoices_generated || 0}</strong>
                    </div>
                    <div>
                      <span>Pending overall</span>
                      <strong>{formatCurrency(dashboardData?.pendingOverall)}</strong>
                    </div>
                    <div>
                      <span>Walk-in sales</span>
                      <strong>{formatCurrency(dashboardData?.totals?.walk_in_sales)}</strong>
                    </div>
                  </div>
                </article>
                <article className="glass-panel quick-actions-panel">
                  <div className="section-head"><h3>Quick Actions</h3><span>Fast operations</span></div>
                  <div className="quick-action-grid">
                    {QUICK_ACTIONS.map((action) => (
                      <button
                        key={action}
                        type="button"
                        className="action-btn quick-action-btn"
                        onClick={() => {
                          if (action === "Create Order") openQuotationWizard();
                          if (action === "Add Customer") setShowCustomerModal(true);
                        }}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </article>
              </div>

              <div className="toolbar-row">
                <div>
                  <h2>Business Pulse</h2>
                  <p>Track cash movement, order momentum, and customer follow-up priority in a focused layout.</p>
                </div>
                <div className="toolbar-controls">
                  <select value={dashboardRange} onChange={(e) => setDashboardRange(e.target.value)}>
                    <option value="daily">Today</option>
                    <option value="weekly">Last 7 Days</option>
                    <option value="monthly">This Month</option>
                  </select>
                </div>
              </div>

              <div className="kpi-grid">
                <article className="kpi-card glass-panel"><p>Today's Sales</p><h3>{formatCurrency(dashboardData?.totals?.total_sales)}</h3></article>
                <article className="kpi-card glass-panel"><p>Orders Saved</p><h3>{dashboardData?.totals?.invoices_generated || 0}</h3></article>
                <article className="kpi-card glass-panel"><p>Quotation Value</p><h3>{formatCurrency(dashboardData?.totals?.total_sales)}</h3></article>
                <article className="kpi-card glass-panel"><p>Pending Payments</p><h3>{formatCurrency(dashboardData?.pendingOverall)}</h3></article>
              </div>

              <section className="glass-panel chart-card">
                <div className="section-head"><h3>Sales Analytics</h3><span>Weekly trend</span></div>
                <div className="bar-chart">
                  {chartSeries.map((point) => (
                    <div key={point.label} className="bar-item">
                      <div className="bar-track"><div className="bar-fill" style={{ height: `${point.height}%` }} /></div>
                      <span>{point.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="glass-panel table-card">
                <div className="section-head"><h3>Recent Orders</h3><span>{filteredOrders.length} records</span></div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{isPlatformAdmin ? "Seller" : <button type="button" onClick={() => changeSort("quotation_number")}>Order #</button>}</th>
                      <th><button type="button" onClick={() => changeSort("customer_name")}>Customer</button></th>
                      <th><button type="button" onClick={() => changeSort("total_amount")}>Amount</button></th>
                      <th>Payment</th><th>Order</th><th>Quote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.slice(0, 8).map((order) => (
                      <tr key={order.id}>
                        <td>
                          {isPlatformAdmin
                            ? (order.seller_name || seller?.name || "Seller")
                            : <button type="button" className="link-btn" onClick={() => handleOpenOrderDetails(order.id)}>{formatQuotationLabel(order)}</button>}
                        </td>
                        <td>{order.firm_name || order.customer_name}</td>
                        <td>{formatCurrency(order.total_amount)}</td>
                        <td><span className={`badge ${order.payment_status === "paid" ? "success" : "pending"}`}>{statusLabel(order.payment_status)}</span></td>
                        <td><span className="badge pending">{orderStatusLabel(order.order_status)}</span></td>
                        <td><span className={`badge ${order.quotation_sent ? "success" : "pending"}`}>{order.quotation_sent ? "Sent" : "Not Sent"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="dashboard-bottom-grid">
                <section className="glass-panel">
                  <div className="section-head"><h3>Low Stock Alerts</h3><span>{lowStockItems.length} items</span></div>
                  {lowStockItems.length === 0 ? (
                    <p className="muted">No critical low stock right now.</p>
                  ) : (
                    lowStockItems.map((item) => (
                      <div key={item.id} className="stock-item">
                        <p>{item.name}</p>
                        <div className="progress-wrap"><div className="progress-bar" style={{ width: `${Math.max(8, item.stock * 3)}%` }} /></div>
                        <small>{item.stock} units left</small>
                      </div>
                    ))
                  )}
                </section>

                <section className="glass-panel">
                  <div className="section-head"><h3>Top Selling</h3><span>By category</span></div>
                  {topSelling.map((item) => (
                    <div className="top-item" key={item.category}><span>{item.category}</span><strong>{formatCurrency(item.total)}</strong></div>
                  ))}
                </section>

                <section className="glass-panel ai-panel">
                  <div className="section-head"><h3>AI Suggestions</h3><span>Smart assistant</span></div>
                  {aiSuggestions.map((tip, idx) => <div className="ai-tip" key={idx}>{tip}</div>)}
                </section>
              </section>
            </section>
          </main>
        )}

        {showMessageSimulatorModal && (
          <div className="modal-overlay" onClick={closeQuotationWizard}>
            <div className="modal-card modal-wide glass-panel quotation-wizard-modal" onClick={(event) => event.stopPropagation()}>
              <div className="section-head">
                <div>
                  <h3>Create Order</h3>
                  <span className="muted">Build a quotation without leaving the seller dashboard.</span>
                </div>
                <button type="button" className="ghost-btn" onClick={closeQuotationWizard}>Close</button>
              </div>
              <div className="quotation-wizard-steps">
                {["customer", "items", "amounts", "preview"].map((step) => (
                  <div key={step} className={`quotation-wizard-step ${quotationWizard.step === step ? "active" : ""}`}>
                    {step === "customer" ? "Customer" : step === "items" ? "Add Items" : step === "amounts" ? "Discount & Advance" : "Quotation Preview"}
                  </div>
                ))}
              </div>

              {error && <div className="notice error">{error}</div>}

              {quotationWizard.step === "customer" && (
                <div className="quotation-wizard-body">
                  <div className="quotation-wizard-mode-row">
                    <button
                      type="button"
                      className={`ghost-btn ${quotationWizard.customerMode === "existing" ? "active-chip" : ""}`}
                      onClick={() => setQuotationWizard((prev) => ({ ...prev, customerMode: "existing" }))}
                    >
                      Existing Customer
                    </button>
                    <button
                      type="button"
                      className={`ghost-btn ${quotationWizard.customerMode === "new" ? "active-chip" : ""}`}
                      onClick={() => setQuotationWizard((prev) => ({ ...prev, customerMode: "new", selectedCustomerId: "" }))}
                    >
                      Create New Customer
                    </button>
                  </div>

                  {quotationWizard.customerMode === "existing" ? (
                    <div className="quotation-wizard-section">
                      <input
                        placeholder="Type at least 2 characters to search customer..."
                        value={quotationWizard.customerSearch}
                        onChange={(e) => setQuotationWizard((prev) => ({ ...prev, customerSearch: e.target.value }))}
                      />
                      <div className="quotation-customer-suggest">
                        {quotationWizard.customerSearch.trim().length < 2 ? (
                          <p className="muted">Start typing customer name, firm, or mobile to see suggestions.</p>
                        ) : quotationWizardCustomerMatches.length === 0 ? (
                          <p className="muted">No matching customer found. Switch to create new customer if needed.</p>
                        ) : (
                          quotationWizardCustomerMatches.map((customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              className={`quotation-customer-card ${String(quotationWizard.selectedCustomerId) === String(customer.id) ? "selected" : ""}`}
                              onClick={() => setQuotationWizard((prev) => ({ ...prev, selectedCustomerId: String(customer.id) }))}
                            >
                              <strong>{customer.firm_name || customer.name}</strong>
                              <span>{customer.name || "-"} {customer.mobile ? `• ${customer.mobile}` : ""}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="quotation-wizard-grid two">
                      <input placeholder="Customer name" value={quotationWizard.customer.name} onChange={(e) => updateQuotationWizardCustomerField("name", e.target.value)} />
                      <input placeholder="Firm name" value={quotationWizard.customer.firmName} onChange={(e) => updateQuotationWizardCustomerField("firmName", e.target.value)} />
                      <input placeholder="Mobile" value={quotationWizard.customer.mobile} onChange={(e) => updateQuotationWizardCustomerField("mobile", e.target.value)} />
                      <input placeholder="Email" type="email" value={quotationWizard.customer.email} onChange={(e) => updateQuotationWizardCustomerField("email", e.target.value)} />
                      <textarea className="wizard-full" rows={3} placeholder="Address" value={quotationWizard.customer.address} onChange={(e) => updateQuotationWizardCustomerField("address", e.target.value)} />
                      <input placeholder="GST Number" value={quotationWizard.customer.gstNumber} onChange={(e) => updateQuotationWizardCustomerField("gstNumber", e.target.value)} />
                      <label className="seller-toggle wizard-full">
                        <input type="checkbox" checked={quotationWizard.customer.monthlyBilling} onChange={(e) => updateQuotationWizardCustomerField("monthlyBilling", e.target.checked)} style={{ width: "auto" }} />
                        Monthly Billing
                      </label>
                    </div>
                  )}
                </div>
              )}

              {quotationWizard.step === "items" && (
                <div className="quotation-wizard-body">
                  <div className="quotation-wizard-grid three">
                    {runtimeSellerConfiguration?.modules?.quotationProductSelector !== false && (
                      <select value={quotationWizard.itemForm.productId} onChange={(e) => handleQuotationWizardProductChange(e.target.value)}>
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.material_name} {product.category ? `| ${product.category}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    {runtimeQuotationColumns
                      .filter((column) => column.visibleInForm)
                      .map((column) => {
                        const normalizedKey = column.normalizedKey;
                        const meta = column.meta;

                        if (["width", "height", "unit", "thickness", "color_name", "other_info", "ps"].includes(normalizedKey) && !quotationWizardItemRules.isSheet) {
                          return null;
                        }

                        if (meta.inputType === "checkbox") {
                          return (
                            <label key={column.id} className="seller-toggle wizard-full">
                              <input
                                type="checkbox"
                                checked={Boolean(quotationWizard.itemForm[meta.formKey])}
                                onChange={(e) => updateQuotationWizardItemForm(meta.formKey, e.target.checked)}
                                style={{ width: "auto" }}
                              />
                              {column.label}
                            </label>
                          );
                        }

                        if (meta.inputType === "category-select") {
                          return (
                            <select key={column.id} value={quotationWizard.itemForm.category} onChange={(e) => updateQuotationWizardItemForm("category", e.target.value)}>
                              {sellerCatalogueCategories.map((category) => (
                                <option key={category} value={category}>{category}</option>
                              ))}
                            </select>
                          );
                        }

                        if (meta.inputType === "unit-select") {
                          return (
                            <select key={column.id} value={quotationWizard.itemForm.unit} onChange={(e) => updateQuotationWizardItemForm("unit", e.target.value)}>
                              <option value="ft">ft</option>
                              <option value="in">in</option>
                              <option value="mm">mm</option>
                            </select>
                          );
                        }

                        return (
                          <input
                            key={column.id}
                            className={meta.fullWidth ? "wizard-full" : ""}
                            placeholder={column.label}
                            type={meta.inputType === "number" ? "number" : "text"}
                            min={meta.inputType === "number" ? "0" : undefined}
                            value={quotationWizard.itemForm[meta.formKey]}
                            onChange={(e) => updateQuotationWizardItemForm(meta.formKey, e.target.value)}
                          />
                        );
                      })}
                    {unsupportedRuntimeQuotationColumns
                      .filter((column) => column.visibleInForm && column.type !== "formula")
                      .map((column) => {
                        const boundValue = getProductConfigurationFieldValue(quotationWizardSelectedProduct, column.key);
                        const isBoundToCatalogue = boundValue !== "" && boundValue !== null && boundValue !== undefined;
                        const value = isBoundToCatalogue ? boundValue : quotationWizard.itemForm.customFields?.[column.key];
                        if (column.type === "checkbox") {
                          return (
                            <label key={column.id} className="seller-toggle wizard-full">
                              <input
                                type="checkbox"
                                checked={Boolean(value)}
                                onChange={(e) => updateQuotationWizardCustomField(column.key, e.target.checked)}
                                style={{ width: "auto" }}
                                disabled={isBoundToCatalogue}
                              />
                              {column.label}
                            </label>
                          );
                        }

                        if (column.type === "dropdown") {
                          const dropdownOptions = isBoundToCatalogue ? [String(boundValue)] : (column.options || []);
                          return (
                            <select
                              key={column.id}
                              className="wizard-full"
                              value={value ?? ""}
                              onChange={(e) => updateQuotationWizardCustomField(column.key, e.target.value)}
                              disabled={isBoundToCatalogue}
                            >
                              <option value="">Select {column.label}</option>
                              {dropdownOptions.map((option) => (
                                <option key={`${column.id}-${option}`} value={option}>{option}</option>
                              ))}
                            </select>
                          );
                        }

                        return (
                          <input
                            key={column.id}
                            className="wizard-full"
                            type={column.type === "number" ? "number" : "text"}
                            min={column.type === "number" ? "0" : undefined}
                            placeholder={column.label}
                            value={value ?? ""}
                            onChange={(e) => updateQuotationWizardCustomField(column.key, e.target.value)}
                            disabled={isBoundToCatalogue}
                          />
                        );
                      })}
                  </div>

                  <div className="quotation-wizard-inline-actions">
                    <button type="button" onClick={handleAddQuotationWizardItem} disabled={!quotationWizardItemReady}>Add Item</button>
                    <span className="muted">Current item total: {formatCurrency(calculateQuotationWizardItemTotal(quotationWizard.itemForm))}</span>
                  </div>

                  <div className="quotation-wizard-items-table">
                    {quotationWizard.items.length === 0 ? (
                      <p className="muted">No items added yet.</p>
                    ) : (
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Category</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Amount</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {quotationWizard.items.map((item) => (
                            <tr key={item.id}>
                              <td>{getQuotationItemTitle(item)}</td>
                              <td>{item.category}</td>
                              <td>{getQuotationItemQuantityValue(item)}</td>
                              <td>{formatCurrency(getQuotationItemRateValue(item))}</td>
                              <td>{formatCurrency(getQuotationItemTotalValue({ ...item, total: calculateQuotationWizardItemTotal(item) }))}</td>
                              <td>
                                <button type="button" className="ghost-btn" onClick={() => handleRemoveQuotationWizardItem(item.id)}>Remove</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {quotationWizard.step === "amounts" && (
                <div className="quotation-wizard-body">
                  <div className="quotation-wizard-grid two">
                    <input placeholder="Discount Amount" type="number" min="0" value={quotationWizard.amounts.discountAmount} onChange={(e) => setQuotationWizard((prev) => ({ ...prev, amounts: { ...prev.amounts, discountAmount: e.target.value } }))} />
                    <input placeholder="Advance Amount" type="number" min="0" value={quotationWizard.amounts.advanceAmount} onChange={(e) => setQuotationWizard((prev) => ({ ...prev, amounts: { ...prev.amounts, advanceAmount: e.target.value } }))} />
                    <label className="wizard-full">
                      <span className="muted">Delivery Date</span>
                      <input type="date" value={quotationWizard.amounts.deliveryDate || ""} onChange={(e) => setQuotationWizard((prev) => ({ ...prev, amounts: { ...prev.amounts, deliveryDate: e.target.value } }))} />
                    </label>
                  </div>
                  <div className="quotation-wizard-summary-grid">
                    <div className="preview-pane">
                      <h5>Summary</h5>
                      <span>Items: {quotationWizard.items.length}</span>
                      <span>Gross Total: {formatCurrency(quotationWizardGrossTotal)}</span>
                      <span>Discount: {formatCurrency(quotationWizardDiscountAmount)}</span>
                      <span>Advance: {formatCurrency(quotationWizardAdvanceAmount)}</span>
                      <span>Delivery Date: {formatDateIST(quotationWizard.amounts.deliveryDate)}</span>
                      <span>Balance: {formatCurrency(quotationWizardBalanceAmount)}</span>
                    </div>
                  </div>
                </div>
              )}

              {quotationWizard.step === "preview" && (
                <div className="quotation-wizard-body quotation-preview-screen">
                  <div className="quotation-preview-header">
                    <div>
                      <h4>{formatQuotationLabel(quotationWizard.submittedQuotation)}</h4>
                      <p className="muted">Quotation created successfully. Full document preview is shown below.</p>
                    </div>
                    <div className="quotation-wizard-inline-actions">
                      <button type="button" className="ghost-btn" onClick={() => quotationWizard.submittedQuotation?.id && handleOpenOrderDetails(quotationWizard.submittedQuotation.id)}>Open Order Details</button>
                      <button type="button" className="ghost-btn" onClick={closeQuotationWizard}>Close</button>
                    </div>
                  </div>
                  {quotationPreviewUrl ? (
                    <iframe title="Quotation Preview" src={quotationPreviewUrl} className="quotation-preview-frame" />
                  ) : (
                    <p className="muted">Loading quotation preview...</p>
                  )}
                </div>
              )}

              {quotationWizard.step !== "preview" && (
                <div className="quotation-wizard-footer">
                  <button type="button" className="ghost-btn" onClick={quotationWizard.step === "customer" ? closeQuotationWizard : handleQuotationWizardBack}>
                    {quotationWizard.step === "customer" ? "Cancel" : "Back"}
                  </button>
                  {quotationWizard.step === "amounts" ? (
                    <button type="button" onClick={handleSubmitQuotationWizard} disabled={quotationWizardSubmitting || !quotationWizard.items.length}>
                      {quotationWizardSubmitting ? "Submitting..." : "Submit Quotation"}
                    </button>
                  ) : (
                    <button type="button" onClick={handleQuotationWizardNext}>
                      Next
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {showCustomerModal && (
          <div className="modal-overlay" onClick={() => setShowCustomerModal(false)}>
            <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
              <div className="section-head">
                <h3>Create Customer</h3>
                <button type="button" className="ghost-btn" onClick={() => setShowCustomerModal(false)}>Close</button>
              </div>
              <form className="auth-card" onSubmit={handleCreateCustomer}>
                <input placeholder="Customer name" value={customerForm.name} onChange={(e) => setCustomerForm((prev) => ({ ...prev, name: e.target.value }))} required />
                <input placeholder="Firm name" value={customerForm.firmName} onChange={(e) => setCustomerForm((prev) => ({ ...prev, firmName: e.target.value }))} />
                <input placeholder="Mobile" value={customerForm.mobile} onChange={(e) => setCustomerForm((prev) => ({ ...prev, mobile: e.target.value }))} />
                <input placeholder="Email" type="email" value={customerForm.email} onChange={(e) => setCustomerForm((prev) => ({ ...prev, email: e.target.value }))} />
                <textarea rows={3} placeholder="Address" value={customerForm.address} onChange={(e) => setCustomerForm((prev) => ({ ...prev, address: e.target.value }))} />
                <input placeholder="GST Number" value={customerForm.gstNumber} onChange={(e) => setCustomerForm((prev) => ({ ...prev, gstNumber: e.target.value }))} />
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input type="checkbox" checked={customerForm.monthlyBilling} onChange={(e) => setCustomerForm((prev) => ({ ...prev, monthlyBilling: e.target.checked }))} style={{ width: "auto" }} />
                  Monthly Billing
                </label>
                <button type="submit">Save Customer</button>
              </form>
            </div>
          </div>
        )}

        {showOrderDetailsModal && selectedOrderDetails && (
          <div className="modal-overlay" onClick={closeOrderDetailsModal}>
            <div className="modal-card modal-wide glass-panel" onClick={(event) => event.stopPropagation()}>
              <div className="section-head">
                <h3>Order Details</h3>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => handleDownloadQuotationSheet(selectedOrderDetails.quotation.id)}
                  >
                    XLSX
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => handleDownloadRichPdfDebug(selectedOrderDetails.quotation.id)}
                  >
                    Rich PDF Debug
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setIsEditingQuotation((prev) => !prev)}
                    disabled={Boolean(selectedVersionRecord && selectedVersionIndex > 0)}
                  >
                    {isEditingQuotation ? "Cancel Edit" : "Edit Quotation"}
                  </button>
                  {isEditingQuotation && (
                    <button type="button" onClick={handleSaveQuotationRevision}>Save New Version</button>
                  )}
                  <button type="button" className="ghost-btn" onClick={closeOrderDetailsModal}>Close</button>
                </div>
              </div>

              {shouldShowVersionSelector && (
                <div className="version-selector-bar">
                  <label>
                    Quotation Version
                    <select
                      value={selectedVersionId || "current"}
                      onChange={(e) => {
                        setSelectedVersionId(e.target.value === "current" ? "" : e.target.value);
                        setIsEditingQuotation(false);
                      }}
                    >
                      {!selectedVersionRecord && (
                        <option value="current">
                          Ver.{selectedOrderDetails?.quotation?.version_no || 1} | Current quotation
                        </option>
                      )}
                      {orderVersions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {getVersionLabel(version)} | {formatDateIST(version.created_at)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {((selectedVersionRecord && selectedVersionIndex > 0) || (!selectedVersionRecord && Number(selectedOrderDetails?.quotation?.version_no || 1) > 1)) && (
                    <span className="version-note">Historical version selected. Edit is available only on the latest version.</span>
                  )}
                </div>
              )}

              <div className="preview-grid">
                <div className="preview-pane">
                  <h5>Order Summary</h5>
                  <span className={quotationFieldChanged("quotation_number") || quotationFieldChanged("version_no") ? "change-highlight" : ""}>Order No: {formatQuotationLabel(displayedQuotation)}</span>
                  <span>Customer: {displayedQuotation?.firm_name || displayedQuotation?.customer_name}</span>
                  <span>Mobile: {displayedQuotation?.mobile || "-"}</span>
                  <span className={quotationFieldChanged("total_amount") ? "change-highlight" : ""}>Total: {formatCurrency(displayedQuotation?.total_amount)}</span>
                  <span className={quotationFieldChanged("payment_status") ? "change-highlight" : ""}>Payment: {statusLabel(displayedQuotation?.payment_status)}</span>
                </div>
                <div className="preview-pane">
                  <h5>Delivery</h5>
                  <span className={quotationFieldChanged("delivery_type") ? "change-highlight" : ""}>Type: {displayedQuotation?.delivery_type || "-"}</span>
                  <span className={quotationFieldChanged("delivery_date") ? "change-highlight" : ""}>Date: {formatDateIST(displayedQuotation?.delivery_date)}</span>
                  <span className={quotationFieldChanged("delivery_address") ? "change-highlight" : ""}>Address: {displayedQuotation?.delivery_address || "-"}</span>
                  <span className={quotationFieldChanged("delivery_pincode") ? "change-highlight" : ""}>Pincode: {displayedQuotation?.delivery_pincode || "-"}</span>
                </div>
              </div>

              <div className="preview-grid" style={{ marginTop: "14px" }}>
                <div className="preview-pane">
                  <h5>Charges</h5>
                  <span className={quotationFieldChanged("subtotal") ? "change-highlight" : ""}>Subtotal: {formatCurrency(displayedQuotation?.subtotal)}</span>
                  <span className={quotationFieldChanged("transport_charges") || quotationFieldChanged("transportation_cost") ? "change-highlight" : ""}>Transport: {formatCurrency(displayedQuotation?.transport_charges || displayedQuotation?.transportation_cost)}</span>
                  <span className={quotationFieldChanged("design_charges") ? "change-highlight" : ""}>Design: {formatCurrency(displayedQuotation?.design_charges)}</span>
                  <span>Outstanding: {formatCurrency(selectedOrderDetails.customerOutstanding)}</span>
                </div>
                <div className="preview-pane">
                  <h5>Version Info</h5>
                  <span>Selected: {selectedVersionRecord ? getVersionLabel(selectedVersionRecord) : `Ver.${displayedQuotation?.version_no || 1}`}</span>
                  <span>Saved At: {selectedVersionRecord ? formatDateIST(selectedVersionRecord.created_at) : "-"}</span>
                  <span>Updated By: {selectedVersionRecord?.actor_name || "System"}</span>
                  <span>{previousVersionRecord ? "Highlighted fields changed from previous version." : "This is the first saved version."}</span>
                </div>
              </div>

              {isEditingQuotation && (
                <div className="preview-grid" style={{ marginTop: "14px" }}>
                  <div className="preview-pane">
                    <h5>Edit Delivery</h5>
                    <input
                      placeholder="Custom quotation number"
                      value={quotationEditForm.customQuotationNumber}
                      onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, customQuotationNumber: e.target.value }))}
                    />
                    <select value={quotationEditForm.deliveryType} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, deliveryType: e.target.value }))}>
                      <option value="PICKUP">Pickup</option>
                      <option value="DOORSTEP">Doorstep</option>
                    </select>
                    <input type="date" value={quotationEditForm.deliveryDate || ""} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, deliveryDate: e.target.value }))} />
                    <input placeholder="Delivery address" value={quotationEditForm.deliveryAddress} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, deliveryAddress: e.target.value }))} />
                    <input placeholder="Delivery pincode" value={quotationEditForm.deliveryPincode} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, deliveryPincode: e.target.value }))} />
                  </div>
                  <div className="preview-pane">
                    <h5>Edit Charges</h5>
                    <input placeholder="Transport charges" type="number" value={quotationEditForm.transportCharges} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, transportCharges: e.target.value }))} />
                    <input placeholder="Design charges" type="number" value={quotationEditForm.designCharges} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, designCharges: e.target.value }))} />
                  </div>
                </div>
              )}

              <table className="data-table" style={{ marginTop: "14px" }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Material Thickness</th>
                    <th>Size</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(isEditingQuotation
                    ? quotationEditForm.items
                    : displayedItems || []).map((item, index) => (
                    <tr key={item.id}>
                      <td className={!isEditingQuotation && (quotationItemFieldChanged(item, index, "material_name") || quotationItemFieldChanged(item, index, "material_type") || quotationItemFieldChanged(item, index, "design_name") || quotationItemFieldChanged(item, index, "sku")) ? "change-highlight-cell" : ""}>
                          {isEditingQuotation ? (
                            <input value={item.materialName || ""} onChange={(e) => handleQuotationItemChange(index, "materialName", e.target.value)} />
                          ) : (
                            <div className="quotation-item-cell">
                              <strong>{getQuotationItemTitle(item) || "-"}</strong>
                              {getQuotationCustomFieldEntries(item.custom_fields).length > 0 && (
                                <div className="quotation-item-meta">
                                  {getQuotationCustomFieldEntries(item.custom_fields).map((entry) => `${entry.label}: ${entry.value}`).join(" | ")}
                                </div>
                              )}
                            </div>
                        )}
                      </td>
                      <td className={!isEditingQuotation && quotationItemFieldChanged(item, index, "thickness") ? "change-highlight-cell" : ""}>
                        {isEditingQuotation ? (
                          <input value={item.thickness || ""} onChange={(e) => handleQuotationItemChange(index, "thickness", e.target.value)} />
                        ) : (
                          item.thickness || "-"
                        )}
                      </td>
                      <td className={!isEditingQuotation && quotationItemFieldChanged(item, index, "size") ? "change-highlight-cell" : ""}>
                          {isEditingQuotation ? (
                            <input value={item.size || ""} onChange={(e) => handleQuotationItemChange(index, "size", e.target.value)} />
                          ) : (
                            getQuotationItemDimensionText(item)
                          )}
                        </td>
                      <td className={!isEditingQuotation && quotationItemFieldChanged(item, index, "quantity") ? "change-highlight-cell" : ""}>
                          {isEditingQuotation ? (
                            <input type="number" value={item.quantity || ""} onChange={(e) => handleQuotationItemChange(index, "quantity", e.target.value)} />
                          ) : (
                            getQuotationItemQuantityValue(item)
                          )}
                        </td>
                      <td className={!isEditingQuotation && (quotationItemFieldChanged(item, index, "unit_price") || quotationItemFieldChanged(item, index, "unitPrice")) ? "change-highlight-cell" : ""}>
                          {isEditingQuotation ? (
                            <input type="number" value={item.unitPrice || ""} onChange={(e) => handleQuotationItemChange(index, "unitPrice", e.target.value)} />
                          ) : (
                            formatCurrency(getQuotationItemRateValue(item))
                          )}
                        </td>
                        <td className={!isEditingQuotation && (quotationItemFieldChanged(item, index, "total_price") || quotationItemFieldChanged(item, index, "totalPrice")) ? "change-highlight-cell" : ""}>
                          {isEditingQuotation
                            ? formatCurrency(Number(item.quantity || 0) * Number(item.unitPrice || 0))
                            : formatCurrency(getQuotationItemTotalValue(item))}
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showSellerDetailModal && (
          <div className="modal-overlay" onClick={closeSellerDetailModal}>
            <div className="modal-card modal-wide glass-panel seller-detail-modal" onClick={(event) => event.stopPropagation()}>
              <div className="section-head">
                <h3>Seller Detail</h3>
                <button type="button" className="ghost-btn" onClick={closeSellerDetailModal}>Close</button>
              </div>

              {sellerDetailLoading && !selectedSellerDetail ? (
                <p className="muted">Loading seller detail...</p>
              ) : selectedSellerDetail ? (
                <>
                  <section className="seller-detail-hero">
                    <div>
                      <p className="eyebrow">Tenant profile</p>
                      <h3>{selectedSellerDetail.seller.name}</h3>
                      <p>{selectedSellerDetail.seller.business_name || "Business name not set"}</p>
                    </div>
                    <div className="seller-detail-badges">
                      <span className={`badge ${selectedSellerDetail.seller.is_locked ? "pending" : "success"}`}>
                        {selectedSellerDetail.seller.is_locked ? "Locked" : (selectedSellerDetail.seller.status || "active")}
                      </span>
                      <span className="badge pending">{selectedSellerDetail.seller.subscription_status || "no subscription"}</span>
                    </div>
                  </section>

                  <div className="seller-detail-grid">
                    <article className="seller-detail-card">
                      <h4>Profile</h4>
                      <div className="seller-detail-list">
                        <div><span>Seller code</span><strong>{selectedSellerDetail.seller.seller_code}</strong></div>
                        <div><span>Business name</span><strong>{selectedSellerDetail.seller.business_name || "-"}</strong></div>
                        <div><span>Mobile</span><strong>{selectedSellerDetail.seller.mobile || "-"}</strong></div>
                        <div><span>Email</span><strong>{selectedSellerDetail.seller.email || "-"}</strong></div>
                        <div><span>City / State</span><strong>{[selectedSellerDetail.seller.city, selectedSellerDetail.seller.state].filter(Boolean).join(", ") || "-"}</strong></div>
                        <div><span>GST</span><strong>{selectedSellerDetail.seller.gst_number || "-"}</strong></div>
                      </div>
                    </article>

                    <article className="seller-detail-card">
                      <h4>Lifecycle Controls</h4>
                      <div className="seller-lifecycle-grid">
                        <label>
                          <span>Seller Status</span>
                          <select
                            value={getSellerLifecycleDraft(selectedSellerDetail.seller).status}
                            onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "status", e.target.value)}
                          >
                            {SELLER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Subscription Plan</span>
                          <select
                            value={getSellerLifecycleDraft(selectedSellerDetail.seller).subscriptionPlan}
                            onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "subscriptionPlan", e.target.value)}
                          >
                            <option value="">Select Plan</option>
                            {plans.map((plan) => <option key={plan.id} value={plan.plan_code}>{plan.plan_name} ({plan.plan_code})</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Subscription Status</span>
                          <select
                            value={getSellerLifecycleDraft(selectedSellerDetail.seller).subscriptionStatus}
                            onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "subscriptionStatus", e.target.value)}
                          >
                            {SUBSCRIPTION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <label>
                          <span>Trial End</span>
                          <input
                            type="date"
                            value={getSellerLifecycleDraft(selectedSellerDetail.seller).trialEndsAt}
                            onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "trialEndsAt", e.target.value)}
                          />
                        </label>
                        <label>
                          <span>Max Users</span>
                          <input
                            type="number"
                            min="0"
                            value={getSellerLifecycleDraft(selectedSellerDetail.seller).maxUsers}
                            onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "maxUsers", e.target.value)}
                          />
                        </label>
                        <label>
                          <span>Max Orders / Month</span>
                          <input
                            type="number"
                            min="0"
                            value={getSellerLifecycleDraft(selectedSellerDetail.seller).maxOrdersPerMonth}
                            onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "maxOrdersPerMonth", e.target.value)}
                          />
                        </label>
                        <label>
                          <span>Onboarding</span>
                          <select
                            value={getSellerLifecycleDraft(selectedSellerDetail.seller).onboardingStatus}
                            onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "onboardingStatus", e.target.value)}
                          >
                            <option value="active">Active</option>
                            <option value="pending">Pending</option>
                            <option value="setup">Setup</option>
                            <option value="complete">Complete</option>
                          </select>
                        </label>
                        <label className="seller-toggle seller-toggle-inline">
                          <input
                            type="checkbox"
                            checked={Boolean(getSellerLifecycleDraft(selectedSellerDetail.seller).isLocked)}
                            onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "isLocked", e.target.checked)}
                            style={{ width: "auto" }}
                          />
                          Locked
                        </label>
                      </div>
                    </article>

                    <article className="seller-detail-card">
                      <h4>Usage Snapshot</h4>
                      <div className="seller-detail-list">
                        <div><span>Users</span><strong>{selectedSellerDetail.usage?.userCount || 0}</strong></div>
                        <div><span>Customers</span><strong>{selectedSellerDetail.usage?.customerCount || 0}</strong></div>
                        <div><span>Quotations</span><strong>{selectedSellerDetail.usage?.quotationCount || 0}</strong></div>
                        <div><span>Revenue</span><strong>{formatCurrency(selectedSellerDetail.usage?.totalRevenue || 0)}</strong></div>
                        <div><span>Last login</span><strong>{formatDateTime(selectedSellerDetail.usage?.lastLoginAt)}</strong></div>
                        <div><span>Onboarding</span><strong>{selectedSellerDetail.seller.onboarding_status || "-"}</strong></div>
                      </div>
                    </article>
                  </div>

                  <section className="seller-detail-section">
                    <div className="section-head compact">
                      <h3>Seller Users</h3>
                      <span>{selectedSellerDetail.users?.length || 0} user(s)</span>
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr><th>Name</th><th>Mobile</th><th>Status</th><th>Created</th></tr>
                      </thead>
                      <tbody>
                        {(selectedSellerDetail.users || []).length === 0 ? (
                          <tr><td colSpan="4">No seller users created yet.</td></tr>
                        ) : (
                          (selectedSellerDetail.users || []).map((user) => (
                            <tr key={user.id}>
                              <td>{user.name}</td>
                              <td>{user.mobile || "-"}</td>
                              <td>{user.locked ? "Locked" : (user.status ? "Active" : "Inactive")}</td>
                              <td>{formatDateTime(user.created_at)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </section>

                  <section className="seller-detail-section">
                    <div className="section-head compact">
                      <h3>Activity History</h3>
                      <span>{selectedSellerDetail.auditLogs?.length || 0} entries</span>
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr><th>When</th><th>Action</th><th>Actor</th><th>Details</th></tr>
                      </thead>
                      <tbody>
                        {(selectedSellerDetail.auditLogs || []).length === 0 ? (
                          <tr><td colSpan="4">No platform activity recorded yet.</td></tr>
                        ) : (
                          (selectedSellerDetail.auditLogs || []).map((entry) => (
                            <tr key={entry.id}>
                              <td>{formatDateTime(entry.created_at)}</td>
                              <td>{formatAuditActionLabel(entry.action_key)}</td>
                              <td>{entry.actor_name || entry.actor_mobile || "System"}</td>
                              <td><pre className="audit-detail">{JSON.stringify(entry.detail || {}, null, 2)}</pre></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </section>

                  <div className="modal-fixed-actions">
                    <button type="button" className="ghost-btn" onClick={closeSellerDetailModal}>Close</button>
                    <button type="button" className="ghost-btn" onClick={() => openSellerConfigurationStudio(selectedSellerDetail.seller)}>Open Config Studio</button>
                    <button type="button" className="ghost-btn" onClick={() => openSubscriptionDetail(selectedSellerDetail.seller)}>Open Subscription</button>
                    <button type="button" onClick={handleSellerDetailSave}>Save Seller</button>
                  </div>
                </>
              ) : (
                <p className="muted">Seller detail is unavailable right now.</p>
              )}
            </div>
          </div>
        )}

        {activeModule === "Configuration Studio" && isPlatformAdmin && !configurationStudioSeller && (
          <section className="module-placeholder glass-panel">
            <div className="page-banner">
              <div>
                <p className="eyebrow">{currentModuleMeta["Configuration Studio"].eyebrow}</p>
                <h2>{currentModuleMeta["Configuration Studio"].title}</h2>
                <p>Select a seller to open and edit their configuration in a full workspace view.</p>
              </div>
              <div className="banner-stat">
                <span>Available Sellers</span>
                <strong>{sellers.length}</strong>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr><th>Seller</th><th>Code</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {sellers.length === 0 ? (
                  <tr><td colSpan="4">No sellers available.</td></tr>
                ) : (
                  sellers.map((sellerRow) => (
                    <tr key={sellerRow.id}>
                      <td>{sellerRow.name}</td>
                      <td>{sellerRow.seller_code}</td>
                      <td>{sellerRow.status || "-"}</td>
                      <td><button type="button" className="ghost-btn" onClick={() => openSellerConfigurationStudio(sellerRow)}>Open Studio</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        )}

        {activeModule === "Configuration Studio" && configurationStudioSeller && !activeSellerConfiguration && (
          <section className="module-placeholder glass-panel">
            <div className="page-banner">
              <div>
                <p className="eyebrow">{currentModuleMeta["Configuration Studio"].eyebrow}</p>
                <h2>{currentModuleMeta["Configuration Studio"].title}</h2>
                <p>We could not load the seller configuration yet. Please retry once.</p>
              </div>
              <div className="banner-stat">
                <span>Editing Seller</span>
                <strong>{configurationStudioSeller.name}</strong>
              </div>
            </div>
            <div className="seller-config-body">
              <p className="muted">{sellerConfigLoading ? "Loading seller configuration..." : "Configuration data is not available right now."}</p>
            </div>
            <div className="modal-fixed-actions">
              <button type="button" className="ghost-btn" onClick={closeSellerConfigurationStudio}>
                {isPlatformAdmin ? "Back to Sellers" : "Back to Dashboard"}
              </button>
              <button type="button" onClick={() => openSellerConfigurationStudio(configurationStudioSeller)}>
                Retry
              </button>
            </div>
          </section>
        )}

        {activeModule === "Configuration Studio" && configurationStudioSeller && activeSellerConfiguration && (
          <section className="module-placeholder glass-panel seller-config-workspace">
              <div className="page-banner">
                <div>
                  <p className="eyebrow">{currentModuleMeta["Configuration Studio"].eyebrow}</p>
                  <h2>{currentModuleMeta["Configuration Studio"].title}</h2>
                  <p>{isPlatformAdmin ? "Platform admin can manage any seller configuration here. Sellers can maintain only their own configuration." : "Configure your own product schema, quotation columns, preview, and publish flow from this workspace."}</p>
                </div>
                <div className="banner-stat">
                  <span>Editing Seller</span>
                  <strong>{configurationStudioSeller.name}</strong>
                </div>
              </div>

              <div className="section-head">
                <div>
                  <h3>Seller Configuration Studio</h3>
                  <span>{configurationStudioSeller.name} • {activeSellerConfiguration.profileName}</span>
                </div>
                <button type="button" className="ghost-btn" onClick={closeSellerConfigurationStudio}>{isPlatformAdmin ? "Back to Sellers" : "Back to Dashboard"}</button>
              </div>

              {sellerConfigLoading ? (
                <div className="seller-config-body">
                  <p className="muted">Loading seller configuration...</p>
                </div>
              ) : (
                <>
              <div className="seller-config-tabs">
                {[
                  { key: "dashboard", label: "Dashboard" },
                  { key: "catalogue", label: "Catalogue Fields" },
                  { key: "quotation", label: "Quotation Columns" },
                  { key: "preview", label: "Preview" },
                  { key: "guide", label: "Guide" }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`ghost-btn ${sellerConfigTab === tab.key ? "active-chip" : ""}`}
                    onClick={() => setSellerConfigTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {sellerConfigTab === "dashboard" && (
                <div className="seller-config-body">
                  <div className="seller-config-summary-grid">
                    <article className="seller-detail-card">
                      <h4>Configuration Overview</h4>
                      <div className="seller-detail-list">
                        <div><span>Profile</span><strong>{activeSellerConfiguration.profileName}</strong></div>
                        <div><span>Status</span><strong>{activeSellerConfiguration.status}</strong></div>
                        <div><span>Catalogue Fields</span><strong>{activeSellerConfiguration.catalogueFields.length}</strong></div>
                        <div><span>Quotation Columns</span><strong>{activeSellerConfiguration.quotationColumns.length}</strong></div>
                        <div><span>Saved Versions</span><strong>{activeSellerConfiguration.versions?.length || 0}</strong></div>
                      </div>
                    </article>
                    <article className="seller-detail-card">
                      <h4>Enabled Modules</h4>
                      <div className="seller-config-chip-grid">
                        {Object.entries(activeSellerConfiguration.modules).map(([key, enabled]) => (
                          <span key={key} className={`badge ${enabled ? "success" : "pending"}`}>
                            {key} {enabled ? "on" : "off"}
                          </span>
                        ))}
                      </div>
                    </article>
                    <article className="seller-detail-card">
                      <h4>Quotation Behavior</h4>
                      <label className="seller-toggle" style={{ marginTop: "8px" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(activeSellerConfiguration.modules?.quotationProductSelector)}
                          onChange={(e) => updateSellerConfigurationModule("quotationProductSelector", e.target.checked)}
                        />
                        <span>Show product selector in Create Order</span>
                      </label>
                      <p className="muted" style={{ marginTop: "12px" }}>
                        Turn this off if the seller should create quotation items only from configured quotation fields and not from the product catalogue dropdown.
                      </p>
                      <label className="seller-toggle" style={{ marginTop: "16px" }}>
                        <input
                          type="checkbox"
                          checked={Boolean(activeSellerConfiguration.modules?.combineHelpingTextInItemColumn)}
                          onChange={(e) => updateSellerConfigurationModule("combineHelpingTextInItemColumn", e.target.checked)}
                        />
                        <span>Combine helping text into item title column</span>
                      </label>
                      <p className="muted" style={{ marginTop: "12px" }}>
                        Turn this on if supporting fields like colour or thickness should merge into the item title text instead of staying separate below the item name.
                      </p>
                    </article>
                    <article className="seller-detail-card">
                      <h4>Persistence Status</h4>
                      <p className="muted">This configuration now saves per seller in the backend. Use Save Draft while tuning the schema, then Publish when the seller setup is ready to go live.</p>
                      {activeSellerConfiguration.updatedAt && (
                        <p className="muted">Last saved: {formatDateTime(activeSellerConfiguration.updatedAt)}</p>
                      )}
                    </article>
                  </div>
                </div>
              )}

              {sellerConfigTab === "catalogue" && (
                <div className="seller-config-body">
                  <div className="section-head compact">
                    <h3>Catalogue Fields Configuration</h3>
                    <button type="button" onClick={addCatalogueField}>Add Field</button>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr><th>Seq</th><th>Label</th><th>Key</th><th>Type</th><th>Options</th><th>Required</th><th>List</th><th>Upload</th><th /></tr>
                    </thead>
                    <tbody>
                      {sortConfigEntries(activeSellerConfiguration.catalogueFields).map((field) => (
                        <tr key={field.id}>
                          <td><input type="number" min="1" value={field.displayOrder ?? ""} onChange={(e) => updateCatalogueField(field.id, "displayOrder", Number(e.target.value || 0))} /></td>
                          <td><input value={field.label} onChange={(e) => updateCatalogueField(field.id, "label", e.target.value)} /></td>
                          <td><input value={field.key} onChange={(e) => updateCatalogueField(field.id, "key", e.target.value)} /></td>
                          <td>
                            <select value={field.type} onChange={(e) => updateCatalogueField(field.id, "type", e.target.value)}>
                              <option value="text">text</option>
                              <option value="number">number</option>
                              <option value="dropdown">dropdown</option>
                              <option value="checkbox">checkbox</option>
                            </select>
                          </td>
                          <td>
                            <input
                              value={getOptionsInputValue(field)}
                              onChange={(e) => updateCatalogueField(field.id, "optionsText", e.target.value)}
                              onBlur={(e) => commitCatalogueFieldOptions(field.id, e.target.value)}
                              placeholder={field.type === "dropdown" ? "Option 1, Option 2 or Option 1 | Option 2" : "Not used"}
                              disabled={field.type !== "dropdown"}
                            />
                          </td>
                          <td><input type="checkbox" checked={Boolean(field.required)} onChange={(e) => updateCatalogueField(field.id, "required", e.target.checked)} style={{ width: "auto" }} /></td>
                          <td><input type="checkbox" checked={Boolean(field.visibleInList)} onChange={(e) => updateCatalogueField(field.id, "visibleInList", e.target.checked)} style={{ width: "auto" }} /></td>
                          <td><input type="checkbox" checked={Boolean(field.uploadEnabled)} onChange={(e) => updateCatalogueField(field.id, "uploadEnabled", e.target.checked)} style={{ width: "auto" }} /></td>
                          <td>
                            {MANDATORY_SYSTEM_CATALOGUE_KEYS.includes(normalizeConfigKey(field.key)) ? (
                              <span className="badge pending">System Field</span>
                            ) : (
                              <button type="button" className="ghost-btn" onClick={() => removeCatalogueField(field.id)}>Remove</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sellerConfigTab === "quotation" && (
                <div className="seller-config-body">
                  <div className="section-head compact">
                    <h3>Quotation Columns Configuration</h3>
                    <button type="button" onClick={addQuotationColumn}>Add Column</button>
                  </div>
                  <div className="seller-config-help-card">
                    <h4>Formula Help</h4>
                    <p className="muted">Use `formula` type when the seller should not enter the value manually. The system will calculate it at quotation save time and store it with the item.</p>
                    <div className="seller-config-help-grid">
                      <div>
                        <strong>Supported variables</strong>
                        <div className="seller-config-option-chips">
                          {["width", "height", "quantity", "rate", "unit_price", "amount", "total_price"].map((token) => (
                            <span key={token} className="badge pending">{token}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <strong>Example formulas</strong>
                        <div className="seller-config-option-chips">
                          <span className="badge success">width * height * quantity * rate</span>
                          <span className="badge success">quantity * rate</span>
                          <span className="badge success">amount * 0.18</span>
                        </div>
                      </div>
                    </div>
                    <p className="muted">Dropdown columns use the `Options` field. Enter values separated by commas, for example `Matte, Glossy, Frosted`.</p>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr><th>Seq</th><th>Label</th><th>Key</th><th>Type</th><th>Options</th><th>Definition</th><th>Formula</th><th>Required</th><th>Form</th><th>PDF</th><th>Helping</th><th>Calc</th><th /></tr>
                    </thead>
                    <tbody>
                      {sortConfigEntries(activeSellerConfiguration.quotationColumns).map((column) => (
                        <tr key={column.id}>
                          <td><input type="number" min="1" value={column.displayOrder ?? ""} onChange={(e) => updateQuotationColumn(column.id, "displayOrder", Number(e.target.value || 0))} /></td>
                          <td><input value={column.label} onChange={(e) => updateQuotationColumn(column.id, "label", e.target.value)} /></td>
                          <td><input value={column.key} onChange={(e) => updateQuotationColumn(column.id, "key", e.target.value)} /></td>
                          <td>
                            <select value={column.type} onChange={(e) => updateQuotationColumn(column.id, "type", e.target.value)}>
                              <option value="text">text</option>
                              <option value="number">number</option>
                              <option value="formula">formula</option>
                              <option value="dropdown">dropdown</option>
                            </select>
                          </td>
                          <td>
                            <input
                              value={getOptionsInputValue(column)}
                              onChange={(e) => updateQuotationColumn(column.id, "optionsText", e.target.value)}
                              onBlur={(e) => commitQuotationColumnOptions(column.id, e.target.value)}
                              placeholder={column.type === "dropdown" ? "Option 1, Option 2 or Option 1 | Option 2" : "Not used"}
                              disabled={column.type !== "dropdown"}
                            />
                          </td>
                          <td>
                            <input
                              value={column.definition || ""}
                              onChange={(e) => updateQuotationColumn(column.id, "definition", e.target.value)}
                              placeholder="What this column means"
                            />
                          </td>
                          <td>
                            <input
                              value={column.formulaExpression || ""}
                              onChange={(e) => updateQuotationColumn(column.id, "formulaExpression", e.target.value)}
                              placeholder={column.type === "formula" ? "width * height * quantity * rate" : "Only for formula type"}
                              disabled={column.type !== "formula"}
                            />
                          </td>
                            <td><input type="checkbox" checked={Boolean(column.required)} onChange={(e) => updateQuotationColumn(column.id, "required", e.target.checked)} style={{ width: "auto" }} /></td>
                            <td><input type="checkbox" checked={Boolean(column.visibleInForm)} onChange={(e) => updateQuotationColumn(column.id, "visibleInForm", e.target.checked)} style={{ width: "auto" }} /></td>
                            <td><input type="checkbox" checked={Boolean(column.visibleInPdf)} onChange={(e) => updateQuotationColumn(column.id, "visibleInPdf", e.target.checked)} style={{ width: "auto" }} /></td>
                            <td><input type="checkbox" checked={Boolean(column.helpTextInPdf)} onChange={(e) => updateQuotationColumn(column.id, "helpTextInPdf", e.target.checked)} style={{ width: "auto" }} /></td>
                            <td><input type="checkbox" checked={Boolean(column.includedInCalculation)} onChange={(e) => updateQuotationColumn(column.id, "includedInCalculation", e.target.checked)} style={{ width: "auto" }} /></td>
                            <td><button type="button" className="ghost-btn" onClick={() => removeQuotationColumn(column.id)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {sellerConfigTab === "preview" && (
                <div className="seller-config-body">
                  <div className="seller-config-tabs seller-config-subtabs">
                    {[
                      { key: "product-form", label: "Product Form" },
                      { key: "product-list", label: "Product List" },
                      { key: "quotation-form", label: "Quotation Form" },
                      { key: "quotation-pdf", label: "Quotation PDF" }
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        className={`ghost-btn ${sellerConfigPreviewTab === tab.key ? "active-chip" : ""}`}
                        onClick={() => setSellerConfigPreviewTab(tab.key)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {sellerConfigPreviewTab === "product-form" && (
                    <div className="seller-config-preview-card">
                      <h4>Product Form Preview</h4>
                      <div className="quotation-wizard-grid two">
                        {sortConfigEntries(activeSellerConfiguration.catalogueFields).map((field) => (
                          <label key={field.id}>
                            <span>{field.label || "Untitled field"}</span>
                            {renderConfigurationPreviewControl(field, "product-form")}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {sellerConfigPreviewTab === "product-list" && (
                    <div className="seller-config-preview-card">
                      <h4>Product List Preview</h4>
                      <table className="data-table">
                        <thead>
                          <tr>
                            {sortConfigEntries(activeSellerConfiguration.catalogueFields).filter((field) => field.visibleInList).map((field) => (
                              <th key={field.id}>{field.label || field.key || "Column"}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {sortConfigEntries(activeSellerConfiguration.catalogueFields).filter((field) => field.visibleInList).map((field) => (
                              <td key={field.id}>Sample {field.label || field.key || "value"}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {sellerConfigPreviewTab === "quotation-form" && (
                    <div className="seller-config-preview-card">
                      <h4>Quotation Create Preview</h4>
                      <div className="quotation-wizard-grid two">
                        {sortConfigEntries(activeSellerConfiguration.quotationColumns).filter((column) => column.visibleInForm || column.type === "formula").map((column) => (
                          <label key={column.id}>
                            <span>{column.label || "Untitled column"}</span>
                            {renderConfigurationPreviewControl(column, "quotation-form")}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {sellerConfigPreviewTab === "quotation-pdf" && (
                    <div className="seller-config-preview-card">
                      <h4>Quotation PDF Preview</h4>
                      <div className="seller-config-pdf-preview">
                        <div className="seller-config-pdf-header">
                          <strong>{configurationStudioSeller.name}</strong>
                          <span>Commercial Offer Preview</span>
                        </div>
                        <table className="data-table">
                          <thead>
                            <tr>
                              {sortConfigEntries(activeSellerConfiguration.quotationColumns).filter((column) => column.visibleInPdf).map((column) => (
                                <th key={column.id}>{column.label || column.key || "Column"}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {sortConfigEntries(activeSellerConfiguration.quotationColumns).filter((column) => column.visibleInPdf).map((column) => (
                                <td key={column.id}>Sample</td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                        <div className="seller-config-pdf-footer">
                          <span>Notes, terms, and seller branding will render here.</span>
                          {sortConfigEntries(activeSellerConfiguration.quotationColumns).some((column) => column.type === "formula" && (column.definition || column.formulaExpression)) && (
                            <div className="seller-config-option-chips">
                              {sortConfigEntries(activeSellerConfiguration.quotationColumns)
                                .filter((column) => column.type === "formula" && (column.definition || column.formulaExpression))
                                .map((column) => (
                                  <span key={`${column.id}-pdf-formula`} className="badge success">
                                    {column.label}: {column.formulaExpression || column.definition}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {sellerConfigTab === "guide" && (
                <div className="seller-config-body">
                  <div className="seller-config-guide-grid">
                    <article className="seller-config-preview-card">
                      <h4>How To Configure</h4>
                      <ol className="seller-config-guide-list">
                        <li>Create or edit `Catalogue Fields` for seller-specific product structure.</li>
                        <li>Create or edit `Quotation Columns` for seller-specific item schema.</li>
                        <li>Use `dropdown` type when values should come from a fixed list.</li>
                        <li>Use `formula` type when the value should be computed automatically.</li>
                        <li>Open `Preview` to verify forms, list columns, and PDF layout before publishing.</li>
                        <li>`Save Draft` while iterating, then `Publish` when the seller setup is ready.</li>
                      </ol>
                    </article>

                    <article className="seller-config-preview-card">
                      <h4>Formula Guide</h4>
                      <p className="muted">Formula columns are stored per item and calculated on the backend. Sellers do not type them manually in create quotation flow.</p>
                      <div className="seller-config-guide-examples">
                        <div>
                          <strong>Line Amount</strong>
                          <code>width * height * quantity * rate</code>
                        </div>
                        <div>
                          <strong>Service Total</strong>
                          <code>quantity * rate</code>
                        </div>
                        <div>
                          <strong>Taxable Amount</strong>
                          <code>amount - 100</code>
                        </div>
                        <div>
                          <strong>Width In Feet</strong>
                          <code>width_ft</code>
                        </div>
                        <div>
                          <strong>Area In Square Feet</strong>
                          <code>area_sqft * quantity * rate</code>
                        </div>
                        <div>
                          <strong>Converted Width</strong>
                          <code>width * unit_factor</code>
                        </div>
                      </div>
                      <p className="muted">Allowed tokens today: width, height, quantity, rate, unit_price, amount, total_price, width_ft, height_ft, area_sqft, unit_factor, and numeric custom field keys.</p>
                    </article>

                    <article className="seller-config-preview-card">
                      <h4>Dropdown Guide</h4>
                      <p className="muted">Dropdown columns and fields help standardize seller data entry and reduce messy free text.</p>
                      <div className="seller-config-option-chips">
                        {["Matte", "Glossy", "Frosted", "Indoor", "Outdoor"].map((option) => (
                          <span key={option} className="badge pending">{option}</span>
                        ))}
                      </div>
                      <p className="muted">Enter options as comma-separated values in the `Options` box. Uploaded product rows and seller forms are validated against these values.</p>
                    </article>

                    <article className="seller-config-preview-card">
                      <h4>What Preview Checks</h4>
                      <ul className="seller-config-guide-list">
                        <li>`Product Form`: field order, input type, dropdown choices.</li>
                        <li>`Product List`: list visibility and labels.</li>
                        <li>`Quotation Form`: seller-facing item inputs and computed fields.</li>
                        <li>`Quotation PDF`: visible columns plus formula references.</li>
                      </ul>
                    </article>
                  </div>
                </div>
              )}
                </>
              )}

              <div className="modal-fixed-actions">
                <button type="button" className="ghost-btn" onClick={closeSellerConfigurationStudio}>{isPlatformAdmin ? "Back to Sellers" : "Back to Dashboard"}</button>
                <button type="button" className="ghost-btn" onClick={publishSellerConfiguration} disabled={sellerConfigLoading || sellerConfigSaving || sellerConfigPublishing}>
                  {sellerConfigPublishing ? "Publishing..." : "Publish"}
                </button>
                <button type="button" onClick={saveSellerConfigurationDraft} disabled={sellerConfigLoading || sellerConfigSaving || sellerConfigPublishing}>
                  {sellerConfigSaving ? "Saving..." : "Save Draft"}
                </button>
              </div>
          </section>
        )}

        {showPlanDetailModal && selectedPlanDetail && (
          <div className="modal-overlay" onClick={closePlanDetailModal}>
            <div className="modal-card modal-wide glass-panel seller-detail-modal" onClick={(event) => event.stopPropagation()}>
              <div className="section-head">
                <h3>Plan Detail</h3>
                <button type="button" className="ghost-btn" onClick={closePlanDetailModal}>Close</button>
              </div>

              <section className="seller-detail-hero">
                <div>
                  <p className="eyebrow">Commercial definition</p>
                  <h3>{selectedPlanDetail.plan_name}</h3>
                  <p>{selectedPlanDetail.plan_code}</p>
                </div>
                <div className="seller-detail-badges">
                  <span className={`badge ${selectedPlanDetail.is_active ? "success" : "pending"}`}>
                    {selectedPlanDetail.is_active ? "Active" : "Inactive"}
                  </span>
                  <span className="badge pending">{selectedPlanDetail.is_demo_plan ? "Demo plan" : "Standard plan"}</span>
                </div>
              </section>

              <div className="seller-detail-grid">
                <article className="seller-detail-card">
                  <h4>Commercials</h4>
                  <div className="seller-lifecycle-grid">
                    <label>
                      <span>Plan Code</span>
                      <input value={getPlanDraft(selectedPlanDetail).planCode} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "planCode", e.target.value.toUpperCase())} />
                    </label>
                    <label>
                      <span>Plan Name</span>
                      <input value={getPlanDraft(selectedPlanDetail).planName} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "planName", e.target.value)} />
                    </label>
                    <label>
                      <span>Price</span>
                      <input type="number" min="0" step="0.01" value={getPlanDraft(selectedPlanDetail).price} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "price", e.target.value)} />
                    </label>
                    <label>
                      <span>Billing Cycle</span>
                      <select value={getPlanDraft(selectedPlanDetail).billingCycle} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "billingCycle", e.target.value)}>
                        {BILLING_CYCLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Trial Days</span>
                      <input type="number" min="0" value={getPlanDraft(selectedPlanDetail).trialDurationDays} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "trialDurationDays", e.target.value)} />
                    </label>
                    <label>
                      <span>Watermark Text</span>
                      <input value={getPlanDraft(selectedPlanDetail).watermarkText} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "watermarkText", e.target.value)} />
                    </label>
                  </div>
                </article>

                <article className="seller-detail-card">
                  <h4>Limits</h4>
                  <div className="seller-lifecycle-grid">
                    <label>
                      <span>Max Users</span>
                      <input type="number" min="0" value={getPlanDraft(selectedPlanDetail).maxUsers} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "maxUsers", e.target.value)} />
                    </label>
                    <label>
                      <span>Max Quotations</span>
                      <input type="number" min="0" value={getPlanDraft(selectedPlanDetail).maxQuotations} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "maxQuotations", e.target.value)} />
                    </label>
                    <label>
                      <span>Max Customers</span>
                      <input type="number" min="0" value={getPlanDraft(selectedPlanDetail).maxCustomers} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "maxCustomers", e.target.value)} />
                    </label>
                  </div>
                </article>

                <article className="seller-detail-card">
                  <h4>Feature Access</h4>
                  <div className="seller-lifecycle-grid">
                    <label className="seller-toggle"><input type="checkbox" checked={getPlanDraft(selectedPlanDetail).isActive} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "isActive", e.target.checked)} style={{ width: "auto" }} />Active</label>
                    <label className="seller-toggle"><input type="checkbox" checked={getPlanDraft(selectedPlanDetail).isDemoPlan} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "isDemoPlan", e.target.checked)} style={{ width: "auto" }} />Demo Plan</label>
                    <label className="seller-toggle"><input type="checkbox" checked={getPlanDraft(selectedPlanDetail).trialEnabled} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "trialEnabled", e.target.checked)} style={{ width: "auto" }} />Trial Enabled</label>
                    <label className="seller-toggle"><input type="checkbox" checked={getPlanDraft(selectedPlanDetail).inventoryEnabled} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "inventoryEnabled", e.target.checked)} style={{ width: "auto" }} />Inventory</label>
                    <label className="seller-toggle"><input type="checkbox" checked={getPlanDraft(selectedPlanDetail).reportsEnabled} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "reportsEnabled", e.target.checked)} style={{ width: "auto" }} />Reports</label>
                    <label className="seller-toggle"><input type="checkbox" checked={getPlanDraft(selectedPlanDetail).gstEnabled} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "gstEnabled", e.target.checked)} style={{ width: "auto" }} />GST</label>
                    <label className="seller-toggle"><input type="checkbox" checked={getPlanDraft(selectedPlanDetail).exportsEnabled} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "exportsEnabled", e.target.checked)} style={{ width: "auto" }} />Exports</label>
                    <label className="seller-toggle"><input type="checkbox" checked={getPlanDraft(selectedPlanDetail).quotationWatermarkEnabled} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "quotationWatermarkEnabled", e.target.checked)} style={{ width: "auto" }} />Watermark</label>
                    <label className="seller-toggle"><input type="checkbox" checked={getPlanDraft(selectedPlanDetail).quotationCreationLockedAfterExpiry} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "quotationCreationLockedAfterExpiry", e.target.checked)} style={{ width: "auto" }} />Lock After Expiry</label>
                  </div>
                </article>
              </div>

              <div className="modal-fixed-actions">
                <button type="button" className="ghost-btn" onClick={closePlanDetailModal}>Close</button>
                <button type="button" onClick={handlePlanDetailSave}>Save Plan</button>
              </div>
            </div>
          </div>
        )}

        {showNotificationCreateModal && (
          <div className="modal-overlay" onClick={() => setShowNotificationCreateModal(false)}>
            <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
              <div className="section-head">
                <h3>Create Notification</h3>
                <button type="button" className="ghost-btn" onClick={() => setShowNotificationCreateModal(false)}>Close</button>
              </div>
              <form className="compact-form" onSubmit={handleCreateNotification}>
                <div className="seller-lifecycle-grid">
                  <label>
                    <span>Title</span>
                    <input value={notificationForm.title} onChange={(e) => setNotificationForm((prev) => ({ ...prev, title: e.target.value }))} required />
                  </label>
                  <label>
                    <span>Audience</span>
                    <select value={notificationForm.audienceType} onChange={(e) => setNotificationForm((prev) => ({ ...prev, audienceType: e.target.value }))}>
                      <option value="all_sellers">All Sellers</option>
                      <option value="active_sellers">Active Sellers</option>
                      <option value="trial_users">Trial Users</option>
                      <option value="expiring_trials">Expiring Trials</option>
                      <option value="specific_seller">Specific Seller</option>
                    </select>
                  </label>
                  <label>
                    <span>Channel</span>
                    <select value={notificationForm.channel} onChange={(e) => setNotificationForm((prev) => ({ ...prev, channel: e.target.value }))}>
                      <option value="in_app">In-App</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                    </select>
                  </label>
                  {!notificationForm.sendNow && (
                    <label>
                      <span>Schedule</span>
                      <input type="datetime-local" value={notificationForm.scheduledAt} onChange={(e) => setNotificationForm((prev) => ({ ...prev, scheduledAt: e.target.value }))} />
                    </label>
                  )}
                  {notificationForm.audienceType === "specific_seller" && (
                    <label>
                      <span>Seller</span>
                      <select value={notificationForm.sellerId} onChange={(e) => setNotificationForm((prev) => ({ ...prev, sellerId: e.target.value }))} required>
                        <option value="">Select Seller</option>
                        {sellers.map((sellerRow) => <option key={sellerRow.id} value={sellerRow.id}>{sellerRow.name} ({sellerRow.seller_code})</option>)}
                      </select>
                    </label>
                  )}
                  <label className="seller-toggle seller-toggle-inline">
                    <input type="checkbox" checked={notificationForm.sendNow} onChange={(e) => setNotificationForm((prev) => ({ ...prev, sendNow: e.target.checked }))} style={{ width: "auto" }} />
                    Send now
                  </label>
                </div>
                <label style={{ display: "grid", gap: "6px", color: "var(--muted)" }}>
                  <span>Message</span>
                  <textarea rows={5} value={notificationForm.message} onChange={(e) => setNotificationForm((prev) => ({ ...prev, message: e.target.value }))} required />
                </label>
                <div className="modal-fixed-actions">
                  <button type="button" className="ghost-btn" onClick={() => setShowNotificationCreateModal(false)}>Close</button>
                  <button type="submit">Create Notification</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showNotificationDetailModal && (
          <div className="modal-overlay" onClick={closeNotificationDetailModal}>
            <div className="modal-card modal-wide glass-panel seller-detail-modal" onClick={(event) => event.stopPropagation()}>
              <div className="section-head">
                <h3>Notification Detail</h3>
                <button type="button" className="ghost-btn" onClick={closeNotificationDetailModal}>Close</button>
              </div>
              {notificationDetailLoading && !selectedNotificationDetail ? (
                <p className="muted">Loading notification detail...</p>
              ) : !selectedNotificationDetail ? (
                <p className="muted">Notification detail is unavailable right now.</p>
              ) : (
                <>
                  <section className="seller-detail-hero">
                    <div>
                      <p className="eyebrow">Notification performance</p>
                      <h3>{selectedNotificationDetail.notification.title}</h3>
                      <p>{selectedNotificationDetail.notification.message}</p>
                    </div>
                    <div className="seller-detail-badges">
                      <span className={`badge ${selectedNotificationDetail.notification.sent_at ? "success" : "pending"}`}>
                        {selectedNotificationDetail.notification.sent_at ? "Sent" : "Scheduled"}
                      </span>
                      <span className="badge pending">{selectedNotificationDetail.notification.channel}</span>
                    </div>
                  </section>

                  <div className="seller-detail-grid">
                    <article className="seller-detail-card">
                      <h4>Audience Summary</h4>
                      <div className="seller-detail-list">
                        <div><span>Audience</span><strong>{selectedNotificationDetail.notification.audience_type}</strong></div>
                        <div><span>Created By</span><strong>{selectedNotificationDetail.notification.creator_name || "System"}</strong></div>
                        <div><span>Created</span><strong>{formatDateTime(selectedNotificationDetail.notification.created_at)}</strong></div>
                        <div><span>Sent</span><strong>{formatDateTime(selectedNotificationDetail.notification.sent_at)}</strong></div>
                      </div>
                    </article>

                    <article className="seller-detail-card">
                      <h4>Performance</h4>
                      <div className="seller-detail-list">
                        <div><span>Total recipients</span><strong>{selectedNotificationDetail.notification.recipient_count || 0}</strong></div>
                        <div><span>Sent</span><strong>{selectedNotificationDetail.notification.sent_count || 0}</strong></div>
                        <div><span>Read</span><strong>{selectedNotificationDetail.notification.read_count || 0}</strong></div>
                        <div><span>Unread</span><strong>{selectedNotificationDetail.notification.unread_count || 0}</strong></div>
                        <div><span>Scheduled</span><strong>{selectedNotificationDetail.notification.scheduled_count || 0}</strong></div>
                      </div>
                    </article>
                  </div>

                  <section className="seller-detail-section">
                    <div className="section-head compact">
                      <h3>Delivery Logs</h3>
                      <span>{selectedNotificationDetail.logs?.length || 0} entries</span>
                    </div>
                    <table className="data-table">
                      <thead>
                        <tr><th>Seller</th><th>Status</th><th>Delivered</th><th>Read</th><th>Message</th></tr>
                      </thead>
                      <tbody>
                        {(selectedNotificationDetail.logs || []).length === 0 ? (
                          <tr><td colSpan="5">No delivery logs found.</td></tr>
                        ) : (
                          (selectedNotificationDetail.logs || []).map((entry) => (
                            <tr key={entry.id}>
                              <td>
                                <strong>{entry.seller_name || "-"}</strong>
                                <div className="seller-meta-stack">
                                  <span>{entry.seller_code || "-"}</span>
                                </div>
                              </td>
                              <td><span className={`badge ${entry.delivery_status === "read" ? "success" : "pending"}`}>{entry.delivery_status || "-"}</span></td>
                              <td>{formatDateTime(entry.delivered_at)}</td>
                              <td>{formatDateTime(entry.read_at)}</td>
                              <td>{entry.delivery_message || "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </section>

                  <div className="modal-fixed-actions">
                    <button type="button" className="ghost-btn" onClick={closeNotificationDetailModal}>Close</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showSellerNotificationsModal && !isPlatformAdmin && (
          <div className="modal-overlay" onClick={() => setShowSellerNotificationsModal(false)}>
            <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
              <div className="section-head">
                <h3>Your Notifications</h3>
                <button type="button" className="ghost-btn" onClick={() => setShowSellerNotificationsModal(false)}>Close</button>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Title</th><th>Channel</th><th>Status</th><th>When</th></tr>
                </thead>
                <tbody>
                  {notifications.length === 0 ? (
                    <tr><td colSpan="4">No notifications yet.</td></tr>
                  ) : (
                    notifications.map((notification) => (
                      <tr key={notification.id} className="lead-row" onClick={() => handleOpenSellerNotification(notification)}>
                        <td>
                          <strong>{notification.title}</strong>
                          <div className="seller-meta-stack">
                            <span>{notification.message}</span>
                          </div>
                        </td>
                        <td>{notification.channel}</td>
                        <td>
                          <span className={`badge ${String(notification.delivery_status || "").toLowerCase() === "read" ? "success" : "pending"}`}>
                            {String(notification.delivery_status || "").toLowerCase() === "read" ? "Read" : "Unread"}
                          </span>
                        </td>
                        <td>{formatDateTime(notification.read_at || notification.delivered_at || notification.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="modal-fixed-actions">
                <button type="button" className="ghost-btn" onClick={() => setShowSellerNotificationsModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {showSubscriptionModal && selectedSellerSubscription && (
          <div className="modal-overlay" onClick={closeSubscriptionModal}>
            <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
              <div className="section-head">
                <h3>Subscription Detail</h3>
                <button type="button" className="ghost-btn" onClick={closeSubscriptionModal}>Close</button>
              </div>
              <div className="seller-meta-stack" style={{ marginBottom: "14px" }}>
                <strong>{selectedSellerSubscription.seller.name}</strong>
                <span>{selectedSellerSubscription.seller.seller_code}</span>
                <span>{selectedSellerSubscription.seller.email || selectedSellerSubscription.seller.mobile || "-"}</span>
              </div>
              <div className="seller-lifecycle-grid">
                <label>
                  <span>Plan</span>
                  <select value={subscriptionModalDraft.planCode} onChange={(e) => setSubscriptionModalDraft((prev) => ({ ...prev, planCode: e.target.value }))}>
                    <option value="">Select Plan</option>
                    {plans.map((plan) => <option key={plan.id} value={plan.plan_code}>{plan.plan_name} ({plan.plan_code})</option>)}
                  </select>
                </label>
                <label>
                  <span>Subscription Status</span>
                  <select value={subscriptionModalDraft.status} onChange={(e) => setSubscriptionModalDraft((prev) => ({ ...prev, status: e.target.value }))}>
                    {SUBSCRIPTION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Trial End</span>
                  <input type="date" value={subscriptionModalDraft.trialEndAt} onChange={(e) => setSubscriptionModalDraft((prev) => ({ ...prev, trialEndAt: e.target.value }))} />
                </label>
                <label className="seller-toggle" style={{ alignSelf: "end" }}>
                  <input type="checkbox" checked={subscriptionModalDraft.convertedFromTrial} onChange={(e) => setSubscriptionModalDraft((prev) => ({ ...prev, convertedFromTrial: e.target.checked }))} style={{ width: "auto" }} />
                  Converted From Trial
                </label>
              </div>
              <div className="seller-lifecycle-actions" style={{ marginTop: "16px" }}>
                <button type="button" className="ghost-btn" onClick={handleSaveSubscriptionModal}>Save Subscription</button>
                {canConvertToPaid(subscriptionModalDraft.planCode, subscriptionModalDraft.status, plans) && (
                  <button type="button" className="compact-btn" onClick={handleConvertToPaid}>Convert To Paid</button>
                )}
              </div>
              <table className="data-table" style={{ marginTop: "18px" }}>
                <thead>
                  <tr><th>Plan</th><th>Status</th><th>Trial</th><th>Start</th><th>End</th></tr>
                </thead>
                <tbody>
                  {(selectedSellerSubscription.subscriptions || []).map((subscription) => (
                    <tr key={subscription.id}>
                      <td>{subscription.plan_name || subscription.plan_code}</td>
                      <td>{subscription.status}</td>
                      <td>{formatDateIST(subscription.trial_end_at)}</td>
                      <td>{formatDateIST(subscription.start_date)}</td>
                      <td>{formatDateIST(subscription.end_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="section-head compact" style={{ marginTop: "18px" }}>
                <h3>Change History</h3>
                <span>{(selectedSellerSubscription.auditLogs || []).length} event(s)</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>When</th><th>Action</th><th>Actor</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {(selectedSellerSubscription.auditLogs || []).length === 0 ? (
                    <tr><td colSpan="4">No subscription audit found yet.</td></tr>
                  ) : (
                    (selectedSellerSubscription.auditLogs || []).map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDateTime(entry.created_at)}</td>
                        <td>{formatAuditActionLabel(entry.action_key)}</td>
                        <td>{entry.actor_name || entry.actor_mobile || "System"}</td>
                        <td><pre className="audit-detail">{JSON.stringify(entry.detail || {}, null, 2)}</pre></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

































































