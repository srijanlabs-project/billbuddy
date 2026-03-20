const express = require("express");
const pool = require("../db/db");
const { createQuotationWithItems } = require("../services/quotationService");

const router = express.Router();

function toAmount(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toFeet(value, unit) {
  const numeric = toAmount(value);
  if (unit === "in") return numeric / 12;
  if (unit === "mm") return numeric * 0.00328084;
  return numeric;
}

function computeMobileLineTotal(item) {
  const heightFt = toFeet(item.height, item.unitType);
  const widthFt = toFeet(item.width, item.unitType);
  const qty = toAmount(item.qty);
  const rate = toAmount(item.rate);
  return Number((heightFt * widthFt * qty * rate).toFixed(2));
}

async function logMobileAudit({ sellerId, userId, actionKey, detail = {} }) {
  await pool.query(
    `INSERT INTO mobile_audit_logs (seller_id, user_id, action_key, detail)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [sellerId || null, userId || null, actionKey, JSON.stringify(detail)]
  );
}

async function findOrCreateCustomer({ sellerId, customer }) {
  const mobile = (customer.mobile || "").trim();
  const name = (customer.name || "").trim();
  if (!mobile || !name) {
    throw new Error("Customer name and mobile are required");
  }

  const existing = await pool.query(
    `SELECT id FROM customers WHERE seller_id = $1 AND mobile = $2 LIMIT 1`,
    [sellerId, mobile]
  );

  if (existing.rowCount > 0) return existing.rows[0].id;

  const created = await pool.query(
    `INSERT INTO customers (seller_id, name, firm_name, mobile)
     VALUES ($1, $2, $2, $3)
     RETURNING id`,
    [sellerId, name, mobile]
  );

  return created.rows[0].id;
}

router.post("/quotations", async (req, res) => {
  try {
    const sellerId = req.user.sellerId;
    const createdBy = req.user.id;
    const { customer, items, totals } = req.body;

    const customerId = await findOrCreateCustomer({ sellerId, customer });

    const mappedItems = (items || []).map((item) => {
      const lineTotal = computeMobileLineTotal(item);
      const displayText = item.customText || item.type || "Item";
      const qty = toAmount(item.qty);
      const effectiveQuantity = qty || 1;
      const unitPrice = effectiveQuantity > 0 ? Number((lineTotal / effectiveQuantity).toFixed(2)) : lineTotal;

      return {
        size: `${item.height || 0} x ${item.width || 0} ${item.unitType || "ft"}`,
        quantity: effectiveQuantity,
        unit_price: unitPrice,
        total_price: lineTotal,
        material_type: item.type || null,
        thickness: item.thickness || null,
        color_name: item.color || null,
        imported_color_note: item.otherInfo || null,
        ps_included: Boolean(item.includePw),
        item_note: item.customText || null,
        design_name: displayText
      };
    });

    const quotation = await createQuotationWithItems({
      sellerId,
      customerId,
      createdBy,
      items: mappedItems,
      gstPercent: 0,
      transportCharges: 0,
      designCharges: 0,
      discountAmount: totals?.discountAmount || 0,
      advanceAmount: totals?.advancePayment || 0,
      paymentStatus: toAmount(totals?.advancePayment) > 0 ? "partial" : "pending",
      orderStatus: "NEW",
      deliveryType: "PICKUP",
      sourceChannel: "mobile-app"
    });

    await logMobileAudit({
      sellerId,
      userId: createdBy,
      actionKey: "mobile_quotation_created",
      detail: {
        quotationId: quotation.quotation.id,
        itemCount: mappedItems.length
      }
    });

    return res.status(201).json(quotation);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.get("/quotations/search", async (req, res) => {
  try {
    const sellerId = req.user.sellerId;
    const query = String(req.query.q || "").trim();
    if (!query) return res.json([]);

    const like = `%${query}%`;
    const result = await pool.query(
      `SELECT q.id, q.quotation_number, q.seller_quotation_number, q.custom_quotation_number, q.version_no, q.total_amount, q.created_at, c.name AS customer_name, c.mobile
       FROM quotations q
       LEFT JOIN customers c ON c.id = q.customer_id
       WHERE q.seller_id = $1
         AND (
           q.quotation_number ILIKE $2 OR
           q.seller_quotation_number ILIKE $2 OR
           q.custom_quotation_number ILIKE $2 OR
           c.name ILIKE $2 OR
           c.mobile ILIKE $2
         )
       ORDER BY q.created_at DESC
       LIMIT 25`,
      [sellerId, like]
    );

    await logMobileAudit({
      sellerId,
      userId: req.user.id,
      actionKey: "mobile_quotation_search",
      detail: { query }
    });

    return res.json(result.rows);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const sellerId = req.user.sellerId;
    const userId = req.user.id;
    const range = String(req.query.range || "today");
    const days = range === "month" ? 30 : range === "week" ? 7 : 1;

    const result = await pool.query(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(total_amount), 0) AS amount
       FROM quotations
       WHERE seller_id = $1
         AND created_by = $2
         AND created_at >= CURRENT_DATE - (($3::int - 1) * INTERVAL '1 day')`,
      [sellerId, userId, days]
    );

    await logMobileAudit({
      sellerId,
      userId,
      actionKey: "mobile_summary_viewed",
      detail: { range }
    });

    return res.json(result.rows[0] || { count: 0, amount: 0 });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
