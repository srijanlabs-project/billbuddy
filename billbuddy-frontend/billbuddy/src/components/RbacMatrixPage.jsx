import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";

function AccessCell({ allowed }) {
  return <span className={`rbac-access-pill ${allowed ? "is-allowed" : "is-denied"}`}>{allowed ? "Yes" : "No"}</span>;
}

function normalizePermissions(list) {
  return Array.isArray(list) ? [...new Set(list)] : [];
}

function permissionGranted(permissionList, permissionKey) {
  const permissions = normalizePermissions(permissionList);
  return permissions.includes("*") || permissions.includes(permissionKey);
}

export default function RbacMatrixPage({ isPlatformAdmin = false }) {
  const [scope, setScope] = useState(isPlatformAdmin ? "platform" : "seller");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rbacConfig, setRbacConfig] = useState(null);
  const [draftScopes, setDraftScopes] = useState({});

  useEffect(() => {
    let isMounted = true;

    async function loadRbacConfig() {
      try {
        setLoading(true);
        setError("");
        const data = await apiFetch("/api/rbac/config");
        if (!isMounted) return;
        setRbacConfig(data);
        setDraftScopes(data.scopes || {});
        if (!isPlatformAdmin) {
          setScope("seller");
        } else if (data.visibleScopes?.length) {
          setScope((previousScope) => (data.visibleScopes.includes(previousScope) ? previousScope : data.visibleScopes[0]));
        }
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError.message || "Unable to load RBAC configuration.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadRbacConfig();
    return () => {
      isMounted = false;
    };
  }, [isPlatformAdmin]);

  const permissionGroups = useMemo(() => rbacConfig?.permissionGroups || [], [rbacConfig?.permissionGroups]);
  const visibleScopes = useMemo(
    () => rbacConfig?.visibleScopes || (isPlatformAdmin ? ["platform", "seller"] : ["seller"]),
    [rbacConfig?.visibleScopes, isPlatformAdmin]
  );
  const currentScopeConfig = useMemo(() => draftScopes?.[scope] || { roles: [], matrix: {} }, [draftScopes, scope]);
  const savedScopeConfig = useMemo(() => rbacConfig?.scopes?.[scope] || { roles: [], matrix: {} }, [rbacConfig?.scopes, scope]);
  const roleCards = useMemo(() => currentScopeConfig.roles || [], [currentScopeConfig]);
  const currentMatrix = useMemo(() => currentScopeConfig.matrix || {}, [currentScopeConfig]);

  const visibleGroups = useMemo(
    () =>
      permissionGroups.filter((group) =>
        group.scope === scope &&
        group.permissions.some((permission) =>
          roleCards.some((role) => permissionGranted(currentMatrix[role.key], permission.key) || role.isEditable)
        )
      ),
    [permissionGroups, roleCards, currentMatrix, scope]
  );

  function updateDraftPermission(roleKey, permissionKey, checked) {
    setDraftScopes((prev) => {
      const nextScopes = { ...prev };
      const nextScope = { ...(nextScopes[scope] || { roles: [], matrix: {} }) };
      const nextMatrix = { ...(nextScope.matrix || {}) };
      const nextPermissions = new Set(normalizePermissions(nextMatrix[roleKey]));

      nextPermissions.delete("*");
      if (checked) {
        nextPermissions.add(permissionKey);
      } else {
        nextPermissions.delete(permissionKey);
      }

      nextMatrix[roleKey] = [...nextPermissions].sort();
      nextScope.matrix = nextMatrix;
      nextScopes[scope] = nextScope;
      return nextScopes;
    });
    setSuccess("");
  }

  function resetScopeChanges() {
    setDraftScopes((prev) => ({
      ...prev,
      [scope]: savedScopeConfig
    }));
    setSuccess("");
    setError("");
  }

  async function handleSaveScope() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await apiFetch("/api/rbac/config", {
        method: "PUT",
        body: JSON.stringify({
          scope,
          matrix: currentMatrix
        })
      });

      setRbacConfig((prev) => ({
        ...prev,
        scopes: {
          ...(prev?.scopes || {}),
          [scope]: response.config
        }
      }));
      setDraftScopes((prev) => ({
        ...prev,
        [scope]: response.config
      }));
      setSuccess(response.message || "RBAC rules updated.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save RBAC configuration.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="module-placeholder glass-panel">
        <div className="page-banner">
          <div>
            <p className="eyebrow">Governance</p>
            <h2>Roles & Permissions</h2>
            <p>Loading the current RBAC model.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="module-placeholder glass-panel">
      <div className="page-banner">
        <div>
          <p className="eyebrow">Governance</p>
          <h2>Roles & Permissions</h2>
          <p>
            {isPlatformAdmin
              ? "Platform admin can update the persisted RBAC rules here. Seller users can still review the same model in read-only mode."
              : "This is the current seller-side RBAC model for your workspace. Seller view stays read-only so your team can understand role boundaries without changing them."}
          </p>
        </div>
        <div className="banner-stat">
          <span>Mode</span>
          <strong>{scope === "platform" ? "Platform" : "Seller"}</strong>
        </div>
      </div>

      {error ? <div className="notice error">{error}</div> : null}
      {success ? <div className="notice success">{success}</div> : null}

      {isPlatformAdmin ? (
        <div className="rbac-scope-toggle">
          {visibleScopes.map((scopeKey) => (
            <button
              key={scopeKey}
              type="button"
              className={scope === scopeKey ? "auth-toggle active" : "auth-toggle"}
              onClick={() => setScope(scopeKey)}
            >
              {scopeKey === "platform" ? "Platform Scope" : "Seller Scope"}
            </button>
          ))}
        </div>
      ) : (
        <div className="rbac-scope-toggle">
          <span className="badge quotation-new">Seller Scope</span>
          <span className="muted">Read-only visibility for seller-side roles.</span>
        </div>
      )}

      <div className="rbac-role-grid">
        {roleCards.map((role) => (
          <article key={role.key} className="rbac-role-card glass-panel">
            <span className="eyebrow">{role.label}</span>
            <p>{role.summary}</p>
            <div className="rbac-role-meta">
              <span className={role.isEditable && isPlatformAdmin ? "badge success" : "badge quotation-new"}>
                {role.isEditable && isPlatformAdmin ? "Editable" : "Read Only"}
              </span>
            </div>
          </article>
        ))}
      </div>

      {isPlatformAdmin ? (
        <div className="rbac-toolbar">
          <div className="rbac-toolbar-copy">
            <strong>{scope === "platform" ? "Platform scope" : "Seller scope"}</strong>
            <span>Changes here are persisted and used by backend auth checks plus frontend gating.</span>
          </div>
          <div className="rbac-toolbar-actions">
            <button type="button" className="ghost-btn" onClick={resetScopeChanges} disabled={saving}>
              Reset Scope
            </button>
            <button type="button" onClick={handleSaveScope} disabled={saving}>
              {saving ? "Saving..." : "Save RBAC"}
            </button>
          </div>
        </div>
      ) : null}

      {visibleGroups.map((group) => (
        <div key={group.key} className="rbac-group">
          <div className="section-head">
            <h3>{group.title}</h3>
            <span>{group.permissions.length} permission(s)</span>
          </div>
          <div className="rbac-table-wrap">
            <table className="data-table rbac-table">
              <thead>
                <tr>
                  <th>Permission Key</th>
                  <th>Description</th>
                  {roleCards.map((role) => (
                    <th key={role.key}>{role.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.permissions.map((permission) => (
                  <tr key={permission.key}>
                    <td><code>{permission.key}</code></td>
                    <td>{permission.label}</td>
                    {roleCards.map((role) => {
                      const allowed = permissionGranted(currentMatrix[role.key], permission.key);
                      const canEditCell = Boolean(isPlatformAdmin && role.isEditable);
                      return (
                        <td key={`${permission.key}-${role.key}`}>
                          {canEditCell ? (
                            <label className="rbac-toggle">
                              <input
                                type="checkbox"
                                checked={allowed}
                                onChange={(event) => updateDraftPermission(role.key, permission.key, event.target.checked)}
                              />
                              <span>{allowed ? "Allowed" : "Blocked"}</span>
                            </label>
                          ) : (
                            <AccessCell allowed={allowed} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="rbac-footnote glass-panel">
        <strong>Important:</strong> even when a role has quotation or customer permissions, tenant isolation still applies. Seller users remain restricted to data inside their own seller account, and seller-side RBAC remains read-only outside platform administration.
      </div>
    </section>
  );
}
