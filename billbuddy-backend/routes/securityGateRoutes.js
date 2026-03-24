const express = require("express");
const pool = require("../db/db");
const { requirePlatformAdmin } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");

const router = express.Router();

const VALID_STATUS = new Set(["pass", "partial", "fail", "unknown"]);
const VALID_PRIORITY = new Set(["blocker", "high", "medium", "low"]);

function normalizeStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (VALID_STATUS.has(normalized)) return normalized;
  return null;
}

function normalizePriority(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (VALID_PRIORITY.has(normalized)) return normalized;
  return null;
}

router.get("/", requirePermission(PERMISSIONS.REPORTS_VIEW), requirePlatformAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, gate_key, category, control_name, priority, status, owner_name, target_date,
              notes, evidence_link, updated_by_user_id, created_at, updated_at
       FROM security_go_live_gates
       ORDER BY
         CASE priority
           WHEN 'blocker' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           ELSE 4
         END,
         category ASC,
         id ASC`
    );
    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch("/:id", requirePermission(PERMISSIONS.REPORTS_VIEW), requirePlatformAdmin, async (req, res) => {
  try {
    const gateId = Number(req.params.id);
    if (!Number.isInteger(gateId) || gateId <= 0) {
      return res.status(400).json({ message: "Valid gate id is required" });
    }

    const {
      status,
      priority,
      ownerName,
      targetDate,
      notes,
      evidenceLink
    } = req.body || {};

    const normalizedStatus = normalizeStatus(status);
    const normalizedPriority = normalizePriority(priority);

    if (!normalizedStatus) {
      return res.status(400).json({ message: "status must be one of pass, partial, fail, unknown" });
    }
    if (!normalizedPriority) {
      return res.status(400).json({ message: "priority must be one of blocker, high, medium, low" });
    }

    const result = await pool.query(
      `UPDATE security_go_live_gates
       SET status = $1,
           priority = $2,
           owner_name = $3,
           target_date = $4,
           notes = $5,
           evidence_link = $6,
           updated_by_user_id = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING id, gate_key, category, control_name, priority, status, owner_name, target_date,
                 notes, evidence_link, updated_by_user_id, created_at, updated_at`,
      [
        normalizedStatus,
        normalizedPriority,
        ownerName ? String(ownerName).trim().slice(0, 120) : null,
        targetDate || null,
        notes ? String(notes).trim().slice(0, 2000) : null,
        evidenceLink ? String(evidenceLink).trim().slice(0, 500) : null,
        req.user.id,
        gateId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Gate record not found" });
    }

    return res.json({
      gate: result.rows[0],
      message: "Gate updated successfully."
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
