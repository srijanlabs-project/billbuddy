import { getItemDisplayFieldValue } from "../utils/quotationView";

function normalizeColumnKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

function getOrderItemColumnValue(item, columnKey, {
  getQuotationItemDimensionText,
  getQuotationItemQuantityValue,
  getQuotationItemRateValue,
  getQuotationItemTotalValue
}) {
  const normalizedKey = normalizeColumnKey(columnKey);
  if (normalizedKey === "amount" || normalizedKey === "total" || normalizedKey === "total_price") {
    return getQuotationItemTotalValue(item);
  }
  if (normalizedKey === "rate" || normalizedKey === "unit_price") {
    return getQuotationItemRateValue(item);
  }
  if (normalizedKey === "quantity" || normalizedKey === "qty") {
    return getQuotationItemQuantityValue(item);
  }
  if (normalizedKey === "dimension") {
    return getQuotationItemDimensionText(item);
  }
  return getItemDisplayFieldValue(item, normalizedKey);
}

export default function OrderDetailPage(props) {
  const {
    showOrderDetailsPage,
    selectedOrderDetails,
    closeOrderDetailsPage,
    handleDownloadQuotationSheet,
    handleSendQuotationEmail,
    selectedVersionRecord,
    selectedVersionIndex,
    setIsEditingQuotation,
    shouldShowVersionSelector,
    selectedVersionId,
    setSelectedVersionId,
    orderVersions,
    getVersionLabel,
    formatDateIST,
    displayedQuotation,
    previousVersionRecord,
    quotationFieldChanged,
    formatQuotationLabel,
    formatCurrency,
    statusLabel,
    approvalStatusLabel,
    openApprovalRequest,
    error,
    orderDetailColumns,
    displayedItems,
    quotationItemFieldChanged,
    getQuotationItemTitle,
    getQuotationCustomFieldEntries,
    getQuotationItemDimensionText,
    getQuotationItemQuantityValue,
    getQuotationItemRateValue,
    getQuotationItemTotalValue,
    canReviseQuotation
  } = props;

  if (!showOrderDetailsPage || !selectedOrderDetails) return null;

  return (
    <section className="module-placeholder glass-panel">
      <div className="section-head">
        <h3>Quotation Details</h3>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => handleDownloadQuotationSheet(selectedOrderDetails.quotation.id)}
          >
            XLSX
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => handleSendQuotationEmail(selectedOrderDetails.quotation.id)}
          >
            Send Email
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setIsEditingQuotation(true)}
            disabled={!canReviseQuotation || Boolean(selectedVersionRecord && selectedVersionIndex > 0)}
          >
            Edit Quotation
          </button>
          <button type="button" className="ghost-btn" onClick={closeOrderDetailsPage}>Back to List</button>
        </div>
      </div>
      {error && <div className="notice error">{error}</div>}

      {shouldShowVersionSelector && (
        <div className="version-selector-bar">
          <label>
            Quotation Version
            <select
              value={selectedVersionId || "current"}
              onChange={(e) => {
                setSelectedVersionId(e.target.value === "current" ? "" : e.target.value);
                setIsEditingQuotation(false);
              }}
            >
              {!selectedVersionRecord && (
                <option value="current">
                  Ver.{selectedOrderDetails?.quotation?.version_no || 1} | Current quotation
                </option>
              )}
              {orderVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {getVersionLabel(version)} | {formatDateIST(version.created_at)}
                </option>
              ))}
            </select>
          </label>
          {((selectedVersionRecord && selectedVersionIndex > 0) || (!selectedVersionRecord && Number(selectedOrderDetails?.quotation?.version_no || 1) > 1)) && (
            <span className="version-note">Historical version selected. Edit is available only on the latest version.</span>
          )}
        </div>
      )}

      <div className="preview-grid">
        <div className="preview-pane">
          <h5>Quotation Summary</h5>
          <span className={quotationFieldChanged("quotation_number") || quotationFieldChanged("version_no") ? "change-highlight" : ""}>Quotation No: {formatQuotationLabel(displayedQuotation)}</span>
          <span>Customer: {displayedQuotation?.firm_name || displayedQuotation?.customer_name || selectedOrderDetails?.quotation?.firm_name || selectedOrderDetails?.quotation?.customer_name || "-"}</span>
          <span>Mobile: {displayedQuotation?.mobile || selectedOrderDetails?.quotation?.mobile || "-"}</span>
          <span className={quotationFieldChanged("approval_status") ? "change-highlight" : ""}>Approval: {approvalStatusLabel(displayedQuotation?.approval_status)}</span>
        </div>
        <div className="preview-pane">
          <h5>Delivery</h5>
          <span className={quotationFieldChanged("delivery_type") ? "change-highlight" : ""}>Type: {displayedQuotation?.delivery_type || "-"}</span>
          <span className={quotationFieldChanged("delivery_date") ? "change-highlight" : ""}>Date: {formatDateIST(displayedQuotation?.delivery_date)}</span>
          <span className={quotationFieldChanged("reference_request_id") ? "change-highlight" : ""}>Reference Request ID: {displayedQuotation?.reference_request_id || "-"}</span>
          {String(displayedQuotation?.delivery_type || "PICKUP").toUpperCase() === "DOORSTEP" && (
            <>
              <span className={quotationFieldChanged("delivery_address") ? "change-highlight" : ""}>Address: {displayedQuotation?.delivery_address || "-"}</span>
              <span className={quotationFieldChanged("delivery_pincode") ? "change-highlight" : ""}>Pincode: {displayedQuotation?.delivery_pincode || "-"}</span>
            </>
          )}
        </div>
      </div>

      <div className="preview-grid" style={{ marginTop: "14px" }}>
        <div className="preview-pane">
          <h5>Charges</h5>
          {(() => {
            const lineTotals = (displayedItems || []).map((item) => Number(getQuotationItemTotalValue(item) || 0));
            const total = lineTotals.length ? lineTotals.reduce((sum, value) => sum + value, 0) : Number(displayedQuotation?.total_amount || 0);
            const discount = Number(displayedQuotation?.discount_amount || 0);
            const advance = Number(displayedQuotation?.advance_amount || 0);
            const balance = Math.max(0, Number((total - discount - advance).toFixed(2)));
            return (
              <>
                <span className={quotationFieldChanged("total_amount") ? "change-highlight" : ""}>Total: {formatCurrency(total)}</span>
                <span className={quotationFieldChanged("discount_amount") ? "change-highlight" : ""}>Discount: (-) {formatCurrency(discount)}</span>
                <span className={quotationFieldChanged("advance_amount") ? "change-highlight" : ""}>Advance: {formatCurrency(advance)}</span>
                <span>Balance: {formatCurrency(balance)}</span>
                <span className={quotationFieldChanged("payment_status") ? "change-highlight" : ""}>Payment: {statusLabel(displayedQuotation?.payment_status)}</span>
                <span>Outstanding: (Total outstanding till date: {formatCurrency(selectedOrderDetails.customerOutstanding)})</span>
              </>
            );
          })()}
        </div>
        <div className="preview-pane">
          <h5>Version Info</h5>
          <span>Selected: {selectedVersionRecord ? getVersionLabel(selectedVersionRecord) : `Ver.${displayedQuotation?.version_no || 1}`}</span>
          <span>Saved At: {selectedVersionRecord ? formatDateIST(selectedVersionRecord.created_at) : "-"}</span>
          <span>Updated By: {selectedVersionRecord?.actor_name || "System"}</span>
          <span>{previousVersionRecord ? "Highlighted fields changed from previous version." : "This is the first saved version."}</span>
        </div>
      </div>

      {selectedOrderDetails?.activeApprovalRequest && (
        <div className="preview-grid" style={{ marginTop: "14px" }}>
          <div className="preview-pane">
            <h5>Approval Flow</h5>
            <span>Status: {approvalStatusLabel(selectedOrderDetails.activeApprovalRequest.status || displayedQuotation?.approval_status)}</span>
            <span>Requester: {selectedOrderDetails.activeApprovalRequest.requester_name || "-"}</span>
            <span>Approver: {selectedOrderDetails.activeApprovalRequest.approver_name || "-"}</span>
            <span>Version: {selectedOrderDetails.activeApprovalRequest.quotation_version_no || displayedQuotation?.version_no || 1}</span>
          </div>
          <div className="preview-pane">
            <h5>Approval Actions</h5>
            <span>{selectedOrderDetails.activeApprovalRequest.decision_note || "No decision note yet."}</span>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => openApprovalRequest(selectedOrderDetails.activeApprovalRequest.id)}
            >
              Open Approval Request
            </button>
          </div>
        </div>
      )}

      <table className="data-table" style={{ marginTop: "14px" }}>
        <thead>
          <tr>
            {(orderDetailColumns || []).map((column) => (
              <th key={column.key}>{column.label || column.key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(displayedItems || []).map((item, index) => (
            <tr key={item.id || item.tempId || index}>
              {(orderDetailColumns || []).map((column) => {
                const normalizedKey = normalizeColumnKey(column.key);
                const compareKey = normalizedKey === "rate" ? "unit_price" : normalizedKey === "amount" ? "total_price" : normalizedKey;
                const changed = quotationItemFieldChanged(item, index, compareKey);
                const value = getOrderItemColumnValue(item, normalizedKey, {
                  getQuotationItemDimensionText,
                  getQuotationItemQuantityValue,
                  getQuotationItemRateValue,
                  getQuotationItemTotalValue
                });
                const isMoney = ["rate", "unit_price", "amount", "total", "total_price"].includes(normalizedKey);

                return (
                  <td key={`${column.key}-${index}`} className={changed ? "change-highlight-cell" : ""}>
                    {normalizedKey === "material_name" ? (
                      <div className="quotation-item-cell">
                        <strong>{getQuotationItemTitle(item) || "-"}</strong>
                        {getQuotationCustomFieldEntries(item.custom_fields || item.customFields || {})
                          .filter((entry) => !(orderDetailColumns || []).some((col) => normalizeColumnKey(col.key) === normalizeColumnKey(entry.key)))
                          .length > 0 && (
                          <div className="quotation-item-meta">
                            {getQuotationCustomFieldEntries(item.custom_fields || item.customFields || {})
                              .filter((entry) => !(orderDetailColumns || []).some((col) => normalizeColumnKey(col.key) === normalizeColumnKey(entry.key)))
                              .map((entry) => `${entry.label}: ${entry.value}`).join(" | ")}
                          </div>
                        )}
                      </div>
                    ) : (
                      isMoney ? formatCurrency(value) : (value === null || value === undefined || String(value).trim() === "" ? "-" : value)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
