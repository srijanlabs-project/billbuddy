export default function PlanDetailModal(props) {
  const {
    showPlanDetailModal,
    selectedPlanDetail,
    closePlanDetailModal,
    getPlanDraft,
    updatePlanDraft,
    BILLING_CYCLE_OPTIONS,
    handlePlanDetailSave
  } = props;

  if (!showPlanDetailModal || !selectedPlanDetail) return null;

  const draft = getPlanDraft(selectedPlanDetail);
  const featureToggles = [
    { key: "isActive", label: "Active" },
    { key: "isDemoPlan", label: "Demo Plan" },
    { key: "trialEnabled", label: "Trial Enabled" },
    { key: "inventoryEnabled", label: "Inventory" },
    { key: "reportsEnabled", label: "Reports" },
    { key: "gstEnabled", label: "GST" },
    { key: "exportsEnabled", label: "Exports" },
    { key: "quotationWatermarkEnabled", label: "Watermark" },
    { key: "quotationCreationLockedAfterExpiry", label: "Lock After Expiry" }
  ];
  const websiteToggles = [
    { key: "landingFeatured", label: "Landing Featured Plan" },
    { key: "websiteVisible", label: "Show on Website" }
  ];

  return (
    <div className="modal-overlay" onClick={(event) => event.stopPropagation()}>
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
            <span className="badge pending">{selectedPlanDetail.is_demo_plan ? "Demo plan" : `${selectedPlanDetail.plan_access_type || "FREE"} plan`}</span>
            <span className="badge neutral">{selectedPlanDetail.template_access_tier || (selectedPlanDetail.is_demo_plan ? "FREE" : "PAID")} templates</span>
          </div>
        </section>

        <div className="seller-detail-grid plan-detail-layout">
          <div className="plan-detail-main">
            <article className="seller-detail-card plan-detail-card">
            <h4>Commercials</h4>
            <div className="seller-lifecycle-grid plan-form-grid">
              <label>
                <span>Plan Code</span>
                <input value={draft.planCode} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "planCode", e.target.value.toUpperCase())} />
              </label>
              <label>
                <span>Plan Name</span>
                <input value={draft.planName} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "planName", e.target.value)} />
              </label>
              <label>
                <span>Price</span>
                <input type="number" min="0" step="0.01" value={draft.price} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "price", e.target.value)} />
              </label>
              <label>
                <span>Billing Cycle</span>
                <select value={draft.billingCycle} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "billingCycle", e.target.value)}>
                  {BILLING_CYCLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>
                <span>Plan Access</span>
                <select value={draft.planAccessType} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "planAccessType", e.target.value)}>
                  <option value="FREE">Free</option>
                  <option value="PAID">Paid</option>
                </select>
              </label>
              <label>
                <span>Template Tier</span>
                <select value={draft.templateAccessTier} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "templateAccessTier", e.target.value)}>
                  <option value="FREE">Free</option>
                  <option value="PAID">Paid</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="NICHE">Niche</option>
                </select>
              </label>
              <label>
                <span>Trial Days</span>
                <input type="number" min="0" value={draft.trialDurationDays} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "trialDurationDays", e.target.value)} />
              </label>
              <label>
                <span>Watermark Text</span>
                <input value={draft.watermarkText} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "watermarkText", e.target.value)} />
              </label>
              <label>
                <span>Landing CTA Label</span>
                <input value={draft.landingCtaLabel} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "landingCtaLabel", e.target.value)} />
              </label>
              <label>
                <span>Landing CTA Link</span>
                <input value={draft.landingCtaLink} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "landingCtaLink", e.target.value)} />
              </label>
              <label className="plan-field-full">
                <span>Website Pointers (one per line)</span>
                <textarea rows={6} value={draft.websitePointers} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "websitePointers", e.target.value)} />
              </label>
            </div>
            </article>

            <article className="seller-detail-card plan-detail-card">
            <h4>Limits</h4>
            <div className="seller-lifecycle-grid plan-limits-grid">
              <label>
                <span>Max Users</span>
                <input type="number" min="0" value={draft.maxUsers} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "maxUsers", e.target.value)} />
              </label>
              <label>
                <span>Max Quotations</span>
                <input type="number" min="0" value={draft.maxQuotations} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "maxQuotations", e.target.value)} />
              </label>
              <label>
                <span>Max Customers</span>
                <input type="number" min="0" value={draft.maxCustomers} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "maxCustomers", e.target.value)} />
              </label>
            </div>
            </article>
          </div>

          <article className="seller-detail-card plan-detail-card plan-feature-access-card">
            <h4>Feature Access</h4>
            <div className="plan-feature-group">
              <p className="plan-feature-group-title">Access and behavior</p>
              <div className="plan-toggle-grid">
                {featureToggles.map((toggle) => (
                  <label key={toggle.key} className="seller-toggle plan-toggle-row">
                    <span>{toggle.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(draft[toggle.key])}
                      onChange={(e) => updatePlanDraft(selectedPlanDetail.id, toggle.key, e.target.checked)}
                      style={{ width: "auto" }}
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="plan-feature-group">
              <p className="plan-feature-group-title">Landing visibility</p>
              <div className="plan-toggle-grid">
                {websiteToggles.map((toggle) => (
                  <label key={toggle.key} className="seller-toggle plan-toggle-row">
                    <span>{toggle.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(draft[toggle.key])}
                      onChange={(e) => updatePlanDraft(selectedPlanDetail.id, toggle.key, e.target.checked)}
                      style={{ width: "auto" }}
                    />
                  </label>
                ))}
              </div>
            </div>
          </article>
        </div>

        <div className="modal-fixed-actions">
          <button type="button" className="ghost-btn" onClick={closePlanDetailModal}>Close</button>
          <button type="button" onClick={handlePlanDetailSave}>Save Plan</button>
        </div>
      </div>
    </div>
  );
}
