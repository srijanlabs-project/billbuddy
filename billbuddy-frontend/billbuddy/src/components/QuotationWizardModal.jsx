export default function QuotationWizardModal(props) {
  const {
    showMessageSimulatorModal,
    closeQuotationWizard,
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
    quotationWizardItemReady,
    formatCurrency,
    calculateQuotationWizardItemTotal,
    handleRemoveQuotationWizardItem,
    getQuotationItemTitle,
    getQuotationItemQuantityValue,
    getQuotationItemRateValue,
    getQuotationItemTotalValue,
    quotationWizardGrossTotal,
    quotationWizardDiscountAmount,
    quotationWizardAdvanceAmount,
    quotationWizardBalanceAmount,
    formatDateIST,
    quotationWizardSubmitting,
    error,
    quotationWizardNotice,
    quotationWizardMaterialSuggestions,
    quotationWizardVisibleVariantFields,
    handleQuotationWizardMaterialInput,
    handleQuotationWizardMaterialSelect,
    handleQuotationWizardVariantSelection,
    handleSaveQuotationWizardSecondaryProduct,
    handleSubmitQuotationWizard,
    handleQuotationWizardNext,
    handleQuotationWizardBack,
    quotationPreviewUrl,
    quotationPreviewError,
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

  return (
    <div className="modal-overlay" onClick={closeQuotationWizard}>
      <div className="modal-card modal-wide glass-panel quotation-wizard-modal" onClick={(event) => event.stopPropagation()}>
        <div className="section-head">
          <h3>Create Quotation</h3>
          <button type="button" className="ghost-btn" onClick={closeQuotationWizard}>Close</button>
        </div>

        <div className="quotation-wizard-steps">
          {["customer", "items", "amounts", "preview"].map((step) => (
            <div key={step} className={`quotation-wizard-step ${quotationWizard.step === step ? "active" : ""}`}>
              {step.toUpperCase()}
            </div>
          ))}
        </div>
        <div className="context-help-strip">
          <div className="context-help-card">
            <strong>{activeWizardHelp.title}</strong>
            <p>{activeWizardHelp.text}</p>
          </div>
        </div>
        {error && <div className="notice error">{error}</div>}
        {quotationWizardNotice && <div className="notice success">{quotationWizardNotice}</div>}

        {quotationWizard.step === "customer" && (
          <div className="quotation-wizard-body">
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
                        onClick={() => setQuotationWizard((prev) => ({ ...prev, selectedCustomerId: String(customer.id) }))}
                      >
                        <strong>{customer.firm_name || customer.name}</strong>
                        <span>{customer.name}</span>
                        <span>{customer.mobile}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="quotation-wizard-grid">
                <input placeholder="Customer name" value={quotationWizard.customer.name} onChange={(e) => updateQuotationWizardCustomerField("name", e.target.value)} />
                <input placeholder="Firm name" value={quotationWizard.customer.firmName} onChange={(e) => updateQuotationWizardCustomerField("firmName", e.target.value)} />
                <input placeholder="Mobile" value={quotationWizard.customer.mobile} onChange={(e) => updateQuotationWizardCustomerField("mobile", e.target.value)} />
                <input placeholder="Email" type="email" value={quotationWizard.customer.email} onChange={(e) => updateQuotationWizardCustomerField("email", e.target.value)} />
                <textarea className="wizard-full" rows={3} placeholder="Address" value={quotationWizard.customer.address} onChange={(e) => updateQuotationWizardCustomerField("address", e.target.value)} />
                <input placeholder="Customer GST Number (optional)" value={quotationWizard.customer.gstNumber} onChange={(e) => updateQuotationWizardCustomerField("gstNumber", e.target.value.toUpperCase())} />
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
                          <input placeholder="Warehouse GST Number (optional)" value={entry.gstNumber || ""} onChange={(e) => updateQuotationWizardShippingAddress(index, "gstNumber", e.target.value.toUpperCase())} />
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
          </div>
        )}

        {quotationWizard.step === "items" && (
          <div className="quotation-wizard-body">
            <div className="quotation-wizard-grid">
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
                    {quotationWizardMaterialSuggestions.map((materialName) => (
                      <button
                        type="button"
                        key={materialName}
                        className={`wizard-suggestion-chip ${quotationWizard.itemForm.materialName === materialName ? "active" : ""}`}
                        onClick={() => handleQuotationWizardMaterialSelect(materialName)}
                      >
                        {materialName}
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
                  <select
                    key={`variant-${field.key}`}
                    value={value}
                    onChange={(e) => handleQuotationWizardVariantSelection(field.key, e.target.value)}
                  >
                    <option value="">Select {field.label}</option>
                    {field.options.map((option) => (
                      <option key={`${field.key}-${option}`} value={option}>{option}</option>
                    ))}
                  </select>
                );
              })}

              {runtimeSellerConfiguration?.modules?.quotationProductSelector !== false &&
                runtimeQuotationColumns
                  .filter((column) => column.visibleInForm)
                  .map((column) => {
                    const normalizedKey = column.normalizedKey || column.key;
                    const meta = column.meta || {};
                    if (normalizedKey === "material_name") return null;
                    if (quotationWizardVisibleVariantFields.some((field) => field.key === normalizedKey)) return null;
                    if (["width", "height", "unit", "thickness", "color_name", "other_info", "ps"].includes(normalizedKey) && !quotationWizardItemRules.isSheet) {
                      return null;
                    }

                    if (column.type === "checkbox" || meta.inputType === "checkbox") {
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
                          <option value="">{column.label}</option>
                          <option value="Sheet">Sheet</option>
                          <option value="Product">Product</option>
                          <option value="Services">Services</option>
                        </select>
                      );
                    }

                    if (meta.inputType === "unit-select") {
                      return (
                        <select key={column.id} value={quotationWizard.itemForm.unit} onChange={(e) => updateQuotationWizardItemForm("unit", e.target.value)}>
                          <option value="">{column.label}</option>
                          <option value="mm">mm</option>
                          <option value="in">in</option>
                          <option value="ft">ft</option>
                          <option value="sft">sft</option>
                          <option value="nos">nos</option>
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
              {!quotationWizardSelectedProduct && quotationWizard.itemForm.materialName.trim() ? (
                <button type="button" className="ghost-btn" onClick={handleSaveQuotationWizardSecondaryProduct}>
                  Save To Secondary Catalogue
                </button>
              ) : null}
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
              <input placeholder="Reference Request ID" type="text" maxLength="120" value={quotationWizard.amounts.referenceRequestId || ""} onChange={(e) => setQuotationWizard((prev) => ({ ...prev, amounts: { ...prev.amounts, referenceRequestId: e.target.value } }))} />
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
                <span>Reference Request ID: {quotationWizard.amounts.referenceRequestId || "-"}</span>
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
  );
}
