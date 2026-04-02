const express = require("express");
const pool = require("../db/db");
const { requirePlatformAdmin } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");

const router = express.Router();

const SCOPE = Object.freeze({
  GLOBAL: "GLOBAL",
  GLOBAL_ADVANCED: "GLOBAL_ADVANCED",
  SELLER_ADVANCED: "SELLER_ADVANCED"
});

function normalizeScope(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!Object.values(SCOPE).includes(normalized)) {
    throw new Error("targetScope must be GLOBAL, GLOBAL_ADVANCED, or SELLER_ADVANCED");
  }
  return normalized;
}

function normalizeFormulaKey(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!key) {
    throw new Error("formulaKey is required");
  }
  if (!/^[a-z_][a-z0-9_]*$/.test(key)) {
    throw new Error("formulaKey must start with a letter/underscore and use only letters, numbers, underscore");
  }
  return key.slice(0, 120);
}

function normalizeFormulaExpression(value) {
  const expression = String(value || "").trim();
  if (!expression) {
    throw new Error("formulaExpression is required");
  }
  return expression;
}

function normalizeDisplayOrder(value) {
  if (value === null || value === undefined || value === "") return 500;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 500;
  return Math.max(0, Math.round(parsed));
}

function normalizeUnitCode(value) {
  const unitCode = String(value || "").trim().toLowerCase();
  if (!unitCode) {
    throw new Error("unitCode is required");
  }
  if (!/^[a-z][a-z0-9_]{0,19}$/.test(unitCode)) {
    throw new Error("unitCode must be lowercase alphanumeric/underscore and start with a letter");
  }
  return unitCode;
}

function normalizeToMeterFactor(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("toMeterFactor must be a positive number");
  }
  return Number(numeric.toFixed(8));
}

async function assertAdvancedSeller(client, sellerId) {
  const result = await client.query(
    `SELECT id, name, seller_type
     FROM sellers
     WHERE id = $1
     LIMIT 1`,
    [sellerId]
  );
  if (!result.rowCount) {
    throw new Error("Selected seller not found");
  }
  const sellerType = String(result.rows[0].seller_type || "BASIC").trim().toUpperCase();
  if (sellerType !== "ADVANCED") {
    throw new Error("Specific seller formula can be assigned only to Advanced sellers");
  }
  return result.rows[0];
}

router.get("/", requirePermission(PERMISSIONS.SETTINGS_VIEW), requirePlatformAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT pfd.id,
              pfd.formula_key,
              pfd.label,
              pfd.definition_text,
              pfd.formula_expression,
              pfd.included_in_calculation,
              pfd.target_scope,
              pfd.target_seller_id,
              pfd.display_order,
              pfd.is_active,
              pfd.created_at,
              pfd.updated_at,
              s.name AS target_seller_name,
              s.seller_type AS target_seller_type
       FROM platform_formula_definitions pfd
       LEFT JOIN sellers s ON s.id = pfd.target_seller_id
       ORDER BY pfd.target_scope ASC, pfd.display_order ASC, pfd.id ASC`
    );
    return res.json({ formulas: result.rows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/", requirePermission(PERMISSIONS.SETTINGS_EDIT), requirePlatformAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const formulaKey = normalizeFormulaKey(req.body?.formulaKey);
    const label = String(req.body?.label || "").trim();
    const formulaExpression = normalizeFormulaExpression(req.body?.formulaExpression);
    const definitionText = String(req.body?.definitionText || "").trim() || null;
    const targetScope = normalizeScope(req.body?.targetScope || SCOPE.GLOBAL);
    const includedInCalculation = req.body?.includedInCalculation !== undefined ? Boolean(req.body.includedInCalculation) : true;
    const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true;
    const displayOrder = normalizeDisplayOrder(req.body?.displayOrder);

    if (!label) {
      return res.status(400).json({ message: "label is required" });
    }

    await client.query("BEGIN");

    let targetSellerId = null;
    if (targetScope === SCOPE.SELLER_ADVANCED) {
      const numericSellerId = Number(req.body?.targetSellerId);
      if (!Number.isFinite(numericSellerId) || numericSellerId <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "targetSellerId is required for SELLER_ADVANCED scope" });
      }
      await assertAdvancedSeller(client, numericSellerId);
      targetSellerId = numericSellerId;
    }

    const insertResult = await client.query(
      `INSERT INTO platform_formula_definitions
       (formula_key, label, definition_text, formula_expression, included_in_calculation, target_scope, target_seller_id, display_order, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING *`,
      [
        formulaKey,
        label,
        definitionText,
        formulaExpression,
        includedInCalculation,
        targetScope,
        targetSellerId,
        displayOrder,
        isActive,
        req.user.id
      ]
    );

    await client.query("COMMIT");
    return res.status(201).json({ formula: insertResult.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "Formula key already exists for this target scope" });
    }
    return res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.patch("/:id", requirePermission(PERMISSIONS.SETTINGS_EDIT), requirePlatformAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const formulaId = Number(req.params.id);
    if (!Number.isFinite(formulaId) || formulaId <= 0) {
      return res.status(400).json({ message: "Invalid formula id" });
    }

    const existing = await client.query(
      `SELECT *
       FROM platform_formula_definitions
       WHERE id = $1
       LIMIT 1`,
      [formulaId]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ message: "Formula not found" });
    }

    await client.query("BEGIN");

    const base = existing.rows[0];
    const formulaKey = req.body?.formulaKey !== undefined ? normalizeFormulaKey(req.body.formulaKey) : base.formula_key;
    const label = req.body?.label !== undefined ? String(req.body.label || "").trim() : base.label;
    const formulaExpression = req.body?.formulaExpression !== undefined ? normalizeFormulaExpression(req.body.formulaExpression) : base.formula_expression;
    const definitionText = req.body?.definitionText !== undefined ? (String(req.body.definitionText || "").trim() || null) : base.definition_text;
    const targetScope = req.body?.targetScope !== undefined ? normalizeScope(req.body.targetScope) : base.target_scope;
    const includedInCalculation = req.body?.includedInCalculation !== undefined ? Boolean(req.body.includedInCalculation) : Boolean(base.included_in_calculation);
    const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : Boolean(base.is_active);
    const displayOrder = req.body?.displayOrder !== undefined ? normalizeDisplayOrder(req.body.displayOrder) : normalizeDisplayOrder(base.display_order);

    if (!label) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "label is required" });
    }

    let targetSellerId = null;
    if (targetScope === SCOPE.SELLER_ADVANCED) {
      const numericSellerId = Number(req.body?.targetSellerId ?? base.target_seller_id);
      if (!Number.isFinite(numericSellerId) || numericSellerId <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: "targetSellerId is required for SELLER_ADVANCED scope" });
      }
      await assertAdvancedSeller(client, numericSellerId);
      targetSellerId = numericSellerId;
    }

    const updated = await client.query(
      `UPDATE platform_formula_definitions
       SET formula_key = $1,
           label = $2,
           definition_text = $3,
           formula_expression = $4,
           included_in_calculation = $5,
           target_scope = $6,
           target_seller_id = $7,
           display_order = $8,
           is_active = $9,
           updated_by = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [
        formulaKey,
        label,
        definitionText,
        formulaExpression,
        includedInCalculation,
        targetScope,
        targetSellerId,
        displayOrder,
        isActive,
        req.user.id,
        formulaId
      ]
    );

    await client.query("COMMIT");
    return res.json({ formula: updated.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "Formula key already exists for this target scope" });
    }
    return res.status(400).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.delete("/:id", requirePermission(PERMISSIONS.SETTINGS_EDIT), requirePlatformAdmin, async (req, res) => {
  try {
    const formulaId = Number(req.params.id);
    if (!Number.isFinite(formulaId) || formulaId <= 0) {
      return res.status(400).json({ message: "Invalid formula id" });
    }

    const deleted = await pool.query(
      `DELETE FROM platform_formula_definitions
       WHERE id = $1
       RETURNING id`,
      [formulaId]
    );

    if (!deleted.rowCount) {
      return res.status(404).json({ message: "Formula not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/unit-conversions", requirePermission(PERMISSIONS.SETTINGS_VIEW), requirePlatformAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id,
              unit_code,
              to_meter_factor,
              display_order,
              is_active,
              created_at,
              updated_at
       FROM platform_unit_conversions
       ORDER BY display_order ASC, unit_code ASC`
    );
    return res.json({ unitConversions: result.rows });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/unit-conversions", requirePermission(PERMISSIONS.SETTINGS_EDIT), requirePlatformAdmin, async (req, res) => {
  try {
    const unitCode = normalizeUnitCode(req.body?.unitCode);
    const toMeterFactor = normalizeToMeterFactor(req.body?.toMeterFactor);
    const displayOrder = normalizeDisplayOrder(req.body?.displayOrder);
    const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true;

    const result = await pool.query(
      `INSERT INTO platform_unit_conversions
       (unit_code, to_meter_factor, display_order, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING *`,
      [unitCode, toMeterFactor, displayOrder, isActive, req.user.id]
    );
    return res.status(201).json({ unitConversion: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Unit code already exists" });
    }
    return res.status(400).json({ message: error.message });
  }
});

router.patch("/unit-conversions/:id", requirePermission(PERMISSIONS.SETTINGS_EDIT), requirePlatformAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid unit conversion id" });
    }

    const existing = await pool.query(
      `SELECT *
       FROM platform_unit_conversions
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ message: "Unit conversion not found" });
    }

    const current = existing.rows[0];
    const unitCode = req.body?.unitCode !== undefined ? normalizeUnitCode(req.body.unitCode) : current.unit_code;
    const toMeterFactor = req.body?.toMeterFactor !== undefined ? normalizeToMeterFactor(req.body.toMeterFactor) : Number(current.to_meter_factor);
    const displayOrder = req.body?.displayOrder !== undefined ? normalizeDisplayOrder(req.body.displayOrder) : Number(current.display_order || 0);
    const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : Boolean(current.is_active);

    const updated = await pool.query(
      `UPDATE platform_unit_conversions
       SET unit_code = $1,
           to_meter_factor = $2,
           display_order = $3,
           is_active = $4,
           updated_by = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [unitCode, toMeterFactor, displayOrder, isActive, req.user.id, id]
    );
    return res.json({ unitConversion: updated.rows[0] });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Unit code already exists" });
    }
    return res.status(400).json({ message: error.message });
  }
});

router.delete("/unit-conversions/:id", requirePermission(PERMISSIONS.SETTINGS_EDIT), requirePlatformAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid unit conversion id" });
    }
    const deleted = await pool.query(
      `DELETE FROM platform_unit_conversions
       WHERE id = $1
       RETURNING id`,
      [id]
    );
    if (!deleted.rowCount) {
      return res.status(404).json({ message: "Unit conversion not found" });
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
