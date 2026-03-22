const DEFAULT_MODULES = {
  products: true,
  quotations: true,
  customers: true,
  payments: true,
  reports: true,
  quotationProductSelector: true,
  combineHelpingTextInItemColumn: false
};

const BUSINESS_CATEGORY_SEGMENTS = {
  "Traders & Distributors": [
    "Wholesale traders",
    "Electrical / hardware / building materials",
    "FMCG distributors",
    "Industrial suppliers"
  ],
  "Manufacturers & Fabricators": [
    "Steel / aluminium / glass fabricators",
    "Furniture manufacturers",
    "Machinery / equipment makers",
    "Custom product businesses"
  ],
  "Contractors & Project-Based Businesses": [
    "Interior contractors",
    "Civil contractors",
    "Electrical / plumbing contractors",
    "EPC / project vendors"
  ],
  "Service Providers (B2B & B2C)": [
    "Marketing agencies",
    "IT / software vendors",
    "Event companies",
    "Consulting firms"
  ]
};

function normalizeCategory(value) {
  const input = String(value || "").trim().toLowerCase();
  const match = Object.keys(BUSINESS_CATEGORY_SEGMENTS).find((entry) => entry.toLowerCase() === input);
  return match || "Manufacturers & Fabricators";
}

function normalizeSegment(category, segment) {
  const normalizedCategory = normalizeCategory(category);
  const allowed = BUSINESS_CATEGORY_SEGMENTS[normalizedCategory] || [];
  const input = String(segment || "").trim().toLowerCase();
  const match = allowed.find((entry) => entry.toLowerCase() === input);
  return match || allowed[0] || null;
}

function createBaseCatalogueFields() {
  return [
    { key: "material_name", label: "Product / Service Name", type: "text", options: [], required: true, visibleInList: true, uploadEnabled: true, displayOrder: 1 },
    { key: "category", label: "Category", type: "dropdown", options: ["Sheet", "Product", "Services"], required: true, visibleInList: true, uploadEnabled: true, displayOrder: 2 },
    { key: "sku", label: "SKU ID", type: "text", options: [], required: true, visibleInList: true, uploadEnabled: true, displayOrder: 3 },
    { key: "base_price", label: "Base Price", type: "number", options: [], required: true, visibleInList: true, uploadEnabled: true, displayOrder: 90 },
    { key: "limit_rate_edit", label: "Limit Rate Edit", type: "checkbox", options: [], required: false, visibleInList: false, uploadEnabled: false, displayOrder: 91 },
    { key: "max_discount_percent", label: "Max Discount Limit", type: "text", options: [], required: false, visibleInList: false, uploadEnabled: false, displayOrder: 92 }
  ];
}

function createBaseQuotationColumns() {
  return [
    { key: "material_name", label: "Item", type: "text", options: [], definition: "", formulaExpression: "", required: true, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: false, displayOrder: 1 },
    { key: "quantity", label: "Quantity", type: "number", options: [], definition: "", formulaExpression: "", required: true, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true, displayOrder: 80 },
    { key: "rate", label: "Rate", type: "number", options: [], definition: "", formulaExpression: "", required: true, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true, displayOrder: 81 },
    { key: "amount", label: "Amount", type: "formula", options: [], definition: "Calculated line amount", formulaExpression: "quantity * rate", required: false, visibleInForm: false, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true, displayOrder: 82 }
  ];
}

function createTemplateForCategory(category) {
  const normalizedCategory = normalizeCategory(category);
  if (normalizedCategory === "Traders & Distributors") {
    return {
      templatePreset: "invoice_classic",
      headerText: "Quotation",
      bodyTemplate: "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your review.",
      footerText: "Thank you for the opportunity to supply your requirement.",
      accentColor: "#0f4c81",
      notesText: "Dispatch, freight, and unloading are extra unless specifically included.",
      termsText: "Rates are exclusive of taxes unless otherwise stated. Delivery timelines apply as per stock and confirmation."
    };
  }

  if (normalizedCategory === "Contractors & Project-Based Businesses") {
    return {
      templatePreset: "executive_boardroom",
      headerText: "Quotation",
      bodyTemplate: "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your project review.",
      footerText: "We appreciate the opportunity to support your project execution.",
      accentColor: "#111827",
      notesText: "Site conditions, freight, and execution scope will apply as per final approval.",
      termsText: "Rates are exclusive of taxes. Final scope, execution responsibility, and payment terms apply as per confirmation."
    };
  }

  if (normalizedCategory === "Service Providers (B2B & B2C)") {
    return {
      templatePreset: "commercial_offer",
      headerText: "Service Proposal",
      bodyTemplate: "Dear {{customer_name}}, thank you for your interest. Please find our service quotation {{quotation_number}}.",
      footerText: "We look forward to working with you.",
      accentColor: "#2563eb",
      notesText: "Scope assumptions and exclusions are listed separately where applicable.",
      termsText: "Rates are exclusive of taxes unless otherwise stated. Billing cycle and payment milestones apply as per final confirmation."
    };
  }

  return {
    templatePreset: "html_puppeteer",
    headerText: "Quotation",
    bodyTemplate: "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your review.",
    footerText: "Manufacturing & Supply of Precision Components",
    accentColor: "#1f2c63",
    notesText: "Freight, unloading, and site execution are extra unless specifically included.",
    termsText: "Rates are exclusive of applicable taxes. Final scope, taxes, and payment terms apply as per final confirmation."
  };
}

function buildCategoryTemplate(category, segment) {
  const normalizedCategory = normalizeCategory(category);
  const normalizedSegment = normalizeSegment(normalizedCategory, segment);
  const catalogueFields = createBaseCatalogueFields();
  const quotationColumns = createBaseQuotationColumns();
  let sampleProducts = [];
  let sampleCustomers = [];
  let modules = { ...DEFAULT_MODULES };

  if (normalizedCategory === "Traders & Distributors") {
    catalogueFields.splice(3, 0,
      { key: "material_group", label: "Brand", type: "text", options: [], required: false, visibleInList: true, uploadEnabled: true, displayOrder: 4 },
      { key: "color_name", label: "Colour", type: "text", options: [], required: false, visibleInList: true, uploadEnabled: true, displayOrder: 5 },
      { key: "size", label: "Size", type: "dropdown", options: ["S", "M", "L", "XL", "XXL"], required: false, visibleInList: true, uploadEnabled: true, displayOrder: 6 }
    );
    quotationColumns.splice(1, 0,
      { key: "color_name", label: "Colour", type: "text", options: [], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: false, helpTextInPdf: true, includedInCalculation: false, displayOrder: 2 },
      { key: "size", label: "Size", type: "dropdown", options: ["S", "M", "L", "XL", "XXL"], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: false, displayOrder: 3 }
    );
    sampleProducts = [
      { materialName: "Tshirt", category: "Product", sku: "TS-RED-XL", colorName: "Red", basePrice: 350, pricingType: "UNIT", unitType: "COUNT", customFields: { size: "XL", material_group: "House Brand" } },
      { materialName: "Tshirt", category: "Product", sku: "TS-BLU-M", colorName: "Blue", basePrice: 350, pricingType: "UNIT", unitType: "COUNT", customFields: { size: "M", material_group: "House Brand" } },
      { materialName: normalizedSegment === "FMCG distributors" ? "Snack Carton" : "Industrial Gloves", category: "Product", sku: "DIST-001", colorName: null, basePrice: 1200, pricingType: "UNIT", unitType: "COUNT", customFields: { material_group: normalizedSegment } }
    ];
    sampleCustomers = [
      { name: "Metro Retail", firm_name: "Metro Retail", mobile: "9000000001", address: "Warehouse District", gst_number: "27ABCDE1234F1Z5" }
    ];
  } else if (normalizedCategory === "Manufacturers & Fabricators") {
    catalogueFields.splice(3, 0,
      { key: "thickness", label: "Thickness", type: "text", options: [], required: false, visibleInList: true, uploadEnabled: true, displayOrder: 4 },
      { key: "color_name", label: "Colour", type: "text", options: [], required: false, visibleInList: true, uploadEnabled: true, displayOrder: 5 },
      { key: "pricing_type", label: "Pricing Type", type: "dropdown", options: ["SFT", "UNIT", "FIXED"], required: false, visibleInList: true, uploadEnabled: true, displayOrder: 6 }
    );
    quotationColumns.splice(1, 0,
      { key: "thickness", label: "Thickness", type: "text", options: [], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: false, displayOrder: 2 },
      { key: "width", label: "Width", type: "number", options: [], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true, displayOrder: 3 },
      { key: "height", label: "Height", type: "number", options: [], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true, displayOrder: 4 }
    );
    modules.combineHelpingTextInItemColumn = false;
    sampleProducts = [
      { materialName: "Acrylic Sheet", category: "Sheet", sku: "ACR-3MM-WHT", thickness: "3 mm", colorName: "White", basePrice: 120, pricingType: "SFT", unitType: "SFT", customFields: {} },
      { materialName: "MS Laser Cut Part", category: "Product", sku: "MS-LZR-001", thickness: "2 mm", colorName: null, basePrice: 850, pricingType: "UNIT", unitType: "COUNT", customFields: {} },
      { materialName: normalizedSegment === "Furniture manufacturers" ? "Plywood Panel" : "ACP Panel", category: "Sheet", sku: "FAB-001", thickness: "6 mm", colorName: "Natural", basePrice: 95, pricingType: "SFT", unitType: "SFT", customFields: {} }
    ];
    sampleCustomers = [
      { name: "Sai Projects", firm_name: "Sai Projects", mobile: "9000000002", address: "MIDC Industrial Area", gst_number: "27ABCDE1234F1Z5" }
    ];
  } else if (normalizedCategory === "Contractors & Project-Based Businesses") {
    catalogueFields.splice(3, 0,
      { key: "scope_type", label: "Scope Type", type: "dropdown", options: ["Material", "Labour", "Turnkey"], required: false, visibleInList: true, uploadEnabled: true, displayOrder: 4 }
    );
    quotationColumns.splice(1, 0,
      { key: "note", label: "Description", type: "text", options: [], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: false, displayOrder: 2 }
    );
    sampleProducts = [
      { materialName: "False Ceiling Work", category: "Services", sku: "CNT-001", basePrice: 145, pricingType: "UNIT", unitType: "COUNT", customFields: { scope_type: "Labour" } },
      { materialName: "Electrical Point Installation", category: "Services", sku: "CNT-002", basePrice: 850, pricingType: "UNIT", unitType: "COUNT", customFields: { scope_type: "Turnkey" } }
    ];
    sampleCustomers = [
      { name: "Urban Infra", firm_name: "Urban Infra", mobile: "9000000003", address: "Site Office, Sector 9", gst_number: "" }
    ];
  } else {
    catalogueFields.splice(3, 0,
      { key: "package_type", label: "Package Type", type: "dropdown", options: ["Monthly", "Project", "Retainer"], required: false, visibleInList: true, uploadEnabled: true, displayOrder: 4 }
    );
    quotationColumns.splice(1, 0,
      { key: "note", label: "Service Scope", type: "text", options: [], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: false, displayOrder: 2 }
    );
    sampleProducts = [
      { materialName: "Social Media Management", category: "Services", sku: "SRV-001", basePrice: 25000, pricingType: "FIXED", unitType: "COUNT", customFields: { package_type: "Monthly" } },
      { materialName: "Website AMC", category: "Services", sku: "SRV-002", basePrice: 18000, pricingType: "FIXED", unitType: "COUNT", customFields: { package_type: "Retainer" } }
    ];
    sampleCustomers = [
      { name: "Bright Brands", firm_name: "Bright Brands", mobile: "9000000004", address: "Corporate Plaza", gst_number: "" }
    ];
  }

  return {
    businessCategory: normalizedCategory,
    businessSegment: normalizedSegment,
    modules,
    catalogueFields,
    quotationColumns,
    template: createTemplateForCategory(normalizedCategory),
    sampleProducts,
    sampleCustomers
  };
}

async function upsertQuotationTemplate(client, sellerId, templateData = {}) {
  await client.query(
    `INSERT INTO quotation_templates (
       seller_id,
       template_name,
       template_preset,
       header_text,
       body_template,
       footer_text,
       company_phone,
       company_email,
       company_address,
       header_image_data,
       show_header_image,
       logo_image_data,
       show_logo_only,
       accent_color,
       notes_text,
       terms_text,
       email_enabled,
       whatsapp_enabled
     )
     VALUES ($1, 'default', $2, $3, $4, $5, NULL, NULL, NULL, $6, $7, $8, $9, $10, $11, $12, FALSE, TRUE)
     ON CONFLICT (seller_id, template_name)
     DO UPDATE SET
       template_preset = EXCLUDED.template_preset,
       header_text = EXCLUDED.header_text,
       body_template = EXCLUDED.body_template,
       footer_text = EXCLUDED.footer_text,
       header_image_data = COALESCE(EXCLUDED.header_image_data, quotation_templates.header_image_data),
       show_header_image = EXCLUDED.show_header_image,
       logo_image_data = COALESCE(EXCLUDED.logo_image_data, quotation_templates.logo_image_data),
       show_logo_only = EXCLUDED.show_logo_only,
       accent_color = EXCLUDED.accent_color,
       notes_text = EXCLUDED.notes_text,
       terms_text = EXCLUDED.terms_text,
       updated_at = CURRENT_TIMESTAMP`,
    [
      sellerId,
      templateData.templatePreset || "commercial_offer",
      templateData.headerText || "Quotation",
      templateData.bodyTemplate || "Dear {{customer_name}}, please find our quotation {{quotation_number}}.",
      templateData.footerText || "",
      templateData.headerImageData || null,
      Boolean(templateData.showHeaderImage),
      templateData.logoImageData || null,
      Boolean(templateData.showLogoOnly),
      templateData.accentColor || "#2563eb",
      templateData.notesText || "",
      templateData.termsText || ""
    ]
  );
}

async function seedSellerConfiguration(client, sellerId, actorUserId, template) {
  const profileResult = await client.query(
    `INSERT INTO seller_configuration_profiles (
       seller_id,
       profile_name,
       status,
       modules,
       created_by,
       updated_by,
       published_at,
       updated_at
     )
     VALUES ($1, $2, 'published', $3::jsonb, $4, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (seller_id)
     DO UPDATE SET
       profile_name = EXCLUDED.profile_name,
       status = 'published',
       modules = EXCLUDED.modules,
       updated_by = EXCLUDED.updated_by,
       published_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      sellerId,
      `${template.businessCategory} Configuration`,
      JSON.stringify(template.modules),
      actorUserId || null
    ]
  );

  const profileId = profileResult.rows[0].id;
  await client.query(`DELETE FROM seller_catalogue_fields WHERE profile_id = $1`, [profileId]);
  await client.query(`DELETE FROM seller_quotation_columns WHERE profile_id = $1`, [profileId]);

  for (const field of template.catalogueFields) {
    await client.query(
      `INSERT INTO seller_catalogue_fields (
         profile_id, field_key, label, field_type, option_values, display_order, required, visible_in_list, upload_enabled
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)`,
      [profileId, field.key, field.label, field.type, JSON.stringify(field.options || []), field.displayOrder, field.required, field.visibleInList, field.uploadEnabled]
    );
  }

  for (const column of template.quotationColumns) {
    await client.query(
      `INSERT INTO seller_quotation_columns (
         profile_id, column_key, label, column_type, option_values, definition_text, formula_expression, display_order, required, visible_in_form, visible_in_pdf, help_text_in_pdf, included_in_calculation
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        profileId,
        column.key,
        column.label,
        column.type,
        JSON.stringify(column.options || []),
        column.definition || "",
        column.formulaExpression || "",
        column.displayOrder,
        column.required,
        column.visibleInForm,
        column.visibleInPdf,
        column.helpTextInPdf,
        column.includedInCalculation
      ]
    );
  }

  await client.query(`DELETE FROM seller_configuration_versions WHERE profile_id = $1`, [profileId]);
  await client.query(
    `INSERT INTO seller_configuration_versions (
       profile_id, version_no, status, snapshot, actor_user_id, published_at
     ) VALUES ($1, 1, 'published', $2::jsonb, $3, CURRENT_TIMESTAMP)`,
    [
      profileId,
      JSON.stringify({
        modules: template.modules,
        catalogueFields: template.catalogueFields,
        quotationColumns: template.quotationColumns
      }),
      actorUserId || null
    ]
  );
}

async function seedSampleData(client, sellerId, template) {
  for (const product of template.sampleProducts || []) {
    await client.query(
      `INSERT INTO products (
         seller_id, material_name, category, base_price, sku, thickness, always_available, unit_type, material_group, color_name, ps_supported, pricing_type, catalogue_source, limit_rate_edit, max_discount_percent, custom_fields
       )
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, $9, $10, $11, 'primary', FALSE, 0, $12::jsonb)`,
      [
        sellerId,
        product.materialName,
        product.category,
        product.basePrice,
        product.sku,
        product.thickness || null,
        product.unitType || "COUNT",
        product.materialGroup || null,
        product.colorName || null,
        Boolean(product.psSupported),
        product.pricingType || "UNIT",
        JSON.stringify(product.customFields || {})
      ]
    );
  }

  for (const customer of template.sampleCustomers || []) {
    await client.query(
      `INSERT INTO customers (
         seller_id, name, firm_name, mobile, address, gst_number, monthly_billing, shipping_addresses
       )
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, '[]'::jsonb)`,
      [
        sellerId,
        customer.name,
        customer.firm_name || null,
        customer.mobile || null,
        customer.address || null,
        customer.gst_number || null
      ]
    );
  }
}

async function seedSellerOnboardingWorkspace(client, {
  sellerId,
  actorUserId = null,
  businessCategory,
  businessSegment,
  wantsSampleData = false,
  headerImageData = null,
  logoImageData = null,
  showHeaderImage = false,
  showLogoOnly = false
}) {
  const template = buildCategoryTemplate(businessCategory, businessSegment);

  await client.query(
    `UPDATE sellers
     SET business_category = $1,
         business_segment = $2,
         sample_data_enabled = $3,
         sample_data_seeded_at = CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE sample_data_seeded_at END
     WHERE id = $4`,
    [template.businessCategory, template.businessSegment, Boolean(wantsSampleData), sellerId]
  );

  await seedSellerConfiguration(client, sellerId, actorUserId, template);
  await upsertQuotationTemplate(client, sellerId, {
    ...template.template,
    headerImageData,
    logoImageData,
    showHeaderImage,
    showLogoOnly
  });

  if (wantsSampleData) {
    await seedSampleData(client, sellerId, template);
  }

  return template;
}

module.exports = {
  BUSINESS_CATEGORY_SEGMENTS,
  normalizeCategory,
  normalizeSegment,
  buildCategoryTemplate,
  seedSellerOnboardingWorkspace
};
