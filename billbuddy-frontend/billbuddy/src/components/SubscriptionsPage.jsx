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

  return (
    <section className="module-placeholder glass-panel">
      <div className="page-banner">
        <div>
          <p className="eyebrow">{currentModuleMeta.Subscriptions.eyebrow}</p>
          <h2>{currentModuleMeta.Subscriptions.title}</h2>
          <p>{currentModuleMeta.Subscriptions.subtitle}</p>
        </div>
        <div className="banner-stat">
          <span>Total Subscriptions</span>
          <strong>{subscriptions.length}</strong>
        </div>
      </div>

      <div className="section-head">
        <h3>Subscription List</h3>
        <div className="toolbar-controls">
          <input
            type="search"
            className="toolbar-search"
            placeholder={isPlatformAdmin ? "Search seller, plan, status..." : "Search plan, status, billing..."}
            value={subscriptionSearch}
            onChange={(e) => setSubscriptionSearch(e.target.value)}
          />
          <span>{filteredSubscriptions.length} subscription(s)</span>
        </div>
      </div>

      {!isPlatformAdmin && (
        <div className="seller-subscription-summary">
          {currentSellerSubscription ? (
            <>
              <div className="seller-subscription-summary-card">
                <span className="eyebrow">Current Active Plan</span>
                <h3>{currentSellerSubscription.plan_name || currentSellerSubscription.plan_code || "Plan"}</h3>
                <div className="seller-detail-list">
                  <div><span>Status</span><strong>{currentSellerSubscription.status || "-"}</strong></div>
                  <div><span>Billing</span><strong>{currentSellerSubscription.billing_cycle || "-"}</strong></div>
                  <div><span>Trial End</span><strong>{formatDateIST(currentSellerSubscription.trial_end_at)}</strong></div>
                  <div><span>Start Date</span><strong>{formatDateIST(currentSellerSubscription.start_date)}</strong></div>
                </div>
              </div>
              <div className="seller-subscription-summary-card">
                <span className="eyebrow">Plan Visibility</span>
                <p className="muted">This block always shows the currently active subscription for your seller account. Historical and expired subscriptions remain listed below.</p>
              </div>
            </>
          ) : (
            <div className="seller-subscription-summary-card">
              <span className="eyebrow">Current Active Plan</span>
              <h3>No subscription activated</h3>
              <p className="muted">No active or trial subscription record is currently linked to this seller account.</p>
            </div>
          )}
        </div>
      )}

      <table className="data-table">
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
    </section>
  );
}
