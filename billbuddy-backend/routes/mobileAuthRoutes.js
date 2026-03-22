const crypto = require("crypto");
const express = require("express");
const pool = require("../db/db");
const {
  signAuthToken,
  decodeToken,
  DEFAULT_JWT_EXPIRES_IN,
  REMEMBER_ME_JWT_EXPIRES_IN
} = require("../utils/jwt");
const { getAccessScope, normalizeRoleName } = require("../rbac/permissions");
const { getEffectivePermissionsForUser } = require("../services/rbacService");

const router = express.Router();

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = Number(process.env.MOBILE_OTP_EXPIRY_MINUTES || 10);
const OTP_COOLDOWN_SECONDS = Number(process.env.MOBILE_OTP_COOLDOWN_SECONDS || 30);
const OTP_DEV_BYPASS = String(process.env.MOBILE_FIXED_OTP || "").trim();
const OTP_LOGIN_ENABLED = false;

function respondOtpDisabled(res) {
  return res.status(503).json({ message: "OTP login is temporarily disabled until final OTP integration is completed." });
}

function normalizeMobile(mobile) {
  return String(mobile || "").replace(/\D/g, "").slice(-10);
}

function generateOtp() {
  return String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

async function createSessionToken(user, options = {}) {
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

  await pool.query(
    `INSERT INTO user_sessions (user_id, token_jti, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, jti, expiresAt]
  );

  return {
    token,
    expiresAt
  };
}

async function logMobileAudit({ sellerId, userId, actionKey, detail = {} }) {
  await pool.query(
    `INSERT INTO mobile_audit_logs (seller_id, user_id, action_key, detail)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [sellerId || null, userId || null, actionKey, JSON.stringify(detail)]
  );
}

async function findLoginUser(mobile) {
  const normalizedMobile = normalizeMobile(mobile);
  return pool.query(
    `SELECT u.id, u.name, u.mobile, u.status, u.locked, u.seller_id, u.is_platform_admin, r.role_name,
            s.name AS seller_name, s.status AS seller_status, s.is_locked AS seller_locked
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     LEFT JOIN sellers s ON s.id = u.seller_id
     WHERE RIGHT(REGEXP_REPLACE(COALESCE(u.mobile, ''), '\\D', '', 'g'), 10) = $1`,
    [normalizedMobile]
  );
}

function validateUserForLogin(user) {
  if (!user) {
    return "User not found";
  }
  if (!user.status || user.locked) {
    return "User is inactive or locked";
  }

  const sellerInactive = user.seller_status && String(user.seller_status).toLowerCase() !== "active";
  if (!user.is_platform_admin && (user.seller_locked || sellerInactive)) {
    return "Seller account is inactive or locked";
  }

  return "";
}

async function buildAuthUserPayload(user) {
  const nextUser = {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    role: user.role_name || user.role || "Unknown",
    sellerId: user.seller_id ?? user.sellerId ?? null,
    isPlatformAdmin: Boolean(user.is_platform_admin ?? user.isPlatformAdmin)
  };

  return {
    ...nextUser,
    normalizedRole: normalizeRoleName(nextUser.role),
    accessScope: getAccessScope(nextUser),
    permissions: await getEffectivePermissionsForUser(nextUser, pool)
  };
}

async function sendOtpToMobile(mobile, otp) {
  const smsGatewayUrl = process.env.SMS_GATEWAY_URL;
  const smsGatewayApiKey = process.env.SMS_GATEWAY_API_KEY;

  if (smsGatewayUrl && smsGatewayApiKey) {
    // Provider integration can be wired here later.
    console.log(`[OTP] SMS gateway configured for ${mobile}, provider call placeholder reached.`);
  } else {
    console.log(`[OTP] ${mobile} -> ${otp}`);
  }
}

router.post("/request-otp", async (req, res) => {
  if (!OTP_LOGIN_ENABLED) {
    return respondOtpDisabled(res);
  }
  try {
    const mobile = normalizeMobile(req.body?.mobile);
    if (!mobile) {
      return res.status(400).json({ message: "mobile is required" });
    }

    const result = await findLoginUser(mobile);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];
    const loginError = validateUserForLogin(user);
    if (loginError) {
      return res.status(403).json({ message: loginError });
    }

    const recentOtp = await pool.query(
      `SELECT id, created_at
       FROM mobile_otp_codes
       WHERE mobile = $1
         AND verified_at IS NULL
         AND revoked = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [mobile]
    );

    if (recentOtp.rowCount > 0) {
      const secondsSinceLast = Math.floor((Date.now() - new Date(recentOtp.rows[0].created_at).getTime()) / 1000);
      if (secondsSinceLast < OTP_COOLDOWN_SECONDS) {
        return res.status(429).json({
          message: `Please wait ${OTP_COOLDOWN_SECONDS - secondsSinceLast}s before requesting another OTP`
        });
      }
    }

    await pool.query(
      `UPDATE mobile_otp_codes
       SET revoked = TRUE
       WHERE mobile = $1
         AND verified_at IS NULL
         AND revoked = FALSE`,
      [mobile]
    );

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await pool.query(
      `INSERT INTO mobile_otp_codes (user_id, seller_id, mobile, otp_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, user.seller_id || null, mobile, hashOtp(otp), expiresAt]
    );

    await sendOtpToMobile(mobile, otp);
    await logMobileAudit({
      sellerId: user.seller_id,
      userId: user.id,
      actionKey: "mobile_otp_requested",
      detail: { mobile }
    });

    const response = {
      message: `OTP sent successfully. It will expire in ${OTP_EXPIRY_MINUTES} minutes.`
    };

    if (process.env.NODE_ENV !== "production" || OTP_DEV_BYPASS) {
      response.devOtp = otp;
    }

    return res.json(response);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/login", async (req, res) => {
  if (!OTP_LOGIN_ENABLED) {
    return respondOtpDisabled(res);
  }
  try {
    const mobile = normalizeMobile(req.body?.mobile);
    const otp = String(req.body?.otp || "").trim();
    const rememberMe = Boolean(req.body?.rememberMe);

    if (!mobile || !otp) {
      return res.status(400).json({ message: "mobile and otp are required" });
    }

    const result = await findLoginUser(mobile);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];
    const loginError = validateUserForLogin(user);
    if (loginError) {
      return res.status(403).json({ message: loginError });
    }

    let matchedOtpRow = null;

    if (OTP_DEV_BYPASS && otp === OTP_DEV_BYPASS) {
      matchedOtpRow = { id: null };
    } else {
      const otpResult = await pool.query(
        `SELECT id, expires_at, attempts
         FROM mobile_otp_codes
         WHERE mobile = $1
           AND otp_hash = $2
           AND verified_at IS NULL
           AND revoked = FALSE
         ORDER BY created_at DESC
         LIMIT 1`,
        [mobile, hashOtp(otp)]
      );

      if (otpResult.rowCount === 0) {
        await pool.query(
          `UPDATE mobile_otp_codes
           SET attempts = attempts + 1
           WHERE mobile = $1
             AND verified_at IS NULL
             AND revoked = FALSE`,
          [mobile]
        );
        return res.status(401).json({ message: "Invalid OTP" });
      }

      matchedOtpRow = otpResult.rows[0];
      if (new Date(matchedOtpRow.expires_at).getTime() < Date.now()) {
        await pool.query(
          `UPDATE mobile_otp_codes
           SET revoked = TRUE
           WHERE id = $1`,
          [matchedOtpRow.id]
        );
        return res.status(401).json({ message: "OTP has expired. Please request a new one." });
      }

      await pool.query(
        `UPDATE mobile_otp_codes
         SET verified_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [matchedOtpRow.id]
      );
    }

    const { token, expiresAt } = await createSessionToken(user, { rememberMe });
    await logMobileAudit({
      sellerId: user.seller_id,
      userId: user.id,
      actionKey: "mobile_login",
      detail: { mobile, mode: "otp" }
    });

    return res.json({
      token,
      expiresAt,
      user: await buildAuthUserPayload(user),
      seller: {
        id: user.seller_id,
        name: user.seller_name || "Seller"
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
