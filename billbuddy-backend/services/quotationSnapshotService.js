function cloneSerializable(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return fallback;
  }
}

function getDefaultDocumentTemplate() {
  return {
    template_preset: "default",
    template_theme_key: "default",
    header_text: "Quotation",
    body_template: "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your review.",
    footer_text: "Thank you for your business.",
    company_phone: "",
    company_email: "",
    company_address: "",
    header_image_data: null,
    show_header_image: false,
    logo_image_data: null,
    show_logo_only: false,
    footer_image_data: null,
    show_footer_image: false,
    accent_color: "#737373",
    notes_text: "",
    notes_rich_text: "",
    terms_text: "",
    terms_rich_text: "",
    show_bank_details: true,
    show_notes: true,
    show_terms: true
  };
}

function buildFrozenQuotationDocumentSnapshot({ template, seller, customer, pdfConfig }) {
  const baseTemplate = {
    ...getDefaultDocumentTemplate(),
    ...(template || {})
  };

  return {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    template: {
      template_preset: baseTemplate.template_preset,
      template_theme_key: baseTemplate.template_theme_key,
      header_text: baseTemplate.header_text,
      body_template: baseTemplate.body_template,
      footer_text: baseTemplate.footer_text,
      company_phone: baseTemplate.company_phone,
      company_email: baseTemplate.company_email,
      company_address: baseTemplate.company_address,
      header_image_data: baseTemplate.header_image_data,
      show_header_image: Boolean(baseTemplate.show_header_image),
      logo_image_data: baseTemplate.logo_image_data,
      show_logo_only: Boolean(baseTemplate.show_logo_only),
      footer_image_data: baseTemplate.footer_image_data,
      show_footer_image: Boolean(baseTemplate.show_footer_image),
      accent_color: baseTemplate.accent_color,
      notes_text: baseTemplate.notes_text,
      notes_rich_text: baseTemplate.notes_rich_text || "",
      terms_text: baseTemplate.terms_text,
      terms_rich_text: baseTemplate.terms_rich_text || "",
      show_bank_details: baseTemplate.show_bank_details === undefined ? true : Boolean(baseTemplate.show_bank_details),
      show_notes: baseTemplate.show_notes === undefined ? true : Boolean(baseTemplate.show_notes),
      show_terms: baseTemplate.show_terms === undefined ? true : Boolean(baseTemplate.show_terms)
    },
    seller: {
      id: seller?.id || null,
      name: seller?.name || "",
      business_name: seller?.business_name || "",
      email: seller?.email || "",
      mobile: seller?.mobile || "",
      gst_number: seller?.gst_number || "",
      bank_name: seller?.bank_name || "",
      bank_branch: seller?.bank_branch || "",
      bank_account_no: seller?.bank_account_no || "",
      bank_ifsc: seller?.bank_ifsc || ""
    },
    customer: {
      id: customer?.id || null,
      name: customer?.name || "",
      firm_name: customer?.firm_name || "",
      mobile: customer?.mobile || "",
      email: customer?.email || "",
      address: customer?.address || "",
      gst_number: customer?.gst_number || "",
      monthly_billing: Boolean(customer?.monthly_billing),
      shipping_addresses: cloneSerializable(customer?.shipping_addresses, [])
    },
    pdf: {
      modules: cloneSerializable(pdfConfig?.modules, {}),
      columns: cloneSerializable(pdfConfig?.columns, []),
      allPdfColumns: cloneSerializable(pdfConfig?.allPdfColumns, pdfConfig?.columns || [])
    }
  };
}

function buildFrozenQuotationCalculationSnapshot({ customColumns, unitConversionMap, totals, inputs }) {
  const safeTotals = totals || {};
  const safeInputs = inputs || {};

  return {
    schema_version: 1,
    captured_at: new Date().toISOString(),
    inputs: {
      gst_percent: Number(safeInputs.gstPercent || 0),
      gst_mode: Boolean(safeInputs.gstMode),
      transport_charges: Number(safeInputs.transportCharges || 0),
      design_charges: Number(safeInputs.designCharges || 0),
      discount_amount: Number(safeInputs.discountAmount || 0),
      advance_amount: Number(safeInputs.advanceAmount || 0)
    },
    totals: {
      subtotal: Number(safeTotals.subtotal || 0),
      gst_amount: Number(safeTotals.gstAmount || 0),
      transport_charges: Number(safeTotals.transport || 0),
      design_charges: Number(safeTotals.design || 0),
      total_amount: Number(safeTotals.totalAmount || 0),
      discount_amount: Number(safeTotals.discountAmount || 0),
      advance_amount: Number(safeTotals.advanceAmount || 0),
      balance_amount: Number(safeTotals.balanceAmount || 0)
    },
    quotation_columns: cloneSerializable(customColumns, []),
    unit_conversion_map: cloneSerializable(unitConversionMap, {})
  };
}

function getQuotationDocumentSnapshot(quotation = {}) {
  const snapshot = quotation.document_snapshot || quotation.documentSnapshot || null;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  return Object.keys(snapshot).length ? snapshot : null;
}

function getQuotationCalculationSnapshot(quotation = {}) {
  const snapshot = quotation.calculation_snapshot || quotation.calculationSnapshot || null;
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  return Object.keys(snapshot).length ? snapshot : null;
}

function applyFrozenPresentationToQuotation(quotation = {}) {
  const snapshot = getQuotationDocumentSnapshot(quotation);
  if (!snapshot) return quotation;

  return {
    ...quotation,
    customer_name: snapshot.customer?.name || quotation.customer_name,
    firm_name: snapshot.customer?.firm_name || quotation.firm_name,
    mobile: snapshot.customer?.mobile || quotation.mobile,
    email: snapshot.customer?.email || quotation.email,
    customer_address: snapshot.customer?.address || quotation.customer_address,
    address: snapshot.customer?.address || quotation.address,
    customer_gst_number: snapshot.customer?.gst_number || quotation.customer_gst_number,
    customer_shipping_addresses: snapshot.customer?.shipping_addresses || quotation.customer_shipping_addresses,
    customer_monthly_billing: snapshot.customer?.monthly_billing ?? quotation.customer_monthly_billing,
    seller_mobile: snapshot.seller?.mobile || quotation.seller_mobile,
    seller_gst_number: snapshot.seller?.gst_number || quotation.seller_gst_number
  };
}

module.exports = {
  applyFrozenPresentationToQuotation,
  buildFrozenQuotationCalculationSnapshot,
  buildFrozenQuotationDocumentSnapshot,
  getDefaultDocumentTemplate,
  getQuotationCalculationSnapshot,
  getQuotationDocumentSnapshot
};
