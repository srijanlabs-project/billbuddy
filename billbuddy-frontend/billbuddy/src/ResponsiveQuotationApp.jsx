import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";
import {
  getQuotationCustomFieldEntries,
  getQuotationItemDimensionText,
  getQuotationItemQuantityValue,
  getQuotationItemRateValue,
  getQuotationItemTitle,
  getQuotationItemTotalValue
} from "./utils/quotationView";

const DRAFT_KEY = "billbuddyResponsiveQuotationDraft";

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

function normalizeCategory(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "sheet") return "Sheet";
  if (raw === "product") return "Product";
  if (raw === "services" || raw === "service") return "Services";
  return "Sheet";
}

function normalizeConfigKey(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

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
  if (normalized === "uom") return "unit";
  if (normalized === "item_note") return "note";
  return normalized;
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
    case "unit":
      return product.unit_type || "";
    case "rate":
      return product.base_price ?? "";
    case "color_name":
      return product.color_name || "";
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

function createEmptyItem(materialName = "", category = "Sheet") {
  return {
    materialName,
    category,
    color: "",
    otherInfo: "",
    ps: false,
    thickness: "",
    height: "",
    width: "",
    unit: "ft",
    quantity: "1",
    rate: "",
    note: "",
    customFields: {}
  };
}

function createInitialDraft() {
  return {
    step: "customer",
    customer: {
      search: "",
      selectedCustomerId: "",
      name: "",
      mobile: "",
      monthlyBilling: false
    },
    itemForm: createEmptyItem(),
    amounts: {
      discountAmount: "",
      advanceAmount: "",
      deliveryDate: ""
    },
    items: [],
    submittedQuotation: null
  };
}

function hasActiveDraftContent(draft) {
  if (!draft) return false;
  const customer = draft.customer || {};
  const itemForm = draft.itemForm || {};
  return Boolean(
    draft.items?.length ||
    customer.search ||
    customer.name ||
    customer.mobile ||
    customer.monthlyBilling ||
    itemForm.materialName ||
    itemForm.color ||
    itemForm.otherInfo ||
    itemForm.ps ||
    itemForm.thickness ||
    itemForm.height ||
    itemForm.width ||
    itemForm.quantity ||
    itemForm.rate ||
    itemForm.note
    || Object.values(itemForm.customFields || {}).some((value) => value !== undefined && value !== null && String(value).trim() !== "")
  );
}

function normalizeDraft(rawDraft) {
  const base = createInitialDraft();
  const customer = rawDraft?.customer || {};
  const legacyMaterialName = rawDraft?.itemForm?.materialType || rawDraft?.itemForm?.materialName || "";
  const itemForm = rawDraft?.itemForm || {};
  const items = Array.isArray(rawDraft?.items) ? rawDraft.items : [];

  return {
    ...base,
    ...rawDraft,
    customer: {
      ...base.customer,
      ...customer
    },
    itemForm: {
      ...createEmptyItem(legacyMaterialName, itemForm.category || "Sheet"),
      ...itemForm,
      materialName: legacyMaterialName,
      category: itemForm.category || "Sheet",
      otherInfo: itemForm.otherInfo || itemForm.importedColor || "",
      customFields: itemForm.customFields || {}
    },
    amounts: {
      ...base.amounts,
      ...(rawDraft?.amounts || {})
    },
    items: items.map((item) => ({
      ...item,
      materialName: item.materialName || item.materialType || "",
      category: item.category || "Sheet",
      customFields: item.customFields || {}
    })),
    submittedQuotation: rawDraft?.submittedQuotation || null
  };
}

function createDefaultResponsiveConfiguration() {
  return {
    quotationColumns: [
      { id: "col-material", key: "material_name", label: "Material", type: "text", options: [], required: true, visibleInForm: true },
      { id: "col-thickness", key: "thickness", label: "Thickness", type: "text", options: [], required: false, visibleInForm: true },
      { id: "col-width", key: "width", label: "Width", type: "number", options: [], required: false, visibleInForm: true },
      { id: "col-height", key: "height", label: "Height", type: "number", options: [], required: false, visibleInForm: true },
      { id: "col-quantity", key: "quantity", label: "Quantity", type: "number", options: [], required: true, visibleInForm: true },
      { id: "col-rate", key: "rate", label: "Rate", type: "number", options: [], required: true, visibleInForm: true },
      { id: "col-amount", key: "amount", label: "Amount", type: "formula", options: [], required: false, visibleInForm: false }
    ]
  };
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

  return createDefaultResponsiveConfiguration().quotationColumns
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

function toAmount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFeet(value, unit) {
  const numeric = toAmount(value);
  if (unit === "in") return numeric / 12;
  if (unit === "mm") return numeric * 0.00328084;
  return numeric;
}

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function getVisibleQuotationNumber(quotation) {
  return quotation?.custom_quotation_number || quotation?.seller_quotation_number || quotation?.quotation_number || "";
}

function getQuotationFileStem(quotation) {
  const visibleNumber = getVisibleQuotationNumber(quotation) || "quotation";
  const version = quotation?.version_no || 1;
  return `${String(visibleNumber).replace(/[^a-zA-Z0-9-_]+/g, "_")}_ver_${version}`;
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

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function getPaidPlanSuggestions(plans, currentPlanCode) {
  return (plans || [])
    .filter((plan) => Boolean(plan.is_active) && !plan.is_demo_plan && plan.plan_code !== currentPlanCode)
    .sort((left, right) => Number(left.price || 0) - Number(right.price || 0))
    .slice(0, 3);
}

function getSellerBanner(seller, plans = []) {
  const subscription = seller?.currentSubscription;
  if (!subscription) return null;
  const planName = subscription.plan_name || subscription.plan_code || "Plan";
  const suggestedPlans = getPaidPlanSuggestions(plans, subscription.plan_code || seller?.subscription_plan);
  const isTrial = String(subscription.status || "").toLowerCase() === "trial" || Boolean(subscription.is_demo_plan);
  if (subscription.is_expired) {
    return {
      tone: "error",
      text: `${planName} has expired. Quotation creation is locked until the account is upgraded.`,
      suggestedPlans
    };
  }
  if (isTrial) {
    const remaining = daysUntil(subscription.trial_end_at || seller?.trial_ends_at);
    return {
      tone: "warning",
      text: remaining !== null
        ? `${planName} trial is active. ${Math.max(remaining, 0)} day(s) remaining and quotations will carry a watermark.`
        : `${planName} trial is active and quotations will carry a watermark.`,
      suggestedPlans
    };
  }
  return {
    tone: "info",
    text: `${planName} subscription is active for this seller account.`,
    suggestedPlans: []
  };
}

function resolveItemRate(item, materialMeta) {
  const enteredRate = toAmount(item.rate);
  if (enteredRate > 0) {
    return { value: enteredRate, source: "form" };
  }
  const defaultRate = toAmount(materialMeta?.basePrice);
  if (defaultRate > 0) {
    return { value: defaultRate, source: "db" };
  }
  return { value: 0, source: "missing" };
}

function calculateItemTotal(item, materialMeta) {
  const { value: rate } = resolveItemRate(item, materialMeta);
  if (item.category === "Services") return rate * toAmount(item.quantity || 0);
  if (item.category === "Product") return rate * toAmount(item.quantity || 1);
  const widthFeet = toFeet(item.width, item.unit);
  const heightFeet = toFeet(item.height, item.unit);
  return Number((widthFeet * heightFeet * rate * toAmount(item.quantity || 0)).toFixed(2));
}

function isImportedAcrylic(materialName) {
  return String(materialName || "").trim().toLowerCase() === "imported acrylic";
}

function getItemFormRules(item) {
  const imported = isImportedAcrylic(item.materialName);
  const isSheet = item.category === "Sheet";
  const isProduct = item.category === "Product";
  const isServices = item.category === "Services";

  return {
    showOtherInfo: isSheet,
    showUnitPrice: isSheet || isProduct,
    showDimensions: isSheet,
    showThickness: isSheet,
    showColor: isSheet,
    showUnit: isSheet,
    showQuantity: true,
    requireWidthHeight: isSheet,
    requireRateOrBasePrice: isSheet || isProduct || isServices,
    imported
  };
}

function validateItem(item, materialMeta) {
  const rules = getItemFormRules(item);
  if (!item.materialName) return false;
  const { value: rate } = resolveItemRate(item, materialMeta);
  if (rules.requireRateOrBasePrice && rate <= 0) return false;
  if (toAmount(item.quantity) <= 0) return false;
  if (rules.requireWidthHeight) {
    return toAmount(item.width) > 0 && toAmount(item.height) > 0;
  }
  return true;
}

export default function ResponsiveQuotationApp({
  auth,
  seller,
  plans,
  customers,
  products,
  quotationTemplate,
  onLogout,
  onCustomerCreated
}) {
  const sellerBanner = getSellerBanner(seller, plans);
  const [activeView, setActiveView] = useState("create");
  const [draft, setDraft] = useState(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? normalizeDraft(JSON.parse(raw)) : createInitialDraft();
    } catch {
      return createInitialDraft();
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState("submitted");
  const [pageMessage, setPageMessage] = useState("");
  const [editingItemId, setEditingItemId] = useState(null);
  const [quotationSearch, setQuotationSearch] = useState("");
  const [quotationRows, setQuotationRows] = useState([]);
  const [quotationLoading, setQuotationLoading] = useState(false);
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [selectedQuotationDetail, setSelectedQuotationDetail] = useState(null);
  const [selectedQuotationVersions, setSelectedQuotationVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [currentSellerConfiguration, setCurrentSellerConfiguration] = useState(null);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    let active = true;
    async function loadSellerConfiguration() {
      try {
        const response = await apiFetch("/api/seller-configurations/current/me");
        if (active) setCurrentSellerConfiguration(response?.config || null);
      } catch {
        if (active) setCurrentSellerConfiguration(null);
      }
    }
    loadSellerConfiguration();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadQuotations() {
      try {
        setQuotationLoading(true);
        const rows = await apiFetch("/api/quotations");
        if (active) setQuotationRows(Array.isArray(rows) ? rows : []);
      } catch {
        if (active) setQuotationRows([]);
      } finally {
        if (active) setQuotationLoading(false);
      }
    }
    loadQuotations();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSelectedQuotation() {
      if (!selectedQuotationId) {
        if (active) {
          setSelectedQuotationDetail(null);
          setSelectedQuotationVersions([]);
          setSelectedVersionId("");
        }
        return;
      }
      try {
        setDetailLoading(true);
        const [detail, versions] = await Promise.all([
          apiFetch(`/api/quotations/${selectedQuotationId}`),
          apiFetch(`/api/quotations/${selectedQuotationId}/versions`)
        ]);
        if (!active) return;
        setSelectedQuotationDetail(detail);
        setSelectedQuotationVersions(Array.isArray(versions) ? versions : []);
        setSelectedVersionId(String(versions?.[0]?.id || ""));
      } catch (error) {
        if (!active) return;
        setSelectedQuotationDetail(null);
        setSelectedQuotationVersions([]);
        setSelectedVersionId("");
        setPageMessage(error.message || "Failed to load quotation details");
      } finally {
        if (active) setDetailLoading(false);
      }
    }
    loadSelectedQuotation();
    return () => {
      active = false;
    };
  }, [selectedQuotationId]);

  const materialCatalog = useMemo(() => {
    const grouped = new Map();
    (products || []).forEach((product) => {
      const materialName = String(product.material_name || "").trim();
      if (!materialName) return;
      const existing = grouped.get(materialName) || {
        materialName,
        category: normalizeCategory(product.category),
        colors: new Set(),
        thicknesses: new Set(),
        basePrice: 0
      };
      existing.category = normalizeCategory(existing.category || product.category);
      if (product.color_name) existing.colors.add(product.color_name);
      if (product.thickness) existing.thicknesses.add(product.thickness);
      if (!existing.basePrice && toAmount(product.base_price) > 0) {
        existing.basePrice = toAmount(product.base_price);
      }
      grouped.set(materialName, existing);
    });

    return Array.from(grouped.values()).map((entry) => ({
      materialName: entry.materialName,
      category: entry.category,
      colors: Array.from(entry.colors),
      thicknesses: Array.from(entry.thicknesses),
      basePrice: entry.basePrice
    }));
  }, [products]);

  const materialOptions = useMemo(() => materialCatalog.map((entry) => entry.materialName), [materialCatalog]);
  const runtimeQuotationColumns = useMemo(
    () => getSupportedQuotationColumns(currentSellerConfiguration),
    [currentSellerConfiguration]
  );
  const unsupportedRuntimeQuotationColumns = useMemo(
    () => getUnsupportedQuotationColumns(currentSellerConfiguration),
    [currentSellerConfiguration]
  );

  useEffect(() => {
    if (draft.itemForm.materialName || materialOptions.length === 0) return;
    const firstMaterial = materialCatalog[0];
    setDraft((prev) => ({
      ...prev,
      itemForm: createEmptyItem(firstMaterial.materialName, firstMaterial.category)
    }));
  }, [draft.itemForm.materialName, materialCatalog, materialOptions.length]);

  const selectedMaterialMeta = useMemo(() => {
    return materialCatalog.find((entry) => entry.materialName === draft.itemForm.materialName) || {
      materialName: draft.itemForm.materialName,
      category: normalizeCategory(draft.itemForm.category),
      colors: [],
      thicknesses: [],
      basePrice: 0
    };
  }, [materialCatalog, draft.itemForm.materialName, draft.itemForm.category]);

  const selectedCatalogueProduct = useMemo(() => {
    const targetName = String(draft.itemForm.materialName || "").trim().toLowerCase();
    if (!targetName) return null;
    return (products || []).find((product) => {
      const materialName = String(product.material_name || "").trim().toLowerCase();
      return materialName === targetName;
    }) || null;
  }, [products, draft.itemForm.materialName]);

  const filteredCustomers = useMemo(() => {
    const term = draft.customer.search.trim().toLowerCase();
    if (!term) return [];
    return customers.filter((customer) =>
      [customer.name, customer.firm_name, customer.mobile]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    ).slice(0, 8);
  }, [customers, draft.customer.search]);

  const grossTotal = useMemo(
    () => draft.items.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [draft.items]
  );

  const filteredQuotations = useMemo(() => {
    const term = quotationSearch.trim().toLowerCase();
    if (!term) return quotationRows.slice(0, 12);
    return quotationRows.filter((row) =>
      [getVisibleQuotationNumber(row), row.customer_name, row.firm_name, row.mobile]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    ).slice(0, 20);
  }, [quotationRows, quotationSearch]);

  const discountAmount = toAmount(draft.amounts.discountAmount);
  const advanceAmount = toAmount(draft.amounts.advanceAmount);
  const balanceAmount = Math.max(Number((grossTotal - discountAmount - advanceAmount).toFixed(2)), 0);
  const amountWarning = discountAmount > grossTotal * 0.1 && grossTotal > 0;
  const selectedVersionRecord = selectedQuotationVersions.find((version) => String(version.id) === String(selectedVersionId)) || null;
  const displayedQuotation = selectedVersionRecord?.quotation_snapshot || selectedQuotationDetail?.quotation || null;
  const displayedItems = selectedVersionRecord?.items_snapshot || selectedQuotationDetail?.items || [];

  function patchDraft(updater) {
    setDraft((prev) => updater(prev));
  }

  async function requestUpgrade(planCode) {
    if (!planCode) return;
    try {
      setUpgradeLoading(true);
      const response = await apiFetch("/api/sellers/me/upgrade-request", {
        method: "POST",
        body: JSON.stringify({
          requestedPlanCode: planCode
        })
      });
      setPageMessage(response.message || "Upgrade request sent.");
    } catch (error) {
      setPageMessage(error.message || "Failed to request upgrade");
    } finally {
      setUpgradeLoading(false);
    }
  }

  function updateCustomerField(field, value) {
    patchDraft((prev) => ({
      ...prev,
      customer: {
        ...prev.customer,
        [field]: value
      }
    }));
  }

  function updateAmountField(field, value) {
    patchDraft((prev) => ({
      ...prev,
      amounts: {
        ...prev.amounts,
        [field]: value
      }
    }));
  }

  function selectCustomer(customer) {
    patchDraft((prev) => ({
      ...prev,
      customer: {
        ...prev.customer,
        selectedCustomerId: customer.id,
        name: customer.name || customer.firm_name || "",
        mobile: customer.mobile || "",
        search: customer.name || customer.mobile || "",
        monthlyBilling: Boolean(customer.monthly_billing)
      }
    }));
  }

  function updateMaterial(materialName) {
    const materialMeta = materialCatalog.find((entry) => entry.materialName === materialName) || {
      materialName,
      category: "Sheet"
    };
    patchDraft((prev) => ({
      ...prev,
      itemForm: {
        ...createEmptyItem(materialMeta.materialName, materialMeta.category),
        customFields: getCatalogueDrivenQuotationCustomFields(
          (products || []).find((product) => String(product.material_name || "").trim() === String(materialMeta.materialName || "").trim()) || null,
          unsupportedRuntimeQuotationColumns.filter((column) => column.visibleInForm && column.type !== "formula"),
          {}
        )
      }
    }));
  }

  function updateItemField(field, value) {
    patchDraft((prev) => ({
      ...prev,
      itemForm: {
        ...prev.itemForm,
        category: selectedMaterialMeta.category,
        [field]: value
      }
    }));
  }

  function updateItemCustomField(fieldKey, value) {
    patchDraft((prev) => ({
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

  function addItem() {
    const effectiveCustomFields = getCatalogueDrivenQuotationCustomFields(
      selectedCatalogueProduct,
      unsupportedRuntimeQuotationColumns.filter((column) => column.visibleInForm && column.type !== "formula"),
      draft.itemForm.customFields
    );

    const customFieldError = getCustomQuotationValidationError(
      unsupportedRuntimeQuotationColumns.filter((column) => column.visibleInForm && column.type !== "formula"),
      effectiveCustomFields
    );

    if (customFieldError) {
      setPageMessage(customFieldError);
      return;
    }

    const rateMeta = resolveItemRate(draft.itemForm, selectedMaterialMeta);
    const item = {
      ...draft.itemForm,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      category: selectedMaterialMeta.category,
      customFields: effectiveCustomFields,
      descriptor: getQuotationItemTitle(draft.itemForm),
      rateValue: rateMeta.value,
      rateSource: rateMeta.source,
      total: calculateItemTotal(draft.itemForm, selectedMaterialMeta)
    };

    patchDraft((prev) => ({
      ...prev,
      items: editingItemId
        ? prev.items.map((entry) => (entry.id === editingItemId ? { ...item, id: editingItemId } : entry))
        : [...prev.items, item],
      step: "items",
      itemForm: createEmptyItem(prev.itemForm.materialName, selectedMaterialMeta.category)
    }));
    setEditingItemId(null);
    setPageMessage(editingItemId ? "Item updated in draft." : "Item added to draft.");
  }

  function editItem(item) {
    patchDraft((prev) => ({
      ...prev,
      step: "items",
      itemForm: {
        materialName: item.materialName,
        category: item.category,
        color: item.color || "",
        otherInfo: item.otherInfo || item.importedColor || "",
        ps: Boolean(item.ps),
        thickness: item.thickness || "",
        height: item.height || "",
        width: item.width || "",
        unit: item.unit || "ft",
        quantity: item.quantity || "1",
        rate: item.rate || "",
        note: item.note || "",
        customFields: item.customFields || {}
      }
    }));
    setEditingItemId(item.id);
    setPageMessage("Editing saved line item.");
  }

  function removeItem(itemId) {
    if (!window.confirm("Remove this item from the draft?")) return;
    patchDraft((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
      itemForm: editingItemId === itemId
        ? createEmptyItem(prev.itemForm.materialName, prev.itemForm.category)
        : prev.itemForm
    }));
    if (editingItemId === itemId) setEditingItemId(null);
    setPageMessage("Item removed from draft.");
  }

  function cancelEdit() {
    setEditingItemId(null);
    patchDraft((prev) => ({
      ...prev,
      itemForm: createEmptyItem(prev.itemForm.materialName, selectedMaterialMeta.category)
    }));
  }

  async function ensureCustomer() {
    if (draft.customer.selectedCustomerId) return draft.customer.selectedCustomerId;

    const mobileMatch = customers.find((customer) => customer.mobile && customer.mobile === draft.customer.mobile);
    if (mobileMatch) return mobileMatch.id;

    const created = await apiFetch("/api/customers", {
      method: "POST",
      body: JSON.stringify({
        name: draft.customer.name,
        mobile: draft.customer.mobile,
        firmName: draft.customer.name,
        monthlyBilling: Boolean(draft.customer.monthlyBilling)
      })
    });
    onCustomerCreated?.(created);
    return created.id;
  }

  function buildQuotationItems() {
    return draft.items.map((item) => {
      const displayRate = Number(item.rateValue || 0);
      if (item.category === "Services") {
        return {
          size: null,
            quantity: toAmount(item.quantity || 0),
            unitPrice: displayRate,
            materialType: item.materialName,
            designName: getQuotationItemTitle(item),
            thickness: null,
            sku: null,
            itemNote: item.note || null,
            pricingType: "FIXED",
            customFields: item.customFields || {}
        };
      }

      if (item.category === "Product") {
        return {
            size: null,
            quantity: toAmount(item.quantity || 1),
            unitPrice: displayRate,
            materialType: item.materialName,
            designName: getQuotationItemTitle(item),
            thickness: null,
            sku: null,
            colorName: null,
          importedColorNote: null,
          psIncluded: false,
          itemNote: item.note || null,
          pricingType: "UNIT",
          customFields: item.customFields || {}
        };
      }

      const widthFeet = toFeet(item.width, item.unit);
      const heightFeet = toFeet(item.height, item.unit);
      const enteredQuantity = toAmount(item.quantity || 0);
      const totalArea = Number((widthFeet * heightFeet).toFixed(2));
      const effectiveQty = totalArea * enteredQuantity;

        return {
          size: `${item.width || 0} x ${item.height || 0}`,
          quantity: enteredQuantity,
          unitPrice: displayRate,
          totalPrice: Number((effectiveQty * displayRate).toFixed(2)),
          materialType: item.materialName,
          designName: getQuotationItemTitle(item),
          thickness: item.thickness || null,
        sku: item.ps ? "PS" : null,
        colorName: item.color || null,
        importedColorNote: item.otherInfo || null,
        psIncluded: Boolean(item.ps),
        dimensionHeight: toAmount(item.height),
        dimensionWidth: toAmount(item.width),
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

  async function submitQuotation(recordStatus = "submitted") {
    try {
      setSubmitting(true);
      setSubmitMode(recordStatus);
      setPageMessage("");
      const customerId = await ensureCustomer();
      const response = await apiFetch("/api/quotations", {
        method: "POST",
        body: JSON.stringify({
          customerId,
          items: buildQuotationItems(),
          gstPercent: 0,
          transportCharges: 0,
          designCharges: 0,
          discountAmount,
          advanceAmount,
          deliveryDate: draft.amounts.deliveryDate || null,
          balanceAmount,
          paymentStatus: advanceAmount > 0 && balanceAmount > 0 ? "partial" : "pending",
          orderStatus: "NEW",
          deliveryType: "PICKUP",
          sourceChannel: "responsive-web",
          recordStatus,
          customerMonthlyBilling: Boolean(draft.customer.monthlyBilling)
        })
      });

      setDraft((prev) => ({
        ...prev,
        submittedQuotation: response.quotation,
        step: "preview"
      }));
      setQuotationRows((prev) => [response.quotation, ...prev.filter((row) => row.id !== response.quotation.id)]);
      setActiveView("create");
      setSubmitting(false);
      setSubmitMode("submitted");

      const successMessage = recordStatus === "draft" ? "Quotation saved as draft." : "Quotation submitted successfully.";
      if (Array.isArray(response.inventoryWarnings) && response.inventoryWarnings.length > 0) {
        setPageMessage(`${successMessage} ${response.inventoryWarnings.join(" ")}`);
      } else {
        setPageMessage(successMessage);
      }
    } catch (error) {
      setPageMessage(error.message || "Failed to save quotation");
    } finally {
      setSubmitting(false);
      setSubmitMode("submitted");
    }
  }

  async function downloadQuotation(quotationId = draft.submittedQuotation?.id, quotationRecord = draft.submittedQuotation) {
    if (!quotationId) return;
    const token = auth?.token;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    const response = await fetch(`${baseUrl}/api/quotations/${quotationId}/download`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!response.ok) {
      throw new Error("Failed to download quotation");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
    const filename = nameMatch?.[1] || `${getQuotationFileStem(quotationRecord || { id: quotationId })}.pdf`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadRichPdfDebug(quotationId = draft.submittedQuotation?.id, quotationRecord = draft.submittedQuotation) {
    if (!quotationId) return;
    const token = auth?.token;
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
    const response = await fetch(`${baseUrl}/api/quotations/${quotationId}/download?debug=1`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    if (!response.ok) {
      throw new Error("Failed to run rich PDF debug");
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
    const filename = nameMatch?.[1] || `${getQuotationFileStem(quotationRecord || { id: quotationId })}.pdf`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function resetDraft() {
    const needsConfirm = !draft.submittedQuotation && hasActiveDraftContent(draft);
    if (needsConfirm && !window.confirm("Discard the current draft and start a new quotation?")) return;
    const next = createInitialDraft();
    const firstMaterial = materialCatalog[0];
    const seededDraft = firstMaterial
      ? { ...next, itemForm: createEmptyItem(firstMaterial.materialName, firstMaterial.category) }
      : next;
    setDraft(seededDraft);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(seededDraft));
    setPageMessage("");
  }

  async function confirmSelectedQuotation() {
    if (!selectedQuotationDetail?.quotation?.id) return;
    const quotationNumber = getVisibleQuotationNumber(selectedQuotationDetail.quotation) || "this quotation";
    const confirmed = window.confirm(`Confirm ${quotationNumber}? Once confirmed, this quotation cannot be edited.`);
    if (!confirmed) return;

    try {
      const response = await apiFetch(`/api/quotations/${selectedQuotationDetail.quotation.id}/confirm`, {
        method: "PATCH"
      });
      setSelectedQuotationDetail((prev) => prev ? { ...prev, quotation: response.quotation } : prev);
      setQuotationRows((prev) => prev.map((row) => (row.id === response.quotation.id ? { ...row, ...response.quotation } : row)));
      setPageMessage("Quotation confirmed successfully.");
    } catch (error) {
      setPageMessage(error.message || "Failed to confirm quotation");
    }
  }

  const itemCategory = selectedMaterialMeta.category;
  const itemRules = getItemFormRules({ ...draft.itemForm, category: itemCategory });
  const itemReady = validateItem({ ...draft.itemForm, category: itemCategory }, selectedMaterialMeta);

  return (
    <div className="responsive-quote-shell">
      <header className="rq-topbar">
        <div>
          <div className="rq-kicker">{seller?.name || "BillBuddy"}</div>
          <h1>Create Quotation</h1>
          <p>Draft-friendly quotation flow for mobile and desktop web.</p>
        </div>
        <div className="rq-topbar-actions">
          <div className="rq-view-tabs">
            <button type="button" className={`rq-view-tab ${activeView === "create" ? "active" : ""}`} onClick={() => setActiveView("create")}>Create</button>
            <button type="button" className={`rq-view-tab ${activeView === "search" ? "active" : ""}`} onClick={() => setActiveView("search")}>Search</button>
          </div>
          <span className="rq-user-pill">{auth?.user?.name || "User"}</span>
          <button type="button" className="ghost-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      {pageMessage && <div className="notice">{pageMessage}</div>}
      {sellerBanner && (
        <div className={`notice ${sellerBanner.tone === "error" ? "error" : sellerBanner.tone === "info" ? "info" : ""}`}>
          <div className="notice-stack">
            <div>{sellerBanner.text}</div>
            {(sellerBanner.suggestedPlans || []).length > 0 && (
              <div className="banner-actions">
                {sellerBanner.suggestedPlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className="ghost-btn compact-btn"
                    disabled={upgradeLoading}
                    onClick={() => requestUpgrade(plan.plan_code)}
                  >
                    {upgradeLoading ? "Sending..." : `Upgrade to ${plan.plan_name}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === "create" ? (
      <div className="rq-layout">
        <section className="glass-panel rq-form-panel">
          <div className="rq-step-row">
            <button type="button" className={`rq-step-chip ${draft.step === "customer" ? "active" : ""}`}>1. Customer</button>
            <button type="button" className={`rq-step-chip ${draft.step === "items" ? "active" : ""}`}>2. Items</button>
            <button type="button" className={`rq-step-chip ${draft.step === "preview" ? "active" : ""}`}>3. Amount & Preview</button>
          </div>

          <div className="rq-section">
            <div className="section-head">
              <h3>Create Customer</h3>
              <span>Suggestions start only after typing</span>
            </div>
            <div className="rq-grid two">
              <label>
                <span>Search customer</span>
                <input
                  value={draft.customer.search}
                  onChange={(e) => updateCustomerField("search", e.target.value)}
                  placeholder="Search by name or mobile"
                />
              </label>
              <label>
                <span>Monthly Billing</span>
                <div className="rq-toggle">
                  <input
                    type="checkbox"
                    checked={draft.customer.monthlyBilling}
                    onChange={(e) => updateCustomerField("monthlyBilling", e.target.checked)}
                  />
                  <span>{draft.customer.monthlyBilling ? "Enabled" : "Disabled"}</span>
                </div>
              </label>
              <label>
                <span>Customer name</span>
                <input value={draft.customer.name} onChange={(e) => updateCustomerField("name", e.target.value)} placeholder="Customer name" />
              </label>
              <label>
                <span>Customer mobile</span>
                <input value={draft.customer.mobile} onChange={(e) => updateCustomerField("mobile", e.target.value)} placeholder="Customer mobile" />
              </label>
            </div>

            {filteredCustomers.length > 0 && (
              <div className="rq-customer-results">
                {filteredCustomers.map((customer) => (
                  <button type="button" key={customer.id} className="rq-result-card" onClick={() => selectCustomer(customer)}>
                    <strong>{customer.name || customer.firm_name}</strong>
                    <span>{customer.mobile || "-"}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="rq-actions">
              <button
                type="button"
                onClick={() => patchDraft((prev) => ({ ...prev, step: "items" }))}
                disabled={!draft.customer.name || !draft.customer.mobile}
              >
                Next
              </button>
            </div>
          </div>

          <div className="rq-section">
            <div className="section-head">
              <h3>Create Items</h3>
              <span>{draft.items.length} item(s) saved</span>
            </div>

            <div className="rq-material-tabs">
              {materialOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`rq-material-tab ${draft.itemForm.materialName === option ? "active" : ""}`}
                  onClick={() => updateMaterial(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="rq-grid three">
              {runtimeQuotationColumns
                .filter((column) => column.visibleInForm)
                .map((column) => {
                  const normalizedKey = column.normalizedKey;
                  const meta = column.meta;

                  if (normalizedKey === "category") return null;
                  if (normalizedKey === "thickness" && !itemRules.showThickness) return null;
                  if (normalizedKey === "color_name" && !itemRules.showColor) return null;
                  if (normalizedKey === "other_info" && !itemRules.showOtherInfo) return null;
                  if (normalizedKey === "ps" && itemCategory !== "Sheet") return null;
                  if (["width", "height", "unit"].includes(normalizedKey) && !itemRules.showDimensions) return null;
                  if (normalizedKey === "quantity" && !itemRules.showQuantity) return null;
                  if (normalizedKey === "rate" && !itemRules.showUnitPrice) return null;

                  if (meta.inputType === "checkbox") {
                    return (
                      <label key={column.id}>
                        <span>{column.label}</span>
                        <div className="rq-toggle">
                          <input type="checkbox" checked={Boolean(draft.itemForm[meta.formKey])} onChange={(e) => updateItemField(meta.formKey, e.target.checked)} />
                          <span>{draft.itemForm[meta.formKey] ? "Checked" : "Not Checked"}</span>
                        </div>
                      </label>
                    );
                  }

                  if (meta.inputType === "unit-select") {
                    return (
                      <label key={column.id}>
                        <span>{column.label}</span>
                        <select value={draft.itemForm.unit} onChange={(e) => updateItemField("unit", e.target.value)}>
                          <option value="in">in</option>
                          <option value="mm">mm</option>
                          <option value="ft">ft</option>
                        </select>
                      </label>
                    );
                  }

                  const placeholder =
                    normalizedKey === "color_name"
                      ? "Select or type colour"
                      : normalizedKey === "other_info"
                        ? (itemRules.imported ? "Add imported details" : "Add open text info")
                        : normalizedKey === "thickness"
                          ? "Thickness (optional)"
                          : normalizedKey === "rate"
                            ? (itemCategory === "Product" ? "Rate per unit" : itemCategory === "Services" ? "Rate" : "Per sft Rate")
                            : column.label;

                  const listId = normalizedKey === "color_name"
                    ? "material-colour-list"
                    : normalizedKey === "thickness"
                      ? "material-thickness-list"
                      : undefined;

                  const control = normalizedKey === "other_info" || meta.fullWidth ? (
                    <textarea
                      rows={normalizedKey === "other_info" ? 2 : 3}
                      value={draft.itemForm[meta.formKey]}
                      onChange={(e) => updateItemField(meta.formKey, e.target.value)}
                      placeholder={placeholder}
                    />
                  ) : (
                    <input
                      list={listId}
                      value={draft.itemForm[meta.formKey]}
                      onChange={(e) => updateItemField(meta.formKey, e.target.value)}
                      placeholder={placeholder}
                    />
                  );

                  return (
                    <label key={column.id} className={normalizedKey === "other_info" || meta.fullWidth ? "rq-full" : ""}>
                      <span>{column.label}</span>
                      {control}
                    </label>
                  );
                })}

              {unsupportedRuntimeQuotationColumns
                .filter((column) => column.visibleInForm && column.type !== "formula")
                .map((column) => {
                  const boundValue = getProductConfigurationFieldValue(selectedCatalogueProduct, column.key);
                  const isBoundToCatalogue = boundValue !== "" && boundValue !== null && boundValue !== undefined;
                  const value = isBoundToCatalogue
                    ? boundValue
                    : draft.itemForm.customFields?.[column.key];

                  if (column.type === "checkbox") {
                    return (
                      <label key={column.id} className="rq-full">
                        <span>{column.label}</span>
                        <div className="rq-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            disabled={isBoundToCatalogue}
                            onChange={(e) => updateItemCustomField(column.key, e.target.checked)}
                          />
                          <span>{value ? "Checked" : "Not Checked"}</span>
                        </div>
                      </label>
                    );
                  }

                  if (column.type === "dropdown") {
                    const dropdownOptions = isBoundToCatalogue
                      ? [String(boundValue)]
                      : (column.options || []);
                    return (
                      <label key={column.id} className="rq-full">
                        <span>{column.label}</span>
                        <select
                          value={value ?? ""}
                          disabled={isBoundToCatalogue}
                          onChange={(e) => updateItemCustomField(column.key, e.target.value)}
                        >
                          <option value="">Select {column.label}</option>
                          {dropdownOptions.map((option) => (
                            <option key={`${column.id}-${option}`} value={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    );
                  }

                  return (
                    <label key={column.id} className="rq-full">
                      <span>{column.label}</span>
                      <input
                        type={column.type === "number" ? "number" : "text"}
                        value={value ?? ""}
                        disabled={isBoundToCatalogue}
                        onChange={(e) => updateItemCustomField(column.key, e.target.value)}
                        placeholder={column.label}
                      />
                    </label>
                  );
                })}

              <datalist id="material-colour-list">
                {selectedMaterialMeta.colors.map((color) => <option key={color} value={color} />)}
              </datalist>
              <datalist id="material-thickness-list">
                {selectedMaterialMeta.thicknesses.map((value) => <option key={value} value={value} />)}
              </datalist>

              <label>
                <span>Total rate</span>
                <input value={formatCurrency(calculateItemTotal({ ...draft.itemForm, category: itemCategory }, selectedMaterialMeta))} readOnly />
              </label>
            </div>

            {draft.items.length > 0 && (
              <div className="rq-item-list">
                {draft.items.map((item, index) => (
                  <article key={item.id} className="rq-item-card">
                    <div>
                        <strong>{index + 1}. {getQuotationItemTitle(item)}</strong>
                      <p>{item.note || "No note added"}</p>
                    </div>
                    <div className="rq-item-card-actions">
                      <span>{formatCurrency(item.total)}</span>
                      <div className="rq-inline-actions">
                        <button type="button" className="ghost-btn compact" onClick={() => editItem(item)}>Edit</button>
                        <button type="button" className="ghost-btn compact danger" onClick={() => removeItem(item.id)}>Remove</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="rq-actions">
              {editingItemId && <button type="button" className="ghost-btn" onClick={cancelEdit}>Cancel Edit</button>}
              <button type="button" className="ghost-btn" onClick={addItem} disabled={!itemReady}>{editingItemId ? "Save Item" : "Add Item"}</button>
              <button
                type="button"
                onClick={() => patchDraft((prev) => ({ ...prev, step: "preview" }))}
                disabled={draft.items.length === 0}
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <aside className="glass-panel rq-preview-panel">
          <div className="section-head">
            <h3>Preview</h3>
            <span>{draft.submittedQuotation ? "Saved" : "Draft"}</span>
          </div>

          <div className="rq-preview-header" style={{ "--preview-accent": quotationTemplate?.accent_color || "#2563eb" }}>
            {quotationTemplate?.show_header_image && quotationTemplate?.header_image_data ? (
              <img src={quotationTemplate.header_image_data} alt="Quotation header" />
            ) : (
              <>
                <small>{quotationTemplate?.header_text || "Commercial Offer"}</small>
                <h2>{quotationTemplate?.header_text || "Commercial Offer"}</h2>
                <p>{quotationTemplate?.company_phone || seller?.mobile || "Company mobile"}</p>
              </>
            )}
          </div>

          <div className="rq-preview-meta">
            <div>
              <span>Customer</span>
              <strong>{draft.customer.name || "-"}</strong>
            </div>
            <div>
              <span>Mobile</span>
              <strong>{draft.customer.mobile || "-"}</strong>
            </div>
          </div>

          <div className="rq-section rq-amount-box">
            <div className="section-head compact">
              <h3>Amounts</h3>
              <span>{amountWarning ? "Discount above 10%" : "Auto calculated"}</span>
            </div>
            <div className="rq-grid three">
              <label>
                <span>Total Amount</span>
                <input value={formatCurrency(grossTotal)} readOnly />
              </label>
              <label>
                <span>Discount Amount</span>
                <input value={draft.amounts.discountAmount} onChange={(e) => updateAmountField("discountAmount", e.target.value)} placeholder="Discount" />
              </label>
              <label>
                <span>Advance</span>
                <input value={draft.amounts.advanceAmount} onChange={(e) => updateAmountField("advanceAmount", e.target.value)} placeholder="Advance" />
              </label>
              <label>
                <span>Delivery Date</span>
                <input type="date" value={draft.amounts.deliveryDate || ""} onChange={(e) => updateAmountField("deliveryDate", e.target.value)} />
              </label>
              <label className="rq-full">
                <span>Balance Amount</span>
                <input value={formatCurrency(balanceAmount)} readOnly />
              </label>
            </div>
            {amountWarning && <p className="rq-warning">Discount is more than 10% of quotation amount. Please review before submit.</p>}
          </div>

          <div className="rq-preview-table-wrap">
            <table className="rq-preview-table">
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>Item</th>
                  <th>Thickness</th>
                  <th>Dimension</th>
                  <th>Quantity</th>
                  <th>Rate/Sft</th>
                  <th>Total Rate</th>
                </tr>
              </thead>
              <tbody>
                {draft.items.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="rq-empty-cell">Add at least one item to preview the quotation.</td>
                  </tr>
                ) : (
                  draft.items.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="quotation-item-cell">
                            <strong>{getQuotationItemTitle(item)}</strong>
                            {getQuotationCustomFieldEntries(item.customFields).length > 0 && (
                              <div className="quotation-item-meta">
                                {getQuotationCustomFieldEntries(item.customFields).map((entry) => `${entry.label}: ${entry.value}`).join(" | ")}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>{item.thickness || "-"}</td>
                        <td>{getQuotationItemDimensionText(item)}</td>
                        <td>{getQuotationItemQuantityValue(item)}</td>
                        <td>{formatCurrency(getQuotationItemRateValue(item))}</td>
                        <td>{formatCurrency(getQuotationItemTotalValue(item))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rq-preview-total">
            <span>Balance Amount</span>
            <strong>{formatCurrency(balanceAmount)}</strong>
          </div>

          <div className="rq-actions stacked">
            {!draft.submittedQuotation ? (
              <>
                <button type="button" className="ghost-btn" onClick={() => submitQuotation("draft")} disabled={draft.items.length === 0 || submitting}>
                  {submitting && submitMode === "draft" ? "Saving Draft..." : "Save Draft"}
                </button>
                <button type="button" onClick={() => submitQuotation("submitted")} disabled={draft.items.length === 0 || submitting}>
                  {submitting && submitMode === "submitted" ? "Submitting..." : "Submit Quotation"}
                </button>
              </>
            ) : (
              <>
                {String(draft.submittedQuotation.record_status || "").toLowerCase() !== "draft" && (
                  <button type="button" onClick={downloadQuotation}>Download Quotation</button>
                )}
                {String(draft.submittedQuotation.record_status || "").toLowerCase() !== "draft" && (
                  <button type="button" className="ghost-btn" onClick={() => downloadRichPdfDebug()}>Rich PDF Debug</button>
                )}
                <button type="button" className="ghost-btn" onClick={resetDraft}>New Quotation</button>
              </>
            )}
          </div>
        </aside>
      </div>
      ) : (
        <div className="rq-layout search-layout">
          <section className="glass-panel rq-form-panel">
            <div className="section-head">
              <h3>Search Quotations</h3>
              <span>Search by quotation number, customer, or mobile</span>
            </div>
            <div className="rq-grid one">
              <label>
                <span>Search</span>
                <input
                  value={quotationSearch}
                  onChange={(e) => setQuotationSearch(e.target.value)}
                  placeholder="Type quotation no., customer name, or mobile"
                />
              </label>
            </div>

            <div className="rq-search-list">
              {quotationLoading ? (
                <p className="muted">Loading quotations...</p>
              ) : filteredQuotations.length === 0 ? (
                <p className="muted">No quotations found for this search.</p>
              ) : (
                filteredQuotations.map((row, index) => (
                  <article key={row.id} className="rq-search-card">
                    <div className="rq-search-main">
                      <strong>{index + 1}. {getVisibleQuotationNumber(row)} (Ver.{row.version_no || 1})</strong>
                      <span>{row.firm_name || row.customer_name || "-"}</span>
                      <span>{row.mobile || "-"}</span>
                    </div>
                    <div className="rq-search-meta">
                      <span className={`rq-status-pill ${String(row.record_status || "submitted").toLowerCase()}`}>{row.record_status || "submitted"}</span>
                      <span>{formatCurrency(row.balance_amount || row.total_amount || 0)}</span>
                      <button type="button" className="ghost-btn compact" onClick={() => setSelectedQuotationId(String(row.id))}>View</button>
                      <button type="button" className="ghost-btn compact" onClick={() => downloadQuotation(row.id, row)}>Download</button>
                      <button type="button" className="ghost-btn compact" onClick={() => downloadRichPdfDebug(row.id, row)}>Rich PDF Debug</button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <aside className="glass-panel rq-preview-panel">
            <div className="section-head">
              <h3>Quotation Detail</h3>
              <span>{getVisibleQuotationNumber(displayedQuotation) || "Select a quotation"}</span>
            </div>
            {detailLoading ? (
              <p className="muted">Loading quotation details...</p>
            ) : !selectedQuotationDetail ? (
              <div className="rq-preview-items">
                <div className="rq-preview-row">
                  <div>
                    <strong>Saved quotations</strong>
                    <span>{quotationRows.length} available for this seller</span>
                  </div>
                </div>
                <div className="rq-preview-row">
                  <div>
                    <strong>Need a new draft?</strong>
                    <span>Jump back to create quotation and continue from saved local draft.</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {selectedQuotationVersions.length > 0 && (
                  <div className="rq-grid one">
                    <label>
                      <span>Version History</span>
                      <select value={selectedVersionId} onChange={(e) => setSelectedVersionId(e.target.value)}>
                        <option value="">Latest saved</option>
                        {selectedQuotationVersions.map((version) => (
                          <option key={version.id} value={version.id}>
                            Ver.{version.version_no} - {formatDateIST(version.created_at)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <div className="rq-preview-items">
                <div className="rq-preview-row">
                  <div>
                    <strong>{getVisibleQuotationNumber(displayedQuotation)} (Ver.{displayedQuotation?.version_no || selectedVersionRecord?.version_no || 1})</strong>
                      <span>{displayedQuotation?.customer_name || displayedQuotation?.firm_name || selectedQuotationDetail?.quotation?.customer_name || "-"}</span>
                    </div>
                    <span className={`rq-status-pill ${String(displayedQuotation?.record_status || selectedQuotationDetail?.quotation?.record_status || "submitted").toLowerCase()}`}>
                      {displayedQuotation?.record_status || selectedQuotationDetail?.quotation?.record_status || "submitted"}
                    </span>
                  </div>
                  <div className="rq-preview-row">
                    <div>
                      <strong>Status</strong>
                      <span>{displayedQuotation?.record_status || selectedQuotationDetail?.quotation?.record_status || "submitted"}</span>
                    </div>
                    <strong>{formatCurrency(displayedQuotation?.balance_amount || displayedQuotation?.total_amount || 0)}</strong>
                  </div>
                </div>

                <div className="rq-preview-table-wrap">
                  <table className="rq-preview-table">
                    <thead>
                      <tr>
                        <th>Sr. No.</th>
                        <th>Item</th>
                        <th>Thickness</th>
                        <th>Dimension</th>
                        <th>Quantity</th>
                        <th>Rate/Sft</th>
                        <th>Total Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedItems.length === 0 ? (
                        <tr><td colSpan="7" className="rq-empty-cell">No items in this version.</td></tr>
                      ) : (
                        displayedItems.map((item, index) => (
                          <tr key={`${item.id || index}-${index}`}>
                            <td>{index + 1}</td>
                            <td>
                              <div className="quotation-item-cell">
                                  <strong>{getQuotationItemTitle(item)}</strong>
                                {getQuotationCustomFieldEntries(item.custom_fields).length > 0 && (
                                    <div className="quotation-item-meta">
                                      {getQuotationCustomFieldEntries(item.custom_fields).map((entry) => `${entry.label}: ${entry.value}`).join(" | ")}
                                    </div>
                                  )}
                              </div>
                            </td>
                            <td>{item.thickness || "-"}</td>
                            <td>{getQuotationItemDimensionText(item)}</td>
                            <td>{getQuotationItemQuantityValue(item)}</td>
                            <td>{formatCurrency(getQuotationItemRateValue(item))}</td>
                            <td>{formatCurrency(getQuotationItemTotalValue(item))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="rq-actions stacked">
              {selectedQuotationDetail?.quotation && String(selectedQuotationDetail.quotation.record_status || "").toLowerCase() !== "confirmed" && (
                <button type="button" onClick={confirmSelectedQuotation}>Confirm Quotation</button>
              )}
              <button type="button" onClick={() => setActiveView("create")}>Create Quotation</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
