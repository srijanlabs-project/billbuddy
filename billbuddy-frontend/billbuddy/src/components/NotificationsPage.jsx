export default function NotificationsPage(props) {
  const {
    activeModule,
    currentModuleMeta,
    notifications,
    setShowNotificationCreateModal,
    openNotificationDetail,
    formatDateTime,
    showNotificationCreateModal,
    handleCreateNotification,
    error,
    notificationForm,
    setNotificationForm,
    sellers
  } = props;

  if (activeModule !== "Notifications") return null;

  return (
    <section className="module-placeholder glass-panel">
      <div className="page-banner">
        <div>
          <p className="eyebrow">{currentModuleMeta.Notifications.eyebrow}</p>
          <h2>{currentModuleMeta.Notifications.title}</h2>
          <p>{currentModuleMeta.Notifications.subtitle}</p>
        </div>
        <div className="banner-stat">
          <span>Notifications</span>
          <strong>{notifications.length}</strong>
        </div>
      </div>

      <div className="section-head">
        <h3>Notification History</h3>
        <div className="toolbar-controls">
          <button type="button" className="action-btn" onClick={() => setShowNotificationCreateModal(true)}>Create Notification</button>
          <span>{notifications.length} record(s)</span>
        </div>
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Title</th><th>Audience</th><th>Channel</th><th>Created By</th><th>Recipients</th><th>Read</th><th>Status</th></tr>
        </thead>
        <tbody>
          {notifications.length === 0 ? (
            <tr><td colSpan="7">No notifications created yet.</td></tr>
          ) : (
            notifications.map((notification) => (
              <tr key={notification.id} className="lead-row" onClick={() => openNotificationDetail(notification.id)}>
                <td>
                  <strong>{notification.title}</strong>
                  <div className="seller-meta-stack">
                    <span>{notification.message}</span>
                    <span>{notification.created_at ? formatDateTime(notification.created_at) : "-"}</span>
                  </div>
                </td>
                <td>{notification.audience_type}</td>
                <td>{notification.channel}</td>
                <td>{notification.creator_name || "System"}</td>
                <td>{notification.recipient_count ?? 0}</td>
                <td>
                  <span className={`badge ${(notification.unread_count || 0) > 0 ? "pending" : "success"}`}>
                    {(notification.read_count || 0)}/{(notification.recipient_count || 0)} read
                  </span>
                </td>
                <td><span className={`badge ${notification.sent_at ? "success" : "pending"}`}>{notification.sent_at ? "Sent" : "Scheduled"}</span></td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {showNotificationCreateModal && (
        <div className="modal-overlay" onClick={() => setShowNotificationCreateModal(false)}>
          <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Create Notification</h3>
              <button type="button" className="ghost-btn" onClick={() => setShowNotificationCreateModal(false)}>Close</button>
            </div>
            {error && <div className="notice error">{error}</div>}
            <form className="compact-form" onSubmit={handleCreateNotification}>
              <div className="seller-lifecycle-grid">
                <label>
                  <span>Title</span>
                  <input value={notificationForm.title} onChange={(e) => setNotificationForm((prev) => ({ ...prev, title: e.target.value }))} required />
                </label>
                <label>
                  <span>Audience</span>
                  <select value={notificationForm.audienceType} onChange={(e) => setNotificationForm((prev) => ({ ...prev, audienceType: e.target.value }))}>
                    <option value="all_sellers">All Sellers</option>
                    <option value="active_sellers">Active Sellers</option>
                    <option value="trial_users">Trial Users</option>
                    <option value="expiring_trials">Expiring Trials</option>
                    <option value="specific_seller">Specific Seller</option>
                  </select>
                </label>
                <label>
                  <span>Channel</span>
                  <select value={notificationForm.channel} onChange={(e) => setNotificationForm((prev) => ({ ...prev, channel: e.target.value }))}>
                    <option value="in_app">In-App</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                  </select>
                </label>
                {!notificationForm.sendNow && (
                  <label>
                    <span>Schedule</span>
                    <input type="datetime-local" value={notificationForm.scheduledAt} onChange={(e) => setNotificationForm((prev) => ({ ...prev, scheduledAt: e.target.value }))} />
                  </label>
                )}
                {notificationForm.audienceType === "specific_seller" && (
                  <label>
                    <span>Seller</span>
                    <select value={notificationForm.sellerId} onChange={(e) => setNotificationForm((prev) => ({ ...prev, sellerId: e.target.value }))} required>
                      <option value="">Select Seller</option>
                      {sellers.map((sellerRow) => <option key={sellerRow.id} value={sellerRow.id}>{sellerRow.name} ({sellerRow.seller_code})</option>)}
                    </select>
                  </label>
                )}
                <label className="seller-toggle seller-toggle-inline">
                  <input type="checkbox" checked={notificationForm.sendNow} onChange={(e) => setNotificationForm((prev) => ({ ...prev, sendNow: e.target.checked }))} style={{ width: "auto" }} />
                  Send now
                </label>
              </div>
              <label style={{ display: "grid", gap: "6px", color: "var(--muted)" }}>
                <span>Message</span>
                <textarea rows={5} value={notificationForm.message} onChange={(e) => setNotificationForm((prev) => ({ ...prev, message: e.target.value }))} required />
              </label>
              <div className="modal-fixed-actions">
                <button type="button" className="ghost-btn" onClick={() => setShowNotificationCreateModal(false)}>Close</button>
                <button type="submit">Create Notification</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
