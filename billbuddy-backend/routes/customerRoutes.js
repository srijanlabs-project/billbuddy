const express = require("express");
const pool = require("../db/db");
const { getTenantId } = require("../middleware/auth");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");
const { normalizeGstNumber, validateAndFetchGstProfile } = require("../services/gstValidationService");

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

async function validateShippingAddressGstNumbers(shippingAddresses) {
  const normalizedAddresses = normalizeShippingAddresses(shippingAddresses);
  for (let index = 0; index < normalizedAddresses.length; index += 1) {
    const gstNumber = normalizeGstNumber(normalizedAddresses[index]?.gstNumber || "");
    if (!gstNumber) continue;
    try {
      await validateAndFetchGstProfile(gstNumber);
    } catch (error) {
      error.field = `shippingAddresses[${index}].gstNumber`;
      throw error;
    }
  }
  return normalizedAddresses;
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

router.post("/gst/validate", requirePermission(PERMISSIONS.CUSTOMER_CREATE), async (req, res) => {
  try {
    const gstNumber = normalizeGstNumber(req.body?.gstNumber || req.body?.gstin || "");
    const profile = await validateAndFetchGstProfile(gstNumber);
    return res.json({
      valid: true,
      profile: {
        gstNumber: profile.gstNumber,
        legalName: profile.legalName,
        tradeName: profile.tradeName,
        address: profile.address
      }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "GST validation failed",
      field: error.field || "gstNumber"
    });
  }
});

router.post("/", requirePermission(PERMISSIONS.CUSTOMER_CREATE), async (req, res) => {
  try {
    const { name, mobile, email, firmName, address, gstNumber, discountPercent, sellerId, monthlyBilling, shippingAddresses } = req.body;

    const tenantId = req.user.isPlatformAdmin ? Number(sellerId || getTenantId(req)) : getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }
    const normalizedGstNumber = normalizeGstNumber(gstNumber);
    let resolvedName = String(name || "").trim();
    let resolvedFirmName = String(firmName || "").trim();
    let resolvedAddress = String(address || "").trim();
    let gstProfile = null;

    if (normalizedGstNumber) {
      gstProfile = await validateAndFetchGstProfile(normalizedGstNumber);
      // GST-verified customer uses legal profile details and locks them on UI side.
      resolvedName = gstProfile.legalName;
      resolvedFirmName = gstProfile.tradeName || gstProfile.legalName;
      resolvedAddress = gstProfile.address;
    }

    if (!resolvedName) {
      return res.status(400).json({ message: "name is required" });
    }

    const normalizedShippingAddresses = await validateShippingAddressGstNumbers(shippingAddresses);

    const result = await pool.query(
      `INSERT INTO customers (seller_id, name, mobile, email, firm_name, address, gst_number, discount_percent, monthly_billing, shipping_addresses)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::jsonb, '[]'::jsonb))
       RETURNING *`,
      [
        tenantId,
        resolvedName,
        mobile || null,
        email || null,
        resolvedFirmName || null,
        resolvedAddress || null,
        normalizedGstNumber || null,
        discountPercent || null,
        Boolean(monthlyBilling),
        JSON.stringify(normalizedShippingAddresses)
      ]
    );

    res.status(201).json({
      ...result.rows[0],
      gstVerified: Boolean(gstProfile),
      gstProfile: gstProfile
        ? {
            gstNumber: gstProfile.gstNumber,
            legalName: gstProfile.legalName,
            tradeName: gstProfile.tradeName,
            address: gstProfile.address
          }
        : null
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      message: error.message,
      field: error.field || undefined
    });
  }
});

module.exports = router;
