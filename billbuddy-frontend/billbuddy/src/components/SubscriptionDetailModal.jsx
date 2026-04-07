export default function SubscriptionDetailModal(props) {
  const {
    showSubscriptionModal,
    selectedSellerSubscription,
    closeSubscriptionModal,
    subscriptionModalDraft,
    setSubscriptionModalDraft,
    plans,
    SUBSCRIPTION_STATUS_OPTIONS,
    handleSaveSubscriptionModal,
    canConvertToPaid,
    handleConvertToPaid,
    formatDateIST,
    formatDateTime,
    formatAuditActionLabel
  } = props;

  if (!showSubscriptionModal || !selectedSellerSubscription) return null;

  return (
    <div className="modal-overlay" onClick={(event) => event.stopPropagation()}>
      <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
        <div className="section-head">
          <h3>Subscription Detail</h3>
          <button type="button" className="ghost-btn" onClick={closeSubscriptionModal}>Close</button>
        </div>
        <div className="seller-meta-stack" style={{ marginBottom: "14px" }}>
          <strong>{selectedSellerSubscription.seller.name}</strong>
          <span>{selectedSellerSubscription.seller.seller_code}</span>
          <span>{selectedSellerSubscription.seller.email || selectedSellerSubscription.seller.mobile || "-"}</span>
        </div>
        <div className="seller-lifecycle-grid">
          <label>
            <span>Plan</span>
            <select value={subscriptionModalDraft.planCode} onChange={(e) => setSubscriptionModalDraft((prev) => ({ ...prev, planCode: e.target.value }))}>
              <option value="">Select Plan</option>
              {plans.map((plan) => <option key={plan.id} value={plan.plan_code}>{plan.plan_name} ({plan.plan_code})</option>)}
            </select>
          </label>
          <label>
            <span>Subscription Status</span>
            <select value={subscriptionModalDraft.status} onChange={(e) => setSubscriptionModalDraft((prev) => ({ ...prev, status: e.target.value }))}>
              {SUBSCRIPTION_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>Trial End</span>
            <input type="date" value={subscriptionModalDraft.trialEndAt} onChange={(e) => setSubscriptionModalDraft((prev) => ({ ...prev, trialEndAt: e.target.value }))} />
          </label>
          <label className="seller-toggle" style={{ alignSelf: "end" }}>
            <input type="checkbox" checked={subscriptionModalDraft.convertedFromTrial} onChange={(e) => setSubscriptionModalDraft((prev) => ({ ...prev, convertedFromTrial: e.target.checked }))} style={{ width: "auto" }} />
            Converted From Trial
          </label>
        </div>
        <div className="seller-lifecycle-actions" style={{ marginTop: "16px" }}>
          <button type="button" className="ghost-btn" onClick={handleSaveSubscriptionModal}>Save Subscription</button>
          {canConvertToPaid(subscriptionModalDraft.planCode, subscriptionModalDraft.status, plans) && (
            <button type="button" className="compact-btn" onClick={handleConvertToPaid}>Convert To Paid</button>
          )}
        </div>
        <table className="data-table" style={{ marginTop: "18px" }}>
          <thead>
            <tr><th>Plan</th><th>Status</th><th>Trial</th><th>Start</th><th>End</th></tr>
          </thead>
          <tbody>
            {(selectedSellerSubscription.subscriptions || []).map((subscription) => (
              <tr key={subscription.id}>
                <td>{subscription.plan_name || subscription.plan_code}</td>
                <td>{subscription.status}</td>
                <td>{formatDateIST(subscription.trial_end_at)}</td>
                <td>{formatDateIST(subscription.start_date)}</td>
                <td>{formatDateIST(subscription.end_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="section-head compact" style={{ marginTop: "18px" }}>
          <h3>Change History</h3>
          <span>{(selectedSellerSubscription.auditLogs || []).length} event(s)</span>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>When</th><th>Action</th><th>Actor</th><th>Details</th></tr>
          </thead>
          <tbody>
            {(selectedSellerSubscription.auditLogs || []).length === 0 ? (
              <tr><td colSpan="4">No subscription audit found yet.</td></tr>
            ) : (
              (selectedSellerSubscription.auditLogs || []).map((entry) => (
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
      </div>
    </div>
  );
}
