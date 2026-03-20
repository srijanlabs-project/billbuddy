# Seller Configuration Specification

## Overview

This document defines the seller-wise configuration layer required for BillBuddy so each seller can operate with a different catalogue structure, quotation item structure, visibility model, upload template, and preview experience.

The goal is to move from one fixed seller workflow to a configurable engine where:

- platform controls the configuration framework
- each seller can have an independent schema
- changes are previewed before publishing
- future product and quotation behavior is driven by configuration instead of hardcoded screens

## Objectives

1. Allow seller-specific catalogue field structures
2. Allow seller-specific quotation item columns and formulas
3. Allow seller-specific visibility of modules, sections, and fields
4. Generate seller-specific upload templates
5. Provide preview before publish
6. Support draft, publish, and rollback

## Design Principles

1. Configuration must be seller-specific
2. Configuration should be versioned
3. Preview is mandatory before publish
4. Upload templates must be generated from configuration
5. Product form, quotation form, and PDF should derive from the same schema

## User Roles

### Platform Admin
- create and manage seller configuration profiles
- publish configuration
- rollback configuration
- override seller configuration if needed

### Seller Admin
- optionally edit configuration if permission is enabled
- preview forms and templates
- request changes if platform-only mode is kept

### Seller User
- consume the published configuration only

## Modules

1. Seller Configuration Dashboard
2. Catalogue Fields Configuration
3. Quotation Columns Configuration
4. Quotation Definitions
5. Section Visibility Configuration
6. Product Upload Template
7. Preview
8. Category Rules
9. Formula Builder
10. Versioning and Publish

## Screen Specifications

### 1. Seller Configuration Dashboard

#### Purpose
Provide one landing page for seller-specific schema and behavior settings.

#### Key Information
- seller name
- active configuration profile
- current version
- draft version status
- last published at
- last updated by
- enabled modules summary

#### Actions
- open catalogue fields
- open quotation columns
- open definitions
- open section visibility
- open upload template
- open preview
- publish draft
- rollback to previous version

#### Suggested UI Blocks
- seller header
- current configuration summary card
- module status cards
- draft vs published card
- quick navigation actions

#### Priority
High

### 2. Catalogue Fields Configuration

#### Purpose
Allow each seller to define the product master schema used in product forms, product list, product upload, and mapping into quotations.

#### Supported Field Properties
- field label
- field key
- type
- required
- visible in product form
- visible in product list
- searchable
- filterable
- upload enabled
- default value
- help text
- field order

#### Example Catalogue Fields
- material_name
- category
- thickness
- colour
- finish
- size
- unit_type
- base_price
- sku
- brand
- stock

#### Actions
- add field
- edit field
- reorder fields
- delete field
- duplicate field
- restore default set

#### Validation Rules
- field key must be unique per seller config
- field type must be one of supported types
- required fields must be clearly marked

#### Priority
High

### 3. Quotation Columns Configuration

#### Purpose
Allow seller to define which item columns appear in create quotation, item table, quotation details, and quotation PDF.

#### Supported Column Properties
- label
- key
- type
- order
- visible in create form
- visible in table
- visible in PDF
- editable
- required
- calculation input
- derived field

#### Example Columns
- material
- thickness
- colour
- width
- height
- unit
- quantity
- rate
- amount
- note
- ps
- other_info

#### Actions
- add column
- edit column
- reorder columns
- toggle PDF visibility
- toggle form visibility
- delete column

#### Priority
High

### 4. Quotation Definitions Screen

#### Purpose
Define the meaning and behavior of quotation fields and columns.

#### Supported Definition Properties
- field key
- business meaning
- source
- type
- formula
- validation
- allowed values
- fallback value
- mapping target

#### Example Definitions
- amount = width * height * qty * rate
- display_name = colour + material_name
- thickness optional for product category
- note shown in PDF but not in product list

#### Actions
- add definition
- edit definition
- map to source fields
- attach validation
- attach formula

#### Priority
Medium

### 5. Section Visibility Configuration

#### Purpose
Control module-level and screen-level visibility by seller.

#### Visibility Areas
- dashboard widgets
- products module
- quotation module
- customers module
- payments module
- reports module
- delivery section
- discount section
- advance section
- monthly billing section
- versioning section
- PDF terms section

#### Actions
- toggle show or hide
- set default expanded section
- set seller nav visibility

#### Priority
High

### 6. Product Upload Template Screen

#### Purpose
Generate upload template based on seller catalogue configuration.

#### Features
- download sample XLSX
- download sample CSV
- show required columns
- show optional columns
- show accepted values
- show validation rules
- show sample rows
- upload and validate preview

#### Actions
- download template
- preview mapping
- validate upload
- import after validation

#### Priority
High

### 7. Preview Screen

#### Purpose
Allow seller admin or platform admin to see the effect of configuration before publish.

#### Preview Tabs
- Product Form
- Product List
- Quotation Create Screen
- Quotation Item Table
- Quotation PDF

#### Important Note
This screen is critical because configuration without preview creates operational mistakes and distrust.

#### Actions
- preview draft configuration
- compare with published version
- open sample quotation preview
- open sample upload preview

#### Priority
High

### 8. Category Rules Screen

#### Purpose
Define different behavior for Sheet, Product, Services, Imported, and future categories.

#### Rule Types
- visible fields
- required fields
- optional fields
- calculation inputs
- PDF fields
- upload applicability

#### Example Rules
- width and height only for sheet
- quantity and rate for services
- thickness optional for imported acrylic
- unit hidden for products

#### Priority
Medium

### 9. Formula Builder Screen

#### Purpose
Allow low-code definition of formulas without editing code.

#### Formula Areas
- line amount
- total amount
- discount logic
- advance logic
- display label
- taxable amount
- custom derived fields

#### Suggested Modes
- basic builder
- advanced expression editor

#### Priority
Medium

### 10. Versioning and Publish Screen

#### Purpose
Support draft, publish, compare, and rollback for seller configuration.

#### States
- draft
- published
- archived

#### Version Actions
- save draft
- publish
- compare versions
- rollback
- duplicate version

#### Priority
High

## Data Model

### New Tables

#### seller_configuration_profiles
- id
- seller_id
- profile_name
- status
- current_version_id
- created_by
- updated_by
- created_at
- updated_at

#### seller_configuration_versions
- id
- profile_id
- version_no
- version_status
- notes
- created_by
- created_at

#### seller_catalogue_fields
- id
- version_id
- field_key
- field_label
- field_type
- required
- visible_in_form
- visible_in_list
- searchable
- filterable
- upload_enabled
- default_value
- help_text
- field_order

#### seller_quotation_columns
- id
- version_id
- column_key
- column_label
- column_type
- required
- editable
- visible_in_form
- visible_in_table
- visible_in_pdf
- included_in_calculation
- field_order

#### seller_field_definitions
- id
- version_id
- field_key
- business_meaning
- source_type
- source_key
- data_type
- formula_expression
- validation_json
- mapping_json

#### seller_section_visibility
- id
- version_id
- section_key
- visible
- config_json

#### seller_category_rules
- id
- version_id
- category_key
- rules_json

#### seller_upload_templates
- id
- version_id
- template_type
- template_schema_json
- sample_rows_json
- validation_rules_json

## API Suggestions

### Configuration Dashboard
- `GET /api/seller-config/:sellerId/dashboard`

### Catalogue Fields
- `GET /api/seller-config/:sellerId/catalogue-fields`
- `POST /api/seller-config/:sellerId/catalogue-fields`
- `PATCH /api/seller-config/catalogue-fields/:id`
- `DELETE /api/seller-config/catalogue-fields/:id`

### Quotation Columns
- `GET /api/seller-config/:sellerId/quotation-columns`
- `POST /api/seller-config/:sellerId/quotation-columns`
- `PATCH /api/seller-config/quotation-columns/:id`
- `DELETE /api/seller-config/quotation-columns/:id`

### Definitions
- `GET /api/seller-config/:sellerId/definitions`
- `POST /api/seller-config/:sellerId/definitions`
- `PATCH /api/seller-config/definitions/:id`

### Visibility
- `GET /api/seller-config/:sellerId/visibility`
- `PUT /api/seller-config/:sellerId/visibility`

### Upload Template
- `GET /api/seller-config/:sellerId/upload-template`
- `GET /api/seller-config/:sellerId/upload-template/download`
- `POST /api/seller-config/:sellerId/upload-template/validate`

### Preview
- `GET /api/seller-config/:sellerId/preview/product-form`
- `GET /api/seller-config/:sellerId/preview/product-list`
- `GET /api/seller-config/:sellerId/preview/quotation-form`
- `GET /api/seller-config/:sellerId/preview/quotation-pdf`

### Versioning
- `GET /api/seller-config/:sellerId/versions`
- `POST /api/seller-config/:sellerId/draft`
- `POST /api/seller-config/:sellerId/publish`
- `POST /api/seller-config/:sellerId/rollback/:versionId`

## Screen Creation Priority

### Phase 1
1. Seller Configuration Dashboard
2. Catalogue Fields Configuration
3. Quotation Columns Configuration
4. Preview Screen

### Phase 2
5. Section Visibility Configuration
6. Product Upload Template Screen
7. Versioning and Publish

### Phase 3
8. Quotation Definitions Screen
9. Category Rules Screen
10. Formula Builder

## Recommended Build Order

1. Data model and draft/publish version layer
2. Catalogue Fields screen
3. Quotation Columns screen
4. Preview screen
5. Upload template generation
6. Visibility screen
7. Definitions and formulas

## Risks

1. If preview is skipped, seller admins will configure blindly
2. If versioning is skipped, rollback will become painful
3. If upload template is static, configuration loses value
4. If product and quotation schemas drift apart, seller setup becomes confusing

## Immediate Recommendation

Start with these four:

1. Seller Configuration Dashboard
2. Catalogue Fields Configuration
3. Quotation Columns Configuration
4. Preview Screen

These four will create the strongest visible value and make the rest of the configuration system easier to trust and extend.
