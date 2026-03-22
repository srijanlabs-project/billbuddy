export default function UsersPage(props) {
  const {
    activeModule,
    currentModuleMeta,
    isPlatformAdmin,
    handleSeedRoles,
    setShowUserModal,
    canCreateUser,
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
    handleCreateUser,
    error,
    userForm,
    setUserForm,
    roles
  } = props;

  if (activeModule !== "Users") return null;

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
          {canCreateUser && <button className="action-btn" type="button" onClick={() => setShowUserModal(true)}>Create New User</button>}
        </div>
      </div>
      <div className="user-grid">
        <div>
          <table className="data-table">
            <thead>
              <tr><th>Sr.</th><th>Name</th><th>Mobile</th><th>Role</th><th>Status</th><th>Lock</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {pagedUsers.map((user, index) => (
                <tr key={user.id}>
                  <td>{(userPage - 1) * PAGE_SIZE + index + 1}</td>
                  <td>{user.name}</td>
                  <td>{user.mobile}</td>
                  <td>{user.role_name || "-"}</td>
                  <td><span className={`badge ${user.status ? "success" : "pending"}`}>{user.status ? "Active" : "Inactive"}</span></td>
                  <td>
                    {auth.user?.isPlatformAdmin ? (
                      <button className="ghost-btn" type="button" onClick={() => handleLockToggle(user)}>{user.locked ? "Unlock" : "Lock"}</button>
                    ) : (
                      <span>{user.locked ? "Locked" : "Open"}</span>
                    )}
                  </td>
                  <td>
                    {isPlatformAdmin ? (
                      <button className="ghost-btn compact-btn" type="button" onClick={() => handleResetUserPassword(user)}>Reset Password</button>
                    ) : (
                      <span>-</span>
                    )}
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
              <button type="button" className="ghost-btn" onClick={() => setShowUserModal(false)}>Close</button>
            </div>
            {error && <div className="notice error">{error}</div>}
            <form className="auth-card compact-form" onSubmit={handleCreateUser}>
              <input placeholder="Name" value={userForm.name} onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))} required />
              <input placeholder="Mobile" value={userForm.mobile} onChange={(event) => setUserForm((prev) => ({ ...prev, mobile: event.target.value }))} required />
              <input placeholder="Password" type="password" value={userForm.password} onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))} />
              <select value={userForm.roleId} onChange={(event) => setUserForm((prev) => ({ ...prev, roleId: event.target.value }))} required>
                <option value="">Select Role</option>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.role_name}</option>)}
              </select>
              <select value={userForm.createdBy} onChange={(event) => setUserForm((prev) => ({ ...prev, createdBy: event.target.value }))}>
                <option value="">Created By (Optional)</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
              <button type="submit" disabled={!canCreateUser}>Create User</button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
