const express = require("express");
const pool = require("../db/db");
const { createPaymentEntry } = require("../services/quotationService");
const { getTenantId } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");

const router = express.Router();

router.get("/", requirePermission(PERMISSIONS.BILLING_VIEW), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const values = [];
    const where = tenantId ? "WHERE p.seller_id = $1" : "";
    if (tenantId) values.push(tenantId);

    const result = await pool.query(
      `SELECT p.*, q.quotation_number, q.seller_quotation_number, q.custom_quotation_number, c.name AS customer_name, c.firm_name
       FROM payments p
       LEFT JOIN quotations q ON q.id = p.quotation_id
       LEFT JOIN customers c ON c.id = p.customer_id
       ${where}
       ORDER BY p.id DESC`,
      values
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", requirePermission(PERMISSIONS.QUOTATION_MARK_PAID), async (req, res) => {
  try {
    const tenantId = req.user.isPlatformAdmin ? Number(req.body.sellerId || getTenantId(req)) : getTenantId(req);
    const data = await createPaymentEntry({ ...req.body, sellerId: tenantId });
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
