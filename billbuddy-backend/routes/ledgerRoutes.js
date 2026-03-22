const express = require("express");
const pool = require("../db/db");
const { getTenantId } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");

const router = express.Router();

router.get("/", requirePermission(PERMISSIONS.BILLING_VIEW), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { customerId } = req.query;
    const values = [];
    const clauses = [];

    if (tenantId) {
      values.push(tenantId);
      clauses.push(`l.seller_id = $${values.length}`);
    }

    if (customerId) {
      const numericCustomerId = Number(customerId);
      if (!Number.isFinite(numericCustomerId) || numericCustomerId <= 0) {
        return res.status(400).json({ message: "Valid customerId is required" });
      }
      values.push(numericCustomerId);
      clauses.push(`l.customer_id = $${values.length}`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT l.*, c.name AS customer_name, q.quotation_number, q.seller_quotation_number, q.custom_quotation_number
       FROM ledger l
       LEFT JOIN customers c ON c.id = l.customer_id
       LEFT JOIN quotations q ON q.id = l.quotation_id
       ${where}
       ORDER BY l.id DESC`,
      values
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
