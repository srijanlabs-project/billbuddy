import { useEffect, useMemo, useState } from "react";
import { buildConfiguredQuotationItemTitle } from "../utils/quotationView";
import { applyShippingAddressGstReuse, createEmptyShippingAddress, updateShippingAddressValue } from "../utils/customerShipping";

const BUILT_IN_VARIANT_FIELDS = [
  { key: "color_name", label: "Colour", kind: "supported", formKey: "color" },
  { key: "thickness", label: "Thickness", kind: "supported", formKey: "thickness" }
];

function normalizeComparableValue(value) {
  return String(value || "").trim().toLowerCase();
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))];
}

function parsePercentLike(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const numeric = Number(raw.replace(/%/g, "").trim());
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
}

function buildSecondarySku(materialName) {
  const slug = String(materialName || "ITEM")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12) || "ITEM";
  return `SEC-${slug}-${Date.now().toString().slice(-6)}`;
}

export default function useQuotationWizard({
  auth,
  products,
  customers,
  runtimeCatalogueFields,
  unsupportedRuntimeCatalogueFields,
  unsupportedRuntimeQuotationColumns,
  createInitialQuotationWizardState,
  createQuotationWizardItem,
  getCatalogueDrivenQuotationCustomFields,
  getCustomQuotationValidationError,
  getQuotationWizardRules,
  validateQuotationWizardItem,
  calculateQuotationWizardItemTotal,
  toQuotationWizardAmount,
  buildQuotationWizardPayloadItems,
  itemDisplayConfig,
  getQuotationRateValidationMessage,
  apiFetch,
  setCustomers,
  setProducts,
  refreshQuotationList,
  loadDashboardData,
  dashboardRange,
  handleOpenOrderDetails,
  handleApiError,
  setError
}) {
  const [showMessageSimulatorModal, setShowMessageSimulatorModal] = useState(false);
  const [quotationWizard, setQuotationWizard] = useState(() => createInitialQuotationWizardState());
  const [quotationWizardSubmitting, setQuotationWizardSubmitting] = useState(false);
  const [quotationPreviewUrl, setQuotationPreviewUrl] = useState("");
  const [quotationPreviewError, setQuotationPreviewError] = useState("");
  const [quotationWizardNotice, setQuotationWizardNotice] = useState("");
  const [quotationWizardCustomerGstValidation, setQuotationWizardCustomerGstValidation] = useState({
    status: "idle",
    gstNumber: "",
    profile: null,
    message: ""
  });
  const [quotationWizardShippingGstValidation, setQuotationWizardShippingGstValidation] = useState({});

  function getVisibleQuotationNumber(quotation) {
    return quotation?.custom_quotation_number || quotation?.seller_quotation_number || quotation?.quotation_number || "";
  }

  function getQuotationFileStem(quotation) {
    const visibleNumber = getVisibleQuotationNumber(quotation) || "quotation";
    const version = quotation?.version_no || 1;
    return `${String(visibleNumber).replace(/[^a-zA-Z0-9-_]+/g, "_")}-V${version}`;
  }

  function extractDownloadFilename(response, quotation) {
    const disposition = response.headers.get("content-disposition") || "";
    const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
    return nameMatch?.[1] || `${getQuotationFileStem(quotation)}.pdf`;
  }

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
      .slice(0, 10);
  }, [customers, quotationWizard.customerSearch]);

  const quotationWizardSelectedProduct = useMemo(() => {
    return products.find((product) => String(product.id) === String(quotationWizard.itemForm.productId)) || null;
  }, [products, quotationWizard.itemForm.productId]);

  function getProductFieldValue(product, fieldKey) {
    if (!product) return "";
    switch (fieldKey) {
      case "material_name":
        return product.material_name || "";
      case "color_name":
        return product.color_name || "";
      case "thickness":
        return product.thickness || "";
      case "category":
        return product.category || "";
      case "material_group":
        return product.material_group || "";
      case "sku":
        return product.sku || "";
      default:
        return product.custom_fields?.[fieldKey] ?? "";
    }
  }

  function getItemFormVariantValue(itemForm, field) {
    if (field.kind === "supported") {
      return itemForm[field.formKey] ?? "";
    }
    return itemForm.customFields?.[field.key] ?? "";
  }

  function setItemFormVariantValue(itemForm, field, value) {
    if (field.kind === "supported") {
      return {
        ...itemForm,
        [field.formKey]: value
      };
    }
    return {
      ...itemForm,
      customFields: {
        ...(itemForm.customFields || {}),
        [field.key]: value
      }
    };
  }

  const quotationWizardVariantFields = useMemo(() => {
    const overlapKeys = new Set((unsupportedRuntimeQuotationColumns || []).map((field) => field.key));
    const customVariantFields = (unsupportedRuntimeCatalogueFields || [])
      .filter((field) => overlapKeys.has(field.key))
      .map((field) => ({
        key: field.key,
        label: field.label,
        kind: "custom"
      }));

    const combined = [...BUILT_IN_VARIANT_FIELDS, ...customVariantFields];
    const seen = new Set();
    return combined.filter((field) => {
      if (seen.has(field.key)) return false;
      seen.add(field.key);
      return true;
    });
  }, [unsupportedRuntimeCatalogueFields, unsupportedRuntimeQuotationColumns]);

  const quotationWizardMaterialSuggestions = useMemo(() => {
    const term = normalizeComparableValue(quotationWizard.itemForm.materialName);
    if (term.length < 2) return [];
    const deduped = [];
    const seen = new Set();

    (products || []).forEach((product) => {
      const materialName = String(product.material_name || "").trim();
      if (!materialName) return;
      if (!normalizeComparableValue(materialName).includes(term)) return;
      const source = String(product.catalogue_source || "primary").toLowerCase() === "secondary" ? "secondary" : "primary";
      const dedupeKey = `${materialName.toLowerCase()}__${source}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      deduped.push({
        materialName,
        source
      });
    });

    return deduped
      .sort((left, right) => left.materialName.localeCompare(right.materialName))
      .slice(0, 10);
  }, [products, quotationWizard.itemForm.materialName]);

  const quotationWizardMaterialProducts = useMemo(() => {
    const selectedMaterial = normalizeComparableValue(quotationWizard.itemForm.materialName);
    if (!selectedMaterial) return [];
    return (products || []).filter((product) => normalizeComparableValue(product.material_name) === selectedMaterial);
  }, [products, quotationWizard.itemForm.materialName]);

  const quotationWizardVisibleVariantFields = useMemo(() => {
    if (!quotationWizardMaterialProducts.length) return [];

    const visible = [];
    let scopedProducts = [...quotationWizardMaterialProducts];

    quotationWizardVariantFields.forEach((field) => {
      const options = uniqueValues(scopedProducts.map((product) => String(getProductFieldValue(product, field.key) || "").trim()));
      const selectedValue = String(getItemFormVariantValue(quotationWizard.itemForm, field) || "").trim();
      if (options.length > 1 || selectedValue) {
        visible.push({
          ...field,
          options
        });
      }

      if (selectedValue) {
        scopedProducts = scopedProducts.filter((product) => normalizeComparableValue(getProductFieldValue(product, field.key)) === normalizeComparableValue(selectedValue));
      }
    });

    return visible;
  }, [quotationWizardMaterialProducts, quotationWizardVariantFields, quotationWizard.itemForm]);

  const quotationWizardItemRules = getQuotationWizardRules(quotationWizard.itemForm);
  const quotationWizardItemReady = validateQuotationWizardItem(quotationWizard.itemForm);
  const quotationWizardGstMode = Boolean(quotationWizard.customer?.gstEnabled);

  const quotationWizardGrossTotal = useMemo(() => {
    return Number(
      quotationWizard.items.reduce((sum, item) => sum + calculateQuotationWizardItemTotal(item), 0).toFixed(2)
    );
  }, [quotationWizard.items, calculateQuotationWizardItemTotal]);

  const quotationWizardGstAmount = useMemo(() => {
    if (!quotationWizardGstMode) return 0;
    const total = (quotationWizard.items || []).reduce((sum, item) => {
      const lineTotal = calculateQuotationWizardItemTotal(item);
      const itemGstPercent = parsePercentLike(item?.customFields?.gst_percent);
      const lineTax = Number((lineTotal * (itemGstPercent / 100)).toFixed(2));
      return sum + lineTax;
    }, 0);
    return Number(total.toFixed(2));
  }, [quotationWizard.items, quotationWizardGstMode, calculateQuotationWizardItemTotal]);

  const quotationWizardDiscountAmount = quotationWizardGstMode ? 0 : toQuotationWizardAmount(quotationWizard.amounts.discountAmount);
  const quotationWizardAdvanceAmount = toQuotationWizardAmount(quotationWizard.amounts.advanceAmount);
  const quotationWizardTotalAmount = Number((quotationWizardGrossTotal + quotationWizardGstAmount - quotationWizardDiscountAmount).toFixed(2));
  const quotationWizardBalanceAmount = Math.max(
    Number((quotationWizardTotalAmount - quotationWizardAdvanceAmount).toFixed(2)),
    0
  );

  useEffect(() => {
    return () => {
      if (quotationPreviewUrl) {
        URL.revokeObjectURL(quotationPreviewUrl);
      }
    };
  }, [quotationPreviewUrl]);

  function openQuotationWizard(initialState = null) {
    if (!auth?.user?.isPlatformAdmin) {
      setQuotationWizard(initialState || createInitialQuotationWizardState(null));
      if (quotationPreviewUrl) {
        URL.revokeObjectURL(quotationPreviewUrl);
      }
      setQuotationPreviewUrl("");
      setQuotationPreviewError("");
      setQuotationWizardNotice("");
      setQuotationWizardCustomerGstValidation({ status: "idle", gstNumber: "", profile: null, message: "" });
      setQuotationWizardShippingGstValidation({});
      setShowMessageSimulatorModal(true);
      setError("");
    }
  }

  function closeQuotationWizard() {
    if (quotationPreviewUrl) {
      URL.revokeObjectURL(quotationPreviewUrl);
    }
    setQuotationPreviewUrl("");
    setQuotationPreviewError("");
    setQuotationWizard(createInitialQuotationWizardState(null));
    setQuotationWizardSubmitting(false);
    setQuotationWizardNotice("");
    setQuotationWizardCustomerGstValidation({ status: "idle", gstNumber: "", profile: null, message: "" });
    setQuotationWizardShippingGstValidation({});
    setShowMessageSimulatorModal(false);
  }

  function resetQuotationWizardItemForm() {
    setQuotationWizard((prev) => ({
      ...prev,
      editingItemId: null,
      itemForm: createQuotationWizardItem(null)
    }));
  }

  function updateQuotationWizardCustomerField(field, value) {
    setQuotationWizard((prev) => {
      const next = {
        ...prev,
        customer: {
          ...prev.customer,
          [field]: value
        }
      };
      if (field === "gstEnabled" && Boolean(value)) {
        next.amounts = {
          ...next.amounts,
          discountAmount: ""
        };
      }
      return next;
    });
    if (field === "gstNumber") {
      const nextGst = String(value || "").trim().toUpperCase();
      if (String(quotationWizardCustomerGstValidation.gstNumber || "") !== nextGst) {
        setQuotationWizardCustomerGstValidation({ status: "idle", gstNumber: "", profile: null, message: "" });
      }
    }
  }

  function updateQuotationWizardShippingAddress(index, field, value) {
    setQuotationWizard((prev) => ({
      ...prev,
      customer: {
        ...prev.customer,
        shippingAddresses: updateShippingAddressValue(prev.customer.shippingAddresses, index, field, value)
      }
    }));
    if (field === "gstNumber") {
      setQuotationWizardShippingGstValidation((prev) => ({
        ...prev,
        [index]: { status: "idle", message: "" }
      }));
    }
  }

  function addQuotationWizardShippingAddress() {
    setQuotationWizard((prev) => ({
      ...prev,
      customer: {
        ...prev.customer,
        shippingAddresses: [
          ...applyShippingAddressGstReuse(prev.customer.shippingAddresses),
          createEmptyShippingAddress()
        ]
      }
    }));
  }

  function removeQuotationWizardShippingAddress(index) {
    setQuotationWizard((prev) => {
      const nextAddresses = (prev.customer.shippingAddresses || []).filter((_, entryIndex) => entryIndex !== index);
      return {
        ...prev,
        customer: {
          ...prev.customer,
          shippingAddresses: nextAddresses.length ? applyShippingAddressGstReuse(nextAddresses) : [createEmptyShippingAddress()]
        }
      };
    });
  }

  function updateQuotationWizardItemForm(field, value) {
    setQuotationWizardNotice("");
    setQuotationWizard((prev) => ({
      ...prev,
      itemForm: {
        ...prev.itemForm,
        [field]: value
      }
    }));
  }

  function updateQuotationWizardCustomField(fieldKey, value) {
    setQuotationWizardNotice("");
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
    setQuotationWizardNotice("");
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

  function clearResolvedProductState(itemForm, overrides = {}, resetVariantSelections = true) {
    const nextCustomFields = { ...(itemForm.customFields || {}) };
    if (resetVariantSelections) {
      quotationWizardVariantFields.forEach((field) => {
        if (field.kind === "custom") {
          delete nextCustomFields[field.key];
        }
      });
    }

    return {
      ...itemForm,
      productId: "",
      catalogueBasePrice: 0,
      limitRateEdit: false,
      maxDiscountPercent: 0,
      maxDiscountType: "percent",
      color: resetVariantSelections && quotationWizardVariantFields.some((field) => field.key === "color_name") ? "" : itemForm.color,
      thickness: resetVariantSelections && quotationWizardVariantFields.some((field) => field.key === "thickness") ? "" : itemForm.thickness,
      customFields: nextCustomFields,
      ...overrides
    };
  }

  function findMatchingProducts(itemForm) {
    const selectedMaterial = normalizeComparableValue(itemForm.materialName);
    if (!selectedMaterial) return [];

    return (products || []).filter((product) => {
      if (normalizeComparableValue(product.material_name) !== selectedMaterial) return false;

      return quotationWizardVariantFields.every((field) => {
        const selectedValue = normalizeComparableValue(getItemFormVariantValue(itemForm, field));
        if (!selectedValue) return true;
        return normalizeComparableValue(getProductFieldValue(product, field.key)) === selectedValue;
      });
    });
  }

  function applyResolvedProduct(selectedProduct, existingCustomFields = {}, previousItemForm = null) {
    const baseItemForm = createQuotationWizardItem(selectedProduct);
    return {
      ...baseItemForm,
      id: previousItemForm?.id ?? baseItemForm.id,
      category: previousItemForm?.category || baseItemForm.category,
      otherInfo: previousItemForm?.otherInfo ?? baseItemForm.otherInfo,
      ps: previousItemForm?.ps ?? baseItemForm.ps,
      height: previousItemForm?.height ?? baseItemForm.height,
      width: previousItemForm?.width ?? baseItemForm.width,
      unit: previousItemForm?.unit ?? baseItemForm.unit,
      quantity: previousItemForm?.quantity ?? baseItemForm.quantity,
      note: previousItemForm?.note ?? baseItemForm.note,
      customFields: getCatalogueDrivenQuotationCustomFields(
        selectedProduct,
        unsupportedRuntimeQuotationColumns.filter((column) => column.visibleInForm && column.type !== "formula"),
        existingCustomFields
      )
    };
  }

  function handleQuotationWizardMaterialInput(value) {
    setError("");
    setQuotationWizardNotice("");
    setQuotationWizard((prev) => ({
      ...prev,
      itemForm: clearResolvedProductState(prev.itemForm, {
        materialName: value
      })
    }));
  }

  function handleQuotationWizardMaterialSelect(selection) {
    const materialName = typeof selection === "string"
      ? selection
      : String(selection?.materialName || "").trim();
    if (!materialName) return;
    setError("");
    setQuotationWizardNotice("");
    setQuotationWizard((prev) => {
      const nextItemForm = clearResolvedProductState(prev.itemForm, {
        materialName
      });
      const matches = (products || []).filter((product) => normalizeComparableValue(product.material_name) === normalizeComparableValue(materialName));
      if (matches.length === 1) {
        return {
          ...prev,
          itemForm: applyResolvedProduct(matches[0], prev.itemForm.customFields, nextItemForm)
        };
      }
      return {
        ...prev,
        itemForm: nextItemForm
      };
    });
  }

  function handleQuotationWizardVariantSelection(fieldKey, value) {
    const field = quotationWizardVariantFields.find((entry) => entry.key === fieldKey);
    if (!field) return;

    setError("");
    setQuotationWizardNotice("");
    setQuotationWizard((prev) => {
      let nextItemForm = clearResolvedProductState(prev.itemForm, {}, false);
      nextItemForm = setItemFormVariantValue(nextItemForm, field, value);
      const matches = findMatchingProducts(nextItemForm);
      if (matches.length === 1) {
        return {
          ...prev,
          itemForm: applyResolvedProduct(matches[0], nextItemForm.customFields, nextItemForm)
        };
      }
      return {
        ...prev,
        itemForm: nextItemForm
      };
    });
  }

  function buildSecondaryCataloguePayload(itemForm) {
    const normalizedCategory = String(itemForm.category || "Product").trim() || "Product";
    const width = Number(itemForm.width || 0);
    const height = Number(itemForm.height || 0);
    const hasDimensions = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
    const derivedUnitType = hasDimensions ? "SFT" : "COUNT";
    const derivedPricingType = hasDimensions ? "SFT" : "UNIT";
    const supportedCustomKeys = new Set((runtimeCatalogueFields || []).map((field) => field.normalizedKey || field.key));

    const secondaryCustomFields = {};
    (unsupportedRuntimeCatalogueFields || []).forEach((field) => {
      const value = itemForm.customFields?.[field.key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        secondaryCustomFields[field.key] = value;
      }
    });

    Object.entries(itemForm.customFields || {}).forEach(([key, value]) => {
      if (supportedCustomKeys.has(key)) return;
      if (secondaryCustomFields[key] !== undefined) return;
      if (value === undefined || value === null || String(value).trim() === "") return;
      secondaryCustomFields[key] = value;
    });

    return {
      materialName: String(itemForm.materialName || "").trim(),
      category: normalizedCategory,
      thickness: String(itemForm.thickness || "").trim() || null,
      unitType: derivedUnitType,
      basePrice: Number(itemForm.rate || 0),
      sku: buildSecondarySku(itemForm.materialName),
      alwaysAvailable: true,
      materialGroup: null,
      colorName: String(itemForm.color || "").trim() || null,
      psSupported: Boolean(itemForm.ps),
      pricingType: derivedPricingType,
      limitRateEdit: false,
      maxDiscountPercent: 0,
      maxDiscountType: "percent",
      catalogueSource: "secondary",
      customFields: secondaryCustomFields
    };
  }

  async function handleSaveQuotationWizardSecondaryProduct() {
    try {
      setError("");
      setQuotationWizardNotice("");

      if (!String(quotationWizard.itemForm.materialName || "").trim()) {
        throw new Error("Enter the product / service name before saving to the secondary catalogue.");
      }
      if (!String(quotationWizard.itemForm.category || "").trim()) {
        throw new Error("Select the category before saving to the secondary catalogue.");
      }

      const payload = buildSecondaryCataloguePayload(quotationWizard.itemForm);
      const createdProduct = await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const productRows = await apiFetch("/api/products");
      setProducts(productRows);
      setQuotationWizard((prev) => ({
        ...prev,
        itemForm: applyResolvedProduct(createdProduct, prev.itemForm.customFields, prev.itemForm)
      }));
      setQuotationWizardNotice("Saved to the secondary catalogue and selected for this quotation.");
    } catch (err) {
      handleApiError(err);
    }
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
    const rateValidationMessage = getQuotationRateValidationMessage({
      ...quotationWizard.itemForm,
      customFields: effectiveCustomFields
    });

    if (customFieldError) {
      setError(customFieldError);
      return;
    }

    if (rateValidationMessage) {
      setError(rateValidationMessage);
      return;
    }

    const itemToAdd = {
      ...quotationWizard.itemForm,
      customFields: effectiveCustomFields,
      itemDisplayText: buildConfiguredQuotationItemTitle({
        ...quotationWizard.itemForm,
        item_category: quotationWizard.itemForm.category,
        customFields: effectiveCustomFields
      }, itemDisplayConfig),
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    };

    setQuotationWizard((prev) => ({
      ...prev,
      items: prev.editingItemId
        ? prev.items.map((item) => (item.id === prev.editingItemId ? { ...itemToAdd, id: prev.editingItemId } : item))
        : [...prev.items, itemToAdd],
      editingItemId: null,
      itemForm: createQuotationWizardItem(null)
    }));
    setError("");
    setQuotationWizardNotice("");
  }

  function startEditQuotationWizardItem(itemId) {
    const selectedItem = quotationWizard.items.find((item) => item.id === itemId);
    if (!selectedItem) return;
    setQuotationWizardNotice("");
    setQuotationWizard((prev) => ({
      ...prev,
      editingItemId: itemId,
      itemForm: {
        ...selectedItem,
        customFields: {
          ...(selectedItem.customFields || {})
        }
      }
    }));
  }

  function cancelEditQuotationWizardItem() {
    resetQuotationWizardItemForm();
    setQuotationWizardNotice("");
    setError("");
  }

  function handleRemoveQuotationWizardItem(itemId) {
    setQuotationWizard((prev) => {
      const isEditingRemovedItem = prev.editingItemId === itemId;
      return {
        ...prev,
        items: prev.items.filter((item) => item.id !== itemId),
        editingItemId: isEditingRemovedItem ? null : prev.editingItemId,
        itemForm: isEditingRemovedItem ? createQuotationWizardItem(null) : prev.itemForm
      };
    });
  }

  async function handleQuotationWizardNext() {
    if (quotationWizard.step === "customer") {
      if (quotationWizard.customerMode === "existing" && !quotationWizard.selectedCustomerId) {
        setError("Please select a customer before continuing.");
        return;
      }
      if (quotationWizard.customerMode === "new" && !quotationWizard.customer.name.trim()) {
        setError("Please enter customer details before continuing.");
        return;
      }
      if (quotationWizard.customerMode === "new" && String(quotationWizard.customer.gstNumber || "").trim()) {
        try {
          await validateQuotationWizardCustomerGst(quotationWizard.customer.gstNumber, { applyProfile: true });
        } catch (error) {
          handleApiError(error);
          return;
        }
      }
      setQuotationWizard((prev) => ({ ...prev, step: "items" }));
      setError("");
      setQuotationWizardNotice("");
      return;
    }

    if (quotationWizard.step === "items") {
      if (!quotationWizard.items.length) {
        setError("Please add at least one item before continuing.");
        return;
      }
      setQuotationWizard((prev) => ({ ...prev, step: "amounts" }));
      setError("");
      setQuotationWizardNotice("");
    }
  }

  function handleQuotationWizardBack() {
    setError("");
    setQuotationWizardNotice("");
    setQuotationWizard((prev) => ({
      ...prev,
      step: prev.step === "amounts" ? "items" : "customer"
    }));
  }

  async function validateQuotationWizardCustomerGst(rawGstNumber, options = {}) {
    const gstNumber = String(rawGstNumber || "").trim().toUpperCase();
    const applyProfile = options.applyProfile !== false;
    if (!gstNumber) {
      setQuotationWizardCustomerGstValidation({ status: "idle", gstNumber: "", profile: null, message: "" });
      return null;
    }

    setQuotationWizardCustomerGstValidation({ status: "verifying", gstNumber, profile: null, message: "" });
    try {
      const response = await apiFetch("/api/customers/gst/validate", {
        method: "POST",
        body: JSON.stringify({ gstNumber })
      });
      const profile = response.profile || null;
      if (applyProfile && profile) {
        setQuotationWizard((prev) => ({
          ...prev,
          customer: {
            ...prev.customer,
            gstNumber,
            name: profile.legalName || prev.customer.name,
            firmName: profile.tradeName || profile.legalName || prev.customer.firmName,
            address: profile.address || prev.customer.address
          }
        }));
      }
      setQuotationWizardCustomerGstValidation({
        status: "verified",
        gstNumber,
        profile,
        message: "GST verified. Legal name and address auto-filled."
      });
      return profile;
    } catch (error) {
      setQuotationWizardCustomerGstValidation({
        status: "error",
        gstNumber,
        profile: null,
        message: error?.message || "Unable to validate GST number."
      });
      throw error;
    }
  }

  async function validateQuotationWizardShippingGst(index, rawGstNumber) {
    const gstNumber = String(rawGstNumber || "").trim().toUpperCase();
    if (!gstNumber) {
      setQuotationWizardShippingGstValidation((prev) => ({ ...prev, [index]: { status: "idle", message: "" } }));
      return null;
    }
    setQuotationWizardShippingGstValidation((prev) => ({ ...prev, [index]: { status: "verifying", message: "" } }));
    try {
      await apiFetch("/api/customers/gst/validate", {
        method: "POST",
        body: JSON.stringify({ gstNumber })
      });
      setQuotationWizardShippingGstValidation((prev) => ({ ...prev, [index]: { status: "verified", message: "GST verified." } }));
      return true;
    } catch (error) {
      setQuotationWizardShippingGstValidation((prev) => ({
        ...prev,
        [index]: { status: "error", message: error?.message || "Invalid GST number." }
      }));
      throw error;
    }
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
    const response = await fetch(`${baseUrl}/api/quotations/${quotationId}/download?preview=1`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    if (!response.ok) {
      throw new Error("Failed to load quotation preview");
    }

    const blob = await response.blob();
    if (!String(blob.type || "").toLowerCase().includes("pdf")) {
      throw new Error("Preview PDF is unavailable right now");
    }
    return URL.createObjectURL(blob);
  }

  async function downloadQuotationWizardPdf(quotationId = quotationWizard.submittedQuotation?.id, quotationRecord = quotationWizard.submittedQuotation) {
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
    const filename = extractDownloadFilename(response, quotationRecord || { id: quotationId });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleSubmitQuotationWizard() {
    try {
      setQuotationWizardSubmitting(true);
      setError("");
      const normalizedDeliveryType = String(quotationWizard.amounts.deliveryType || "PICKUP").toUpperCase();
      if (normalizedDeliveryType === "DOORSTEP") {
        const hasAddress = String(quotationWizard.amounts.deliveryAddress || "").trim();
        const rawPincode = String(quotationWizard.amounts.deliveryPincode || "").trim();
        const hasPincode = rawPincode;
        if (!hasAddress || !hasPincode) {
          setError("Delivery address and pincode are required for doorstep delivery.");
          setQuotationWizardSubmitting(false);
          return;
        }
        if (!/^\d{6}$/.test(rawPincode)) {
          setError("Delivery pincode must be a 6-digit number.");
          setQuotationWizardSubmitting(false);
          return;
        }
      }
      const isRevision = quotationWizard.mode === "revise" && quotationWizard.quotationId;
      const customerId = isRevision
        ? Number(quotationWizard.selectedCustomerId)
        : await ensureQuotationWizardCustomer();
      const requestPath = isRevision ? `/api/quotations/${quotationWizard.quotationId}/revise` : "/api/quotations";
      const requestMethod = isRevision ? "PATCH" : "POST";
      const response = await apiFetch(requestPath, {
        method: requestMethod,
        body: JSON.stringify({
          customerId,
          customQuotationNumber: String(quotationWizard.amounts.customQuotationNumber || "").trim() || null,
          items: buildQuotationWizardPayloadItems(quotationWizard.items),
          gstPercent: 0,
          gstMode: quotationWizardGstMode,
          transportCharges: 0,
          designCharges: 0,
          discountAmount: quotationWizardDiscountAmount,
          advanceAmount: quotationWizardAdvanceAmount,
          deliveryDate: quotationWizard.amounts.deliveryDate || null,
          referenceRequestId: String(quotationWizard.amounts.referenceRequestId || "").trim() || null,
          balanceAmount: quotationWizardBalanceAmount,
          paymentStatus: quotationWizardAdvanceAmount > 0 && quotationWizardBalanceAmount > 0 ? "partial" : "pending",
          orderStatus: "NEW",
          deliveryType: normalizedDeliveryType,
          deliveryAddress: normalizedDeliveryType === "DOORSTEP" ? String(quotationWizard.amounts.deliveryAddress || "").trim() || null : null,
          deliveryPincode: normalizedDeliveryType === "DOORSTEP" ? String(quotationWizard.amounts.deliveryPincode || "").trim() || null : null,
          sourceChannel: isRevision ? "seller-dashboard-revision" : "seller-dashboard-modal",
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
      setQuotationPreviewError("");

      try {
        const previewUrl = await createQuotationPreviewUrl(response.quotation.id);
        if (quotationPreviewUrl) {
          URL.revokeObjectURL(quotationPreviewUrl);
        }
        setQuotationPreviewUrl(previewUrl);
      } catch (previewError) {
        setQuotationPreviewUrl("");
        setQuotationPreviewError(previewError?.message || "Preview could not be loaded. You can still download the PDF.");
      }

      await Promise.all([
        (async () => {
          try {
            await loadDashboardData(dashboardRange);
          } catch {
            // Keep the quotation visible even if dashboard refresh is delayed.
          }
        })(),
        (async () => {
          try {
            await refreshQuotationList?.();
          } catch {
            // Keep the quotation visible even if list refresh is delayed.
          }
        })(),
        (async () => {
          if (!response?.quotation?.id || typeof handleOpenOrderDetails !== "function") return;
          try {
            await handleOpenOrderDetails(response.quotation.id);
          } catch {
            // Keep the wizard flow usable even if the detail refresh fails.
          }
        })()
      ]);

      if (Array.isArray(response.inventoryWarnings) && response.inventoryWarnings.length > 0) {
        setError(`${isRevision ? "Quotation revised successfully." : "Quotation created successfully."} ${response.inventoryWarnings.join(" ")}`);
      } else {
        setError(isRevision ? "Quotation revised successfully." : "Quotation created successfully.");
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setQuotationWizardSubmitting(false);
    }
  }

  return {
    showMessageSimulatorModal,
    quotationWizard,
    setQuotationWizard,
    quotationWizardSubmitting,
    quotationPreviewUrl,
    quotationPreviewError,
    quotationWizardNotice,
    quotationWizardCustomerGstValidation,
    quotationWizardShippingGstValidation,
    quotationWizardCustomerMatches,
    quotationWizardSelectedProduct,
    quotationWizardMaterialSuggestions,
    quotationWizardVisibleVariantFields,
    quotationWizardItemRules,
    quotationWizardItemReady,
    quotationWizardGrossTotal,
    quotationWizardGstAmount,
    quotationWizardTotalAmount,
    quotationWizardDiscountAmount,
    quotationWizardAdvanceAmount,
    quotationWizardBalanceAmount,
    quotationWizardGstMode,
    showQuotationWizardNotice: setQuotationWizardNotice,
    openQuotationWizard,
    closeQuotationWizard,
    updateQuotationWizardCustomerField,
    validateQuotationWizardCustomerGst,
    validateQuotationWizardShippingGst,
    updateQuotationWizardShippingAddress,
    addQuotationWizardShippingAddress,
    removeQuotationWizardShippingAddress,
    updateQuotationWizardItemForm,
    updateQuotationWizardCustomField,
    handleQuotationWizardMaterialInput,
    handleQuotationWizardMaterialSelect,
    handleQuotationWizardVariantSelection,
    handleQuotationWizardProductChange,
    handleSaveQuotationWizardSecondaryProduct,
    handleAddQuotationWizardItem,
    startEditQuotationWizardItem,
    cancelEditQuotationWizardItem,
    handleRemoveQuotationWizardItem,
    handleQuotationWizardNext,
    handleQuotationWizardBack,
    handleSubmitQuotationWizard,
    downloadQuotationWizardPdf
  };
}
