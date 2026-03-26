import { useState } from "react";
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

export default function OrderDetailModal(props) {
  const {
    showOrderDetailsModal,
    selectedOrderDetails,
    closeOrderDetailsModal,
    closeEditModal,
    handleDownloadQuotationSheet,
    handleSendQuotationEmail,
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
    approvalStatusLabel,
    openApprovalRequest,
    error,
    quotationEditForm,
    setQuotationEditForm,
    orderDetailColumns,
    quotationEditMaterialSuggestions,
    displayedItems,
    quotationItemFieldChanged,
    handleRemoveQuotationEditItem,
    resolveQuotationEditMaterialSelection,
    createEditableQuotationItem,
    getQuotationItemTitle,
    getQuotationCustomFieldEntries,
    getQuotationItemDimensionText,
    getQuotationItemQuantityValue,
    getQuotationItemRateValue,
    getQuotationItemTotalValue,
    canReviseQuotation
  } = props;

  const [editMode, setEditMode] = useState(null);
  const [editIndex, setEditIndex] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  if (!showOrderDetailsModal || !selectedOrderDetails) return null;
  const handleClose = isEditingQuotation && closeEditModal ? closeEditModal : closeOrderDetailsModal;

  function startEditItem(index) {
    const source = quotationEditForm?.items?.[index];
    if (!source) return;
    setEditMode("edit");
    setEditIndex(index);
    setEditDraft({
      ...source,
      customFields: { ...(source.customFields || {}) }
    });
  }

  function startAddItem() {
    const draft = typeof createEditableQuotationItem === "function"
      ? createEditableQuotationItem()
      : { customFields: {} };
    setEditMode("add");
    setEditIndex(null);
    setEditDraft({
      ...draft,
      customFields: { ...(draft.customFields || {}) }
    });
  }

  function cancelEditItem() {
    setEditMode(null);
    setEditIndex(null);
    setEditDraft(null);
  }

  function saveEditItem() {
    if (!editDraft) return;
    if (editMode === "edit" && editIndex !== null) {
      setQuotationEditForm((prev) => ({
        ...prev,
        items: (prev.items || []).map((item, index) => (index === editIndex ? editDraft : item))
      }));
    }
    if (editMode === "add") {
      setQuotationEditForm((prev) => ({
        ...prev,
        items: [...(prev.items || []), editDraft]
      }));
    }
    cancelEditItem();
  }

  function updateEditDraft(field, value) {
    if (!editDraft) return;
    const normalizedField = normalizeColumnKey(field);
    if (field === "materialName" || normalizedField === "material_name") {
      setEditDraft((prev) => ({
        ...prev,
        materialName: value,
        materialType: value
      }));
      return;
    }
    if (field === "unitPrice" || normalizedField === "rate" || normalizedField === "unit_price") {
      setEditDraft((prev) => ({ ...prev, unitPrice: value }));
      return;
    }
    if (normalizedField === "quantity") {
      setEditDraft((prev) => ({ ...prev, quantity: value }));
      return;
    }
    if (normalizedField === "thickness") {
      setEditDraft((prev) => ({ ...prev, thickness: value }));
      return;
    }
    if (normalizedField === "size") {
      setEditDraft((prev) => ({
        ...prev,
        size: value,
        customFields: {
          ...(prev.customFields || {}),
          size: value
        }
      }));
      return;
    }
    if (normalizedField === "width") {
      setEditDraft((prev) => ({ ...prev, dimensionWidth: value }));
      return;
    }
    if (normalizedField === "height") {
      setEditDraft((prev) => ({ ...prev, dimensionHeight: value }));
      return;
    }
    if (normalizedField === "unit") {
      setEditDraft((prev) => ({ ...prev, dimensionUnit: value }));
      return;
    }
    if (normalizedField === "category") {
      setEditDraft((prev) => ({ ...prev, itemCategory: value }));
      return;
    }
    if (normalizedField === "note" || normalizedField === "item_note") {
      setEditDraft((prev) => ({ ...prev, itemNote: value }));
      return;
    }
    if (normalizedField === "color_name") {
      setEditDraft((prev) => ({ ...prev, colorName: value }));
      return;
    }
    if (normalizedField === "other_info" || normalizedField === "imported_color_note") {
      setEditDraft((prev) => ({ ...prev, importedColorNote: value }));
      return;
    }
    if (normalizedField === "ps") {
      setEditDraft((prev) => ({ ...prev, psIncluded: Boolean(value) }));
      return;
    }

    setEditDraft((prev) => ({
      ...prev,
      customFields: {
        ...(prev.customFields || {}),
        [normalizedField || field]: value
      }
    }));
  }

  function handleDraftMaterialBlur(value) {
    if (!editDraft || editMode !== "add" || typeof resolveQuotationEditMaterialSelection !== "function") return;
    const next = resolveQuotationEditMaterialSelection(editDraft, value);
    setEditDraft(next);
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
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
              onClick={() => handleSendQuotationEmail(selectedOrderDetails.quotation.id)}
            >
              Send Email
            </button>
            {isEditingQuotation ? (
              <button
                type="button"
                className="ghost-btn"
                onClick={handleClose}
              >
                Cancel Edit
              </button>
            ) : (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setIsEditingQuotation(true)}
                disabled={!canReviseQuotation || Boolean(selectedVersionRecord && selectedVersionIndex > 0)}
              >
                Edit Quotation
              </button>
            )}
            {isEditingQuotation && canReviseQuotation && (
              <button type="button" onClick={handleSaveQuotationRevision}>Save New Version</button>
            )}
            <button type="button" className="ghost-btn" onClick={handleClose}>Close</button>
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

        {isEditingQuotation && (
          <div className="preview-grid" style={{ marginTop: "14px" }}>
            <div className="preview-pane">
              <h5>Edit Delivery</h5>
              <input
                placeholder="Custom quotation number"
                value={quotationEditForm.customQuotationNumber}
                onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, customQuotationNumber: e.target.value }))}
              />
              <input
                placeholder="Reference Request ID"
                value={quotationEditForm.referenceRequestId}
                onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, referenceRequestId: e.target.value }))}
              />
              <select value={quotationEditForm.deliveryType} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, deliveryType: e.target.value }))}>
                <option value="PICKUP">Pickup</option>
                <option value="DOORSTEP">Doorstep</option>
              </select>
              <small className="muted">Address and pincode are required for doorstep delivery.</small>
              <input type="date" value={quotationEditForm.deliveryDate || ""} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, deliveryDate: e.target.value }))} />
              {String(quotationEditForm.deliveryType || "PICKUP") === "DOORSTEP" && (
                <>
                  <input placeholder="Delivery address" value={quotationEditForm.deliveryAddress} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, deliveryAddress: e.target.value }))} />
                  <input placeholder="Delivery pincode" value={quotationEditForm.deliveryPincode} onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, deliveryPincode: e.target.value }))} />
                </>
              )}
            </div>
            <div className="preview-pane">
              <h5>Edit Items</h5>
              <span>Add or remove line items before saving the new version.</span>
              <label className="compact-field-label">
                <span>Discount</span>
                <input
                  className="compact-amount-input"
                  type="number"
                  min="0"
                  value={quotationEditForm.discountAmount || ""}
                  onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, discountAmount: e.target.value }))}
                />
              </label>
              <label className="compact-field-label">
                <span>Advance</span>
                <input
                  className="compact-amount-input"
                  type="number"
                  min="0"
                  value={quotationEditForm.advanceAmount || ""}
                  onChange={(e) => setQuotationEditForm((prev) => ({ ...prev, advanceAmount: e.target.value }))}
                />
              </label>
              <button type="button" className="ghost-btn" onClick={startAddItem}>
                Add Item
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
              {isEditingQuotation && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {(isEditingQuotation
              ? quotationEditForm.items
              : displayedItems || []).map((item, index) => (
              <tr key={item.id || item.tempId || index}>
                {(orderDetailColumns || []).map((column) => {
                  const normalizedKey = normalizeColumnKey(column.key);
                  const cellKey = `${column.key}-${index}`;

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
                    <td key={cellKey} className={changed ? "change-highlight-cell" : ""}>
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
                {isEditingQuotation && (
                  <td>
                    <div className="order-actions">
                      <button type="button" className="ghost-btn compact" onClick={() => startEditItem(index)}>
                        Edit
                      </button>
                      <button type="button" className="ghost-btn compact" onClick={() => handleRemoveQuotationEditItem(index)}>
                        Remove
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {isEditingQuotation && editMode && editDraft && (
          <div style={{ marginTop: "16px" }}>
            <div className="section-head">
              <h3>{editMode === "add" ? "Add Item" : "Edit Item"}</h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" onClick={saveEditItem}>
                  {editMode === "add" ? "Add Item" : "Update Item"}
                </button>
                <button type="button" className="ghost-btn" onClick={cancelEditItem}>Cancel</button>
              </div>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  {(orderDetailColumns || []).map((column) => (
                    <th key={column.key}>{column.label || column.key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {(orderDetailColumns || []).map((column) => {
                    const normalizedKey = normalizeColumnKey(column.key);
                    const isFormula = String(column.type || "").toLowerCase() === "formula" || normalizedKey === "amount";
                    const isNumber = ["number", "formula"].includes(String(column.type || "").toLowerCase()) || ["quantity", "rate", "amount", "width", "height"].includes(normalizedKey);
                    const cellKey = `${column.key}-edit`;

                    if (normalizedKey === "material_name") {
                      return (
                        <td key={cellKey}>
                          {editMode === "add" ? (
                            <input
                              list="quotation-edit-material-suggestions"
                              value={editDraft.materialName || ""}
                              onChange={(e) => updateEditDraft("material_name", e.target.value)}
                              onBlur={(e) => handleDraftMaterialBlur(e.target.value)}
                            />
                          ) : (
                            <div className="quotation-item-cell">
                              <strong>{getQuotationItemTitle(editDraft) || "-"}</strong>
                            </div>
                          )}
                        </td>
                      );
                    }
                    if (isFormula) {
                      const isAmountLike = ["amount", "total", "total_price"].includes(normalizedKey);
                      const formulaValue = isAmountLike
                        ? formatCurrency(getQuotationItemTotalValue(editDraft))
                        : getOrderItemColumnValue(editDraft, normalizedKey, {
                          getQuotationItemDimensionText,
                          getQuotationItemQuantityValue,
                          getQuotationItemRateValue,
                          getQuotationItemTotalValue
                        });
                      return (
                        <td key={cellKey}>
                          {formulaValue === null || formulaValue === undefined || String(formulaValue).trim() === "" ? "-" : formulaValue}
                        </td>
                      );
                    }
                    if (normalizedKey === "ps") {
                      return (
                        <td key={cellKey}>
                          <input
                            type="checkbox"
                            checked={Boolean(editDraft.psIncluded)}
                            onChange={(e) => updateEditDraft("ps", e.target.checked)}
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={cellKey}>
                        <input
                          type={isNumber ? "number" : "text"}
                          value={String(getOrderItemColumnValue(editDraft, normalizedKey, {
                            getQuotationItemDimensionText,
                            getQuotationItemQuantityValue,
                            getQuotationItemRateValue,
                            getQuotationItemTotalValue
                          }) ?? "")}
                          onChange={(e) => updateEditDraft(normalizedKey, e.target.value)}
                        />
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <datalist id="quotation-edit-material-suggestions">
          {(quotationEditMaterialSuggestions || []).map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
