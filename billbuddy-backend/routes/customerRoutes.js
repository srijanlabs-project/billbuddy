const express = require("express");
const pool = require("../db/db");
const { getTenantId } = require("../middleware/auth");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const values = [];
    const where = tenantId ? "WHERE seller_id = $1" : "";
    if (tenantId) values.push(tenantId);

    const result = await pool.query(`SELECT * FROM customers ${where} ORDER BY id DESC`, values);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, mobile, email, firmName, address, gstNumber, discountPercent, sellerId, monthlyBilling } = req.body;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const tenantId = req.user.isPlatformAdmin ? Number(sellerId || getTenantId(req)) : getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const result = await pool.query(
      `INSERT INTO customers (seller_id, name, mobile, email, firm_name, address, gst_number, discount_percent, monthly_billing)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [tenantId, name, mobile || null, email || null, firmName || null, address || null, gstNumber || null, discountPercent || null, Boolean(monthlyBilling)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
