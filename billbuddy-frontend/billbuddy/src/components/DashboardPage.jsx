import { useState } from "react";

const IST_DAY_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function toIstDayKey(value) {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return IST_DAY_KEY_FORMATTER.format(parsed);
}

function shiftDateByDays(value, offsetDays) {
  const next = new Date(value);
  next.setDate(next.getDate() + offsetDays);
  return next;
}

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

function QuotsyDashboardDesignPreview({
  formatCurrency,
  setActiveModule,
  openQuotationWizard,
  openCreateCustomerModal,
  dashboardRange,
  setDashboardRange,
  dashboardData,
  quotations,
  notifications,
  canCreateQuotation,
  canCreateCustomer
}) {
  const [topArticleRange, setTopArticleRange] = useState("7d");
  const [trendMetric, setTrendMetric] = useState("count");

  const periodLabelMap = {
    today: "Today",
    yesterday: "Yesterday",
    last7: "Last 7 Days",
    last30: "Last 30 Days"
  };
  const periodLabel = periodLabelMap[dashboardRange] || "Selected Period";

  const now = new Date();
  const todayKey = toIstDayKey(now);
  const yesterdayKey = toIstDayKey(shiftDateByDays(now, -1));
  const last7StartKey = toIstDayKey(shiftDateByDays(now, -6));
  const last30StartKey = toIstDayKey(shiftDateByDays(now, -29));

  const rangeFilteredQuotations = (quotations || []).filter((quotation) => {
    const createdDayKey = toIstDayKey(quotation?.created_at);
    if (!createdDayKey) return false;
    if (dashboardRange === "yesterday") {
      return createdDayKey === yesterdayKey;
    }
    if (dashboardRange === "last7") {
      return createdDayKey >= last7StartKey && createdDayKey <= todayKey;
    }
    if (dashboardRange === "last30") {
      return createdDayKey >= last30StartKey && createdDayKey <= todayKey;
    }
    return createdDayKey === todayKey;
  });

  const fallbackQuotationsCount = rangeFilteredQuotations.length;
  const fallbackQuotationsValue = rangeFilteredQuotations.reduce((sum, quotation) => sum + Number(quotation.total_amount || 0), 0);
  const periodQuotationsCount = Number(dashboardData?.periodMetrics?.quotationCount ?? fallbackQuotationsCount);
  const periodQuotationsValue = Number(dashboardData?.periodMetrics?.quotationValue ?? fallbackQuotationsValue);
  const periodCustomerSet = new Set(
    rangeFilteredQuotations.map((quotation) => String(quotation.customer_id || quotation.mobile || quotation.firm_name || quotation.customer_name || "")).filter(Boolean)
  );
  const periodCustomers = periodCustomerSet.size;

  const deliveryCounts = dashboardData?.deliveriesNext3Days || [];
  const deliveryByDay = [0, 1, 2].map((offset) => {
    const key = toIstDayKey(shiftDateByDays(now, offset));
    const matched = deliveryCounts.find((entry) => toIstDayKey(entry.day) === key);
    return Number(matched?.count || 0);
  });
  const totalDelivery3Days = deliveryByDay.reduce((sum, value) => sum + value, 0);

  const latestCustomers = (dashboardData?.latestCustomers || []).slice(0, 10);
  const staleProducts = (dashboardData?.staleProducts30Days || []).slice(0, 10);
  const topArticles = (dashboardData?.topArticlesByRange?.[topArticleRange] || []).slice(0, 10);
  const latestNotification = Array.isArray(notifications) && notifications.length > 0 ? notifications[0] : null;

  function resolveStaleProductDisplayName(entry) {
    const configuredDisplayName = String(entry?.item_display_name || "").trim();
    if (configuredDisplayName) return configuredDisplayName;

    const customFields = typeof entry?.custom_fields === "string"
      ? (() => {
        try {
          return JSON.parse(entry.custom_fields);
        } catch {
          return {};
        }
      })()
      : (entry?.custom_fields || {});

    const preferredKeys = [
      "item_display_text",
      "material_name",
      "product_name",
      "item_name",
      "service_name",
      "design_name"
    ];

    for (const key of preferredKeys) {
      const value = String(customFields?.[key] || "").trim();
      if (value) return value;
    }

    return String(entry?.material_name || entry?.design_name || "Item").trim() || "Item";
  }

  const trendMap = new Map();
  const apiTrendRows = Array.isArray(dashboardData?.salesTrend) ? dashboardData.salesTrend : [];
  if (apiTrendRows.length > 0) {
    apiTrendRows.forEach((entry) => {
      const key = toIstDayKey(entry?.day);
      if (!key) return;
      trendMap.set(key, {
        count: Number(entry?.quotation_count ?? entry?.count ?? 0),
        value: Number(entry?.total ?? entry?.value ?? 0)
      });
    });
  } else {
    rangeFilteredQuotations.forEach((quotation) => {
      const key = toIstDayKey(quotation?.created_at);
      if (!key) return;
      const existing = trendMap.get(key) || { count: 0, value: 0 };
      trendMap.set(key, {
        count: Number(existing.count || 0) + 1,
        value: Number(existing.value || 0) + Number(quotation.total_amount || 0)
      });
    });
  }

  const trendRows = [];
  if (dashboardRange === "today" || dashboardRange === "yesterday") {
    const keyDate = dashboardRange === "yesterday" ? shiftDateByDays(now, -1) : now;
    const key = toIstDayKey(keyDate);
    trendRows.push({
      day: key,
      dayLabel: keyDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }),
      count: Number(trendMap.get(key)?.count || 0),
      value: Number(trendMap.get(key)?.value || 0)
    });
  } else {
    const startDate = dashboardRange === "last30" ? shiftDateByDays(now, -29) : shiftDateByDays(now, -6);
    const totalDays = dashboardRange === "last30" ? 30 : 7;
    for (let index = 0; index < totalDays; index += 1) {
      const date = shiftDateByDays(startDate, index);
      const key = toIstDayKey(date);
      trendRows.push({
        day: key,
        dayLabel: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }),
        count: Number(trendMap.get(key)?.count || 0),
        value: Number(trendMap.get(key)?.value || 0)
      });
    }
  }

  const valueRows = trendRows.map((entry) => Number(entry.value || 0)).filter((value) => value > 0);
  const lakhRows = valueRows.filter((value) => value >= 100000).length;
  const useLakhs = valueRows.length > 0 && lakhRows >= Math.ceil(valueRows.length / 2);

  function formatTrendMetric(entry) {
    if (trendMetric === "count") {
      const countValue = Number(entry.count || 0);
      return countValue.toLocaleString("en-IN");
    }
    const value = Number(entry.value || 0);
    if (value <= 0) return "-";
    if (useLakhs) {
      return `${(value / 100000).toFixed(2)} L`;
    }
    return `${(value / 1000).toFixed(2)} K`;
  }

  return (
    <section className="glass-panel dashboard-design-preview">
      <div className="section-head">
        <div>
          <h3>Business Dashboard</h3>
          <span>Quotation, delivery, customer, and product insights in one place</span>
        </div>
        <div className="toolbar-controls">
          <select value={dashboardRange} onChange={(event) => setDashboardRange(event.target.value)}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
          </select>
        </div>
      </div>

      <div className="dashboard-preview-kpis">
        <article>
          <span>{periodLabel} Quotations</span>
          <strong>{periodQuotationsCount}</strong>
        </article>
        <article>
          <span>{periodLabel} Quotation Value</span>
          <strong>{formatCurrency(periodQuotationsValue)}</strong>
        </article>
        <article>
          <span>{periodLabel} Customers</span>
          <strong>{periodCustomers}</strong>
        </article>
        <article>
          <span>Delivery (3 Days)</span>
          <strong>{totalDelivery3Days}</strong>
          <small>Today {deliveryByDay[0]} | Tomorrow {deliveryByDay[1]} | Day+2 {deliveryByDay[2]}</small>
        </article>
      </div>

      <div className="dashboard-preview-main-grid">
        <section className="dashboard-preview-card">
          <div className="section-head">
            <h3>Daily Quotation</h3>
            <div className="dashboard-preview-trend-tabs">
              <button
                type="button"
                className={`ghost-btn compact-btn ${trendMetric === "count" ? "active" : ""}`}
                onClick={() => setTrendMetric("count")}
              >
                Count
              </button>
              <button
                type="button"
                className={`ghost-btn compact-btn ${trendMetric === "value" ? "active" : ""}`}
                onClick={() => setTrendMetric("value")}
              >
                Value
              </button>
            </div>
          </div>
          <div className="dashboard-preview-date-grid">
            {trendRows.map((entry) => (
              <div key={entry.day} className="dashboard-preview-date-cell">
                <strong>{String(entry.dayLabel || entry.day || "").slice(0, 6)}</strong>
                <span>{formatTrendMetric(entry)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-preview-card">
          <div className="section-head">
            <h3>Latest Notification</h3>
            <button type="button" className="link-btn" onClick={() => setActiveModule("Notifications")}>More</button>
          </div>
          <div className="dashboard-preview-notice">
            <strong>{latestNotification?.title || "No notifications yet"}</strong>
            <p>{latestNotification?.message || "New notifications from platform and team updates will appear here."}</p>
          </div>
        </section>
      </div>

      <div className="dashboard-preview-lists-grid">
        <section className="dashboard-preview-card">
          <div className="section-head">
            <h3>Latest Customers</h3>
            <button type="button" className="link-btn" onClick={() => setActiveModule("Customers")}>More</button>
          </div>
          <ul className="dashboard-preview-list">
            {latestCustomers.length
              ? latestCustomers.map((entry) => (
                <li key={entry.id || `${entry.name}-${entry.mobile}`}>{entry.firm_name || entry.name || "-"}</li>
              ))
              : <li className="muted">No customers found.</li>}
          </ul>
        </section>

        <section className="dashboard-preview-card">
          <div className="section-head">
            <h3>Products Not Quoted (30 Days)</h3>
          </div>
          <ul className="dashboard-preview-list">
            {staleProducts.length
              ? staleProducts.map((entry) => (
                <li key={entry.id || entry.material_name}>{resolveStaleProductDisplayName(entry)}</li>
              ))
              : <li className="muted">No products pending quotation follow-up.</li>}
          </ul>
        </section>

        <section className="dashboard-preview-card">
          <div className="section-head">
            <h3>Top Articles Quoted</h3>
            <div className="toolbar-controls dashboard-top-articles-filter">
              <select value={topArticleRange} onChange={(event) => setTopArticleRange(event.target.value)}>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="60d">Last 60 Days</option>
              </select>
            </div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {topArticles.length ? topArticles.map((row) => (
                <tr key={row.article_name || row.name}>
                  <td>{row.article_name || row.name || "Item"}</td>
                  <td>{Number(row.total_qty || row.qty || 0).toLocaleString("en-IN")}</td>
                </tr>
              )) : (
                <tr><td colSpan={2} className="muted">No article data found for selected range.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="dashboard-preview-card dashboard-preview-quick-links">
        <div className="section-head">
          <h3>Quick Links</h3>
          <span>One-click daily actions</span>
        </div>
        <div className="quick-action-grid">
          <button type="button" className="ghost-btn quick-action-btn dashboard-quick-link-btn" disabled={!canCreateQuotation} onClick={openQuotationWizard}>Create Quotation</button>
          <button type="button" className="ghost-btn quick-action-btn dashboard-quick-link-btn" disabled={!canCreateCustomer} onClick={openCreateCustomerModal}>Create Customer</button>
          <button type="button" className="ghost-btn quick-action-btn dashboard-quick-link-btn" onClick={() => setActiveModule("Users")}>Create User</button>
          <button type="button" className="ghost-btn quick-action-btn dashboard-quick-link-btn" onClick={() => setActiveModule("Products")}>Add Product</button>
        </div>
      </section>
    </section>
  );
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
    notifications = [],
    dashboardData,
    QUICK_ACTIONS,
    openQuotationWizard,
    openCreateCustomerModal,
    dashboardRange,
    setDashboardRange,
    handleDownloadQuotation,
    formatQuotationLabel,
    subUserAction,
    setSubUserAction,
    subUserSearchInput,
    setSubUserSearchInput,
    handleSubUserQuotationSearch,
    subUserQuotationResults,
    canCreateQuotation,
    canSearchQuotation,
    canDownloadQuotationPdf,
    canCreateCustomer
  } = props;

  if (activeModule !== "Dashboard") return null;

  if (isPlatformAdmin) {
    return (
      <main className="dashboard-grid platform-dashboard-pro">
        <section className="main-column platform-dashboard-main">
          <div className="platform-hero-shell glass-panel">
            <article className="platform-pulse-card">
              <div className="platform-pulse-copy">
                <p className="eyebrow">Platform Billing Pulse</p>
                <h2>Control Tower</h2>
                <p>Monitor tenant growth, usage quality, and billing movement without jumping between seller workspaces.</p>
              </div>
              <div className="platform-pulse-stats">
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
            <article className="platform-actions-card">
              <div className="section-head">
                <h3>Platform Actions</h3>
                <span>Admin control</span>
              </div>
              <div className="platform-actions-grid">
                <button type="button" className="ghost-btn compact-btn platform-action-btn" onClick={() => setActiveModule("Sellers")}>Onboard Seller</button>
                <button type="button" className="ghost-btn compact-btn platform-action-btn" onClick={() => setActiveModule("Subscriptions")}>Subscriptions</button>
                <button type="button" className="ghost-btn compact-btn platform-action-btn" onClick={() => setActiveModule("Plans")}>Plans</button>
                <button type="button" className="ghost-btn compact-btn platform-action-btn" onClick={() => setActiveModule("Users")}>Users</button>
              </div>
            </article>
          </div>

          <div className="platform-kpi-strip">
            <article className="platform-kpi-card">
              <p>Sellers</p>
              <h3>{usageOverview?.sellersOnboarded || 0}</h3>
            </article>
            <article className="platform-kpi-card">
              <p>Active Users</p>
              <h3>{usageOverview?.activeUsers || 0}</h3>
            </article>
            <article className="platform-kpi-card">
              <p>Total Quotations</p>
              <h3>{usageOverview?.totalOrders || 0}</h3>
            </article>
            <article className="platform-kpi-card">
              <p>Billing Scope</p>
              <h3>{formatCurrency(quotations.reduce((sum, row) => sum + Number(row.total_amount || 0), 0))}</h3>
            </article>
          </div>

          <section className="glass-panel table-card platform-sellers-table-card">
            <div className="section-head">
              <h3>Seller Accounts</h3>
              <span>{sellers.length} sellers</span>
            </div>
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
        <QuotsyDashboardDesignPreview
          formatCurrency={formatCurrency}
          setActiveModule={setActiveModule}
          openQuotationWizard={openQuotationWizard}
          openCreateCustomerModal={openCreateCustomerModal}
          dashboardRange={dashboardRange}
          setDashboardRange={setDashboardRange}
          dashboardData={dashboardData}
          quotations={quotations}
          notifications={notifications}
          canCreateQuotation={canCreateQuotation}
          canCreateCustomer={canCreateCustomer}
        />
      </section>
    </main>
  );
}

