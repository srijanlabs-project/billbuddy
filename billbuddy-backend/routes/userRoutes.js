const express = require("express");
const pool = require("../db/db");
const { getTenantId } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");
const { hashPassword, validatePasswordStrength } = require("../utils/passwords");

const router = express.Router();

router.get("/", requirePermission(PERMISSIONS.USER_VIEW), async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const values = [];
    const where = tenantId ? "WHERE u.seller_id = $1" : "";
    if (tenantId) values.push(tenantId);

    const result = await pool.query(
      `SELECT u.id, u.name, u.mobile, u.status, u.locked, u.created_by, u.created_at, u.seller_id, u.is_platform_admin, r.role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ${where}
       ORDER BY u.id DESC`,
      values
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", requirePermission(PERMISSIONS.USER_CREATE), async (req, res) => {
  try {
    const { name, mobile, password, roleId, createdBy, status = true, sellerId } = req.body;

    if (!name || !mobile || !roleId) {
      return res.status(400).json({ message: "name, mobile and roleId are required" });
    }
    if (!password) {
      return res.status(400).json({ message: "password is required" });
    }
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    const tenantId = req.user.isPlatformAdmin ? Number(sellerId || getTenantId(req)) : getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const result = await pool.query(
      `INSERT INTO users (name, mobile, password, role_id, created_by, status, seller_id, is_platform_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
       RETURNING id, name, mobile, role_id, created_by, status, created_at, seller_id`,
      [name, mobile, await hashPassword(password), roleId, createdBy || req.user.id, status, tenantId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Mobile already exists" });
    }
    res.status(500).json({ message: error.message });
  }
});

router.patch("/:id/lock", requirePermission(PERMISSIONS.USER_EDIT), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { locked } = req.body;

    if (!req.user.isPlatformAdmin && !tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const values = [Boolean(locked), Number(id)];
    let where = "id = $2";
    if (tenantId) {
      where += " AND seller_id = $3";
      values.push(tenantId);
    }

    const result = await pool.query(
      `UPDATE users SET locked = $1 WHERE ${where} RETURNING id, name, locked`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/:id/reset-password", requirePermission(PERMISSIONS.USER_EDIT), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const newPassword = String(req.body?.newPassword || "");

    if (!req.user.isPlatformAdmin && !tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }
    if (!newPassword) {
      return res.status(400).json({ message: "newPassword is required" });
    }
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ message: passwordValidation.message });
    }

    const hashedNewPassword = await hashPassword(newPassword);
    const values = [hashedNewPassword, Number(id)];
    let where = "id = $2";

    if (!req.user.isPlatformAdmin && tenantId) {
      where += " AND seller_id = $3";
      values.push(tenantId);
    }

    const result = await pool.query(
      `UPDATE users
       SET password = $1,
           failed_login_attempts = 0,
           last_failed_login_at = NULL,
           locked_until = NULL,
           force_password_change = FALSE,
           password_changed_at = CURRENT_TIMESTAMP
       WHERE ${where}
       RETURNING id, name, mobile, seller_id`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetUser = result.rows[0];
    await pool.query(
      `UPDATE user_sessions
       SET revoked = TRUE
       WHERE user_id = $1`,
      [resetUser.id]
    );
    await pool.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        req.user.id,
        resetUser.seller_id || null,
        "user_password_reset",
        JSON.stringify({
          targetUserId: resetUser.id,
          targetUserName: resetUser.name,
          targetUserMobile: resetUser.mobile,
          targetSellerId: resetUser.seller_id || null
        })
      ]
    );

    return res.json({
      user: resetUser,
      message: "Password updated successfully."
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
