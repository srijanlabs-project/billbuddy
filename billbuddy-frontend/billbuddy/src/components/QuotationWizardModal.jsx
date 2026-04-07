import LimitedRichTextEditor from "./LimitedRichTextEditor";
import { richTextToPlainText } from "../utils/richText";

export default function QuotationWizardModal(props) {
  const {
    showMessageSimulatorModal,
    closeQuotationWizard,
    clearQuotationWizardDraft,
    quotationWizard,
    setQuotationWizard,
    quotationWizardCustomerMatches,
    updateQuotationWizardCustomerField,
    updateQuotationWizardShippingAddress,
    addQuotationWizardShippingAddress,
    removeQuotationWizardShippingAddress,
    runtimeSellerConfiguration,
    runtimeQuotationColumns,
    quotationWizardItemRules,
    updateQuotationWizardItemForm,
    unsupportedRuntimeQuotationColumns,
    getProductConfigurationFieldValue,
    quotationWizardSelectedProduct,
    updateQuotationWizardCustomField,
    handleAddQuotationWizardItem,
    startEditQuotationWizardItem,
    cancelEditQuotationWizardItem,
    quotationWizardItemReady,
    formatCurrency,
    calculateQuotationWizardItemTotal,
    handleRemoveQuotationWizardItem,
    getQuotationItemTitle,
    getQuotationItemQuantityValue,
    getQuotationItemRateValue,
    getQuotationItemTotalValue,
    quotationWizardGrossTotal,
    quotationWizardGstAmount,
    quotationWizardTotalAmount,
    quotationWizardDiscountAmount,
    quotationWizardAdvanceAmount,
    quotationWizardBalanceAmount,
    quotationWizardGstMode,
    showQuotationWizardNotice,
    formatDateIST,
    quotationWizardSubmitting,
    error,
    quotationWizardNotice,
    quotationWizardCustomerGstValidation,
    quotationWizardShippingGstValidation,
    quotationWizardMaterialSuggestions,
    quotationWizardVisibleVariantFields,
    validateQuotationWizardCustomerGst,
    validateQuotationWizardShippingGst,
    handleQuotationWizardMaterialInput,
    handleQuotationWizardMaterialSelect,
    handleQuotationWizardVariantSelection,
    handleSaveQuotationWizardSecondaryProduct,
    handleSubmitQuotationWizard,
    handleQuotationWizardNext,
    handleQuotationWizardBack,
    quotationPreviewUrl,
    quotationPreviewError,
    quotationTemplate,
    downloadQuotationWizardPdf,
    formatQuotationLabel,
    handleOpenOrderDetails
  } = props;

  if (!showMessageSimulatorModal) return null;

  const wizardStepHelp = {
    customer: {
      title: "Customer Step",
      text: "Choose an existing customer or create a new one here. Shipping addresses and GST can be captured before you move to item entry."
    },
    items: {
      title: "Item Step",
      text: "Search material or service first, then complete any variant selectors like colour, thickness, or size. If the item is missing, save it to secondary catalogue directly from this step."
    },
    amounts: {
      title: "Amounts Step",
      text: "Review totals, discount, and advance here. If a product has rate-edit protection, the allowed minimum rate check has already been enforced before item add."
    },
    preview: {
      title: "Preview Step",
      text: "Use this step to confirm the quotation layout quickly before final submit. Final PDF download will still use the seller’s selected template."
    }
  };

  const activeWizardHelp = wizardStepHelp[quotationWizard.step] || wizardStepHelp.customer;
  const isRevision = quotationWizard.mode === "revise";
  const isEditingItem = Boolean(quotationWizard.editingItemId);
  const showItemGstField = Boolean(quotationWizard.customer?.gstEnabled);
  const hasConfiguredItemGstField =
    runtimeQuotationColumns.some((column) => String(column.normalizedKey || column.key || "").trim().toLowerCase() === "gst_percent")
    || unsupportedRuntimeQuotationColumns.some((column) => String(column.key || "").trim().toLowerCase() === "gst_percent");
  const isCustomerGstLocked = quotationWizard.customerMode === "new"
    && quotationWizardCustomerGstValidation?.status === "verified"
    && String(quotationWizardCustomerGstValidation?.gstNumber || "") === String(quotationWizard.customer.gstNumber || "").trim().toUpperCase();
  const normalizeCategoryToken = (value) => String(value || "").trim().toLowerCase();
  const currentItemCategory = normalizeCategoryToken(quotationWizard.itemForm.category);
  const isColumnVisibleInForm = (column) => Boolean(column?.visibleInForm ?? column?.visible_in_form);
  const isColumnVisibleForCurrentCategory = (column) => {
    const mappedCategories = Array.isArray(column?.categoryVisibility)
      ? column.categoryVisibility
      : (Array.isArray(column?.category_visibility) ? column.category_visibility : []);
    if (!mappedCategories.length) return true;
    if (!currentItemCategory) return true;
    return mappedCategories.some((entry) => normalizeCategoryToken(entry) === currentItemCategory);
  };
  const isNonFormulaColumn = (column) => String(column?.type || column?.column_type || "").toLowerCase() !== "formula";
  const renderAutosuggestInput = ({ id, value, onChange, options, placeholder, disabled = false, className = "" }) => {
    const normalizedOptions = Array.from(
      new Set((Array.isArray(options) ? options : [])
        .map((option) => String(option || "").trim())
        .filter(Boolean))
    );
    return (
      <>
        <input
          type="text"
          list={id}
          className={className}
          value={value ?? ""}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
        />
        <datalist id={id}>
          {normalizedOptions.map((option) => (
            <option key={`${id}-${option}`} value={option} />
          ))}
        </datalist>
      </>
    );
  };

  return (
    <div className="modal-overlay" onClick={(event) => event.stopPropagation()}>
      <div className="modal-card modal-wide glass-panel quotation-wizard-modal" onClick={(event) => event.stopPropagation()}>
        <div className="section-head">
          <h3>{isRevision ? "Revise Quotation" : "Create Quotation"}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              className="link-btn"
              style={{ fontSize: "0.82rem" }}
              onClick={() => clearQuotationWizardDraft?.()}
            >
              Clear saved draft
            </button>
            <button type="button" className="ghost-btn" onClick={closeQuotationWizard}>Close</button>
          </div>
        </div>

        <div className="quotation-wizard-steps">
          {["customer", "items", "amounts", "terms", "preview"].map((step) => (
            <div key={step} className={`quotation-wizard-step ${quotationWizard.step === step ? "active" : ""}`}>
              {step.toUpperCase()}
            </div>
          ))}
        </div>
        {quotationWizard.step !== "terms" ? (
          <div className="context-help-strip">
            <div className="context-help-card">
              <strong>{activeWizardHelp.title}</strong>
              <p>{activeWizardHelp.text}</p>
            </div>
          </div>
        ) : null}
        {error && <div className="notice error">{error}</div>}
        {quotationWizardNotice && <div className="notice success">{quotationWizardNotice}</div>}

        {quotationWizard.step === "customer" && (
          <div className="quotation-wizard-body">
            {quotationWizard.lockedCustomer ? (
              <div className="preview-grid">
                <div className="preview-pane">
                  <h5>Locked Customer</h5>
                  <span>Name: {quotationWizard.customer.name || "-"}</span>
                  <span>Firm: {quotationWizard.customer.firmName || "-"}</span>
                  <span>Mobile: {quotationWizard.customer.mobile || "-"}</span>
                  <span>Email: {quotationWizard.customer.email || "-"}</span>
                  <span>GST: {quotationWizard.customer.gstNumber || "-"}</span>
                </div>
                <div className="preview-pane">
                  <h5>Billing Details</h5>
                  <span>Address: {quotationWizard.customer.address || "-"}</span>
                  <span>Monthly Billing: {quotationWizard.customer.monthlyBilling ? "Yes" : "No"}</span>
                  <span>Shipping Addresses: {(quotationWizard.customer.shippingAddresses || []).length}</span>
                  <span className="muted">Customer editing is disabled during quotation revision.</span>
                </div>
              </div>
            ) : (
              <>
                <div className="quotation-wizard-mode-switch">
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
                    New Customer
                  </button>
                </div>

                {quotationWizard.customerMode === "existing" ? (
              <div className="quotation-wizard-customer-search">
                <input
                  placeholder="Search customer by name, firm, mobile, or email"
                  value={quotationWizard.customerSearch}
                  onChange={(e) => setQuotationWizard((prev) => ({ ...prev, customerSearch: e.target.value }))}
                />
                <div className="quotation-customer-results">
                  {quotationWizard.customerSearch.trim().length < 2 ? (
                    <p className="muted">Type at least 2 characters to search.</p>
                  ) : quotationWizardCustomerMatches.length === 0 ? (
                    <p className="muted">No matching customers found.</p>
                  ) : (
                    quotationWizardCustomerMatches.map((customer) => (
                      <button
                        type="button"
                        key={customer.id}
                        className={`quotation-customer-card ${String(quotationWizard.selectedCustomerId) === String(customer.id) ? "selected" : ""}`}
                        onClick={() =>
                          setQuotationWizard((prev) => ({
                            ...prev,
                            selectedCustomerId: String(customer.id),
                            customerSearch: customer.firm_name || customer.name || customer.mobile || "",
                            customer: {
                              ...prev.customer,
                              name: customer.name || prev.customer.name,
                              firmName: customer.firm_name || customer.name || prev.customer.firmName,
                              mobile: customer.mobile || prev.customer.mobile,
                              email: customer.email || prev.customer.email,
                              address: customer.address || prev.customer.address,
                              gstNumber: customer.gst_number || "",
                              gstEnabled: Boolean(customer.gst_number)
                            }
                          }))
                        }
                      >
                        <span className="quotation-suggest-main">{customer.firm_name || customer.name || "-"}</span>
                        <span className="quotation-suggest-meta">{customer.name || "-"}</span>
                        <span className="quotation-suggest-meta">{customer.mobile || "-"}</span>
                      </button>
                    ))
                  )}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(quotationWizard.customer.gstEnabled)}
                    onChange={(e) => updateQuotationWizardCustomerField("gstEnabled", e.target.checked)}
                    style={{ width: "auto" }}
                  />
                  GST quotation
                </label>
              </div>
            ) : (
              <div className="quotation-wizard-grid">
                <input placeholder="Customer name" value={quotationWizard.customer.name} onChange={(e) => updateQuotationWizardCustomerField("name", e.target.value)} disabled={isCustomerGstLocked} />
                <input placeholder="Firm name" value={quotationWizard.customer.firmName} onChange={(e) => updateQuotationWizardCustomerField("firmName", e.target.value)} disabled={isCustomerGstLocked} />
                <input placeholder="Mobile" value={quotationWizard.customer.mobile} onChange={(e) => updateQuotationWizardCustomerField("mobile", e.target.value)} />
                <input placeholder="Email" type="email" value={quotationWizard.customer.email} onChange={(e) => updateQuotationWizardCustomerField("email", e.target.value)} />
                <textarea className="wizard-full" rows={3} placeholder="Address" value={quotationWizard.customer.address} onChange={(e) => updateQuotationWizardCustomerField("address", e.target.value)} disabled={isCustomerGstLocked} />
                <div className="wizard-full" style={{ display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      placeholder="Customer GST Number (optional)"
                      value={quotationWizard.customer.gstNumber}
                      onChange={(e) => updateQuotationWizardCustomerField("gstNumber", e.target.value.toUpperCase())}
                      onBlur={async () => {
                        const gstNumber = String(quotationWizard.customer.gstNumber || "").trim();
                        if (!gstNumber) return;
                        try {
                          await validateQuotationWizardCustomerGst(gstNumber, { applyProfile: true });
                        } catch {
                          // Error is surfaced through the current wizard error state.
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={async () => {
                        const gstNumber = String(quotationWizard.customer.gstNumber || "").trim();
                        if (!gstNumber) return;
                        try {
                          await validateQuotationWizardCustomerGst(gstNumber, { applyProfile: true });
                        } catch {
                          // Error is surfaced through the current wizard error state.
                        }
                      }}
                      disabled={quotationWizardCustomerGstValidation?.status === "verifying" || !String(quotationWizard.customer.gstNumber || "").trim()}
                    >
                      {quotationWizardCustomerGstValidation?.status === "verifying" ? "Verifying..." : "Verify GST"}
                    </button>
                  </div>
                  {quotationWizardCustomerGstValidation?.message ? (
                    <small style={{ color: quotationWizardCustomerGstValidation.status === "error" ? "#b42318" : "var(--muted)" }}>
                      {quotationWizardCustomerGstValidation.message}
                    </small>
                  ) : null}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(quotationWizard.customer.gstEnabled)}
                    onChange={(e) => updateQuotationWizardCustomerField("gstEnabled", e.target.checked)}
                    style={{ width: "auto" }}
                  />
                  GST quotation
                </label>
                <div className="wizard-full customer-shipping-section wizard-shipping-section">
                  <div className="customer-shipping-head">
                    <div>
                      <h4>Shipping Addresses</h4>
                      <p>Same-state GST will be reused automatically if one warehouse already has it.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={addQuotationWizardShippingAddress}>Add Shipping Address</button>
                  </div>
                  <div className="customer-shipping-list">
                    {(quotationWizard.customer.shippingAddresses || []).map((entry, index) => (
                      <div key={`wizard-shipping-${index}`} className="customer-shipping-card">
                        <div className="customer-shipping-card-head">
                          <strong>Address {index + 1}</strong>
                          {(quotationWizard.customer.shippingAddresses || []).length > 1 ? (
                            <button type="button" className="text-button" onClick={() => removeQuotationWizardShippingAddress(index)}>Remove</button>
                          ) : null}
                        </div>
                        <div className="quotation-wizard-grid">
                          <input placeholder="Warehouse / label" value={entry.label || ""} onChange={(e) => updateQuotationWizardShippingAddress(index, "label", e.target.value)} />
                          <input placeholder="State" value={entry.state || ""} onChange={(e) => updateQuotationWizardShippingAddress(index, "state", e.target.value)} />
                          <input placeholder="Pincode" value={entry.pincode || ""} onChange={(e) => updateQuotationWizardShippingAddress(index, "pincode", e.target.value)} />
                          <div style={{ display: "grid", gap: "6px" }}>
                            <input
                              placeholder="Warehouse GST Number (optional)"
                              value={entry.gstNumber || ""}
                              onChange={(e) => updateQuotationWizardShippingAddress(index, "gstNumber", e.target.value.toUpperCase())}
                              onBlur={async () => {
                                const gstNumber = String(entry.gstNumber || "").trim();
                                if (!gstNumber) return;
                                try {
                                  await validateQuotationWizardShippingGst(index, gstNumber);
                                } catch {
                                  // Message shown inline.
                                }
                              }}
                            />
                            {quotationWizardShippingGstValidation?.[index]?.message ? (
                              <small style={{ color: quotationWizardShippingGstValidation[index]?.status === "error" ? "#b42318" : "var(--muted)" }}>
                                {quotationWizardShippingGstValidation[index].message}
                              </small>
                            ) : null}
                          </div>
                          <textarea className="wizard-full" rows={2} placeholder="Shipping address" value={entry.address || ""} onChange={(e) => updateQuotationWizardShippingAddress(index, "address", e.target.value)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input type="checkbox" checked={quotationWizard.customer.monthlyBilling} onChange={(e) => updateQuotationWizardCustomerField("monthlyBilling", e.target.checked)} style={{ width: "auto" }} />
                  Monthly Billing
                </label>
              </div>
                )}
              </>
            )}
          </div>
        )}

        {quotationWizard.step === "items" && (
          <div className="quotation-wizard-body">
            <div className="quotation-wizard-grid three quotation-item-form-grid">
              <div className="wizard-material-picker wizard-full">
                <label className="wizard-picker-label">Product / Service</label>
                <input
                  type="text"
                  placeholder="Search or type material / service name"
                  value={quotationWizard.itemForm.materialName}
                  onChange={(e) => handleQuotationWizardMaterialInput(e.target.value)}
                />
                {quotationWizard.itemForm.materialName.trim().length > 0 && quotationWizard.itemForm.materialName.trim().length < 2 ? (
                  <p className="muted">Type at least 2 characters to see material suggestions.</p>
                ) : null}
                {quotationWizardMaterialSuggestions.length > 0 && quotationWizard.itemForm.materialName.trim() ? (
                  <div className="wizard-suggestion-list">
                    {quotationWizardMaterialSuggestions.map((suggestion) => (
                      <button
                        type="button"
                        key={`${suggestion.materialName}-${suggestion.source}`}
                        className={`wizard-suggestion-row ${quotationWizard.itemForm.materialName === suggestion.materialName ? "active" : ""}`}
                        onClick={() => handleQuotationWizardMaterialSelect(suggestion)}
                      >
                        <span className="quotation-suggest-main">{suggestion.materialName}</span>
                        <span className="quotation-suggest-meta">
                          {suggestion.source === "secondary" ? "Secondary Catalogue" : "Main Catalogue"}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {quotationWizardSelectedProduct ? (
                  <div className="wizard-selection-meta">
                    <span className="badge success">
                      {quotationWizard.itemForm.catalogueSource === "secondary" ? "Secondary Catalogue" : "Catalogue Match"}
                    </span>
                    {quotationWizardSelectedProduct.sku ? <span className="muted">SKU: {quotationWizardSelectedProduct.sku}</span> : null}
                  </div>
                ) : (
                  <div className="wizard-selection-meta">
                    <span className="muted">No exact catalogue match selected yet. You can continue manually or save this as a secondary catalogue item.</span>
                  </div>
                )}
              </div>

              {quotationWizardVisibleVariantFields.map((field) => {
                const value = field.kind === "supported"
                  ? quotationWizard.itemForm[field.formKey] || ""
                  : quotationWizard.itemForm.customFields?.[field.key] || "";
                return (
                  <div key={`variant-${field.key}`}>
                    {renderAutosuggestInput({
                      id: `quotation-variant-${field.key}`,
                      value,
                      onChange: (e) => handleQuotationWizardVariantSelection(field.key, e.target.value),
                      options: field.options,
                      placeholder: `Select ${field.label}`
                    })}
                  </div>
                );
              })}

              {runtimeSellerConfiguration?.modules?.quotationProductSelector !== false &&
                runtimeQuotationColumns
                  .filter((column) => isColumnVisibleInForm(column) && isColumnVisibleForCurrentCategory(column))
                  .map((column) => {
                    const normalizedKey = column.normalizedKey || column.key;
                    const normalizedType = String(column.type || "").toLowerCase();
                    const meta = column.meta || {};
                    if (normalizedKey === "material_name") return null;
                    if (quotationWizardVisibleVariantFields.some((field) => field.key === normalizedKey)) return null;

                    if (normalizedKey === "ps" && normalizedType === "dropdown") {
                      return (
                        <div key={column.id} className="wizard-full">
                          {renderAutosuggestInput({
                            id: `quotation-ps-${column.id}`,
                            className: "wizard-full",
                            value: quotationWizard.itemForm.customFields?.[column.key] ?? "",
                            onChange: (e) => updateQuotationWizardCustomField(column.key, e.target.value),
                            options: column.options || [],
                            placeholder: `Select ${column.label}`
                          })}
                        </div>
                      );
                    }

                    if (normalizedType === "checkbox" || (!normalizedType && meta.inputType === "checkbox")) {
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
                        <div key={column.id}>
                          {renderAutosuggestInput({
                            id: `quotation-category-${column.id}`,
                            value: quotationWizard.itemForm.category,
                            onChange: (e) => updateQuotationWizardItemForm("category", e.target.value),
                            options: Array.isArray(quotationCategoryOptions) ? quotationCategoryOptions : [],
                            placeholder: column.label
                          })}
                        </div>
                      );
                    }

                    if (meta.inputType === "unit-select") {
                      return (
                        <div key={column.id}>
                          {renderAutosuggestInput({
                            id: `quotation-unit-${column.id}`,
                            value: quotationWizard.itemForm.unit,
                            onChange: (e) => updateQuotationWizardItemForm("unit", e.target.value),
                            options: ["mm", "in", "ft", "sft", "nos"],
                            placeholder: column.label
                          })}
                        </div>
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
                .filter((column) => isColumnVisibleInForm(column) && isNonFormulaColumn(column) && isColumnVisibleForCurrentCategory(column))
                .map((column) => {
                  if (quotationWizardVisibleVariantFields.some((field) => field.key === column.key)) {
                    return null;
                  }
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
                      <div
                        key={column.id}
                        className="wizard-full"
                      >
                        {renderAutosuggestInput({
                          id: `quotation-custom-${column.id}`,
                          className: "wizard-full",
                          value: value ?? "",
                          onChange: (e) => updateQuotationWizardCustomField(column.key, e.target.value),
                          options: dropdownOptions,
                          placeholder: `Select ${column.label}`,
                          disabled: isBoundToCatalogue
                        })}
                      </div>
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

              {showItemGstField && !hasConfiguredItemGstField ? (
                <div>
                  {renderAutosuggestInput({
                    id: "quotation-item-gst-percent",
                    value: quotationWizard.itemForm.customFields?.gst_percent ?? "",
                    onChange: (e) => updateQuotationWizardCustomField("gst_percent", e.target.value),
                    options: ["0", "5", "18"],
                    placeholder: "GST %"
                  })}
                  <small className="muted">Type any % if it is not in the quick list.</small>
                </div>
              ) : null}
            </div>

            <div className="quotation-wizard-inline-actions">
              {!quotationWizardSelectedProduct && quotationWizard.itemForm.materialName.trim() ? (
                <button type="button" className="ghost-btn" onClick={handleSaveQuotationWizardSecondaryProduct}>
                  Save To Secondary Catalogue
                </button>
              ) : null}
              <button type="button" onClick={handleAddQuotationWizardItem} disabled={!quotationWizardItemReady}>
                {isEditingItem ? "Update Item" : "Add Item"}
              </button>
              {isEditingItem ? (
                <button type="button" className="ghost-btn" onClick={cancelEditQuotationWizardItem}>Cancel Item Edit</button>
              ) : null}
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
                          <button
                            type="button"
                            className="ghost-btn quotation-item-action-btn"
                            onClick={() => startEditQuotationWizardItem(item.id)}
                            aria-label="Edit item"
                            title="Edit item"
                          >
                            <span className="quotation-item-action-icon" aria-hidden="true">{"\u270E"}</span>
                            <span className="quotation-item-action-label">Edit item</span>
                          </button>
                          <button
                            type="button"
                            className="ghost-btn quotation-item-action-btn quotation-item-action-btn-danger"
                            onClick={() => handleRemoveQuotationWizardItem(item.id)}
                            aria-label="Remove item"
                            title="Remove item"
                          >
                            <span className="quotation-item-action-icon" aria-hidden="true">{"\u2715"}</span>
                            <span className="quotation-item-action-label">Remove item</span>
                          </button>
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
              <input
                placeholder="Discount Amount"
                type="number"
                min="0"
                value={quotationWizardGstMode ? "" : quotationWizard.amounts.discountAmount}
                readOnly={quotationWizardGstMode}
                onFocus={() => {
                  if (quotationWizardGstMode) {
                    showQuotationWizardNotice?.("Group discount is not applicable in case of GST quotation.");
                  }
                }}
                onChange={(e) => {
                  if (quotationWizardGstMode) return;
                  setQuotationWizard((prev) => ({ ...prev, amounts: { ...prev.amounts, discountAmount: e.target.value } }));
                }}
              />
              <input placeholder="Advance Amount" type="number" min="0" value={quotationWizard.amounts.advanceAmount} onChange={(e) => setQuotationWizard((prev) => ({ ...prev, amounts: { ...prev.amounts, advanceAmount: e.target.value } }))} />
              <input placeholder="Custom Quotation Number" type="text" maxLength="120" value={quotationWizard.amounts.customQuotationNumber || ""} onChange={(e) => setQuotationWizard((prev) => ({ ...prev, amounts: { ...prev.amounts, customQuotationNumber: e.target.value } }))} />
              <input placeholder="Reference Request ID" type="text" maxLength="120" value={quotationWizard.amounts.referenceRequestId || ""} onChange={(e) => setQuotationWizard((prev) => ({ ...prev, amounts: { ...prev.amounts, referenceRequestId: e.target.value } }))} />
              <label>
                <span>Delivery Type</span>
                <select
                  value={quotationWizard.amounts.deliveryType || "PICKUP"}
                  onChange={(e) => setQuotationWizard((prev) => ({ ...prev, amounts: { ...prev.amounts, deliveryType: e.target.value } }))}
                >
                  <option value="PICKUP">Pickup</option>
                  <option value="DOORSTEP">Doorstep</option>
                </select>
                <small className="muted">Address and pincode are required for doorstep delivery.</small>
              </label>
              <label className="wizard-full">
                <span className="muted">Delivery Date</span>
                <input type="date" value={quotationWizard.amounts.deliveryDate || ""} onChange={(e) => setQuotationWizard((prev) => ({ ...prev, amounts: { ...prev.amounts, deliveryDate: e.target.value } }))} />
              </label>
              {String(quotationWizard.amounts.deliveryType || "PICKUP") === "DOORSTEP" && (
                <>
                  <input
                    placeholder="Delivery Address"
                    value={quotationWizard.amounts.deliveryAddress || ""}
                    onChange={(e) => setQuotationWizard((prev) => ({ ...prev, amounts: { ...prev.amounts, deliveryAddress: e.target.value } }))}
                  />
                  <input
                    placeholder="Delivery Pincode"
                    value={quotationWizard.amounts.deliveryPincode || ""}
                    onChange={(e) => setQuotationWizard((prev) => ({ ...prev, amounts: { ...prev.amounts, deliveryPincode: e.target.value } }))}
                  />
                </>
              )}
            </div>
            <div className="quotation-wizard-summary-grid">
              <div className="preview-pane">
                <h5>Summary</h5>
                <span>Items: {quotationWizard.items.length}</span>
                <span>Sub Total: {formatCurrency(quotationWizardGrossTotal)}</span>
                {quotationWizardDiscountAmount > 0 ? <span>-Discount: {formatCurrency(quotationWizardDiscountAmount)}</span> : null}
                {quotationWizardGstAmount > 0 ? <span>GST: {formatCurrency(quotationWizardGstAmount)}</span> : null}
                <span>Total Amount: {formatCurrency(quotationWizardTotalAmount)}</span>
                {quotationWizardAdvanceAmount > 0 ? <span>Advance Amount: {formatCurrency(quotationWizardAdvanceAmount)}</span> : null}
                <span>Custom Quotation Number: {quotationWizard.amounts.customQuotationNumber || "-"}</span>
                <span>Reference Request ID: {quotationWizard.amounts.referenceRequestId || "-"}</span>
                <span>Delivery Type: {quotationWizard.amounts.deliveryType || "PICKUP"}</span>
                {String(quotationWizard.amounts.deliveryType || "PICKUP") === "DOORSTEP" && (
                  <>
                    <span>Delivery Address: {quotationWizard.amounts.deliveryAddress || "-"}</span>
                    <span>Delivery Pincode: {quotationWizard.amounts.deliveryPincode || "-"}</span>
                  </>
                )}
                <span>Delivery Date: {formatDateIST(quotationWizard.amounts.deliveryDate)}</span>
                <span>Balance: {formatCurrency(quotationWizardBalanceAmount)}</span>
              </div>
            </div>
          </div>
        )}

        {quotationWizard.step === "terms" && (
          <div className="quotation-wizard-body">
            <div className="quotation-rich-text-stack">
              <LimitedRichTextEditor
                label="Terms & Conditions"
                value={quotationWizard.amounts.termsRichText}
                plainFallback={quotationTemplate?.terms_rich_text || quotationTemplate?.terms_text || ""}
                placeholder="Add quotation terms and conditions"
                onChange={(nextValue) => setQuotationWizard((prev) => ({
                  ...prev,
                  amounts: {
                    ...prev.amounts,
                    termsRichText: nextValue,
                    termsText: richTextToPlainText(nextValue)
                  }
                }))}
              />
              <LimitedRichTextEditor
                label="Notes"
                value={quotationWizard.amounts.notesRichText}
                plainFallback={quotationTemplate?.notes_rich_text || quotationTemplate?.notes_text || ""}
                placeholder="Add quotation notes"
                onChange={(nextValue) => setQuotationWizard((prev) => ({
                  ...prev,
                  amounts: {
                    ...prev.amounts,
                    notesRichText: nextValue,
                    notesText: richTextToPlainText(nextValue)
                  }
                }))}
              />
            </div>
          </div>
        )}

        {quotationWizard.step === "preview" && (
          <div className="quotation-wizard-body quotation-preview-screen">
            <div className="quotation-preview-header">
              <div>
                <h4>{formatQuotationLabel(quotationWizard.submittedQuotation)}</h4>
                <p className="muted">{isRevision ? "Quotation revised successfully." : "Quotation created successfully."} Full document preview is shown below.</p>
              </div>
              <div className="quotation-wizard-inline-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => downloadQuotationWizardPdf(quotationWizard.submittedQuotation?.id, quotationWizard.submittedQuotation)}
                >
                  Download PDF
                </button>
                <button type="button" className="ghost-btn" onClick={() => quotationWizard.submittedQuotation?.id && handleOpenOrderDetails(quotationWizard.submittedQuotation.id)}>Open Quotation Details</button>
                <button type="button" className="ghost-btn" onClick={closeQuotationWizard}>Close</button>
              </div>
            </div>
            {quotationPreviewUrl ? (
              <iframe title="Quotation Preview" src={`${quotationPreviewUrl}#toolbar=0&navpanes=0`} className="quotation-preview-frame" />
            ) : quotationPreviewError ? (
              <div className="notice error">{quotationPreviewError}</div>
            ) : (
              <p className="muted">Loading quotation preview...</p>
            )}
          </div>
        )}

        {quotationWizard.step !== "preview" && (
          <div className="quotation-wizard-footer">
            <button type="button" className="ghost-btn quotation-wizard-footer-secondary" onClick={quotationWizard.step === "customer" ? closeQuotationWizard : handleQuotationWizardBack}>
              {quotationWizard.step === "customer" ? "Cancel" : "Back"}
            </button>
            {quotationWizard.step === "terms" ? (
              <button type="button" className="quotation-wizard-footer-primary" onClick={handleSubmitQuotationWizard} disabled={quotationWizardSubmitting || !quotationWizard.items.length}>
                {quotationWizardSubmitting ? "Submitting..." : (isRevision ? "Save New Version" : "Submit Quotation")}
              </button>
            ) : (
              <button type="button" className="quotation-wizard-footer-primary" onClick={handleQuotationWizardNext}>
                Next
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
