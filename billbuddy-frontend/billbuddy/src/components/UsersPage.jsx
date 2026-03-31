export default function UsersPage(props) {
  const {
    activeModule,
    currentModuleMeta,
    isPlatformAdmin,
    handleSeedRoles,
    setShowUserModal,
    canCreateUser,
    canEditUser,
    pagedUsers,
    userPage,
    PAGE_SIZE,
    auth,
    handleLockToggle,
    handleResetUserPassword,
    renderPagination,
    setUserPage,
    users,
    showUserModal,
    showUserEditModal,
    editingUser,
    handleCreateUser,
    handleOpenEditUser,
    handleCloseEditUser,
    handleUpdateUser,
    error,
    userForm,
    userFormErrors,
    setUserForm,
    setUserFormErrors,
    roles
  } = props;

  if (activeModule !== "Users") return null;

  const approvalRoleOptions = [
    { value: "requester", label: "Requester" },
    { value: "approver", label: "Approver" },
    { value: "both", label: "Both" }
  ];

  const editingUserId = Number(editingUser?.id || 0);
  const activeSellerUsers = (users || []).filter((user) => user.status);
  const approverCandidates = activeSellerUsers.filter((user) => ["approver", "both"].includes(String(user.approval_mode || "").toLowerCase()) && Number(user.id) !== editingUserId);
  const requesterCandidates = activeSellerUsers.filter((user) => ["requester", "both"].includes(String(user.approval_mode || "").toLowerCase()) && Number(user.id) !== editingUserId);
  const needsApprover = ["requester", "both"].includes(userForm.approvalMode);
  const managesRequesters = ["approver", "both"].includes(userForm.approvalMode);
  const noApproverAvailable = needsApprover && approverCandidates.length === 0;

  function handleRequesterToggle(requesterId) {
    setUserForm((prev) => {
      const exists = prev.requesterUserIds.includes(requesterId);
      return {
        ...prev,
        requesterUserIds: exists
          ? prev.requesterUserIds.filter((entry) => entry !== requesterId)
          : [...prev.requesterUserIds, requesterId]
      };
    });
  }

  return (
    <section className="module-placeholder glass-panel user-access">
      <div className="page-banner">
        <div>
          <p className="eyebrow">{currentModuleMeta.Users.eyebrow}</p>
          <h2>{currentModuleMeta.Users.title}</h2>
          <p>{isPlatformAdmin ? "Manage platform-visible user access, lock controls, and governance." : "Create seller-side users, seed roles, and keep access governance organized."}</p>
        </div>
      </div>
      <div className="section-head">
        <h3>User Access Management</h3>
        <div className="toolbar-controls">
          <button className="ghost-btn" type="button" onClick={handleSeedRoles}>Seed Roles</button>
          {canCreateUser && <button className="action-btn" type="button" onClick={() => { setUserFormErrors({}); setShowUserModal(true); }}>Create New User</button>}
        </div>
      </div>
      <div className="user-grid">
        <div>
          <table className="data-table">
            <thead>
              <tr><th>Sr.</th><th>Name</th><th>Mobile</th><th>Role</th><th>Approval Role</th><th>Limit</th><th>Approver</th><th>Status</th><th>Lock</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {pagedUsers.map((user, index) => (
                <tr key={user.id}>
                  <td>{(userPage - 1) * PAGE_SIZE + index + 1}</td>
                  <td>{user.name}</td>
                  <td>{user.mobile}</td>
                  <td>{user.role_name || "-"}</td>
                  <td>
                    <span className="badge neutral">{String(user.approval_mode || "requester").replace(/^\w/, (letter) => letter.toUpperCase())}</span>
                  </td>
                  <td>{Number(user.approval_limit_amount || 0).toLocaleString("en-IN")}</td>
                  <td>{user.assigned_approver?.name || "-"}</td>
                  <td><span className={`badge ${user.status ? "success" : "pending"}`}>{user.status ? "Active" : "Inactive"}</span></td>
                  <td>
                    {auth.user?.isPlatformAdmin ? (
                      <button className="ghost-btn" type="button" onClick={() => handleLockToggle(user)}>{user.locked ? "Unlock" : "Lock"}</button>
                    ) : (
                      <span>{user.locked ? "Locked" : "Open"}</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {canEditUser ? (
                        <button className="ghost-btn compact-btn" type="button" onClick={() => handleOpenEditUser(user)}>Edit</button>
                      ) : null}
                      {isPlatformAdmin ? (
                        <button className="ghost-btn compact-btn" type="button" onClick={() => handleResetUserPassword(user)}>Reset Password</button>
                      ) : null}
                      {!canEditUser && !isPlatformAdmin ? <span>-</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {renderPagination(userPage, setUserPage, users.length)}
        </div>
      </div>

      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Create User</h3>
              <button type="button" className="ghost-btn" onClick={() => { setUserFormErrors({}); setShowUserModal(false); }}>Close</button>
            </div>
            {error && <div className="notice error">{error}</div>}
            <form className="auth-card compact-form" onSubmit={handleCreateUser}>
              <input placeholder="Name" value={userForm.name} onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))} required />
              <input
                placeholder="Mobile"
                value={userForm.mobile}
                inputMode="tel"
                maxLength={15}
                onChange={(event) => {
                  const nextValue = event.target.value.replace(/\s+/g, "");
                  setUserForm((prev) => ({ ...prev, mobile: nextValue }));
                  if (userFormErrors?.mobile) {
                    setUserFormErrors((prev) => ({ ...prev, mobile: "" }));
                  }
                }}
                required
              />
              {userFormErrors?.mobile ? <p style={{ marginTop: "-8px", marginBottom: "0", color: "#dc2626", fontSize: "0.85rem" }}>{userFormErrors.mobile}</p> : null}
              <input placeholder="Password" type="password" value={userForm.password} onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))} />
              <select value={userForm.roleId} onChange={(event) => setUserForm((prev) => ({ ...prev, roleId: event.target.value }))} required>
                <option value="">Select Role</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.role_name}</option>)}
              </select>
              <select value={userForm.createdBy} onChange={(event) => setUserForm((prev) => ({ ...prev, createdBy: event.target.value }))}>
                <option value="">Created By (Optional)</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              <div className="settings-panel">
                <div className="section-head">
                  <h4>Approval Mapping</h4>
                </div>
                <div className="customer-form-grid">
                  <select value={userForm.approvalMode} onChange={(event) => setUserForm((prev) => ({
                    ...prev,
                    approvalMode: event.target.value,
                    approverUserId: event.target.value === "approver" ? "" : prev.approverUserId,
                    requesterUserIds: event.target.value === "requester" ? [] : prev.requesterUserIds
                  }))}>
                    {approvalRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <input
                    placeholder="Approval Limit Amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={userForm.approvalLimitAmount}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, approvalLimitAmount: event.target.value }))}
                  />
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={userForm.canApproveQuotations}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, canApproveQuotations: event.target.checked }))}
                    style={{ width: "auto" }}
                  />
                  Can Approve Quotations
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={userForm.canApprovePriceException}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, canApprovePriceException: event.target.checked }))}
                    style={{ width: "auto" }}
                  />
                  Can Approve Price Exceptions
                </label>

                {needsApprover && (
                  <div>
                    <label className="field-help-label">Assigned Approver</label>
                    <select
                      value={userForm.approverUserId}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, approverUserId: event.target.value }))}
                      required={needsApprover}
                    >
                      <option value="">Select Approver</option>
                      {approverCandidates.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.mobile})</option>)}
                    </select>
                    {noApproverAvailable ? <p className="muted">No approver exists yet. Create an approver first before saving this requester.</p> : null}
                  </div>
                )}

                {managesRequesters && (
                  <div>
                    <label className="field-help-label">Assign Requesters</label>
                    <div className="selection-chip-grid">
                      {requesterCandidates.length ? requesterCandidates.map((user) => (
                        <label key={user.id} className={`selection-chip ${userForm.requesterUserIds.includes(user.id) ? "active" : ""}`}>
                          <input
                            type="checkbox"
                            checked={userForm.requesterUserIds.includes(user.id)}
                            onChange={() => handleRequesterToggle(user.id)}
                          />
                          <span>{user.name}</span>
                          <small>{user.mobile}</small>
                        </label>
                      )) : <p className="muted">No requester users exist yet. Create requester users first, then assign them here.</p>}
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" disabled={!canCreateUser || noApproverAvailable}>Create User</button>
            </form>
          </div>
        </div>
      )}

      {showUserEditModal && (
        <div className="modal-overlay" onClick={handleCloseEditUser}>
          <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Edit User</h3>
              <button type="button" className="ghost-btn" onClick={handleCloseEditUser}>Close</button>
            </div>
            {error && <div className="notice error">{error}</div>}
            <form className="auth-card compact-form" onSubmit={handleUpdateUser}>
              <input placeholder="Name" value={userForm.name} onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))} required />
              <input placeholder="Mobile" value={userForm.mobile} disabled readOnly />
              <p className="muted">Mobile number is locked for MVP because it is the login identity.</p>
              <select value={userForm.roleId} onChange={(event) => setUserForm((prev) => ({ ...prev, roleId: event.target.value }))} required>
                <option value="">Select Role</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.role_name}</option>)}
              </select>
              <select value={userForm.status ? "active" : "inactive"} onChange={(event) => setUserForm((prev) => ({ ...prev, status: event.target.value === "active" }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>

              <div className="settings-panel">
                <div className="section-head">
                  <h4>Approval Mapping</h4>
                </div>
                <div className="customer-form-grid">
                  <select value={userForm.approvalMode} onChange={(event) => setUserForm((prev) => ({
                    ...prev,
                    approvalMode: event.target.value,
                    approverUserId: event.target.value === "approver" ? "" : prev.approverUserId,
                    requesterUserIds: event.target.value === "requester" ? [] : prev.requesterUserIds
                  }))}>
                    {approvalRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <input
                    placeholder="Approval Limit Amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={userForm.approvalLimitAmount}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, approvalLimitAmount: event.target.value }))}
                  />
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={userForm.canApproveQuotations}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, canApproveQuotations: event.target.checked }))}
                    style={{ width: "auto" }}
                  />
                  Can Approve Quotations
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input
                    type="checkbox"
                    checked={userForm.canApprovePriceException}
                    onChange={(event) => setUserForm((prev) => ({ ...prev, canApprovePriceException: event.target.checked }))}
                    style={{ width: "auto" }}
                  />
                  Can Approve Price Exceptions
                </label>

                {needsApprover && (
                  <div>
                    <label className="field-help-label">Assigned Approver</label>
                    <select
                      value={userForm.approverUserId}
                      onChange={(event) => setUserForm((prev) => ({ ...prev, approverUserId: event.target.value }))}
                      required={needsApprover}
                    >
                      <option value="">Select Approver</option>
                      {approverCandidates.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.mobile})</option>)}
                    </select>
                    {noApproverAvailable ? <p className="muted">No approver exists yet. Create an approver first before saving this requester.</p> : null}
                  </div>
                )}

                {managesRequesters && (
                  <div>
                    <label className="field-help-label">Assign Requesters</label>
                    <div className="selection-chip-grid">
                      {requesterCandidates.length ? requesterCandidates.map((user) => (
                        <label key={user.id} className={`selection-chip ${userForm.requesterUserIds.includes(user.id) ? "active" : ""}`}>
                          <input
                            type="checkbox"
                            checked={userForm.requesterUserIds.includes(user.id)}
                            onChange={() => handleRequesterToggle(user.id)}
                          />
                          <span>{user.name}</span>
                          <small>{user.mobile}</small>
                        </label>
                      )) : <p className="muted">No requester users exist yet. Create requester users first, then assign them here.</p>}
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" disabled={!canEditUser || noApproverAvailable}>Update User</button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
