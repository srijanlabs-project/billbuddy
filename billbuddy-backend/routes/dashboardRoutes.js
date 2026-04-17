const express = require("express");
const pool = require("../db/db");
const { getTenantId, requirePlatformAdmin } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");
const { buildConfiguredQuotationItemTitle, normalizeItemDisplayConfig } = require("../services/quotationViewService");

const router = express.Router();
const IST_TODAY_SQL = "(NOW() AT TIME ZONE 'Asia/Kolkata')::date";
const IST_CREATED_DATE_SQL = "(q.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date";

router.get("/summary", requirePermission(PERMISSIONS.DASHBOARD_VIEW), async (req, res) => {
  try {
    const { range = "daily" } = req.query;
    const tenantId = getTenantId(req);

    const dateFilter = {
      today: `${IST_CREATED_DATE_SQL} = ${IST_TODAY_SQL}`,
      yesterday: `${IST_CREATED_DATE_SQL} = ${IST_TODAY_SQL} - INTERVAL '1 day'`,
      last7: `${IST_CREATED_DATE_SQL} >= ${IST_TODAY_SQL} - INTERVAL '7 days'`,
      last30: `${IST_CREATED_DATE_SQL} >= ${IST_TODAY_SQL} - INTERVAL '30 days'`,
      last60: `${IST_CREATED_DATE_SQL} >= ${IST_TODAY_SQL} - INTERVAL '60 days'`,
      daily: `${IST_CREATED_DATE_SQL} = ${IST_TODAY_SQL}`,
      weekly: `${IST_CREATED_DATE_SQL} >= ${IST_TODAY_SQL} - INTERVAL '7 days'`,
      monthly: `DATE_TRUNC('month', ${IST_CREATED_DATE_SQL}::timestamp) = DATE_TRUNC('month', ${IST_TODAY_SQL}::timestamp)`
    };

    const condition = dateFilter[range] || dateFilter.today;

    const whereParts = [condition, "q.archived_at IS NULL", "COALESCE(q.record_status, 'submitted') <> 'archived'"];
    const whereValues = [];

    if (tenantId) {
      whereValues.push(tenantId);
      whereParts.push(`q.seller_id = $${whereValues.length}`);
    }

    const whereClause = whereParts.join(" AND ");

    const totals = await pool.query(
      `SELECT
         COALESCE(SUM(q.total_amount), 0) AS total_sales,
         COUNT(*) AS invoices_generated,
         COALESCE(SUM(CASE WHEN c.name ILIKE 'walk-in%' OR c.firm_name ILIKE 'walk-in%' THEN q.total_amount ELSE 0 END), 0) AS walk_in_sales,
         COALESCE(SUM(CASE WHEN q.payment_status <> 'paid' THEN q.total_amount ELSE 0 END), 0) AS pending_invoice_amount
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       WHERE ${whereClause}`,
      whereValues
    );

    const invoicedResult = tenantId
      ? await pool.query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM quotations WHERE seller_id = $1 AND archived_at IS NULL AND COALESCE(record_status, 'submitted') <> 'archived'`, [tenantId])
      : await pool.query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM quotations WHERE archived_at IS NULL AND COALESCE(record_status, 'submitted') <> 'archived'`);

    const paidResult = tenantId
      ? await pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE seller_id = $1`, [tenantId])
      : await pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM payments`);

    const pendingOverall = Number(invoicedResult.rows[0]?.total || 0) - Number(paidResult.rows[0]?.total || 0);

    const outstandingValues = [];
    let sellerFilter = "";
    if (tenantId) {
      outstandingValues.push(tenantId);
      sellerFilter = `c.seller_id = $${outstandingValues.length} AND `;
    }

    const outstandingByCustomer = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.firm_name,
         COALESCE(q.invoiced, 0) - COALESCE(p.paid, 0) AS outstanding
       FROM customers c
       LEFT JOIN (
         SELECT customer_id, SUM(total_amount) AS invoiced
         FROM quotations
         ${tenantId ? "WHERE seller_id = $1 AND archived_at IS NULL AND COALESCE(record_status, 'submitted') <> 'archived'" : "WHERE archived_at IS NULL AND COALESCE(record_status, 'submitted') <> 'archived'"}
         GROUP BY customer_id
       ) q ON q.customer_id = c.id
       LEFT JOIN (
         SELECT customer_id, SUM(amount) AS paid
         FROM payments
         ${tenantId ? "WHERE seller_id = $1" : ""}
         GROUP BY customer_id
       ) p ON p.customer_id = c.id
       WHERE ${sellerFilter}c.archived_at IS NULL
         AND COALESCE(q.invoiced, 0) - COALESCE(p.paid, 0) > 0
       ORDER BY outstanding DESC
       LIMIT 20`,
      outstandingValues
    );

    const salesValues = [];
    let salesWhere = "";
    if (tenantId) {
      salesValues.push(tenantId);
      salesWhere = `WHERE qi.seller_id = $${salesValues.length}`;
    }

    const salesByCategory = await pool.query(
      `SELECT
         COALESCE(p.category, 'Uncategorized') AS category,
         COALESCE(SUM(qi.total_price), 0) AS total
       FROM quotation_items qi
       INNER JOIN quotations q ON q.id = qi.quotation_id AND q.archived_at IS NULL AND COALESCE(q.record_status, 'submitted') <> 'archived'
       LEFT JOIN products p ON p.id = qi.product_id
       ${salesWhere}
       GROUP BY COALESCE(p.category, 'Uncategorized')
       ORDER BY total DESC`,
      salesValues
    );

    async function safeQueryRows(query, values = []) {
      try {
        const result = await pool.query(query, values);
        return result.rows;
      } catch (_error) {
        return [];
      }
    }

    async function safeQueryCount(query, values = []) {
      try {
        const result = await pool.query(query, values);
        return Number(result.rows?.[0]?.count || 0);
      } catch (_error) {
        return 0;
      }
    }

    function parseJsonObject(value) {
      if (!value) return {};
      if (typeof value === "object" && !Array.isArray(value)) return value;
      if (typeof value !== "string") return {};
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (_error) {
        return {};
      }
    }

    function resolveProductDisplayName(product = {}, itemDisplayConfig = {}) {
      const customFields = parseJsonObject(product.custom_fields);
      const latestItemDisplayText = String(product.latest_item_display_text || "").trim();
      if (latestItemDisplayText) return latestItemDisplayText;

      const configuredTitle = String(
        buildConfiguredQuotationItemTitle(
          {
            ...product,
            custom_fields: customFields,
            item_category: product.category || null
          },
          itemDisplayConfig
        ) || ""
      ).trim();

      if (configuredTitle) return configuredTitle;

      const fallbackKeys = [
        "item_display_text",
        "material_name",
        "item_name",
        "product_name",
        "service_name",
        "design_name"
      ];
      for (const key of fallbackKeys) {
        const value = String(customFields?.[key] || "").trim();
        if (value) return value;
      }

      return String(product.material_name || product.design_name || "Item").trim() || "Item";
    }

    const customerCount = tenantId
      ? await safeQueryCount(`SELECT COUNT(*)::int AS count FROM customers WHERE seller_id = $1 AND archived_at IS NULL`, [tenantId])
      : await safeQueryCount(`SELECT COUNT(*)::int AS count FROM customers WHERE archived_at IS NULL`);

    const customerCountInRangeRows = await safeQueryRows(
      `SELECT COUNT(DISTINCT q.customer_id)::int AS count
       FROM quotations q
       WHERE ${whereClause}
         AND q.archived_at IS NULL
         AND q.customer_id IS NOT NULL`,
      whereValues
    );
    const customerCountInRange = Number(customerCountInRangeRows[0]?.count || 0);

    const latestCustomers = tenantId
      ? await safeQueryRows(
        `SELECT id, name, firm_name, mobile, created_at
         FROM customers
         WHERE seller_id = $1
           AND archived_at IS NULL
         ORDER BY created_at DESC, id DESC
         LIMIT 10`,
        [tenantId]
      )
      : await safeQueryRows(
        `SELECT id, name, firm_name, mobile, created_at
         FROM customers
         WHERE archived_at IS NULL
         ORDER BY created_at DESC, id DESC
         LIMIT 10`
      );

    const deliveryValues = [];
    const deliveryWhere = ["q.delivery_date IS NOT NULL", "q.delivery_date::date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '2 day'", "q.archived_at IS NULL", "COALESCE(q.record_status, 'submitted') <> 'archived'"];
    if (tenantId) {
      deliveryValues.push(tenantId);
      deliveryWhere.push(`q.seller_id = $${deliveryValues.length}`);
    }
    const deliveriesNext3Days = await safeQueryRows(
      `SELECT q.delivery_date::date AS day, COUNT(*)::int AS count
       FROM quotations q
       WHERE ${deliveryWhere.join(" AND ")}
       GROUP BY q.delivery_date::date
       ORDER BY q.delivery_date::date ASC`,
      deliveryValues
    );

    const trendWindowByRange = {
      today: 1,
      yesterday: 1,
      last7: 7,
      last30: 30,
      last60: 60,
      daily: 1,
      weekly: 7,
      monthly: 30
    };
    const trendDays = Number(trendWindowByRange[range] || 7);
    const salesTrendValues = [];
    const salesTrendWhere = [];
    if (String(range) === "yesterday") {
      salesTrendWhere.push(`${IST_CREATED_DATE_SQL} = ${IST_TODAY_SQL} - INTERVAL '1 day'`);
    } else if (trendDays <= 1) {
      salesTrendWhere.push(`${IST_CREATED_DATE_SQL} = ${IST_TODAY_SQL}`);
    } else {
      salesTrendWhere.push(`${IST_CREATED_DATE_SQL} >= ${IST_TODAY_SQL} - INTERVAL '${trendDays - 1} day'`);
    }
    if (tenantId) {
      salesTrendValues.push(tenantId);
      salesTrendWhere.push(`q.seller_id = $${salesTrendValues.length}`);
    }
    salesTrendWhere.push("q.archived_at IS NULL");
    salesTrendWhere.push("COALESCE(q.record_status, 'submitted') <> 'archived'");
    const salesTrend = await safeQueryRows(
      `SELECT
         ${IST_CREATED_DATE_SQL} AS day,
         TO_CHAR(${IST_CREATED_DATE_SQL}, 'DD Mon') AS day_label,
         COUNT(*)::int AS quotation_count,
         COALESCE(SUM(q.total_amount), 0) AS total
       FROM quotations q
       WHERE ${salesTrendWhere.join(" AND ")}
       GROUP BY ${IST_CREATED_DATE_SQL}
       ORDER BY ${IST_CREATED_DATE_SQL} ASC`,
      salesTrendValues
    );

    const periodMetricsRows = await safeQueryRows(
      `SELECT
         COUNT(*)::int AS quotation_count,
         COALESCE(SUM(q.total_amount), 0) AS quotation_value
       FROM quotations q
       WHERE ${whereClause}`,
      whereValues
    );

    async function fetchTopArticlesByRange(days) {
      const values = [];
      const whereParts = [`${IST_CREATED_DATE_SQL} >= ${IST_TODAY_SQL} - INTERVAL '${Number(days)} day'`, "q.archived_at IS NULL", "COALESCE(q.record_status, 'submitted') <> 'archived'"];
      if (tenantId) {
        values.push(tenantId);
        whereParts.push(`q.seller_id = $${values.length}`);
      }

      const result = await safeQueryRows(
        `SELECT
           COALESCE(
             NULLIF(TRIM(qi.item_display_text), ''),
             NULLIF(TRIM(p.material_name), ''),
             NULLIF(TRIM(qi.material_type), ''),
             NULLIF(TRIM(qi.design_name), ''),
             'Item'
           ) AS article_name,
           COALESCE(SUM(COALESCE(qi.quantity, 0)), 0) AS total_qty,
           COALESCE(SUM(COALESCE(qi.total_price, 0)), 0) AS total_value
         FROM quotation_items qi
         INNER JOIN quotations q ON q.id = qi.quotation_id
         LEFT JOIN products p ON p.id = qi.product_id
         WHERE ${whereParts.join(" AND ")}
         GROUP BY 1
         ORDER BY total_value DESC, total_qty DESC
         LIMIT 10`,
        values
      );
      return result;
    }

    const [topArticles7, topArticles30, topArticles60] = await Promise.all([
      fetchTopArticlesByRange(7),
      fetchTopArticlesByRange(30),
      fetchTopArticlesByRange(60)
    ]);

    const staleProductValues = [];
    const staleProductWhere = [];
    if (tenantId) {
      staleProductValues.push(tenantId);
      staleProductWhere.push(`p.seller_id = $${staleProductValues.length}`);
    }

    let itemDisplayConfig = normalizeItemDisplayConfig({});
    if (tenantId) {
      const itemDisplayConfigRows = await safeQueryRows(
        `SELECT modules
         FROM seller_configuration_profiles
         WHERE seller_id = $1
           AND status = 'published'
         ORDER BY published_at DESC NULLS LAST, updated_at DESC, id DESC
         LIMIT 1`,
        [tenantId]
      );
      itemDisplayConfig = normalizeItemDisplayConfig(itemDisplayConfigRows[0]?.modules?.itemDisplayConfig || {});
    }

    const staleProductsRaw = await safeQueryRows(
      `SELECT
         p.id,
         p.material_name,
         p.design_name,
         p.custom_fields,
         p.category,
         p.base_price,
         li.item_display_text AS latest_item_display_text,
         qh.last_quoted_at
       FROM products p
       LEFT JOIN LATERAL (
         SELECT NULLIF(TRIM(qi.item_display_text), '') AS item_display_text
         FROM quotation_items qi
         INNER JOIN quotations q2 ON q2.id = qi.quotation_id
         WHERE qi.product_id = p.id
           ${tenantId ? "AND q2.seller_id = $1" : ""}
           AND q2.archived_at IS NULL
           AND COALESCE(q2.record_status, 'submitted') <> 'archived'
         ORDER BY q2.created_at DESC, qi.id DESC
         LIMIT 1
       ) li ON TRUE
       LEFT JOIN (
         SELECT qi.product_id, MAX(q.created_at) AS last_quoted_at
         FROM quotation_items qi
         INNER JOIN quotations q ON q.id = qi.quotation_id
         ${tenantId ? "WHERE q.seller_id = $1 AND q.archived_at IS NULL AND COALESCE(q.record_status, 'submitted') <> 'archived'" : "WHERE q.archived_at IS NULL AND COALESCE(q.record_status, 'submitted') <> 'archived'"}
         GROUP BY qi.product_id
       ) qh ON qh.product_id = p.id
       ${staleProductWhere.length ? `WHERE ${staleProductWhere.join(" AND ")} AND ` : "WHERE "}
       (qh.last_quoted_at IS NULL OR (qh.last_quoted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date < ${IST_TODAY_SQL} - INTERVAL '30 day')
       ORDER BY COALESCE(qh.last_quoted_at, TIMESTAMP '1900-01-01') ASC, p.id DESC
       LIMIT 10`,
      staleProductValues
    );

    const staleProducts30Days = staleProductsRaw.map((row) => ({
      ...row,
      item_display_name: resolveProductDisplayName(row, itemDisplayConfig)
    }));

    res.json({
      range,
      sellerId: tenantId,
      totals: totals.rows[0],
      pendingOverall,
      customerCount,
      customerCountInRange,
      latestCustomers,
      deliveriesNext3Days,
      salesTrend,
      periodMetrics: {
        quotationCount: Number(periodMetricsRows[0]?.quotation_count || 0),
        quotationValue: Number(periodMetricsRows[0]?.quotation_value || 0)
      },
      topArticlesByRange: {
        "7d": topArticles7,
        "30d": topArticles30,
        "60d": topArticles60
      },
      staleProducts30Days,
      outstandingByCustomer: outstandingByCustomer.rows,
      salesByCategory: salesByCategory.rows
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/server-errors", requirePlatformAdmin, async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(10, Number(req.query.limit || 50)));
    const result = await pool.query(
      `SELECT
         pal.id,
         pal.created_at,
         pal.detail,
         pal.actor_user_id,
         pal.seller_id,
         actor.name AS actor_name,
         seller.name AS seller_name
       FROM platform_audit_logs pal
       LEFT JOIN users actor ON actor.id = pal.actor_user_id
       LEFT JOIN sellers seller ON seller.id = pal.seller_id
       WHERE pal.action_key = 'server_error'
       ORDER BY pal.created_at DESC, pal.id DESC
       LIMIT $1`,
      [limit]
    );

    return res.json({
      errors: result.rows.map((row) => ({
        id: row.id,
        created_at: row.created_at,
        actor_user_id: row.actor_user_id,
        actor_name: row.actor_name || null,
        seller_id: row.seller_id,
        seller_name: row.seller_name || null,
        detail: row.detail || {}
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to fetch server errors" });
  }
});

module.exports = router;
