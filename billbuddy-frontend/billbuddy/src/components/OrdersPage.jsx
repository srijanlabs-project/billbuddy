function getQuotationBadgeClass(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'READY_DISPATCH') return 'quotation-ready-dispatch';
  if (normalized === 'READY_PICKUP') return 'quotation-ready-pickup';
  if (normalized === 'DELIVERED') return 'quotation-delivered';
  return 'quotation-new';
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

export default function OrdersPage(props) {
  const {
    activeModule,
    filteredOrders,
    pagedOrders,
    orderPage,
    PAGE_SIZE,
    setOrderPage,
    handleOpenOrderDetails,
    formatQuotationLabel,
    formatCurrency,
    statusLabel,
    handleOrderStatusUpdate,
    ORDER_STATUS_OPTIONS,
    handleMarkQuotationSent,
    handleMarkPaid,
    handleDownloadQuotationSheet,
    handleDownloadQuotation,
    handleDownloadRichPdfDebug,
    renderPagination,
    canEditQuotation,
    canSendQuotation,
    canMarkPaid,
    canDownloadQuotationPdf
  } = props;

  if (activeModule !== "Orders") return null;

  return (
    <section className="module-placeholder glass-panel">
      <div className="page-banner">
        <div>
          <p className="eyebrow">Workflow</p>
          <h2>Quotation Tracker</h2>
          <p>See all quotations, status updates, and message-driven captures in one refined command view.</p>
        </div>
        <div className="banner-stat">
          <span>Active Quotations</span>
          <strong>{filteredOrders.length}</strong>
        </div>
      </div>
      <div className="section-head"><h3>Quotation Tracker</h3><span>{filteredOrders.length} total</span></div>
      <table className="data-table order-table">
        <thead>
          <tr>
            <th>Sr</th>
            <th>Quotation #</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Quotation</th>
            <th>Payment</th>
            <th>Quotation Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {pagedOrders.map((order, index) => (
            <tr key={order.id}>
              <td>{(orderPage - 1) * PAGE_SIZE + index + 1}</td>
              <td><button type="button" className="link-btn" onClick={() => handleOpenOrderDetails(order.id)}>{formatQuotationLabel(order)}</button></td>
              <td>{order.firm_name || order.customer_name}</td>
              <td>{formatCurrency(order.total_amount)}</td>
              <td>
                <span
                  className={`status-icon-badge ${order.quotation_sent ? "sent" : "not-sent"}`}
                  title={order.quotation_sent ? "Quotation Sent" : "Quotation Not Sent"}
                  aria-label={order.quotation_sent ? "Quotation Sent" : "Quotation Not Sent"}
                >
                  <SentStatusIcon sent={Boolean(order.quotation_sent)} />
                </span>
              </td>
              <td><span className={`badge ${order.payment_status === "paid" ? "success" : "pending"}`}>{statusLabel(order.payment_status)}</span></td>
              <td>
                {canEditQuotation ? (
                  <select value={order.order_status || "NEW"} onChange={(event) => handleOrderStatusUpdate(order.id, event.target.value)}>
                    {ORDER_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`badge ${getQuotationBadgeClass(order.order_status)}`}>{order.order_status || "NEW"}</span>
                )}
              </td>
              <td>
                <div className="order-actions">
                  {canSendQuotation && (
                    <button type="button" className="ghost-btn order-action-btn" onClick={() => handleMarkQuotationSent(order.id)} disabled={order.quotation_sent}>Send</button>
                  )}
                  {canMarkPaid && (
                    <button type="button" className="ghost-btn order-action-btn" onClick={() => handleMarkPaid(order.id)} disabled={order.payment_status === "paid"}>Paid</button>
                  )}
                  <button type="button" className="ghost-btn order-action-btn icon-btn" onClick={() => handleDownloadQuotationSheet(order.id)} title="Download XLSX">XLSX</button>
                  {canDownloadQuotationPdf && (
                    <button type="button" className="ghost-btn order-action-btn icon-btn" onClick={() => handleDownloadQuotation(order.id)} title="Download PDF">PDF</button>
                  )}
                  <button type="button" className="ghost-btn order-action-btn" onClick={() => handleDownloadRichPdfDebug(order.id)} title="Run Rich PDF Debug">Rich PDF Debug</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {renderPagination(orderPage, setOrderPage, filteredOrders.length)}
    </section>
  );
}



