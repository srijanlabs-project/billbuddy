export default function SellerNotificationsModal(props) {
  const {
    showSellerNotificationsModal,
    setShowSellerNotificationsModal,
    isPlatformAdmin,
    notifications,
    handleOpenSellerNotification,
    formatDateTime
  } = props;

  if (!showSellerNotificationsModal || isPlatformAdmin) return null;

  return (
    <div className="modal-overlay" onClick={() => setShowSellerNotificationsModal(false)}>
      <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
        <div className="section-head">
          <h3>Your Notifications</h3>
          <button type="button" className="ghost-btn" onClick={() => setShowSellerNotificationsModal(false)}>Close</button>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Title</th><th>Channel</th><th>Status</th><th>When</th></tr>
          </thead>
          <tbody>
            {notifications.length === 0 ? (
              <tr><td colSpan="4">No notifications yet.</td></tr>
            ) : (
              notifications.map((notification) => (
                <tr key={notification.id} className="lead-row" onClick={() => handleOpenSellerNotification(notification)}>
                  <td>
                    <strong>{notification.title}</strong>
                    <div className="seller-meta-stack">
                      <span>{notification.message}</span>
                    </div>
                  </td>
                  <td>{notification.channel}</td>
                  <td>
                    <span className={`badge ${String(notification.delivery_status || "").toLowerCase() === "read" ? "success" : "pending"}`}>
                      {String(notification.delivery_status || "").toLowerCase() === "read" ? "Read" : "Unread"}
                    </span>
                  </td>
                  <td>{formatDateTime(notification.read_at || notification.delivered_at || notification.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="modal-fixed-actions">
          <button type="button" className="ghost-btn" onClick={() => setShowSellerNotificationsModal(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
