import { useMemo, useState } from "react";

function getQuotationBadgeClass(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'READY_DISPATCH') return 'quotation-ready-dispatch';
  if (normalized === 'READY_PICKUP') return 'quotation-ready-pickup';
  if (normalized === 'DELIVERED') return 'quotation-delivered';
  return 'quotation-new';
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

function toDateValue(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
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
    quotations,
    seller,
    isPlatformAdmin,
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
    handleDownloadQuotation,
    handleSendQuotationEmail,
    renderPagination,
    canEditQuotation,
    canSendQuotation,
    canMarkPaid,
    canDownloadQuotationPdf,
    loadQuotationExportDraft,
    downloadQuotationExportSheet
  } = props;

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStep, setExportStep] = useState("filters");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportCustomerInput, setExportCustomerInput] = useState("");
  const [exportFromDate, setExportFromDate] = useState("");
  const [exportToDate, setExportToDate] = useState("");
  const [exportMobileInput, setExportMobileInput] = useState("");
  const [selectedQuotationIds, setSelectedQuotationIds] = useState([]);
  const [exportRows, setExportRows] = useState([]);
  const [exportFieldOptions, setExportFieldOptions] = useState([]);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState([]);

  const mobileSuggestions = useMemo(() => {
    const term = exportMobileInput.trim();
    if (term.length < 2) return [];
    const mobileSet = new Set(
      (quotations || [])
        .map((row) => String(row.mobile || "").trim())
        .filter((value) => value)
        .filter((value) => value.includes(term))
    );
    return Array.from(mobileSet).slice(0, 8);
  }, [quotations, exportMobileInput]);

  const customerSuggestions = useMemo(() => {
    const term = exportCustomerInput.trim().toLowerCase();
    if (term.length < 2) return [];
    const customerSet = new Set(
      (quotations || [])
        .map((row) => row.firm_name || row.customer_name || "")
        .map((value) => String(value || "").trim())
        .filter((value) => value)
        .filter((value) => value.toLowerCase().includes(term))
    );
    return Array.from(customerSet).slice(0, 8);
  }, [quotations, exportCustomerInput]);

  const filteredExportOrders = useMemo(() => {
    const customerTerm = exportCustomerInput.trim().toLowerCase();
    return (quotations || []).filter((row) => {
      if (customerTerm.length >= 2) {
        const customerName = String(row.firm_name || row.customer_name || "").toLowerCase();
        if (!customerName.includes(customerTerm)) return false;
      }
      const rowDate = toDateValue(row.created_at);
      if (exportFromDate && rowDate && rowDate < exportFromDate) return false;
      if (exportToDate && rowDate && rowDate > exportToDate) return false;
      if (exportMobileInput.trim().length >= 2 && !String(row.mobile || "").includes(exportMobileInput.trim())) return false;
      return true;
    });
  }, [quotations, exportCustomerInput, exportFromDate, exportToDate, exportMobileInput]);

  const allFilteredSelected = filteredExportOrders.length > 0
    && filteredExportOrders.every((row) => selectedQuotationIds.includes(row.id));

  function resetExportModalState() {
    setExportStep("filters");
    setExportLoading(false);
    setExportError("");
    setExportCustomerInput("");
    setExportFromDate("");
    setExportToDate("");
    setExportMobileInput("");
    setSelectedQuotationIds([]);
    setExportRows([]);
    setExportFieldOptions([]);
    setSelectedFieldKeys([]);
  }

  function openExportModal() {
    resetExportModalState();
    setShowExportModal(true);
  }

  function closeExportModal() {
    setShowExportModal(false);
    resetExportModalState();
  }

  function toggleQuotationSelection(id) {
    setSelectedQuotationIds((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]
    );
  }

  function toggleSelectAllFiltered() {
    setSelectedQuotationIds((prev) => {
      if (allFilteredSelected) {
        return prev.filter((id) => !filteredExportOrders.some((row) => row.id === id));
      }
      const merged = new Set([...prev, ...filteredExportOrders.map((row) => row.id)]);
      return Array.from(merged);
    });
  }

  async function handlePrepareExportFields() {
    if (!selectedQuotationIds.length) {
      setExportError("Please select at least one quotation.");
      return;
    }
    const selectedRows = (quotations || []).filter((row) => selectedQuotationIds.includes(row.id));
    if (!selectedRows.length) {
      setExportError("No quotations found for current selection.");
      return;
    }
    const selectedSellerIds = Array.from(
      new Set(selectedRows.map((row) => Number(row.seller_id || 0)).filter((value) => value > 0))
    );
    if (selectedSellerIds.length > 1) {
      setExportError("Please select quotations from one seller account only.");
      return;
    }
    const resolvedSellerId = selectedSellerIds[0] || (isPlatformAdmin ? null : Number(seller?.id || 0));
    try {
      setExportError("");
      setExportLoading(true);
      const draft = await loadQuotationExportDraft(selectedQuotationIds, { sellerId: resolvedSellerId });
      const options = Array.isArray(draft?.fieldOptions) ? draft.fieldOptions : [];
      const rows = Array.isArray(draft?.rows) ? draft.rows : [];
      const draftSellerIds = Array.from(
        new Set(rows.map((row) => Number(row.seller_id || 0)).filter((value) => value > 0))
      );
      if (draftSellerIds.length > 1) {
        setExportError("Please select quotations from one seller account only.");
        return;
      }
      if (!rows.length) {
        setExportError("No export data found for the selected seller scope.");
        return;
      }
      setExportRows(rows);
      setExportFieldOptions(options);
      setSelectedFieldKeys(options.map((entry) => entry.key));
      setExportStep("fields");
    } catch (error) {
      setExportError(error?.message || "Failed to prepare export data.");
    } finally {
      setExportLoading(false);
    }
  }

  function toggleFieldSelection(key) {
    setSelectedFieldKeys((prev) => (prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key]));
  }

  function moveSelectedField(key, direction) {
    setSelectedFieldKeys((prev) => {
      const index = prev.indexOf(key);
      if (index < 0) return prev;
      const nextIndex = direction === "up" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  function handleDownloadSelectedExcel() {
    if (!selectedFieldKeys.length) {
      setExportError("Please select at least one field to download.");
      return;
    }
    downloadQuotationExportSheet(exportRows, selectedFieldKeys);
    closeExportModal();
  }

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
      <div className="section-head">
        <h3>Quotation Tracker</h3>
        <div className="toolbar-controls">
          <span>{filteredOrders.length} total</span>
          <button type="button" className="ghost-btn order-export-trigger-btn" onClick={openExportModal}>Download Excel</button>
        </div>
      </div>
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
            <th>Approval</th>
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
                <span className={`badge ${getApprovalBadgeClass(order.approval_status)}`}>{getApprovalLabel(order.approval_status)}</span>
              </td>
              <td>
                <div className="order-actions">
                  {canSendQuotation && (
                    <button type="button" className="ghost-btn order-action-btn" onClick={() => handleMarkQuotationSent(order.id)} disabled={order.quotation_sent}>Send</button>
                  )}
                  {canMarkPaid && (
                    <button type="button" className="ghost-btn order-action-btn" onClick={() => handleMarkPaid(order.id)} disabled={order.payment_status === "paid"}>Paid</button>
                  )}
                  {canDownloadQuotationPdf && (
                    <button type="button" className="ghost-btn order-action-btn icon-btn" onClick={() => handleDownloadQuotation(order.id)} title="Download PDF">PDF</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {renderPagination(orderPage, setOrderPage, filteredOrders.length)}

      {showExportModal ? (
        <div className="modal-overlay" onClick={closeExportModal}>
          <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>{exportStep === "filters" ? "Download Excel" : "Select Fields & Sequence"}</h3>
              <button type="button" className="ghost-btn" onClick={closeExportModal}>Close</button>
            </div>

            {exportStep === "filters" ? (
              <>
                <div className="settings-two-column">
                  <label className="settings-field settings-field-wide">
                    <span>Customer</span>
                    <input
                      type="text"
                      value={exportCustomerInput}
                      onChange={(event) => setExportCustomerInput(event.target.value)}
                      placeholder="Type at least 2 characters"
                    />
                    {customerSuggestions.length > 0 ? (
                      <div className="rq-suggest-list" style={{ marginTop: "6px", maxHeight: "160px" }}>
                        {customerSuggestions.map((customerName) => (
                          <button key={customerName} type="button" className="rq-suggest-row" onClick={() => setExportCustomerInput(customerName)}>
                            <span className="rq-suggest-main">{customerName}</span>
                            <span className="rq-suggest-meta">Customer match</span>
                            <span className="rq-suggest-meta">Tap to apply</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>
                  <label className="settings-field">
                    <span>From Date</span>
                    <input type="date" value={exportFromDate} onChange={(event) => setExportFromDate(event.target.value)} />
                  </label>
                  <label className="settings-field">
                    <span>To Date</span>
                    <input type="date" value={exportToDate} onChange={(event) => setExportToDate(event.target.value)} />
                  </label>
                  <label className="settings-field settings-field-wide">
                    <span>Mobile Number</span>
                    <input
                      type="text"
                      value={exportMobileInput}
                      onChange={(event) => setExportMobileInput(event.target.value)}
                      placeholder="Type at least 2 digits"
                    />
                    {mobileSuggestions.length > 0 ? (
                      <div className="rq-suggest-list" style={{ marginTop: "6px", maxHeight: "160px" }}>
                        {mobileSuggestions.map((mobile) => (
                          <button key={mobile} type="button" className="rq-suggest-row" onClick={() => setExportMobileInput(mobile)}>
                            <span className="rq-suggest-main">{mobile}</span>
                            <span className="rq-suggest-meta">Mobile match</span>
                            <span className="rq-suggest-meta">Tap to apply</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </label>
                </div>

                <div className="table-wrap" style={{ marginTop: "12px", maxHeight: "320px", overflow: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleSelectAllFiltered}
                            style={{ width: "auto" }}
                          />
                        </th>
                        <th>Quotation #</th>
                        <th>Customer</th>
                        <th>Mobile</th>
                        <th>Date</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExportOrders.length === 0 ? (
                        <tr><td colSpan={6}>No quotations found for selected filters.</td></tr>
                      ) : (
                        filteredExportOrders.map((row) => (
                          <tr key={`export-row-${row.id}`}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedQuotationIds.includes(row.id)}
                                onChange={() => toggleQuotationSelection(row.id)}
                                style={{ width: "auto" }}
                              />
                            </td>
                            <td>{formatQuotationLabel(row)}</td>
                            <td>{row.firm_name || row.customer_name || "-"}</td>
                            <td>{row.mobile || "-"}</td>
                            <td>{toDateValue(row.created_at) || "-"}</td>
                            <td>{formatCurrency(row.total_amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {exportError ? <div className="notice error">{exportError}</div> : null}

                <div className="settings-form-actions" style={{ marginTop: "14px", position: "sticky", bottom: 0 }}>
                  <button type="button" onClick={handlePrepareExportFields} disabled={exportLoading || selectedQuotationIds.length === 0}>
                    {exportLoading ? "Preparing..." : "Download in Excel"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="settings-panel">
                  <div className="settings-panel-head">
                    <h4>Select Fields and Column Order</h4>
                    <p>{exportRows.length} row(s) ready from selected quotations.</p>
                  </div>
                  <div className="table-wrap" style={{ maxHeight: "420px", overflow: "auto" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Use</th>
                          <th>Field</th>
                          <th>Sequence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exportFieldOptions.map((field) => {
                          const selected = selectedFieldKeys.includes(field.key);
                          const sequence = selected ? selectedFieldKeys.indexOf(field.key) + 1 : "-";
                          return (
                            <tr key={`field-${field.key}`}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleFieldSelection(field.key)}
                                  style={{ width: "auto" }}
                                />
                              </td>
                              <td>{field.label}</td>
                              <td>
                                {selected ? (
                                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                    <span>{sequence}</span>
                                    <button type="button" className="ghost-btn compact-btn" onClick={() => moveSelectedField(field.key, "up")}>Up</button>
                                    <button type="button" className="ghost-btn compact-btn" onClick={() => moveSelectedField(field.key, "down")}>Down</button>
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {exportError ? <div className="notice error">{exportError}</div> : null}

                <div className="settings-form-actions" style={{ marginTop: "14px" }}>
                  <button type="button" className="ghost-btn" onClick={() => setExportStep("filters")}>Back</button>
                  <button type="button" onClick={handleDownloadSelectedExcel}>Download XLSX</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}



