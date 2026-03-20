# BillBuddy Multi-Tenant Gap Tracker

## Working Model
- Tenant model: `Seller = Tenant`
- Purpose: use this file as the implementation board for multi-tenant SaaS readiness
- Alignment reference: `C:\Users\Rahul\billbuddy\PLATFORM_ALIGNMENT_PLAN.md`

## Status Key
- `Done`: implemented and usable
- `Partial`: foundation exists but needs completion
- `Pending`: not yet built

---

## PRD Clean Status

| PRD Area | Status | Current State | Main Pending |
| --- | --- | --- | --- |
| Seller Management | Partial | Seller list, create, detail modal, lifecycle, subscription linking, usage summary are built | Guided onboarding flow, richer seller filters, dedicated seller detail page |
| Plan Management | Partial | Plan create, list, detail modal, feature limits, demo/trial flags are built | Duplicate/disable actions, assignment history, plan filters |
| Subscription Management | Partial | Subscription section, subscription modal, trial/demo enforcement, upgrade path foundation are built | richer filters, deeper audit/history UX, paid conversion journey |
| Lead Management | Partial | Public lead capture, lead list, lead detail, notes, assignment, convert-to-demo are built | Convert to seller, lead filters, sales workflow polish |
| Demo Account Management | Partial | Public self-demo signup now creates a demo tenant and login, demo plans and trial enforcement exist | OTP verification, dedicated demo list, expiry reminders |
| Notification Center | Partial | Notification tables, APIs, and platform notification module are built | scheduled delivery engine, seller inbox UX polish, email/SMS/WhatsApp delivery |
| Role & Permission Model | Partial | New target roles are seeded with backward compatibility and platform/seller split exists | complete role migration, Sales role journey, stronger permission enforcement |
| Security & Permissions | Partial | Platform admin independence and seller auth controls exist | full role-based access audit and demo-user-specific restrictions |
| Deployment Readiness | Pending | local platform and demo flows work | public domain, https, mobile production config |
## Summary Table

| Area | Status | What Exists | Main Gap | Key Files |
| --- | --- | --- | --- | --- |
| Tenant master | Done | `sellers` table exists and acts as tenant master | wording and standardization still needed | `C:\Users\Rahul\billbuddy\billbuddy-backend\utils\initDb.js`, `C:\Users\Rahul\schema.sql` |
| Tenant foreign keys | Done | `seller_id` added on core business tables | full audit still pending | `C:\Users\Rahul\billbuddy\billbuddy-backend\utils\initDb.js`, `C:\Users\Rahul\schema.sql` |
| Tenant lifecycle | Partial | seller lifecycle fields now exist in backend schema/runtime with status normalization started | platform UI and enforcement polish still pending | `C:\Users\Rahul\billbuddy\billbuddy-backend\utils\initDb.js`, `C:\Users\Rahul\schema.sql`, `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\sellerRoutes.js`, `C:\Users\Rahul\billbuddy\billbuddy-backend\middleware\auth.js` |
| Auth tenant context | Partial | token/session carry `sellerId` and `isPlatformAdmin`, and platform admins can now be seller-independent | full route audit still pending | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\authRoutes.js`, `C:\Users\Rahul\billbuddy\billbuddy-backend\middleware\auth.js` |
| Admin override | Partial | platform admin can override seller context | needs formal access-switch and audit review | `C:\Users\Rahul\billbuddy\billbuddy-backend\middleware\auth.js` |
| Route tenant isolation | Pending | many routes are already seller-scoped | formal audit not yet done | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes` |
| Platform admin bootstrap | Done | first platform admin creation exists | none for bootstrap | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\authRoutes.js` |
| Seller creation | Done | admin can create seller and optional master user | onboarding flow not guided | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\sellerRoutes.js`, `C:\Users\Rahul\billbuddy\billbuddy-frontend\billbuddy\src\App.jsx` |
| Platform dashboard | Partial | seller counts and usage overview exist, and seller rows now show linked subscription details | still needs dedicated seller detail and notification workflows | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\sellerRoutes.js`, `C:\Users\Rahul\billbuddy\billbuddy-frontend\billbuddy\src\App.jsx` |
| Seller lock/unlock | Partial | user lock exists | seller-level lock is missing | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\userRoutes.js` |
| Cross-seller product creation | Done | admin can create products for seller | needs polish only | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\productRoutes.js`, `C:\Users\Rahul\billbuddy\billbuddy-frontend\billbuddy\src\App.jsx` |
| Seller onboarding journey | Pending | seller creation exists | no guided setup wizard/checklist | `C:\Users\Rahul\billbuddy\billbuddy-frontend\billbuddy\src\App.jsx` |
| Seller workspace separation | Partial | seller-scoped app behavior exists | admin and seller UX still mixed | `C:\Users\Rahul\billbuddy\billbuddy-frontend\billbuddy\src\App.jsx` |
| Responsive/mobile web workspace | Partial | responsive quotation flow exists | not yet the full seller mobile-first workspace | `C:\Users\Rahul\billbuddy\billbuddy-frontend\billbuddy\src\ResponsiveQuotationApp.jsx` |
| Seller-scoped users | Done | users belong to sellers and use role model | none at base layer | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\userRoutes.js`, `C:\Users\Rahul\schema.sql` |
| Global roles model | Partial | roles exist and work | not seller-customizable | `C:\Users\Rahul\schema.sql` |
| Role model migration | Pending | old operational roles still exist | platform/seller/demo role mapping still needed | `C:\Users\Rahul\billbuddy\PLATFORM_ALIGNMENT_PLAN.md`, `C:\Users\Rahul\schema.sql` |
| Seller branding | Done | theme and brand color exist | more branding options later | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\sellerRoutes.js`, `C:\Users\Rahul\billbuddy\billbuddy-frontend\billbuddy\src\App.jsx` |
| Seller quotation template | Done | seller-scoped templates exist | polish only | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\quotationRoutes.js`, `C:\Users\Rahul\billbuddy\billbuddy-backend\utils\initDb.js` |
| Seller decode rules | Done | seller-scoped decode rules exist | polish only | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\whatsappRoutes.js`, `C:\Users\Rahul\billbuddy\billbuddy-backend\utils\initDb.js` |
| Subscription model | Partial | subscription APIs exist and seller rows are linked to current subscription details | dedicated subscription screens and broader enforcement still missing | `C:\Users\Rahul\billbuddy\PLATFORM_ALIGNMENT_PLAN.md`, `C:\Users\Rahul\billbuddy\billbuddy-backend\utils\initDb.js`, `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\subscriptionRoutes.js`, `C:\Users\Rahul\schema.sql` |
| Demo/trial model | Partial | demo/trial plans are seeded, seller creation is plan-backed, and quotation watermark/expiry lock are now enforced on create/output | upgrade/conversion and seller-facing banners still missing | `C:\Users\Rahul\billbuddy\PLATFORM_ALIGNMENT_PLAN.md`, `C:\Users\Rahul\billbuddy\billbuddy-backend\utils\initDb.js`, `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\sellerRoutes.js`, `C:\Users\Rahul\billbuddy\billbuddy-backend\services\quotationService.js` |
| Usage billing basis | Pending | no order/seat/plan billing logic | billable usage model missing | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\sellerRoutes.js` |
| Usage reporting | Partial | basic usage overview exists | monthly usage and billing snapshots missing | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\sellerRoutes.js` |
| Mobile audit logs | Done | audit table and routes exist | can be expanded later | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\mobileRoutes.js`, `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\mobileAuthRoutes.js` |
| Platform audit logging | Partial | platform audit table exists and password reset is now logged | seller creation, access switch, seller lock still missing | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes`, `C:\Users\Rahul\billbuddy\billbuddy-backend\services`, `C:\Users\Rahul\billbuddy\billbuddy-backend\utils\initDb.js` |
| Deployment readiness | Pending | local environment works | public domain, https, mobile production config missing | deployment not yet structured |

---

## Task Checklist

### Priority 1
- [~] Standardize `Seller = Tenant` wording across backend, frontend, and docs
- [~] Add seller lifecycle fields:
  - `status`
  - `trial_ends_at`
  - `subscription_plan`
  - `max_users`
  - `max_orders_per_month`
  - `is_locked`
- [ ] Sync `schema.sql` with runtime DB structure
- [ ] Perform tenant isolation audit on all core routes
- [ ] Document admin override rules for seller context
- [ ] Separate platform admin dashboard from seller workspace in UI
- [~] Normalize seller status values to pending/active/suspended/rejected/inactive
- [ ] Plan role migration from old roles to Super Admin / Sales / Seller Admin / Seller User / Demo User

### Priority 2
- [ ] Build seller onboarding wizard
- [ ] Add seller setup progress checklist
- [ ] Add seller-level lock/unlock flow
- [ ] Add seller suspension handling in auth and APIs
- [ ] Add seller setup landing page for master user
- [ ] Build proper demo/trial plan assignment flow

### Priority 3
- [x] Create plans table
- [x] Create plan_features table
- [x] Create subscriptions table
- [ ] Add seller usage snapshots
- [ ] Define billing basis:
  - order count
  - subscription fee
  - user seats
  - overage
- [~] Add platform audit logs for seller creation and admin access-switch
- [ ] Prepare public-domain and `https` deployment plan

### UX And Product Cleanup
- [ ] Split platform admin routes from seller routes
- [ ] Make responsive workspace the seller mobile-web experience
- [ ] Remove mixed admin/seller controls from shared screens
- [ ] Add dedicated seller management screens

---

## Phase-Wise Implementation Tracker

## Phase 1: Foundation Hardening

| Task | Status | Outcome | Files |
| --- | --- | --- | --- |
| Seller as tenant foundation | Done | `sellers` table and `seller_id` adoption already exist | `C:\Users\Rahul\billbuddy\billbuddy-backend\utils\initDb.js`, `C:\Users\Rahul\schema.sql` |
| Tenant auth context | Partial | auth/session carries seller context while allowing platform-admin independence | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\authRoutes.js`, `C:\Users\Rahul\billbuddy\billbuddy-backend\middleware\auth.js` |
| Tenant lifecycle schema | Partial | fields added, status normalization started, and seller create now aligns to cached subscription state | `C:\Users\Rahul\billbuddy\billbuddy-backend\utils\initDb.js`, `C:\Users\Rahul\schema.sql`, `C:\Users\Rahul\billbuddy\billbuddy-backend\middleware\auth.js`, `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\sellerRoutes.js` |
| Subscription-aligned lifecycle design | Partial | cached lifecycle strategy is now agreed | `C:\Users\Rahul\billbuddy\PLATFORM_ALIGNMENT_PLAN.md` |
| Route isolation audit | Pending | verify every route/service is seller-safe | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes`, `C:\Users\Rahul\billbuddy\billbuddy-backend\services` |

## Phase 2: Platform Control Plane

| Task | Status | Outcome | Files |
| --- | --- | --- | --- |
| Platform admin bootstrap | Done | first admin creation exists | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\authRoutes.js` |
| Seller creation flow | Done | seller and optional master user creation exist | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\sellerRoutes.js`, `C:\Users\Rahul\billbuddy\billbuddy-frontend\billbuddy\src\App.jsx` |
| Dedicated platform dashboard | Partial | basic metrics exist but console is mixed with seller app | `C:\Users\Rahul\billbuddy\billbuddy-frontend\billbuddy\src\App.jsx` |
| Seller lock/unlock | Pending | seller suspension feature not complete | backend + frontend pending |

## Phase 3: Seller Onboarding

| Task | Status | Outcome | Files |
| --- | --- | --- | --- |
| Guided onboarding | Pending | end-to-end guided setup missing | frontend onboarding flow pending |
| Setup checklist | Pending | no progress tracker per seller | seller onboarding UI + DB fields pending |
| Master user landing page | Pending | no seller setup landing experience | frontend pending |

## Phase 4: Seller Workspace

| Task | Status | Outcome | Files |
| --- | --- | --- | --- |
| Seller workspace separation | Partial | seller-scoped data exists but UX is mixed | `C:\Users\Rahul\billbuddy\billbuddy-frontend\billbuddy\src\App.jsx` |
| Responsive mobile-web workspace | Partial | responsive quotation flow exists | `C:\Users\Rahul\billbuddy\billbuddy-frontend\billbuddy\src\ResponsiveQuotationApp.jsx` |
| Clean route split | Pending | platform/seller/responsive routes need cleanup | frontend routing pending |

## Phase 5: SaaS Billing And Usage

| Task | Status | Outcome | Files |
| --- | --- | --- | --- |
| Subscription model | Partial | persisted plan/subscription schema exists and seller creation writes an initial subscription | routes, UI, and enforcement pending |
| Demo/trial as plan | Partial | demo/trial plans are seeded and initial seller assignment is plan-backed | watermark, expiry lock, and management UI pending |
| Usage billing | Pending | billable metrics not defined in system | backend pending |
| Usage dashboards | Partial | basic usage overview exists | `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\sellerRoutes.js` |

## Phase 6: Governance And Deployment

| Task | Status | Outcome | Files |
| --- | --- | --- | --- |
| Platform audit logs | Partial | password reset audit now exists | seller creation, access-switch, seller lifecycle audit still pending |
| Public domain readiness | Pending | no finalized deployment structure | deployment pending |
| HTTPS mobile readiness | Pending | required for stable APK production use | deployment pending |

---

## Immediate Daily-Use Focus

### This Week
- [~] Tenant route audit
- [~] Seller lifecycle fields
- [ ] Platform admin vs seller UI split plan

### Next Week
- [ ] Seller onboarding wizard design
- [ ] Seller setup checklist data model
- [ ] Seller lock/unlock implementation

### Later
- [ ] Subscription model
- [ ] Usage billing
- [ ] Public domain and `https`

---

## Tenant Route Audit - First Pass

## Route Registration Review

| Route Group | Auth Protected | Tenant Handling | First-Pass Status | Notes |
| --- | --- | --- | --- | --- |
| `/api/auth` | Public except `/me` and `/logout` | session carries `sellerId` | Partial | bootstrap/login is expected public |
| `/api/mobile-auth` | Public login, protected `/me`-style behavior through token | session carries `sellerId` | Partial | expected public login surface |
| `/api/roles` | Yes through global `/api` auth middleware | global lookup only | Acceptable | roles are global by design today |
| `/api/users` | Yes | uses `getTenantId(req)` | Good | seller-scoped creation/list/lock |
| `/api/customers` | Yes | uses `getTenantId(req)` | Good | seller-scoped |
| `/api/products` | Yes | uses `getTenantId(req)` and admin override | Good | strongest tenant coverage so far |
| `/api/quotations` | Yes | uses `getTenantId(req)` heavily | Good | key seller-aware route group |
| `/api/payments` | Yes | uses `getTenantId(req)` | Good | seller-scoped |
| `/api/ledger` | Yes | uses `getTenantId(req)` | Good | seller-scoped |
| `/api/dashboard` | Yes | uses `getTenantId(req)` | Good | seller-scoped summary |
| `/api/whatsapp` | Yes | uses tenant-aware logic | Good | seller-scoped decode/order parsing |
| `/api/sellers` | Yes | seller and platform-admin behavior split | Partial | admin console logic exists but seller lifecycle not complete |
| `/api/mobile` | Yes | uses `req.user.sellerId` | Partial | tenant-safe, but business logic still needs parity polish |

## Findings

### Good
- [x] All main business routes sit behind the global `authenticate` middleware in `C:\Users\Rahul\billbuddy\billbuddy-backend\server.js`
- [x] Core route groups use `seller_id` filtering or `getTenantId(req)`
- [x] Platform admin override is explicit in middleware, not hidden ad hoc in every route

### Needs Follow-Up
- [ ] Formal route-by-route checklist still needs completion for every endpoint inside each route file
- [ ] Seller lifecycle controls are missing, so tenant suspension is not yet enforceable at route level
- [ ] Global `roles` model is acceptable for now, but should be documented as a conscious non-tenant-specific design
- [ ] Mobile routes are tenant-safe but still need feature-parity cleanup with web flows

## Phase 1 Next Implementation Task

### Seller Lifecycle Fields
- Status: `In Progress`
- Reason:
  - after the first-pass route audit, the biggest missing foundation is tenant lifecycle control
  - without seller-level status and lock state, multi-tenant governance remains incomplete
- Fields to add:
  - [x] `status`
  - [x] `trial_ends_at`
  - [x] `subscription_plan`
  - [x] `max_users`
  - [x] `max_orders_per_month`
  - [x] `is_locked`
- Implemented:
  - seller lifecycle fields added in DB init/runtime
  - schema file updated
  - login/auth now blocks inactive or locked seller accounts
  - platform admin lifecycle update endpoint added
- Remaining:
  - admin UI for lifecycle editing
  - seller list status badges
  - seller suspension UX messaging
- Files likely impacted:
  - `C:\Users\Rahul\billbuddy\billbuddy-backend\utils\initDb.js`
  - `C:\Users\Rahul\schema.sql`
  - `C:\Users\Rahul\billbuddy\billbuddy-backend\routes\sellerRoutes.js`
  - `C:\Users\Rahul\billbuddy\billbuddy-backend\middleware\auth.js`

