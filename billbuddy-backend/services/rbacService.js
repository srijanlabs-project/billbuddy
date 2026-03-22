const pool = require("../db/db");
const {
  PERMISSION_GROUPS,
  ROLE_DEFINITIONS,
  PLATFORM_ROLE_PERMISSIONS,
  SELLER_ROLE_PERMISSIONS,
  getAccessScope,
  getDefaultUserPermissions,
  normalizeRoleName
} = require("../rbac/permissions");

function getDefaultPermissionMap(scope) {
  return scope === "platform" ? PLATFORM_ROLE_PERMISSIONS : SELLER_ROLE_PERMISSIONS;
}

function getRoleDefinitions(scope, options = {}) {
  const visibleOnly = Boolean(options.visibleOnly);
  return ROLE_DEFINITIONS
    .filter((entry) => entry.scope === scope && (!visibleOnly || entry.isVisible))
    .sort((left, right) => left.displayOrder - right.displayOrder);
}

function getPermissionCatalog() {
  return PERMISSION_GROUPS.map((group) => ({
    key: group.key,
    scope: group.scope,
    title: group.title,
    permissions: group.permissions.map((permission) => ({
      key: permission.key,
      label: permission.label
    }))
  }));
}

async function seedRbacRolesAndPermissions(client = pool) {
  for (const role of ROLE_DEFINITIONS) {
    await client.query(
      `INSERT INTO rbac_roles (
         scope,
         role_key,
         role_label,
         role_summary,
         is_system,
         is_editable,
         is_visible,
         display_order,
         permissions_initialized
       )
       VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, FALSE)
       ON CONFLICT (scope, role_key) DO UPDATE
       SET role_label = EXCLUDED.role_label,
           role_summary = EXCLUDED.role_summary,
           is_editable = EXCLUDED.is_editable,
           is_visible = EXCLUDED.is_visible,
           display_order = EXCLUDED.display_order,
           updated_at = CURRENT_TIMESTAMP`,
      [
        role.scope,
        role.key,
        role.label,
        role.summary,
        role.isEditable,
        role.isVisible,
        role.displayOrder
      ]
    );
  }

  const rolesResult = await client.query(
    `SELECT id, scope, role_key, permissions_initialized
     FROM rbac_roles`
  );
  const roleMap = new Map(
    rolesResult.rows.map((row) => [`${row.scope}:${row.role_key}`, { id: row.id, initialized: row.permissions_initialized }])
  );

  for (const role of ROLE_DEFINITIONS) {
    const roleRecord = roleMap.get(`${role.scope}:${role.key}`);
    if (!roleRecord || roleRecord.initialized) {
      continue;
    }

    const defaultPermissionMap = getDefaultPermissionMap(role.scope);
    const defaultPermissions = [...new Set(defaultPermissionMap[role.key] || [])];
    for (const permissionKey of defaultPermissions) {
      await client.query(
        `INSERT INTO rbac_role_permissions (role_id, permission_key)
         VALUES ($1, $2)
         ON CONFLICT (role_id, permission_key) DO NOTHING`,
        [roleRecord.id, permissionKey]
      );
    }

    await client.query(
      `UPDATE rbac_roles
       SET permissions_initialized = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [roleRecord.id]
    );
  }
}

async function getPersistedPermissionsForRole(scope, roleKey, client = pool) {
  const result = await client.query(
    `SELECT
       rr.id,
       COALESCE(
         ARRAY_AGG(rrp.permission_key ORDER BY rrp.permission_key)
           FILTER (WHERE rrp.permission_key IS NOT NULL),
         ARRAY[]::text[]
       ) AS permissions
     FROM rbac_roles rr
     LEFT JOIN rbac_role_permissions rrp ON rrp.role_id = rr.id
     WHERE rr.scope = $1
       AND rr.role_key = $2
     GROUP BY rr.id`,
    [scope, roleKey]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0].permissions || [];
}

async function getEffectivePermissionsForUser(user, client = pool) {
  const scope = getAccessScope(user);
  const roleKey = normalizeRoleName(user?.role);
  const persistedPermissions = await getPersistedPermissionsForRole(scope, roleKey, client);
  if (persistedPermissions) {
    return persistedPermissions;
  }
  return getDefaultUserPermissions(user);
}

async function getScopeConfiguration(scope, options = {}, client = pool) {
  const visibleOnly = Boolean(options.visibleOnly);
  const rolesResult = await client.query(
    `SELECT
       rr.id,
       rr.role_key,
       rr.role_label,
       rr.role_summary,
       rr.is_editable,
       rr.is_visible,
       rr.display_order,
       COALESCE(
         ARRAY_AGG(rrp.permission_key ORDER BY rrp.permission_key)
           FILTER (WHERE rrp.permission_key IS NOT NULL),
         ARRAY[]::text[]
       ) AS permissions
     FROM rbac_roles rr
     LEFT JOIN rbac_role_permissions rrp ON rrp.role_id = rr.id
     WHERE rr.scope = $1
       AND ($2::boolean = FALSE OR rr.is_visible = TRUE)
     GROUP BY rr.id, rr.role_key, rr.role_label, rr.role_summary, rr.is_editable, rr.is_visible, rr.display_order
     ORDER BY rr.display_order ASC, rr.role_label ASC`,
    [scope, visibleOnly]
  );

  const roles = rolesResult.rows.map((row) => ({
    key: row.role_key,
    label: row.role_label,
    summary: row.role_summary,
    isEditable: Boolean(row.is_editable),
    isVisible: Boolean(row.is_visible),
    permissions: row.permissions || []
  }));

  const matrix = roles.reduce((accumulator, role) => {
    accumulator[role.key] = role.permissions;
    return accumulator;
  }, {});

  return {
    roles,
    matrix
  };
}

function getMirroredRoleLinks(scope) {
  return ROLE_DEFINITIONS
    .filter((entry) => entry.scope === scope && entry.mirrorFrom)
    .map((entry) => ({
      roleKey: entry.key,
      sourceRoleKey: entry.mirrorFrom
    }));
}

async function saveScopeConfiguration(scope, matrix, client = pool) {
  const normalizedMatrix = matrix && typeof matrix === "object" ? matrix : {};
  const permissionKeys = new Set(PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.key)));
  permissionKeys.add("*");

  const rolesResult = await client.query(
    `SELECT id, role_key, is_editable
     FROM rbac_roles
     WHERE scope = $1`,
    [scope]
  );

  const roleMap = new Map(rolesResult.rows.map((row) => [row.role_key, { id: row.id, isEditable: Boolean(row.is_editable) }]));
  const editableRoles = ROLE_DEFINITIONS.filter((entry) => entry.scope === scope && entry.isEditable && !entry.mirrorFrom);

  for (const role of editableRoles) {
    const roleRecord = roleMap.get(role.key);
    if (!roleRecord) continue;
    const desiredPermissions = [...new Set((normalizedMatrix[role.key] || []).filter((permissionKey) => permissionKeys.has(permissionKey)))];

    await client.query(`DELETE FROM rbac_role_permissions WHERE role_id = $1`, [roleRecord.id]);
    for (const permissionKey of desiredPermissions) {
      await client.query(
        `INSERT INTO rbac_role_permissions (role_id, permission_key)
         VALUES ($1, $2)
         ON CONFLICT (role_id, permission_key) DO NOTHING`,
        [roleRecord.id, permissionKey]
      );
    }
    await client.query(
      `UPDATE rbac_roles
       SET permissions_initialized = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [roleRecord.id]
    );
  }

  for (const mirroredRole of getMirroredRoleLinks(scope)) {
    const source = roleMap.get(mirroredRole.sourceRoleKey);
    const target = roleMap.get(mirroredRole.roleKey);
    if (!source || !target) continue;

    await client.query(`DELETE FROM rbac_role_permissions WHERE role_id = $1`, [target.id]);
    await client.query(
      `INSERT INTO rbac_role_permissions (role_id, permission_key)
       SELECT $1, permission_key
       FROM rbac_role_permissions
       WHERE role_id = $2
       ON CONFLICT (role_id, permission_key) DO NOTHING`,
      [target.id, source.id]
    );
    await client.query(
      `UPDATE rbac_roles
       SET permissions_initialized = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [target.id]
    );
  }

  return getScopeConfiguration(scope, { visibleOnly: true }, client);
}

async function getRbacConfigForUser(user, client = pool) {
  const isPlatformAdmin = Boolean(user?.isPlatformAdmin);
  const scopes = {};

  if (isPlatformAdmin) {
    scopes.platform = await getScopeConfiguration("platform", { visibleOnly: true }, client);
  }
  scopes.seller = await getScopeConfiguration("seller", { visibleOnly: true }, client);

  return {
    canEdit: isPlatformAdmin,
    visibleScopes: isPlatformAdmin ? ["platform", "seller"] : ["seller"],
    permissionGroups: getPermissionCatalog(),
    scopes
  };
}

module.exports = {
  getPermissionCatalog,
  getRoleDefinitions,
  seedRbacRolesAndPermissions,
  getPersistedPermissionsForRole,
  getEffectivePermissionsForUser,
  getScopeConfiguration,
  saveScopeConfiguration,
  getRbacConfigForUser
};
