export default function CustomersPage(props) {
  const {
    activeModule,
    customers,
    setShowCustomerModal,
    canCreateCustomer,
    pagedCustomers,
    customerPage,
    setCustomerPage,
    PAGE_SIZE,
    renderPagination
  } = props;

  if (activeModule !== "Customers") return null;

  return (
    <section className="module-placeholder glass-panel">
      <div className="page-banner">
        <div>
          <p className="eyebrow">CRM</p>
          <h2>Customer Directory</h2>
          <p>Every customer profile stays ready for repeat quotations, quotation sending, and follow-up flow.</p>
        </div>
        <div className="banner-stat">
          <span>Total Customers</span>
          <strong>{customers.length}</strong>
        </div>
      </div>
      <div className="section-head">
        <h3>Customers</h3>
        <div className="toolbar-controls">
          <span>{customers.length} total</span>
          {canCreateCustomer && (
            <button type="button" className="action-btn" onClick={() => setShowCustomerModal(true)}>Add Customer</button>
          )}
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Sr</th>
            <th>Name</th>
            <th>Firm</th>
            <th>Mobile</th>
            <th>Email</th>
            <th>Address</th>
            <th>GST</th>
            <th>Shipping Points</th>
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 ? (
            <tr>
              <td colSpan="8" className="muted">No customers found yet.</td>
            </tr>
          ) : (
            pagedCustomers.map((customer, index) => (
              <tr key={customer.id}>
                <td>{(customerPage - 1) * PAGE_SIZE + index + 1}</td>
                <td>{customer.name}</td>
                <td>{customer.firm_name || "-"}</td>
                <td>{customer.mobile || "-"}</td>
                <td>{customer.email || "-"}</td>
                <td>{customer.address || "-"}</td>
                <td>{customer.gst_number || "-"}</td>
                <td>{Array.isArray(customer.shipping_addresses) ? customer.shipping_addresses.length : 0}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {renderPagination(customerPage, setCustomerPage, customers.length)}
    </section>
  );
}
