export default function SubscriptionsPage(props) {
  const {
    activeModule,
    currentModuleMeta,
    subscriptions,
    isPlatformAdmin,
    subscriptionSearch,
    setSubscriptionSearch,
    filteredSubscriptions,
    currentSellerSubscription,
    formatDateIST,
    openSubscriptionDetail
  } = props;

  if (activeModule !== "Subscriptions") return null;

  const currentPlanName = currentSellerSubscription?.plan_name || currentSellerSubscription?.plan_code || "No active plan";
  const currentPlanStatus = currentSellerSubscription?.status || "-";
  const currentPlanBilling = currentSellerSubscription?.billing_cycle || "-";

  return (
    <section className="module-placeholder glass-panel subscriptions-modern-shell">
      <div className="page-banner">
        <div>
          <p className="eyebrow">Plan</p>
          <h2>Subscription History</h2>
          <p>{currentModuleMeta.Subscriptions.subtitle}</p>
        </div>
        <div className="banner-stat subscriptions-total-card">
          <span>Total Subscriptions</span>
          <strong>{subscriptions.length}</strong>
        </div>
      </div>

      <div className="section-head subscriptions-toolbar">
        <h3>Subscription List</h3>
        <div className="toolbar-controls subscriptions-search-wrap">
          <input
            type="search"
            className="toolbar-search"
            placeholder={isPlatformAdmin ? "Search seller, plan, status..." : "Search plan, status, billing..."}
            value={subscriptionSearch}
            onChange={(e) => setSubscriptionSearch(e.target.value)}
          />
        </div>
      </div>

      {!isPlatformAdmin && (
        <div className="seller-subscription-summary subscriptions-current-block">
          <div className="seller-subscription-summary-card subscriptions-current-plan-card">
            <div className="subscriptions-current-plan-head">
              <span className="eyebrow">Current Active Plan</span>
              <button type="button" className="action-btn compact-btn subscriptions-upgrade-btn">Upgrade</button>
            </div>
            <h3>{currentPlanName}</h3>
            <div className="seller-detail-list">
              <div><span>Status</span><strong>{currentPlanStatus}</strong></div>
              <div><span>Billing</span><strong>{currentPlanBilling}</strong></div>
              <div><span>Trial End</span><strong>{formatDateIST(currentSellerSubscription?.trial_end_at)}</strong></div>
              <div><span>Start Date</span><strong>{formatDateIST(currentSellerSubscription?.start_date)}</strong></div>
            </div>
          </div>
          <div className="seller-subscription-summary-card subscriptions-current-info-card">
            <h4>New subscription list</h4>
            <p className="muted">Review all active, trial, expired, and suspended subscriptions for this seller account below.</p>
          </div>
        </div>
      )}

      <div className="subscriptions-table-wrap">
      <table className="data-table subscriptions-table">
        <thead>
          <tr>
            {isPlatformAdmin ? <th>Seller</th> : <th>Subscription</th>}
            <th>Plan</th>
            <th>Status</th>
            <th>Trial End</th>
            <th>Start</th>
            <th>End</th>
          </tr>
        </thead>
        <tbody>
          {filteredSubscriptions.length === 0 ? (
            <tr><td colSpan="6">No subscriptions found.</td></tr>
          ) : (
            filteredSubscriptions.map((subscription) => (
              <tr
                key={subscription.id}
                className={`${isPlatformAdmin ? "lead-row " : ""}${String(subscription.status || "").toLowerCase() === "active" ? "subscription-row-active" : ""}`}
                onClick={isPlatformAdmin ? () => openSubscriptionDetail({
                  id: subscription.seller_id,
                  name: subscription.seller_name,
                  seller_code: subscription.seller_code
                }) : undefined}
              >
                <td>
                  <strong>{isPlatformAdmin ? subscription.seller_name : `Sub #${subscription.id}`}</strong>
                  <div className="seller-meta-stack">
                    <span>{isPlatformAdmin ? subscription.seller_code : (subscription.billing_cycle || "-")}</span>
                    <span>{isPlatformAdmin ? `Sub #${subscription.id}` : (subscription.updated_at ? `Updated ${formatDateIST(subscription.updated_at)}` : "History")}</span>
                  </div>
                </td>
                <td>
                  <strong>{subscription.plan_name || "-"}</strong>
                  <div className="seller-meta-stack">
                    <span>{subscription.plan_code || "-"}</span>
                    <span>{subscription.is_demo_plan ? "Demo plan" : "Standard plan"}</span>
                  </div>
                </td>
                <td><span className={`badge ${subscription.status === "active" ? "success" : "pending"}`}>{subscription.status || "-"}</span></td>
                <td>{formatDateIST(subscription.trial_end_at)}</td>
                <td>{formatDateIST(subscription.start_date)}</td>
                <td>{formatDateIST(subscription.end_date)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </section>
  );
}
