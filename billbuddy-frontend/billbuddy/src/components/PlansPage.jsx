export default function PlansPage(props) {
  const {
    activeModule,
    currentModuleMeta,
    plans,
    planSearch,
    setPlanSearch,
    filteredPlans,
    setShowPlanCreateModal,
    openPlanDetail,
    formatCurrency,
    showPlanCreateModal,
    handleCreatePlan,
    error,
    planForm,
    setPlanForm,
    BILLING_CYCLE_OPTIONS
  } = props;

  if (activeModule !== "Plans") return null;

  return (
    <section className="module-placeholder glass-panel">
      <div className="page-banner">
        <div>
          <p className="eyebrow">{currentModuleMeta.Plans.eyebrow}</p>
          <h2>{currentModuleMeta.Plans.title}</h2>
          <p>{currentModuleMeta.Plans.subtitle}</p>
        </div>
        <div className="banner-stat">
          <span>Total Plans</span>
          <strong>{plans.length}</strong>
        </div>
      </div>

      <div className="section-head">
        <h3>Plan List</h3>
        <div className="toolbar-controls">
          <input
            type="search"
            className="toolbar-search"
            placeholder="Search plan, code, billing..."
            value={planSearch}
            onChange={(e) => setPlanSearch(e.target.value)}
          />
          <span>{filteredPlans.length} plan(s)</span>
          <button type="button" className="action-btn" onClick={() => setShowPlanCreateModal(true)}>Create New Plan</button>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Plan</th><th>Access</th><th>Price</th><th>Billing</th><th>Trial</th><th>Users</th><th>Status</th></tr>
        </thead>
        <tbody>
          {filteredPlans.length === 0 ? (
            <tr><td colSpan="7">No plans created yet.</td></tr>
          ) : (
            filteredPlans.map((plan) => (
              <tr key={plan.id} className="lead-row" onClick={() => openPlanDetail(plan)}>
                <td>
                  <strong>{plan.plan_name}</strong>
                  <div className="seller-meta-stack">
                    <span>{plan.plan_code}</span>
                    <span>{plan.is_demo_plan ? "Demo plan" : `${plan.plan_access_type || "FREE"} plan`}</span>
                  </div>
                </td>
                <td>{plan.template_access_tier || (plan.is_demo_plan ? "FREE" : "PAID")}</td>
                <td>{formatCurrency(plan.price || 0)}</td>
                <td>{plan.billing_cycle || "-"}</td>
                <td>{plan.trial_enabled ? `${plan.trial_duration_days || 0} days` : "No"}</td>
                <td>{plan.max_users ?? "-"}</td>
                <td><span className={`badge ${plan.is_active ? "success" : "pending"}`}>{plan.is_active ? "Active" : "Inactive"}</span></td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {showPlanCreateModal && (
        <div className="modal-overlay" onClick={() => setShowPlanCreateModal(false)}>
          <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Create Plan</h3>
              <button type="button" className="ghost-btn" onClick={() => setShowPlanCreateModal(false)}>Close</button>
            </div>
            {error && <div className="notice error">{error}</div>}
            <form className="auth-card compact-form" onSubmit={handleCreatePlan}>
              <div className="seller-lifecycle-grid">
                <input placeholder="Plan Code" value={planForm.planCode} onChange={(e) => setPlanForm((prev) => ({ ...prev, planCode: e.target.value.toUpperCase() }))} required />
                <input placeholder="Plan Name" value={planForm.planName} onChange={(e) => setPlanForm((prev) => ({ ...prev, planName: e.target.value }))} required />
                <input placeholder="Price" type="number" min="0" step="0.01" value={planForm.price} onChange={(e) => setPlanForm((prev) => ({ ...prev, price: e.target.value }))} />
                <select value={planForm.billingCycle} onChange={(e) => setPlanForm((prev) => ({ ...prev, billingCycle: e.target.value }))}>
                  {BILLING_CYCLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select value={planForm.planAccessType} onChange={(e) => setPlanForm((prev) => ({ ...prev, planAccessType: e.target.value }))}>
                  <option value="FREE">Free</option>
                  <option value="PAID">Paid</option>
                </select>
                <select value={planForm.templateAccessTier} onChange={(e) => setPlanForm((prev) => ({ ...prev, templateAccessTier: e.target.value }))}>
                  <option value="FREE">Free</option>
                  <option value="PAID">Paid</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="NICHE">Niche</option>
                </select>
                <input placeholder="Trial Days" type="number" min="0" value={planForm.trialDurationDays} onChange={(e) => setPlanForm((prev) => ({ ...prev, trialDurationDays: e.target.value }))} />
                <input placeholder="Watermark Text" value={planForm.watermarkText} onChange={(e) => setPlanForm((prev) => ({ ...prev, watermarkText: e.target.value }))} />
                <input placeholder="Max Users" type="number" min="0" value={planForm.maxUsers} onChange={(e) => setPlanForm((prev) => ({ ...prev, maxUsers: e.target.value }))} />
                <input placeholder="Max Quotations" type="number" min="0" value={planForm.maxQuotations} onChange={(e) => setPlanForm((prev) => ({ ...prev, maxQuotations: e.target.value }))} />
                <input placeholder="Max Customers" type="number" min="0" value={planForm.maxCustomers} onChange={(e) => setPlanForm((prev) => ({ ...prev, maxCustomers: e.target.value }))} />
              </div>
              <div className="seller-lifecycle-grid">
                <label className="seller-toggle"><input type="checkbox" checked={planForm.isActive} onChange={(e) => setPlanForm((prev) => ({ ...prev, isActive: e.target.checked }))} style={{ width: "auto" }} />Active</label>
                <label className="seller-toggle"><input type="checkbox" checked={planForm.isDemoPlan} onChange={(e) => setPlanForm((prev) => ({ ...prev, isDemoPlan: e.target.checked }))} style={{ width: "auto" }} />Demo Plan</label>
                <label className="seller-toggle"><input type="checkbox" checked={planForm.trialEnabled} onChange={(e) => setPlanForm((prev) => ({ ...prev, trialEnabled: e.target.checked }))} style={{ width: "auto" }} />Trial Enabled</label>
                <label className="seller-toggle"><input type="checkbox" checked={planForm.inventoryEnabled} onChange={(e) => setPlanForm((prev) => ({ ...prev, inventoryEnabled: e.target.checked }))} style={{ width: "auto" }} />Inventory</label>
                <label className="seller-toggle"><input type="checkbox" checked={planForm.reportsEnabled} onChange={(e) => setPlanForm((prev) => ({ ...prev, reportsEnabled: e.target.checked }))} style={{ width: "auto" }} />Reports</label>
                <label className="seller-toggle"><input type="checkbox" checked={planForm.gstEnabled} onChange={(e) => setPlanForm((prev) => ({ ...prev, gstEnabled: e.target.checked }))} style={{ width: "auto" }} />GST</label>
                <label className="seller-toggle"><input type="checkbox" checked={planForm.exportsEnabled} onChange={(e) => setPlanForm((prev) => ({ ...prev, exportsEnabled: e.target.checked }))} style={{ width: "auto" }} />Exports</label>
                <label className="seller-toggle"><input type="checkbox" checked={planForm.quotationWatermarkEnabled} onChange={(e) => setPlanForm((prev) => ({ ...prev, quotationWatermarkEnabled: e.target.checked }))} style={{ width: "auto" }} />Watermark</label>
                <label className="seller-toggle"><input type="checkbox" checked={planForm.quotationCreationLockedAfterExpiry} onChange={(e) => setPlanForm((prev) => ({ ...prev, quotationCreationLockedAfterExpiry: e.target.checked }))} style={{ width: "auto" }} />Lock After Expiry</label>
              </div>
              <button type="submit">Create Plan</button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
