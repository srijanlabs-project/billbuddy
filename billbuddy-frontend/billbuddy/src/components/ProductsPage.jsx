export default function ProductsPage(props) {
  const {
    activeModule,
    products,
    filteredProducts,
    productSourceFilter,
    setProductSourceFilter,
    handleDownloadProductTemplate,
    handleExcelProductUpload,
    setShowSingleProductModal,
    setShowProductUploadModal,
    canCreateProduct,
    canEditProduct,
    visibleCatalogueTableFields,
    pagedProducts,
    productPage,
    PAGE_SIZE,
    getProductFieldDisplayValue,
    handleEditProduct,
    handleMoveProductToPrimary,
    renderPagination,
    setProductPage,
    showProductUploadModal,
    setProductUploadModalMessage,
    productUploadModalMessage,
    handleBulkProductUpload,
    productUploadText,
    setProductUploadText,
    error,
    showSingleProductModal,
    editingProductId,
    setEditingProductId,
    setSingleProductForm,
    createInitialSingleProductForm,
    handleCreateSingleProduct,
    runtimeCatalogueFields,
    singleProductForm,
    updateSingleProductField,
    getConfiguredOptions,
    unsupportedRuntimeCatalogueFields,
    updateSingleProductCustomField,
    showProductPreviewModal,
    setShowProductPreviewModal,
    productPreviewRows,
    getProductPreviewFieldValue,
    handleConfirmProductUpload
  } = props;

  if (activeModule !== "Products") return null;

  const catalogueTableFields = visibleCatalogueTableFields || [];

  function renderFieldLabel(field, helpText = "") {
    return (
      <span className="field-label-with-help">
        <span>{field.label}</span>
        {helpText ? (
          <button
            type="button"
            className="inline-help-trigger"
            title={helpText}
            aria-label={`${field.label} help`}
          >
            ?
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <section className="module-placeholder glass-panel">
      <div className="page-banner">
        <div>
          <h2>Product Catalogue</h2>
          <p>Upload structured products for smarter quotation matching, inventory rules, and cleaner quotations.</p>
        </div>
        <div className="banner-stat single-line">
          <span>Total Products - {products.length}</span>
        </div>
      </div>
      <div className="section-head products-toolbar">
        <div className="toolbar-controls">
          <select value={productSourceFilter} onChange={(e) => setProductSourceFilter(e.target.value)}>
            <option value="all">All Catalogue</option>
            <option value="primary">Main Catalogue</option>
            <option value="secondary">Secondary Catalogue</option>
          </select>
          <button type="button" className="ghost-btn" onClick={handleDownloadProductTemplate}>Download Template</button>
          {canCreateProduct && (
            <>
              <label className="ghost-btn file-trigger">
                Upload Product
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelProductUpload} />
              </label>
              <button type="button" className="action-btn" onClick={() => setShowSingleProductModal(true)}>Add Single Product</button>
            </>
          )}
        </div>
      </div>
      <table className="data-table product-catalogue-table">
        <thead>
          <tr>
            <th>Sr</th>
            {catalogueTableFields.map((field) => (
              <th key={field.id}>{field.label}</th>
            ))}
            <th>Source</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.length === 0 ? (
            <tr>
              <td colSpan={catalogueTableFields.length + 3} className="muted">No products found for selected catalogue source.</td>
            </tr>
          ) : (
            pagedProducts.map((product, index) => (
              <tr key={product.id}>
                <td>{(productPage - 1) * PAGE_SIZE + index + 1}</td>
                {catalogueTableFields.map((field) => (
                  <td key={`${product.id}-${field.id}`}>{getProductFieldDisplayValue(product, field.normalizedKey || field.key)}</td>
                ))}
                <td>
                  {String(product.catalogue_source || "primary").toLowerCase() === "secondary" ? "Secondary" : "Main"}
                </td>
                <td>
                  {canEditProduct ? (
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button type="button" className="ghost-btn" onClick={() => handleEditProduct(product)}>Edit</button>
                      {String(product.catalogue_source || "primary").toLowerCase() === "secondary" ? (
                        <button type="button" className="table-link-btn" onClick={() => handleMoveProductToPrimary(product)}>Move to Main</button>
                      ) : null}
                    </div>
                  ) : (
                    <span>-</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {renderPagination(productPage, setProductPage, filteredProducts.length)}

      {showProductUploadModal && (
        <div className="modal-overlay" onClick={(event) => event.stopPropagation()}>
          <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Bulk Paste Products</h3>
              <button type="button" className="ghost-btn" onClick={() => {
                setShowProductUploadModal(false);
                setProductUploadModalMessage("");
              }}>Close</button>
            </div>
            {error && <div className="notice error">{error}</div>}
            {productUploadModalMessage && <div className="notice error">{productUploadModalMessage}</div>}
            <form className="auth-card" onSubmit={handleBulkProductUpload}>
              <p>Paste one product per line using this format:</p>
              <p><code>Product Name | Category | Thickness | Unit Type | Base Price | SKU | Always Available</code></p>
              <p>Template download now follows the seller&apos;s published catalogue field configuration. Excel upload will validate the mapped runtime fields from that structure.</p>
              <textarea
                rows={10}
                placeholder={"Acrylic | Sheet | 2 mm | SFT | 15 | ACR-2 | true\nName Plate | Signage | - | COUNT | 900 | NP-01 | true"}
                value={productUploadText}
                onChange={(e) => setProductUploadText(e.target.value)}
                required
              />
              <button type="submit">Validate Product Upload</button>
            </form>
          </div>
        </div>
      )}

      {showSingleProductModal && (
        <div className="modal-overlay" onClick={(event) => event.stopPropagation()}>
          <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>{editingProductId ? "Edit Product" : "Add Single Product"}</h3>
              <button type="button" className="ghost-btn" onClick={() => {
                setShowSingleProductModal(false);
                setEditingProductId(null);
                setSingleProductForm(createInitialSingleProductForm());
              }}>Close</button>
            </div>
            {error && <div className="notice error">{error}</div>}
            <form className="auth-card" onSubmit={handleCreateSingleProduct}>
              {runtimeCatalogueFields.map((field) => {
                const value = singleProductForm[field.meta.formKey];
                if (field.type === "checkbox" || field.meta.inputType === "checkbox") {
                  return (
                    <label key={field.id} style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => updateSingleProductField(field.meta.formKey, e.target.checked)}
                        style={{ width: "auto" }}
                      />
                      {field.label}
                    </label>
                  );
                }

                if (field.type === "dropdown") {
                  return (
                    <select key={field.id} value={value ?? ""} onChange={(e) => updateSingleProductField(field.meta.formKey, e.target.value)} required={Boolean(field.required || field.meta.required)}>
                      <option value="">{field.label}</option>
                      {getConfiguredOptions(field).map((option) => (
                        <option key={`${field.id}-${option}`} value={option}>{option}</option>
                      ))}
                    </select>
                  );
                }

                if (field.meta.inputType === "unit-select") {
                  return (
                    <select key={field.id} value={value} onChange={(e) => updateSingleProductField(field.meta.formKey, e.target.value)} required={Boolean(field.required || field.meta.required)}>
                      <option value="COUNT">{field.label}: COUNT</option>
                      <option value="SFT">{field.label}: SFT</option>
                    </select>
                  );
                }

                if (field.meta.inputType === "pricing-select") {
                  return (
                    <select key={field.id} value={value} onChange={(e) => updateSingleProductField(field.meta.formKey, e.target.value)} required={Boolean(field.required || field.meta.required)}>
                      <option value="SFT">{field.label}: SFT</option>
                      <option value="UNIT">{field.label}: UNIT</option>
                      <option value="FIXED">{field.label}: FIXED</option>
                    </select>
                  );
                }

                return (
                  <label key={field.id} className="settings-field modal-field-label">
                    {renderFieldLabel(
                      field,
                      field.meta.formKey === "maxDiscountPercent"
                        ? "Used only when Limit Rate Edit is enabled. Enter 10% to use percentage, or enter 100 to treat it as a fixed amount."
                        : ""
                    )}
                    <input
                      type={field.meta.inputType === "number" ? "number" : "text"}
                      placeholder={field.label}
                      value={value}
                      onChange={(e) => updateSingleProductField(field.meta.formKey, e.target.value)}
                      required={Boolean(field.required || field.meta.required)}
                    />
                  </label>
                );
              })}
              {unsupportedRuntimeCatalogueFields.length > 0 && (
                <>
                  {unsupportedRuntimeCatalogueFields.map((field) => {
                    const value = singleProductForm.customFields?.[field.key];
                    if (field.type === "checkbox") {
                      return (
                        <label key={field.id} style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => updateSingleProductCustomField(field.key, e.target.checked)}
                            style={{ width: "auto" }}
                          />
                          {field.label}
                        </label>
                      );
                    }

                    if (field.type === "dropdown") {
                      return (
                        <select key={field.id} value={value ?? ""} onChange={(e) => updateSingleProductCustomField(field.key, e.target.value)} required={Boolean(field.required)}>
                          <option value="">{field.label}</option>
                          {getConfiguredOptions(field).map((option) => (
                            <option key={`${field.id}-${option}`} value={option}>{option}</option>
                          ))}
                        </select>
                      );
                    }

                    return (
                      <label key={field.id} className="settings-field modal-field-label">
                        {renderFieldLabel(
                          field,
                          field.key === "max_discount_percent"
                            ? "Used only when Limit Rate Edit is enabled. Enter 10% to use percentage, or enter 100 to treat it as a fixed amount."
                            : ""
                        )}
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          placeholder={field.label}
                          value={value ?? ""}
                          onChange={(e) => updateSingleProductCustomField(field.key, e.target.value)}
                          required={Boolean(field.required)}
                        />
                      </label>
                    );
                  })}
                  <p className="muted">
                    Additional seller-specific catalogue fields are being stored in product custom data.
                  </p>
                </>
              )}
              {editingProductId && <p className="muted">SKU stays unchanged unless you edit this field yourself.</p>}
              <button type="submit" disabled={editingProductId ? !canEditProduct : !canCreateProduct}>{editingProductId ? "Update Product" : "Save Product"}</button>
            </form>
          </div>
        </div>
      )}

      {showProductPreviewModal && (
        <div className="modal-overlay" onClick={(event) => event.stopPropagation()}>
          <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Validate Product Upload</h3>
              <button type="button" className="ghost-btn" onClick={() => {
                setShowProductPreviewModal(false);
                setProductUploadModalMessage("");
              }}>Close</button>
            </div>
            {productUploadModalMessage && <div className="notice error">{productUploadModalMessage}</div>}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  {[...runtimeCatalogueFields, ...unsupportedRuntimeCatalogueFields]
                    .filter((field) => field.uploadEnabled)
                    .map((field) => (
                      <th key={`preview-head-${field.id}`}>{field.label}</th>
                    ))}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {productPreviewRows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    {[...runtimeCatalogueFields, ...unsupportedRuntimeCatalogueFields]
                      .filter((field) => field.uploadEnabled)
                      .map((field) => (
                        <td key={`${row.rowNumber}-${field.id}`}>{getProductPreviewFieldValue(row, field)}</td>
                      ))}
                    <td>{row.issues.length === 0 ? "Ready" : row.issues.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="toolbar-controls" style={{ marginTop: "14px" }}>
              <button type="button" className="ghost-btn" onClick={() => {
                setShowProductPreviewModal(false);
                setProductUploadModalMessage("");
              }}>Cancel</button>
              <button type="button" onClick={handleConfirmProductUpload}>Confirm Upload</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
