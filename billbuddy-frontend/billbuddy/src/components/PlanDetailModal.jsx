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
                <span>Plan Access</span>
                <select value={getPlanDraft(selectedPlanDetail).planAccessType} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "planAccessType", e.target.value)}>
                  <option value="FREE">Free</option>
                  <option value="PAID">Paid</option>
                </select>
              </label>
              <label>
                <span>Template Tier</span>
                <select value={getPlanDraft(selectedPlanDetail).templateAccessTier} onChange={(e) => updatePlanDraft(selectedPlanDetail.id, "templateAccessTier", e.target.value)}>
                  <option value="FREE">Free</option>
                  <option value="PAID">Paid</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="NICHE">Niche</option>
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
  );
}
