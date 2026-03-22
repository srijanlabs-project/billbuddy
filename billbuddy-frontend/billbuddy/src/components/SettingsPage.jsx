import { useMemo, useState } from "react";

function formatTemplateFieldLabel(key) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderUsageSummary(usageOverview) {
  if (!usageOverview) return [];
  return [
    { label: "Active Sellers", value: usageOverview.activeSellers ?? 0 },
    { label: "Live Plans", value: usageOverview.livePlans ?? 0 },
    { label: "Monthly Revenue", value: usageOverview.monthlyRevenue ?? 0 },
    { label: "Notifications", value: usageOverview.notificationsSent ?? 0 }
  ];
}

function renderInlineHelp(label, helpText) {
  return (
    <span className="field-label-with-help">
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

export default function SettingsPage({
  currentModuleMeta,
  isPlatformAdmin,
  THEME_OPTIONS,
  theme,
  setTheme,
  brandColor,
  setBrandColor,
  quotationNumberPrefix,
  setQuotationNumberPrefix,
  sellerGstNumber,
  setSellerGstNumber,
  bankName,
  setBankName,
  bankBranch,
  setBankBranch,
  bankAccountNo,
  setBankAccountNo,
  bankIfsc,
  setBankIfsc,
  handleSaveThemeSettings,
  decodeRules,
  setDecodeRules,
  handleSaveDecodeRules,
  quotationTemplate,
  setQuotationTemplate,
  QUOTATION_TEMPLATE_PRESETS,
  applyQuotationTemplatePreset,
  handleQuotationHeaderImageChange,
  handleQuotationLogoImageChange,
  quotationPreview,
  renderTemplateText,
  handleSaveQuotationTemplate,
  usageOverview,
  setActiveModule,
  canEditSettings
}) {
  const [showDecodeFormula, setShowDecodeFormula] = useState(false);

  const presetMeta = QUOTATION_TEMPLATE_PRESETS[quotationTemplate.template_preset] || QUOTATION_TEMPLATE_PRESETS.commercial_offer;
  const usageCards = useMemo(() => renderUsageSummary(usageOverview), [usageOverview]);

  const previewBody = renderTemplateText(quotationTemplate.body_template, quotationPreview);
  const previewFooter = renderTemplateText(quotationTemplate.footer_text, quotationPreview);
  const showHeaderImage = Boolean(quotationTemplate.show_header_image && quotationTemplate.header_image_data);
  const showLogoOnly = Boolean(!showHeaderImage && quotationTemplate.show_logo_only && quotationTemplate.logo_image_data);

  function updateTemplateField(field, value) {
    setQuotationTemplate((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <section className="workspace settings-workspace">
      <header className="section-head settings-page-head">
        <div>
          <span>{currentModuleMeta.eyebrow}</span>
          <h2>{currentModuleMeta.title}</h2>
          <p>{currentModuleMeta.subtitle}</p>
        </div>
      </header>

      <div className="settings-form-stack">
        {!isPlatformAdmin ? (
          <>
            <form className="settings-card compact-settings-card" onSubmit={handleSaveThemeSettings}>
              <div className="settings-card-head">
                <div>
                  <span>Business Settings</span>
                  <h3>Brand, identity, and banking</h3>
                  <p>Keep the core business information compact, readable, and ready for every quotation.</p>
                </div>
                <button className="primary-button" type="submit" disabled={!canEditSettings}>Save Business Settings</button>
              </div>
              <div className="context-help-strip">
                <div className="context-help-card">
                  <strong>Business Settings Help</strong>
                  <p>Complete GST, bank details, and quotation prefix first. These values are reused across quotation templates, totals blocks, and customer-facing PDFs.</p>
                </div>
              </div>

              <div className="settings-form-grid settings-form-grid-wide">
                <section className="settings-panel">
                  <div className="settings-panel-head">
                    <h4>Brand Identity</h4>
                    <p>These settings shape the seller workspace and quotation defaults.</p>
                  </div>
                  <div className="settings-two-column">
                    <label className="settings-field">
                      <span>Theme</span>
                      <select value={theme} onChange={(event) => setTheme(event.target.value)}>
                        {THEME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="settings-field settings-color-field">
                      <span>Brand Color</span>
                      <div className="settings-color-control">
                        <input type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} />
                        <input type="text" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} />
                      </div>
                    </label>
                    <label className="settings-field settings-field-wide">
                      <span>Quotation Prefix</span>
                      <input
                        type="text"
                        value={quotationNumberPrefix}
                        onChange={(event) => setQuotationNumberPrefix(event.target.value.toUpperCase())}
                        placeholder="QTN"
                        maxLength={12}
                      />
                    </label>
                    <label className="settings-field settings-field-wide">
                      <span>Seller GST Number</span>
                      <input
                        type="text"
                        value={sellerGstNumber}
                        onChange={(event) => setSellerGstNumber(event.target.value.toUpperCase())}
                        placeholder="27ABCDE1234F1Z5"
                        maxLength={20}
                      />
                    </label>
                  </div>
                </section>

                <section className="settings-panel">
                  <div className="settings-panel-head">
                    <h4>Bank Details</h4>
                    <p>These values are reused across all customers in quotation templates.</p>
                  </div>
                  <div className="settings-two-column">
                    <label className="settings-field">
                      <span>Bank Name</span>
                      <input type="text" value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="HDFC Bank" />
                    </label>
                    <label className="settings-field">
                      <span>Branch</span>
                      <input type="text" value={bankBranch} onChange={(event) => setBankBranch(event.target.value)} placeholder="Khargar" />
                    </label>
                    <label className="settings-field">
                      <span>Account Number</span>
                      <input type="text" value={bankAccountNo} onChange={(event) => setBankAccountNo(event.target.value)} placeholder="50214589 6321" />
                    </label>
                    <label className="settings-field">
                      <span>IFSC</span>
                      <input type="text" value={bankIfsc} onChange={(event) => setBankIfsc(event.target.value.toUpperCase())} placeholder="HDFC0001256" />
                    </label>
                  </div>
                </section>
              </div>
            </form>

            <form className="settings-card compact-settings-card" onSubmit={handleSaveDecodeRules}>
              <div className="settings-card-head">
                <div>
                  <span>Message Decode Formula</span>
                  <h3>WhatsApp parsing rules</h3>
                  <p>This is currently unused in most flows, so it stays collapsed by default.</p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!canEditSettings}
                  onClick={() => setShowDecodeFormula((current) => !current)}
                >
                  {showDecodeFormula ? "Hide" : "Show"}
                </button>
              </div>

              {showDecodeFormula ? (
                <div className="settings-form-grid">
                  <section className="settings-panel">
                    <div className="settings-two-column decode-grid">
                      {[
                        ["customer_line", "Customer Line"],
                        ["mobile_line", "Mobile Line"],
                        ["item_line", "Item Line"],
                        ["delivery_date_line", "Delivery Date Line"],
                        ["delivery_type_line", "Delivery Type Line"]
                      ].map(([field, label]) => (
                        <label className="settings-field" key={field}>
                          <span>{label}</span>
                          <input
                            type="number"
                            min="1"
                            value={decodeRules[field] ?? ""}
                            onChange={(event) => setDecodeRules((prev) => ({ ...prev, [field]: event.target.value }))}
                          />
                        </label>
                      ))}
                      <label className="settings-inline-toggle settings-field-wide">
                        <input
                          type="checkbox"
                          checked={Boolean(decodeRules.enabled)}
                          onChange={(event) => setDecodeRules((prev) => ({ ...prev, enabled: event.target.checked }))}
                        />
                        <div>
                          <strong>Enable formula</strong>
                          <span>Use these line mappings when message-based decoding is switched on later.</span>
                        </div>
                      </label>
                    </div>
                  </section>
                </div>
              ) : null}

              {showDecodeFormula ? (
                <div className="settings-form-actions">
                  <button className="primary-button" type="submit" disabled={!canEditSettings}>Save Decode Rules</button>
                </div>
              ) : null}
            </form>

            <form className="settings-card compact-settings-card" onSubmit={handleSaveQuotationTemplate}>
              <div className="settings-card-head">
                <div>
                  <span>Quotation Format</span>
                  <h3>Design, content, and sharing controls</h3>
                  <p>Everything remains visible, but grouped into cleaner panels so the page feels shorter and easier to use.</p>
                </div>
                <button className="primary-button" type="submit" disabled={!canEditSettings}>Save Quotation Format</button>
              </div>
              <div className="context-help-strip">
                <div className="context-help-card">
                  <strong>Quotation Format Help</strong>
                  <p>Choose the preset first, then branding assets, then content text. If a full header image is enabled, header text and logo are intentionally suppressed to avoid overlap.</p>
                </div>
              </div>

              <div className="settings-form-grid settings-form-grid-wide">
                <section className="settings-panel">
                  <div className="settings-panel-head">
                    <h4>Preset and Identity</h4>
                    <p>Choose the template direction and set the basic quotation identity text.</p>
                  </div>
                  <div className="settings-two-column">
                    <label className="settings-field">
                      <span>Template Preset</span>
                      <select
                        value={quotationTemplate.template_preset}
                        onChange={(event) => applyQuotationTemplatePreset(event.target.value)}
                      >
                        {Object.entries(QUOTATION_TEMPLATE_PRESETS).map(([key, config]) => (
                          <option key={key} value={key}>{config.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="settings-field settings-color-field">
                      <span>Accent Color</span>
                      <div className="settings-color-control">
                        <input
                          type="color"
                          value={quotationTemplate.accent_color || "#2563eb"}
                          onChange={(event) => updateTemplateField("accent_color", event.target.value)}
                        />
                        <input
                          type="text"
                          value={quotationTemplate.accent_color || "#2563eb"}
                          onChange={(event) => updateTemplateField("accent_color", event.target.value)}
                        />
                      </div>
                    </label>
                    <label className="settings-field settings-field-wide">
                      <span>Header Text</span>
                      <input
                        type="text"
                        value={quotationTemplate.header_text || ""}
                        onChange={(event) => updateTemplateField("header_text", event.target.value)}
                        placeholder="Quotation"
                      />
                    </label>
                  </div>
                  <div className="settings-help-card settings-help-card-compact">
                    <strong>{presetMeta?.label}</strong>
                    <p>{presetMeta?.description}</p>
                  </div>
                </section>

                <section className="settings-panel">
                  <div className="settings-panel-head">
                    <h4>Company Contact</h4>
                    <p>This content appears in the quotation header whenever a full header image is not overriding it.</p>
                  </div>
                  <div className="settings-two-column">
                    <label className="settings-field">
                      <span>Company Phone</span>
                      <input
                        type="text"
                        value={quotationTemplate.company_phone || ""}
                        onChange={(event) => updateTemplateField("company_phone", event.target.value)}
                        placeholder="7710088377"
                      />
                    </label>
                    <label className="settings-field">
                      <span>Company Email</span>
                      <input
                        type="email"
                        value={quotationTemplate.company_email || ""}
                        onChange={(event) => updateTemplateField("company_email", event.target.value)}
                        placeholder="sales@example.com"
                      />
                    </label>
                    <label className="settings-field settings-field-wide">
                      <span>Company Address</span>
                      <textarea
                        rows="3"
                        value={quotationTemplate.company_address || ""}
                        onChange={(event) => updateTemplateField("company_address", event.target.value)}
                        placeholder="Plot 260, Sector 10, Kharghar, Navi Mumbai"
                      />
                    </label>
                  </div>
                </section>

                <section className="settings-panel">
                  <div className="settings-panel-head">
                    <h4>Brand Assets</h4>
                    <p>Header image wins over logo and header text. Logo-only mode is used when no full header image is enabled.</p>
                  </div>
                  <div className="settings-image-grid">
                    <label className="settings-field">
                      {renderInlineHelp("Header Image", "Use a full-width header image when you want the image itself to represent the quotation brand. When header image mode is enabled, Quotsy suppresses header text and logo to avoid overlap.")}
                      <input type="file" accept="image/*" onChange={handleQuotationHeaderImageChange} />
                    </label>
                    <label className="settings-inline-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(quotationTemplate.show_header_image)}
                        onChange={(event) => updateTemplateField("show_header_image", event.target.checked)}
                      />
                      <div>
                        <strong>Use header image</strong>
                        <span>When enabled, header text and logo are ignored in preview and PDF.</span>
                      </div>
                    </label>
                    <label className="settings-field">
                      {renderInlineHelp("Logo Image", "Use logo mode when you want the company logo to appear with text-based company details beside it. Logo-only mode is ignored when a full header image is enabled.")}
                      <input type="file" accept="image/*" onChange={handleQuotationLogoImageChange} />
                    </label>
                    <label className="settings-inline-toggle">
                      <input
                        type="checkbox"
                        checked={Boolean(quotationTemplate.show_logo_only)}
                        onChange={(event) => updateTemplateField("show_logo_only", event.target.checked)}
                      />
                      <div>
                        <strong>Use logo only</strong>
                        <span>Best for templates where contact text should still appear beside the logo.</span>
                      </div>
                    </label>
                  </div>

                  <div className="settings-asset-preview-grid">
                    <div className="settings-asset-preview-card">
                      <div className="settings-asset-head">
                        <strong>Header Preview</strong>
                        {quotationTemplate.header_image_data ? (
                          <button className="text-button" type="button" onClick={() => updateTemplateField("header_image_data", null)}>Remove</button>
                        ) : null}
                      </div>
                      {quotationTemplate.header_image_data ? (
                        <img src={quotationTemplate.header_image_data} alt="Header preview" className="settings-asset-preview-image" />
                      ) : (
                        <p>No header image uploaded yet.</p>
                      )}
                    </div>
                    <div className="settings-asset-preview-card">
                      <div className="settings-asset-head">
                        <strong>Logo Preview</strong>
                        {quotationTemplate.logo_image_data ? (
                          <button className="text-button" type="button" onClick={() => updateTemplateField("logo_image_data", null)}>Remove</button>
                        ) : null}
                      </div>
                      {quotationTemplate.logo_image_data ? (
                        <img src={quotationTemplate.logo_image_data} alt="Logo preview" className="settings-asset-preview-logo" />
                      ) : (
                        <p>No logo uploaded yet.</p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="settings-panel">
                  <div className="settings-panel-head">
                    <h4>Quotation Content</h4>
                    <p>These text blocks keep the quotation human and polished without stretching the page too much.</p>
                  </div>
                  <div className="settings-two-column">
                    {[
                      ["body_template", "Body Template", 3],
                      ["footer_text", "Footer Text", 2],
                      ["notes_text", "Notes", 3],
                      ["terms_text", "Terms & Conditions", 4]
                    ].map(([field, label, rows]) => (
                      <label className={`settings-field ${field === "footer_text" ? "" : "settings-field-wide"}`} key={field}>
                        <span>{label}</span>
                        <textarea
                          rows={rows}
                          value={quotationTemplate[field] || ""}
                          onChange={(event) => updateTemplateField(field, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="settings-panel settings-panel-preview">
                  <div className="settings-panel-head">
                    <h4>Live Preview</h4>
                    <p>Compact on the page, but still close to the quotation structure users will actually see.</p>
                  </div>
                  <div className={`settings-quotation-preview preset-${quotationTemplate.template_preset}`} style={{ "--preview-accent": quotationTemplate.accent_color || "#2563eb" }}>
                    {showHeaderImage ? (
                      <div className="settings-preview-header-image-wrap">
                        <img src={quotationTemplate.header_image_data} alt="Quotation header" className="settings-preview-header-image" />
                      </div>
                    ) : (
                      <div className="settings-preview-hero">
                        <div className="settings-preview-brand-block">
                          {showLogoOnly ? <img src={quotationTemplate.logo_image_data} alt="Logo" className="settings-preview-logo" /> : null}
                          <div>
                            <h5>{quotationTemplate.header_text || presetMeta?.defaults?.header_text || "Quotation"}</h5>
                            <p>{quotationTemplate.company_address || "Plot 260, Sector 10, Kharghar, Navi Mumbai"}</p>
                          </div>
                        </div>
                        <div className="settings-preview-contact-block">
                          <strong>{quotationPreview.quotation_number}</strong>
                          <span>{quotationTemplate.company_phone || "+91 7710088377"}</span>
                          <span>{quotationTemplate.company_email || "sales@example.com"}</span>
                        </div>
                      </div>
                    )}

                    <div className="settings-preview-meta-grid">
                      <div>
                        <span>Quotation No</span>
                        <strong>{quotationPreview.quotation_number}</strong>
                      </div>
                      <div>
                        <span>Customer</span>
                        <strong>{quotationPreview.customer_name}</strong>
                      </div>
                      <div>
                        <span>Delivery Type</span>
                        <strong>{quotationPreview.delivery_type}</strong>
                      </div>
                      <div>
                        <span>Delivery Date</span>
                        <strong>{quotationPreview.delivery_date}</strong>
                      </div>
                    </div>

                    <div className="settings-preview-copy-block">
                      <p>{previewBody}</p>
                    </div>

                    <div className="settings-preview-table-wrap">
                      <table className="settings-preview-table">
                        <thead>
                          <tr>
                            <th>Sr.</th>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>1</td>
                            <td>
                              Acrylic Sheet
                              <small>Thickness: 10 mm | Finish: Gloss</small>
                            </td>
                            <td>12</td>
                            <td>Rs 450</td>
                            <td>Rs {quotationPreview.total_amount}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="settings-preview-footer-grid">
                      <div className="settings-preview-notes-block">
                        <h6>Notes</h6>
                        <p>{quotationTemplate.notes_text || presetMeta?.defaults?.notes_text}</p>
                        <h6>Terms & Conditions</h6>
                        <p>{quotationTemplate.terms_text || presetMeta?.defaults?.terms_text}</p>
                      </div>
                      <div className="settings-preview-summary-block">
                        {[
                          ["Total Amount", quotationPreview.total_amount],
                          ["Discount", "2,500"],
                          ["Advance", "15,000"],
                          ["Balance Amount", "1,07,000"]
                        ].map(([label, value]) => (
                          <div key={label}>
                            <span>{label}</span>
                            <strong>{value}</strong>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="settings-preview-endnote">
                      <span>{previewFooter}</span>
                    </div>
                  </div>
                </section>

                <section className="settings-panel">
                  <div className="settings-panel-head">
                    <h4>Sharing Controls</h4>
                    <p>Keep delivery options visible without making the screen feel long.</p>
                  </div>
                  <div className="settings-two-column">
                    {[
                      ["email_enabled", "Enable Email Sharing"],
                      ["whatsapp_enabled", "Enable WhatsApp Sharing"]
                    ].map(([field, label]) => (
                      <label className="settings-inline-toggle" key={field}>
                        <input
                          type="checkbox"
                          checked={Boolean(quotationTemplate[field])}
                          onChange={(event) => updateTemplateField(field, event.target.checked)}
                        />
                        <div>
                          <strong>{label}</strong>
                          <span>{formatTemplateFieldLabel(field)} is available to the seller team.</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            </form>
          </>
        ) : (
          <div className="settings-form-stack">
            <section className="settings-card compact-settings-card">
              <div className="settings-card-head">
                <div>
                  <span>Platform Usage</span>
                  <h3>Quotsy platform overview</h3>
                  <p>Quick, readable cards for the core SaaS signals that matter every day.</p>
                </div>
              </div>
              <div className="settings-usage-grid">
                {usageCards.map((card) => (
                  <article key={card.label} className="settings-usage-card">
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="settings-card compact-settings-card">
              <div className="settings-card-head">
                <div>
                  <span>Platform Controls</span>
                  <h3>Admin shortcuts</h3>
                  <p>Keep the operating controls nearby without sending the user through a long page.</p>
                </div>
              </div>
              <div className="settings-admin-actions">
                <button className="secondary-button" type="button" onClick={() => setActiveModule("Sellers")}>Manage Sellers</button>
                <button className="secondary-button" type="button" onClick={() => setActiveModule("Plans")}>Manage Plans</button>
                <button className="secondary-button" type="button" onClick={() => setActiveModule("Notifications")}>Open Notification Center</button>
                <button className="secondary-button" type="button" onClick={() => setActiveModule("Configuration Studio")}>Open Configuration Studio</button>
              </div>
            </section>

            <section className="settings-card compact-settings-card">
              <div className="settings-card-head">
                <div>
                  <span>Control Summary</span>
                  <h3>Platform values in one table</h3>
                </div>
              </div>
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageCards.map((card) => (
                      <tr key={card.label}>
                        <td>{card.label}</td>
                        <td>{card.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
