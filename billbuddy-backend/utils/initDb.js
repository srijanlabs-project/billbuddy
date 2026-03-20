const pool = require("../db/db");

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      role_name VARCHAR(50) UNIQUE
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
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'DEMO'`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS max_users INTEGER`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS max_orders_per_month INTEGER`);
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

  await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES sellers(id)`);
  await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(200)`);
  await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS monthly_billing BOOLEAN DEFAULT FALSE`);

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
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS watermark_text TEXT`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS seller_quotation_serial INTEGER`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS seller_quotation_number VARCHAR(80)`);
  await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS custom_quotation_number VARCHAR(120)`);
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
      watermark_text TEXT,
      created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS plan_features (
      id SERIAL PRIMARY KEY,
      plan_id INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
      max_users INTEGER,
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      seller_id INTEGER NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      plan_id INTEGER NOT NULL REFERENCES plans(id),
      status VARCHAR(20) NOT NULL DEFAULT 'trial',
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
  await pool.query(`
    UPDATE sellers
    SET status = CASE
      WHEN status IS NULL OR LOWER(status) = 'trial' THEN 'pending'
      ELSE LOWER(status)
    END
  `);
  await pool.query(`UPDATE sellers SET subscription_plan = COALESCE(subscription_plan, 'DEMO')`);
  await pool.query(`UPDATE sellers SET is_locked = COALESCE(is_locked, FALSE)`);

  const demoPlanResult = await pool.query(
    `INSERT INTO plans (plan_code, plan_name, price, billing_cycle, is_active, is_demo_plan, trial_enabled, trial_duration_days, watermark_text)
     VALUES ('DEMO', 'Demo Plan', 0, 'monthly', TRUE, TRUE, TRUE, 14, 'Quotsy - Trial Version')
     ON CONFLICT (plan_code) DO UPDATE
       SET plan_name = EXCLUDED.plan_name,
           is_active = TRUE,
           is_demo_plan = TRUE,
           trial_enabled = TRUE,
           trial_duration_days = 14,
           watermark_text = EXCLUDED.watermark_text
     RETURNING id`
  );

  const trialPlanResult = await pool.query(
    `INSERT INTO plans (plan_code, plan_name, price, billing_cycle, is_active, is_demo_plan, trial_enabled, trial_duration_days, watermark_text)
     VALUES ('TRIAL', 'Trial Plan', 0, 'monthly', TRUE, FALSE, TRUE, 14, 'Quotsy - Trial Version')
     ON CONFLICT (plan_code) DO UPDATE
       SET plan_name = EXCLUDED.plan_name,
           is_active = TRUE,
           trial_enabled = TRUE,
           trial_duration_days = 14,
           watermark_text = EXCLUDED.watermark_text
     RETURNING id`
  );

  await pool.query(
    `INSERT INTO plan_features (plan_id, max_users, max_quotations, max_customers, inventory_enabled, reports_enabled, gst_enabled, exports_enabled, quotation_watermark_enabled, quotation_creation_locked_after_expiry)
     VALUES ($1, NULL, NULL, NULL, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
     ON CONFLICT (plan_id) DO NOTHING`,
    [demoPlanResult.rows[0].id]
  );

  await pool.query(
    `INSERT INTO plan_features (plan_id, max_users, max_quotations, max_customers, inventory_enabled, reports_enabled, gst_enabled, exports_enabled, quotation_watermark_enabled, quotation_creation_locked_after_expiry)
     VALUES ($1, NULL, NULL, NULL, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE)
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

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_token_jti ON user_sessions(token_jti)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_seller_id ON users(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_customers_seller_id ON customers(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotations_seller_id ON quotations(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_seller_id ON payments(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_seller_id ON subscriptions(seller_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON subscriptions(plan_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_seller_usage_snapshots_seller_date ON seller_usage_snapshots(seller_id, snapshot_date DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_leads_assigned_user ON leads(assigned_user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_lead_activity_lead_created ON lead_activity(lead_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_notification_logs_seller_created ON notification_logs(seller_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_order_events_seller_quotation ON order_events(seller_id, quotation_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotation_versions_quotation_version ON quotation_versions(quotation_id, version_no DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_mobile_audit_logs_user_created ON mobile_audit_logs(user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_platform_audit_logs_actor_created ON platform_audit_logs(actor_user_id, created_at DESC)`);
}

module.exports = {
  initializeDatabase
};
