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
       pf.included_users,
       pf.max_users_allowed,
       pf.extra_user_price_monthly,
       pf.extra_user_price_yearly,
       pf.seat_expansion_allowed,
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

async function getActiveBillableUserCount(clientOrPool, sellerId) {
  const result = await clientOrPool.query(
    `SELECT COUNT(*)::int AS active_user_count
     FROM users
     WHERE seller_id = $1
       AND COALESCE(is_platform_admin, FALSE) = FALSE
       AND COALESCE(status, TRUE) = TRUE
       AND COALESCE(locked, FALSE) = FALSE`,
    [sellerId]
  );

  return result.rows[0]?.active_user_count || 0;
}

function getPurchasedUserCount(subscription) {
  if (!subscription) return 0;

  if (subscription.purchased_user_count !== null && subscription.purchased_user_count !== undefined) {
    return Number(subscription.purchased_user_count) || 0;
  }

  if (subscription.included_users_snapshot !== null && subscription.included_users_snapshot !== undefined) {
    const included = Number(subscription.included_users_snapshot) || 0;
    const additional = Number(subscription.additional_user_count || 0) || 0;
    return included + additional;
  }

  if (subscription.included_users !== null && subscription.included_users !== undefined) {
    return Number(subscription.included_users) || 0;
  }

  if (subscription.max_users !== null && subscription.max_users !== undefined) {
    return Number(subscription.max_users) || 0;
  }

  return 0;
}

async function getSellerSeatSummary(clientOrPool, sellerId) {
  const subscription = await getCurrentSubscription(clientOrPool, sellerId);
  const activeUserCount = await getActiveBillableUserCount(clientOrPool, sellerId);

  const includedUsers = subscription
    ? Number(
      subscription.included_users_snapshot
      ?? subscription.included_users
      ?? subscription.max_users
      ?? 0
    ) || 0
    : 0;

  const purchasedUserCount = getPurchasedUserCount(subscription);
  const availableUserCount = Math.max(purchasedUserCount - activeUserCount, 0);
  const additionalUserCount = subscription
    ? Number(
      subscription.additional_user_count
      ?? Math.max(purchasedUserCount - includedUsers, 0)
    ) || 0
    : 0;

  return {
    sellerId,
    subscriptionId: subscription?.id || null,
    planId: subscription?.plan_id || null,
    planCode: subscription?.plan_code || null,
    planName: subscription?.plan_name || null,
    status: subscription?.status || null,
    includedUsers,
    purchasedUserCount,
    additionalUserCount,
    activeUserCount,
    availableUserCount,
    maxUsersAllowed: subscription?.max_users_allowed !== null && subscription?.max_users_allowed !== undefined
      ? Number(subscription.max_users_allowed) || 0
      : null,
    seatExpansionAllowed: Boolean(subscription?.seat_expansion_allowed),
    seatLimitEnforced: subscription?.seat_limit_enforced !== undefined
      ? Boolean(subscription.seat_limit_enforced)
      : true,
    extraUserPriceMonthly: subscription?.extra_user_price_monthly !== undefined && subscription?.extra_user_price_monthly !== null
      ? Number(subscription.extra_user_price_monthly) || 0
      : null,
    extraUserPriceYearly: subscription?.extra_user_price_yearly !== undefined && subscription?.extra_user_price_yearly !== null
      ? Number(subscription.extra_user_price_yearly) || 0
      : null
  };
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
  const seatSummary = await getSellerSeatSummary(clientOrPool, sellerId);

  await clientOrPool.query(
    `UPDATE sellers
     SET subscription_plan = $1,
         trial_ends_at = COALESCE($2, trial_ends_at),
         max_users = COALESCE($3, max_users),
         max_orders_per_month = COALESCE($4, max_orders_per_month),
         included_users = $5,
         purchased_user_count = $6,
         active_user_count = $7,
         available_user_count = $8,
         seat_status = $9
     WHERE id = $10`,
    [
      String(subscription.plan_code || "").toUpperCase() || null,
      subscription.trial_end_at || null,
      seatSummary.purchasedUserCount || subscription.max_users || null,
      subscription.max_quotations ?? null,
      seatSummary.includedUsers,
      seatSummary.purchasedUserCount,
      seatSummary.activeUserCount,
      seatSummary.availableUserCount,
      seatSummary.availableUserCount > 0 ? "available" : "full",
      sellerId
    ]
  );

  return {
    ...subscription,
    seat_summary: seatSummary
  };
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
  getActiveBillableUserCount,
  getSellerSeatSummary,
  getPurchasedUserCount,
  isSubscriptionExpired,
  getQuotationWatermark,
  syncSellerSubscriptionCache,
  assertQuotationCreationAllowed
};
