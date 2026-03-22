const express = require("express");
const pool = require("../db/db");
const { requirePlatformAdmin } = require("../middleware/auth");
const { seedSellerOnboardingWorkspace } = require("../services/onboardingTemplateService");
const { hashPassword, validatePasswordStrength } = require("../utils/passwords");

const leadRoutes = express.Router();
const publicLeadRoutes = express.Router();

function normalizeLeadPayload(body = {}) {
  return {
    name: String(body.name || "").trim(),
    mobile: String(body.mobile || "").trim(),
    email: String(body.email || "").trim() || null,
    businessName: String(body.businessName || body.business_name || "").trim() || null,
    city: String(body.city || "").trim() || null,
    businessType: String(body.businessType || body.business_type || "").trim() || null,
    businessSegment: String(body.businessSegment || body.business_segment || "").trim() || null,
    wantsSampleData: body.wantsSampleData !== undefined
      ? Boolean(body.wantsSampleData)
      : Boolean(body.wants_sample_data),
    requirement: String(body.requirement || "").trim() || null,
    interestedInDemo: body.interestedInDemo !== undefined
      ? Boolean(body.interestedInDemo)
      : Boolean(body.interested_in_demo),
    source: String(body.source || "website").trim().toLowerCase() || "website"
  };
}

function slugifySellerCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

async function createLead(client, payload, actorUserId = null) {
  const leadResult = await client.query(
    `INSERT INTO leads (
       name,
       mobile,
       email,
       business_name,
       city,
       business_type,
       business_segment,
       wants_sample_data,
     requirement,
     interested_in_demo,
     source,
     status
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'new')
     RETURNING *`,
    [
      payload.name,
      payload.mobile,
      payload.email,
      payload.businessName,
      payload.city,
      payload.businessType,
      payload.businessSegment,
      payload.wantsSampleData,
      payload.requirement,
      payload.interestedInDemo,
      payload.source
    ]
  );

  await client.query(
    `INSERT INTO lead_activity (lead_id, activity_type, note, actor_user_id)
     VALUES ($1, $2, $3, $4)`,
    [
      leadResult.rows[0].id,
      "lead_created",
      payload.interestedInDemo ? "Lead captured with demo interest." : "Lead captured.",
      actorUserId
    ]
  );

  return leadResult.rows[0];
}

publicLeadRoutes.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const payload = normalizeLeadPayload(req.body);
    if (!payload.name || !payload.mobile) {
      return res.status(400).json({ message: "name and mobile are required" });
    }

    await client.query("BEGIN");
    const lead = await createLead(client, payload, null);
    await client.query("COMMIT");

    return res.status(201).json({
      message: "Lead captured successfully.",
      lead
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

leadRoutes.use(requirePlatformAdmin);

leadRoutes.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         l.*,
         u.name AS assigned_user_name,
         u.mobile AS assigned_user_mobile,
         la.latest_activity_at
       FROM leads l
       LEFT JOIN users u ON u.id = l.assigned_user_id
       LEFT JOIN (
         SELECT lead_id, MAX(created_at) AS latest_activity_at
         FROM lead_activity
         GROUP BY lead_id
       ) la ON la.lead_id = l.id
       ORDER BY l.created_at DESC, l.id DESC`
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

leadRoutes.get("/:id", async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const [leadResult, activityResult] = await Promise.all([
      pool.query(
        `SELECT
           l.*,
           u.name AS assigned_user_name,
           u.mobile AS assigned_user_mobile
         FROM leads l
         LEFT JOIN users u ON u.id = l.assigned_user_id
         WHERE l.id = $1
         LIMIT 1`,
        [leadId]
      ),
      pool.query(
        `SELECT
           la.*,
           u.name AS actor_name,
           u.mobile AS actor_mobile
         FROM lead_activity la
         LEFT JOIN users u ON u.id = la.actor_user_id
         WHERE la.lead_id = $1
         ORDER BY la.created_at DESC, la.id DESC`,
        [leadId]
      )
    ]);

    if (leadResult.rowCount === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    return res.json({
      lead: leadResult.rows[0],
      activity: activityResult.rows
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

leadRoutes.patch("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const leadId = Number(req.params.id);
    const {
      status,
      assignedUserId,
      sellerId,
      note
    } = req.body;

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE leads
       SET status = COALESCE($1, status),
           assigned_user_id = COALESCE($2, assigned_user_id),
           seller_id = COALESCE($3, seller_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [
        status || null,
        assignedUserId ? Number(assignedUserId) : null,
        sellerId ? Number(sellerId) : null,
        leadId
      ]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Lead not found" });
    }

    if (status || assignedUserId || sellerId || note) {
      const activityParts = [];
      if (status) activityParts.push(`Status changed to ${status}`);
      if (assignedUserId) activityParts.push(`Assigned to user ${assignedUserId}`);
      if (sellerId) activityParts.push(`Linked to seller ${sellerId}`);
      if (note) activityParts.push(String(note).trim());

      await client.query(
        `INSERT INTO lead_activity (lead_id, activity_type, note, actor_user_id)
         VALUES ($1, $2, $3, $4)`,
        [
          leadId,
          "lead_updated",
          activityParts.join(". "),
          req.user.id
        ]
      );
    }

    await client.query("COMMIT");
    return res.json({ lead: result.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

leadRoutes.post("/:id/activity", async (req, res) => {
  try {
    const leadId = Number(req.params.id);
    const note = String(req.body?.note || "").trim();
    const activityType = String(req.body?.activityType || "note_added").trim() || "note_added";

    if (!note) {
      return res.status(400).json({ message: "note is required" });
    }

    const leadCheck = await pool.query(`SELECT id FROM leads WHERE id = $1 LIMIT 1`, [leadId]);
    if (leadCheck.rowCount === 0) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const result = await pool.query(
      `INSERT INTO lead_activity (lead_id, activity_type, note, actor_user_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [leadId, activityType, note, req.user.id]
    );

    return res.status(201).json({ activity: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

leadRoutes.post("/:id/convert-demo", async (req, res) => {
  const client = await pool.connect();

  try {
    const leadId = Number(req.params.id);
    const {
      sellerName,
      businessName,
      sellerCode,
      city,
      state,
      businessCategory,
      businessSegment,
      wantsSampleData,
      headerImageData,
      logoImageData,
      brandingMode,
      masterUserName,
      masterUserMobile,
      masterUserPassword
    } = req.body || {};

    await client.query("BEGIN");

    const leadResult = await client.query(
      `SELECT *
       FROM leads
       WHERE id = $1
       LIMIT 1`,
      [leadId]
    );

    if (leadResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Lead not found" });
    }

    const lead = leadResult.rows[0];
    if (lead.seller_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Lead is already linked to a seller" });
    }

    const demoPlanResult = await client.query(
      `SELECT p.id, p.plan_code, p.trial_enabled, p.trial_duration_days
       FROM plans p
       WHERE UPPER(p.plan_code) = 'DEMO' AND p.is_active = TRUE
       LIMIT 1`
    );

    if (demoPlanResult.rowCount === 0) {
      throw new Error("DEMO plan not found or inactive");
    }

    const demoPlan = demoPlanResult.rows[0];
    const trialDays = Number(demoPlan.trial_duration_days || 14);
    const trialEndAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    const resolvedSellerName = String(sellerName || lead.name || "").trim();
    const resolvedBusinessName = String(businessName || lead.business_name || lead.name || "").trim();
    const resolvedSellerCode = slugifySellerCode(
      sellerCode ||
      resolvedBusinessName ||
      resolvedSellerName ||
      `DEMO-${lead.id}`
    );

    if (!resolvedSellerName || !resolvedSellerCode) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "sellerName and sellerCode are required" });
    }

    const sellerInsert = await client.query(
      `INSERT INTO sellers (
         name,
         business_name,
         mobile,
         email,
         city,
         state,
         business_category,
         business_segment,
         seller_code,
         onboarding_status,
         status,
         trial_ends_at,
         subscription_plan,
         theme_key,
         brand_primary_color
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'setup', 'active', $9, 'DEMO', 'matte-blue', '#2563eb')
       RETURNING *`,
      [
        resolvedSellerName,
        resolvedBusinessName || null,
        lead.mobile || null,
        lead.email || null,
        city || lead.city || null,
        state || null,
        businessCategory || lead.business_type || null,
        businessSegment || lead.business_segment || null,
        resolvedSellerCode,
        trialEndAt
      ]
    );

    await client.query(
      `INSERT INTO subscriptions (
         seller_id,
         plan_id,
         status,
         start_date,
         trial_start_at,
         trial_end_at,
         auto_assigned,
         created_by,
         updated_by
       )
       VALUES ($1, $2, 'trial', CURRENT_DATE, CURRENT_TIMESTAMP, $3, TRUE, $4, $5)`,
      [
        sellerInsert.rows[0].id,
        demoPlan.id,
        trialEndAt,
        req.user.id,
        req.user.id
      ]
    );

    const demoFeatures = await client.query(
      `SELECT max_users, max_quotations
       FROM plan_features
       WHERE plan_id = $1
       LIMIT 1`,
      [demoPlan.id]
    );

    await client.query(
      `UPDATE sellers
       SET subscription_plan = 'DEMO',
           trial_ends_at = $1,
           max_users = COALESCE($2, max_users),
           max_orders_per_month = COALESCE($3, max_orders_per_month)
       WHERE id = $4`,
      [
        trialEndAt,
        demoFeatures.rows[0]?.max_users ?? null,
        demoFeatures.rows[0]?.max_quotations ?? null,
        sellerInsert.rows[0].id
      ]
    );

    let createdUser = null;
    if (String(masterUserName || "").trim() && String(masterUserMobile || "").trim()) {
      if (!String(masterUserPassword || "").trim()) {
        throw new Error("Master user password is required");
      }
      const passwordValidation = validatePasswordStrength(String(masterUserPassword).trim());
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.message);
      }

      const roleResult = await client.query(
        `SELECT id, role_name
         FROM roles
         WHERE role_name = ANY($1::text[])`,
        [["Demo User", "Master User"]]
      );
      const roleId =
        roleResult.rows.find((row) => row.role_name === "Demo User")?.id ||
        roleResult.rows.find((row) => row.role_name === "Master User")?.id ||
        null;

      const userResult = await client.query(
        `INSERT INTO users (name, mobile, password, role_id, created_by, seller_id, status, is_platform_admin)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, FALSE)
         RETURNING id, name, mobile, seller_id`,
        [
          String(masterUserName).trim(),
          String(masterUserMobile).trim(),
          await hashPassword(String(masterUserPassword).trim()),
          roleId,
          req.user.id,
          sellerInsert.rows[0].id
        ]
      );

      createdUser = userResult.rows[0];
    }

    await client.query(
      `UPDATE leads
       SET status = 'demo_created',
           seller_id = $1,
           business_type = COALESCE($3, business_type),
           business_segment = COALESCE($4, business_segment),
           wants_sample_data = COALESCE($5, wants_sample_data),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [
        sellerInsert.rows[0].id,
        leadId,
        businessCategory || null,
        businessSegment || null,
        wantsSampleData === undefined ? null : Boolean(wantsSampleData)
      ]
    );

    await seedSellerOnboardingWorkspace(client, {
      sellerId: sellerInsert.rows[0].id,
      actorUserId: req.user.id,
      businessCategory: businessCategory || lead.business_type || null,
      businessSegment: businessSegment || lead.business_segment || null,
      wantsSampleData: Boolean(wantsSampleData ?? lead.wants_sample_data),
      headerImageData: brandingMode === "header" ? (headerImageData || null) : null,
      logoImageData: brandingMode === "logo" ? (logoImageData || null) : null,
      showHeaderImage: brandingMode === "header" && Boolean(headerImageData),
      showLogoOnly: brandingMode === "logo" && Boolean(logoImageData)
    });

    await client.query(
      `INSERT INTO lead_activity (lead_id, activity_type, note, actor_user_id)
       VALUES ($1, $2, $3, $4)`,
      [
        leadId,
        "demo_created",
        `Demo account created for seller ${resolvedSellerCode}.`,
        req.user.id
      ]
    );

    await client.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        req.user.id,
        sellerInsert.rows[0].id,
        "seller_created_from_lead",
        JSON.stringify({
          leadId,
          sellerId: sellerInsert.rows[0].id,
          sellerCode: resolvedSellerCode,
          planCode: demoPlan.plan_code
        })
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Lead converted to demo successfully.",
      seller: sellerInsert.rows[0],
      masterUser: createdUser
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "Seller code or mobile already exists" });
    }
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

module.exports = {
  leadRoutes,
  publicLeadRoutes
};
