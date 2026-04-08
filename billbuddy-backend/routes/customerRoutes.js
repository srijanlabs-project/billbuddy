const express = require("express");
const pool = require("../db/db");
const { getTenantId } = require("../middleware/auth");
const { PERMISSIONS, normalizeRoleName, requirePermission } = require("../rbac/permissions");
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

function extractPanFromGst(gstNumber) {
  const normalized = normalizeGstNumber(gstNumber);
  return normalized ? normalized.slice(2, 12) : "";
}

async function validateShippingAddressGstNumbers(shippingAddresses, primaryCustomerGstNumber = "") {
  const normalizedAddresses = normalizeShippingAddresses(shippingAddresses);
  const normalizedPrimaryGst = normalizeGstNumber(primaryCustomerGstNumber);
  const primaryPan = extractPanFromGst(normalizedPrimaryGst);
  for (let index = 0; index < normalizedAddresses.length; index += 1) {
    const gstNumber = normalizeGstNumber(normalizedAddresses[index]?.gstNumber || "");
    if (!gstNumber) continue;
    if (!normalizedPrimaryGst) {
      const validationError = new Error("Shipping GST can be added only when primary customer GST is present.");
      validationError.statusCode = 400;
      validationError.field = `shippingAddresses[${index}].gstNumber`;
      throw validationError;
    }
    const shippingPan = extractPanFromGst(gstNumber);
    if (primaryPan && shippingPan && primaryPan !== shippingPan) {
      const panMismatchError = new Error("Shipping GST must belong to the same business PAN as customer GST.");
      panMismatchError.statusCode = 400;
      panMismatchError.field = `shippingAddresses[${index}].gstNumber`;
      throw panMismatchError;
    }
    try {
      await validateAndFetchGstProfile(gstNumber);
    } catch (error) {
      error.field = `shippingAddresses[${index}].gstNumber`;
      throw error;
    }
  }
  return normalizedAddresses;
}

function toAuditState(customerRow = {}) {
  return {
    id: customerRow.id || null,
    seller_id: customerRow.seller_id || null,
    name: customerRow.name || "",
    firm_name: customerRow.firm_name || "",
    mobile: customerRow.mobile || "",
    email: customerRow.email || "",
    address: customerRow.address || "",
    gst_number: customerRow.gst_number || "",
    discount_percent: customerRow.discount_percent ?? null,
    monthly_billing: Boolean(customerRow.monthly_billing),
    shipping_addresses: Array.isArray(customerRow.shipping_addresses) ? customerRow.shipping_addresses : [],
    created_by_user_id: customerRow.created_by_user_id || null,
    updated_by_user_id: customerRow.updated_by_user_id || null
  };
}

function getChangedFields(beforeState = {}, afterState = {}) {
  const keys = new Set([...Object.keys(beforeState), ...Object.keys(afterState)]);
  const changed = [];
  keys.forEach((key) => {
    const beforeValue = beforeState[key];
    const afterValue = afterState[key];
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changed.push(key);
    }
  });
  return changed;
}

async function writeCustomerAuditLog(client, { customerId, sellerId, actorUserId, actionKey, beforeState, afterState, changedFields }) {
  await client.query(
    `INSERT INTO customer_audit_logs (customer_id, seller_id, actor_user_id, action_key, before_state, after_state, changed_fields)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb)`,
    [
      customerId,
      sellerId || null,
      actorUserId || null,
      actionKey,
      beforeState ? JSON.stringify(beforeState) : null,
      afterState ? JSON.stringify(afterState) : null,
      JSON.stringify(Array.isArray(changedFields) ? changedFields : [])
    ]
  );
}

router.get("/", requirePermission(PERMISSIONS.CUSTOMER_VIEW), async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const values = [];
    const whereParts = ["archived_at IS NULL"];
    if (tenantId) {
      values.push(tenantId);
      whereParts.push(`seller_id = $${values.length}`);
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

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
  const client = await pool.connect();
  let transactionOpen = false;
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

    const normalizedShippingAddresses = await validateShippingAddressGstNumbers(shippingAddresses, normalizedGstNumber);

    await client.query("BEGIN");
    transactionOpen = true;
    const result = await client.query(
      `INSERT INTO customers (seller_id, name, mobile, email, firm_name, address, gst_number, discount_percent, monthly_billing, shipping_addresses, created_by_user_id, updated_by_user_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::jsonb, '[]'::jsonb), $11, $12, CURRENT_TIMESTAMP)
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
        JSON.stringify(normalizedShippingAddresses),
        req.user?.id || null,
        req.user?.id || null
      ]
    );
    const createdCustomer = result.rows[0];
    await writeCustomerAuditLog(client, {
      customerId: createdCustomer.id,
      sellerId: createdCustomer.seller_id,
      actorUserId: req.user?.id || null,
      actionKey: "customer.created",
      beforeState: null,
      afterState: toAuditState(createdCustomer),
      changedFields: ["created"]
    });
    await client.query("COMMIT");
    transactionOpen = false;

    res.status(201).json({
      ...createdCustomer,
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
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }
    res.status(error.statusCode || 500).json({
      message: error.message,
      field: error.field || undefined
    });
  } finally {
    client.release();
  }
});

router.patch("/:id", requirePermission(PERMISSIONS.CUSTOMER_EDIT), async (req, res) => {
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    const customerId = Number(req.params.id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      return res.status(400).json({ message: "Valid customer id is required" });
    }

    const { sellerId, name, mobile, email, firmName, address, gstNumber, discountPercent, monthlyBilling, shippingAddresses } = req.body || {};
    const tenantId = req.user.isPlatformAdmin ? Number(sellerId || getTenantId(req)) : getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const existingResult = await client.query(
      `SELECT * FROM customers WHERE id = $1 AND seller_id = $2 AND archived_at IS NULL LIMIT 1`,
      [customerId, tenantId]
    );
    if (existingResult.rowCount === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const existingCustomer = existingResult.rows[0];
    const isSubUser = !req.user?.isPlatformAdmin && normalizeRoleName(req.user?.role) === "sub_user";
    if (isSubUser && Number(existingCustomer.created_by_user_id || 0) !== Number(req.user?.id || 0)) {
      return res.status(403).json({ message: "Sub User can edit only customers created by self." });
    }

    const hasName = Object.prototype.hasOwnProperty.call(req.body || {}, "name");
    const hasFirmName = Object.prototype.hasOwnProperty.call(req.body || {}, "firmName");
    const hasAddress = Object.prototype.hasOwnProperty.call(req.body || {}, "address");
    const hasMobile = Object.prototype.hasOwnProperty.call(req.body || {}, "mobile");
    const hasEmail = Object.prototype.hasOwnProperty.call(req.body || {}, "email");
    const hasDiscount = Object.prototype.hasOwnProperty.call(req.body || {}, "discountPercent");
    const hasMonthlyBilling = Object.prototype.hasOwnProperty.call(req.body || {}, "monthlyBilling");
    const hasShipping = Object.prototype.hasOwnProperty.call(req.body || {}, "shippingAddresses");
    const hasGst = Object.prototype.hasOwnProperty.call(req.body || {}, "gstNumber");

    const normalizedGstNumber = hasGst ? normalizeGstNumber(gstNumber) : normalizeGstNumber(existingCustomer.gst_number);
    let resolvedName = hasName ? String(name || "").trim() : String(existingCustomer.name || "").trim();
    let resolvedFirmName = hasFirmName ? String(firmName || "").trim() : String(existingCustomer.firm_name || "").trim();
    let resolvedAddress = hasAddress ? String(address || "").trim() : String(existingCustomer.address || "").trim();
    let gstProfile = null;

    if (normalizedGstNumber) {
      gstProfile = await validateAndFetchGstProfile(normalizedGstNumber);
      resolvedName = gstProfile.legalName;
      resolvedFirmName = gstProfile.tradeName || gstProfile.legalName;
      resolvedAddress = gstProfile.address;
    }

    if (!resolvedName) {
      return res.status(400).json({ message: "name is required" });
    }

    const normalizedShippingAddresses = hasShipping
      ? await validateShippingAddressGstNumbers(shippingAddresses, normalizedGstNumber)
      : normalizeShippingAddresses(existingCustomer.shipping_addresses);

    const beforeState = toAuditState(existingCustomer);

    await client.query("BEGIN");
    transactionOpen = true;
    const updatedResult = await client.query(
      `UPDATE customers
       SET name = $1,
           mobile = $2,
           email = $3,
           firm_name = $4,
           address = $5,
           gst_number = $6,
           discount_percent = $7,
           monthly_billing = $8,
           shipping_addresses = COALESCE($9::jsonb, '[]'::jsonb),
           updated_by_user_id = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 AND seller_id = $12
       RETURNING *`,
      [
        resolvedName,
        hasMobile ? String(mobile || "").trim() || null : existingCustomer.mobile || null,
        hasEmail ? String(email || "").trim() || null : existingCustomer.email || null,
        resolvedFirmName || null,
        resolvedAddress || null,
        normalizedGstNumber || null,
        hasDiscount ? (discountPercent ?? null) : existingCustomer.discount_percent ?? null,
        hasMonthlyBilling ? Boolean(monthlyBilling) : Boolean(existingCustomer.monthly_billing),
        JSON.stringify(normalizedShippingAddresses),
        req.user?.id || null,
        customerId,
        tenantId
      ]
    );

    const updatedCustomer = updatedResult.rows[0];
    const afterState = toAuditState(updatedCustomer);
    const changedFields = getChangedFields(beforeState, afterState);

    await writeCustomerAuditLog(client, {
      customerId: updatedCustomer.id,
      sellerId: updatedCustomer.seller_id,
      actorUserId: req.user?.id || null,
      actionKey: "customer.updated",
      beforeState,
      afterState,
      changedFields
    });
    await client.query("COMMIT");
    transactionOpen = false;

    return res.json({
      ...updatedCustomer,
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
    if (transactionOpen) {
      await client.query("ROLLBACK");
    }
    return res.status(error.statusCode || 500).json({
      message: error.message || "Unable to update customer",
      field: error.field || undefined
    });
  } finally {
    client.release();
  }
});

router.delete("/:id", requirePermission(PERMISSIONS.CUSTOMER_EDIT), async (req, res) => {
  try {
    const customerId = Number(req.params.id);
    if (!Number.isFinite(customerId) || customerId <= 0) {
      return res.status(400).json({ message: "Valid customer id is required" });
    }
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const activeQuotationResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM quotations
       WHERE seller_id = $1
         AND customer_id = $2
         AND archived_at IS NULL
         AND COALESCE(record_status, 'submitted') <> 'archived'`,
      [tenantId, customerId]
    );
    if (Number(activeQuotationResult.rows[0]?.count || 0) > 0) {
      return res.status(400).json({ message: "Customer has active quotations. Archive those quotations first." });
    }

    const result = await pool.query(
      `UPDATE customers
       SET archived_at = CURRENT_TIMESTAMP,
           archived_by_user_id = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
         AND seller_id = $3
         AND archived_at IS NULL
       RETURNING id`,
      [req.user?.id || null, customerId, tenantId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Customer not found" });
    }

    return res.json({ message: "Customer archived successfully." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to archive customer" });
  }
});

module.exports = router;
