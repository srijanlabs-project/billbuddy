function formatApprovalStatusLabel(status) {
  const normalized = String(status || "pending").toLowerCase();
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "superseded") return "Superseded";
  return "Pending";
}

function getApprovalStatusClass(status) {
  const normalized = String(status || "pending").toLowerCase();
  if (normalized === "approved") return "success";
  if (normalized === "rejected") return "error";
  if (normalized === "superseded") return "neutral";
  return "pending";
}

function formatApprovalReason(reason) {
  const type = String(reason?.reason_type || "").toLowerCase();
  if (type === "amount_limit_exceeded") {
    return {
      title: "Amount limit exceeded",
      summary: `Requested ${Number(reason?.requested_value || 0).toLocaleString("en-IN")} against allowed ${Number(reason?.allowed_value || 0).toLocaleString("en-IN")}.`
    };
  }
  if (type === "price_exception_below_min_rate") {
    const meta = reason?.meta_json || {};
    return {
      title: "Below minimum allowed rate",
      summary: `${meta?.productName || meta?.itemTitle || "Item"} requested at ${Number(reason?.requested_value || 0).toLocaleString("en-IN")} while minimum allowed is ${Number(reason?.allowed_value || 0).toLocaleString("en-IN")}.`
    };
  }
  return {
    title: "Approval exception",
    summary: "This quotation has a captured approval reason that needs review."
  };
}

export default function ApprovalsPage(props) {
  const {
    activeModule,
    currentModuleMeta,
    approvals,
    selectedApprovalId,
    selectedApprovalDetail,
    approvalFilter,
    setApprovalFilter,
    openApprovalDetail,
    handleApprovalDecision,
    approvalDecisionNote,
    setApprovalDecisionNote,
    approvalDecisionLoading,
    canAccessApprovals,
    canDecideApprovals,
    formatCurrency,
    formatDateTime,
    handleDownloadQuotation
  } = props;

  if (activeModule !== "Approvals") return null;

  if (!canAccessApprovals) {
    return (
      <section className="module-placeholder glass-panel">
        <div className="page-banner">
          <div>
            <p className="eyebrow">{currentModuleMeta.Approvals.eyebrow}</p>
            <h2>{currentModuleMeta.Approvals.title}</h2>
            <p>{currentModuleMeta.Approvals.subtitle}</p>
          </div>
        </div>
        <div className="notice">Approval decisions are available only to mapped approvers and seller admins.</div>
      </section>
    );
  }

  const filters = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "superseded", label: "Superseded" },
    { value: "all", label: "All" }
  ];

  const filteredApprovals = approvals.filter((approval) => approvalFilter === "all" || String(approval.status || "").toLowerCase() === approvalFilter);
  const selectedApproval = selectedApprovalDetail?.approval || null;
  const selectedReasons = Array.isArray(selectedApproval?.reasons) ? selectedApproval.reasons : [];
  const selectedItems = Array.isArray(selectedApprovalDetail?.quotationItems) ? selectedApprovalDetail.quotationItems : [];
  const isSuperseded = Boolean(selectedApproval?.is_superseded_view || !selectedApproval?.is_latest_request);
  const canTakeDecision = canDecideApprovals && String(selectedApproval?.status || "").toLowerCase() === "pending" && !isSuperseded;

  return (
    <section className="module-placeholder glass-panel approvals-module">
      <div className="page-banner">
        <div>
          <p className="eyebrow">{currentModuleMeta.Approvals.eyebrow}</p>
          <h2>{currentModuleMeta.Approvals.title}</h2>
          <p>{currentModuleMeta.Approvals.subtitle}</p>
        </div>
        <div className="banner-stat">
          <span>Pending Queue</span>
          <strong>{approvals.filter((approval) => String(approval.status || "").toLowerCase() === "pending").length}</strong>
        </div>
      </div>

      <div className="approvals-toolbar">
        <div className="approvals-filter-row">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={`ghost-btn compact-btn ${approvalFilter === filter.value ? "active-filter" : ""}`}
              onClick={() => setApprovalFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <span>{filteredApprovals.length} request(s)</span>
      </div>

      <div className="approvals-layout">
        <div className="approvals-list-panel">
          {filteredApprovals.length === 0 ? (
            <div className="empty-state">No approval requests match this filter right now.</div>
          ) : (
            <div className="approvals-list">
              {filteredApprovals.map((approval) => (
                <button
                  key={approval.id}
                  type="button"
                  className={`approvals-list-item ${Number(selectedApprovalId || 0) === Number(approval.id) ? "active" : ""}`}
                  onClick={() => openApprovalDetail(approval.id)}
                >
                  <div className="approvals-list-head">
                    <strong>{approval.custom_quotation_number || approval.seller_quotation_number || approval.quotation_number || `Quotation ${approval.quotation_id}`}</strong>
                    <span className={`badge ${getApprovalStatusClass(approval.status)}`}>{formatApprovalStatusLabel(approval.status)}</span>
                  </div>
                  <div className="approvals-list-meta">
                    <span>{approval.firm_name || approval.customer_name || "Customer"}</span>
                    <span>{formatCurrency(approval.requested_amount || approval.total_amount || 0)}</span>
                  </div>
                <div className="approvals-list-meta">
                  <span>Requester: {approval.requester_name || "-"}</span>
                  <span>Version {approval.quotation_version_no || approval.current_version_no || 1}</span>
                </div>
                <div className="approvals-list-meta">
                  <span>Approver: {approval.approver_name || "-"}</span>
                  <span>{formatDateTime(approval.created_at)}</span>
                </div>
                {(approval.is_superseded_view || !approval.is_latest_request) && (
                  <div className="approval-inline-warning">Superseded by a newer quotation version</div>
                )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="approvals-detail-panel glass-panel">
          {!selectedApproval ? (
            <div className="empty-state">Select an approval request to review the latest quotation version and take action.</div>
          ) : (
            <>
              <div className="section-head">
                <div>
                  <h3>{selectedApproval.custom_quotation_number || selectedApproval.seller_quotation_number || selectedApproval.quotation_number || `Quotation ${selectedApproval.quotation_id}`}</h3>
                  <span>{selectedApproval.firm_name || selectedApproval.customer_name || "Customer"} | Requested by {selectedApproval.requester_name || "-"}</span>
                </div>
                <span className={`badge ${getApprovalStatusClass(selectedApproval.status)}`}>{formatApprovalStatusLabel(selectedApproval.status)}</span>
              </div>

              {isSuperseded && (
                <div className="notice warning">
                  This is not the latest version of the quotation. Please review the latest PDF before approving.
                  {selectedApprovalDetail?.latestRequest?.id ? (
                    <button type="button" className="ghost-btn compact-btn" onClick={() => openApprovalDetail(selectedApprovalDetail.latestRequest.id)}>
                      Open Latest Version
                    </button>
                  ) : null}
                </div>
              )}

              <div className="approvals-summary-grid">
                <div className="settings-usage-card">
                  <span>Amount</span>
                  <strong>{formatCurrency(selectedApproval.requested_amount || selectedApproval.total_amount || 0)}</strong>
                </div>
                <div className="settings-usage-card">
                  <span>Requested On</span>
                  <strong>{formatDateTime(selectedApproval.created_at)}</strong>
                </div>
                <div className="settings-usage-card">
                  <span>Assigned Approver</span>
                  <strong>{selectedApproval.approver_name || "-"}</strong>
                </div>
                <div className="settings-usage-card">
                  <span>Quotation Version</span>
                  <strong>{selectedApproval.quotation_version_no || selectedApproval.current_version_no || 1}</strong>
                </div>
              </div>

              <div className="settings-panel">
                <div className="section-head">
                  <h4>Approval Reasons</h4>
                </div>
                <div className="approvals-reason-list">
                  {selectedReasons.length ? selectedReasons.map((reason) => {
                    const formatted = formatApprovalReason(reason);
                    return (
                      <article key={reason.id} className="approval-reason-card">
                        <strong>{formatted.title}</strong>
                        <p>{formatted.summary}</p>
                      </article>
                    );
                  }) : <p className="muted">No captured approval reasons were found for this request.</p>}
                </div>
              </div>

              <div className="settings-panel">
                <div className="section-head">
                  <h4>Quotation Snapshot</h4>
                  <button type="button" className="ghost-btn compact-btn" onClick={() => handleDownloadQuotation(selectedApproval.quotation_id)}>Download PDF</button>
                </div>
                <div className="settings-preview-table-wrap">
                  <table className="settings-preview-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.length ? selectedItems.map((item) => (
                        <tr key={item.id}>
                          <td>{item.design_name || item.material_name || item.sku || `Item ${item.id}`}</td>
                          <td>{item.quantity || item.input_quantity || 0}</td>
                          <td>{formatCurrency(item.unit_price || 0)}</td>
                          <td>{formatCurrency(item.line_total || item.total_price || 0)}</td>
                        </tr>
                      )) : <tr><td colSpan="4">No item snapshot available.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              {(selectedApproval.decision_note || canTakeDecision || !canDecideApprovals) && (
                <div className="settings-panel">
                  <div className="section-head">
                    <h4>Decision</h4>
                  </div>
                  {!canDecideApprovals ? (
                    <div className="notice info">This is a read-only approval history view. Decision controls are available only to assigned approvers.</div>
                  ) : null}
                  {selectedApproval.decision_note ? (
                    <div className="approval-note-block">
                      <span>Previous Decision Note</span>
                      <p>{selectedApproval.decision_note}</p>
                    </div>
                  ) : null}
                  {canTakeDecision ? (
                    <>
                      <textarea
                        rows="4"
                        placeholder="Add approval or rejection note"
                        value={approvalDecisionNote}
                        onChange={(event) => setApprovalDecisionNote(event.target.value)}
                      />
                      <div className="toolbar-controls">
                        <button
                          type="button"
                          className="ghost-btn compact-btn"
                          disabled={approvalDecisionLoading}
                          onClick={() => handleApprovalDecision(selectedApproval.id, "rejected", approvalDecisionNote)}
                        >
                          {approvalDecisionLoading ? "Saving..." : "Reject"}
                        </button>
                        <button
                          type="button"
                          className="action-btn compact-btn"
                          disabled={approvalDecisionLoading}
                          onClick={() => handleApprovalDecision(selectedApproval.id, "approved", approvalDecisionNote)}
                        >
                          {approvalDecisionLoading ? "Saving..." : "Approve"}
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
