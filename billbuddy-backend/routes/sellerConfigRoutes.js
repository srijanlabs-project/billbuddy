const express = require("express");
const pool = require("../db/db");
const { PERMISSIONS, requirePermission } = require("../rbac/permissions");

const router = express.Router();

const DEFAULT_MODULES = {
  products: true,
  quotations: true,
  customers: true,
  payments: true,
  reports: true,
  quotationProductSelector: true,
  combineHelpingTextInItemColumn: false
};

const DEFAULT_ITEM_DISPLAY_CONFIG = {
  defaultPattern: "",
  categoryRules: []
};

function normalizeSellerType(value) {
  const normalized = String(value || "BASIC").trim().toUpperCase();
  return normalized === "ADVANCED" ? "ADVANCED" : "BASIC";
}

function validateSellerConfigurationByType(sellerType, itemDisplayConfig) {
  if (normalizeSellerType(sellerType) !== "ADVANCED" && (itemDisplayConfig?.categoryRules || []).length > 0) {
    return "Category-based item display rules are available only for Advanced sellers.";
  }
  return "";
}

function normalizeItemDisplayConfig(config = {}) {
  const categoryRules = Array.isArray(config.categoryRules) ? config.categoryRules : [];
  return {
    defaultPattern: String(config.defaultPattern || "").trim(),
    categoryRules: categoryRules
      .map((rule) => ({
        category: String(rule.category || "").trim(),
        pattern: String(rule.pattern || "").trim()
      }))
      .filter((rule) => rule.category && rule.pattern)
  };
}

function normalizeModules(modules = {}) {
  return {
    ...DEFAULT_MODULES,
    ...(modules || {}),
    itemDisplayConfig: normalizeItemDisplayConfig(modules?.itemDisplayConfig || DEFAULT_ITEM_DISPLAY_CONFIG)
  };
}

function canAccessSellerConfiguration(req, sellerId) {
  if (req.user?.isPlatformAdmin) return true;
  return Number(req.user?.sellerId) === Number(sellerId);
}

function normalizeOptionValues(rawValue) {
  return (Array.isArray(rawValue) ? rawValue : String(rawValue || "").split(/[,\n|]/))
    .map((option) => String(option || "").trim())
    .filter(Boolean);
}

function normalizeCategoryVisibility(rawValue) {
  return (Array.isArray(rawValue) ? rawValue : String(rawValue || "").split(/[,\n|]/))
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function normalizeCatalogueFields(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .map((field, index) => ({
      id: field.id || `cat-${index + 1}`,
      key: String(field.key || "").trim(),
      label: String(field.label || "").trim(),
      type: String(field.type || "text").trim() || "text",
      options: normalizeOptionValues(field.options),
      required: Boolean(field.required),
      visibleInList: Boolean(field.visibleInList),
      uploadEnabled: Boolean(field.uploadEnabled),
      displayOrder: Number.isFinite(Number(field.displayOrder)) ? Number(field.displayOrder) : index
    }))
    .filter((field) => field.key && field.label);
}

function normalizeQuotationColumns(columns = []) {
  return (Array.isArray(columns) ? columns : [])
    .map((column, index) => ({
      id: column.id || `col-${index + 1}`,
      key: String(column.key || "").trim(),
      label: String(column.label || "").trim(),
      type: String(column.type || "text").trim() || "text",
      options: normalizeOptionValues(column.options),
      definition: String(column.definition || "").trim(),
      formulaExpression: String(column.formulaExpression || "").trim(),
      required: Boolean(column.required),
      visibleInForm: Boolean(column.visibleInForm),
      visibleInPdf: Boolean(column.visibleInPdf),
      helpTextInPdf: Boolean(column.helpTextInPdf),
      includedInCalculation: Boolean(column.includedInCalculation),
      categoryVisibility: normalizeCategoryVisibility(column.categoryVisibility ?? column.category_visibility),
      displayOrder: Number.isFinite(Number(column.displayOrder)) ? Number(column.displayOrder) : index
    }))
    .filter((column) => column.key && column.label);
}

function buildProfileResponse(profileRow, catalogueRows, quotationRows, versionRows) {
  if (!profileRow) {
    return null;
  }

  return {
    profileId: profileRow.id,
    sellerId: profileRow.seller_id,
    profileName: profileRow.profile_name,
    status: profileRow.status,
    modules: normalizeModules(profileRow.modules),
    itemDisplayConfig: normalizeItemDisplayConfig(profileRow.modules?.itemDisplayConfig || DEFAULT_ITEM_DISPLAY_CONFIG),
    publishedAt: profileRow.published_at || null,
    updatedAt: profileRow.updated_at || null,
    catalogueFields: catalogueRows.map((field) => ({
      id: `catalogue-${field.id}`,
      displayOrder: Number(field.display_order || 0),
      key: field.field_key,
      label: field.label,
      type: field.field_type,
      options: Array.isArray(field.option_values) ? field.option_values : [],
      required: Boolean(field.required),
      visibleInList: Boolean(field.visible_in_list),
      uploadEnabled: Boolean(field.upload_enabled)
    })),
    quotationColumns: quotationRows.map((column) => ({
      id: `quotation-${column.id}`,
      displayOrder: Number(column.display_order || 0),
      key: column.column_key,
      label: column.label,
      type: column.column_type,
      options: Array.isArray(column.option_values) ? column.option_values : [],
      definition: column.definition_text || "",
      formulaExpression: column.formula_expression || "",
      required: Boolean(column.required),
      visibleInForm: Boolean(column.visible_in_form),
      visibleInPdf: Boolean(column.visible_in_pdf),
      helpTextInPdf: Boolean(column.help_text_in_pdf),
      includedInCalculation: Boolean(column.included_in_calculation),
      categoryVisibility: Array.isArray(column.category_visibility) ? column.category_visibility : []
    })),
    versions: versionRows.map((version) => ({
      id: version.id,
      versionNo: version.version_no,
      status: version.status,
      createdAt: version.created_at,
      publishedAt: version.published_at || null,
      actorUserId: version.actor_user_id || null
    }))
  };
}

async function loadSellerConfiguration(clientOrPool, sellerId) {
  const profileResult = await clientOrPool.query(
    `SELECT *
     FROM seller_configuration_profiles
     WHERE seller_id = $1
     LIMIT 1`,
    [sellerId]
  );

  if (profileResult.rowCount === 0) {
    return null;
  }

  const profile = profileResult.rows[0];

  const catalogueResult = await clientOrPool.query(
    `SELECT *
     FROM seller_catalogue_fields
     WHERE profile_id = $1
     ORDER BY display_order ASC, id ASC`,
    [profile.id]
  );

  const quotationResult = await clientOrPool.query(
    `SELECT *
     FROM seller_quotation_columns
     WHERE profile_id = $1
     ORDER BY display_order ASC, id ASC`,
    [profile.id]
  );

  const versionResult = await clientOrPool.query(
    `SELECT id, version_no, status, actor_user_id, published_at, created_at
     FROM seller_configuration_versions
     WHERE profile_id = $1
     ORDER BY version_no DESC, id DESC
     LIMIT 20`,
    [profile.id]
  );

  return buildProfileResponse(profile, catalogueResult.rows, quotationResult.rows, versionResult.rows);
}

async function loadCurrentSellerConfiguration(clientOrPool, sellerId) {
  const profileResult = await clientOrPool.query(
    `SELECT *
     FROM seller_configuration_profiles
     WHERE seller_id = $1
       AND published_at IS NOT NULL
     ORDER BY published_at DESC NULLS LAST, updated_at DESC, id DESC
     LIMIT 1`,
    [sellerId]
  );

  if (profileResult.rowCount === 0) {
    return null;
  }

  const profile = profileResult.rows[0];
  const catalogueResult = await clientOrPool.query(
    `SELECT *
     FROM seller_catalogue_fields
     WHERE profile_id = $1
     ORDER BY display_order ASC, id ASC`,
    [profile.id]
  );
  const quotationResult = await clientOrPool.query(
    `SELECT *
     FROM seller_quotation_columns
     WHERE profile_id = $1
     ORDER BY display_order ASC, id ASC`,
    [profile.id]
  );
  const versionResult = await clientOrPool.query(
    `SELECT id, version_no, status, actor_user_id, published_at, created_at
     FROM seller_configuration_versions
     WHERE profile_id = $1
     ORDER BY version_no DESC, id DESC
     LIMIT 20`,
    [profile.id]
  );

  return buildProfileResponse(profile, catalogueResult.rows, quotationResult.rows, versionResult.rows);
}

router.get("/current/me", requirePermission(PERMISSIONS.CONFIGURATION_VIEW), async (req, res) => {
  try {
    if (!req.user?.sellerId) {
      return res.json({ config: null });
    }

    const config = await loadCurrentSellerConfiguration(pool, req.user.sellerId);
    return res.json({ config });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/:sellerId", requirePermission(PERMISSIONS.CONFIGURATION_VIEW), async (req, res) => {
  try {
    const sellerId = Number(req.params.sellerId);
    if (!Number.isFinite(sellerId) || sellerId <= 0) {
      return res.status(400).json({ message: "Valid sellerId is required" });
    }
    if (!canAccessSellerConfiguration(req, sellerId)) {
      return res.status(403).json({ message: "You can only access your own seller configuration" });
    }

    const sellerExists = await pool.query(`SELECT id FROM sellers WHERE id = $1 LIMIT 1`, [sellerId]);
    if (sellerExists.rowCount === 0) {
      return res.status(404).json({ message: "Seller not found" });
    }

    const config = await loadSellerConfiguration(pool, sellerId);
    return res.json({ config });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.put(
  "/:sellerId",
  requirePermission(PERMISSIONS.CONFIGURATION_EDIT),
  requirePermission(PERMISSIONS.CONFIGURATION_SAVE_DRAFT),
  async (req, res) => {
  const client = await pool.connect();

  try {
    const sellerId = Number(req.params.sellerId);
    if (!Number.isFinite(sellerId) || sellerId <= 0) {
      return res.status(400).json({ message: "Valid sellerId is required" });
    }
    if (!canAccessSellerConfiguration(req, sellerId)) {
      return res.status(403).json({ message: "You can only update your own seller configuration" });
    }

    const profileName = String(req.body.profileName || "").trim();
    if (!profileName) {
      return res.status(400).json({ message: "profileName is required" });
    }

    const modules = normalizeModules(req.body.modules);
    const itemDisplayConfig = normalizeItemDisplayConfig(req.body.itemDisplayConfig || modules.itemDisplayConfig || DEFAULT_ITEM_DISPLAY_CONFIG);
    const persistedModules = {
      ...modules,
      itemDisplayConfig
    };
    const catalogueFields = normalizeCatalogueFields(req.body.catalogueFields);
    const quotationColumns = normalizeQuotationColumns(req.body.quotationColumns);
    if (String(req.body.status || "").toLowerCase() === "published") {
      return res.status(403).json({ message: "Use the publish action to publish configuration." });
    }
    const requestedStatus = "draft";

    const sellerExists = await client.query(
      `SELECT id, name, seller_type
       FROM sellers
       WHERE id = $1
       LIMIT 1`,
      [sellerId]
    );
    if (sellerExists.rowCount === 0) {
      throw new Error("Seller not found");
    }
    const sellerType = normalizeSellerType(sellerExists.rows[0].seller_type);
    const sellerTypeValidationError = validateSellerConfigurationByType(sellerType, itemDisplayConfig);
    if (sellerTypeValidationError) {
      return res.status(400).json({ message: sellerTypeValidationError, field: "itemDisplayConfig.categoryRules" });
    }

    await client.query("BEGIN");

    const profileResult = await client.query(
      `INSERT INTO seller_configuration_profiles (
         seller_id,
         profile_name,
         status,
         modules,
         created_by,
         updated_by,
         updated_at
       )
       VALUES ($1, $2, $3, $4::jsonb, $5, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (seller_id)
       DO UPDATE SET
         profile_name = EXCLUDED.profile_name,
         status = EXCLUDED.status,
         modules = EXCLUDED.modules,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [sellerId, profileName, requestedStatus, JSON.stringify(persistedModules), req.user.id]
    );

    const profile = profileResult.rows[0];

    await client.query(`DELETE FROM seller_catalogue_fields WHERE profile_id = $1`, [profile.id]);
    await client.query(`DELETE FROM seller_quotation_columns WHERE profile_id = $1`, [profile.id]);

    for (const field of catalogueFields) {
      await client.query(
        `INSERT INTO seller_catalogue_fields (
           profile_id,
           field_key,
           label,
           field_type,
           option_values,
           display_order,
           required,
           visible_in_list,
           upload_enabled
         )
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)`,
        [
          profile.id,
          field.key,
          field.label,
          field.type,
          JSON.stringify(field.options || []),
          field.displayOrder,
          field.required,
          field.visibleInList,
          field.uploadEnabled
        ]
      );
    }

    for (const column of quotationColumns) {
      await client.query(
        `INSERT INTO seller_quotation_columns (
           profile_id,
           column_key,
           label,
           column_type,
           option_values,
           definition_text,
           formula_expression,
           display_order,
           required,
           visible_in_form,
           visible_in_pdf,
           help_text_in_pdf,
           included_in_calculation,
           category_visibility
         )
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)`,
        [
          profile.id,
          column.key,
          column.label,
          column.type,
          JSON.stringify(column.options || []),
          column.definition || null,
          column.formulaExpression || null,
          column.displayOrder,
          column.required,
          column.visibleInForm,
          column.visibleInPdf,
          column.helpTextInPdf,
          column.includedInCalculation,
          JSON.stringify(column.categoryVisibility || [])
        ]
      );
    }

    const versionNoResult = await client.query(
      `SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version_no
       FROM seller_configuration_versions
       WHERE profile_id = $1`,
      [profile.id]
    );

    const snapshot = {
      sellerId,
      profileName,
      status: requestedStatus,
      modules: persistedModules,
      itemDisplayConfig,
      catalogueFields: catalogueFields.map(({ displayOrder, ...field }) => field),
      quotationColumns: quotationColumns.map(({ displayOrder, ...column }) => column)
    };

    await client.query(
      `INSERT INTO seller_configuration_versions (
         profile_id,
         version_no,
         status,
         snapshot,
         actor_user_id
       )
       VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [profile.id, Number(versionNoResult.rows[0].next_version_no || 1), requestedStatus, JSON.stringify(snapshot), req.user.id]
    );

    await client.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, $2, 'seller_configuration_saved', $3::jsonb)`,
      [
        req.user.id,
        sellerId,
        JSON.stringify({
          profileName,
          status: requestedStatus,
          catalogueFieldCount: catalogueFields.length,
          quotationColumnCount: quotationColumns.length,
          itemDisplayCategoryRuleCount: itemDisplayConfig.categoryRules.length
        })
      ]
    );

    await client.query("COMMIT");

    const config = await loadSellerConfiguration(pool, sellerId);
    return res.json({ message: "Seller configuration saved.", config });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

router.post("/:sellerId/publish", requirePermission(PERMISSIONS.CONFIGURATION_PUBLISH), async (req, res) => {
  const client = await pool.connect();

  try {
    const sellerId = Number(req.params.sellerId);
    if (!Number.isFinite(sellerId) || sellerId <= 0) {
      return res.status(400).json({ message: "Valid sellerId is required" });
    }
    if (!canAccessSellerConfiguration(req, sellerId)) {
      return res.status(403).json({ message: "You can only publish your own seller configuration" });
    }

    const sellerResult = await client.query(
      `SELECT id, seller_type
       FROM sellers
       WHERE id = $1
       LIMIT 1`,
      [sellerId]
    );
    if (sellerResult.rowCount === 0) {
      return res.status(404).json({ message: "Seller not found" });
    }
    const sellerType = normalizeSellerType(sellerResult.rows[0].seller_type);

    await client.query("BEGIN");
    const config = await loadSellerConfiguration(client, sellerId);
    if (!config) {
      throw new Error("No seller configuration found to publish");
    }
    const sellerTypeValidationError = validateSellerConfigurationByType(
      sellerType,
      normalizeItemDisplayConfig(config.itemDisplayConfig || config.modules?.itemDisplayConfig || DEFAULT_ITEM_DISPLAY_CONFIG)
    );
    if (sellerTypeValidationError) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: sellerTypeValidationError, field: "itemDisplayConfig.categoryRules" });
    }

    const versionNoResult = await client.query(
      `SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version_no
       FROM seller_configuration_versions
       WHERE profile_id = $1`,
      [config.profileId]
    );

    await client.query(
      `UPDATE seller_configuration_profiles
       SET status = 'published',
           published_at = CURRENT_TIMESTAMP,
           updated_by = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [config.profileId, req.user.id]
    );

    await client.query(
      `INSERT INTO seller_configuration_versions (
         profile_id,
         version_no,
         status,
         snapshot,
         actor_user_id,
         published_at
       )
       VALUES ($1, $2, 'published', $3::jsonb, $4, CURRENT_TIMESTAMP)`,
      [
        config.profileId,
        Number(versionNoResult.rows[0].next_version_no || 1),
        JSON.stringify({
          sellerId: config.sellerId,
          profileName: config.profileName,
          status: "published",
          modules: config.modules,
          itemDisplayConfig: normalizeItemDisplayConfig(config.itemDisplayConfig || config.modules?.itemDisplayConfig || DEFAULT_ITEM_DISPLAY_CONFIG),
          catalogueFields: config.catalogueFields,
          quotationColumns: config.quotationColumns
        }),
        req.user.id
      ]
    );

    await client.query(
      `INSERT INTO platform_audit_logs (actor_user_id, seller_id, action_key, detail)
       VALUES ($1, $2, 'seller_configuration_published', $3::jsonb)`,
      [
        req.user.id,
        sellerId,
        JSON.stringify({
          profileName: config.profileName,
          catalogueFieldCount: config.catalogueFields.length,
          quotationColumnCount: config.quotationColumns.length,
          itemDisplayCategoryRuleCount: normalizeItemDisplayConfig(config.itemDisplayConfig || config.modules?.itemDisplayConfig || DEFAULT_ITEM_DISPLAY_CONFIG).categoryRules.length
        })
      ]
    );

    await client.query("COMMIT");

    const publishedConfig = await loadSellerConfiguration(pool, sellerId);
    return res.json({ message: "Seller configuration published.", config: publishedConfig });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
