# Route Security Matrix

## Purpose

This document tracks Quotsy's important routes from a security perspective:

- authentication requirement
- permission requirement
- tenant ownership validation
- current status

This is a working matrix. It should evolve as backend enforcement expands.

## Status Legend

- `Done`: enforced and reviewed
- `Partial`: some enforcement exists, needs validation or completion
- `Pending`: not yet reviewed or not yet enforced

## Authentication and Public Routes

| Area | Route | Auth | Permission | Tenant Ownership Check | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Public | `POST /api/auth/login` | No | N/A | N/A | Partial | Rate limiting added; password hashing added; account enumeration and reset review still needed |
| Public | `POST /api/auth/bootstrap-admin` | No | N/A | N/A | Partial | Rate limiting added; must remain tightly controlled for first-run only |
| Public | `POST /api/mobile-auth/request-otp` | No | N/A | N/A | Partial | OTP currently disabled or placeholder; final integration pending |
| Public | `POST /api/mobile-auth/login` | No | N/A | N/A | Partial | OTP currently disabled or placeholder; final integration pending |
| Public | `POST /api/auth/demo-signup` | No | N/A | N/A | Partial | Input validation and abuse controls should be reviewed |
| Public | `POST /api/leads/public` | No | N/A | N/A | Partial | Spam/rate limiting review needed |

## Quotation Routes

| Area | Route | Auth | Permission | Tenant Ownership Check | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Quotations | `GET /api/quotations` | Yes | `quotation.search` | Seller-scoped list required | Partial | Permission enforced; seller scoping and filter abuse should be retested |
| Quotations | `POST /api/quotations` | Yes | `quotation.create` | Seller ownership of related objects required | Partial | Permission enforced; linked customer/product ownership review needed |
| Quotations | `GET /api/quotations/:id/download` | Yes | `quotation.download_pdf` | Must verify quotation belongs to authenticated tenant | Partial | High-value route for IDOR review |
| Quotations | `PATCH /api/quotations/:id/revise` | Yes | `quotation.revise` | Must verify same tenant and version rules | Partial | Permission enforced; revision logic review needed |
| Quotations | `PATCH /api/quotations/:id/confirm` | Yes | `quotation.edit` | Must verify same tenant | Partial | Permission enforced |
| Quotations | `PATCH /api/quotations/:id/order-status` | Yes | `quotation.edit` | Must verify same tenant | Partial | Status transition abuse review needed |
| Quotations | `PATCH /api/quotations/:id/logistics` | Yes | `quotation.edit` | Must verify same tenant | Partial | Logistics field validation still needs review |
| Quotations | `PATCH /api/quotations/:id/mark-sent` | Yes | `quotation.send` | Must verify same tenant | Partial | Should be audit logged |
| Quotations | `PATCH /api/quotations/:id/payment-status` | Yes | `quotation.mark_paid` | Must verify same tenant | Partial | Should be audit logged |
| Quotations | `PUT /api/quotations/templates/current` | Yes | `settings.edit` | Seller template must belong to current tenant | Partial | Permission enforced; template upload/render review still needed |

## Customer Routes

| Area | Route | Auth | Permission | Tenant Ownership Check | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Customers | `GET /api/customers` | Yes | `customer.view` | Seller-scoped list required | Partial | Permission enforced; direct object fetch routes should be reviewed if present |
| Customers | `POST /api/customers` | Yes | `customer.create` | Customer must be created under authenticated tenant | Partial | Permission enforced |
| Customers | `PATCH /api/customers/:id` | Yes | `customer.edit` | Must verify customer belongs to tenant | Pending | Confirm route exists and enforce consistently |
| Customers | `DELETE /api/customers/:id` | Yes | `customer.delete` | Must verify customer belongs to tenant | Pending | Confirm route exists and enforce consistently |

## Product Routes

| Area | Route | Auth | Permission | Tenant Ownership Check | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Products | `GET /api/products` | Yes | `product.view` | Seller-scoped list required | Partial | Permission enforced; search/filter validation should be reviewed |
| Products | `POST /api/products` | Yes | `product.create` | Product must be created under authenticated tenant | Partial | Permission enforced |
| Products | `POST /api/products/bulk` | Yes | `product.bulk_upload` | Bulk import must stay tenant-scoped | Partial | High-value abuse route; add size and rate controls |
| Products | `PATCH /api/products/:id` | Yes | `product.edit` | Must verify product belongs to tenant | Partial | Permission enforced |
| Products | `PATCH /api/products/:id/inventory` | Yes | `product.edit` | Must verify product belongs to tenant | Partial | Business logic validation needed |
| Products | `PATCH /api/products/:id/unit-config` | Yes | `product.edit` | Must verify product belongs to tenant | Partial | Review mass assignment and validation |
| Products | `GET /api/products/:productId/variants` | Yes | `product.view` | Must verify product belongs to tenant | Partial | Direct ID route needs explicit review |
| Products | `POST /api/products/:productId/variants` | Yes | `product.edit` | Must verify parent product belongs to tenant | Partial | Direct ID route needs explicit review |

## User and Role Routes

| Area | Route | Auth | Permission | Tenant Ownership Check | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Users | `GET /api/users` | Yes | `user.view` | Seller users must only see same-tenant users unless platform role | Partial | Permission enforced; tenant-scope review still needed |
| Users | `POST /api/users` | Yes | `user.create` | Created user must belong to current tenant unless platform flow | Partial | Permission enforced |
| Users | `PATCH /api/users/:id/lock` | Yes | `user.edit` | Must verify correct tenant or platform scope | Partial | Sensitive admin route; audit logging needed |
| Users | `PATCH /api/users/:id/reset-password` | Yes | `user.edit` | Must verify correct tenant or platform scope | Partial | Sensitive admin route; audit logging needed |
| Roles | `GET /api/roles` | Yes | Platform or seller visibility by scope | N/A | Partial | Read route behind auth now; may need platform-only refinement |
| Roles | `POST /api/roles/seed` | Yes | Platform admin only | N/A | Done | Protected by platform admin requirement |

## Seller Settings and Configuration Routes

| Area | Route | Auth | Permission | Tenant Ownership Check | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Seller Settings | `PUT /api/sellers/me/settings` | Yes | `settings.edit` | Current seller only | Partial | Permission enforced |
| Seller Config | `POST /api/seller-config/:sellerId/publish` | Yes | `configuration.publish` | Must verify target seller matches current tenant or valid platform scope | Partial | Direct sellerId path needs explicit IDOR review |
| Seller Config | `POST /api/seller-config/:sellerId/draft` | Yes | `configuration.save_draft` | Must verify target seller matches current tenant or valid platform scope | Pending | Ensure backend permission exists and owner check is enforced |
| Seller Config | `GET /api/seller-config/:sellerId` | Yes | `configuration.view` | Must verify target seller matches current tenant or valid platform scope | Pending | High-priority ownership check route |

## Platform Routes

| Area | Route | Auth | Permission | Tenant Ownership Check | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Sellers | `GET /api/sellers` | Yes | `seller.view` | Platform scope only | Pending | Review platform-only enforcement |
| Sellers | `POST /api/sellers` | Yes | `seller.create` | Platform scope only | Pending | Review platform-only enforcement |
| Sellers | `PATCH /api/sellers/:id` | Yes | `seller.edit` | Platform scope only | Pending | Review platform-only enforcement |
| Plans | `GET /api/plans` | Yes | `plan.view` | Platform scope only | Pending | Review platform-only enforcement |
| Plans | `POST /api/plans` | Yes | `plan.create` | Platform scope only | Pending | Review platform-only enforcement |
| Plans | `PATCH /api/plans/:id` | Yes | `plan.edit` | Platform scope only | Pending | Review platform-only enforcement |
| Subscriptions | `GET /api/subscriptions` | Yes | `subscription.view` | Platform scope or seller self-scope only | Pending | Review platform vs seller behavior |
| Subscriptions | `PATCH /api/subscriptions/:id` | Yes | `subscription.manage` | Platform scope or seller self-scope only | Pending | Review platform vs seller behavior |
| Notifications | `GET /api/notifications` | Yes | `notification.view` | Must respect seller or platform scope | Pending | Review data isolation and role enforcement |
| Notifications | `POST /api/notifications` | Yes | `notification.create` | Must respect seller or platform scope | Pending | Review platform-only vs seller-specific paths |

## File Upload and Document Routes

| Area | Route | Auth | Permission | Tenant Ownership Check | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Uploads | Header/logo upload endpoints | Yes | `settings.edit` or `configuration.edit` | Must ensure uploaded file belongs only to authenticated tenant | Pending | Add MIME, size, storage, and direct URL review |
| Documents | PDF/quotation document access | Yes | `quotation.download_pdf` | Must ensure document belongs to tenant | Partial | Direct URL and caching behavior should be reviewed |

## Search and Export Surfaces

| Area | Route | Auth | Permission | Tenant Ownership Check | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Search | Header search / quotation autosuggest endpoints | Yes | `quotation.search` | Suggestions must stay tenant-scoped | Partial | Manual test required for IDOR leakage |
| Export | CSV/XLSX export routes | Yes | Export-specific permission recommended | Must remain tenant-scoped | Pending | High-value leakage route |
| Reports | dashboard/reporting endpoints | Yes | Role-appropriate view permission | Must remain correctly scoped | Pending | Analytics leakage review required |

## Immediate Review Order

1. Quotation object routes
2. Seller configuration routes with `sellerId` in the path
3. Search and export routes
4. User management routes
5. Platform seller/plan/subscription routes

## Related Documents

- [QUOTSY_SECURITY_PLAN.md](/C:/Users/Rahul/billbuddy/QUOTSY_SECURITY_PLAN.md)
- [VAPT_READINESS_CHECKLIST.md](/C:/Users/Rahul/billbuddy/VAPT_READINESS_CHECKLIST.md)
- [QUOTSY_RBAC_MATRIX.md](/C:/Users/Rahul/billbuddy/QUOTSY_RBAC_MATRIX.md)
