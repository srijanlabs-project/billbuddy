# Quotsy RBAC Matrix

This document defines the recommended Role-Based Access Control model for Quotsy.

It is designed to be:
- tenant-aware
- permission-based
- backend-enforced
- simple enough to implement now
- extensible later

## 1. Scope Model

Quotsy access must be separated by scope before role.

Scopes:
- `platform`
- `seller`

Rules:
- Platform users can operate across tenants only where explicitly allowed.
- Seller users can only operate inside their own `seller_id`.
- A permission grant never overrides tenant isolation.

This means every protected action should be checked using:
- who is the user
- what is their scope
- what is their role
- what permission is required
- which tenant record is being accessed

## 2. Recommended Roles

### Platform Roles

- `platform_admin`
- `platform_ops`
- `platform_sales`
- `platform_support`

### Seller Roles

- `seller_admin`
- `master_user`
- `sub_user`
- `viewer` later if needed

## 3. Permission Design Principles

Permissions should use clear action keys.

Good examples:
- `quotation.create`
- `quotation.search`
- `quotation.download_pdf`
- `customer.create`
- `settings.edit`

Avoid vague permissions like:
- `manageQuotations`
- `fullAccess`

## 4. Permission Key List

### Quotation

- `quotation.create`
- `quotation.view`
- `quotation.search`
- `quotation.download_pdf`
- `quotation.download_sheet`
- `quotation.edit`
- `quotation.revise`
- `quotation.send`
- `quotation.mark_paid`
- `quotation.update_status`
- `quotation.delete` later if needed

### Customer

- `customer.create`
- `customer.view`
- `customer.edit`
- `customer.search`

### Product and Catalogue

- `product.create`
- `product.edit`
- `product.view`
- `product.bulk_upload`
- `product.secondary.create`
- `product.secondary.view`

### Configuration Studio

- `configuration.view`
- `configuration.edit`
- `configuration.save_draft`
- `configuration.publish`

### Seller Business Settings

- `settings.view`
- `settings.edit`
- `branding.edit`

### Users and Access

- `user.view`
- `user.create`
- `user.edit`
- `user.manage_roles`

### Subscription and Billing

- `subscription.view`
- `subscription.manage`
- `billing.view`

### Platform Leads and Sellers

- `lead.view`
- `lead.create`
- `lead.edit`
- `lead.convert_demo`
- `seller.view`
- `seller.create`
- `seller.edit`
- `seller.lock`
- `seller.configure`

### Plans and Notifications

- `plan.view`
- `plan.create`
- `plan.edit`
- `notification.view`
- `notification.create`
- `notification.send`

### Dashboard and Reports

- `dashboard.view`
- `reports.view`

## 5. Role Matrix

Legend:
- `Y` = allowed
- `N` = denied
- `L` = limited / scoped behavior

## 5.1 Platform Role Matrix

| Permission | platform_admin | platform_ops | platform_sales | platform_support |
|---|---|---:|---:|---:|
| `dashboard.view` | Y | Y | Y | Y |
| `lead.view` | Y | Y | Y | Y |
| `lead.create` | Y | Y | Y | N |
| `lead.edit` | Y | Y | Y | L |
| `lead.convert_demo` | Y | Y | Y | N |
| `seller.view` | Y | Y | Y | Y |
| `seller.create` | Y | Y | L | N |
| `seller.edit` | Y | Y | L | N |
| `seller.lock` | Y | Y | N | N |
| `seller.configure` | Y | Y | N | L |
| `subscription.view` | Y | Y | L | L |
| `subscription.manage` | Y | Y | N | N |
| `plan.view` | Y | Y | Y | Y |
| `plan.create` | Y | N | N | N |
| `plan.edit` | Y | N | N | N |
| `notification.view` | Y | Y | Y | Y |
| `notification.create` | Y | Y | N | N |
| `notification.send` | Y | Y | N | N |
| `user.view` | Y | Y | N | N |
| `user.create` | Y | Y | N | N |
| `user.edit` | Y | Y | N | N |
| `reports.view` | Y | Y | L | L |

Notes:
- `platform_sales` should focus on lead-to-demo and seller onboarding visibility, not commercial or admin controls.
- `platform_support` should focus on read-heavy access and support tooling, not provisioning or billing changes.

## 5.2 Seller Role Matrix

| Permission | seller_admin | master_user | sub_user | viewer |
|---|---:|---:|---:|---:|
| `dashboard.view` | Y | Y | Y | Y |
| `quotation.create` | Y | Y | Y | N |
| `quotation.view` | Y | Y | Y | Y |
| `quotation.search` | Y | Y | Y | Y |
| `quotation.download_pdf` | Y | Y | Y | Y |
| `quotation.download_sheet` | Y | Y | N | N |
| `quotation.edit` | Y | Y | N | N |
| `quotation.revise` | Y | Y | N | N |
| `quotation.send` | Y | Y | L | N |
| `quotation.mark_paid` | Y | Y | N | N |
| `quotation.update_status` | Y | Y | N | N |
| `customer.create` | Y | Y | Y | N |
| `customer.view` | Y | Y | Y | Y |
| `customer.edit` | Y | Y | N | N |
| `customer.search` | Y | Y | Y | Y |
| `product.create` | Y | Y | N | N |
| `product.edit` | Y | Y | N | N |
| `product.view` | Y | Y | Y | Y |
| `product.bulk_upload` | Y | Y | N | N |
| `product.secondary.create` | Y | Y | Y | N |
| `product.secondary.view` | Y | Y | Y | Y |
| `configuration.view` | Y | Y | N | N |
| `configuration.edit` | Y | Y | N | N |
| `configuration.save_draft` | Y | Y | N | N |
| `configuration.publish` | Y | N | N | N |
| `settings.view` | Y | Y | N | N |
| `settings.edit` | Y | Y | N | N |
| `branding.edit` | Y | Y | N | N |
| `user.view` | Y | Y | N | N |
| `user.create` | Y | Y | N | N |
| `user.edit` | Y | Y | N | N |
| `user.manage_roles` | Y | N | N | N |
| `subscription.view` | Y | L | N | N |
| `subscription.manage` | Y | N | N | N |
| `billing.view` | Y | L | N | N |
| `reports.view` | Y | Y | N | Y |

Notes:
- `sub_user` is intentionally quotation-focused.
- `viewer` is future-ready and should remain read-only.
- `master_user` can run most daily operations but should not publish configuration or manage subscription lifecycle unless explicitly expanded later.

## 6. Recommended Current Mapping

If Quotsy implements RBAC in code first, this should be the working expectation:

### `platform_admin`
- all platform permissions
- can impersonate support-style investigation only if explicitly allowed later

### `platform_ops`
- leads
- sellers
- subscriptions
- notifications
- no plan editing by default

### `platform_sales`
- lead capture, updates, demo conversion
- can view seller onboarding progress
- cannot manage billing, plans, or seller lock states

### `platform_support`
- read-heavy troubleshooting access
- no destructive tenant or billing actions

### `seller_admin`
- full seller tenant access

### `master_user`
- nearly full seller operational access
- no configuration publish
- no role management
- no subscription management by default

### `sub_user`
- create quotation
- search quotation
- download PDF
- create customer inside flow
- create seller-scoped secondary products
- no settings, no config, no user management

## 7. Tenant Isolation Rules

These rules are mandatory.

For seller-scoped users:
- every query must filter by `seller_id = current_user.seller_id`
- a permission check alone is not enough

Examples:
- a `sub_user` with `quotation.search` can only search quotations belonging to their seller
- a `master_user` with `customer.edit` can only edit customers inside their seller account

For platform-scoped users:
- cross-tenant access is allowed only where the platform permission model allows it

## 8. Recommended Implementation Order

### Phase 1
- define permission keys in backend code
- create role-to-permission map in backend code
- add `hasPermission(user, permissionKey)` helper

### Phase 2
- add backend middleware:
  - `requirePermission("quotation.create")`
  - `requirePermission("configuration.publish")`

### Phase 3
- mirror permissions in frontend for:
  - navigation visibility
  - button visibility
  - focused role dashboards

### Phase 4
- move permissions into database tables if dynamic admin-managed RBAC is needed later

## 9. Recommended Helper Shape

Backend helper should accept:
- user object
- permission key
- tenant context if relevant

Example shape:

```js
hasPermission(user, "quotation.create")
```

Future shape:

```js
hasPermission(user, "quotation.create", { sellerId })
```

## 10. Practical Guidance for Current Features

### Sub-user flow
The new sub-user landing page aligns well with:
- `quotation.create`
- `quotation.search`
- `quotation.download_pdf`
- `customer.create`
- `product.secondary.create`

### Settings and Configuration Studio
These should require:
- `settings.view`
- `settings.edit`
- `configuration.view`
- `configuration.edit`
- `configuration.publish`

### Platform leads and demo conversion
These should require:
- `lead.view`
- `lead.edit`
- `lead.convert_demo`

## 11. Final Recommendation

Quotsy should implement:
- tenant-aware authorization first
- permission checks second
- role names as a mapping layer, not as the final rule

This gives:
- cleaner code
- safer multi-tenant behavior
- easier scaling as roles grow
- simpler frontend gating
