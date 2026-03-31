const express = require("express");
const pool = require("../db/db");
const { getTenantId } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");
const { hashPassword, validatePasswordStrength } = require("../utils/passwords");

const router = express.Router();

function normalizeMobile(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function validateMobile(value) {
  const normalized = normalizeMobile(value);
  if (!normalized) {
    return { valid: false, normalized, message: "Mobile number is required" };
  }
  if (!/^\+?[0-9]+$/.test(normalized)) {
    return { valid: false, normalized, message: "Mobile must contain only digits and an optional leading +" };
  }
  if (normalized.length > 15) {
    return { valid: false, normalized, message: "Mobile number must be 15 characters or fewer" };
  }
  return { valid: true, normalized };
}

function normalizeApprovalMode(value) {
  const normalized = String(value || "requester").trim().toLowerCase();
  if (["requester", "approver", "both"].includes(normalized)) {
    return normalized;
  }
  return "requester";
}

function normalizeRequesterIds(value) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry) && entry > 0))];
}

router.get("/", requirePermission(PERMISSIONS.USER_VIEW), async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const values = [];
    const where = tenantId ? "WHERE u.seller_id = $1" : "";
    if (tenantId) values.push(tenantId);

    const result = await pool.query(
      `SELECT u.id, u.name, u.mobile, u.status, u.locked, u.created_by, u.created_at, u.seller_id, u.is_platform_admin, u.role_id, r.role_name,
              u.approval_mode, u.approval_limit_amount, u.can_approve_quotations, u.can_approve_price_exception, u.approval_priority
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ${where}
       ORDER BY u.id DESC`,
      values
    );
    const users = result.rows;

    const mappingResult = tenantId
      ? await pool.query(
        `SELECT uam.requester_user_id, uam.approver_user_id, approver.name AS approver_name, requester.name AS requester_name
         FROM user_approval_mappings uam
         INNER JOIN users approver ON approver.id = uam.approver_user_id
         INNER JOIN users requester ON requester.id = uam.requester_user_id
         WHERE uam.seller_id = $1 AND uam.is_active = TRUE`,
        [tenantId]
      )
      : { rows: [] };

    const approverByRequester = new Map();
    const requesterMapByApprover = new Map();

    mappingResult.rows.forEach((row) => {
      approverByRequester.set(Number(row.requester_user_id), {
        id: Number(row.approver_user_id),
        name: row.approver_name || "-"
      });

      const bucket = requesterMapByApprover.get(Number(row.approver_user_id)) || [];
      bucket.push({
        id: Number(row.requester_user_id),
        name: row.requester_name || "-"
      });
      requesterMapByApprover.set(Number(row.approver_user_id), bucket);
    });

    res.json(
      users.map((user) => ({
        ...user,
        approval_mode: user.approval_mode || "requester",
        approval_limit_amount: Number(user.approval_limit_amount || 0),
        can_approve_quotations: Boolean(user.can_approve_quotations),
        can_approve_price_exception: Boolean(user.can_approve_price_exception),
        assigned_approver: approverByRequester.get(Number(user.id)) || null,
        assigned_requesters: requesterMapByApprover.get(Number(user.id)) || []
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", requirePermission(PERMISSIONS.USER_CREATE), async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      name,
      mobile,
      password,
      roleId,
      createdBy,
      status = true,
      sellerId,
      approvalMode,
      approvalLimitAmount,
      canApproveQuotations = false,
      canApprovePriceException = false,
      approverUserId,
      requesterUserIds = []
    } = req.body;

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

    const mobileValidation = validateMobile(mobile);
    if (!mobileValidation.valid) {
      return res.status(400).json({ message: mobileValidation.message, field: "mobile" });
    }

    const tenantId = req.user.isPlatformAdmin ? Number(sellerId || getTenantId(req)) : getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const normalizedApprovalMode = normalizeApprovalMode(approvalMode);
    const normalizedApproverUserId = approverUserId ? Number(approverUserId) : null;
    const normalizedRequesterUserIds = normalizeRequesterIds(requesterUserIds);
    const numericApprovalLimitAmount = Number(approvalLimitAmount || 0);

    if ((normalizedApprovalMode === "requester" || normalizedApprovalMode === "both") && !normalizedApproverUserId) {
      return res.status(400).json({ message: "Approver is required for requester and both approval roles" });
    }

    await client.query("BEGIN");

    const existingSellerUser = await client.query(
      `SELECT id
       FROM users
       WHERE seller_id = $1
         AND mobile = $2
       LIMIT 1`,
      [tenantId, mobileValidation.normalized]
    );
    if (existingSellerUser.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "Mobile number already exists in this seller account",
        field: "mobile"
      });
    }

    if (normalizedApproverUserId) {
      const approverCheck = await client.query(
        `SELECT id, approval_mode, status
         FROM users
         WHERE id = $1 AND seller_id = $2
         LIMIT 1`,
        [normalizedApproverUserId, tenantId]
      );
      const approver = approverCheck.rows[0];
      if (!approver) {
        throw new Error("Selected approver was not found for this seller");
      }
      if (!approver.status) {
        throw new Error("Selected approver is inactive");
      }
      if (!["approver", "both"].includes(String(approver.approval_mode || "").toLowerCase())) {
        throw new Error("Selected approver is not configured as approver or both");
      }
    }

    if (normalizedRequesterUserIds.length > 0) {
      const requesterCheck = await client.query(
        `SELECT id, approval_mode
         FROM users
         WHERE seller_id = $1 AND id = ANY($2::int[])`,
        [tenantId, normalizedRequesterUserIds]
      );
      if (requesterCheck.rowCount !== normalizedRequesterUserIds.length) {
        throw new Error("One or more selected requesters were not found for this seller");
      }
      const invalidRequester = requesterCheck.rows.find((row) => !["requester", "both"].includes(String(row.approval_mode || "").toLowerCase()));
      if (invalidRequester) {
        throw new Error("Only requester or both-type users can be assigned as requesters");
      }
    }

    const result = await client.query(
      `INSERT INTO users (name, mobile, password, role_id, created_by, status, seller_id, is_platform_admin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
       RETURNING id`,
      [String(name).trim(), mobileValidation.normalized, await hashPassword(password), roleId, createdBy || req.user.id, status, tenantId]
    );
    const createdUserId = result.rows[0].id;

    await client.query(
      `UPDATE users
       SET approval_mode = $1,
           approval_limit_amount = $2,
           can_approve_quotations = $3,
           can_approve_price_exception = $4
       WHERE id = $5`,
      [
        normalizedApprovalMode,
        Number.isFinite(numericApprovalLimitAmount) ? numericApprovalLimitAmount : 0,
        Boolean(canApproveQuotations),
        Boolean(canApprovePriceException),
        createdUserId
      ]
    );

    if (normalizedApprovalMode === "requester" || normalizedApprovalMode === "both") {
      await client.query(
        `INSERT INTO user_approval_mappings (seller_id, requester_user_id, approver_user_id, created_by_user_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (requester_user_id, approver_user_id) DO UPDATE
         SET is_active = TRUE,
             updated_at = CURRENT_TIMESTAMP`,
        [tenantId, createdUserId, normalizedApproverUserId, req.user.id]
      );
    }

    if (normalizedApprovalMode === "approver" || normalizedApprovalMode === "both") {
      for (const requesterId of normalizedRequesterUserIds) {
        await client.query(
          `UPDATE user_approval_mappings
           SET is_active = FALSE,
               updated_at = CURRENT_TIMESTAMP
           WHERE seller_id = $1 AND requester_user_id = $2`,
          [tenantId, requesterId]
        );
        await client.query(
          `INSERT INTO user_approval_mappings (seller_id, requester_user_id, approver_user_id, created_by_user_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (requester_user_id, approver_user_id) DO UPDATE
           SET is_active = TRUE,
               updated_at = CURRENT_TIMESTAMP`,
          [tenantId, requesterId, createdUserId, req.user.id]
        );
      }
    }

    await client.query("COMMIT");

    const createdUserResult = await pool.query(
      `SELECT u.id, u.name, u.mobile, u.status, u.locked, u.created_by, u.created_at, u.seller_id, u.is_platform_admin, r.role_name,
              u.approval_mode, u.approval_limit_amount, u.can_approve_quotations, u.can_approve_price_exception, u.approval_priority
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1
       LIMIT 1`,
      [createdUserId]
    );

    res.status(201).json(createdUserResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") {
      return res.status(409).json({ message: "Mobile number already exists", field: "mobile" });
    }
    res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.patch("/:id", requirePermission(PERMISSIONS.USER_EDIT), async (req, res) => {
  const client = await pool.connect();
  try {
    const tenantId = getTenantId(req);
    const targetUserId = Number(req.params.id);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ message: "Valid user id is required" });
    }

    const {
      name,
      roleId,
      status,
      approvalMode,
      approvalLimitAmount,
      canApproveQuotations = false,
      canApprovePriceException = false,
      approverUserId,
      requesterUserIds = []
    } = req.body || {};

    if (!name || !roleId) {
      return res.status(400).json({ message: "name and roleId are required" });
    }
    if (!req.user.isPlatformAdmin && !tenantId) {
      return res.status(403).json({ message: "Access denied" });
    }

    await client.query("BEGIN");

    const scopedUserResult = await client.query(
      req.user.isPlatformAdmin
        ? `SELECT id, seller_id, is_platform_admin
           FROM users
           WHERE id = $1
           LIMIT 1`
        : `SELECT id, seller_id, is_platform_admin
           FROM users
           WHERE id = $1 AND seller_id = $2
           LIMIT 1`,
      req.user.isPlatformAdmin ? [targetUserId] : [targetUserId, tenantId]
    );

    if (scopedUserResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    const targetUser = scopedUserResult.rows[0];
    if (!req.user.isPlatformAdmin && targetUser.is_platform_admin) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Platform users cannot be edited by seller users" });
    }

    const effectiveSellerId = Number(targetUser.seller_id || 0);
    const normalizedApprovalMode = normalizeApprovalMode(approvalMode);
    const normalizedApproverUserId = approverUserId ? Number(approverUserId) : null;
    const normalizedRequesterUserIds = normalizeRequesterIds(requesterUserIds).filter((entry) => entry !== targetUserId);
    const numericApprovalLimitAmount = Number(approvalLimitAmount || 0);

    if ((normalizedApprovalMode === "requester" || normalizedApprovalMode === "both") && !normalizedApproverUserId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Approver is required for requester and both approval roles" });
    }
    if (normalizedApproverUserId && normalizedApproverUserId === targetUserId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "A user cannot be their own approver" });
    }

    if (normalizedApproverUserId) {
      const approverCheck = await client.query(
        `SELECT id, approval_mode, status
         FROM users
         WHERE id = $1 AND seller_id = $2
         LIMIT 1`,
        [normalizedApproverUserId, effectiveSellerId]
      );
      const approver = approverCheck.rows[0];
      if (!approver) {
        throw new Error("Selected approver was not found for this seller");
      }
      if (!approver.status) {
        throw new Error("Selected approver is inactive");
      }
      if (!["approver", "both"].includes(String(approver.approval_mode || "").toLowerCase())) {
        throw new Error("Selected approver is not configured as approver or both");
      }
    }

    if (normalizedRequesterUserIds.length > 0) {
      const requesterCheck = await client.query(
        `SELECT id, approval_mode
         FROM users
         WHERE seller_id = $1 AND id = ANY($2::int[])`,
        [effectiveSellerId, normalizedRequesterUserIds]
      );
      if (requesterCheck.rowCount !== normalizedRequesterUserIds.length) {
        throw new Error("One or more selected requesters were not found for this seller");
      }
      const invalidRequester = requesterCheck.rows.find((row) => !["requester", "both"].includes(String(row.approval_mode || "").toLowerCase()));
      if (invalidRequester) {
        throw new Error("Only requester or both-type users can be assigned as requesters");
      }
    }

    const updatedUser = await client.query(
      `UPDATE users
       SET name = $1,
           role_id = $2,
           status = $3,
           approval_mode = $4,
           approval_limit_amount = $5,
           can_approve_quotations = $6,
           can_approve_price_exception = $7
       WHERE id = $8
       RETURNING id, name, mobile, status, seller_id`,
      [
        String(name).trim(),
        Number(roleId),
        Boolean(status),
        normalizedApprovalMode,
        Number.isFinite(numericApprovalLimitAmount) ? numericApprovalLimitAmount : 0,
        Boolean(canApproveQuotations),
        Boolean(canApprovePriceException),
        targetUserId
      ]
    );

    await client.query(
      `UPDATE user_approval_mappings
       SET is_active = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE seller_id = $1 AND requester_user_id = $2`,
      [effectiveSellerId, targetUserId]
    );

    if (normalizedApprovalMode === "requester" || normalizedApprovalMode === "both") {
      await client.query(
        `INSERT INTO user_approval_mappings (seller_id, requester_user_id, approver_user_id, created_by_user_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (requester_user_id, approver_user_id) DO UPDATE
         SET is_active = TRUE,
             updated_at = CURRENT_TIMESTAMP`,
        [effectiveSellerId, targetUserId, normalizedApproverUserId, req.user.id]
      );
    }

    await client.query(
      `UPDATE user_approval_mappings
       SET is_active = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE seller_id = $1 AND approver_user_id = $2`,
      [effectiveSellerId, targetUserId]
    );

    if (normalizedApprovalMode === "approver" || normalizedApprovalMode === "both") {
      for (const requesterId of normalizedRequesterUserIds) {
        await client.query(
          `INSERT INTO user_approval_mappings (seller_id, requester_user_id, approver_user_id, created_by_user_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (requester_user_id, approver_user_id) DO UPDATE
           SET is_active = TRUE,
               updated_at = CURRENT_TIMESTAMP`,
          [effectiveSellerId, requesterId, targetUserId, req.user.id]
        );
      }
    }

    await client.query("COMMIT");

    return res.json({
      user: updatedUser.rows[0],
      message: "User updated successfully."
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "23505") {
      return res.status(409).json({ message: "Mobile already exists" });
    }
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
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
