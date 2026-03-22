export default function NotificationDetailModal(props) {
  const {
    showNotificationDetailModal,
    closeNotificationDetailModal,
    notificationDetailLoading,
    selectedNotificationDetail,
    formatDateTime
  } = props;

  if (!showNotificationDetailModal) return null;

  return (
    <div className="modal-overlay" onClick={closeNotificationDetailModal}>
      <div className="modal-card modal-wide glass-panel seller-detail-modal" onClick={(event) => event.stopPropagation()}>
        <div className="section-head">
          <h3>Notification Detail</h3>
          <button type="button" className="ghost-btn" onClick={closeNotificationDetailModal}>Close</button>
        </div>
        {notificationDetailLoading && !selectedNotificationDetail ? (
          <p className="muted">Loading notification detail...</p>
        ) : !selectedNotificationDetail ? (
          <p className="muted">Notification detail is unavailable right now.</p>
        ) : (
          <>
            <section className="seller-detail-hero">
              <div>
                <p className="eyebrow">Notification performance</p>
                <h3>{selectedNotificationDetail.notification.title}</h3>
                <p>{selectedNotificationDetail.notification.message}</p>
              </div>
              <div className="seller-detail-badges">
                <span className={`badge ${selectedNotificationDetail.notification.sent_at ? "success" : "pending"}`}>
                  {selectedNotificationDetail.notification.sent_at ? "Sent" : "Scheduled"}
                </span>
                <span className="badge pending">{selectedNotificationDetail.notification.channel}</span>
              </div>
            </section>

            <div className="seller-detail-grid">
              <article className="seller-detail-card">
                <h4>Audience Summary</h4>
                <div className="seller-detail-list">
                  <div><span>Audience</span><strong>{selectedNotificationDetail.notification.audience_type}</strong></div>
                  <div><span>Created By</span><strong>{selectedNotificationDetail.notification.creator_name || "System"}</strong></div>
                  <div><span>Created</span><strong>{formatDateTime(selectedNotificationDetail.notification.created_at)}</strong></div>
                  <div><span>Sent</span><strong>{formatDateTime(selectedNotificationDetail.notification.sent_at)}</strong></div>
                </div>
              </article>

              <article className="seller-detail-card">
                <h4>Performance</h4>
                <div className="seller-detail-list">
                  <div><span>Total recipients</span><strong>{selectedNotificationDetail.notification.recipient_count || 0}</strong></div>
                  <div><span>Sent</span><strong>{selectedNotificationDetail.notification.sent_count || 0}</strong></div>
                  <div><span>Read</span><strong>{selectedNotificationDetail.notification.read_count || 0}</strong></div>
                  <div><span>Unread</span><strong>{selectedNotificationDetail.notification.unread_count || 0}</strong></div>
                  <div><span>Scheduled</span><strong>{selectedNotificationDetail.notification.scheduled_count || 0}</strong></div>
                </div>
              </article>
            </div>

            <section className="seller-detail-section">
              <div className="section-head compact">
                <h3>Delivery Logs</h3>
                <span>{selectedNotificationDetail.logs?.length || 0} entries</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr><th>Seller</th><th>Status</th><th>Delivered</th><th>Read</th><th>Message</th></tr>
                </thead>
                <tbody>
                  {(selectedNotificationDetail.logs || []).length === 0 ? (
                    <tr><td colSpan="5">No delivery logs found.</td></tr>
                  ) : (
                    (selectedNotificationDetail.logs || []).map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <strong>{entry.seller_name || "-"}</strong>
                          <div className="seller-meta-stack">
                            <span>{entry.seller_code || "-"}</span>
                          </div>
                        </td>
                        <td><span className={`badge ${entry.delivery_status === "read" ? "success" : "pending"}`}>{entry.delivery_status || "-"}</span></td>
                        <td>{formatDateTime(entry.delivered_at)}</td>
                        <td>{formatDateTime(entry.read_at)}</td>
                        <td>{entry.delivery_message || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <div className="modal-fixed-actions">
              <button type="button" className="ghost-btn" onClick={closeNotificationDetailModal}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
