export default function LeadsPage(props) {
  const {
    activeModule,
    currentModuleMeta,
    leads,
    openLeadDetail,
    showLeadConvertModal,
    selectedLeadDetail,
    closeLeadConvertModal,
    handleConvertLeadToDemo,
    leadConvertForm,
    setLeadConvertForm,
    leadConvertSubmitting,
    showLeadDetailModal,
    closeLeadDetailModal,
    leadDetailLoading,
    formatDateTime,
    handleAddLeadActivity,
    leadActivityNote,
    setLeadActivityNote,
    formatAuditActionLabel,
    handleLeadUpdate,
    LEAD_STATUS_OPTIONS,
    users,
    openLeadConvertModal,
    businessCategoryOptions,
    getBusinessSegments,
    handleLeadConvertBrandingImageChange
  } = props;

  if (activeModule !== "Leads") return null;

  return (
    <section className="module-placeholder glass-panel">
      <div className="page-banner">
        <div>
          <p className="eyebrow">{currentModuleMeta.Leads.eyebrow}</p>
          <h2>{currentModuleMeta.Leads.title}</h2>
          <p>{currentModuleMeta.Leads.subtitle}</p>
        </div>
        <div className="banner-stat">
          <span>Total Leads</span>
          <strong>{leads.length}</strong>
        </div>
      </div>

      <div className="section-head">
        <h3>Lead List</h3>
        <span>Click a row to open lead detail</span>
      </div>

      <table className="data-table">
        <thead>
          <tr><th>Name</th><th>Mobile</th><th>Business</th><th>City</th><th>Status</th><th>Demo</th><th>Source</th></tr>
        </thead>
        <tbody>
          {leads.length === 0 ? (
            <tr><td colSpan="7">No leads captured yet.</td></tr>
          ) : (
            leads.map((lead) => (
              <tr key={lead.id} className="lead-row" onClick={() => openLeadDetail(lead.id)}>
                <td>{lead.name}</td>
                <td>{lead.mobile}</td>
                <td>{lead.business_name || "-"}</td>
                <td>{lead.city || "-"}</td>
                <td><span className="badge pending">{lead.status || "new"}</span></td>
                <td>{lead.interested_in_demo ? "Yes" : "No"}</td>
                <td>{lead.source || "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {showLeadConvertModal && selectedLeadDetail?.lead && (
        <div className="modal-overlay" onClick={closeLeadConvertModal}>
          <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Convert Lead to Demo</h3>
              <button type="button" className="ghost-btn" onClick={closeLeadConvertModal}>Close</button>
            </div>
            <form className="auth-card compact-form" onSubmit={handleConvertLeadToDemo}>
              <input placeholder="Seller Name" value={leadConvertForm.sellerName} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, sellerName: e.target.value }))} required />
              <input placeholder="Business Name" value={leadConvertForm.businessName} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, businessName: e.target.value }))} />
              <input placeholder="Seller Code" value={leadConvertForm.sellerCode} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, sellerCode: e.target.value.toUpperCase() }))} required />
              <input placeholder="City" value={leadConvertForm.city} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, city: e.target.value }))} />
              <input placeholder="State" value={leadConvertForm.state} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, state: e.target.value }))} />
              <select value={leadConvertForm.businessCategory} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, businessCategory: e.target.value, businessSegment: getBusinessSegments(e.target.value)[0] || "" }))}>
                <option value="">Select Business Category</option>
                {businessCategoryOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select value={leadConvertForm.businessSegment} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, businessSegment: e.target.value }))} disabled={!leadConvertForm.businessCategory}>
                <option value="">{leadConvertForm.businessCategory ? "Select Segment" : "Select category first"}</option>
                {getBusinessSegments(leadConvertForm.businessCategory).map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <label className="seller-toggle">
                <input type="checkbox" checked={Boolean(leadConvertForm.wantsSampleData)} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, wantsSampleData: e.target.checked }))} style={{ width: "auto" }} />
                Create sample data for this business category
              </label>
              <select value={leadConvertForm.brandingMode} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, brandingMode: e.target.value }))}>
                <option value="header">Use Header Image</option>
                <option value="logo">Use Company Logo</option>
              </select>
              <label className="auth-field">
                <span>{leadConvertForm.brandingMode === "logo" ? "Company Logo" : "Header Image"}</span>
                <input type="file" accept="image/*" onChange={(e) => handleLeadConvertBrandingImageChange(leadConvertForm.brandingMode === "logo" ? "logoImageData" : "headerImageData", e)} />
              </label>
              <input placeholder="Master User Name" value={leadConvertForm.masterUserName} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, masterUserName: e.target.value }))} />
              <input placeholder="Master User Mobile" value={leadConvertForm.masterUserMobile} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, masterUserMobile: e.target.value }))} />
              <input placeholder="Master User Password" type="password" value={leadConvertForm.masterUserPassword} onChange={(e) => setLeadConvertForm((prev) => ({ ...prev, masterUserPassword: e.target.value }))} />
              <button type="submit" disabled={leadConvertSubmitting}>
                {leadConvertSubmitting ? "Creating Demo..." : "Create Demo Account"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showLeadDetailModal && (
        <div className="modal-overlay" onClick={closeLeadDetailModal}>
          <div className="modal-card modal-wide glass-panel lead-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Lead Detail</h3>
              <button type="button" className="ghost-btn" onClick={closeLeadDetailModal}>Close</button>
            </div>
            {leadDetailLoading ? (
              <p className="muted">Loading lead detail...</p>
            ) : !selectedLeadDetail ? (
              <p className="muted">Lead detail is unavailable right now.</p>
            ) : (
              <>
                <div className="seller-detail-grid">
                  <article className="seller-detail-card">
                    <h4>Basic Info</h4>
                    <div className="seller-detail-list">
                      <div><span>Name</span><strong>{selectedLeadDetail.lead.name}</strong></div>
                      <div><span>Mobile</span><strong>{selectedLeadDetail.lead.mobile}</strong></div>
                      <div><span>Email</span><strong>{selectedLeadDetail.lead.email || "-"}</strong></div>
                      <div><span>Business</span><strong>{selectedLeadDetail.lead.business_name || "-"}</strong></div>
                      <div><span>City</span><strong>{selectedLeadDetail.lead.city || "-"}</strong></div>
                      <div><span>Business type</span><strong>{selectedLeadDetail.lead.business_type || "-"}</strong></div>
                      <div><span>Business segment</span><strong>{selectedLeadDetail.lead.business_segment || "-"}</strong></div>
                      <div><span>Sample data</span><strong>{selectedLeadDetail.lead.wants_sample_data ? "Yes" : "No"}</strong></div>
                    </div>
                  </article>

                  <article className="seller-detail-card">
                    <h4>Lifecycle</h4>
                    <div className="seller-detail-list">
                      <div><span>Status</span><strong>{selectedLeadDetail.lead.status || "new"}</strong></div>
                      <div><span>Source</span><strong>{selectedLeadDetail.lead.source || "-"}</strong></div>
                      <div><span>Interested in demo</span><strong>{selectedLeadDetail.lead.interested_in_demo ? "Yes" : "No"}</strong></div>
                      <div><span>Assigned user</span><strong>{selectedLeadDetail.lead.assigned_user_name || "-"}</strong></div>
                      <div><span>Linked seller</span><strong>{selectedLeadDetail.lead.seller_id || "-"}</strong></div>
                      <div><span>Created</span><strong>{formatDateTime(selectedLeadDetail.lead.created_at)}</strong></div>
                      <div><span>Updated</span><strong>{formatDateTime(selectedLeadDetail.lead.updated_at)}</strong></div>
                    </div>
                  </article>

                  <article className="seller-detail-card">
                    <h4>Requirement</h4>
                    <p>{selectedLeadDetail.lead.requirement || "No requirement added yet."}</p>
                  </article>
                </div>

                <article className="seller-detail-section">
                  <div className="section-head compact">
                    <h3>Activity History</h3>
                    <span>{selectedLeadDetail.activity?.length || 0} entries</span>
                  </div>
                  <form className="auth-card compact-form" onSubmit={handleAddLeadActivity} style={{ marginBottom: "14px" }}>
                    <textarea
                      rows={3}
                      placeholder="Add follow-up note"
                      value={leadActivityNote}
                      onChange={(e) => setLeadActivityNote(e.target.value)}
                    />
                    <button type="submit">Add Note</button>
                  </form>
                  <table className="data-table">
                    <thead>
                      <tr><th>When</th><th>Type</th><th>Actor</th><th>Note</th></tr>
                    </thead>
                    <tbody>
                      {(selectedLeadDetail.activity || []).length === 0 ? (
                        <tr><td colSpan="4">No activity yet.</td></tr>
                      ) : (
                        selectedLeadDetail.activity.map((entry) => (
                          <tr key={entry.id}>
                            <td>{formatDateTime(entry.created_at)}</td>
                            <td>{formatAuditActionLabel(entry.activity_type)}</td>
                            <td>{entry.actor_name || entry.actor_mobile || "System"}</td>
                            <td>{entry.note || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </article>

                <div className="modal-fixed-actions">
                  <select
                    value={selectedLeadDetail.lead.status || "new"}
                    onChange={(e) => handleLeadUpdate(selectedLeadDetail.lead.id, { status: e.target.value })}
                  >
                    {LEAD_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <select
                    value={selectedLeadDetail.lead.assigned_user_id || ""}
                    onChange={(e) => handleLeadUpdate(selectedLeadDetail.lead.id, { assignedUserId: e.target.value || null })}
                  >
                    <option value="">Assign owner</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.name} ({user.mobile})</option>
                    ))}
                  </select>
                  <button type="button" className="ghost-btn" onClick={() => handleLeadUpdate(selectedLeadDetail.lead.id, { status: "demo_created", note: "Lead moved to demo created stage." })}>
                    Mark Demo Created
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={openLeadConvertModal}
                    disabled={Boolean(selectedLeadDetail.lead.seller_id)}
                  >
                    {selectedLeadDetail.lead.seller_id ? "Demo Linked" : "Convert to Demo"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
