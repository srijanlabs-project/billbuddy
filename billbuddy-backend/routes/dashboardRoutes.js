const express = require("express");
const pool = require("../db/db");
const { getTenantId } = require("../middleware/auth");

const router = express.Router();

router.get("/summary", async (req, res) => {
  try {
    const { range = "daily" } = req.query;
    const tenantId = getTenantId(req);

    const dateFilter = {
      daily: "DATE(q.created_at) = CURRENT_DATE",
      weekly: "q.created_at >= CURRENT_DATE - INTERVAL '7 days'",
      monthly: "q.created_at >= DATE_TRUNC('month', CURRENT_DATE)"
    };

    const condition = dateFilter[range] || dateFilter.daily;

    const whereParts = [condition];
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
      ? await pool.query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM quotations WHERE seller_id = $1`, [tenantId])
      : await pool.query(`SELECT COALESCE(SUM(total_amount),0) AS total FROM quotations`);

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
         ${tenantId ? "WHERE seller_id = $1" : ""}
         GROUP BY customer_id
       ) q ON q.customer_id = c.id
       LEFT JOIN (
         SELECT customer_id, SUM(amount) AS paid
         FROM payments
         ${tenantId ? "WHERE seller_id = $1" : ""}
         GROUP BY customer_id
       ) p ON p.customer_id = c.id
       WHERE ${sellerFilter}COALESCE(q.invoiced, 0) - COALESCE(p.paid, 0) > 0
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
       LEFT JOIN products p ON p.id = qi.product_id
       ${salesWhere}
       GROUP BY COALESCE(p.category, 'Uncategorized')
       ORDER BY total DESC`,
      salesValues
    );

    res.json({
      range,
      sellerId: tenantId,
      totals: totals.rows[0],
      pendingOverall,
      outstandingByCustomer: outstandingByCustomer.rows,
      salesByCategory: salesByCategory.rows
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
