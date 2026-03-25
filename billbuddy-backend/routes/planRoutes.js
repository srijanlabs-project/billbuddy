const express = require("express");
const pool = require("../db/db");
const { requirePlatformAdmin } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");

const router = express.Router();

function normalizePlanPayload(body = {}) {
  const rawTemplateTier = String(body.templateAccessTier || body.template_access_tier || "").trim().toUpperCase();
  const normalizedTemplateTier = ["FREE", "PAID", "PREMIUM", "NICHE"].includes(rawTemplateTier) ? rawTemplateTier : "";
  const rawAccessType = String(body.planAccessType || body.plan_access_type || "").trim().toUpperCase();

  return {
    planCode: String(body.planCode || body.plan_code || "").trim().toUpperCase(),
    planName: String(body.planName || body.plan_name || "").trim(),
    price: body.price !== undefined && body.price !== null && body.price !== "" ? Number(body.price) : 0,
    billingCycle: String(body.billingCycle || body.billing_cycle || "monthly").trim().toLowerCase(),
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    isDemoPlan: body.isDemoPlan !== undefined ? Boolean(body.isDemoPlan) : false,
    trialEnabled: body.trialEnabled !== undefined ? Boolean(body.trialEnabled) : false,
    trialDurationDays: body.trialDurationDays !== undefined && body.trialDurationDays !== null && body.trialDurationDays !== ""
      ? Number(body.trialDurationDays)
      : null,
    planAccessType: ["FREE", "PAID"].includes(rawAccessType)
      ? rawAccessType
      : (normalizedTemplateTier && normalizedTemplateTier !== "FREE" ? "PAID" : "FREE"),
    templateAccessTier: normalizedTemplateTier || (rawAccessType === "PAID" ? "PAID" : "FREE"),
    watermarkText: String(body.watermarkText || body.watermark_text || "").trim() || null,
    maxUsers: body.maxUsers !== undefined && body.maxUsers !== null && body.maxUsers !== "" ? Number(body.maxUsers) : null,
    maxQuotations: body.maxQuotations !== undefined && body.maxQuotations !== null && body.maxQuotations !== "" ? Number(body.maxQuotations) : null,
    maxCustomers: body.maxCustomers !== undefined && body.maxCustomers !== null && body.maxCustomers !== "" ? Number(body.maxCustomers) : null,
    inventoryEnabled: body.inventoryEnabled !== undefined ? Boolean(body.inventoryEnabled) : false,
    reportsEnabled: body.reportsEnabled !== undefined ? Boolean(body.reportsEnabled) : false,
    gstEnabled: body.gstEnabled !== undefined ? Boolean(body.gstEnabled) : false,
    exportsEnabled: body.exportsEnabled !== undefined ? Boolean(body.exportsEnabled) : false,
    quotationWatermarkEnabled: body.quotationWatermarkEnabled !== undefined ? Boolean(body.quotationWatermarkEnabled) : false,
    quotationCreationLockedAfterExpiry: body.quotationCreationLockedAfterExpiry !== undefined
      ? Boolean(body.quotationCreationLockedAfterExpiry)
      : true
  };
}

router.get("/", requirePermission(PERMISSIONS.PLAN_VIEW), async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         p.*,
         pf.max_users,
         pf.max_quotations,
         pf.max_customers,
         pf.inventory_enabled,
         pf.reports_enabled,
         pf.gst_enabled,
         pf.exports_enabled,
         pf.quotation_watermark_enabled,
         pf.quotation_creation_locked_after_expiry
       FROM plans p
       LEFT JOIN plan_features pf ON pf.plan_id = p.id
       ORDER BY p.is_demo_plan DESC, p.id DESC`
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.use(requirePlatformAdmin);

router.post("/", requirePermission(PERMISSIONS.PLAN_CREATE), async (req, res) => {
  const client = await pool.connect();

  try {
    const payload = normalizePlanPayload(req.body);
    if (!payload.planCode || !payload.planName) {
      return res.status(400).json({ message: "planCode and planName are required" });
    }

    await client.query("BEGIN");

    const planResult = await client.query(
      `INSERT INTO plans (
         plan_code, plan_name, price, billing_cycle, is_active, is_demo_plan, trial_enabled, trial_duration_days, plan_access_type, template_access_tier, watermark_text
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        payload.planCode,
        payload.planName,
        payload.price,
        payload.billingCycle,
        payload.isActive,
        payload.isDemoPlan,
        payload.trialEnabled,
        payload.trialDurationDays,
        payload.planAccessType,
        payload.templateAccessTier,
        payload.watermarkText
      ]
    );

    await client.query(
      `INSERT INTO plan_features (
         plan_id, max_users, max_quotations, max_customers, inventory_enabled, reports_enabled, gst_enabled, exports_enabled,
         quotation_watermark_enabled, quotation_creation_locked_after_expiry
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        planResult.rows[0].id,
        payload.maxUsers,
        payload.maxQuotations,
        payload.maxCustomers,
        payload.inventoryEnabled,
        payload.reportsEnabled,
        payload.gstEnabled,
        payload.exportsEnabled,
        payload.quotationWatermarkEnabled,
        payload.quotationCreationLockedAfterExpiry
      ]
    );

    await client.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, NULL, $2, $3::jsonb)`,
      [
        req.user.id,
        "plan_created",
        JSON.stringify({
          planId: planResult.rows[0].id,
          planCode: payload.planCode,
          planName: payload.planName
        })
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({ plan: { ...planResult.rows[0], ...{
      max_users: payload.maxUsers,
      max_quotations: payload.maxQuotations,
      max_customers: payload.maxCustomers,
      inventory_enabled: payload.inventoryEnabled,
      reports_enabled: payload.reportsEnabled,
      gst_enabled: payload.gstEnabled,
      exports_enabled: payload.exportsEnabled,
      quotation_watermark_enabled: payload.quotationWatermarkEnabled,
      quotation_creation_locked_after_expiry: payload.quotationCreationLockedAfterExpiry
    } } });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "Plan code already exists" });
    }
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.patch("/:id", requirePermission(PERMISSIONS.PLAN_EDIT), async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const payload = normalizePlanPayload(req.body);

    await client.query("BEGIN");

    const planResult = await client.query(
      `UPDATE plans
       SET plan_code = COALESCE($1, plan_code),
           plan_name = COALESCE($2, plan_name),
           price = $3,
           billing_cycle = COALESCE($4, billing_cycle),
           is_active = COALESCE($5, is_active),
           is_demo_plan = COALESCE($6, is_demo_plan),
           trial_enabled = COALESCE($7, trial_enabled),
           trial_duration_days = $8,
           plan_access_type = COALESCE($9, plan_access_type),
           template_access_tier = COALESCE($10, template_access_tier),
           watermark_text = $11,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $12
       RETURNING *`,
      [
        payload.planCode || null,
        payload.planName || null,
        payload.price,
        payload.billingCycle || null,
        payload.isActive,
        payload.isDemoPlan,
        payload.trialEnabled,
        payload.trialDurationDays,
        payload.planAccessType || null,
        payload.templateAccessTier || null,
        payload.watermarkText,
        Number(id)
      ]
    );

    if (planResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Plan not found" });
    }

    await client.query(
      `UPDATE plan_features
       SET max_users = $1,
           max_quotations = $2,
           max_customers = $3,
           inventory_enabled = $4,
           reports_enabled = $5,
           gst_enabled = $6,
           exports_enabled = $7,
           quotation_watermark_enabled = $8,
           quotation_creation_locked_after_expiry = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE plan_id = $10`,
      [
        payload.maxUsers,
        payload.maxQuotations,
        payload.maxCustomers,
        payload.inventoryEnabled,
        payload.reportsEnabled,
        payload.gstEnabled,
        payload.exportsEnabled,
        payload.quotationWatermarkEnabled,
        payload.quotationCreationLockedAfterExpiry,
        Number(id)
      ]
    );

    await client.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, NULL, $2, $3::jsonb)`,
      [
        req.user.id,
        "plan_updated",
        JSON.stringify({
          planId: Number(id),
          planCode: planResult.rows[0].plan_code,
          planName: planResult.rows[0].plan_name
        })
      ]
    );

    await client.query("COMMIT");

    return res.json({ plan: { ...planResult.rows[0], ...{
      max_users: payload.maxUsers,
      max_quotations: payload.maxQuotations,
      max_customers: payload.maxCustomers,
      inventory_enabled: payload.inventoryEnabled,
      reports_enabled: payload.reportsEnabled,
      gst_enabled: payload.gstEnabled,
      exports_enabled: payload.exportsEnabled,
      quotation_watermark_enabled: payload.quotationWatermarkEnabled,
      quotation_creation_locked_after_expiry: payload.quotationCreationLockedAfterExpiry
    } } });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "Plan code already exists" });
    }
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
