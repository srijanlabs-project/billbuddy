# BillBuddy Platform Alignment Plan

## Agreed Decisions

### Keep
- Keep `users` as the single user table
- Keep `sellers` as the tenant master
- Keep seller lifecycle fields on `sellers`
- Keep `seller_id` on seller-scoped business tables

### Change
- Platform admins should be independent of sellers
- Trial should move out of seller lifecycle status and into plan/subscription state
- Seller lifecycle fields should represent current account state, not trial semantics

### Avoid For Now
- Do not create a separate `seller_users` table

---

## Target Model

### Tenant Model
- `Seller = Tenant`
- One seller owns:
  - seller users
  - customers
  - products
  - quotations
  - payments
  - ledger
  - templates
  - decode rules

### User Model
- `users` will represent both platform-side and seller-side users

#### Platform Users
- `seller_id = NULL`
- examples:
  - `Super Admin`
  - `Sales`

#### Seller Users
- `seller_id = sellers.id`
- examples:
  - `Seller Admin`
  - `Seller User`
  - `Demo User`

---

## Seller Lifecycle vs Subscription State

### Seller Lifecycle Fields
These remain on `sellers` as cached current-state governance fields:
- `status`
- `is_locked`
- `subscription_plan`
- `trial_ends_at`
- `max_users`
- `max_orders_per_month`

### Intended Meaning
- `status` controls operational account state
- `is_locked` is an explicit hard lock
- `subscription_plan`, `trial_ends_at`, limits are cached from the active subscription/plan

### Recommended Seller Status Values
- `pending`
- `active`
- `suspended`
- `rejected`
- `inactive`

### Important Rule
- `trial` should not remain a seller status
- trial/demo behavior should come from subscription/plan state

---

## Role Mapping Plan

### Current Roles
- `Admin`
- `Master User`
- `Sub User`
- `Customer`

### Target Roles
- `Super Admin`
- `Sales`
- `Seller Admin`
- `Seller User`
- `Demo User`

### Simple Migration Path
- map old `Admin` -> `Super Admin` for platform users only
- map old `Master User` -> `Seller Admin`
- map old `Sub User` -> `Seller User`
- keep `Customer` outside auth role planning
- add `Sales`
- add `Demo User`

---

## New Core Entities To Add

### 1. `plans`
Purpose:
- define sellable and trial/demo plans

Suggested fields:
- `id`
- `plan_code`
- `plan_name`
- `price`
- `billing_cycle`
- `is_active`
- `is_demo_plan`
- `trial_enabled`
- `trial_duration_days`
- `watermark_text`
- `created_at`
- `updated_at`

### 2. `plan_features`
Purpose:
- feature-level entitlement and limits for a plan

Suggested fields:
- `id`
- `plan_id`
- `max_users`
- `max_quotations`
- `max_customers`
- `inventory_enabled`
- `reports_enabled`
- `gst_enabled`
- `exports_enabled`
- `quotation_watermark_enabled`
- `quotation_creation_locked_after_expiry`
- `created_at`
- `updated_at`

### 3. `subscriptions`
Purpose:
- assign a plan to a seller and manage the actual lifecycle

Suggested fields:
- `id`
- `seller_id`
- `plan_id`
- `status`
- `start_date`
- `end_date`
- `trial_start_at`
- `trial_end_at`
- `converted_from_trial`
- `auto_assigned`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Recommended subscription statuses:
- `trial`
- `active`
- `expired`
- `cancelled`
- `suspended`

### 4. `seller_usage_snapshots`
Purpose:
- monthly or periodic usage summary for billing and platform reporting

Suggested fields:
- `id`
- `seller_id`
- `snapshot_date`
- `active_user_count`
- `quotation_count`
- `customer_count`
- `created_at`

---

## Demo And Trial Model

### Important Decision
- Demo is a plan
- A demo/trial account is not a separate user architecture
- It is a seller running on a demo/trial subscription

### Recommended Behavior
- New demo seller gets auto-assigned the `DEMO` or `TRIAL` plan
- Trial duration: `14 days`
- Trial has full access
- Trial watermark applies on quotations
- When trial expires:
  - lock quotation creation
  - allow upgrade path

### Why This Is Better
- no need for separate `demo_accounts` table immediately
- lower migration risk
- plan/subscription becomes the true entitlement engine

### Optional Later
If reporting needs become more complex, we can still add a projection/reporting table for demo accounts later.

---

## Cached Current-State Strategy

### On `sellers`
Keep these cached fields for fast reads and admin list screens:
- `subscription_plan`
- `trial_ends_at`
- `max_users`
- `max_orders_per_month`
- `status`
- `is_locked`

### Source of Truth
- `plans`
- `plan_features`
- `subscriptions`

### Sync Rule
Whenever a subscription changes:
- update `subscriptions`
- update seller cached fields

---

## Phase-Wise Build Order

## Phase 1
- finalize role mapping
- normalize seller status values
- keep platform admins seller-independent everywhere
- add `plans`
- add `plan_features`
- add `subscriptions`

## Phase 2
- assign default demo/trial plan to new demo accounts
- enforce watermark from plan/subscription
- enforce trial expiry quotation lock
- sync cached seller lifecycle fields from subscriptions

## Phase 3
- add `leads`
- add `lead_activity`
- build lead capture and conversion flow

## Phase 4
- add `notifications`
- add `notification_logs`
- audience targeting and schedule/send flow

---

## Immediate Build Tasks

- [ ] Add target role names and mapping strategy
- [ ] Normalize seller status values in code and UI
- [ ] Create `plans` table
- [ ] Create `plan_features` table
- [ ] Create `subscriptions` table
- [ ] Add seller cached-field sync from subscription
- [ ] Define default demo/trial plan seed
- [ ] Update seller onboarding to select/assign plan
- [ ] Add trial watermark enforcement rule
- [ ] Add trial-expiry quotation creation lock

---

## Notes For Existing Code

### Keep Working As-Is For Now
- seller-scoped quotation/product/customer flows
- seller branding
- quotation templates
- decode rules
- user management

### Needs Refactor Next
- role naming
- seller status options
- seller onboarding fields
- platform dashboard metrics to include plan/trial context

