import { useRef, useState } from "react";
import { buildConfiguredQuotationItemTitle, humanizeQuotationFieldKey } from "../utils/quotationView";

export default function ConfigurationStudio(props) {
  const {
    activeModule,
    isPlatformAdmin,
    configurationStudioSeller,
    activeSellerConfiguration,
    products,
    sellerConfigLoading,
    currentModuleMeta,
    sellers,
    openSellerConfigurationStudio,
    closeSellerConfigurationStudio,
    sellerConfigTab,
    setSellerConfigTab,
    updateSellerConfigurationModule,
    formatDateTime,
    addCatalogueField,
    sortConfigEntries,
    updateCatalogueField,
    getOptionsInputValue,
    commitCatalogueFieldOptions,
    removeCatalogueField,
    MANDATORY_SYSTEM_CATALOGUE_KEYS,
    normalizeConfigKey,
    addQuotationColumn,
    updateQuotationColumn,
    commitQuotationColumnOptions,
    removeQuotationColumn,
    updateItemDisplayConfig,
    sellerConfigPreviewTab,
    setSellerConfigPreviewTab,
    renderConfigurationPreviewControl,
    publishSellerConfiguration,
    saveSellerConfigurationDraft,
    sellerConfigSaving,
    sellerConfigPublishing,
    canEditConfiguration,
    canSaveConfigurationDraft,
    canPublishConfiguration
  } = props;
  const defaultPatternInputRef = useRef(null);
  const categoryPatternInputRefs = useRef({});
  const [activePatternTarget, setActivePatternTarget] = useState({ type: "default", index: null });

  if (activeModule !== "Configuration Studio") return null;

  const configTabHelp = {
    dashboard: {
      title: "Studio Overview",
      text: "Use the dashboard tab to review the seller’s current configuration status, enabled modules, and save/publish readiness before editing fields."
    },
    catalogue: {
      title: "Catalogue Fields Help",
      text: "Add only the item master fields the seller truly needs. Keep system fields intact, sequence them carefully, and use dropdown options only when the values are controlled."
    },
    quotation: {
      title: "Quotation Columns Help",
      text: "Use this tab to decide what appears during quotation entry and in PDFs. Helping text supports additional detail below the item name, while formula columns are calculated automatically."
    },
    preview: {
      title: "Preview Help",
      text: "Preview helps you validate structure before publishing. It is the fastest way to check whether form controls and PDF-oriented fields still make sense together."
    },
    guide: {
      title: "Guide Help",
      text: "Use the guide tab when you want examples, formula references, and publishing guidance while configuring a new seller workspace."
    }
  };

  function renderInlineHelp(label, helpText) {
    return (
      <span className="field-label-with-help field-label-inline">
        <span>{label}</span>
        <button
          type="button"
          className="inline-help-trigger"
          title={helpText}
          aria-label={`${label} help`}
        >
          ?
        </button>
      </span>
    );
  }

  if (isPlatformAdmin && !configurationStudioSeller) {
    return (
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
    );
  }

  if (configurationStudioSeller && !activeSellerConfiguration) {
    return (
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
    );
  }

  if (!configurationStudioSeller || !activeSellerConfiguration) return null;

  const sellerProducts = (products || []).filter((product) => {
    if (!configurationStudioSeller?.id) return true;
    if (product.seller_id === undefined || product.seller_id === null) return true;
    return Number(product.seller_id) === Number(configurationStudioSeller.id);
  });
  const availableCategories = [...new Set(
    sellerProducts
      .map((product) => String(product.category || "").trim())
      .filter(Boolean)
  )].sort((left, right) => left.localeCompare(right));
  const sampleProductByCategory = Object.fromEntries(
    availableCategories.map((category) => [
      category,
      sellerProducts.find((product) => String(product.category || "").trim() === category) || null
    ])
  );
  const availableDisplayTokens = [
    ...new Set([
      "material_name",
      "category",
      "sku",
      "color_name",
      "thickness",
      "size",
      "quantity",
      "rate",
      "width",
      "height",
      "unit",
      "item_note",
      "imported_color_note",
      ...activeSellerConfiguration.catalogueFields.map((field) => field.key),
      ...activeSellerConfiguration.quotationColumns.map((column) => column.key)
    ].filter(Boolean))
  ].sort((left, right) => left.localeCompare(right));

  function buildTokenInsertionValue(existingPattern, token, inputRef) {
    const currentPattern = String(existingPattern || "");
    const tokenText = `{${String(token || "").trim()}}`;
    if (!tokenText || tokenText === "{}") return currentPattern;
    if (!inputRef || typeof inputRef.selectionStart !== "number" || typeof inputRef.selectionEnd !== "number") {
      return currentPattern ? `${currentPattern} ${tokenText}` : tokenText;
    }
    const start = Math.max(0, Math.min(inputRef.selectionStart, currentPattern.length));
    const end = Math.max(start, Math.min(inputRef.selectionEnd, currentPattern.length));
    const before = currentPattern.slice(0, start);
    const after = currentPattern.slice(end);
    const nextValue = `${before}${tokenText}${after}`;
    const nextCaret = before.length + tokenText.length;
    requestAnimationFrame(() => {
      try {
        inputRef.focus();
        inputRef.setSelectionRange(nextCaret, nextCaret);
      } catch (_error) {
        // Ignore focus/selection failures on detached refs.
      }
    });
    return nextValue;
  }

  function insertTokenIntoActivePattern(token) {
    if (!canEditConfiguration) return;
    if (activePatternTarget.type === "category") {
      const categoryIndex = Number(activePatternTarget.index);
      if (Number.isInteger(categoryIndex) && categoryIndex >= 0) {
        updateItemDisplayConfig((current) => ({
          ...current,
          categoryRules: (current.categoryRules || []).map((entry, entryIndex) => (
            entryIndex === categoryIndex
              ? {
                  ...entry,
                  pattern: buildTokenInsertionValue(entry.pattern, token, categoryPatternInputRefs.current[categoryIndex])
                }
              : entry
          ))
        }));
        return;
      }
    }
    updateItemDisplayConfig((current) => ({
      ...current,
      defaultPattern: buildTokenInsertionValue(current.defaultPattern, token, defaultPatternInputRef.current)
    }));
  }

  function buildSampleItem(product, categoryOverride = "") {
    if (!product) {
      return {
        material_name: "Sample Item",
        item_category: categoryOverride || "",
        custom_fields: {}
      };
    }
    return {
      material_name: product.material_name || "",
      item_category: categoryOverride || product.category || "",
      sku: product.sku || "",
      color_name: product.color_name || "",
      thickness: product.thickness || "",
      custom_fields: product.custom_fields || {}
    };
  }

  return (
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
              <button key={tab.key} type="button" className={`ghost-btn ${sellerConfigTab === tab.key ? "active-chip" : ""}`} onClick={() => setSellerConfigTab(tab.key)}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="context-help-strip seller-context-help">
            <div className="context-help-card">
              <strong>{configTabHelp[sellerConfigTab]?.title}</strong>
              <p>{configTabHelp[sellerConfigTab]?.text}</p>
            </div>
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
                      <span key={key} className={`badge ${enabled ? "success" : "pending"}`}>{key} {enabled ? "on" : "off"}</span>
                    ))}
                  </div>
                </article>
                <article className="seller-detail-card">
                  <h4>Quotation Behavior</h4>
                  <label className="seller-toggle" style={{ marginTop: "8px" }}>
                    <input type="checkbox" disabled={!canEditConfiguration} checked={Boolean(activeSellerConfiguration.modules?.quotationProductSelector)} onChange={(e) => updateSellerConfigurationModule("quotationProductSelector", e.target.checked)} />
                    <span>Show product selector in Create Quotation</span>
                  </label>
                  <p className="muted" style={{ marginTop: "12px" }}>Turn this off if the seller should create quotation items only from configured quotation fields and not from the product catalogue dropdown.</p>
                  <label className="seller-toggle" style={{ marginTop: "16px" }}>
                    <input type="checkbox" disabled={!canEditConfiguration} checked={Boolean(activeSellerConfiguration.modules?.combineHelpingTextInItemColumn)} onChange={(e) => updateSellerConfigurationModule("combineHelpingTextInItemColumn", e.target.checked)} />
                    <span>Combine helping text into item title column</span>
                  </label>
                  <p className="muted" style={{ marginTop: "12px" }}>Turn this on if supporting fields like colour or thickness should merge into the item title text instead of staying separate below the item name.</p>
                </article>
                <article className="seller-detail-card">
                  <h4>Persistence Status</h4>
                  <p className="muted">This configuration now saves per seller in the backend. Use Save Draft while tuning the schema, then Publish when the seller setup is ready to go live.</p>
                  {activeSellerConfiguration.updatedAt && <p className="muted">Last saved: {formatDateTime(activeSellerConfiguration.updatedAt)}</p>}
                </article>
              </div>
            </div>
          )}

          {sellerConfigTab === "catalogue" && (
            <div className="seller-config-body">
              <div className="section-head compact">
                <h3>Catalogue Fields Configuration</h3>
                {canEditConfiguration && <button type="button" onClick={addCatalogueField}>Add Field</button>}
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Seq</th><th>Label</th><th>Key</th><th>Type</th><th>Options</th><th>Required</th><th>List</th><th>Upload</th><th /></tr>
                </thead>
                <tbody>
                  {sortConfigEntries(activeSellerConfiguration.catalogueFields).map((field) => (
                    <tr key={field.id}>
                      <td><input type="number" min="1" disabled={!canEditConfiguration} value={field.displayOrder ?? ""} onChange={(e) => updateCatalogueField(field.id, "displayOrder", Number(e.target.value || 0))} /></td>
                      <td><input disabled={!canEditConfiguration} value={field.label} onChange={(e) => updateCatalogueField(field.id, "label", e.target.value)} /></td>
                      <td><input disabled={!canEditConfiguration} value={field.key} onChange={(e) => updateCatalogueField(field.id, "key", e.target.value)} /></td>
                      <td>
                        <select disabled={!canEditConfiguration} value={field.type} onChange={(e) => updateCatalogueField(field.id, "type", e.target.value)}>
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
                          disabled={!canEditConfiguration || field.type !== "dropdown"}
                        />
                      </td>
                      <td><input type="checkbox" disabled={!canEditConfiguration} checked={Boolean(field.required)} onChange={(e) => updateCatalogueField(field.id, "required", e.target.checked)} style={{ width: "auto" }} /></td>
                      <td><input type="checkbox" disabled={!canEditConfiguration} checked={Boolean(field.visibleInList)} onChange={(e) => updateCatalogueField(field.id, "visibleInList", e.target.checked)} style={{ width: "auto" }} /></td>
                      <td><input type="checkbox" disabled={!canEditConfiguration} checked={Boolean(field.uploadEnabled)} onChange={(e) => updateCatalogueField(field.id, "uploadEnabled", e.target.checked)} style={{ width: "auto" }} /></td>
                      <td>
                        {MANDATORY_SYSTEM_CATALOGUE_KEYS.includes(normalizeConfigKey(field.key)) ? (
                          <span className="badge pending">System Field</span>
                        ) : (
                          <button type="button" className="ghost-btn" disabled={!canEditConfiguration} onClick={() => removeCatalogueField(field.id)}>Remove</button>
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
                {canEditConfiguration && <button type="button" onClick={addQuotationColumn}>Add Column</button>}
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
              <div className="seller-config-help-card" style={{ marginTop: "18px" }}>
                <div className="section-head compact">
                  <h4>Item Display Builder</h4>
                </div>
                <p className="muted">Define how the final Item text should appear in quotations. Use a default rule for all categories, then override specific catalogue categories where needed.</p>
                <div className="quotation-wizard-grid two" style={{ marginTop: "14px" }}>
                  <label className="wizard-full">
                    <span>Default Item Pattern</span>
                    <input
                      ref={defaultPatternInputRef}
                      disabled={!canEditConfiguration}
                      value={activeSellerConfiguration.itemDisplayConfig?.defaultPattern || ""}
                      onChange={(e) => updateItemDisplayConfig((current) => ({
                        ...current,
                        defaultPattern: e.target.value
                      }))}
                      onFocus={() => setActivePatternTarget({ type: "default", index: null })}
                      placeholder="{material_name}"
                    />
                    <small className="muted">Example: `{'{color_name} {material_name} with {base_type}'}`</small>
                  </label>
                  <div className="wizard-full">
                    <span>Available Tokens</span>
                    <div className="seller-config-option-chips">
                      {availableDisplayTokens.map((token) => (
                        <button
                          key={token}
                          type="button"
                          className="badge pending"
                          disabled={!canEditConfiguration}
                          onClick={() => insertTokenIntoActivePattern(token)}
                          title="Click to insert into active pattern"
                        >
                          {humanizeQuotationFieldKey(token)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="seller-detail-list" style={{ marginTop: "14px" }}>
                  <div>
                    <span>Default Preview</span>
                    <strong>{buildConfiguredQuotationItemTitle(buildSampleItem(sellerProducts[0] || null), activeSellerConfiguration.itemDisplayConfig) || "-"}</strong>
                  </div>
                </div>

                <div className="section-head compact" style={{ marginTop: "18px" }}>
                  <h4>Category Overrides</h4>
                  {canEditConfiguration && (
                    <button
                      type="button"
                      onClick={() => updateItemDisplayConfig((current) => {
                        const usedCategories = new Set((current.categoryRules || []).map((rule) => rule.category));
                        const nextCategory = availableCategories.find((category) => !usedCategories.has(category));
                        if (!nextCategory) return current;
                        return {
                          ...current,
                          categoryRules: [...(current.categoryRules || []), { category: nextCategory, pattern: "" }]
                        };
                      })}
                    >
                      Add Category Rule
                    </button>
                  )}
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>Category</th><th>Pattern</th><th>Preview</th><th /></tr>
                  </thead>
                  <tbody>
                    {(activeSellerConfiguration.itemDisplayConfig?.categoryRules || []).length === 0 ? (
                      <tr><td colSpan="4">No category overrides yet.</td></tr>
                    ) : (
                      activeSellerConfiguration.itemDisplayConfig.categoryRules.map((rule, index) => {
                        const sampleItem = buildSampleItem(sampleProductByCategory[rule.category], rule.category);
                        const preview = buildConfiguredQuotationItemTitle(sampleItem, {
                          defaultPattern: activeSellerConfiguration.itemDisplayConfig?.defaultPattern || "",
                          categoryRules: [rule]
                        });
                        const orphaned = rule.category && !availableCategories.includes(rule.category);
                        return (
                          <tr key={`${rule.category}-${index}`}>
                            <td>
                              <select
                                disabled={!canEditConfiguration}
                                value={rule.category}
                                onChange={(e) => updateItemDisplayConfig((current) => ({
                                  ...current,
                                  categoryRules: (current.categoryRules || []).map((entry, entryIndex) => (
                                    entryIndex === index ? { ...entry, category: e.target.value } : entry
                                  ))
                                }))}
                              >
                                <option value="">Select category</option>
                                {availableCategories.map((category) => (
                                  <option key={category} value={category}>{category}</option>
                                ))}
                              </select>
                              {orphaned && <div className="muted">Category no longer exists in catalogue.</div>}
                            </td>
                            <td>
                              <input
                                ref={(element) => {
                                  if (!element) return;
                                  categoryPatternInputRefs.current[index] = element;
                                }}
                                disabled={!canEditConfiguration}
                                value={rule.pattern}
                                onChange={(e) => updateItemDisplayConfig((current) => ({
                                  ...current,
                                  categoryRules: (current.categoryRules || []).map((entry, entryIndex) => (
                                    entryIndex === index ? { ...entry, pattern: e.target.value } : entry
                                  ))
                                }))}
                                onFocus={() => setActivePatternTarget({ type: "category", index })}
                                placeholder="{material_name}"
                              />
                            </td>
                            <td>{preview || "-"}</td>
                            <td>
                              <button
                                type="button"
                                className="ghost-btn"
                                disabled={!canEditConfiguration}
                                onClick={() => updateItemDisplayConfig((current) => ({
                                  ...current,
                                  categoryRules: (current.categoryRules || []).filter((_, entryIndex) => entryIndex !== index)
                                }))}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                <p className="muted" style={{ marginTop: "12px" }}>Blank field tokens are removed automatically. If a token is missing, the immediately preceding connector text is also hidden.</p>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Seq</th><th>Label</th><th>Key</th><th>Type</th><th>Options</th><th>Definition</th><th>{renderInlineHelp("Formula", "Formula columns are calculated automatically at quotation save time. Use supported variables like width, height, quantity, rate, amount, or total_price.")}</th><th>Required</th><th>Form</th><th>PDF</th><th>{renderInlineHelp("Helping", "Helping text appears below the item name in the PDF instead of behaving like a main table column. Use it for supporting details like colour, thickness, or notes.")}</th><th>Calc</th><th /></tr>
                </thead>
                <tbody>
                  {sortConfigEntries(activeSellerConfiguration.quotationColumns).map((column) => (
                    <tr key={column.id}>
                      <td><input type="number" min="1" disabled={!canEditConfiguration} value={column.displayOrder ?? ""} onChange={(e) => updateQuotationColumn(column.id, "displayOrder", Number(e.target.value || 0))} /></td>
                      <td><input disabled={!canEditConfiguration} value={column.label} onChange={(e) => updateQuotationColumn(column.id, "label", e.target.value)} /></td>
                      <td><input disabled={!canEditConfiguration} value={column.key} onChange={(e) => updateQuotationColumn(column.id, "key", e.target.value)} /></td>
                      <td>
                        <select disabled={!canEditConfiguration} value={column.type} onChange={(e) => updateQuotationColumn(column.id, "type", e.target.value)}>
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
                          disabled={!canEditConfiguration || column.type !== "dropdown"}
                        />
                      </td>
                      <td><input disabled={!canEditConfiguration} value={column.definition || ""} onChange={(e) => updateQuotationColumn(column.id, "definition", e.target.value)} placeholder="What this column means" /></td>
                      <td><input value={column.formulaExpression || ""} onChange={(e) => updateQuotationColumn(column.id, "formulaExpression", e.target.value)} placeholder={column.type === "formula" ? "width * height * quantity * rate" : "Only for formula type"} disabled={!canEditConfiguration || column.type !== "formula"} /></td>
                      <td><input type="checkbox" disabled={!canEditConfiguration} checked={Boolean(column.required)} onChange={(e) => updateQuotationColumn(column.id, "required", e.target.checked)} style={{ width: "auto" }} /></td>
                      <td><input type="checkbox" disabled={!canEditConfiguration} checked={Boolean(column.visibleInForm)} onChange={(e) => updateQuotationColumn(column.id, "visibleInForm", e.target.checked)} style={{ width: "auto" }} /></td>
                      <td><input type="checkbox" disabled={!canEditConfiguration} checked={Boolean(column.visibleInPdf)} onChange={(e) => updateQuotationColumn(column.id, "visibleInPdf", e.target.checked)} style={{ width: "auto" }} /></td>
                      <td><input type="checkbox" disabled={!canEditConfiguration} checked={Boolean(column.helpTextInPdf)} onChange={(e) => updateQuotationColumn(column.id, "helpTextInPdf", e.target.checked)} style={{ width: "auto" }} /></td>
                      <td><input type="checkbox" disabled={!canEditConfiguration} checked={Boolean(column.includedInCalculation)} onChange={(e) => updateQuotationColumn(column.id, "includedInCalculation", e.target.checked)} style={{ width: "auto" }} /></td>
                      <td><button type="button" className="ghost-btn" disabled={!canEditConfiguration} onClick={() => removeQuotationColumn(column.id)}>Remove</button></td>
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
                  <button key={tab.key} type="button" className={`ghost-btn ${sellerConfigPreviewTab === tab.key ? "active-chip" : ""}`} onClick={() => setSellerConfigPreviewTab(tab.key)}>
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
                    <div><strong>Line Amount</strong><code>width * height * quantity * rate</code></div>
                    <div><strong>Service Total</strong><code>quantity * rate</code></div>
                    <div><strong>Taxable Amount</strong><code>amount - 100</code></div>
                    <div><strong>Width In Feet</strong><code>width_ft</code></div>
                    <div><strong>Area In Square Feet</strong><code>area_sqft * quantity * rate</code></div>
                    <div><strong>Converted Width</strong><code>width * unit_factor</code></div>
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
        <button type="button" className="ghost-btn" onClick={publishSellerConfiguration} disabled={!canPublishConfiguration || sellerConfigLoading || sellerConfigSaving || sellerConfigPublishing}>
          {sellerConfigPublishing ? "Publishing..." : "Publish"}
        </button>
        <button type="button" onClick={saveSellerConfigurationDraft} disabled={!canSaveConfigurationDraft || sellerConfigLoading || sellerConfigSaving || sellerConfigPublishing}>
          {sellerConfigSaving ? "Saving..." : "Save Draft"}
        </button>
      </div>
    </section>
  );
}
