const crypto = require("crypto");
const express = require("express");
const pool = require("../db/db");
const { signAuthToken, decodeToken } = require("../utils/jwt");

const router = express.Router();
const FIXED_OTP = process.env.MOBILE_FIXED_OTP || "1234";

async function createSessionToken(user) {
  const jti = crypto.randomUUID();
  const token = signAuthToken(
    {
      sub: String(user.id),
      name: user.name,
      mobile: user.mobile,
      role: user.role_name || "Unknown",
      sellerId: user.seller_id,
      isPlatformAdmin: Boolean(user.is_platform_admin)
    },
    jti
  );

  const decoded = decodeToken(token);
  const expiresAt = decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 8 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO user_sessions (user_id, token_jti, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, jti, expiresAt]
  );

  return token;
}

async function logMobileAudit({ sellerId, userId, actionKey, detail = {} }) {
  await pool.query(
    `INSERT INTO mobile_audit_logs (seller_id, user_id, action_key, detail)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [sellerId || null, userId || null, actionKey, JSON.stringify(detail)]
  );
}

router.post("/login", async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({ message: "mobile and otp are required" });
    }

    if (String(otp) !== String(FIXED_OTP)) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.mobile, u.status, u.locked, u.seller_id, u.is_platform_admin, r.role_name,
              s.name AS seller_name, s.status AS seller_status, s.is_locked AS seller_locked
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN sellers s ON s.id = u.seller_id
       WHERE u.mobile = $1`,
      [mobile]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];
    if (!user.status || user.locked) {
      return res.status(403).json({ message: "User is inactive or locked" });
    }

    const sellerInactive = user.seller_status && String(user.seller_status).toLowerCase() !== "active";
    if (!user.is_platform_admin && (user.seller_locked || sellerInactive)) {
      return res.status(403).json({ message: "Seller account is inactive or locked" });
    }

    const token = await createSessionToken(user);
    await logMobileAudit({
      sellerId: user.seller_id,
      userId: user.id,
      actionKey: "mobile_login",
      detail: { mobile }
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        role: user.role_name,
        sellerId: user.seller_id,
        isPlatformAdmin: Boolean(user.is_platform_admin)
      },
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
