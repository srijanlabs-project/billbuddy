import { useMemo, useState } from "react";

export default function CustomersPage(props) {
  const {
    activeModule,
    customers,
    quotations,
    openCreateCustomerModal,
    handleEditCustomer,
    formatQuotationLabel,
    formatCurrency,
    formatDateIST,
    handleOpenOrderDetails,
    canCreateCustomer,
    canEditCustomer,
    handleArchiveCustomer,
    isSubUser,
    currentUserId,
    pagedCustomers,
    customerPage,
    setCustomerPage,
    PAGE_SIZE,
    renderPagination
  } = props;

  if (activeModule !== "Customers") return null;

  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showQuotationListModal, setShowQuotationListModal] = useState(false);

  const selectedCustomerQuotations = useMemo(() => {
    if (!selectedCustomer) return [];
    return (quotations || []).filter((quotation) => {
      const sameCustomerId = String(quotation.customer_id || "") === String(selectedCustomer.id || "");
      const sameMobile = String(quotation.mobile || "").trim() && String(quotation.mobile || "").trim() === String(selectedCustomer.mobile || "").trim();
      return sameCustomerId || sameMobile;
    });
  }, [selectedCustomer, quotations]);

  const canEditSelectedCustomer = Boolean(
    canEditCustomer
    && selectedCustomer
    && (!isSubUser || Number(selectedCustomer.created_by_user_id || 0) === Number(currentUserId || 0))
  );

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
            <button type="button" className="action-btn" onClick={openCreateCustomerModal}>Add Customer</button>
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">No customers found yet.</td>
            </tr>
          ) : (
            pagedCustomers.map((customer, index) => (
              <tr key={customer.id}>
                <td>{(customerPage - 1) * PAGE_SIZE + index + 1}</td>
                <td>{customer.name}</td>
                <td>{customer.firm_name || "-"}</td>
                <td>{customer.mobile || "-"}</td>
                <td>
                  <button type="button" className="ghost-btn compact-btn" onClick={() => setSelectedCustomer(customer)}>
                    View
                  </button>
                  {canEditCustomer ? (
                    <button
                      type="button"
                      className="ghost-btn compact-btn"
                      style={{ marginLeft: "8px" }}
                      title="Archive customer"
                      onClick={() => handleArchiveCustomer(customer.id)}
                    >
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {renderPagination(customerPage, setCustomerPage, customers.length)}

      {selectedCustomer ? (
        <div className="modal-overlay" onClick={(event) => event.stopPropagation()}>
          <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Customer Details</h3>
              <button type="button" className="ghost-btn" onClick={() => setSelectedCustomer(null)}>Close</button>
            </div>

            <div className="settings-two-column">
              <div className="settings-field"><span>Name</span><strong>{selectedCustomer.name || "-"}</strong></div>
              <div className="settings-field"><span>Firm Name</span><strong>{selectedCustomer.firm_name || "-"}</strong></div>
              <div className="settings-field"><span>Mobile</span><strong>{selectedCustomer.mobile || "-"}</strong></div>
              <div className="settings-field"><span>Email</span><strong>{selectedCustomer.email || "-"}</strong></div>
              <div className="settings-field settings-field-wide"><span>Billing Address</span><strong>{selectedCustomer.address || "-"}</strong></div>
              <div className="settings-field"><span>GST</span><strong>{selectedCustomer.gst_number || "-"}</strong></div>
              <div className="settings-field"><span>Monthly Billing</span><strong>{selectedCustomer.monthly_billing ? "Yes" : "No"}</strong></div>
              <div className="settings-field"><span>Shipping Points</span><strong>{Array.isArray(selectedCustomer.shipping_addresses) ? selectedCustomer.shipping_addresses.length : 0}</strong></div>
            </div>

            <div className="settings-panel" style={{ marginTop: "12px" }}>
              <div className="section-head">
                <h3>Shipping Addresses</h3>
              </div>
              {Array.isArray(selectedCustomer.shipping_addresses) && selectedCustomer.shipping_addresses.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Address</th>
                      <th>State</th>
                      <th>Pincode</th>
                      <th>GST</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCustomer.shipping_addresses.map((entry, index) => (
                      <tr key={`shipping-view-${index}`}>
                        <td>{entry?.label || "-"}</td>
                        <td>{entry?.address || "-"}</td>
                        <td>{entry?.state || "-"}</td>
                        <td>{entry?.pincode || "-"}</td>
                        <td>{entry?.gstNumber || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">No shipping addresses added.</p>
              )}
            </div>

            <div className="settings-form-actions" style={{ marginTop: "12px" }}>
              {canEditSelectedCustomer ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    const customerToEdit = selectedCustomer;
                    setSelectedCustomer(null);
                    if (customerToEdit) handleEditCustomer(customerToEdit);
                  }}
                >
                  Edit Customer
                </button>
              ) : null}
              {canEditSelectedCustomer ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    const customerId = selectedCustomer?.id;
                    setSelectedCustomer(null);
                    if (customerId) handleArchiveCustomer(customerId);
                  }}
                >
                  Delete Customer
                </button>
              ) : null}
              <button type="button" onClick={() => setShowQuotationListModal(true)}>
                Quotations Sent To This Customer ({selectedCustomerQuotations.length})
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showQuotationListModal && selectedCustomer ? (
        <div className="modal-overlay" onClick={(event) => event.stopPropagation()}>
          <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Customer Quotations</h3>
              <button type="button" className="ghost-btn" onClick={() => setShowQuotationListModal(false)}>Close</button>
            </div>
            {selectedCustomerQuotations.length === 0 ? (
              <p className="muted">No quotations found for this customer.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Quotation #</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCustomerQuotations.map((quotation) => (
                    <tr key={`customer-quotation-${quotation.id}`}>
                      <td>{formatQuotationLabel(quotation)}</td>
                      <td>{formatDateIST(quotation.created_at) || "-"}</td>
                      <td>{formatCurrency(quotation.total_amount || 0)}</td>
                      <td>
                        <button
                          type="button"
                          className="ghost-btn compact-btn"
                          onClick={() => {
                            setShowQuotationListModal(false);
                            setSelectedCustomer(null);
                            handleOpenOrderDetails(quotation.id);
                          }}
                        >
                          View Quotation
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
