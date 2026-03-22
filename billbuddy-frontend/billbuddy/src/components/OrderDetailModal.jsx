export default function OrderDetailModal(props) {
  const {
    showOrderDetailsModal,
    selectedOrderDetails,
    closeOrderDetailsModal,
    handleDownloadQuotationSheet,
    handleDownloadRichPdfDebug,
    selectedVersionRecord,
    selectedVersionIndex,
    isEditingQuotation,
    setIsEditingQuotation,
    handleSaveQuotationRevision,
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
    error,
    quotationEditForm,
    setQuotationEditForm,
    displayedItems,
    quotationItemFieldChanged,
    handleQuotationItemChange,
    getQuotationItemTitle,
    getQuotationCustomFieldEntries,
    getQuotationItemDimensionText,
    getQuotationItemQuantityValue,
    getQuotationItemRateValue,
    getQuotationItemTotalValue,
    canReviseQuotation
  } = props;

  if (!showOrderDetailsModal || !selectedOrderDetails) return null;

  return (
    <div className="modal-overlay" onClick={closeOrderDetailsModal}>
      <div className="modal-card modal-wide glass-panel" onClick={(event) => event.stopPropagation()}>
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
              onClick={() => handleDownloadRichPdfDebug(selectedOrderDetails.quotation.id)}
            >
              Rich PDF Debug
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setIsEditingQuotation((prev) => !prev)}
              disabled={!canReviseQuotation || Boolean(selectedVersionRecord && selectedVersionIndex > 0)}
            >
              {isEditingQuotation ? "Cancel Edit" : "Edit Quotation"}
            </button>
            {isEditingQuotation && canReviseQuotation && (
              <button type="button" onClick={handleSaveQuotationRevision}>Save New Version</button>
            )}
            <button type="button" className="ghost-btn" onClick={closeOrderDetailsModal}>Close</button>
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
            <span>Customer: {displayedQuotation?.firm_name || displayedQuotation?.customer_name}</span>
            <span>Mobile: {displayedQuotation?.mobile || "-"}</span>
            <span className={quotationFieldChanged("total_amount") ? "change-highlight" : ""}>Total: {formatCurrency(displayedQuotation?.total_amount)}</span>
            <span className={quotationFieldChanged("payment_status") ? "change-highlight" : ""}>Payment: {statusLabel(displayedQuotation?.payment_status)}</span>
          </div>
          <div className="preview-pane">
            <h5>Delivery</h5>
            <span className={quotationFieldChanged("delivery_type") ? "change-highlight" : ""}>Type: {displayedQuotation?.delivery_type || "-"}</span>
            <span className={quotationFieldChanged("delivery_date") ? "change-highlight" : ""}>Date: {formatDateIST(displayedQuotation?.delivery_date)}</span>
            <span className={quotationFieldChanged("delivery_address") ? "change-highlight" : ""}>Address: {displayedQuotation?.delivery_address || "-"}</span>
            <span className={quotationFieldChanged("delivery_pincode") ? "change-highlight" : ""}>Pincode: {displayedQuotation?.delivery_pincode || "-"}</span>
          </div>
        </div>

        <div className="preview-grid" style={{ marginTop: "14px" }}>
          <div className="preview-pane">
            <h5>Charges</h5>
            <span className={quotationFieldChanged("subtotal") ? "change-highlight" : ""}>Subtotal: {formatCurrency(displayedQuotation?.subtotal)}</span>
            <span className={quotationFieldChanged("discount_amount") ? "change-highlight" : ""}>Discount: {formatCurrency(displayedQuotation?.discount_amount)}</span>
            <span className={quotationFieldChanged("advance_amount") ? "change-highlight" : ""}>Advance: {formatCurrency(displayedQuotation?.advance_amount)}</span>
            <span>Outstanding: {formatCurrency(selectedOrderDetails.customerOutstanding)}</span>
          </div>
          <div className="preview-pane">
            <h5>Version Info</h5>
            <span>Selected: {selectedVersionRecord ? getVersionLabel(selectedVersionRecord) : `Ver.${displayedQuotation?.version_no || 1}`}</span>
            <span>Saved At: {selectedVersionRecord ? formatDateIST(selectedVersionRecord.created_at) : "-"}</span>
            <span>Updated By: {selectedVersionRecord?.actor_name || "System"}</span>
            <span>{previousVersionRecord ? "Highlighted fields changed from previous version." : "This is the first saved version."}</span>
          </div>
        </div>

        {isEditingQuotation && (
          <div className="preview-grid" style={{ marginTop: "14px" }}>
            <div className="preview-pane">
              <h5>Edit Delivery</h5>
              <input
                placeholder="Custom quotation number"
                value={quotationEditForm.customQuotationNumber}
                onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, customQuotationNumber: e.target.value }))}
              />
              <select value={quotationEditForm.deliveryType} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, deliveryType: e.target.value }))}>
                <option value="PICKUP">Pickup</option>
                <option value="DOORSTEP">Doorstep</option>
              </select>
              <input type="date" value={quotationEditForm.deliveryDate || ""} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, deliveryDate: e.target.value }))} />
              <input placeholder="Delivery address" value={quotationEditForm.deliveryAddress} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, deliveryAddress: e.target.value }))} />
              <input placeholder="Delivery pincode" value={quotationEditForm.deliveryPincode} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, deliveryPincode: e.target.value }))} />
            </div>
          </div>
        )}

        <table className="data-table" style={{ marginTop: "14px" }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Material Thickness</th>
              <th>Size</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(isEditingQuotation
              ? quotationEditForm.items
              : displayedItems || []).map((item, index) => (
              <tr key={item.id}>
                <td className={!isEditingQuotation && (quotationItemFieldChanged(item, index, "material_name") || quotationItemFieldChanged(item, index, "material_type") || quotationItemFieldChanged(item, index, "design_name") || quotationItemFieldChanged(item, index, "sku")) ? "change-highlight-cell" : ""}>
                  {isEditingQuotation ? (
                    <input value={item.materialName || ""} onChange={(e) => handleQuotationItemChange(index, "materialName", e.target.value)} />
                  ) : (
                    <div className="quotation-item-cell">
                      <strong>{getQuotationItemTitle(item) || "-"}</strong>
                      {getQuotationCustomFieldEntries(item.custom_fields).length > 0 && (
                        <div className="quotation-item-meta">
                          {getQuotationCustomFieldEntries(item.custom_fields).map((entry) => `${entry.label}: ${entry.value}`).join(" | ")}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className={!isEditingQuotation && quotationItemFieldChanged(item, index, "thickness") ? "change-highlight-cell" : ""}>
                  {isEditingQuotation ? (
                    <input value={item.thickness || ""} onChange={(e) => handleQuotationItemChange(index, "thickness", e.target.value)} />
                  ) : (
                    item.thickness || "-"
                  )}
                </td>
                <td className={!isEditingQuotation && quotationItemFieldChanged(item, index, "size") ? "change-highlight-cell" : ""}>
                  {isEditingQuotation ? (
                    <input value={item.size || ""} onChange={(e) => handleQuotationItemChange(index, "size", e.target.value)} />
                  ) : (
                    getQuotationItemDimensionText(item)
                  )}
                </td>
                <td className={!isEditingQuotation && quotationItemFieldChanged(item, index, "quantity") ? "change-highlight-cell" : ""}>
                  {isEditingQuotation ? (
                    <input type="number" value={item.quantity || ""} onChange={(e) => handleQuotationItemChange(index, "quantity", e.target.value)} />
                  ) : (
                    getQuotationItemQuantityValue(item)
                  )}
                </td>
                <td className={!isEditingQuotation && (quotationItemFieldChanged(item, index, "unit_price") || quotationItemFieldChanged(item, index, "unitPrice")) ? "change-highlight-cell" : ""}>
                  {isEditingQuotation ? (
                    <input type="number" value={item.unitPrice || ""} onChange={(e) => handleQuotationItemChange(index, "unitPrice", e.target.value)} />
                  ) : (
                    formatCurrency(getQuotationItemRateValue(item))
                  )}
                </td>
                <td className={!isEditingQuotation && (quotationItemFieldChanged(item, index, "total_price") || quotationItemFieldChanged(item, index, "totalPrice")) ? "change-highlight-cell" : ""}>
                  {isEditingQuotation
                    ? formatCurrency(Number(item.quantity || 0) * Number(item.unitPrice || 0))
                    : formatCurrency(getQuotationItemTotalValue(item))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
