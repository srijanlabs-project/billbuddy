import { useMemo, useState } from "react";

export default function UsersPage(props) {
  const {
    activeModule,
    currentModuleMeta,
    isPlatformAdmin,
    handleSeedRoles,
    setShowUserModal,
    canCreateUser,
    canEditUser,
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
    roles,
    sellers
  } = props;

  const isUsersActive = activeModule === "Users";

  function normalizeRoleName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");
  }

  function getSellerCreateRoleOptions(roleRows) {
    const roleGroups = [
      {
        keys: ["seller_admin", "admin", "master_user"],
        label: "Seller Admin",
        preferredLabels: ["Seller Admin", "Admin", "Master User"]
      },
      {
        keys: ["sub_user", "seller_user"],
        label: "Sub User",
        preferredLabels: ["Sub User", "Seller User"]
      }
    ];

    return roleGroups
      .map((group) => {
        const matchingRoles = (roleRows || []).filter((role) => group.keys.includes(normalizeRoleName(role.role_name)));
        if (!matchingRoles.length) return null;

        const preferredRole =
          matchingRoles.find((role) => group.preferredLabels.includes(String(role.role_name || "").trim())) ||
          matchingRoles[0];

        return {
          ...preferredRole,
          display_label: group.label
        };
      })
      .filter(Boolean);
  }

  function normalizeRoleNameToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");
  }

  function isSellerAdminRole(roleName) {
    return ["seller_admin", "admin", "master_user"].includes(normalizeRoleNameToken(roleName));
  }

  const approvalRoleOptions = [
    { value: "requester", label: "Requester" },
    { value: "approver", label: "Approver" },
    { value: "both", label: "Both" }
  ];

  const [platformUserTab, setPlatformUserTab] = useState("platform");

  const visibleRoleOptions = isPlatformAdmin ? roles : getSellerCreateRoleOptions(roles);
  const sellerNameById = useMemo(() => {
    const next = new Map();
    (sellers || []).forEach((sellerRow) => {
      next.set(
        Number(sellerRow.id),
        {
          name: sellerRow.name || "Seller",
          code: sellerRow.seller_code || ""
        }
      );
    });
    return next;
  }, [sellers]);
  const editingUserId = Number(editingUser?.id || 0);
  const activeSellerUsers = (users || []).filter((user) => user.status && !user.is_platform_admin);
  const approverCandidates = activeSellerUsers.filter((user) => ["approver", "both"].includes(String(user.approval_mode || "").toLowerCase()) && Number(user.id) !== editingUserId);
  const requesterCandidates = activeSellerUsers.filter((user) => ["requester", "both"].includes(String(user.approval_mode || "").toLowerCase()) && Number(user.id) !== editingUserId);
  const needsApprover = ["requester", "both"].includes(userForm.approvalMode);
  const managesRequesters = ["approver", "both"].includes(userForm.approvalMode);
  const noApproverAvailable = needsApprover && approverCandidates.length === 0;
  const platformUsers = useMemo(
    () => (users || []).filter((user) => Boolean(user.is_platform_admin)),
    [users]
  );
  const sellerAdminUsers = useMemo(
    () => (users || []).filter((user) => {
      if (user.is_platform_admin) return false;
      return ["seller_admin", "admin", "master_user"].includes(normalizeRoleNameToken(user.role_name));
    }),
    [users]
  );
  const visibleUsers = useMemo(
    () => (
      isPlatformAdmin
        ? (platformUserTab === "platform" ? platformUsers : sellerAdminUsers)
        : (users || [])
    ),
    [isPlatformAdmin, platformUserTab, platformUsers, sellerAdminUsers, users]
  );
  const visiblePagedUsers = useMemo(
    () => visibleUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE),
    [visibleUsers, userPage, PAGE_SIZE]
  );

  if (!isUsersActive) return null;

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
          <p>{isPlatformAdmin ? "Manage platform-visible user access, lock controls, and governance." : "Create seller-side users and keep access governance organized."}</p>
        </div>
      </div>
      <div className="section-head">
        <h3>User Access Management</h3>
        <div className="toolbar-controls">
          {isPlatformAdmin ? <button className="ghost-btn" type="button" onClick={handleSeedRoles}>Seed Roles</button> : null}
          {canCreateUser && <button className="action-btn" type="button" onClick={() => { setUserFormErrors({}); setShowUserModal(true); }}>Create New User</button>}
        </div>
      </div>
      {isPlatformAdmin ? (
        <div className="user-management-tabs">
          <button
            type="button"
            className={`ghost-btn compact-btn ${platformUserTab === "platform" ? "active-chip" : ""}`}
            onClick={() => {
              setPlatformUserTab("platform");
              setUserPage(1);
            }}
          >
            Platform User
          </button>
          <button
            type="button"
            className={`ghost-btn compact-btn ${platformUserTab === "seller_admin" ? "active-chip" : ""}`}
            onClick={() => {
              setPlatformUserTab("seller_admin");
              setUserPage(1);
            }}
          >
            Seller User
          </button>
        </div>
      ) : null}
      <div className="user-grid">
        <div>
          <table className="data-table">
            <thead>
              {isPlatformAdmin && platformUserTab === "seller_admin" ? (
                <tr>
                  <th>Sr.</th>
                  <th>Name</th>
                  <th>Seller</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Lock</th>
                  <th>Action</th>
                </tr>
              ) : (
                <tr>
                  <th>Sr.</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Role</th>
                  <th>Approval Role</th>
                  <th>Limit</th>
                  <th>Approver</th>
                  <th>Status</th>
                  <th>Lock</th>
                  <th>Actions</th>
                </tr>
              )}
            </thead>
            <tbody>
              {visiblePagedUsers.map((user, index) => (
                <tr key={user.id}>
                  <td>{(userPage - 1) * PAGE_SIZE + index + 1}</td>
                  <td>{user.name}</td>
                  {isPlatformAdmin && platformUserTab === "seller_admin" ? (
                    <td>
                      {(() => {
                        const sellerInfo = sellerNameById.get(Number(user.seller_id || 0));
                        if (!sellerInfo) return "-";
                        return `${sellerInfo.name}${sellerInfo.code ? ` (${sellerInfo.code})` : ""}`;
                      })()}
                    </td>
                  ) : (
                    <td>{user.mobile}</td>
                  )}
                  <td>{user.role_name || "-"}</td>
                  {isPlatformAdmin && platformUserTab === "seller_admin" ? null : (
                    <>
                      <td>
                        <span className="badge neutral">{String(user.approval_mode || "requester").replace(/^\w/, (letter) => letter.toUpperCase())}</span>
                      </td>
                      <td>{Number(user.approval_limit_amount || 0).toLocaleString("en-IN")}</td>
                      <td>{user.assigned_approver?.name || "-"}</td>
                    </>
                  )}
                  <td><span className={`badge ${user.status ? "success" : "pending"}`}>{user.status ? "Active" : "Inactive"}</span></td>
                  <td>
                    {auth.user?.isPlatformAdmin ? (
                      <button className="ghost-btn compact-btn user-row-btn" type="button" onClick={() => handleLockToggle(user)}>{user.locked ? "Unlock" : "Lock"}</button>
                    ) : (
                      <span>{user.locked ? "Locked" : "Open"}</span>
                    )}
                  </td>
                  <td>
                    <div className="user-row-actions">
                      {canEditUser ? (
                        <button className="ghost-btn compact-btn user-row-btn" type="button" onClick={() => handleOpenEditUser(user)}>Edit</button>
                      ) : null}
                      {canEditUser && (!isPlatformAdmin || isSellerAdminRole(user.role_name)) ? (
                        <button
                          className="ghost-btn compact-btn user-row-btn"
                          type="button"
                          title="Reset Password"
                          onClick={() => handleResetUserPassword(user)}
                        >
                          Reset
                        </button>
                      ) : null}
                      {!canEditUser && !isPlatformAdmin ? <span>-</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
              {visiblePagedUsers.length === 0 ? (
                <tr>
                  <td colSpan={isPlatformAdmin && platformUserTab === "seller_admin" ? 7 : 10}>
                    No users found for selected tab.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {renderPagination(userPage, setUserPage, visibleUsers.length)}
        </div>
      </div>

      {showUserModal && (
        <div className="modal-overlay" onClick={(event) => event.stopPropagation()}>
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
                {visibleRoleOptions.map((role) => <option key={role.id} value={role.id}>{role.display_label || role.role_name}</option>)}
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
        <div className="modal-overlay" onClick={(event) => event.stopPropagation()}>
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
                {(isPlatformAdmin ? roles : visibleRoleOptions).map((role) => <option key={role.id} value={role.id}>{role.display_label || role.role_name}</option>)}
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
