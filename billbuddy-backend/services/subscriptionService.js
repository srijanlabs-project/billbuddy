const pool = require("../db/db");

function toNullableDate(value) {
  return value ? new Date(value) : null;
}

async function getCurrentSubscription(clientOrPool, sellerId) {
  const result = await clientOrPool.query(
    `SELECT
       s.*,
       p.plan_code,
       p.plan_name,
       p.is_demo_plan,
       p.trial_enabled,
       p.trial_duration_days,
       p.watermark_text,
       pf.max_users,
       pf.max_quotations,
       pf.max_customers,
       pf.inventory_enabled,
       pf.reports_enabled,
       pf.gst_enabled,
       pf.exports_enabled,
       pf.quotation_watermark_enabled,
       pf.quotation_creation_locked_after_expiry
     FROM subscriptions s
     INNER JOIN plans p ON p.id = s.plan_id
     LEFT JOIN plan_features pf ON pf.plan_id = p.id
     WHERE s.seller_id = $1
     ORDER BY
       CASE
         WHEN s.status = 'active' THEN 1
         WHEN s.status = 'trial' THEN 2
         WHEN s.status = 'suspended' THEN 3
         WHEN s.status = 'expired' THEN 4
         WHEN s.status = 'cancelled' THEN 5
         ELSE 6
       END,
       COALESCE(s.updated_at, s.created_at) DESC,
       s.id DESC
     LIMIT 1`,
    [sellerId]
  );

  return result.rows[0] || null;
}

function isSubscriptionExpired(subscription) {
  if (!subscription) return false;
  if (String(subscription.status || "").toLowerCase() === "expired") return true;
  if (String(subscription.status || "").toLowerCase() === "cancelled") return true;

  const trialEnd = toNullableDate(subscription.trial_end_at);
  const endDate = toNullableDate(subscription.end_date);
  const now = new Date();

  if (trialEnd && now > trialEnd && String(subscription.status || "").toLowerCase() === "trial") {
    return true;
  }

  if (endDate && now > endDate) {
    return true;
  }

  return false;
}

function getQuotationWatermark(subscription) {
  if (!subscription) return null;
  if (!subscription.quotation_watermark_enabled) return null;
  if (!(subscription.is_demo_plan || subscription.trial_enabled || String(subscription.status || "").toLowerCase() === "trial")) {
    return null;
  }
  return subscription.watermark_text || "Quotsy - Trial Version";
}

async function syncSellerSubscriptionCache(clientOrPool, sellerId) {
  const subscription = await getCurrentSubscription(clientOrPool, sellerId);
  if (!subscription) return null;

  await clientOrPool.query(
    `UPDATE sellers
     SET subscription_plan = $1,
         trial_ends_at = COALESCE($2, trial_ends_at),
         max_users = COALESCE($3, max_users),
         max_orders_per_month = COALESCE($4, max_orders_per_month)
     WHERE id = $5`,
    [
      String(subscription.plan_code || "").toUpperCase() || null,
      subscription.trial_end_at || null,
      subscription.max_users ?? null,
      subscription.max_quotations ?? null,
      sellerId
    ]
  );

  return subscription;
}

async function assertQuotationCreationAllowed(clientOrPool, sellerId) {
  const subscription = await getCurrentSubscription(clientOrPool, sellerId);
  if (!subscription) {
    throw new Error("No active subscription found for seller");
  }

  if (isSubscriptionExpired(subscription) && subscription.quotation_creation_locked_after_expiry) {
    throw new Error("Quotation creation is locked because the subscription or trial has expired");
  }

  if (String(subscription.status || "").toLowerCase() === "suspended") {
    throw new Error("Quotation creation is locked because the subscription is suspended");
  }

  return subscription;
}

module.exports = {
  getCurrentSubscription,
  isSubscriptionExpired,
  getQuotationWatermark,
  syncSellerSubscriptionCache,
  assertQuotationCreationAllowed
};
