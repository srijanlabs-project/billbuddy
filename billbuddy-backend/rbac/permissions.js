const PERMISSIONS = Object.freeze({
  QUOTATION_CREATE: "quotation.create",
  QUOTATION_VIEW: "quotation.view",
  QUOTATION_SEARCH: "quotation.search",
  QUOTATION_DOWNLOAD_PDF: "quotation.download_pdf",
  QUOTATION_DOWNLOAD_SHEET: "quotation.download_sheet",
  QUOTATION_EDIT: "quotation.edit",
  QUOTATION_REVISE: "quotation.revise",
  QUOTATION_SEND: "quotation.send",
  QUOTATION_MARK_PAID: "quotation.mark_paid",
  QUOTATION_UPDATE_STATUS: "quotation.update_status",
  CUSTOMER_CREATE: "customer.create",
  CUSTOMER_VIEW: "customer.view",
  CUSTOMER_EDIT: "customer.edit",
  CUSTOMER_SEARCH: "customer.search",
  PRODUCT_CREATE: "product.create",
  PRODUCT_EDIT: "product.edit",
  PRODUCT_VIEW: "product.view",
  PRODUCT_BULK_UPLOAD: "product.bulk_upload",
  PRODUCT_SECONDARY_CREATE: "product.secondary.create",
  PRODUCT_SECONDARY_VIEW: "product.secondary.view",
  CONFIGURATION_VIEW: "configuration.view",
  CONFIGURATION_EDIT: "configuration.edit",
  CONFIGURATION_SAVE_DRAFT: "configuration.save_draft",
  CONFIGURATION_PUBLISH: "configuration.publish",
  SETTINGS_VIEW: "settings.view",
  SETTINGS_EDIT: "settings.edit",
  BRANDING_EDIT: "branding.edit",
  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_EDIT: "user.edit",
  USER_MANAGE_ROLES: "user.manage_roles",
  SUBSCRIPTION_VIEW: "subscription.view",
  SUBSCRIPTION_MANAGE: "subscription.manage",
  BILLING_VIEW: "billing.view",
  LEAD_VIEW: "lead.view",
  LEAD_CREATE: "lead.create",
  LEAD_EDIT: "lead.edit",
  LEAD_CONVERT_DEMO: "lead.convert_demo",
  SELLER_VIEW: "seller.view",
  SELLER_CREATE: "seller.create",
  SELLER_EDIT: "seller.edit",
  SELLER_LOCK: "seller.lock",
  SELLER_CONFIGURE: "seller.configure",
  PLAN_VIEW: "plan.view",
  PLAN_CREATE: "plan.create",
  PLAN_EDIT: "plan.edit",
  NOTIFICATION_VIEW: "notification.view",
  NOTIFICATION_CREATE: "notification.create",
  NOTIFICATION_SEND: "notification.send",
  DASHBOARD_VIEW: "dashboard.view",
  REPORTS_VIEW: "reports.view"
});

function normalizeRoleName(role) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

const PLATFORM_ROLE_PERMISSIONS = Object.freeze({
  platform_admin: ["*"],
  super_admin: ["*"],
  admin: ["*"],
  platform_ops: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_EDIT,
    PERMISSIONS.LEAD_CONVERT_DEMO,
    PERMISSIONS.SELLER_VIEW,
    PERMISSIONS.SELLER_CREATE,
    PERMISSIONS.SELLER_EDIT,
    PERMISSIONS.SELLER_LOCK,
    PERMISSIONS.SELLER_CONFIGURE,
    PERMISSIONS.SUBSCRIPTION_VIEW,
    PERMISSIONS.SUBSCRIPTION_MANAGE,
    PERMISSIONS.PLAN_VIEW,
    PERMISSIONS.NOTIFICATION_VIEW,
    PERMISSIONS.NOTIFICATION_CREATE,
    PERMISSIONS.NOTIFICATION_SEND,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.REPORTS_VIEW
  ],
  platform_sales: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_EDIT,
    PERMISSIONS.LEAD_CONVERT_DEMO,
    PERMISSIONS.SELLER_VIEW,
    PERMISSIONS.PLAN_VIEW,
    PERMISSIONS.NOTIFICATION_VIEW
  ],
  sales: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.LEAD_CREATE,
    PERMISSIONS.LEAD_EDIT,
    PERMISSIONS.LEAD_CONVERT_DEMO,
    PERMISSIONS.SELLER_VIEW,
    PERMISSIONS.PLAN_VIEW
  ],
  platform_support: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.LEAD_VIEW,
    PERMISSIONS.SELLER_VIEW,
    PERMISSIONS.SELLER_CONFIGURE,
    PERMISSIONS.SUBSCRIPTION_VIEW,
    PERMISSIONS.PLAN_VIEW,
    PERMISSIONS.NOTIFICATION_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ]
});

const SELLER_ROLE_PERMISSIONS = Object.freeze({
  seller_admin: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.QUOTATION_CREATE,
    PERMISSIONS.QUOTATION_VIEW,
    PERMISSIONS.QUOTATION_SEARCH,
    PERMISSIONS.QUOTATION_DOWNLOAD_PDF,
    PERMISSIONS.QUOTATION_DOWNLOAD_SHEET,
    PERMISSIONS.QUOTATION_EDIT,
    PERMISSIONS.QUOTATION_REVISE,
    PERMISSIONS.QUOTATION_SEND,
    PERMISSIONS.QUOTATION_MARK_PAID,
    PERMISSIONS.QUOTATION_UPDATE_STATUS,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.CUSTOMER_SEARCH,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_BULK_UPLOAD,
    PERMISSIONS.PRODUCT_SECONDARY_CREATE,
    PERMISSIONS.PRODUCT_SECONDARY_VIEW,
    PERMISSIONS.CONFIGURATION_VIEW,
    PERMISSIONS.CONFIGURATION_EDIT,
    PERMISSIONS.CONFIGURATION_SAVE_DRAFT,
    PERMISSIONS.CONFIGURATION_PUBLISH,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.BRANDING_EDIT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_MANAGE_ROLES,
    PERMISSIONS.SUBSCRIPTION_VIEW,
    PERMISSIONS.SUBSCRIPTION_MANAGE,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ],
  admin: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.QUOTATION_CREATE,
    PERMISSIONS.QUOTATION_VIEW,
    PERMISSIONS.QUOTATION_SEARCH,
    PERMISSIONS.QUOTATION_DOWNLOAD_PDF,
    PERMISSIONS.QUOTATION_DOWNLOAD_SHEET,
    PERMISSIONS.QUOTATION_EDIT,
    PERMISSIONS.QUOTATION_REVISE,
    PERMISSIONS.QUOTATION_SEND,
    PERMISSIONS.QUOTATION_MARK_PAID,
    PERMISSIONS.QUOTATION_UPDATE_STATUS,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.CUSTOMER_SEARCH,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_BULK_UPLOAD,
    PERMISSIONS.PRODUCT_SECONDARY_CREATE,
    PERMISSIONS.PRODUCT_SECONDARY_VIEW,
    PERMISSIONS.CONFIGURATION_VIEW,
    PERMISSIONS.CONFIGURATION_EDIT,
    PERMISSIONS.CONFIGURATION_SAVE_DRAFT,
    PERMISSIONS.CONFIGURATION_PUBLISH,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.BRANDING_EDIT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_MANAGE_ROLES,
    PERMISSIONS.SUBSCRIPTION_VIEW,
    PERMISSIONS.SUBSCRIPTION_MANAGE,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ],
  master_user: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.QUOTATION_CREATE,
    PERMISSIONS.QUOTATION_VIEW,
    PERMISSIONS.QUOTATION_SEARCH,
    PERMISSIONS.QUOTATION_DOWNLOAD_PDF,
    PERMISSIONS.QUOTATION_DOWNLOAD_SHEET,
    PERMISSIONS.QUOTATION_EDIT,
    PERMISSIONS.QUOTATION_REVISE,
    PERMISSIONS.QUOTATION_SEND,
    PERMISSIONS.QUOTATION_MARK_PAID,
    PERMISSIONS.QUOTATION_UPDATE_STATUS,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.CUSTOMER_SEARCH,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_BULK_UPLOAD,
    PERMISSIONS.PRODUCT_SECONDARY_CREATE,
    PERMISSIONS.PRODUCT_SECONDARY_VIEW,
    PERMISSIONS.CONFIGURATION_VIEW,
    PERMISSIONS.CONFIGURATION_EDIT,
    PERMISSIONS.CONFIGURATION_SAVE_DRAFT,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.BRANDING_EDIT,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.SUBSCRIPTION_VIEW,
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ],
  seller_user: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.QUOTATION_CREATE,
    PERMISSIONS.QUOTATION_VIEW,
    PERMISSIONS.QUOTATION_SEARCH,
    PERMISSIONS.QUOTATION_DOWNLOAD_PDF,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_SEARCH,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_SECONDARY_CREATE,
    PERMISSIONS.PRODUCT_SECONDARY_VIEW
  ],
  sub_user: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.QUOTATION_CREATE,
    PERMISSIONS.QUOTATION_VIEW,
    PERMISSIONS.QUOTATION_SEARCH,
    PERMISSIONS.QUOTATION_DOWNLOAD_PDF,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_SEARCH,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_SECONDARY_CREATE,
    PERMISSIONS.PRODUCT_SECONDARY_VIEW
  ],
  demo_user: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.QUOTATION_VIEW,
    PERMISSIONS.QUOTATION_SEARCH,
    PERMISSIONS.QUOTATION_DOWNLOAD_PDF,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.PRODUCT_VIEW
  ],
  viewer: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.QUOTATION_VIEW,
    PERMISSIONS.QUOTATION_SEARCH,
    PERMISSIONS.QUOTATION_DOWNLOAD_PDF,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.REPORTS_VIEW
  ],
  customer: []
});

const ROLE_DEFINITIONS = Object.freeze([
  {
    scope: "platform",
    key: "platform_admin",
    label: "Platform Admin",
    summary: "Full access across the platform with wildcard control.",
    isVisible: true,
    isEditable: false,
    displayOrder: 1
  },
  {
    scope: "platform",
    key: "super_admin",
    label: "Super Admin",
    summary: "Legacy platform alias that mirrors Platform Admin.",
    isVisible: false,
    isEditable: false,
    displayOrder: 2,
    mirrorFrom: "platform_admin"
  },
  {
    scope: "platform",
    key: "admin",
    label: "Admin",
    summary: "Legacy platform alias that mirrors Platform Admin.",
    isVisible: false,
    isEditable: false,
    displayOrder: 3,
    mirrorFrom: "platform_admin"
  },
  {
    scope: "platform",
    key: "platform_ops",
    label: "Platform Ops",
    summary: "Runs seller lifecycle, subscriptions, notifications, and operational governance.",
    isVisible: true,
    isEditable: true,
    displayOrder: 4
  },
  {
    scope: "platform",
    key: "platform_sales",
    label: "Platform Sales",
    summary: "Focuses on lead progression, demo conversion, and seller visibility.",
    isVisible: true,
    isEditable: true,
    displayOrder: 5
  },
  {
    scope: "platform",
    key: "sales",
    label: "Sales",
    summary: "Legacy platform sales alias.",
    isVisible: false,
    isEditable: false,
    displayOrder: 6,
    mirrorFrom: "platform_sales"
  },
  {
    scope: "platform",
    key: "platform_support",
    label: "Platform Support",
    summary: "Supports sellers, configuration visibility, subscriptions, and reporting.",
    isVisible: true,
    isEditable: true,
    displayOrder: 7
  },
  {
    scope: "seller",
    key: "seller_admin",
    label: "Seller Admin",
    summary: "Full seller-account access including settings, users, configuration, and quotations.",
    isVisible: true,
    isEditable: true,
    displayOrder: 1
  },
  {
    scope: "seller",
    key: "admin",
    label: "Admin",
    summary: "Legacy seller alias that mirrors Seller Admin.",
    isVisible: false,
    isEditable: false,
    displayOrder: 2,
    mirrorFrom: "seller_admin"
  },
  {
    scope: "seller",
    key: "master_user",
    label: "Master User",
    summary: "Runs daily seller operations with strong access, but without configuration publishing.",
    isVisible: true,
    isEditable: true,
    displayOrder: 3
  },
  {
    scope: "seller",
    key: "seller_user",
    label: "Seller User",
    summary: "Legacy seller user alias that mirrors Sub User.",
    isVisible: false,
    isEditable: false,
    displayOrder: 4,
    mirrorFrom: "sub_user"
  },
  {
    scope: "seller",
    key: "sub_user",
    label: "Sub User",
    summary: "Focused operational role for quotation entry and retrieval.",
    isVisible: true,
    isEditable: true,
    displayOrder: 5
  },
  {
    scope: "seller",
    key: "demo_user",
    label: "Demo User",
    summary: "Guided seller role used during trial and sample-workspace onboarding.",
    isVisible: false,
    isEditable: true,
    displayOrder: 6
  },
  {
    scope: "seller",
    key: "viewer",
    label: "Viewer",
    summary: "Read-only operational visibility for quotations, customers, products, and reports.",
    isVisible: true,
    isEditable: true,
    displayOrder: 7
  },
  {
    scope: "seller",
    key: "customer",
    label: "Customer",
    summary: "Reserved customer-facing role with no seller-operations access.",
    isVisible: false,
    isEditable: true,
    displayOrder: 8
  }
]);

const PERMISSION_GROUPS = Object.freeze([
  {
    key: "quotation",
    scope: "seller",
    title: "Quotation",
    permissions: [
      { key: PERMISSIONS.QUOTATION_CREATE, label: "Create quotation" },
      { key: PERMISSIONS.QUOTATION_VIEW, label: "View quotation details" },
      { key: PERMISSIONS.QUOTATION_SEARCH, label: "Search quotations" },
      { key: PERMISSIONS.QUOTATION_DOWNLOAD_PDF, label: "Download quotation PDF" },
      { key: PERMISSIONS.QUOTATION_DOWNLOAD_SHEET, label: "Download quotation sheet" },
      { key: PERMISSIONS.QUOTATION_EDIT, label: "Edit quotation" },
      { key: PERMISSIONS.QUOTATION_REVISE, label: "Revise quotation" },
      { key: PERMISSIONS.QUOTATION_SEND, label: "Send quotation" },
      { key: PERMISSIONS.QUOTATION_MARK_PAID, label: "Mark quotation as paid" },
      { key: PERMISSIONS.QUOTATION_UPDATE_STATUS, label: "Update quotation status" }
    ]
  },
  {
    key: "customer_product",
    scope: "seller",
    title: "Customers and Products",
    permissions: [
      { key: PERMISSIONS.CUSTOMER_CREATE, label: "Create customer" },
      { key: PERMISSIONS.CUSTOMER_VIEW, label: "View customers" },
      { key: PERMISSIONS.CUSTOMER_EDIT, label: "Edit customer" },
      { key: PERMISSIONS.CUSTOMER_SEARCH, label: "Search customers" },
      { key: PERMISSIONS.PRODUCT_CREATE, label: "Create product" },
      { key: PERMISSIONS.PRODUCT_EDIT, label: "Edit product" },
      { key: PERMISSIONS.PRODUCT_VIEW, label: "View products" },
      { key: PERMISSIONS.PRODUCT_BULK_UPLOAD, label: "Bulk upload products" },
      { key: PERMISSIONS.PRODUCT_SECONDARY_CREATE, label: "Create secondary catalogue item" },
      { key: PERMISSIONS.PRODUCT_SECONDARY_VIEW, label: "View secondary catalogue items" }
    ]
  },
  {
    key: "configuration",
    scope: "seller",
    title: "Configuration and Settings",
    permissions: [
      { key: PERMISSIONS.CONFIGURATION_VIEW, label: "View configuration studio" },
      { key: PERMISSIONS.CONFIGURATION_EDIT, label: "Edit configuration studio" },
      { key: PERMISSIONS.CONFIGURATION_SAVE_DRAFT, label: "Save configuration draft" },
      { key: PERMISSIONS.CONFIGURATION_PUBLISH, label: "Publish seller configuration" },
      { key: PERMISSIONS.SETTINGS_VIEW, label: "View business settings" },
      { key: PERMISSIONS.SETTINGS_EDIT, label: "Edit business settings" },
      { key: PERMISSIONS.BRANDING_EDIT, label: "Edit branding assets" }
    ]
  },
  {
    key: "users_billing",
    scope: "seller",
    title: "Users, Billing and Reporting",
    permissions: [
      { key: PERMISSIONS.USER_VIEW, label: "View users" },
      { key: PERMISSIONS.USER_CREATE, label: "Create user" },
      { key: PERMISSIONS.USER_EDIT, label: "Edit user" },
      { key: PERMISSIONS.USER_MANAGE_ROLES, label: "Manage user roles" },
      { key: PERMISSIONS.SUBSCRIPTION_VIEW, label: "View subscriptions" },
      { key: PERMISSIONS.SUBSCRIPTION_MANAGE, label: "Manage subscriptions" },
      { key: PERMISSIONS.BILLING_VIEW, label: "View billing" },
      { key: PERMISSIONS.DASHBOARD_VIEW, label: "View dashboard" },
      { key: PERMISSIONS.REPORTS_VIEW, label: "View reports" }
    ]
  },
  {
    key: "platform",
    scope: "platform",
    title: "Platform Governance",
    permissions: [
      { key: PERMISSIONS.LEAD_VIEW, label: "View leads" },
      { key: PERMISSIONS.LEAD_CREATE, label: "Create lead" },
      { key: PERMISSIONS.LEAD_EDIT, label: "Edit lead" },
      { key: PERMISSIONS.LEAD_CONVERT_DEMO, label: "Convert lead to demo" },
      { key: PERMISSIONS.SELLER_VIEW, label: "View sellers" },
      { key: PERMISSIONS.SELLER_CREATE, label: "Create seller" },
      { key: PERMISSIONS.SELLER_EDIT, label: "Edit seller" },
      { key: PERMISSIONS.SELLER_LOCK, label: "Lock seller" },
      { key: PERMISSIONS.SELLER_CONFIGURE, label: "Configure seller" },
      { key: PERMISSIONS.PLAN_VIEW, label: "View plans" },
      { key: PERMISSIONS.PLAN_CREATE, label: "Create plan" },
      { key: PERMISSIONS.PLAN_EDIT, label: "Edit plan" },
      { key: PERMISSIONS.NOTIFICATION_VIEW, label: "View notifications" },
      { key: PERMISSIONS.NOTIFICATION_CREATE, label: "Create notification" },
      { key: PERMISSIONS.NOTIFICATION_SEND, label: "Send notification" }
    ]
  }
]);

function getAccessScope(user = {}) {
  if (user.isPlatformAdmin) return "platform";
  return "seller";
}

function getRolePermissionMap(user = {}) {
  return getAccessScope(user) === "platform" ? PLATFORM_ROLE_PERMISSIONS : SELLER_ROLE_PERMISSIONS;
}

function getDefaultUserPermissions(user = {}) {
  const role = normalizeRoleName(user.role);
  const permissionMap = getRolePermissionMap(user);
  const granted = permissionMap[role] || [];
  if (granted.includes("*")) {
    return ["*"];
  }
  return [...new Set(granted)];
}

function getUserPermissions(user = {}) {
  return getDefaultUserPermissions(user);
}

function hasPermission(user = {}, permissionKey) {
  if (!permissionKey) return false;
  const granted = Array.isArray(user?.permissions) ? user.permissions : getUserPermissions(user);
  return granted.includes("*") || granted.includes(permissionKey);
}

function requirePermission(permissionKey) {
  return function permissionMiddleware(req, res, next) {
    if (!hasPermission(req.user, permissionKey)) {
      return res.status(403).json({ message: `Permission denied: ${permissionKey}` });
    }
    return next();
  };
}

module.exports = {
  PERMISSIONS,
  PERMISSION_GROUPS,
  ROLE_DEFINITIONS,
  PLATFORM_ROLE_PERMISSIONS,
  SELLER_ROLE_PERMISSIONS,
  normalizeRoleName,
  getAccessScope,
  getDefaultUserPermissions,
  getUserPermissions,
  hasPermission,
  requirePermission
};
