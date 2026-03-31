const crypto = require("crypto");
const express = require("express");
const pool = require("../db/db");
const {
  signAuthToken,
  decodeToken,
  DEFAULT_JWT_EXPIRES_IN,
  REMEMBER_ME_JWT_EXPIRES_IN
} = require("../utils/jwt");
const { authenticate } = require("../middleware/auth");
const { getAccessScope, normalizeRoleName } = require("../rbac/permissions");
const { getEffectivePermissionsForUser } = require("../services/rbacService");
const { seedSellerOnboardingWorkspace } = require("../services/onboardingTemplateService");
const { hashPassword, verifyPassword, isHashedPassword, validatePasswordStrength } = require("../utils/passwords");

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MINUTES = 15;

const router = express.Router();
const ROLE_NAMES = [
  "Super Admin",
  "Sales",
  "Seller Admin",
  "Seller User",
  "Demo User",
  "Master User",
  "Sub User",
  "Customer",
  "Admin"
];

async function seedRolesIfMissing() {
  for (const roleName of ROLE_NAMES) {
    await pool.query(
      `INSERT INTO roles (role_name)
       VALUES ($1)
       ON CONFLICT (role_name) DO NOTHING`,
      [roleName]
    );
  }
}

async function createSessionToken(user, clientOrPool = pool, options = {}) {
  const jti = crypto.randomUUID();
  const expiresIn = options.rememberMe ? REMEMBER_ME_JWT_EXPIRES_IN : DEFAULT_JWT_EXPIRES_IN;
  const token = signAuthToken(
    {
      sub: String(user.id),
      name: user.name,
      mobile: user.mobile,
      role: user.role_name || "Unknown",
      sellerId: user.seller_id,
      isPlatformAdmin: Boolean(user.is_platform_admin)
    },
    jti,
    expiresIn
  );

  const decoded = decodeToken(token);
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 8 * 60 * 60 * 1000);

  await clientOrPool.query(
    `INSERT INTO user_sessions (user_id, token_jti, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, jti, expiresAt]
  );

  return {
    token,
    expiresAt
  };
}

async function findRoleId(preferredNames) {
  const result = await pool.query(
    `SELECT id, role_name
     FROM roles
     WHERE role_name = ANY($1::text[])`,
    [preferredNames]
  );

  for (const roleName of preferredNames) {
    const found = result.rows.find((row) => row.role_name === roleName);
    if (found) return found.id;
  }
  return null;
}

function buildSellerCode(seedValue) {
  const normalized = String(seedValue || "DEMO")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18) || "DEMO";
  const suffix = String(Date.now()).slice(-6);
  return `${normalized}-${suffix}`.slice(0, 30);
}

async function buildAuthUserPayload(user) {
  const nextUser = {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    role: user.role_name || user.role || "Unknown",
    sellerId: user.seller_id ?? user.sellerId ?? null,
    isPlatformAdmin: Boolean(user.is_platform_admin ?? user.isPlatformAdmin),
    sellerType: String(user.seller_type || user.sellerType || "BASIC").toUpperCase() === "ADVANCED" ? "ADVANCED" : "BASIC"
  };

  return {
    ...nextUser,
    normalizedRole: normalizeRoleName(nextUser.role),
    accessScope: getAccessScope(nextUser),
    permissions: await getEffectivePermissionsForUser(nextUser, pool)
  };
}

router.get("/setup-status", async (_req, res) => {
  try {
    const usersCount = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
    return res.json({ bootstrapRequired: usersCount.rows[0].count === 0 });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/bootstrap-admin", async (req, res) => {
  try {
    const { name, mobile, password, sellerName = "Sai Laser" } = req.body;

    if (!name || !mobile || !password) {
      return res.status(400).json({ message: "name, mobile, and password are required" });
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    const usersCount = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
    if (usersCount.rows[0].count > 0) {
      return res.status(400).json({ message: "Users already exist. Use login." });
    }

    await seedRolesIfMissing();

    await pool.query(
      `INSERT INTO sellers (seller_code, name, onboarding_status)
       VALUES ('DEFAULT', $1, 'active')
       ON CONFLICT (seller_code) DO UPDATE SET name = EXCLUDED.name`,
      [sellerName]
    );

    const roleId = await findRoleId(["Super Admin", "Admin"]);

    const created = await pool.query(
      `INSERT INTO users (name, mobile, password, role_id, seller_id, is_platform_admin, status)
       VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
       RETURNING id, name, mobile, seller_id, is_platform_admin`,
      [name, mobile, await hashPassword(password), roleId, null]
    );

    return res.status(201).json({ message: "Platform admin created", user: created.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Mobile already exists" });
    }
    return res.status(500).json({ message: error.message });
  }
});

router.post("/demo-signup", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      name,
      mobile,
      password,
      email,
      businessName,
      city,
      state,
      businessCategory,
      businessSegment,
      wantsSampleData,
      headerImageData,
      logoImageData,
      brandingMode
    } = req.body || {};

    if (!name || !mobile || !password) {
      return res.status(400).json({ message: "name, mobile, and password are required" });
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    await seedRolesIfMissing();
    await client.query("BEGIN");

    const demoPlanResult = await client.query(
      `SELECT p.id, p.plan_code, p.plan_name, p.trial_enabled, p.trial_duration_days
       FROM plans p
       WHERE UPPER(p.plan_code) = 'DEMO' AND p.is_active = TRUE
       LIMIT 1`
    );

    if (demoPlanResult.rowCount === 0) {
      throw new Error("DEMO plan not found or inactive");
    }

    const existingUser = await client.query(
      `SELECT id FROM users WHERE mobile = $1 LIMIT 1`,
      [mobile]
    );
    if (existingUser.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Mobile already exists" });
    }

    const demoPlan = demoPlanResult.rows[0];
    const trialDays = Number(demoPlan.trial_duration_days || 14);
    const trialStartAt = new Date();
    const trialEndAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    const sellerCode = buildSellerCode(businessName || name || mobile);

    const sellerInsert = await client.query(
      `INSERT INTO sellers (
         name,
         business_name,
         mobile,
         email,
         city,
         state,
         business_category,
         business_segment,
         seller_code,
         onboarding_status,
         status,
         trial_ends_at,
         subscription_plan,
         theme_key,
         brand_primary_color
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'setup', 'active', $10, 'DEMO', 'matte-blue', '#2563eb')
       RETURNING *`,
      [
        String(name).trim(),
        String(businessName || name).trim(),
        String(mobile).trim(),
        String(email || "").trim() || null,
        String(city || "").trim() || null,
        String(state || "").trim() || null,
        String(businessCategory || "").trim() || null,
        String(businessSegment || "").trim() || null,
        sellerCode,
        trialEndAt
      ]
    );

    await client.query(
      `INSERT INTO subscriptions (
         seller_id,
         plan_id,
         status,
         start_date,
         trial_start_at,
         trial_end_at,
         auto_assigned
       )
       VALUES ($1, $2, 'trial', CURRENT_DATE, $3, $4, TRUE)`,
      [
        sellerInsert.rows[0].id,
        demoPlan.id,
        trialStartAt,
        trialEndAt
      ]
    );

    const featureResult = await client.query(
      `SELECT max_users, max_quotations
       FROM plan_features
       WHERE plan_id = $1
       LIMIT 1`,
      [demoPlan.id]
    );
    const demoFeatures = featureResult.rows[0] || {};

    await client.query(
      `UPDATE sellers
       SET max_users = COALESCE($1, max_users),
           max_orders_per_month = COALESCE($2, max_orders_per_month)
       WHERE id = $3`,
      [
        demoFeatures.max_users ?? null,
        demoFeatures.max_quotations ?? null,
        sellerInsert.rows[0].id
      ]
    );

    const demoRoleId = await findRoleId(["Admin", "Seller Admin", "Master User", "Demo User", "Seller User"]);
    const createdUser = await client.query(
      `INSERT INTO users (
         name,
         mobile,
         password,
         role_id,
         seller_id,
         is_platform_admin,
         status,
         locked,
         password_changed_at,
         approval_mode,
         approval_limit_amount,
         can_approve_quotations,
         can_approve_price_exception
       )
       VALUES ($1, $2, $3, $4, $5, FALSE, TRUE, FALSE, CURRENT_TIMESTAMP, 'both', $6, TRUE, TRUE)
       RETURNING id, name, mobile, seller_id, is_platform_admin`,
      [
        String(name).trim(),
        String(mobile).trim(),
        await hashPassword(String(password)),
        demoRoleId,
        sellerInsert.rows[0].id,
        99999999
      ]
    );

    const createdLead = await client.query(
      `INSERT INTO leads (
         name,
         mobile,
         email,
         business_name,
         city,
         business_type,
         business_segment,
         wants_sample_data,
         requirement,
         interested_in_demo,
         source,
         status,
         seller_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, 'self_demo_signup', 'demo_created', $10)
       RETURNING id`,
      [
        String(name).trim(),
        String(mobile).trim(),
        String(email || "").trim() || null,
        String(businessName || name).trim(),
        String(city || "").trim() || null,
        String(businessCategory || "").trim() || null,
        String(businessSegment || "").trim() || null,
        Boolean(wantsSampleData),
        "Self-signup demo account created.",
        sellerInsert.rows[0].id
      ]
    );

    await seedSellerOnboardingWorkspace(client, {
      sellerId: sellerInsert.rows[0].id,
      actorUserId: createdUser.rows[0].id,
      businessCategory,
      businessSegment,
      wantsSampleData: Boolean(wantsSampleData),
      headerImageData: brandingMode === "header" ? (headerImageData || null) : null,
      logoImageData: brandingMode === "logo" ? (logoImageData || null) : null,
      showHeaderImage: brandingMode === "header" && Boolean(headerImageData),
      showLogoOnly: brandingMode === "logo" && Boolean(logoImageData)
    });

    await client.query(
      `INSERT INTO lead_activity (lead_id, activity_type, note, actor_user_id)
       VALUES ($1, $2, $3, NULL)`,
      [
        createdLead.rows[0].id,
        "demo_self_signup",
        `Self demo signup created for seller ${sellerCode}.`
      ]
    );

    await client.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES (NULL, $1, $2, $3::jsonb)`,
      [
        sellerInsert.rows[0].id,
        "demo_self_signup_created",
        JSON.stringify({
          sellerId: sellerInsert.rows[0].id,
          sellerCode,
          planCode: demoPlan.plan_code,
          leadId: createdLead.rows[0].id
        })
      ]
    );

    const { token, expiresAt } = await createSessionToken({
      ...createdUser.rows[0],
      role_name: "Admin",
      seller_id: sellerInsert.rows[0].id,
      is_platform_admin: false
    }, client);

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Demo account created successfully.",
      token,
      expiresAt,
      user: await buildAuthUserPayload({
        ...createdUser.rows[0],
        role_name: "Admin",
        seller_id: sellerInsert.rows[0].id,
        is_platform_admin: false
      }),
      seller: sellerInsert.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "Demo account already exists for this mobile or business code" });
    }
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.post("/login", async (req, res) => {
  try {
    const { mobile, password, rememberMe = false } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({ message: "mobile and password are required" });
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.mobile, u.password, u.status, u.locked, u.seller_id, u.is_platform_admin,
              u.failed_login_attempts, u.locked_until,
              r.role_name,
              s.status AS seller_status, s.is_locked AS seller_locked, s.seller_type
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN sellers s ON s.id = u.seller_id
       WHERE u.mobile = $1`,
      [mobile]
    );

    if (result.rowCount === 0) {
      await pool.query(
        `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
         VALUES (NULL, NULL, 'login_failed_unknown_mobile', $1::jsonb)`,
        [
          JSON.stringify({
            mobile
          })
        ]
      );
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const lockedUntil = user.locked_until ? new Date(user.locked_until) : null;
    if (lockedUntil && lockedUntil > new Date()) {
      return res.status(429).json({ message: "Too many failed login attempts. Try again later." });
    }

    const passwordCheck = await verifyPassword(password, user.password);
    const validPassword = Boolean(user.password) && passwordCheck.valid;

    if (!validPassword) {
      const nextFailedAttempts = Number(user.failed_login_attempts || 0) + 1;
      const shouldLock = nextFailedAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
      const lockUntil = shouldLock
        ? new Date(Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000)
        : null;

      await pool.query(
        `UPDATE users
         SET failed_login_attempts = $1,
             last_failed_login_at = CURRENT_TIMESTAMP,
             locked_until = CASE WHEN $2::boolean THEN $3 ELSE NULL END
         WHERE id = $4`,
        [nextFailedAttempts, shouldLock, lockUntil, user.id]
      );

      await pool.query(
        `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
         VALUES (NULL, $1, 'login_failed', $2::jsonb)`,
        [
          user.seller_id || null,
          JSON.stringify({
            mobile,
            userId: user.id,
            failedLoginAttempts: nextFailedAttempts,
            lockedUntil: lockUntil ? lockUntil.toISOString() : null
          })
        ]
      );

      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (passwordCheck.legacy && !isHashedPassword(user.password)) {
      await pool.query(
        `UPDATE users
         SET password = $1
         WHERE id = $2`,
        [await hashPassword(password), user.id]
      );
    }

    if (!user.status || user.locked) {
      return res.status(403).json({ message: "User is inactive or locked" });
    }

    const sellerInactive = user.seller_status && String(user.seller_status).toLowerCase() !== "active";
    if (!user.is_platform_admin && (user.seller_locked || sellerInactive)) {
      return res.status(403).json({ message: "Seller account is inactive or locked" });
    }

    const { token, expiresAt } = await createSessionToken(user, pool, { rememberMe: Boolean(rememberMe) });

    await pool.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           last_failed_login_at = NULL,
           locked_until = NULL,
           last_login_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id]
    );

    await pool.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, $2, 'login_succeeded', $3::jsonb)`,
      [
        user.id,
        user.seller_id || null,
        JSON.stringify({
          userId: user.id,
          mobile: user.mobile,
          rememberMe: Boolean(rememberMe)
        })
      ]
    );

    res.json({
      token,
      expiresAt,
      user: await buildAuthUserPayload(user)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/me", authenticate, async (req, res) => {
  return res.json({ user: req.user });
});

router.post("/logout", authenticate, async (req, res) => {
  try {
    await pool.query(
      `UPDATE user_sessions SET revoked = TRUE WHERE token_jti = $1`,
      [req.user.jti]
    );

    await pool.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, $2, 'logout', $3::jsonb)`,
      [
        req.user.id,
        req.user.sellerId || null,
        JSON.stringify({
          userId: req.user.id,
          sessionJti: req.user.jti
        })
      ]
    );

    return res.json({ message: "Logged out" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
