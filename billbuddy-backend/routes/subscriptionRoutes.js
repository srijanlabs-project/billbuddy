const express = require("express");
const pool = require("../db/db");
const { requirePlatformAdmin, getTenantId } = require("../middleware/auth");
const { syncSellerSubscriptionCache } = require("../services/subscriptionService");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");

const router = express.Router();

router.get("/", requirePermission(PERMISSIONS.SUBSCRIPTION_VIEW), async (req, res) => {
  try {
    const sellerId = req.user?.isPlatformAdmin
      ? (req.query.sellerId ? Number(req.query.sellerId) : null)
      : getTenantId(req);

    if (!req.user?.isPlatformAdmin && !sellerId) {
      return res.status(400).json({ message: "seller context missing" });
    }

    const values = [];
    let where = "";
    if (sellerId) {
      values.push(sellerId);
      where = "WHERE s.seller_id = $1";
    }

    const result = await pool.query(
      `SELECT
         s.*,
         sel.name AS seller_name,
         sel.seller_code,
         p.plan_code,
         p.plan_name,
         p.is_demo_plan,
         p.trial_enabled,
         p.plan_access_type,
         p.template_access_tier
       FROM subscriptions s
       INNER JOIN sellers sel ON sel.id = s.seller_id
       INNER JOIN plans p ON p.id = s.plan_id
       ${where}
       ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.id DESC`,
      values
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.use(requirePlatformAdmin);

router.patch("/:id", requirePermission(PERMISSIONS.SUBSCRIPTION_MANAGE), async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      planId,
      planCode,
      status,
      startDate,
      endDate,
      trialStartAt,
      trialEndAt,
      convertedFromTrial
    } = req.body;

    await client.query("BEGIN");

    const beforeResult = await client.query(
      `SELECT *
       FROM subscriptions
       WHERE id = $1
       LIMIT 1`,
      [Number(id)]
    );

    if (beforeResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Subscription not found" });
    }

    let resolvedPlanId = planId ? Number(planId) : null;
    if (!resolvedPlanId && planCode) {
      const planLookup = await client.query(
        `SELECT id FROM plans WHERE UPPER(plan_code) = UPPER($1) LIMIT 1`,
        [planCode]
      );
      resolvedPlanId = planLookup.rows[0]?.id || null;
      if (!resolvedPlanId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ message: `Plan code '${planCode}' not found` });
      }
    }

    const result = await client.query(
      `UPDATE subscriptions
       SET plan_id = COALESCE($1, plan_id),
           status = COALESCE($2, status),
           start_date = COALESCE($3, start_date),
           end_date = COALESCE($4, end_date),
           trial_start_at = COALESCE($5, trial_start_at),
           trial_end_at = COALESCE($6, trial_end_at),
           converted_from_trial = COALESCE($7, converted_from_trial),
           updated_by = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [
        resolvedPlanId,
        status || null,
        startDate || null,
        endDate || null,
        trialStartAt || null,
        trialEndAt || null,
        convertedFromTrial !== undefined ? Boolean(convertedFromTrial) : null,
        req.user.id,
        Number(id)
      ]
    );

    const subscription = result.rows[0];
    await syncSellerSubscriptionCache(client, subscription.seller_id);

    await client.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        req.user.id,
        subscription.seller_id,
        "subscription_updated",
        JSON.stringify({
          subscriptionId: subscription.id,
          sellerId: subscription.seller_id,
          before: {
            planId: beforeResult.rows[0].plan_id,
            status: beforeResult.rows[0].status,
            startDate: beforeResult.rows[0].start_date,
            endDate: beforeResult.rows[0].end_date,
            trialStartAt: beforeResult.rows[0].trial_start_at,
            trialEndAt: beforeResult.rows[0].trial_end_at,
            convertedFromTrial: beforeResult.rows[0].converted_from_trial
          },
          after: {
            planId: subscription.plan_id,
            status: subscription.status,
            startDate: subscription.start_date,
            endDate: subscription.end_date,
            trialStartAt: subscription.trial_start_at,
            trialEndAt: subscription.trial_end_at,
            convertedFromTrial: subscription.converted_from_trial
          }
        })
      ]
    );

    await client.query("COMMIT");
    return res.json({ subscription });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
