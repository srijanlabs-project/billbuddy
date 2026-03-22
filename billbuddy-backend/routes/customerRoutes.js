const express = require("express");
const pool = require("../db/db");
const { getTenantId } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");

const router = express.Router();

function normalizeStateKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeShippingAddresses(shippingAddresses) {
  const stateGstMap = new Map();

  const staged = (Array.isArray(shippingAddresses) ? shippingAddresses : [])
    .map((entry) => ({
      label: String(entry?.label || "").trim(),
      address: String(entry?.address || "").trim(),
      state: String(entry?.state || "").trim(),
      pincode: String(entry?.pincode || "").trim(),
      gstNumber: String(entry?.gstNumber || "").trim().toUpperCase()
    }))
    .filter((entry) => entry.address || entry.label || entry.state || entry.pincode || entry.gstNumber);

  staged.forEach((entry) => {
    const stateKey = normalizeStateKey(entry.state);
    if (stateKey && entry.gstNumber) {
      stateGstMap.set(stateKey, entry.gstNumber);
    }
  });

  return staged.map((entry) => {
    const stateKey = normalizeStateKey(entry.state);
    if (!stateKey || entry.gstNumber) {
      return entry;
    }

    const reusedGst = stateGstMap.get(stateKey);
    return reusedGst ? { ...entry, gstNumber: reusedGst } : entry;
  });
}

router.get("/", requirePermission(PERMISSIONS.CUSTOMER_VIEW), async (req, res) => {
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

router.post("/", requirePermission(PERMISSIONS.CUSTOMER_CREATE), async (req, res) => {
  try {
    const { name, mobile, email, firmName, address, gstNumber, discountPercent, sellerId, monthlyBilling, shippingAddresses } = req.body;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const tenantId = req.user.isPlatformAdmin ? Number(sellerId || getTenantId(req)) : getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const result = await pool.query(
      `INSERT INTO customers (seller_id, name, mobile, email, firm_name, address, gst_number, discount_percent, monthly_billing, shipping_addresses)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::jsonb, '[]'::jsonb))
       RETURNING *`,
      [
        tenantId,
        name,
        mobile || null,
        email || null,
        firmName || null,
        address || null,
        gstNumber ? String(gstNumber).trim().toUpperCase() : null,
        discountPercent || null,
        Boolean(monthlyBilling),
        JSON.stringify(normalizeShippingAddresses(shippingAddresses))
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
