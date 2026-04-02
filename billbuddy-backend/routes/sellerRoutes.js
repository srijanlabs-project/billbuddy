const express = require("express");
const pool = require("../db/db");
const { requirePlatformAdmin } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");
const { syncSellerSubscriptionCache, getCurrentSubscription, isSubscriptionExpired, getQuotationWatermark } = require("../services/subscriptionService");
const { hashPassword, validatePasswordStrength } = require("../utils/passwords");

const router = express.Router();

function normalizeSellerType(value) {
  const normalized = String(value || "BASIC").trim().toUpperCase();
  return normalized === "ADVANCED" ? "ADVANCED" : "BASIC";
}

function normalizeQuotationPrefix(value) {
  return (String(value || "QTN")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9/-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20)) || "QTN";
}

async function getSellerDetailPayload(clientOrPool, sellerId) {
  const sellerResult = await clientOrPool.query(
    `SELECT
       s.*,
       cs.id AS subscription_id,
       cs.status AS subscription_status,
       cs.start_date AS subscription_start_date,
       cs.end_date AS subscription_end_date,
       cs.trial_start_at,
       cs.trial_end_at,
       cs.converted_from_trial,
       p.plan_code,
       p.plan_name,
       p.price AS plan_price,
       p.billing_cycle,
       COALESCE(pf.max_users, s.max_users, 0) AS plan_max_users,
       COALESCE(pf.max_quotations, s.max_orders_per_month, 0) AS plan_max_quotations,
       COALESCE(c.customer_count, 0) AS customer_count,
       COALESCE(u.user_count, 0) AS user_count,
       COALESCE(q.order_count, 0) AS order_count,
       COALESCE(q.total_revenue, 0) AS total_revenue,
       ul.last_login_at
     FROM sellers s
     LEFT JOIN LATERAL (
       SELECT *
       FROM subscriptions sub
       WHERE sub.seller_id = s.id
       ORDER BY
         CASE
           WHEN sub.status = 'active' THEN 1
           WHEN sub.status = 'trial' THEN 2
           WHEN sub.status = 'suspended' THEN 3
           WHEN sub.status = 'expired' THEN 4
           WHEN sub.status = 'cancelled' THEN 5
           ELSE 6
         END,
         COALESCE(sub.updated_at, sub.created_at) DESC,
         sub.id DESC
       LIMIT 1
     ) cs ON TRUE
     LEFT JOIN plans p ON p.id = cs.plan_id
     LEFT JOIN plan_features pf ON pf.plan_id = p.id
     LEFT JOIN (
       SELECT seller_id, COUNT(*) AS customer_count
       FROM customers
       GROUP BY seller_id
     ) c ON c.seller_id = s.id
     LEFT JOIN (
       SELECT seller_id, COUNT(*) AS user_count
       FROM users
       GROUP BY seller_id
     ) u ON u.seller_id = s.id
     LEFT JOIN (
       SELECT seller_id, COUNT(*) AS order_count, SUM(total_amount) AS total_revenue
       FROM quotations
       GROUP BY seller_id
     ) q ON q.seller_id = s.id
     LEFT JOIN (
       SELECT u.seller_id, MAX(us.last_activity) AS last_login_at
       FROM users u
       INNER JOIN user_sessions us ON us.user_id = u.id
       GROUP BY u.seller_id
     ) ul ON ul.seller_id = s.id
     WHERE s.id = $1
     LIMIT 1`,
    [sellerId]
  );

  if (sellerResult.rowCount === 0) {
    return null;
  }

  const subscriptionsResult = await clientOrPool.query(
    `SELECT
       s.*,
       p.plan_code,
       p.plan_name,
       p.price AS plan_price,
       p.billing_cycle,
       p.is_demo_plan,
       p.trial_enabled
     FROM subscriptions s
     INNER JOIN plans p ON p.id = s.plan_id
     WHERE s.seller_id = $1
     ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.id DESC`,
    [sellerId]
  );

  const usersResult = await clientOrPool.query(
    `SELECT id, name, mobile, status, locked, created_at
     FROM users
     WHERE seller_id = $1
     ORDER BY created_at DESC, id DESC`,
    [sellerId]
  );

  const auditResult = await clientOrPool.query(
    `SELECT
       pal.*,
       actor.name AS actor_name,
       actor.mobile AS actor_mobile
     FROM platform_audit_logs pal
     LEFT JOIN users actor ON actor.id = pal.actor_user_id
     WHERE pal.seller_id = $1
     ORDER BY pal.created_at DESC, pal.id DESC
     LIMIT 100`,
    [sellerId]
  );

  return {
    seller: sellerResult.rows[0],
    subscriptions: subscriptionsResult.rows,
    users: usersResult.rows,
    auditLogs: auditResult.rows,
    usage: {
      userCount: Number(sellerResult.rows[0].user_count || 0),
      customerCount: Number(sellerResult.rows[0].customer_count || 0),
      quotationCount: Number(sellerResult.rows[0].order_count || 0),
      totalRevenue: Number(sellerResult.rows[0].total_revenue || 0),
      lastLoginAt: sellerResult.rows[0].last_login_at || null
    }
  };
}

router.get("/me", async (req, res) => {
  try {
    if (!req.user?.sellerId) {
      return res.json({ seller: null });
    }

    const result = await pool.query(`SELECT * FROM sellers WHERE id = $1`, [req.user.sellerId]);
    const seller = result.rows[0] || null;
    if (!seller) {
      return res.json({ seller: null });
    }

    const currentSubscription = await getCurrentSubscription(pool, req.user.sellerId);
    return res.json({
      seller: {
        ...seller,
        currentSubscription: currentSubscription ? {
          ...currentSubscription,
          is_expired: isSubscriptionExpired(currentSubscription),
          watermark_text: getQuotationWatermark(currentSubscription)
        } : null
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/me/setup-status", async (req, res) => {
  try {
    if (!req.user?.sellerId) {
      return res.json({
        sellerId: null,
        sellerType: "BASIC",
        stage: "ready",
        settingsCompleted: true,
        configurationCompleted: true,
        quotationUnlocked: true,
        seedStatus: { hasProducts: true, hasCustomers: true },
        missingSettings: []
      });
    }

    const sellerId = Number(req.user.sellerId);
    const sellerResult = await pool.query(
      `SELECT id, business_name, quotation_number_prefix, gst_number, seller_type
       FROM sellers
       WHERE id = $1
       LIMIT 1`,
      [sellerId]
    );

    if (sellerResult.rowCount === 0) {
      return res.status(404).json({ message: "Seller not found" });
    }

    const sellerRow = sellerResult.rows[0];

    const templateResult = await pool.query(
      `SELECT company_phone, company_email, company_address
       FROM quotation_templates
       WHERE seller_id = $1
       ORDER BY updated_at DESC, id DESC
       LIMIT 1`,
      [sellerId]
    );
    const template = templateResult.rows[0] || {};

    const profileResult = await pool.query(
      `SELECT id
       FROM seller_configuration_profiles
       WHERE seller_id = $1
         AND status = 'published'
       ORDER BY published_at DESC NULLS LAST, updated_at DESC, id DESC
       LIMIT 1`,
      [sellerId]
    );

    let catalogueFieldCount = 0;
    let quotationFieldCount = 0;
    if (profileResult.rowCount > 0) {
      const profileId = Number(profileResult.rows[0].id);
      const [catalogueCountResult, quotationCountResult] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS count FROM seller_catalogue_fields WHERE profile_id = $1`, [profileId]),
        pool.query(`SELECT COUNT(*)::int AS count FROM seller_quotation_columns WHERE profile_id = $1`, [profileId])
      ]);
      catalogueFieldCount = Number(catalogueCountResult.rows[0]?.count || 0);
      quotationFieldCount = Number(quotationCountResult.rows[0]?.count || 0);
    }

    const [productCountResult, customerCountResult] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM products WHERE seller_id = $1`, [sellerId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM customers WHERE seller_id = $1`, [sellerId])
    ]);

    const missingSettings = [];
    if (!String(sellerRow.business_name || "").trim()) missingSettings.push("business_name");
    const hasCompanyContact = Boolean(String(template.company_phone || "").trim() || String(template.company_email || "").trim());
    if (!hasCompanyContact) missingSettings.push("company_contact");
    if (!String(template.company_address || "").trim()) missingSettings.push("company_address");

    const settingsCompleted = missingSettings.length === 0;
    const configurationCompleted = profileResult.rowCount > 0 && catalogueFieldCount > 0 && quotationFieldCount > 0;
    const hasProducts = Number(productCountResult.rows[0]?.count || 0) > 0;
    const hasCustomers = Number(customerCountResult.rows[0]?.count || 0) > 0;
    const quotationUnlocked = settingsCompleted && configurationCompleted;

    let stage = "ready";
    if (!settingsCompleted) stage = "settings";
    else if (!configurationCompleted) stage = "configuration";
    else if (!hasProducts || !hasCustomers) stage = "seed";

    return res.json({
      sellerId,
      sellerType: normalizeSellerType(sellerRow.seller_type),
      stage,
      settingsCompleted,
      configurationCompleted,
      quotationUnlocked,
      seedStatus: {
        hasProducts,
        hasCustomers
      },
      missingSettings,
      configurationMetrics: {
        catalogueFieldCount,
        quotationFieldCount
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put("/me/settings", requirePermission(PERMISSIONS.SETTINGS_EDIT), async (req, res) => {
  try {
    const { themeKey, brandPrimaryColor, businessName, quotationNumberPrefix, sellerGstNumber, bankName, bankBranch, bankAccountNo, bankIfsc } = req.body;

    if (!req.user?.sellerId) {
      return res.status(400).json({ message: "seller context missing" });
    }

    const result = await pool.query(
      `UPDATE sellers
       SET theme_key = COALESCE($1, theme_key),
           brand_primary_color = COALESCE($2, brand_primary_color),
           business_name = COALESCE($3, business_name),
           quotation_number_prefix = COALESCE($4, quotation_number_prefix),
           gst_number = COALESCE($5, gst_number),
           bank_name = COALESCE($6, bank_name),
           bank_branch = COALESCE($7, bank_branch),
           bank_account_no = COALESCE($8, bank_account_no),
           bank_ifsc = COALESCE($9, bank_ifsc)
       WHERE id = $10
       RETURNING *`,
      [
        themeKey || null,
        brandPrimaryColor || null,
        businessName !== undefined ? (String(businessName || "").trim() || null) : null,
        quotationNumberPrefix ? normalizeQuotationPrefix(quotationNumberPrefix) : null,
        sellerGstNumber ? String(sellerGstNumber).trim().toUpperCase() : null,
        bankName || null,
        bankBranch || null,
        bankAccountNo || null,
        bankIfsc || null,
        req.user.sellerId
      ]
    );

    return res.json({ seller: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/", requirePermission(PERMISSIONS.SELLER_VIEW), requirePlatformAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         s.*,
         cs.id AS subscription_id,
         cs.status AS subscription_status,
         cs.start_date AS subscription_start_date,
         cs.end_date AS subscription_end_date,
         cs.trial_start_at,
         cs.trial_end_at,
         cs.converted_from_trial,
         p.plan_code,
         p.plan_name,
         COALESCE(u.user_count, 0) AS user_count,
         COALESCE(q.order_count, 0) AS order_count,
         COALESCE(q.total_revenue, 0) AS total_revenue
       FROM sellers s
       LEFT JOIN LATERAL (
         SELECT *
         FROM subscriptions sub
         WHERE sub.seller_id = s.id
         ORDER BY
           CASE
             WHEN sub.status = 'active' THEN 1
             WHEN sub.status = 'trial' THEN 2
             WHEN sub.status = 'suspended' THEN 3
             WHEN sub.status = 'expired' THEN 4
             WHEN sub.status = 'cancelled' THEN 5
             ELSE 6
           END,
           COALESCE(sub.updated_at, sub.created_at) DESC,
           sub.id DESC
         LIMIT 1
       ) cs ON TRUE
       LEFT JOIN plans p ON p.id = cs.plan_id
       LEFT JOIN (
         SELECT seller_id, COUNT(*) AS user_count
         FROM users
         GROUP BY seller_id
       ) u ON u.seller_id = s.id
       LEFT JOIN (
         SELECT seller_id, COUNT(*) AS order_count, SUM(total_amount) AS total_revenue
         FROM quotations
         GROUP BY seller_id
       ) q ON q.seller_id = s.id
       ORDER BY s.id DESC`
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/:id/detail", requirePermission(PERMISSIONS.SELLER_VIEW), requirePlatformAdmin, async (req, res) => {
  try {
    const detail = await getSellerDetailPayload(pool, Number(req.params.id));
    if (!detail) {
      return res.status(404).json({ message: "Seller not found" });
    }

    return res.json(detail);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/", requirePermission(PERMISSIONS.SELLER_CREATE), requirePlatformAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      name,
      mobile,
      email,
      sellerCode,
      themeKey = "matte-blue",
      brandPrimaryColor = "#2563eb",
      masterUser,
      subscriptionPlan = "DEMO",
      status = "pending",
      trialEndsAt = null,
      maxUsers = null,
      maxOrdersPerMonth = null,
      isLocked = false,
      businessName = null,
      gstNumber = null,
      businessAddress = null,
      city = null,
      state = null,
      businessCategory = null,
      sellerType = "BASIC"
    } = req.body;

    if (!name || !sellerCode) {
      return res.status(400).json({ message: "name and sellerCode are required" });
    }

    await client.query("BEGIN");

    const sellerResult = await client.query(
      `INSERT INTO sellers (name, business_name, mobile, email, gst_number, business_address, city, state, business_category, seller_code, onboarding_status, status, trial_ends_at, subscription_plan, max_users, max_orders_per_month, is_locked, theme_key, brand_primary_color, seller_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12, $13, $14, $15, $16, $17, $18, $19)
       RETURNING *`,
      [
        name,
        businessName || null,
        mobile || null,
        email || null,
        gstNumber || null,
        businessAddress || null,
        city || null,
        state || null,
        businessCategory || null,
        sellerCode,
        status || "pending",
        trialEndsAt || null,
        subscriptionPlan || "DEMO",
        maxUsers ? Number(maxUsers) : null,
        maxOrdersPerMonth ? Number(maxOrdersPerMonth) : null,
        Boolean(isLocked),
        themeKey,
        brandPrimaryColor,
        normalizeSellerType(sellerType)
      ]
    );

    const selectedPlan = await client.query(
      `SELECT p.id, p.plan_code, p.trial_enabled, p.trial_duration_days
       FROM plans p
       WHERE UPPER(p.plan_code) = UPPER($1) AND p.is_active = TRUE
       LIMIT 1`,
      [subscriptionPlan || "DEMO"]
    );

    if (selectedPlan.rowCount === 0) {
      throw new Error(`Plan ${subscriptionPlan || "DEMO"} not found or inactive`);
    }

    const plan = selectedPlan.rows[0];
    const trialDurationDays = Number(plan.trial_duration_days || 0);
    const resolvedTrialEndsAt = trialEndsAt
      ? new Date(trialEndsAt)
      : (plan.trial_enabled && trialDurationDays > 0
        ? new Date(Date.now() + trialDurationDays * 24 * 60 * 60 * 1000)
        : null);
    const subscriptionStatus = plan.trial_enabled ? "trial" : "active";

    await client.query(
      `INSERT INTO subscriptions (
         seller_id,
         plan_id,
         status,
         start_date,
         trial_start_at,
         trial_end_at,
         auto_assigned,
         created_by,
         updated_by
       )
       VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8)`,
      [
        sellerResult.rows[0].id,
        plan.id,
        subscriptionStatus,
        subscriptionStatus === "trial" ? new Date() : null,
        subscriptionStatus === "trial" ? resolvedTrialEndsAt : null,
        String(plan.plan_code).toUpperCase() === "DEMO",
        req.user.id,
        req.user.id
      ]
    );

    const featureLimits = await client.query(
      `SELECT max_users, max_quotations
       FROM plan_features
       WHERE plan_id = $1
       LIMIT 1`,
      [plan.id]
    );

    const limits = featureLimits.rows[0] || {};
    const sellerSyncResult = await client.query(
      `UPDATE sellers
       SET subscription_plan = $1,
           trial_ends_at = COALESCE($2, trial_ends_at),
           max_users = COALESCE($3, max_users),
           max_orders_per_month = COALESCE($4, max_orders_per_month)
       WHERE id = $5
       RETURNING *`,
      [
        String(plan.plan_code).toUpperCase(),
        resolvedTrialEndsAt,
        limits.max_users ?? (maxUsers ? Number(maxUsers) : null),
        limits.max_quotations ?? (maxOrdersPerMonth ? Number(maxOrdersPerMonth) : null),
        sellerResult.rows[0].id
      ]
    );
    await syncSellerSubscriptionCache(client, sellerResult.rows[0].id);

    let createdMasterUser = null;

    if (masterUser?.name && masterUser?.mobile) {
      if (!masterUser.password) {
        throw new Error("Master user password is required");
      }
      const passwordValidation = validatePasswordStrength(masterUser.password);
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.message);
      }

      const masterRoleResult = await client.query(
        `SELECT id, role_name
         FROM roles
         WHERE role_name = ANY($1::text[])`,
        [["Seller Admin", "Master User"]]
      );
      const roleId =
        masterRoleResult.rows.find((row) => row.role_name === "Seller Admin")?.id ||
        masterRoleResult.rows.find((row) => row.role_name === "Master User")?.id ||
        null;

      const userResult = await client.query(
        `INSERT INTO users (name, mobile, password, role_id, created_by, seller_id, status, is_platform_admin)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE)
         RETURNING id, name, mobile, seller_id`,
        [
          masterUser.name,
          masterUser.mobile,
          await hashPassword(masterUser.password),
          roleId,
          req.user.id,
          sellerResult.rows[0].id
        ]
      );

      createdMasterUser = userResult.rows[0];
    }

    await client.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        req.user.id,
        sellerResult.rows[0].id,
        "seller_created",
        JSON.stringify({
          sellerId: sellerResult.rows[0].id,
          sellerCode: sellerResult.rows[0].seller_code,
          status: sellerSyncResult.rows[0].status,
          subscriptionPlan: sellerSyncResult.rows[0].subscription_plan
        })
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      seller: sellerSyncResult.rows[0],
      masterUser: createdMasterUser
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "Seller code or mobile already exists" });
    }
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.post("/me/upgrade-request", requirePermission(PERMISSIONS.SUBSCRIPTION_MANAGE), async (req, res) => {
  try {
    if (!req.user?.sellerId) {
      return res.status(400).json({ message: "seller context missing" });
    }

    const requestedPlanCode = String(req.body?.requestedPlanCode || "").trim().toUpperCase();
    const note = String(req.body?.note || "").trim() || null;

    if (!requestedPlanCode) {
      return res.status(400).json({ message: "requestedPlanCode is required" });
    }

    const planResult = await pool.query(
      `SELECT id, plan_code, plan_name, is_demo_plan, is_active
       FROM plans
       WHERE UPPER(plan_code) = UPPER($1)
       LIMIT 1`,
      [requestedPlanCode]
    );

    if (planResult.rowCount === 0 || !planResult.rows[0].is_active) {
      return res.status(404).json({ message: "Requested plan not found" });
    }

    if (planResult.rows[0].is_demo_plan) {
      return res.status(400).json({ message: "Please choose a paid plan for upgrade" });
    }

    await pool.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        req.user.id,
        req.user.sellerId,
        "seller_upgrade_requested",
        JSON.stringify({
          sellerId: req.user.sellerId,
          requestedPlanCode: planResult.rows[0].plan_code,
          requestedPlanName: planResult.rows[0].plan_name,
          currentPlan: req.user.subscriptionPlan || null,
          note
        })
      ]
    );

    return res.status(201).json({
      message: `Upgrade request sent for ${planResult.rows[0].plan_name}.`,
      requestedPlan: planResult.rows[0]
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/usage/overview", requirePermission(PERMISSIONS.REPORTS_VIEW), requirePlatformAdmin, async (_req, res) => {
  try {
    const sellersCount = await pool.query(`SELECT COUNT(*)::int AS count FROM sellers`);
    const activeUsers = await pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE status = TRUE AND locked = FALSE`);
    const ordersCount = await pool.query(`SELECT COUNT(*)::int AS count FROM quotations`);

    return res.json({
      sellersOnboarded: sellersCount.rows[0].count,
      activeUsers: activeUsers.rows[0].count,
      totalOrders: ordersCount.rows[0].count
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch("/:id/lifecycle", requirePermission(PERMISSIONS.SELLER_EDIT), requirePlatformAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      status,
      trialEndsAt,
      subscriptionPlan,
      maxUsers,
      maxOrdersPerMonth,
      isLocked,
      onboardingStatus,
      sellerType
    } = req.body;

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE sellers
       SET status = COALESCE($1, status),
           trial_ends_at = COALESCE($2, trial_ends_at),
           subscription_plan = COALESCE($3, subscription_plan),
           max_users = COALESCE($4, max_users),
           max_orders_per_month = COALESCE($5, max_orders_per_month),
           is_locked = COALESCE($6, is_locked),
           onboarding_status = COALESCE($7, onboarding_status),
           seller_type = CASE
             WHEN seller_type = 'ADVANCED' THEN 'ADVANCED'
             WHEN COALESCE($8, seller_type) = 'ADVANCED' THEN 'ADVANCED'
             ELSE 'BASIC'
           END
       WHERE id = $9
       RETURNING *`,
      [
        status || null,
        trialEndsAt || null,
        subscriptionPlan || null,
        maxUsers !== undefined && maxUsers !== null && maxUsers !== "" ? Number(maxUsers) : null,
        maxOrdersPerMonth !== undefined && maxOrdersPerMonth !== null && maxOrdersPerMonth !== "" ? Number(maxOrdersPerMonth) : null,
        isLocked !== undefined ? Boolean(isLocked) : null,
        onboardingStatus || null,
        sellerType ? normalizeSellerType(sellerType) : null,
        Number(id)
      ]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Seller not found" });
    }

    if (subscriptionPlan) {
      const planResult = await client.query(
        `SELECT id, plan_code
         FROM plans
         WHERE UPPER(plan_code) = UPPER($1)
         LIMIT 1`,
        [subscriptionPlan]
      );

      if (planResult.rowCount > 0) {
        const existingSubscription = await client.query(
          `SELECT id
           FROM subscriptions
           WHERE seller_id = $1
           ORDER BY
             CASE
               WHEN status = 'active' THEN 1
               WHEN status = 'trial' THEN 2
               WHEN status = 'suspended' THEN 3
               WHEN status = 'expired' THEN 4
               WHEN status = 'cancelled' THEN 5
               ELSE 6
             END,
             COALESCE(updated_at, created_at) DESC,
             id DESC
           LIMIT 1`,
          [Number(id)]
        );

        if (existingSubscription.rowCount === 0) {
          await client.query(
            `INSERT INTO subscriptions
             (seller_id, plan_id, status, start_date, trial_start_at, trial_end_at, auto_assigned, created_by, updated_by)
             VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_TIMESTAMP, $4, FALSE, $5, $5)`,
            [
              Number(id),
              planResult.rows[0].id,
              subscriptionPlan.toUpperCase() === "DEMO" ? "trial" : (status === "active" ? "active" : "trial"),
              trialEndsAt || null,
              req.user.id
            ]
          );
        } else {
          await client.query(
            `UPDATE subscriptions
             SET plan_id = $1,
                 trial_end_at = COALESCE($2, trial_end_at),
                 updated_by = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4`,
            [
              planResult.rows[0].id,
              trialEndsAt || null,
              req.user.id,
              Number(existingSubscription.rows[0].id)
            ]
          );
        }
      }
    }

    await syncSellerSubscriptionCache(client, Number(id));

    await pool.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        req.user.id,
        Number(id),
        "seller_lifecycle_updated",
        JSON.stringify({
          sellerId: Number(id),
          status: result.rows[0].status,
          onboardingStatus: result.rows[0].onboarding_status,
          subscriptionPlan: result.rows[0].subscription_plan,
          trialEndsAt: result.rows[0].trial_ends_at,
          maxUsers: result.rows[0].max_users,
          maxOrdersPerMonth: result.rows[0].max_orders_per_month,
          isLocked: result.rows[0].is_locked,
          sellerType: normalizeSellerType(result.rows[0].seller_type)
        })
      ]
    );

    await client.query("COMMIT");
    return res.json({ seller: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
