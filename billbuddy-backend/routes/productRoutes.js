const express = require("express");
const pool = require("../db/db");
const { getTenantId } = require("../middleware/auth");

const router = express.Router();

function normalizeCatalogueFieldKey(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

  if (normalized === "colour" || normalized === "colour_name") return "color_name";
  if (["material", "service", "services", "service_name", "services_name", "service_title", "services_title", "item_name", "product_name"].includes(normalized)) {
    return "material_name";
  }
  if (normalized === "uom" || normalized === "unit") return "unit_type";
  if (normalized === "price" || normalized === "rate") return "base_price";
  return normalized;
}

async function getSellerCustomCatalogueFields(sellerId) {
  const result = await pool.query(
    `SELECT scf.field_key, scf.label, scf.field_type, scf.option_values, scf.required
     FROM seller_configuration_profiles scp
     INNER JOIN seller_catalogue_fields scf ON scf.profile_id = scp.id
     WHERE scp.seller_id = $1
       AND scp.status = 'published'
     ORDER BY scf.display_order ASC, scf.id ASC`,
    [sellerId]
  );

  const builtInKeys = new Set([
    "material_name",
    "material_group",
    "category",
    "color_name",
    "thickness",
    "unit_type",
    "pricing_type",
    "base_price",
    "sku",
    "always_available",
    "ps_supported"
  ]);

  return result.rows.filter((field) => !builtInKeys.has(normalizeCatalogueFieldKey(field.field_key)));
}

function validateProductCustomFields(customFields = {}, customConfigFields = []) {
  customConfigFields.forEach((field) => {
    const fieldLabel = field.label || field.field_key || "Custom field";
    const fieldValue = customFields?.[field.field_key];
    const fieldType = String(field.field_type || "text").toLowerCase();

    if (field.required) {
      if (fieldType === "checkbox") {
        if (fieldValue !== true) throw new Error(`${fieldLabel} is required.`);
      } else if (fieldValue === undefined || fieldValue === null || String(fieldValue).trim() === "") {
        throw new Error(`${fieldLabel} is required.`);
      }
    }

    if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
      if (fieldType === "number" && Number.isNaN(Number(fieldValue))) {
        throw new Error(`${fieldLabel} must be numeric.`);
      }
      if (fieldType === "checkbox" && typeof fieldValue !== "boolean") {
        throw new Error(`${fieldLabel} must be true or false.`);
      }
      if (fieldType === "dropdown") {
        const allowedOptions = Array.isArray(field.option_values)
          ? field.option_values.map((option) => String(option || "").trim()).filter(Boolean)
          : [];
        if (allowedOptions.length && !allowedOptions.includes(String(fieldValue).trim())) {
          throw new Error(`${fieldLabel} must match one of the configured options.`);
        }
      }
    }
  });
}

function validateRequiredProductFields({ materialName, category, sku }) {
  if (!String(materialName || "").trim()) {
    throw new Error("materialName is required");
  }
  if (!String(category || "").trim()) {
    throw new Error("category is required");
  }
  if (!String(sku || "").trim()) {
    throw new Error("sku is required");
  }
}

router.get("/", async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const values = [];
    const where = tenantId ? "WHERE seller_id = $1" : "";
    if (tenantId) values.push(tenantId);

    const result = await pool.query(`SELECT * FROM products ${where} ORDER BY id DESC`, values);
    res.json(result.rows);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/:productId/variants", async (req, res) => {
  try {
    const { productId } = req.params;
    const tenantId = getTenantId(req);

    const values = [productId];
    let where = "WHERE product_id = $1";
    if (tenantId) {
      where += " AND seller_id = $2";
      values.push(tenantId);
    }

    const result = await pool.query(`SELECT * FROM product_variants ${where} ORDER BY id DESC`, values);
    res.json(result.rows);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const {
      materialName,
      category,
      basePrice,
      gstPercent,
      sellerId,
      sku,
      thickness,
      designName,
      inventoryQty,
      alwaysAvailable,
      unitType,
      defaultWidth,
      defaultHeight,
      materialGroup,
      colorName,
      psSupported,
      pricingType,
      customFields
    } = req.body;

    const tenantId = req.user.isPlatformAdmin ? Number(sellerId || getTenantId(req)) : getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    validateRequiredProductFields({ materialName, category, sku });
    const customConfigFields = await getSellerCustomCatalogueFields(tenantId);
    validateProductCustomFields(customFields || {}, customConfigFields);

    const result = await pool.query(
      `INSERT INTO products (seller_id, material_name, category, base_price, gst_percent, sku, thickness, design_name, inventory_qty, always_available, unit_type, default_width, default_height, material_group, color_name, ps_supported, pricing_type, custom_fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 0), COALESCE($10, FALSE), COALESCE($11, 'COUNT'), $12, $13, $14, $15, COALESCE($16, FALSE), COALESCE($17, 'SFT'), COALESCE($18::jsonb, '{}'::jsonb))
       RETURNING *`,
      [
        tenantId,
        materialName,
        category || null,
        basePrice || null,
        gstPercent || null,
        sku || null,
        thickness || null,
        designName || null,
        inventoryQty ?? 0,
        Boolean(alwaysAvailable),
        (unitType || "COUNT").toUpperCase(),
        defaultWidth || null,
        defaultHeight || null,
        materialGroup || null,
        colorName || null,
        Boolean(psSupported),
        String(pricingType || "SFT").toUpperCase(),
        JSON.stringify(customFields || {})
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/bulk", async (req, res) => {
  try {
    const { sellerId, products } = req.body;
    const tenantId = req.user.isPlatformAdmin ? Number(sellerId || getTenantId(req)) : getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "products array is required" });
    }

    const customConfigFields = await getSellerCustomCatalogueFields(tenantId);

    const inserted = [];
    for (const product of products) {
      validateRequiredProductFields(product);
      validateProductCustomFields(product.customFields || {}, customConfigFields);

      const result = await pool.query(
        `INSERT INTO products (seller_id, material_name, category, base_price, gst_percent, sku, thickness, design_name, inventory_qty, always_available, unit_type, default_width, default_height, material_group, color_name, ps_supported, pricing_type, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 0), COALESCE($10, FALSE), COALESCE($11, 'COUNT'), $12, $13, $14, $15, COALESCE($16, FALSE), COALESCE($17, 'SFT'), COALESCE($18::jsonb, '{}'::jsonb))
         RETURNING *`,
        [
          tenantId,
          product.materialName,
          product.category || null,
          product.basePrice || null,
          product.gstPercent || null,
          product.sku || null,
          product.thickness || null,
          product.designName || null,
          product.inventoryQty ?? 0,
          Boolean(product.alwaysAvailable),
          (product.unitType || "COUNT").toUpperCase(),
          product.defaultWidth || null,
          product.defaultHeight || null,
          product.materialGroup || null,
          product.colorName || null,
          Boolean(product.psSupported),
          String(product.pricingType || "SFT").toUpperCase(),
          JSON.stringify(product.customFields || {})
        ]
      );

      inserted.push(result.rows[0]);
    }

    res.status(201).json({ insertedCount: inserted.length, products: inserted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.isPlatformAdmin ? Number(req.body.sellerId || getTenantId(req)) : getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const customConfigFields = await getSellerCustomCatalogueFields(tenantId);

    const existingResult = await pool.query(
      `SELECT * FROM products WHERE id = $1 AND seller_id = $2 LIMIT 1`,
      [id, tenantId]
    );

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const existing = existingResult.rows[0];
    const {
      materialName,
      category,
      basePrice,
      gstPercent,
      thickness,
      designName,
      inventoryQty,
      alwaysAvailable,
      unitType,
      defaultWidth,
      defaultHeight,
      materialGroup,
      colorName,
      psSupported,
      pricingType,
      sku,
      customFields
    } = req.body;

    validateRequiredProductFields({
      materialName: materialName ?? existing.material_name,
      category: category ?? existing.category,
      sku: sku === undefined ? existing.sku : sku
    });

    const result = await pool.query(
      `UPDATE products
       SET material_name = $1,
           category = $2,
           base_price = $3,
           gst_percent = $4,
           sku = $5,
           thickness = $6,
           design_name = $7,
           inventory_qty = $8,
           always_available = $9,
           unit_type = $10,
           default_width = $11,
           default_height = $12,
           material_group = $13,
           color_name = $14,
           ps_supported = $15,
           pricing_type = $16,
           custom_fields = $17::jsonb
       WHERE id = $18 AND seller_id = $19
       RETURNING *`,
      [
        materialName ?? existing.material_name,
        category ?? existing.category,
        basePrice ?? existing.base_price,
        gstPercent ?? existing.gst_percent,
        sku === undefined ? existing.sku : (sku || null),
        thickness ?? existing.thickness,
        designName ?? existing.design_name,
        inventoryQty ?? existing.inventory_qty ?? 0,
        alwaysAvailable === undefined ? existing.always_available : Boolean(alwaysAvailable),
        String(unitType || existing.unit_type || "COUNT").toUpperCase(),
        defaultWidth ?? existing.default_width,
        defaultHeight ?? existing.default_height,
        materialGroup ?? existing.material_group,
        colorName ?? existing.color_name,
        psSupported === undefined ? existing.ps_supported : Boolean(psSupported),
        String(pricingType || existing.pricing_type || "SFT").toUpperCase(),
        (() => {
          const resolvedCustomFields = customFields === undefined ? (existing.custom_fields || {}) : (customFields || {});
          validateProductCustomFields(resolvedCustomFields, customConfigFields);
          return JSON.stringify(resolvedCustomFields);
        })(),
        id,
        tenantId
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch("/:id/inventory", async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const { inventoryQty, alwaysAvailable } = req.body;

    const values = [inventoryQty ?? 0, Boolean(alwaysAvailable), id];
    let where = "id = $3";

    if (tenantId) {
      values.push(tenantId);
      where += " AND seller_id = $4";
    }

    const result = await pool.query(
      `UPDATE products
       SET inventory_qty = $1,
           always_available = $2
       WHERE ${where}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.patch("/:id/unit-config", async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);
    const { unitType, defaultWidth, defaultHeight } = req.body;

    const normalizedUnit = String(unitType || "COUNT").toUpperCase();
    if (!["COUNT", "SFT"].includes(normalizedUnit)) {
      return res.status(400).json({ message: "unitType must be COUNT or SFT" });
    }

    const values = [normalizedUnit, defaultWidth || null, defaultHeight || null, id];
    let where = "id = $4";

    if (tenantId) {
      values.push(tenantId);
      where += " AND seller_id = $5";
    }

    const result = await pool.query(
      `UPDATE products
       SET unit_type = $1,
           default_width = $2,
           default_height = $3
       WHERE ${where}
       RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/:productId/variants", async (req, res) => {
  try {
    const { productId } = req.params;
    const { variantName, size, unitPrice, sellerId } = req.body;

    if (!variantName) {
      return res.status(400).json({ message: "variantName is required" });
    }

    const tenantId = req.user.isPlatformAdmin ? Number(sellerId || getTenantId(req)) : getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ message: "sellerId is required" });
    }

    const productCheck = await pool.query(
      `SELECT id FROM products WHERE id = $1 AND seller_id = $2 LIMIT 1`,
      [productId, tenantId]
    );

    if (productCheck.rowCount === 0) {
      return res.status(404).json({ message: "Product not found for seller" });
    }

    const result = await pool.query(
      `INSERT INTO product_variants (seller_id, product_id, variant_name, size, unit_price)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, productId, variantName, size || null, unitPrice || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
