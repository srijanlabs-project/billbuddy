const pool = require("../db/db");
const { verifyAuthToken } = require("../utils/jwt");

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: "Authorization token is required" });
    }

    const decoded = verifyAuthToken(token);

    const sessionResult = await pool.query(
      `SELECT
         us.id,
         us.user_id,
       us.revoked,
       us.expires_at,
       u.status,
       u.locked,
       u.seller_id,
        u.is_platform_admin,
        s.status AS seller_status,
        s.is_locked AS seller_locked,
        s.subscription_plan,
        s.trial_ends_at
       FROM user_sessions us
       INNER JOIN users u ON u.id = us.user_id
       LEFT JOIN sellers s ON s.id = u.seller_id
       WHERE us.token_jti = $1`,
      [decoded.jti]
    );

    if (sessionResult.rowCount === 0) {
      return res.status(401).json({ message: "Invalid session" });
    }

    const session = sessionResult.rows[0];
    const sellerInactive = session.seller_status && String(session.seller_status).toLowerCase() !== "active";
    const enforceSellerLifecycle = !session.is_platform_admin;
    if (
      session.revoked ||
      !session.status ||
      session.locked ||
      (enforceSellerLifecycle && session.seller_locked) ||
      (enforceSellerLifecycle && sellerInactive) ||
      new Date(session.expires_at) < new Date()
    ) {
      return res.status(401).json({ message: "Session expired or revoked" });
    }

    await pool.query(
      `UPDATE user_sessions
       SET last_activity = CURRENT_TIMESTAMP
       WHERE token_jti = $1`,
      [decoded.jti]
    );

    req.user = {
      id: Number(decoded.sub),
      name: decoded.name,
      mobile: decoded.mobile,
      role: decoded.role,
      sellerId: session.seller_id,
      sellerStatus: session.seller_status || "active",
      sellerLocked: Boolean(session.seller_locked),
      subscriptionPlan: session.subscription_plan || "trial",
      trialEndsAt: session.trial_ends_at || null,
      isPlatformAdmin: Boolean(session.is_platform_admin),
      jti: decoded.jti,
      token
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function requirePlatformAdmin(req, res, next) {
  if (!req.user?.isPlatformAdmin) {
    return res.status(403).json({ message: "Platform admin access required" });
  }
  next();
}

function getTenantId(req) {
  if (req.user?.isPlatformAdmin) {
    const override = Number(req.query.sellerId || req.headers["x-seller-id"]);
    return Number.isFinite(override) && override > 0 ? override : null;
  }
  return req.user?.sellerId;
}

module.exports = {
  authenticate,
  requirePlatformAdmin,
  getTenantId
};
