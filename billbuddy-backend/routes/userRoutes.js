const express = require("express");
const crypto = require("crypto");
const pool = require("../db/db");
const { getTenantId } = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
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

router.post("/", async (req, res) => {
  try {
    const { name, mobile, password, roleId, createdBy, status = true, sellerId } = req.body;

    if (!name || !mobile || !roleId) {
      return res.status(400).json({ message: "name, mobile and roleId are required" });
    }

    const tenantId = req.user.isPlatformAdmin ? Number(sellerId || getTenantId(req)) : getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const result = await pool.query(
      `INSERT INTO users (name, mobile, password, role_id, created_by, status, seller_id, is_platform_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
       RETURNING id, name, mobile, role_id, created_by, status, created_at, seller_id`,
      [name, mobile, password || null, roleId, createdBy || req.user.id, status, tenantId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Mobile already exists" });
    }
    res.status(500).json({ message: error.message });
  }
});

router.patch("/:id/lock", async (req, res) => {
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

router.patch("/:id/reset-password", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    if (!req.user.isPlatformAdmin && !tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    const temporaryPassword = crypto.randomBytes(4).toString("hex").toUpperCase();
    const values = [temporaryPassword, Number(id)];
    let where = "id = $2";

    if (!req.user.isPlatformAdmin && tenantId) {
      where += " AND seller_id = $3";
      values.push(tenantId);
    }

    const result = await pool.query(
      `UPDATE users
       SET password = $1
       WHERE ${where}
       RETURNING id, name, mobile, seller_id`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetUser = result.rows[0];
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
      temporaryPassword
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
