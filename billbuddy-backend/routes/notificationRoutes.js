const express = require("express");
const pool = require("../db/db");
const { requirePlatformAdmin } = require("../middleware/auth");

const router = express.Router();

async function resolveAudienceSellers(client, audienceType, specificSellerId = null) {
  if (audienceType === "specific_seller") {
    if (!specificSellerId) return [];
    const result = await client.query(
      `SELECT id
       FROM sellers
       WHERE id = $1
       LIMIT 1`,
      [Number(specificSellerId)]
    );
    return result.rows;
  }

  if (audienceType === "active_sellers") {
    const result = await client.query(
      `SELECT id
       FROM sellers
       WHERE LOWER(COALESCE(status, 'pending')) = 'active'
         AND COALESCE(is_locked, FALSE) = FALSE`
    );
    return result.rows;
  }

  if (audienceType === "trial_users") {
    const result = await client.query(
      `SELECT DISTINCT s.id
       FROM sellers s
       INNER JOIN subscriptions sub ON sub.seller_id = s.id
       WHERE LOWER(COALESCE(sub.status, '')) = 'trial'`
    );
    return result.rows;
  }

  if (audienceType === "expiring_trials") {
    const result = await client.query(
      `SELECT DISTINCT s.id
       FROM sellers s
       INNER JOIN subscriptions sub ON sub.seller_id = s.id
       WHERE LOWER(COALESCE(sub.status, '')) = 'trial'
         AND sub.trial_end_at IS NOT NULL
         AND sub.trial_end_at <= CURRENT_TIMESTAMP + INTERVAL '3 day'`
    );
    return result.rows;
  }

  const result = await client.query(`SELECT id FROM sellers`);
  return result.rows;
}

router.get("/", async (req, res) => {
  try {
    if (req.user?.isPlatformAdmin) {
      const result = await pool.query(
        `SELECT
           n.*,
           u.name AS creator_name,
           COUNT(nl.id)::int AS recipient_count,
           COUNT(*) FILTER (WHERE nl.delivery_status IN ('sent', 'read'))::int AS sent_count,
           COUNT(*) FILTER (WHERE nl.delivery_status = 'read')::int AS read_count,
           COUNT(*) FILTER (WHERE nl.delivery_status = 'sent')::int AS unread_count,
           COUNT(*) FILTER (WHERE nl.delivery_status = 'scheduled')::int AS scheduled_count
         FROM notifications n
         LEFT JOIN users u ON u.id = n.created_by
         LEFT JOIN notification_logs nl ON nl.notification_id = n.id
         GROUP BY n.id, u.name
         ORDER BY COALESCE(n.sent_at, n.created_at) DESC`
      );
      return res.json(result.rows);
    }

    if (!req.user?.sellerId) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT
         nl.id,
         nl.delivery_status,
         nl.delivery_message,
         nl.delivered_at,
         nl.read_at,
         nl.created_at,
         n.id AS notification_id,
         n.title,
         n.message,
         n.channel,
         n.audience_type
       FROM notification_logs nl
       INNER JOIN notifications n ON n.id = nl.notification_id
       WHERE nl.seller_id = $1
       ORDER BY COALESCE(nl.delivered_at, nl.created_at) DESC`,
      [req.user.sellerId]
    );

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/:id", requirePlatformAdmin, async (req, res) => {
  try {
    const notificationId = Number(req.params.id);
    const notificationResult = await pool.query(
      `SELECT
         n.*,
         u.name AS creator_name,
         COUNT(nl.id)::int AS recipient_count,
         COUNT(*) FILTER (WHERE nl.delivery_status IN ('sent', 'read'))::int AS sent_count,
         COUNT(*) FILTER (WHERE nl.delivery_status = 'read')::int AS read_count,
         COUNT(*) FILTER (WHERE nl.delivery_status = 'sent')::int AS unread_count,
         COUNT(*) FILTER (WHERE nl.delivery_status = 'scheduled')::int AS scheduled_count
       FROM notifications n
       LEFT JOIN users u ON u.id = n.created_by
       LEFT JOIN notification_logs nl ON nl.notification_id = n.id
       WHERE n.id = $1
       GROUP BY n.id, u.name
       LIMIT 1`,
      [notificationId]
    );

    if (notificationResult.rowCount === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const logsResult = await pool.query(
      `SELECT
         nl.*,
         s.name AS seller_name,
         s.seller_code
       FROM notification_logs nl
       LEFT JOIN sellers s ON s.id = nl.seller_id
       WHERE nl.notification_id = $1
       ORDER BY COALESCE(nl.read_at, nl.delivered_at, nl.created_at) DESC`,
      [notificationId]
    );

    return res.json({
      notification: notificationResult.rows[0],
      logs: logsResult.rows
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.patch("/logs/:id/read", async (req, res) => {
  try {
    if (!req.user?.sellerId) {
      return res.status(400).json({ message: "seller context missing" });
    }

    const logId = Number(req.params.id);
    const result = await pool.query(
      `UPDATE notification_logs
       SET delivery_status = CASE
         WHEN delivery_status = 'scheduled' THEN delivery_status
         ELSE 'read'
       END,
           read_at = CASE
             WHEN delivery_status = 'scheduled' THEN read_at
             ELSE CURRENT_TIMESTAMP
           END
       WHERE id = $1
         AND seller_id = $2
       RETURNING *`,
      [logId, req.user.sellerId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Notification log not found" });
    }

    return res.json({ notificationLog: result.rows[0] });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/", requirePlatformAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      title,
      message,
      audienceType = "all_sellers",
      channel = "in_app",
      sendNow = true,
      scheduledAt = null,
      sellerId = null
    } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ message: "title and message are required" });
    }

    await client.query("BEGIN");

    const notificationResult = await client.query(
      `INSERT INTO notifications (
         title,
         message,
         audience_type,
         channel,
         seller_id,
         scheduled_at,
         sent_at,
         created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        String(title).trim(),
        String(message).trim(),
        String(audienceType).trim(),
        String(channel).trim(),
        sellerId ? Number(sellerId) : null,
        scheduledAt || null,
        sendNow ? new Date() : null,
        req.user.id
      ]
    );

    const notification = notificationResult.rows[0];
    const recipientRows = await resolveAudienceSellers(client, audienceType, sellerId);

    for (const recipient of recipientRows) {
      await client.query(
        `INSERT INTO notification_logs (
           notification_id,
           seller_id,
           delivery_status,
           delivery_message,
           delivered_at
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [
          notification.id,
          recipient.id,
          sendNow ? "sent" : "scheduled",
          sendNow ? "In-app notification created." : "Notification scheduled.",
          sendNow ? new Date() : null
        ]
      );
    }

    await client.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        req.user.id,
        sellerId ? Number(sellerId) : null,
        "notification_created",
        JSON.stringify({
          notificationId: notification.id,
          audienceType,
          channel,
          recipientCount: recipientRows.length,
          sendNow: Boolean(sendNow)
        })
      ]
    );

    await client.query("COMMIT");
    return res.status(201).json({
      message: "Notification created successfully.",
      notification: {
        ...notification,
        recipient_count: recipientRows.length,
        sent_count: sendNow ? recipientRows.length : 0
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
