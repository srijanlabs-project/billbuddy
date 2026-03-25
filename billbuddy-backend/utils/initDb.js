const pool = require("../db/db");
const { seedRbacRolesAndPermissions } = require("../services/rbacService");

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      role_name VARCHAR(50) UNIQUE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rbac_roles (
      id SERIAL PRIMARY KEY,
      scope VARCHAR(20) NOT NULL,
      role_key VARCHAR(80) NOT NULL,
      role_label VARCHAR(120) NOT NULL,
      role_summary TEXT,
      is_system BOOLEAN DEFAULT TRUE,
      is_editable BOOLEAN DEFAULT TRUE,
      is_visible BOOLEAN DEFAULT TRUE,
      display_order INTEGER DEFAULT 0,
      permissions_initialized BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (scope, role_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rbac_role_permissions (
      id SERIAL PRIMARY KEY,
      role_id INTEGER NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
      permission_key VARCHAR(120) NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (role_id, permission_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sellers (
      id SERIAL PRIMARY KEY,
      seller_code VARCHAR(40) UNIQUE,
      name VARCHAR(200) NOT NULL,
      mobile VARCHAR(20),
      email VARCHAR(200),
      onboarding_status VARCHAR(30) DEFAULT 'pending',
      status VARCHAR(30) DEFAULT 'pending',
      trial_ends_at TIMESTAMP WITHOUT TIME ZONE,
      subscription_plan VARCHAR(50) DEFAULT 'DEMO',
      max_users INTEGER,
      max_orders_per_month INTEGER,
      is_locked BOOLEAN DEFAULT FALSE,
      theme_key VARCHAR(40) DEFAULT 'matte-blue',
      brand_primary_color VARCHAR(20) DEFAULT '#2563eb',
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'pending'`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITHOUT TIME ZONE`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS business_segment VARCHAR(160)`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS sample_data_enabled BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS sample_data_seeded_at TIMESTAMP WITHOUT TIME ZONE`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'DEMO'`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS max_users INTEGER`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS max_orders_per_month INTEGER`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS included_users INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS purchased_user_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS active_user_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS available_user_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS seat_status VARCHAR(30) DEFAULT 'available'`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS business_name VARCHAR(200)`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS gst_number VARCHAR(20)`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS business_address TEXT`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS city VARCHAR(120)`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS state VARCHAR(120)`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS business_category VARCHAR(120)`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITHOUT TIME ZONE`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS quotation_number_prefix VARCHAR(20) DEFAULT 'QTN'`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200)`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(200)`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS bank_account_no VARCHAR(80)`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(40)`);
  await pool.query(`UPDATE sellers SET quotation_number_prefix = 'QTN' WHERE quotation_number_prefix IS NULL OR quotation_number_prefix = ''`);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id),
    ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE
  `);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMP WITHOUT TIME ZONE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITHOUT TIME ZONE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITHOUT TIME ZONE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_mode VARCHAR(20) DEFAULT 'requester'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_limit_amount NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_approve_quotations BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_approve_price_exception BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_priority INTEGER DEFAULT 100`);

  await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id)`);
  await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(200)`);
  await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS monthly_billing BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS shipping_addresses JSONB DEFAULT '[]'::jsonb`);

  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id)`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(80)`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS thickness VARCHAR(80)`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS design_name VARCHAR(200)`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS inventory_qty NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS always_available BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_type VARCHAR(20) DEFAULT 'COUNT'`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS default_width NUMERIC(10,2)`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS default_height NUMERIC(10,2)`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS material_group VARCHAR(80)`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS color_name VARCHAR(120)`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ps_supported BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(20) DEFAULT 'SFT'`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS catalogue_source VARCHAR(20) DEFAULT 'primary'`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS limit_rate_edit BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS max_discount_percent NUMERIC(5,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS max_discount_type VARCHAR(20) DEFAULT 'percent'`);
  await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb`);

  await pool.query(`ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id)`);

  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id)`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS order_status VARCHAR(30) DEFAULT 'NEW'`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quotation_sent BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS quotation_sent_at TIMESTAMP WITHOUT TIME ZONE`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(30) DEFAULT 'PICKUP'`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS delivery_date DATE`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS delivery_address TEXT`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS delivery_pincode VARCHAR(10)`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS transportation_cost NUMERIC(10,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS design_cost_confirmed BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS source_channel VARCHAR(30) DEFAULT 'manual'`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS version_no INTEGER DEFAULT 1`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS record_status VARCHAR(20) DEFAULT 'submitted'`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_monthly_billing BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS advance_amount NUMERIC(10,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS balance_amount NUMERIC(10,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS reference_request_id VARCHAR(120)`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS watermark_text TEXT`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS seller_quotation_serial INTEGER`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS seller_quotation_number VARCHAR(80)`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS custom_quotation_number VARCHAR(120)`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'not_required'`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS approval_required BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS active_approval_request_id INTEGER`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS approved_for_download_at TIMESTAMP WITHOUT TIME ZONE`);
  await pool.query(`CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START WITH 1 INCREMENT BY 1`);
  await pool.query(`
    SELECT setval(
      'quotation_number_seq',
      GREATEST(
        COALESCE(
          (
            SELECT MAX(
              COALESCE(NULLIF(substring(quotation_number FROM '(\\d+)$'), ''), '0')::bigint
            )
            FROM quotations
          ),
          0
        ),
        0
      ) + 1,
      FALSE
    )
  `);
  await pool.query(`
    WITH numbered AS (
      SELECT
        q.id,
        q.seller_id,
        ROW_NUMBER() OVER (
          PARTITION BY q.seller_id
          ORDER BY q.created_at ASC NULLS LAST, q.id ASC
        ) AS next_serial
      FROM quotations q
      WHERE q.seller_quotation_serial IS NULL
    )
    UPDATE quotations q
    SET seller_quotation_serial = numbered.next_serial
    FROM numbered
    WHERE q.id = numbered.id
  `);
  await pool.query(`
    UPDATE quotations q
    SET seller_quotation_number = CONCAT(COALESCE(NULLIF(s.quotation_number_prefix, ''), 'QTN'), '-', LPAD(q.seller_quotation_serial::text, 4, '0'))
    FROM sellers s
    WHERE s.id = q.seller_id
      AND q.seller_quotation_serial IS NOT NULL
      AND (q.seller_quotation_number IS NULL OR q.seller_quotation_number = '')
  `);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_seller_serial_unique ON quotations(seller_id, seller_quotation_serial) WHERE seller_quotation_serial IS NOT NULL`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_seller_visible_unique ON quotations(seller_id, seller_quotation_number) WHERE seller_quotation_number IS NOT NULL`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_seller_custom_unique ON quotations(seller_id, custom_quotation_number) WHERE custom_quotation_number IS NOT NULL`);

  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id)`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS material_type VARCHAR(120)`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS thickness VARCHAR(80)`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS design_name VARCHAR(200)`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS sku VARCHAR(80)`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS color_name VARCHAR(120)`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS imported_color_note TEXT`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS ps_included BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS dimension_height NUMERIC(10,2)`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS dimension_width NUMERIC(10,2)`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS dimension_unit VARCHAR(10)`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS item_note TEXT`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS pricing_type VARCHAR(20) DEFAULT 'SFT'`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS item_category VARCHAR(120)`);
  await pool.query(`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS item_display_text TEXT`);

  await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id)`);
  await pool.query(`ALTER TABLE ledger ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotation_templates (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      template_name VARCHAR(120) NOT NULL DEFAULT 'default',
      header_text TEXT,
      body_template TEXT,
      footer_text TEXT,
      company_phone VARCHAR(30),
      company_email VARCHAR(200),
      company_address TEXT,
      header_image_data TEXT,
      show_header_image BOOLEAN DEFAULT FALSE,
      logo_image_data TEXT,
      show_logo_only BOOLEAN DEFAULT FALSE,
      template_preset VARCHAR(80) DEFAULT 'commercial_offer',
      template_theme_key VARCHAR(80) DEFAULT 'default',
      accent_color VARCHAR(20) DEFAULT '#2563eb',
      notes_text TEXT,
      terms_text TEXT,
      email_enabled BOOLEAN DEFAULT FALSE,
      whatsapp_enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (seller_id, template_name)
    )
  `);

  await pool.query(`ALTER TABLE quotation_templates ADD COLUMN IF NOT EXISTS company_phone VARCHAR(30)`);
  await pool.query(`ALTER TABLE quotation_templates ADD COLUMN IF NOT EXISTS company_email VARCHAR(200)`);
  await pool.query(`ALTER TABLE quotation_templates ADD COLUMN IF NOT EXISTS company_address TEXT`);
  await pool.query(`ALTER TABLE quotation_templates ADD COLUMN IF NOT EXISTS header_image_data TEXT`);
  await pool.query(`ALTER TABLE quotation_templates ADD COLUMN IF NOT EXISTS show_header_image BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE quotation_templates ADD COLUMN IF NOT EXISTS logo_image_data TEXT`);
  await pool.query(`ALTER TABLE quotation_templates ADD COLUMN IF NOT EXISTS show_logo_only BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE quotation_templates ADD COLUMN IF NOT EXISTS template_preset VARCHAR(80) DEFAULT 'commercial_offer'`);
  await pool.query(`ALTER TABLE quotation_templates ADD COLUMN IF NOT EXISTS template_theme_key VARCHAR(80) DEFAULT 'default'`);
  await pool.query(`ALTER TABLE quotation_templates ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '#2563eb'`);
  await pool.query(`ALTER TABLE quotation_templates ADD COLUMN IF NOT EXISTS notes_text TEXT`);
  await pool.query(`ALTER TABLE quotation_templates ADD COLUMN IF NOT EXISTS terms_text TEXT`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_decode_rules (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL UNIQUE REFERENCES sellers(id) ON DELETE CASCADE,
      customer_line INTEGER DEFAULT 1,
      mobile_line INTEGER DEFAULT 2,
      item_line INTEGER DEFAULT 3,
      delivery_date_line INTEGER DEFAULT 4,
      delivery_type_line INTEGER DEFAULT 5,
      enabled BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_events (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
      event_type VARCHAR(50) NOT NULL,
      event_note TEXT,
      actor_user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotation_versions (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
      version_no INTEGER NOT NULL,
      quotation_snapshot JSONB NOT NULL,
      items_snapshot JSONB NOT NULL,
      actor_user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_approval_mappings (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      requester_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      approver_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_active BOOLEAN DEFAULT TRUE,
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (requester_user_id, approver_user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotation_approval_requests (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
      quotation_version_no INTEGER NOT NULL DEFAULT 1,
      requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_approver_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      approval_type_summary VARCHAR(80),
      request_note TEXT,
      decision_note TEXT,
      requested_amount NUMERIC(12,2) DEFAULT 0,
      approved_at TIMESTAMP WITHOUT TIME ZONE,
      approved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      rejected_at TIMESTAMP WITHOUT TIME ZONE,
      rejected_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      superseded_at TIMESTAMP WITHOUT TIME ZONE,
      superseded_by_request_id INTEGER REFERENCES quotation_approval_requests(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quotation_approval_reasons (
      id SERIAL PRIMARY KEY,
      approval_request_id INTEGER NOT NULL REFERENCES quotation_approval_requests(id) ON DELETE CASCADE,
      reason_type VARCHAR(50) NOT NULL,
      item_index INTEGER,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      requested_value NUMERIC(12,2),
      allowed_value NUMERIC(12,2),
      base_value NUMERIC(12,2),
      meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE quotations
    ADD CONSTRAINT quotations_active_approval_request_id_fkey
    FOREIGN KEY (active_approval_request_id) REFERENCES quotation_approval_requests(id) ON DELETE SET NULL
  `).catch((error) => {
    if (!String(error.message || "").includes("already exists")) throw error;
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mobile_audit_logs (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action_key VARCHAR(80) NOT NULL,
      detail JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_audit_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
      action_key VARCHAR(80) NOT NULL,
      detail JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS plans (
      id SERIAL PRIMARY KEY,
      plan_code VARCHAR(50) UNIQUE NOT NULL,
      plan_name VARCHAR(120) NOT NULL,
      price NUMERIC(12,2) DEFAULT 0,
      billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
      is_active BOOLEAN DEFAULT TRUE,
      is_demo_plan BOOLEAN DEFAULT FALSE,
      trial_enabled BOOLEAN DEFAULT FALSE,
      trial_duration_days INTEGER,
      plan_access_type VARCHAR(20) NOT NULL DEFAULT 'FREE',
      template_access_tier VARCHAR(20) NOT NULL DEFAULT 'FREE',
      watermark_text TEXT,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS plan_access_type VARCHAR(20) NOT NULL DEFAULT 'FREE'`);
  await pool.query(`ALTER TABLE plans ADD COLUMN IF NOT EXISTS template_access_tier VARCHAR(20) NOT NULL DEFAULT 'FREE'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS plan_features (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      max_users INTEGER,
      included_users INTEGER DEFAULT 0,
      max_users_allowed INTEGER,
      extra_user_price_monthly NUMERIC(12,2) DEFAULT 0,
      extra_user_price_yearly NUMERIC(12,2) DEFAULT 0,
      seat_expansion_allowed BOOLEAN DEFAULT TRUE,
      max_quotations INTEGER,
      max_customers INTEGER,
      inventory_enabled BOOLEAN DEFAULT FALSE,
      reports_enabled BOOLEAN DEFAULT FALSE,
      gst_enabled BOOLEAN DEFAULT FALSE,
      exports_enabled BOOLEAN DEFAULT FALSE,
      quotation_watermark_enabled BOOLEAN DEFAULT FALSE,
      quotation_creation_locked_after_expiry BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (plan_id)
    )
  `);
  await pool.query(`ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS included_users INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS max_users_allowed INTEGER`);
  await pool.query(`ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS extra_user_price_monthly NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS extra_user_price_yearly NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS seat_expansion_allowed BOOLEAN DEFAULT TRUE`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES plans(id),
      status VARCHAR(20) NOT NULL DEFAULT 'trial',
      included_users_snapshot INTEGER DEFAULT 0,
      purchased_user_count INTEGER DEFAULT 0,
      additional_user_count INTEGER DEFAULT 0,
      extra_user_unit_price NUMERIC(12,2) DEFAULT 0,
      seat_billing_cycle VARCHAR(20) DEFAULT 'monthly',
      seat_amount NUMERIC(12,2) DEFAULT 0,
      total_subscription_amount NUMERIC(12,2) DEFAULT 0,
      seat_limit_enforced BOOLEAN DEFAULT TRUE,
      start_date DATE,
      end_date DATE,
      trial_start_at TIMESTAMP WITHOUT TIME ZONE,
      trial_end_at TIMESTAMP WITHOUT TIME ZONE,
      converted_from_trial BOOLEAN DEFAULT FALSE,
      auto_assigned BOOLEAN DEFAULT FALSE,
      created_by INTEGER REFERENCES users(id),
      updated_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS included_users_snapshot INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS purchased_user_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS additional_user_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS extra_user_unit_price NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS seat_billing_cycle VARCHAR(20) DEFAULT 'monthly'`);
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS seat_amount NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS total_subscription_amount NUMERIC(12,2) DEFAULT 0`);
  await pool.query(`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS seat_limit_enforced BOOLEAN DEFAULT TRUE`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_seat_events (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE CASCADE,
      event_type VARCHAR(40) NOT NULL,
      previous_purchased_user_count INTEGER DEFAULT 0,
      new_purchased_user_count INTEGER DEFAULT 0,
      delta_user_count INTEGER DEFAULT 0,
      unit_price NUMERIC(12,2) DEFAULT 0,
      seat_amount NUMERIC(12,2) DEFAULT 0,
      performed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      approval_status VARCHAR(20) DEFAULT 'approved',
      note TEXT,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_seat_requests (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
      requested_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      requested_user_count INTEGER NOT NULL,
      current_purchased_user_count INTEGER DEFAULT 0,
      reason_note TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      decision_note TEXT,
      approved_at TIMESTAMP WITHOUT TIME ZONE,
      rejected_at TIMESTAMP WITHOUT TIME ZONE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seller_usage_snapshots (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      snapshot_date DATE NOT NULL,
      active_user_count INTEGER DEFAULT 0,
      quotation_count INTEGER DEFAULT 0,
      customer_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (seller_id, snapshot_date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seller_configuration_profiles (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL UNIQUE REFERENCES sellers(id) ON DELETE CASCADE,
      profile_name VARCHAR(200) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      modules JSONB NOT NULL DEFAULT '{"products":true,"quotations":true,"customers":true,"payments":true,"reports":true}'::jsonb,
      published_at TIMESTAMP WITHOUT TIME ZONE,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE seller_configuration_profiles ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft'`);
  await pool.query(`ALTER TABLE seller_configuration_profiles ADD COLUMN IF NOT EXISTS modules JSONB NOT NULL DEFAULT '{"products":true,"quotations":true,"customers":true,"payments":true,"reports":true}'::jsonb`);
  await pool.query(`ALTER TABLE seller_configuration_profiles ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITHOUT TIME ZONE`);
  await pool.query(`ALTER TABLE seller_configuration_profiles ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE seller_configuration_profiles ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE seller_configuration_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP`);
  await pool.query(`ALTER TABLE seller_configuration_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seller_catalogue_fields (
      id SERIAL PRIMARY KEY,
      profile_id INTEGER NOT NULL REFERENCES seller_configuration_profiles(id) ON DELETE CASCADE,
      field_key VARCHAR(120) NOT NULL,
      label VARCHAR(160) NOT NULL,
      field_type VARCHAR(40) NOT NULL DEFAULT 'text',
      option_values JSONB NOT NULL DEFAULT '[]'::jsonb,
      display_order INTEGER NOT NULL DEFAULT 0,
      required BOOLEAN DEFAULT FALSE,
      visible_in_list BOOLEAN DEFAULT TRUE,
      upload_enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE seller_catalogue_fields ADD COLUMN IF NOT EXISTS field_type VARCHAR(40) NOT NULL DEFAULT 'text'`);
  await pool.query(`ALTER TABLE seller_catalogue_fields ADD COLUMN IF NOT EXISTS option_values JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE seller_catalogue_fields ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE seller_catalogue_fields ADD COLUMN IF NOT EXISTS required BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE seller_catalogue_fields ADD COLUMN IF NOT EXISTS visible_in_list BOOLEAN DEFAULT TRUE`);
  await pool.query(`ALTER TABLE seller_catalogue_fields ADD COLUMN IF NOT EXISTS upload_enabled BOOLEAN DEFAULT TRUE`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seller_quotation_columns (
      id SERIAL PRIMARY KEY,
      profile_id INTEGER NOT NULL REFERENCES seller_configuration_profiles(id) ON DELETE CASCADE,
      column_key VARCHAR(120) NOT NULL,
      label VARCHAR(160) NOT NULL,
      column_type VARCHAR(40) NOT NULL DEFAULT 'text',
      option_values JSONB NOT NULL DEFAULT '[]'::jsonb,
      definition_text TEXT,
      formula_expression TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      required BOOLEAN DEFAULT FALSE,
      visible_in_form BOOLEAN DEFAULT TRUE,
      visible_in_pdf BOOLEAN DEFAULT TRUE,
      included_in_calculation BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE seller_quotation_columns ADD COLUMN IF NOT EXISTS column_type VARCHAR(40) NOT NULL DEFAULT 'text'`);
  await pool.query(`ALTER TABLE seller_quotation_columns ADD COLUMN IF NOT EXISTS option_values JSONB NOT NULL DEFAULT '[]'::jsonb`);
  await pool.query(`ALTER TABLE seller_quotation_columns ADD COLUMN IF NOT EXISTS definition_text TEXT`);
  await pool.query(`ALTER TABLE seller_quotation_columns ADD COLUMN IF NOT EXISTS formula_expression TEXT`);
  await pool.query(`ALTER TABLE seller_quotation_columns ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE seller_quotation_columns ADD COLUMN IF NOT EXISTS required BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE seller_quotation_columns ADD COLUMN IF NOT EXISTS visible_in_form BOOLEAN DEFAULT TRUE`);
  await pool.query(`ALTER TABLE seller_quotation_columns ADD COLUMN IF NOT EXISTS visible_in_pdf BOOLEAN DEFAULT TRUE`);
  await pool.query(`ALTER TABLE seller_quotation_columns ADD COLUMN IF NOT EXISTS help_text_in_pdf BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE seller_quotation_columns ADD COLUMN IF NOT EXISTS included_in_calculation BOOLEAN DEFAULT FALSE`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seller_configuration_versions (
      id SERIAL PRIMARY KEY,
      profile_id INTEGER NOT NULL REFERENCES seller_configuration_profiles(id) ON DELETE CASCADE,
      version_no INTEGER NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      published_at TIMESTAMP WITHOUT TIME ZONE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (profile_id, version_no)
    )
  `);

  await pool.query(`ALTER TABLE seller_configuration_versions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'draft'`);
  await pool.query(`ALTER TABLE seller_configuration_versions ADD COLUMN IF NOT EXISTS snapshot JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE seller_configuration_versions ADD COLUMN IF NOT EXISTS actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
  await pool.query(`ALTER TABLE seller_configuration_versions ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITHOUT TIME ZONE`);
  await pool.query(`ALTER TABLE seller_configuration_versions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_configuration_profiles_seller ON seller_configuration_profiles(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_catalogue_fields_profile_order ON seller_catalogue_fields(profile_id, display_order, id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_quotation_columns_profile_order ON seller_quotation_columns(profile_id, display_order, id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_configuration_versions_profile_created ON seller_configuration_versions(profile_id, created_at DESC, id DESC)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      mobile VARCHAR(20) NOT NULL,
      email VARCHAR(200),
      business_name VARCHAR(200),
      city VARCHAR(120),
      business_type VARCHAR(120),
      business_segment VARCHAR(160),
      wants_sample_data BOOLEAN DEFAULT FALSE,
      requirement TEXT,
      interested_in_demo BOOLEAN DEFAULT FALSE,
      source VARCHAR(50) DEFAULT 'website',
      status VARCHAR(30) DEFAULT 'new',
      assigned_user_id INTEGER REFERENCES users(id),
      seller_id INTEGER REFERENCES sellers(id),
      converted_to_subscription_id INTEGER REFERENCES subscriptions(id),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_segment VARCHAR(160)`);
  await pool.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS wants_sample_data BOOLEAN DEFAULT FALSE`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lead_activity (
      id SERIAL PRIMARY KEY,
      lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      activity_type VARCHAR(50) NOT NULL,
      note TEXT,
      actor_user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      audience_type VARCHAR(50) NOT NULL,
      channel VARCHAR(30) NOT NULL,
      seller_id INTEGER REFERENCES sellers(id),
      scheduled_at TIMESTAMP WITHOUT TIME ZONE,
      sent_at TIMESTAMP WITHOUT TIME ZONE,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id SERIAL PRIMARY KEY,
      notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      seller_id INTEGER REFERENCES sellers(id),
      user_id INTEGER REFERENCES users(id),
      delivery_status VARCHAR(30) DEFAULT 'pending',
      delivery_message TEXT,
      delivered_at TIMESTAMP WITHOUT TIME ZONE,
      read_at TIMESTAMP WITHOUT TIME ZONE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITHOUT TIME ZONE`);

  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS created_under_plan_id INTEGER REFERENCES plans(id)`);

  const defaultSellerResult = await pool.query(
    `INSERT INTO sellers (seller_code, name, onboarding_status)
     VALUES ('DEFAULT', 'Sai Laser', 'active')
     ON CONFLICT (seller_code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`
  );

  const defaultSellerId = defaultSellerResult.rows[0].id;

  for (const roleName of ["Super Admin", "Sales", "Seller Admin", "Seller User", "Demo User", "Master User", "Sub User", "Customer", "Admin"]) {
    await pool.query(
      `INSERT INTO roles (role_name)
       VALUES ($1)
       ON CONFLICT (role_name) DO NOTHING`,
      [roleName]
    );
  }

  await pool.query(`UPDATE users SET seller_id = NULL WHERE COALESCE(is_platform_admin, FALSE) = TRUE`);
  await pool.query(
    `UPDATE users
     SET seller_id = COALESCE(seller_id, $1)
     WHERE COALESCE(is_platform_admin, FALSE) = FALSE`,
    [defaultSellerId]
  );
  await pool.query(`UPDATE customers SET seller_id = COALESCE(seller_id, $1)`, [defaultSellerId]);
  await pool.query(`UPDATE products SET seller_id = COALESCE(seller_id, $1)`, [defaultSellerId]);
  await pool.query(`UPDATE quotations SET seller_id = COALESCE(seller_id, $1)`, [defaultSellerId]);
  await pool.query(`UPDATE quotations SET order_status = COALESCE(order_status, 'NEW')`);
  await pool.query(`UPDATE quotations SET quotation_sent = COALESCE(quotation_sent, FALSE)`);
  await pool.query(`UPDATE quotations SET design_cost_confirmed = COALESCE(design_cost_confirmed, FALSE)`);
  await pool.query(`UPDATE quotations SET source_channel = COALESCE(source_channel, 'manual')`);
  await pool.query(`UPDATE quotations SET delivery_type = COALESCE(delivery_type, 'PICKUP')`);
  await pool.query(`UPDATE quotations SET version_no = COALESCE(version_no, 1)`);
  await pool.query(`UPDATE quotations SET discount_amount = COALESCE(discount_amount, 0)`);
  await pool.query(`UPDATE quotations SET advance_amount = COALESCE(advance_amount, 0)`);
  await pool.query(`UPDATE quotations SET balance_amount = COALESCE(balance_amount, total_amount, 0)`);
  await pool.query(`UPDATE payments SET seller_id = COALESCE(seller_id, $1)`, [defaultSellerId]);
  await pool.query(`UPDATE ledger SET seller_id = COALESCE(seller_id, $1)`, [defaultSellerId]);
  await pool.query(`UPDATE products SET always_available = COALESCE(always_available, FALSE)`);
  await pool.query(`UPDATE products SET inventory_qty = COALESCE(inventory_qty, 0)`);
  await pool.query(`UPDATE products SET unit_type = COALESCE(unit_type, 'COUNT')`);
  await pool.query(`UPDATE products SET ps_supported = COALESCE(ps_supported, FALSE)`);
  await pool.query(`UPDATE products SET pricing_type = COALESCE(pricing_type, 'SFT')`);
  await pool.query(`UPDATE customers SET monthly_billing = COALESCE(monthly_billing, FALSE)`);
  await pool.query(`UPDATE customers SET shipping_addresses = COALESCE(shipping_addresses, '[]'::jsonb)`);
  await pool.query(`
    UPDATE sellers
    SET status = CASE
      WHEN status IS NULL OR LOWER(status) = 'trial' THEN 'pending'
      ELSE LOWER(status)
    END
  `);
  await pool.query(`UPDATE sellers SET subscription_plan = COALESCE(subscription_plan, 'DEMO')`);
  await pool.query(`UPDATE sellers SET included_users = COALESCE(included_users, 0)`);
  await pool.query(`UPDATE sellers SET purchased_user_count = COALESCE(purchased_user_count, max_users, 0)`);
  await pool.query(`UPDATE sellers SET active_user_count = COALESCE(active_user_count, 0)`);
  await pool.query(`UPDATE sellers SET available_user_count = COALESCE(available_user_count, 0)`);
  await pool.query(`UPDATE sellers SET seat_status = COALESCE(seat_status, 'available')`);
  await pool.query(`UPDATE sellers SET is_locked = COALESCE(is_locked, FALSE)`);
  await pool.query(`UPDATE sellers SET sample_data_enabled = COALESCE(sample_data_enabled, FALSE)`);
  await pool.query(`UPDATE leads SET wants_sample_data = COALESCE(wants_sample_data, FALSE)`);

  const demoPlanResult = await pool.query(
    `INSERT INTO plans (plan_code, plan_name, price, billing_cycle, is_active, is_demo_plan, trial_enabled, trial_duration_days, plan_access_type, template_access_tier, watermark_text)
     VALUES ('DEMO', 'Demo Plan', 0, 'monthly', TRUE, TRUE, TRUE, 14, 'FREE', 'FREE', 'Quotsy - Trial Version')
     ON CONFLICT (plan_code) DO UPDATE
       SET plan_name = EXCLUDED.plan_name,
           is_active = TRUE,
           is_demo_plan = TRUE,
           trial_enabled = TRUE,
           trial_duration_days = 14,
           plan_access_type = 'FREE',
           template_access_tier = 'FREE',
           watermark_text = EXCLUDED.watermark_text
     RETURNING id`
  );

  const trialPlanResult = await pool.query(
    `INSERT INTO plans (plan_code, plan_name, price, billing_cycle, is_active, is_demo_plan, trial_enabled, trial_duration_days, plan_access_type, template_access_tier, watermark_text)
     VALUES ('TRIAL', 'Trial Plan', 0, 'monthly', TRUE, FALSE, TRUE, 14, 'FREE', 'FREE', 'Quotsy - Trial Version')
     ON CONFLICT (plan_code) DO UPDATE
       SET plan_name = EXCLUDED.plan_name,
           is_active = TRUE,
           trial_enabled = TRUE,
           trial_duration_days = 14,
           plan_access_type = 'FREE',
           template_access_tier = 'FREE',
           watermark_text = EXCLUDED.watermark_text
     RETURNING id`
  );

  await pool.query(
    `INSERT INTO plan_features (plan_id, max_users, included_users, max_users_allowed, max_quotations, max_customers, inventory_enabled, reports_enabled, gst_enabled, exports_enabled, quotation_watermark_enabled, quotation_creation_locked_after_expiry, seat_expansion_allowed)
     VALUES ($1, 3, 3, 3, NULL, NULL, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE)
     ON CONFLICT (plan_id) DO NOTHING`,
    [demoPlanResult.rows[0].id]
  );

  await pool.query(
    `INSERT INTO plan_features (plan_id, max_users, included_users, max_users_allowed, max_quotations, max_customers, inventory_enabled, reports_enabled, gst_enabled, exports_enabled, quotation_watermark_enabled, quotation_creation_locked_after_expiry, seat_expansion_allowed)
     VALUES ($1, 3, 3, 3, NULL, NULL, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE)
     ON CONFLICT (plan_id) DO NOTHING`,
    [trialPlanResult.rows[0].id]
  );
  await pool.query(`UPDATE quotations SET record_status = COALESCE(record_status, 'submitted')`);
  await pool.query(`UPDATE quotations SET customer_monthly_billing = COALESCE(customer_monthly_billing, FALSE)`);
  await pool.query(`UPDATE quotation_items SET ps_included = COALESCE(ps_included, FALSE)`);
  await pool.query(`UPDATE quotation_items SET pricing_type = COALESCE(pricing_type, 'SFT')`);

  await pool.query(
    `
    UPDATE product_variants pv
    SET seller_id = COALESCE(pv.seller_id, p.seller_id, $1)
    FROM products p
    WHERE pv.product_id = p.id
  `,
    [defaultSellerId]
  );

  await pool.query(
    `
    UPDATE quotation_items qi
    SET seller_id = COALESCE(qi.seller_id, q.seller_id, $1)
    FROM quotations q
    WHERE qi.quotation_id = q.id
  `,
    [defaultSellerId]
  );

  await pool.query(
    `INSERT INTO quotation_templates (seller_id, template_name, template_preset, header_text, body_template, footer_text, company_phone, company_email, company_address, header_image_data, show_header_image, accent_color, notes_text, terms_text)
     VALUES ($1, 'default', 'commercial_offer', 'Commercial Offer', 'Dear {{customer_name}}, thank you for your enquiry. Please find our offer for quotation {{quotation_number}}.', 'We look forward to working with you.', '', '', '', NULL, FALSE, '#2563eb', 'Delivery and installation charges are extra unless mentioned.', 'Payment terms and final scope will be confirmed at order stage.')
     ON CONFLICT (seller_id, template_name) DO NOTHING`,
    [defaultSellerId]
  );

  await pool.query(
    `INSERT INTO message_decode_rules (seller_id)
     VALUES ($1)
     ON CONFLICT (seller_id) DO NOTHING`,
    [defaultSellerId]
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_jti VARCHAR(100) UNIQUE NOT NULL,
      issued_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
      revoked BOOLEAN DEFAULT FALSE,
      last_activity TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mobile_otp_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
      mobile VARCHAR(20) NOT NULL,
      otp_hash VARCHAR(128) NOT NULL,
      attempts INTEGER DEFAULT 0,
      revoked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
      verified_at TIMESTAMP WITHOUT TIME ZONE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS security_go_live_gates (
      id SERIAL PRIMARY KEY,
      gate_key VARCHAR(140) UNIQUE NOT NULL,
      category VARCHAR(100) NOT NULL,
      control_name VARCHAR(220) NOT NULL,
      priority VARCHAR(20) DEFAULT 'high',
      status VARCHAR(20) DEFAULT 'unknown',
      owner_name VARCHAR(120),
      target_date DATE,
      notes TEXT,
      evidence_link TEXT,
      updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const defaultGoLiveGates = [
    { gateKey: "gov-data-classification", category: "Governance & Privacy", controlName: "Data classification policy defined and approved", priority: "high", status: "partial" },
    { gateKey: "gov-field-classification-map", category: "Governance & Privacy", controlName: "API and DB field classification map completed (PII/SPI/non-sensitive)", priority: "high", status: "fail" },
    { gateKey: "gov-lawful-purpose", category: "Governance & Privacy", controlName: "Lawful purpose and data minimization documented per collected field", priority: "high", status: "fail" },
    { gateKey: "gov-retention-policy", category: "Governance & Privacy", controlName: "Retention and deletion policy defined per data type", priority: "high", status: "fail" },
    { gateKey: "gov-consent-model", category: "Governance & Privacy", controlName: "Privacy consent model defined and consent history recorded", priority: "high", status: "fail" },
    { gateKey: "gov-incident-response-plan", category: "Governance & Privacy", controlName: "Incident response plan with roles and escalation matrix", priority: "high", status: "partial" },
    { gateKey: "gov-secure-sdlc", category: "Governance & Privacy", controlName: "Secure SDLC policy with security gates in PR and release flow", priority: "high", status: "partial" },
    { gateKey: "gov-threat-model", category: "Governance & Privacy", controlName: "Threat model (STRIDE) maintained for auth, tenant isolation, media, and business logic", priority: "high", status: "partial" },
    { gateKey: "gov-trust-boundary-diagram", category: "Governance & Privacy", controlName: "Architecture trust-boundary diagram maintained and updated each release", priority: "medium", status: "fail" },

    { gateKey: "auth-mfa-admin", category: "Identity & Access", controlName: "MFA enabled for Platform Admin and Seller Admin", priority: "blocker", status: "fail" },
    { gateKey: "auth-password-policy", category: "Identity & Access", controlName: "Strong password policy enforced", priority: "high", status: "pass" },
    { gateKey: "auth-lockout", category: "Identity & Access", controlName: "Account lockout and cooldown after failed logins", priority: "high", status: "pass" },
    { gateKey: "auth-jwt-short-ttl", category: "Identity & Access", controlName: "JWT/session TTL aligned to security baseline", priority: "high", status: "partial" },
    { gateKey: "auth-refresh-rotation", category: "Identity & Access", controlName: "Refresh token rotation and revocation strategy implemented", priority: "high", status: "partial" },
    { gateKey: "auth-mobile-immutable", category: "Identity & Access", controlName: "Mobile login identity immutable in user edit", priority: "high", status: "pass" },
    { gateKey: "auth-platform-admin-controlled", category: "Identity & Access", controlName: "Platform admin creation restricted by controlled process", priority: "blocker", status: "partial" },
    { gateKey: "auth-role-separation", category: "Identity & Access", controlName: "Platform admin and seller admin scopes clearly separated", priority: "blocker", status: "pass" },
    { gateKey: "auth-role-change-audit", category: "Identity & Access", controlName: "Role-permission changes are audited with actor and timestamp", priority: "high", status: "partial" },
    { gateKey: "auth-account-recovery-hardened", category: "Identity & Access", controlName: "Account recovery flow hardened against takeover", priority: "high", status: "fail" },

    { gateKey: "access-rbac-deny-default", category: "Authorization & Tenant Isolation", controlName: "RBAC deny-by-default enforced for sensitive APIs", priority: "blocker", status: "partial" },
    { gateKey: "access-endpoint-audit", category: "Authorization & Tenant Isolation", controlName: "Endpoint-level authorization audit completed", priority: "high", status: "partial" },
    { gateKey: "access-tenant-isolation", category: "Authorization & Tenant Isolation", controlName: "Tenant isolation checks on every resource lookup (seller_id)", priority: "blocker", status: "partial" },
    { gateKey: "access-idor-ownership-checks", category: "Authorization & Tenant Isolation", controlName: "IDOR prevention by ownership checks on all id-based resource access", priority: "blocker", status: "partial" },
    { gateKey: "access-server-side-permissions", category: "Authorization & Tenant Isolation", controlName: "Server-side permission checks prevent privilege escalation", priority: "blocker", status: "pass" },
    { gateKey: "access-uuid-public-id-validation", category: "Authorization & Tenant Isolation", controlName: "Public UUID/resource identifier validation on sensitive APIs", priority: "medium", status: "fail" },

    { gateKey: "otp-bypass-nonprod-only", category: "OTP & Login Security", controlName: "Fixed OTP bypass restricted to non-production via env flag", priority: "high", status: "pass" },
    { gateKey: "otp-retry-lockout", category: "OTP & Login Security", controlName: "OTP retry limits and lockout windows implemented", priority: "high", status: "partial" },
    { gateKey: "otp-attempt-logging", category: "OTP & Login Security", controlName: "OTP request and verification attempts logged", priority: "high", status: "partial" },
    { gateKey: "otp-provider-production", category: "OTP & Login Security", controlName: "Trusted production SMS provider integrated with callback verification", priority: "high", status: "fail" },

    { gateKey: "api-request-schema-validation", category: "API & App Security", controlName: "Strict request schema validation (length, format, enum, required)", priority: "high", status: "partial" },
    { gateKey: "api-reject-unknown-fields", category: "API & App Security", controlName: "Unknown request fields rejected where feasible", priority: "medium", status: "partial" },
    { gateKey: "api-cors-allowlist", category: "API & App Security", controlName: "Strict CORS allowlist per environment without wildcard in production", priority: "high", status: "pass" },
    { gateKey: "api-rate-limits-sensitive", category: "API & App Security", controlName: "Rate limits for login, OTP, lead signup, and sensitive admin mutations", priority: "high", status: "partial" },
    { gateKey: "api-bot-protection", category: "API & App Security", controlName: "Bot and brute-force protections enabled on public/auth endpoints", priority: "high", status: "partial" },
    { gateKey: "api-request-logging", category: "API & App Security", controlName: "Request logging includes IP, user_id, endpoint, and status", priority: "medium", status: "fail" },
    { gateKey: "api-security-headers", category: "API & App Security", controlName: "Security headers enabled (HSTS, XFO, nosniff, referrer, permissions policy)", priority: "high", status: "pass" },
    { gateKey: "api-csp-enabled", category: "API & App Security", controlName: "Content Security Policy (CSP) configured and enforced", priority: "high", status: "fail" },
    { gateKey: "api-verbose-errors-off", category: "API & App Security", controlName: "Verbose error traces disabled in production responses", priority: "high", status: "partial" },
    { gateKey: "api-csrf-if-cookie-auth", category: "API & App Security", controlName: "Anti-CSRF strategy in place where cookie-based auth is used", priority: "medium", status: "unknown" },
    { gateKey: "api-replay-idempotency", category: "API & App Security", controlName: "Replay and idempotency protections on critical endpoints", priority: "high", status: "fail" },
    { gateKey: "api-secure-file-upload", category: "API & App Security", controlName: "Secure file upload controls (MIME, size, malware scan, signed URL)", priority: "medium", status: "partial" },
    { gateKey: "api-data-export-controls", category: "API & App Security", controlName: "Data export endpoints protected with authorization and audit", priority: "medium", status: "partial" },

    { gateKey: "db-least-privilege-user", category: "Data & Database Security", controlName: "App uses dedicated least-privilege DB user (no superuser creds)", priority: "blocker", status: "partial" },
    { gateKey: "db-tls-enforced", category: "Data & Database Security", controlName: "Database TLS enforced on all environment connections", priority: "high", status: "pass" },
    { gateKey: "db-network-hardening", category: "Data & Database Security", controlName: "DB network hardened (private network/IP restrictions/firewall)", priority: "high", status: "unknown" },
    { gateKey: "db-fk-unique-integrity", category: "Data & Database Security", controlName: "FKs and unique constraints protect referential integrity", priority: "high", status: "partial" },
    { gateKey: "db-sensitive-field-protection", category: "Data & Database Security", controlName: "Sensitive fields encrypted or hashed at rest where required", priority: "high", status: "fail" },
    { gateKey: "db-soft-hard-delete-policy", category: "Data & Database Security", controlName: "PII deletion policy (soft/hard delete) formally defined", priority: "medium", status: "fail" },
    { gateKey: "db-backup-encrypted-tested", category: "Data & Database Security", controlName: "Backups encrypted and restore drills tested with RPO/RTO", priority: "blocker", status: "unknown" },
    { gateKey: "db-migration-discipline", category: "Data & Database Security", controlName: "Migration discipline and security-impact review for UAT/prod", priority: "high", status: "partial" },

    { gateKey: "infra-https-only", category: "Infrastructure & Deployment", controlName: "HTTPS-only enforced with HTTP redirect", priority: "blocker", status: "partial" },
    { gateKey: "infra-secrets-vault", category: "Infrastructure & Deployment", controlName: "Secrets managed via vault/KMS and excluded from logs/code", priority: "high", status: "partial" },
    { gateKey: "infra-env-segregation", category: "Infrastructure & Deployment", controlName: "Dev/UAT/prod environment segregation (DB, secrets, config)", priority: "blocker", status: "pass" },
    { gateKey: "infra-admin-console-restricted", category: "Infrastructure & Deployment", controlName: "Admin console access restricted to platform admins", priority: "blocker", status: "pass" },
    { gateKey: "infra-waf-bot", category: "Infrastructure & Deployment", controlName: "WAF and bot protection enabled on public domains", priority: "high", status: "unknown" },
    { gateKey: "infra-container-hardening-scan", category: "Infrastructure & Deployment", controlName: "Container/image scanning and hardened base images", priority: "high", status: "unknown" },
    { gateKey: "infra-iac-scan", category: "Infrastructure & Deployment", controlName: "IaC scanning enabled for cloud templates/infrastructure changes", priority: "medium", status: "unknown" },
    { gateKey: "infra-secure-defaults", category: "Infrastructure & Deployment", controlName: "Secure defaults for new tenant, plan, and setting provisioning", priority: "high", status: "partial" },

    { gateKey: "finance-approval-enforcement", category: "Financial Workflow Controls", controlName: "Approval gates enforced for out-of-limit quotation scenarios", priority: "blocker", status: "pass" },
    { gateKey: "finance-supersede-protection", category: "Financial Workflow Controls", controlName: "Superseded approval requests blocked from stale decisions", priority: "high", status: "pass" },
    { gateKey: "finance-download-email-block", category: "Financial Workflow Controls", controlName: "Download, send-email, and confirm blocked when approval is pending/rejected", priority: "blocker", status: "pass" },
    { gateKey: "finance-override-reason-audit", category: "Financial Workflow Controls", controlName: "Approval overrides require reason and are fully auditable", priority: "high", status: "partial" },
    { gateKey: "finance-anomaly-detection", category: "Financial Workflow Controls", controlName: "Anomaly detection for unusual high-value and exception-heavy activity", priority: "high", status: "fail" },

    { gateKey: "logging-pii-redaction", category: "Logging & Monitoring", controlName: "PII masked or redacted in logs, traces, and error payloads", priority: "high", status: "partial" },
    { gateKey: "logging-admin-audit", category: "Logging & Monitoring", controlName: "Audit logs for admin, subscription, approval, and payment actions", priority: "blocker", status: "pass" },
    { gateKey: "logging-immutable-retention", category: "Logging & Monitoring", controlName: "Immutable security logs with retention policy", priority: "high", status: "partial" },
    { gateKey: "logging-security-alerts", category: "Logging & Monitoring", controlName: "Alerts for suspicious login and auth failure spikes", priority: "high", status: "fail" },
    { gateKey: "logging-db-slow-failed-monitoring", category: "Logging & Monitoring", controlName: "DB slow query and failed write monitoring enabled", priority: "high", status: "unknown" },
    { gateKey: "logging-vulnerability-register", category: "Logging & Monitoring", controlName: "Vulnerability register and remediation dashboard maintained", priority: "medium", status: "fail" },
    { gateKey: "logging-audit-evidence-pack", category: "Logging & Monitoring", controlName: "Evidence pack maintained for audits and assessments", priority: "medium", status: "partial" },

    { gateKey: "privacy-retention-lifetime", category: "Data Privacy & Compliance", controlName: "PII retention lifetime policy approved", priority: "high", status: "fail" },
    { gateKey: "privacy-data-deletion-process", category: "Data Privacy & Compliance", controlName: "Data deletion process available for user requests", priority: "high", status: "partial" },
    { gateKey: "privacy-consent-legal-alignment", category: "Data Privacy & Compliance", controlName: "Consent capture aligned with legal/privacy commitments", priority: "high", status: "partial" },

    { gateKey: "test-sast-ci", category: "Security Testing & VAPT", controlName: "SAST enabled in CI with fail-on-critical thresholds", priority: "high", status: "fail" },
    { gateKey: "test-sca-ci", category: "Security Testing & VAPT", controlName: "Dependency and vulnerability scanning enabled in CI", priority: "high", status: "fail" },
    { gateKey: "test-secret-scan-ci", category: "Security Testing & VAPT", controlName: "Secret scanning in CI and pre-commit hooks", priority: "high", status: "fail" },
    { gateKey: "test-authz-tenant-tests", category: "Security Testing & VAPT", controlName: "Mandatory authZ and tenant-isolation tests per release", priority: "blocker", status: "partial" },
    { gateKey: "vapt-scope-freeze", category: "Security Testing & VAPT", controlName: "VAPT scope frozen for web, API, mobile, infra, admin, storage, auth", priority: "high", status: "fail" },
    { gateKey: "vapt-stage-prod-parity", category: "Security Testing & VAPT", controlName: "Staging environment mirrors production security posture", priority: "high", status: "partial" },
    { gateKey: "vapt-owasp-coverage", category: "Security Testing & VAPT", controlName: "OWASP Top 10 and OWASP API Top 10 coverage completed", priority: "high", status: "fail" },
    { gateKey: "vapt-business-logic-tests", category: "Security Testing & VAPT", controlName: "Business logic abuse tests included in VAPT", priority: "high", status: "fail" },
    { gateKey: "vapt-manual-advanced-tests", category: "Security Testing & VAPT", controlName: "Manual tests for IDOR/auth bypass/priv-esc/injection/SSRF/deserialization", priority: "high", status: "fail" },
    { gateKey: "vapt-crypto-review", category: "Security Testing & VAPT", controlName: "Cryptography and key-management review completed", priority: "medium", status: "unknown" },
    { gateKey: "vapt-cvss-sla-remediation", category: "Security Testing & VAPT", controlName: "Findings tracked with CVSS and remediation SLA", priority: "high", status: "partial" },
    { gateKey: "vapt-retest-closure", category: "Security Testing & VAPT", controlName: "Post-fix retest and closure certificate recorded", priority: "high", status: "fail" },
    { gateKey: "vapt-recurring-cadence", category: "Security Testing & VAPT", controlName: "Recurring VAPT cadence set (major releases and biannual minimum)", priority: "medium", status: "fail" },

    { gateKey: "ops-incident-tabletop-quarterly", category: "Operational Readiness", controlName: "Incident response tabletop drills conducted quarterly", priority: "medium", status: "unknown" },
    { gateKey: "ops-backup-restore-monthly", category: "Operational Readiness", controlName: "Backup and restore drills conducted monthly", priority: "blocker", status: "unknown" },
    { gateKey: "ops-key-rotation-drills", category: "Operational Readiness", controlName: "Key rotation drills and rollback plans tested", priority: "high", status: "unknown" }
  ];

  for (const gate of defaultGoLiveGates) {
    await pool.query(
      `INSERT INTO security_go_live_gates (gate_key, category, control_name, priority, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (gate_key) DO NOTHING`,
      [gate.gateKey, gate.category, gate.controlName, gate.priority, gate.status]
    );
  }

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_token_jti ON user_sessions(token_jti)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_mobile_otp_codes_mobile_created ON mobile_otp_codes(mobile, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_mobile_otp_codes_user_created ON mobile_otp_codes(user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_seller_id ON users(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_approval_mode ON users(approval_mode)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_customers_seller_id ON customers(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotations_seller_id ON quotations(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotations_approval_status ON quotations(seller_id, approval_status, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_seller_id ON payments(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_seller_id ON subscriptions(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subscription_seat_events_seller_created ON subscription_seat_events(seller_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subscription_seat_requests_seller_status ON subscription_seat_requests(seller_id, status, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_usage_snapshots_seller_date ON seller_usage_snapshots(seller_id, snapshot_date DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_assigned_user ON leads(assigned_user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_lead_activity_lead_created ON lead_activity(lead_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notification_logs_seller_created ON notification_logs(seller_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_events_seller_quotation ON order_events(seller_id, quotation_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotation_versions_quotation_version ON quotation_versions(quotation_id, version_no DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_approval_mappings_requester_active ON user_approval_mappings(requester_user_id, is_active)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_approval_mappings_approver_active ON user_approval_mappings(approver_user_id, is_active)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotation_approval_requests_quotation_status ON quotation_approval_requests(quotation_id, status, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotation_approval_requests_approver_status ON quotation_approval_requests(assigned_approver_user_id, status, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotation_approval_reasons_request ON quotation_approval_reasons(approval_request_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_mobile_audit_logs_user_created ON mobile_audit_logs(user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_actor_created ON platform_audit_logs(actor_user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_rbac_roles_scope_order ON rbac_roles(scope, display_order, id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_rbac_role_permissions_role ON rbac_role_permissions(role_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_security_go_live_gates_status ON security_go_live_gates(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_security_go_live_gates_priority ON security_go_live_gates(priority)`);

  await seedRbacRolesAndPermissions(pool);
}

module.exports = {
  initializeDatabase
};
