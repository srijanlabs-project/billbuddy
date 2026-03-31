export default function SellerDetailModal(props) {
  const {
    showSellerDetailModal,
    closeSellerDetailModal,
    sellerDetailLoading,
    selectedSellerDetail,
    getSellerLifecycleDraft,
    updateSellerLifecycleDraft,
    SELLER_STATUS_OPTIONS,
    plans,
    SUBSCRIPTION_STATUS_OPTIONS,
    formatCurrency,
    formatDateTime,
    formatAuditActionLabel,
    openSellerConfigurationStudio,
    openSubscriptionDetail,
    handleSellerDetailSave
  } = props;

  if (!showSellerDetailModal) return null;

  return (
    <div className="modal-overlay" onClick={closeSellerDetailModal}>
      <div className="modal-card modal-wide glass-panel seller-detail-modal" onClick={(event) => event.stopPropagation()}>
        <div className="section-head">
          <h3>Seller Detail</h3>
          <button type="button" className="ghost-btn" onClick={closeSellerDetailModal}>Close</button>
        </div>

        {sellerDetailLoading && !selectedSellerDetail ? (
          <p className="muted">Loading seller detail...</p>
        ) : selectedSellerDetail ? (
          <>
            <section className="seller-detail-hero">
              <div>
                <p className="eyebrow">Tenant profile</p>
                <h3>{selectedSellerDetail.seller.name}</h3>
                <p>{selectedSellerDetail.seller.business_name || "Business name not set"}</p>
              </div>
              <div className="seller-detail-badges">
                <span className={`badge ${selectedSellerDetail.seller.is_locked ? "pending" : "success"}`}>
                  {selectedSellerDetail.seller.is_locked ? "Locked" : (selectedSellerDetail.seller.status || "active")}
                </span>
                <span className="badge pending">{selectedSellerDetail.seller.subscription_status || "no subscription"}</span>
              </div>
            </section>

            <div className="seller-detail-grid">
              <article className="seller-detail-card">
                <h4>Profile</h4>
                <div className="seller-detail-list">
                  <div><span>Seller code</span><strong>{selectedSellerDetail.seller.seller_code}</strong></div>
                  <div><span>Business name</span><strong>{selectedSellerDetail.seller.business_name || "-"}</strong></div>
                  <div><span>Mobile</span><strong>{selectedSellerDetail.seller.mobile || "-"}</strong></div>
                  <div><span>Email</span><strong>{selectedSellerDetail.seller.email || "-"}</strong></div>
                  <div><span>City / State</span><strong>{[selectedSellerDetail.seller.city, selectedSellerDetail.seller.state].filter(Boolean).join(", ") || "-"}</strong></div>
                  <div><span>GST</span><strong>{selectedSellerDetail.seller.gst_number || "-"}</strong></div>
                  <div><span>Seller Type</span><strong>{String(selectedSellerDetail.seller.seller_type || "BASIC").toUpperCase() === "ADVANCED" ? "ADVANCED" : "BASIC"}</strong></div>
                </div>
              </article>

              <article className="seller-detail-card">
                <h4>Lifecycle Controls</h4>
                <div className="seller-lifecycle-grid">
                  <label>
                    <span>Seller Status</span>
                    <select
                      value={getSellerLifecycleDraft(selectedSellerDetail.seller).status}
                      onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "status", e.target.value)}
                    >
                      {SELLER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Subscription Plan</span>
                    <select
                      value={getSellerLifecycleDraft(selectedSellerDetail.seller).subscriptionPlan}
                      onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "subscriptionPlan", e.target.value)}
                    >
                      <option value="">Select Plan</option>
                      {plans.map((plan) => <option key={plan.id} value={plan.plan_code}>{plan.plan_name} ({plan.plan_code})</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Subscription Status</span>
                    <select
                      value={getSellerLifecycleDraft(selectedSellerDetail.seller).subscriptionStatus}
                      onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "subscriptionStatus", e.target.value)}
                    >
                      {SUBSCRIPTION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Trial End</span>
                    <input
                      type="date"
                      value={getSellerLifecycleDraft(selectedSellerDetail.seller).trialEndsAt}
                      onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "trialEndsAt", e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Max Users</span>
                    <input
                      type="number"
                      min="0"
                      value={getSellerLifecycleDraft(selectedSellerDetail.seller).maxUsers}
                      onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "maxUsers", e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Max Orders / Month</span>
                    <input
                      type="number"
                      min="0"
                      value={getSellerLifecycleDraft(selectedSellerDetail.seller).maxOrdersPerMonth}
                      onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "maxOrdersPerMonth", e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Seller Type</span>
                    <select
                      value={getSellerLifecycleDraft(selectedSellerDetail.seller).sellerType}
                      onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "sellerType", e.target.value)}
                    >
                      {String(selectedSellerDetail.seller.seller_type || "BASIC").trim().toUpperCase() === "ADVANCED" ? (
                        <>
                          <option value="ADVANCED">Advanced</option>
                          <option value="BASIC" disabled>Basic (Downgrade Not Allowed)</option>
                        </>
                      ) : (
                        <>
                          <option value="BASIC">Basic</option>
                          <option value="ADVANCED">Advanced</option>
                        </>
                      )}
                    </select>
                    <small className="muted">Upgrade from Basic to Advanced is allowed. Downgrade is blocked.</small>
                  </label>
                  <label>
                    <span>Onboarding</span>
                    <select
                      value={getSellerLifecycleDraft(selectedSellerDetail.seller).onboardingStatus}
                      onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "onboardingStatus", e.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="setup">Setup</option>
                      <option value="complete">Complete</option>
                    </select>
                  </label>
                  <label className="seller-toggle seller-toggle-inline">
                    <input
                      type="checkbox"
                      checked={Boolean(getSellerLifecycleDraft(selectedSellerDetail.seller).isLocked)}
                      onChange={(e) => updateSellerLifecycleDraft(selectedSellerDetail.seller.id, "isLocked", e.target.checked)}
                      style={{ width: "auto" }}
                    />
                    Locked
                  </label>
                </div>
              </article>

              <article className="seller-detail-card">
                <h4>Usage Snapshot</h4>
                <div className="seller-detail-list">
                  <div><span>Users</span><strong>{selectedSellerDetail.usage?.userCount || 0}</strong></div>
                  <div><span>Customers</span><strong>{selectedSellerDetail.usage?.customerCount || 0}</strong></div>
                  <div><span>Quotations</span><strong>{selectedSellerDetail.usage?.quotationCount || 0}</strong></div>
                  <div><span>Revenue</span><strong>{formatCurrency(selectedSellerDetail.usage?.totalRevenue || 0)}</strong></div>
                  <div><span>Last login</span><strong>{formatDateTime(selectedSellerDetail.usage?.lastLoginAt)}</strong></div>
                  <div><span>Onboarding</span><strong>{selectedSellerDetail.seller.onboarding_status || "-"}</strong></div>
                </div>
              </article>
            </div>

            <section className="seller-detail-section">
              <div className="section-head compact">
                <h3>Seller Users</h3>
                <span>{selectedSellerDetail.users?.length || 0} user(s)</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Mobile</th><th>Status</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {(selectedSellerDetail.users || []).length === 0 ? (
                    <tr><td colSpan="4">No seller users created yet.</td></tr>
                  ) : (
                    (selectedSellerDetail.users || []).map((user) => (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>{user.mobile || "-"}</td>
                        <td>{user.locked ? "Locked" : (user.status ? "Active" : "Inactive")}</td>
                        <td>{formatDateTime(user.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="seller-detail-section">
              <div className="section-head compact">
                <h3>Activity History</h3>
                <span>{selectedSellerDetail.auditLogs?.length || 0} entries</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>When</th><th>Action</th><th>Actor</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {(selectedSellerDetail.auditLogs || []).length === 0 ? (
                    <tr><td colSpan="4">No platform activity recorded yet.</td></tr>
                  ) : (
                    (selectedSellerDetail.auditLogs || []).map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatDateTime(entry.created_at)}</td>
                        <td>{formatAuditActionLabel(entry.action_key)}</td>
                        <td>{entry.actor_name || entry.actor_mobile || "System"}</td>
                        <td><pre className="audit-detail">{JSON.stringify(entry.detail || {}, null, 2)}</pre></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <div className="modal-fixed-actions">
              <button type="button" className="ghost-btn" onClick={closeSellerDetailModal}>Close</button>
              <button type="button" className="ghost-btn" onClick={() => openSellerConfigurationStudio(selectedSellerDetail.seller)}>Open Config Studio</button>
              <button type="button" className="ghost-btn" onClick={() => openSubscriptionDetail(selectedSellerDetail.seller)}>Open Subscription</button>
              <button type="button" onClick={handleSellerDetailSave}>Save Seller</button>
            </div>
          </>
        ) : (
          <p className="muted">Seller detail is unavailable right now.</p>
        )}
      </div>
    </div>
  );
}
