import { useState } from "react";

export default function useSellerConfigurationStudio({
  isPlatformAdmin,
  seller,
  setActiveModule,
  createDefaultSellerConfiguration,
  mapSellerConfigurationResponse,
  apiFetch,
  handleApiError,
  setCurrentSellerConfiguration,
  setError,
  parseOptionsInput
}) {
  const [selectedSellerConfigSeller, setSelectedSellerConfigSeller] = useState(null);
  const [sellerConfigTab, setSellerConfigTab] = useState("dashboard");
  const [sellerConfigPreviewTab, setSellerConfigPreviewTab] = useState("product-form");
  const [sellerConfigurations, setSellerConfigurations] = useState({});
  const [sellerConfigLoading, setSellerConfigLoading] = useState(false);
  const [sellerConfigSaving, setSellerConfigSaving] = useState(false);
  const [sellerConfigPublishing, setSellerConfigPublishing] = useState(false);

  const configurationStudioSeller = isPlatformAdmin ? selectedSellerConfigSeller : seller;
  const activeSellerConfiguration = configurationStudioSeller ? getSellerConfiguration(configurationStudioSeller) : null;

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
          itemDisplayConfig: activeSellerConfiguration.itemDisplayConfig,
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

  function updateItemDisplayConfig(updater) {
    if (!configurationStudioSeller?.id) return;
    updateSellerConfiguration(configurationStudioSeller.id, (current) => ({
      ...current,
      itemDisplayConfig: typeof updater === "function"
        ? updater(current.itemDisplayConfig || { defaultPattern: "", categoryRules: [] })
        : updater
    }));
  }

  return {
    selectedSellerConfigSeller,
    setSelectedSellerConfigSeller,
    sellerConfigTab,
    setSellerConfigTab,
    sellerConfigPreviewTab,
    setSellerConfigPreviewTab,
    sellerConfigLoading,
    sellerConfigSaving,
    sellerConfigPublishing,
    configurationStudioSeller,
    activeSellerConfiguration,
    openSellerConfigurationStudio,
    closeSellerConfigurationStudio,
    saveSellerConfigurationDraft,
    publishSellerConfiguration,
    addCatalogueField,
    updateCatalogueField,
    commitCatalogueFieldOptions,
    removeCatalogueField,
    addQuotationColumn,
    updateQuotationColumn,
    commitQuotationColumnOptions,
    removeQuotationColumn,
    updateSellerConfigurationModule,
    updateItemDisplayConfig
  };
}
