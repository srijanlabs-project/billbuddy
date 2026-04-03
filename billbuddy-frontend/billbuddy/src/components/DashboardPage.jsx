function SentStatusIcon({ sent }) {
  if (sent) {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true" className="status-icon-svg">
        <path
          d="M5 10.5 8.2 13.7 15 6.9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="status-icon-svg">
      <path
        d="M10 5.2v5.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="10" cy="13.9" r="1.1" fill="currentColor" />
    </svg>
  );
}

function getPaymentBadgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") return "payment-paid";
  if (normalized === "partial") return "payment-partial";
  return "payment-pending";
}

function getQuotationBadgeClass(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "READY_DISPATCH") return "quotation-ready-dispatch";
  if (normalized === "READY_PICKUP") return "quotation-ready-pickup";
  if (normalized === "DELIVERED") return "quotation-delivered";
  return "quotation-new";
}

function getApprovalBadgeClass(status) {
  const normalized = String(status || "not_required").toLowerCase();
  if (normalized === "approved") return "success";
  if (normalized === "rejected") return "error";
  if (normalized === "pending") return "pending";
  return "neutral";
}

function getApprovalLabel(status) {
  const normalized = String(status || "not_required").toLowerCase();
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "pending") return "Pending";
  return "Not Required";
}

export default function DashboardPage(props) {
  const {
    activeModule,
    isPlatformAdmin,
    isSubUser,
    usageOverview,
    setActiveModule,
    sellers,
    openSellerDetail,
    formatCurrency,
    formatDateIST,
    quotations,
    dashboardData,
    QUICK_ACTIONS,
    openQuotationWizard,
    openCreateCustomerModal,
    dashboardRange,
    setDashboardRange,
    chartSeries,
    filteredOrders,
    changeSort,
    seller,
    handleOpenOrderDetails,
    handleDownloadQuotation,
    formatQuotationLabel,
    statusLabel,
    orderStatusLabel,
    lowStockItems,
    topSelling,
    aiSuggestions,
    subUserAction,
    setSubUserAction,
    subUserSearchInput,
    setSubUserSearchInput,
    handleSubUserQuotationSearch,
    subUserQuotationResults,
    canCreateQuotation,
    canSearchQuotation,
    canDownloadQuotationPdf,
    canCreateCustomer,
    pendingApprovalCount,
    requesterPendingApprovalCount
  } = props;

  if (activeModule !== "Dashboard") return null;

  if (isPlatformAdmin) {
    return (
      <main className="dashboard-grid">
        <section className="main-column">
          <div className="dashboard-hero-grid">
            <article className="glass-panel spotlight-card">
              <div className="spotlight-copy">
                <p className="eyebrow">Platform billing pulse</p>
                <h2>{usageOverview?.sellersOnboarded || 0}</h2>
                <p>Monitor tenant growth, active usage, and billable quotation volume without entering seller workflows.</p>
              </div>
              <div className="spotlight-stack">
                <div>
                  <span>Active users</span>
                  <strong>{usageOverview?.activeUsers || 0}</strong>
                </div>
                <div>
                  <span>Total quotations</span>
                  <strong>{usageOverview?.totalOrders || 0}</strong>
                </div>
                <div>
                  <span>Sellers onboarded</span>
                  <strong>{usageOverview?.sellersOnboarded || 0}</strong>
                </div>
              </div>
            </article>
            <article className="glass-panel quick-actions-panel">
              <div className="section-head"><h3>Platform Actions</h3><span>Admin control</span></div>
              <div className="quick-action-grid">
                <button type="button" className="action-btn quick-action-btn" onClick={() => setActiveModule("Sellers")}>Onboard Seller</button>
                <button type="button" className="action-btn quick-action-btn" onClick={() => setActiveModule("Subscriptions")}>Manage Subscriptions</button>
                <button type="button" className="action-btn quick-action-btn" onClick={() => setActiveModule("Plans")}>Manage Plans</button>
                <button type="button" className="action-btn quick-action-btn" onClick={() => setActiveModule("Users")}>Manage Users</button>
              </div>
            </article>
          </div>

          <div className="kpi-grid">
            <article className="kpi-card glass-panel"><p>Sellers</p><h3>{usageOverview?.sellersOnboarded || 0}</h3></article>
            <article className="kpi-card glass-panel"><p>Active Users</p><h3>{usageOverview?.activeUsers || 0}</h3></article>
            <article className="kpi-card glass-panel"><p>Total Quotations</p><h3>{usageOverview?.totalOrders || 0}</h3></article>
            <article className="kpi-card glass-panel"><p>Billing Scope</p><h3>{formatCurrency(quotations.reduce((sum, row) => sum + Number(row.total_amount || 0), 0))}</h3></article>
          </div>

          <section className="glass-panel table-card">
            <div className="section-head"><h3>Seller Accounts</h3><span>{sellers.length} sellers</span></div>
            <table className="data-table">
              <thead>
                <tr><th>Seller</th><th>Subscription</th><th>Status</th><th>Users</th><th>Quotations</th><th>Revenue</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {sellers.map((sellerRow) => (
                  <tr key={sellerRow.id}>
                    <td>
                      <strong>{sellerRow.name}</strong>
                      <div className="seller-meta-stack">
                        <span>{sellerRow.seller_code}</span>
                        <span>{sellerRow.email || sellerRow.mobile || "-"}</span>
                      </div>
                    </td>
                    <td>
                      <div className="seller-meta-stack">
                        <span>{sellerRow.plan_name || sellerRow.subscription_plan || "-"}</span>
                        <span>{sellerRow.subscription_status || "-"}</span>
                        <span>{sellerRow.trial_end_at ? `Trial Ends ${formatDateIST(sellerRow.trial_end_at)}` : ""}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${sellerRow.is_locked ? "pending" : "success"}`}>
                        {sellerRow.is_locked ? "Locked" : (sellerRow.status || "active")}
                      </span>
                    </td>
                    <td>{sellerRow.user_count}</td>
                    <td>{sellerRow.order_count}</td>
                    <td>{formatCurrency(sellerRow.total_revenue)}</td>
                    <td>
                      <button type="button" className="ghost-btn compact-btn" onClick={() => openSellerDetail(sellerRow)}>View Detail</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      </main>
    );
  }

  if (isSubUser) {
    return (
      <main className="dashboard-grid subuser-dashboard-grid">
        <section className="main-column">
          <div className="dashboard-hero-grid subuser-hero-grid">
            <article className="glass-panel spotlight-card subuser-spotlight">
              <div className="spotlight-copy">
                <p className="eyebrow">Sub User Workspace</p>
                <h2>Create or find quotations fast</h2>
                <p>We’ve kept this view focused so your team can create quotations, search existing ones, and download PDFs without extra navigation.</p>
              </div>
              <div className="quick-action-grid subuser-action-grid">
                <button
                  type="button"
                  className="action-btn quick-action-btn"
                  disabled={!canCreateQuotation}
                  onClick={() => {
                    setSubUserAction("create");
                    openQuotationWizard();
                  }}
                >
                  Create Quotation
                </button>
                <button
                  type="button"
                  className="action-btn quick-action-btn secondary-action-btn"
                  disabled={!canSearchQuotation}
                  onClick={() => setSubUserAction("search")}
                >
                  Search Quotation
                </button>
              </div>
            </article>
          </div>

          {canSearchQuotation && subUserAction === "search" && (
            <section className="glass-panel table-card subuser-search-panel">
              <div className="section-head">
                <div>
                  <h3>Search Quotations</h3>
                  <span>Search by customer name or mobile number</span>
                </div>
              </div>

              <form
                className="subuser-search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSubUserQuotationSearch();
                }}
              >
                <input
                  type="search"
                  placeholder="Enter customer name or mobile number"
                  value={subUserSearchInput}
                  onChange={(event) => setSubUserSearchInput(event.target.value)}
                />
                <button type="submit" className="action-btn search-action-btn">Search</button>
              </form>

              {!subUserSearchInput.trim() ? (
                <p className="muted subuser-search-empty">Enter a customer name or mobile number to find saved quotations.</p>
              ) : subUserQuotationResults.length === 0 ? (
                <p className="muted subuser-search-empty">No quotations matched your search.</p>
              ) : (
                <div className="subuser-search-suggestions">
                  {subUserQuotationResults.map((quotation) => (
                    <div key={quotation.id} className="subuser-search-card">
                      <div className="subuser-search-meta">
                        <strong>{formatQuotationLabel(quotation)}</strong>
                        <span>{quotation.firm_name || quotation.customer_name || "-"}</span>
                        <small>{quotation.mobile || "-"}</small>
                      </div>
                      {canDownloadQuotationPdf && (
                        <button type="button" className="ghost-btn compact-btn" onClick={() => handleDownloadQuotation(quotation.id)}>
                          Download PDF
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-grid">
      <section className="main-column">
        <div className="dashboard-hero-grid">
          <article className="glass-panel spotlight-card">
            <div className="spotlight-copy">
              <p className="eyebrow">Today at a glance</p>
              <h2>{formatCurrency(dashboardData?.totals?.total_sales)}</h2>
              <p>Live quotation movement and pending collection in one place for the seller team.</p>
            </div>
            <div className="spotlight-stack">
              <div>
                <span>Quotations saved</span>
                <strong>{dashboardData?.totals?.invoices_generated || 0}</strong>
              </div>
              <div>
                <span>Pending overall</span>
                <strong>{formatCurrency(dashboardData?.pendingOverall)}</strong>
              </div>
              <div>
                <span>Walk-in sales</span>
                <strong>{formatCurrency(dashboardData?.totals?.walk_in_sales)}</strong>
              </div>
              <div>
                <span>Pending approvals</span>
                <strong>{pendingApprovalCount || 0}</strong>
              </div>
            </div>
          </article>
          <article className="glass-panel quick-actions-panel">
            <div className="section-head"><h3>Quick Actions</h3><span>Fast operations</span></div>
            <div className="quick-action-grid">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  type="button"
                  className="action-btn quick-action-btn"
                  disabled={(action === "Create Quotation" && !canCreateQuotation) || (action === "Add Customer" && !canCreateCustomer)}
                  onClick={() => {
                    if (action === "Create Quotation") openQuotationWizard();
                    if (action === "Add Customer") openCreateCustomerModal();
                  }}
                >
                  {action}
                </button>
              ))}
              <button
                type="button"
                className="action-btn quick-action-btn secondary-action-btn"
                onClick={() => setActiveModule("Approvals")}
              >
                Approvals ({requesterPendingApprovalCount || pendingApprovalCount || 0})
              </button>
            </div>
          </article>
        </div>

        <div className="toolbar-row">
          <div>
            <h2>Business Pulse</h2>
            <p>Track cash movement, quotation momentum, and customer follow-up priority in a focused layout.</p>
          </div>
          <div className="toolbar-controls">
            <select value={dashboardRange} onChange={(e) => setDashboardRange(e.target.value)}>
              <option value="daily">Today</option>
              <option value="weekly">Last 7 Days</option>
              <option value="monthly">This Month</option>
            </select>
          </div>
        </div>

        <div className="kpi-grid">
          <article className="kpi-card glass-panel"><p>Today's Sales</p><h3>{formatCurrency(dashboardData?.totals?.total_sales)}</h3></article>
          <article className="kpi-card glass-panel"><p>Quotations Saved</p><h3>{dashboardData?.totals?.invoices_generated || 0}</h3></article>
          <article className="kpi-card glass-panel"><p>Quotation Value</p><h3>{formatCurrency(dashboardData?.totals?.total_sales)}</h3></article>
          <article className="kpi-card glass-panel"><p>Pending Payments</p><h3>{formatCurrency(dashboardData?.pendingOverall)}</h3></article>
          <article className="kpi-card glass-panel"><p>Approvals Pending</p><h3>{pendingApprovalCount || 0}</h3></article>
        </div>

        <section className="glass-panel chart-card">
          <div className="section-head"><h3>Sales Analytics</h3><span>Weekly trend</span></div>
          <div className="bar-chart">
            {chartSeries.map((point) => (
              <div key={point.label} className="bar-item">
                <div className="bar-track"><div className="bar-fill" style={{ height: `${point.height}%` }} /></div>
                <span>{point.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel table-card">
          <div className="section-head"><h3>Recent Quotations</h3><span>{filteredOrders.length} records</span></div>
          <table className="data-table">
            <thead>
              <tr>
                <th>{isPlatformAdmin ? "Seller" : <button type="button" onClick={() => changeSort("quotation_number")}>Quotation #</button>}</th>
                <th><button type="button" onClick={() => changeSort("customer_name")}>Customer</button></th>
                <th><button type="button" onClick={() => changeSort("total_amount")}>Amount</button></th>
                <th>Payment</th><th>Quotation</th><th>Approval</th><th>Sent</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.slice(0, 8).map((order) => (
                <tr key={order.id}>
                  <td>
                    {isPlatformAdmin
                      ? (order.seller_name || seller?.name || "Seller")
                      : <button type="button" className="link-btn" onClick={() => handleOpenOrderDetails(order.id)}>{formatQuotationLabel(order)}</button>}
                  </td>
                  <td>{order.firm_name || order.customer_name}</td>
                  <td>{formatCurrency(order.total_amount)}</td>
                  <td><span className={`badge ${getPaymentBadgeClass(order.payment_status)}`}>{statusLabel(order.payment_status)}</span></td>
                  <td><span className={`badge ${getQuotationBadgeClass(order.order_status)}`}>{orderStatusLabel(order.order_status)}</span></td>
                  <td><span className={`badge ${getApprovalBadgeClass(order.approval_status)}`}>{getApprovalLabel(order.approval_status)}</span></td>
                  <td>
                    <span
                      className={`status-icon-badge ${order.quotation_sent ? "sent" : "not-sent"}`}
                      title={order.quotation_sent ? "Quotation Sent" : "Quotation Not Sent"}
                      aria-label={order.quotation_sent ? "Quotation Sent" : "Quotation Not Sent"}
                    >
                      <SentStatusIcon sent={Boolean(order.quotation_sent)} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="dashboard-bottom-grid">
          <section className="glass-panel">
            <div className="section-head"><h3>Low Stock Alerts</h3><span>{lowStockItems.length} items</span></div>
            {lowStockItems.length === 0 ? (
              <p className="muted">No critical low stock right now.</p>
            ) : (
              lowStockItems.map((item) => (
                <div key={item.id} className="stock-item">
                  <p>{item.name}</p>
                  <div className="progress-wrap"><div className="progress-bar" style={{ width: `${Math.max(8, item.stock * 3)}%` }} /></div>
                  <small>{item.stock} units left</small>
                </div>
              ))
            )}
          </section>

          <section className="glass-panel">
            <div className="section-head"><h3>Top Selling</h3><span>By category</span></div>
            {topSelling.map((item) => (
              <div className="top-item" key={item.category}><span>{item.category}</span><strong>{formatCurrency(item.total)}</strong></div>
            ))}
          </section>

          <section className="glass-panel ai-panel">
            <div className="section-head"><h3>AI Suggestions</h3><span>Smart assistant</span></div>
            {aiSuggestions.map((tip, idx) => <div className="ai-tip" key={idx}>{tip}</div>)}
          </section>
        </section>
      </section>
    </main>
  );
}

