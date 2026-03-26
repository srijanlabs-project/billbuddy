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

function formatTierLabel(value) {
  const normalized = String(value || "FREE").trim().toUpperCase();
  if (normalized === "PAID") return "Paid";
  if (normalized === "PREMIUM") return "Premium";
  if (normalized === "NICHE") return "Niche";
  return "Free";
}

export default function SettingsPage({
  currentModuleMeta,
  isPlatformAdmin,
  THEME_OPTIONS,
  theme,
  setTheme,
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
  quotationTemplate,
  setQuotationTemplate,
  QUOTATION_TEMPLATE_PRESETS,
  QUOTATION_THEME_OPTIONS,
  applyQuotationThemeSelection,
  handleQuotationHeaderImageChange,
  handleQuotationLogoImageChange,
  handleQuotationFooterImageChange,
  quotationPreview,
  renderTemplateText,
  handleSaveQuotationTemplate,
  usageOverview,
  setActiveModule,
  canEditSettings,
  currentSellerSubscription,
  getPlanTemplateAccessTier,
  isThemeAccessibleForTier,
  fixedFreeFooterBanner
}) {
  const [activeTab, setActiveTab] = useState("business");
  const [themeLibraryTier, setThemeLibraryTier] = useState(
    () => QUOTATION_THEME_OPTIONS[quotationTemplate.template_theme_key || "default"]?.accessTier || "FREE"
  );

  const usageCards = useMemo(() => renderUsageSummary(usageOverview), [usageOverview]);
  const previewBody = renderTemplateText(quotationTemplate.body_template, quotationPreview);
  const previewFooter = renderTemplateText(quotationTemplate.footer_text, quotationPreview);
  const showHeaderImage = Boolean(quotationTemplate.show_header_image && quotationTemplate.header_image_data);
  const showLogoOnly = Boolean(!showHeaderImage && quotationTemplate.show_logo_only && quotationTemplate.logo_image_data);
  const currentPlanTier = getPlanTemplateAccessTier(currentSellerSubscription);
  const isFreePlan = currentPlanTier === "FREE";
  const selectedThemeKey = quotationTemplate.template_theme_key || "default";
  const selectedTheme = QUOTATION_THEME_OPTIONS[selectedThemeKey] || QUOTATION_THEME_OPTIONS.default;
  const isSelectedThemeAccessible = isThemeAccessibleForTier(selectedTheme.accessTier, currentPlanTier);
  const canSaveQuotationFormat = canEditSettings && isSelectedThemeAccessible;
  const previewFooterBanner = isFreePlan
    ? fixedFreeFooterBanner
    : (quotationTemplate.show_footer_image && quotationTemplate.footer_image_data ? quotationTemplate.footer_image_data : null);
  const presetMeta = QUOTATION_TEMPLATE_PRESETS.default;
  const planName = currentSellerSubscription?.plan_name || currentSellerSubscription?.plan_code || "Demo Plan";

  const themeOptionsByTier = useMemo(
    () => Object.entries(QUOTATION_THEME_OPTIONS).reduce((accumulator, entry) => {
      const [, config] = entry;
      const tier = config.accessTier || "FREE";
      return {
        ...accumulator,
        [tier]: [...(accumulator[tier] || []), entry]
      };
    }, {}),
    [QUOTATION_THEME_OPTIONS]
  );

  const themeGroups = useMemo(
    () => ({
      FREE: themeOptionsByTier.FREE || [],
      PAID: themeOptionsByTier.PAID || [],
      PREMIUM: themeOptionsByTier.PREMIUM || [],
      NICHE: themeOptionsByTier.NICHE || []
    }),
    [themeOptionsByTier]
  );

  const filteredThemes = themeOptionsByTier[themeLibraryTier] || [];

  function updateTemplateField(field, value) {
    setQuotationTemplate((prev) => ({ ...prev, [field]: value }));
  }

  function handleThemeSelection(themeKey) {
    const tier = QUOTATION_THEME_OPTIONS[themeKey]?.accessTier || "FREE";
    setThemeLibraryTier(tier);
    applyQuotationThemeSelection(themeKey);
  }

  function renderThemePreviewBlock({ compact } = {}) {
    return (
      <div
        className={`settings-quotation-preview settings-quotation-preview-themed ${compact ? "settings-quotation-preview-compact" : ""}`}
        style={{
          "--preview-accent": selectedTheme.accent,
          "--preview-surface": selectedTheme.surface,
          "--preview-border": selectedTheme.border,
          "--preview-header": selectedTheme.header,
          "--preview-text": selectedTheme.text,
          "--preview-muted": selectedTheme.muted
        }}
      >
        {showHeaderImage ? (
          <div className="settings-preview-header-image-wrap">
            <img src={quotationTemplate.header_image_data} alt="Quotation header" className="settings-preview-header-image" />
          </div>
        ) : (
          <div className="settings-preview-hero settings-preview-hero-themed">
            <div className="settings-preview-brand-block">
              {showLogoOnly ? <img src={quotationTemplate.logo_image_data} alt="Logo" className="settings-preview-logo" /> : null}
              <div>
                <h5>{quotationTemplate.header_text || presetMeta.defaults.header_text || "Quotation"}</h5>
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
            <p>{quotationTemplate.notes_text || presetMeta.defaults.notes_text}</p>
            <h6>Terms & Conditions</h6>
            <p>{quotationTemplate.terms_text || presetMeta.defaults.terms_text}</p>
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
          {previewFooterBanner ? (
            <img src={previewFooterBanner} alt="Footer banner" className="settings-preview-footer-image settings-preview-footer-banner-edge" />
          ) : (
            <span>{previewFooter}</span>
          )}
        </div>
      </div>
    );
  }

  function renderThemeTierSection(tier, label, description) {
    const themes = themeGroups[tier] || [];
    if (!themes.length) return null;
    return (
      <section className="settings-panel settings-theme-tier-block">
        <div className="settings-panel-head">
          <h4>{label}</h4>
          <p>{description}</p>
        </div>
        <div className="settings-theme-library-grid">
          {themes.map(([key, config]) => {
            const active = key === selectedThemeKey;
            const accessible = isThemeAccessibleForTier(config.accessTier, currentPlanTier);
            return (
              <button
                key={key}
                type="button"
                className={`settings-theme-card ${active ? "active" : ""}`}
                onClick={() => handleThemeSelection(key)}
              >
                <div className="settings-theme-swatch-row">
                  <span style={{ background: config.header }} />
                  <span style={{ background: config.surface }} />
                  <span style={{ background: config.border }} />
                  <span style={{ background: config.accent }} />
                </div>
                <strong>{config.label}</strong>
                <small>{config.description}</small>
                <div className="settings-theme-card-meta">
                  <span className={`badge ${accessible ? "success" : "pending"}`}>{formatTierLabel(config.accessTier)}</span>
                  {!accessible ? <span className="settings-theme-locked">Contact sales</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  if (isPlatformAdmin) {
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
        </div>
      </section>
    );
  }

  const tabs = [
    { key: "business", label: "Business Info" },
    { key: "template", label: "Template" },
    { key: "themes", label: "Themes" },
    { key: "branding", label: "Branding" },
    { key: "content", label: "Content" },
    { key: "preview", label: "Preview" }
  ];

  return (
    <section className="workspace settings-workspace">
      <header className="section-head settings-page-head">
        <div>
          <span>{currentModuleMeta.eyebrow}</span>
          <h2>{currentModuleMeta.title}</h2>
          <p>{currentModuleMeta.subtitle}</p>
        </div>
      </header>

      <div className="settings-tab-shell glass-panel">
        <div className="settings-tab-header">
          <div>
            <span className="settings-tab-kicker">Business Settings</span>
            <h3>Manage your quotation structure and branding</h3>
            <p>Templates stay fixed, themes change the visual identity, and premium tiers remain gated for sales unlock.</p>
          </div>
          <div className="settings-tab-summary">
            <span className="badge neutral">{planName}</span>
            <span className={`badge ${isSelectedThemeAccessible ? "success" : "pending"}`}>Theme: {selectedTheme.label}</span>
          </div>
        </div>

        <nav className="settings-tab-nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`settings-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="settings-tab-body">
          {activeTab === "business" ? (
            <form className="settings-card compact-settings-card" onSubmit={handleSaveThemeSettings}>
              <div className="settings-card-head">
                <div>
                  <span>Business Settings</span>
                  <h3>Identity, GST, and banking</h3>
                  <p>Keep the reusable business information clear so every quotation starts from the same base.</p>
                </div>
                <button className="primary-button" type="submit" disabled={!canEditSettings}>Save Business Settings</button>
              </div>

              <div className="settings-form-grid settings-form-grid-wide">
                <section className="settings-panel">
                  <div className="settings-panel-head">
                    <h4>Brand Identity</h4>
                    <p>Workspace appearance stays separate from quotation themes.</p>
                  </div>
                  <div className="settings-two-column">
                    <label className="settings-field">
                      <span>Workspace Theme</span>
                      <select value={theme} onChange={(event) => setTheme(event.target.value)}>
                        {THEME_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="settings-field">
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
                    <p>Shown consistently in the quotation footer and closing section.</p>
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
          ) : null}

          {activeTab === "template" ? (
            <form className="settings-card compact-settings-card" onSubmit={handleSaveQuotationTemplate}>
              <div className="settings-card-head">
                <div>
                  <span>Template & Access</span>
                  <h3>Default template with plan-based theme access</h3>
                  <p>Everyone uses the same quotation structure. Plans decide which visual themes can be saved and published.</p>
                </div>
                <button className="primary-button" type="submit" disabled={!canSaveQuotationFormat}>
                  {isSelectedThemeAccessible ? "Save Quotation Format" : "Upgrade Required"}
                </button>
              </div>

              <div className="settings-plan-banner">
                <div className="settings-plan-banner-copy">
                  <span>Current Access</span>
                  <strong>{planName}</strong>
                  <p>Template access tier: <strong>{formatTierLabel(currentPlanTier)}</strong></p>
                  <p>{isFreePlan ? "Demo users can preview all themes but can save only Default." : "You can save and publish themes that match your plan tier."}</p>
                </div>
                <div className="settings-plan-badges">
                  <span className="settings-plan-chip">Template: {presetMeta.label}</span>
                  <span className={`settings-plan-chip ${isSelectedThemeAccessible ? "is-allowed" : "is-locked"}`}>Selected Theme: {selectedTheme.label}</span>
                </div>
              </div>

              {!isSelectedThemeAccessible ? (
                <div className="settings-upgrade-callout">
                  <strong>{formatTierLabel(selectedTheme.accessTier)} theme selected.</strong>
                  <p>Paid, Premium, and Niche quotation themes are available on higher plans. Please contact the sales team to unlock and publish this theme.</p>
                </div>
              ) : null}

              <div className="settings-theme-controls">
                  <section className="settings-panel">
                    <div className="settings-panel-head">
                      <h4>Step 1 - Select Template</h4>
                      <p>The quotation structure stays fixed as Default, while themes handle the visual look.</p>
                    </div>
                    <div className="settings-two-column settings-template-select-row">
                      <label className="settings-field settings-template-lock">
                        <span>Template</span>
                        <select value="default" disabled>
                          <option value="default">Default Template</option>
                        </select>
                      </label>
                      <label className="settings-field">
                        <span>Theme Access Tier</span>
                        <select
                          value={themeLibraryTier}
                          onChange={(event) => {
                            const nextTier = event.target.value;
                            setThemeLibraryTier(nextTier);
                            const nextTheme = themeOptionsByTier[nextTier]?.[0]?.[0];
                            if (nextTheme) {
                              handleThemeSelection(nextTheme);
                            }
                          }}
                        >
                          <option value="FREE">Free</option>
                          <option value="PAID">Paid</option>
                          <option value="PREMIUM">Premium</option>
                          <option value="NICHE">Niche</option>
                        </select>
                      </label>
                    </div>
                    <label className="settings-field">
                      <span>Theme Selection</span>
                      <select
                        value={selectedThemeKey}
                        onChange={(event) => handleThemeSelection(event.target.value)}
                      >
                        {filteredThemes.map(([key, config]) => (
                          <option key={key} value={key}>
                            {config.label} ({formatTierLabel(config.accessTier)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="settings-inline-note">Pick any tier to preview. Saving paid themes requires an upgraded plan.</p>
                  </section>

                  <section className="settings-panel">
                    <div className="settings-panel-head">
                      <h4>Step 2 - Choose Theme</h4>
                      <p>Preview and select the visual style for your quotation documents.</p>
                    </div>
                    <div className="settings-theme-library-grid">
                      {filteredThemes.map(([key, config]) => {
                        const active = key === selectedThemeKey;
                        const accessible = isThemeAccessibleForTier(config.accessTier, currentPlanTier);
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`settings-theme-card ${active ? "active" : ""}`}
                            onClick={() => handleThemeSelection(key)}
                          >
                            <div className="settings-theme-swatch-row">
                              <span style={{ background: config.header }} />
                              <span style={{ background: config.surface }} />
                              <span style={{ background: config.border }} />
                              <span style={{ background: config.accent }} />
                            </div>
                            <strong>{config.label}</strong>
                            <small>{config.description}</small>
                            <div className="settings-theme-card-meta">
                              <span className={`badge ${accessible ? "success" : "pending"}`}>{formatTierLabel(config.accessTier)}</span>
                              {!accessible ? <span className="settings-theme-locked">Contact sales</span> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="settings-panel">
                    <div className="settings-panel-head">
                      <h4>Live Preview</h4>
                      <p>Instantly see the template with the selected theme.</p>
                    </div>
                    {renderThemePreviewBlock({ compact: true })}
                  </section>
              </div>
            </form>
          ) : null}

          {activeTab === "themes" ? (
            <form className="settings-card compact-settings-card" onSubmit={handleSaveQuotationTemplate}>
              <div className="settings-card-head">
                <div>
                  <span>Theme Library</span>
                  <h3>Explore free, paid, and premium quotation themes</h3>
                  <p>Premium, paid, and niche themes are locked for sales unlock while still available for preview.</p>
                </div>
                <button className="primary-button" type="submit" disabled={!canSaveQuotationFormat}>
                  {isSelectedThemeAccessible ? "Save Theme" : "Upgrade Required"}
                </button>
              </div>

              {!isSelectedThemeAccessible ? (
                <div className="settings-upgrade-callout">
                  <strong>{formatTierLabel(selectedTheme.accessTier)} theme selected.</strong>
                  <p>Please contact the sales team to enable Paid, Premium, and Niche themes for publishing.</p>
                </div>
              ) : null}

              <div className="settings-theme-grid-layout">
                <div className="settings-theme-controls">
                  {renderThemeTierSection("FREE", "Free Themes", "Available for every plan, including demo users.")}
                  {renderThemeTierSection("PAID", "Paid Themes", "Professional presets for growth stage sellers. Contact sales to unlock.")}
                  {renderThemeTierSection("PREMIUM", "Premium Themes", "Polished brand-driven themes for premium subscriptions.")}
                  {renderThemeTierSection("NICHE", "Niche Themes", "Bold, distinctive looks reserved for niche plans.")}
                </div>

                <aside className="settings-preview-sticky">
                  <div className="settings-panel">
                    <div className="settings-panel-head">
                      <h4>Theme Preview</h4>
                      <p>Preview the selected theme with your current content.</p>
                    </div>
                    {renderThemePreviewBlock({ compact: true })}
                  </div>
                </aside>
              </div>
            </form>
          ) : null}

          {activeTab === "branding" ? (
            <form className="settings-card compact-settings-card" onSubmit={handleSaveQuotationTemplate}>
              <div className="settings-card-head">
                <div>
                  <span>Branding</span>
                  <h3>Header, logo, and footer assets</h3>
                  <p>Keep the same template layout while swapping brand assets for each seller.</p>
                </div>
                <button className="primary-button" type="submit" disabled={!canSaveQuotationFormat}>
                  {isSelectedThemeAccessible ? "Save Branding" : "Upgrade Required"}
                </button>
              </div>

              <div className="settings-theme-grid-layout">
                <div className="settings-theme-controls">
                  <section className="settings-panel">
                    <div className="settings-panel-head">
                      <h4>Brand Assets</h4>
                      <p>Header image and logo stay editable. Footer banner is locked for free/demo sellers.</p>
                    </div>
                    <div className="settings-image-grid">
                      <label className="settings-field">
                        {renderInlineHelp("Header Image", "Use a full-width header image when you want the image itself to represent the quotation brand.")}
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
                          <span>Header text and logo are suppressed when a full-width image is active.</span>
                        </div>
                      </label>
                      <label className="settings-field">
                        {renderInlineHelp("Logo Image", "Use logo mode when you want a logo with text-based company details beside it.")}
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
                          <span>Best for a lighter header while keeping contact text visible.</span>
                        </div>
                      </label>
                      {!isFreePlan ? (
                        <>
                          <label className="settings-field">
                            {renderInlineHelp("Footer Image", "Upload a footer banner/signature strip for paid themes.")}
                            <input type="file" accept="image/*" onChange={handleQuotationFooterImageChange} />
                          </label>
                          <label className="settings-inline-toggle">
                            <input
                              type="checkbox"
                              checked={Boolean(quotationTemplate.show_footer_image)}
                              onChange={(event) => updateTemplateField("show_footer_image", event.target.checked)}
                            />
                            <div>
                              <strong>Use footer image</strong>
                              <span>Paid plans can override footer text with a custom banner.</span>
                            </div>
                          </label>
                        </>
                      ) : (
                        <div className="settings-locked-footer-note">
                          <strong>Free footer banner applied</strong>
                          <span>The Quotsy footer banner is fixed for demo and free usage and cannot be removed.</span>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="settings-panel">
                    <div className="settings-panel-head">
                      <h4>Asset Preview</h4>
                      <p>Confirm the uploaded assets before publishing.</p>
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
                      <div className="settings-asset-preview-card">
                        <div className="settings-asset-head">
                          <strong>Footer Preview</strong>
                          {!isFreePlan && quotationTemplate.footer_image_data ? (
                            <button className="text-button" type="button" onClick={() => updateTemplateField("footer_image_data", null)}>Remove</button>
                          ) : null}
                        </div>
                        {previewFooterBanner ? (
                          <img src={previewFooterBanner} alt="Footer preview" className="settings-asset-preview-image settings-asset-preview-footer-banner" />
                        ) : (
                          <p>No footer image uploaded yet.</p>
                        )}
                      </div>
                    </div>
                  </section>
                </div>

                <aside className="settings-preview-sticky">
                  <div className="settings-panel">
                    <div className="settings-panel-head">
                      <h4>Document Preview</h4>
                      <p>Review the branding inside the live quotation layout.</p>
                    </div>
                    {renderThemePreviewBlock({ compact: true })}
                  </div>
                </aside>
              </div>
            </form>
          ) : null}

          {activeTab === "content" ? (
            <form className="settings-card compact-settings-card" onSubmit={handleSaveQuotationTemplate}>
              <div className="settings-card-head">
                <div>
                  <span>Content</span>
                  <h3>Default notes, terms, and communication controls</h3>
                  <p>These text blocks remain constant across all themes so only the visual treatment changes.</p>
                </div>
                <button className="primary-button" type="submit" disabled={!canSaveQuotationFormat}>
                  {isSelectedThemeAccessible ? "Save Content" : "Upgrade Required"}
                </button>
              </div>

              <div className="settings-form-grid settings-form-grid-wide">
                <section className="settings-panel">
                  <div className="settings-panel-head">
                    <h4>Quotation Content</h4>
                    <p>Use short, clear copy. These fields flow into the main quotation body.</p>
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

                <section className="settings-panel">
                  <div className="settings-panel-head">
                    <h4>Sharing Controls</h4>
                    <p>Keep delivery options visible without mixing them into theme selection.</p>
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
          ) : null}

          {activeTab === "preview" ? (
            <div className="settings-card compact-settings-card">
              <div className="settings-card-head">
                <div>
                  <span>Preview</span>
                  <h3>Quotation preview</h3>
                  <p>Review the current template and theme before saving changes.</p>
                </div>
                <button className="primary-button" type="button" disabled={!canSaveQuotationFormat} onClick={handleSaveQuotationTemplate}>
                  {isSelectedThemeAccessible ? "Save Changes" : "Upgrade Required"}
                </button>
              </div>
              {renderThemePreviewBlock()}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
