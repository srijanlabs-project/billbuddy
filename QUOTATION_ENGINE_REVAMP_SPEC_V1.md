# Quotation Engine Revamp - Product Spec v1

## 1. Objective
Build a smoother onboarding journey and a configuration-driven quotation engine that supports two seller types:

- `BASIC`: fast setup, guided configuration, limited complexity
- `ADVANCED`: full control over schema, rules, and formulas

The system should remove hardcoded quotation rendering/calculation behavior and shift logic into setup configuration.

---

## 2. Seller Type Model

### 2.1 Allowed values
- `BASIC`
- `ADVANCED`

### 2.2 Default
- Every new seller starts as `BASIC`.

### 2.3 Transition rule
- Allowed: `BASIC -> ADVANCED`
- Not allowed: `ADVANCED -> BASIC`

### 2.4 Product decision
- Once a seller becomes `ADVANCED`, they remain `ADVANCED`.
- Basic Studio and Advanced Studio are different experiences.

---

## 3. Onboarding and Unlock Journey

### 3.1 Gating principle
- Keep modules visible in sidebar.
- Locked modules cannot be used until mandatory setup is completed.

### 3.2 Setup sequence
1. Settings (mandatory)
2. Studio setup (mandatory, based on seller type)
3. Product setup prompt (optional, skip allowed)
4. Customer setup prompt (optional, skip allowed)
5. Quotation creation unlocked

### 3.3 Inline creation support
- During quotation creation, user can still create product/customer inline.

---

## 4. Settings Gate (Mandatory)
Before unlocking studio, mandatory settings must be completed:

- Business name
- Quotation prefix
- Seller GST number (as per business requirement policy)
- At least one company contact (`company_phone` or `company_email`)
- Company address

---

## 5. Studio Split

## 5.1 Basic Studio
- Guided setup flow
- Fixed system field behavior
- Limited field and formula controls
- Simple conversion support only

### Basic conversion scope
- Gram <-> KG
- MM <-> CM <-> M

## 5.2 Advanced Studio
- Full configuration studio
- Catalogue schema + quotation schema builder
- Rule-based rendering and calculations
- Formula and conversion engine controls

### Advanced-only capabilities
- Quotation field mapping with catalogue categories:
  - If no category mapping exists, field behaves global (visible)
  - If mapped, show field only for selected item category
- Unit conversion across multiple dimensions:
  - length, area, weight, count, and future dimensions

---

## 6. Configuration Gate (Mandatory)
Quotation creation unlocks only after studio setup is completed:

1. Catalogue fields configured and published
2. Quotation fields configured and published
3. Required system fields valid in final schema

---

## 7. System Fields (Reserved and Fixed)
Reserved keys (cannot be edited or removed):

- `base_rate`
- `quantity`
- `amount`

Rules:
- Key and behavior are fixed
- Only display labels can be renamed

---

## 8. Field Visibility and Mapping Rules

### 8.1 Common rule
- If a field is selected for both Item Name mapping and Helping Text, avoid duplicate standalone output column.

### 8.2 Advanced rule
- Category mapping applies only in `ADVANCED` mode.

---

## 9. Dropdown and Form UI Rules

1. Dropdown fields should work as searchable autosuggestion dropdowns (same pattern as customer selector), not long scroll-only lists.
2. In item form layout:
   - `material_name` remains full width.
   - all other input fields use reduced width and render in 3-column grid.
3. Amount step continues with 2-column layout as current baseline.

---

## 10. Formula and Calculation Rules

### 10.1 Default amount formula
- `amount = base_rate * quantity`

### 10.2 Formula editing
- User may edit formula (mainly for `ADVANCED`).
- Formula input must be validated for allowed tokens/operators.

### 10.3 Advanced seller-specific hardcoded formula override
- In `ADVANCED`, system should support seller-scoped hardcoded formula overrides.
- Override must be bound to a specific seller and must not apply to other advanced sellers.
- This is an exception mechanism for special business cases where standard configurable formula is insufficient.
- Seller-scoped override must take precedence only for that seller and remain isolated by tenant.

### 10.4 Hardcoded removal goal
- No hardcoded category-specific math branches in final engine.
- All calculation behavior must come from configured rules.

---

## 11. GST Rules (Quotation-level condition via customer selection)

### 11.1 Trigger
- While selecting customer, user can mark GST checkbox.

### 11.2 When GST checkbox is selected
- Item form shows GST field.
- Default options: `0%`, `5%`, `18%`.
- User can type custom numeric GST.
- If `%` sign is missing, treat input as percentage.

### 11.3 Item GST calculation
- `item_gst_amount = item_total_amount * item_gst_percent / 100`

### 11.4 Quotation GST amount
- Sum of all item GST amounts.

### 11.5 Discount interaction
- If GST mode is on, common/group discount field is disabled.
- On interaction with disabled discount field, show:
  - `Group discount is not applicable in case of GST quotation.`

### 11.6 When GST checkbox is not selected
- GST row should not be visible in summary.

---

## 12. Summary Rules

- `Sub Total` = sum of total amount of all items
- `GST or Discount` row shows based on condition:
  - GST mode: show GST amount
  - Non-GST mode: show discount amount
- `Total Amount` = `Sub Total + GST - Discount`
- `Advance Amount` = value entered in advance field
- `Balance Amount` = `Total Amount - Advance Amount`

Display rule:
- Fields with no data should not render label/value (for example GST, discount, advance when not applicable/empty).

---

## 13. Helping Text and PDF/Display Rules

- Helping text entries should render next to each other (inline), not stacked line-by-line.
- Empty optional fields should be omitted in summary/PDF output.
- Rendering behavior must be config-driven, not hardcoded.

---

## 14. Catalogue and Quotation Relationship

- Catalogue and quotation remain interlinked as product design intent.
- Quotation unlock depends on setup readiness, not compulsory seed records.
- Product/customer creation remains available inside quotation flow.

---

## 15. Capability Matrix

| Capability | BASIC | ADVANCED |
|---|---|---|
| Settings gate | Yes | Yes |
| Separate studio | Basic Studio | Advanced Studio |
| Reserved system fields | Yes | Yes |
| Category-based field mapping | No | Yes |
| Unit conversion | Simple only (Gram/KG, MM/CM/M) | Multi-dimension conversion |
| Formula editing | Limited | Full |
| GST item-level behavior | Yes | Yes |
| Inline product/customer creation | Yes | Yes |
| Upgrade path | BASIC -> ADVANCED | N/A |
| Downgrade path | Not allowed | Not allowed |

---

## 16. Implementation Phasing (High-level)
1. Add `seller_type` model and onboarding gates.
2. Implement Basic Studio flow and unlock checks.
3. Implement Advanced Studio schema/rules engine.
4. Implement GST behavior and conditional summary engine.
5. Remove remaining hardcoded form/render/calculation branches.

---

## 17. Current Implementation Status (as of now)

### 17.1 Completed
- Seller onboarding gating implemented (settings -> configuration -> seed guidance).
- Left nav allows `Help Center` and `Subscriptions` during onboarding lock.
- Basic vs Advanced guard added for configuration studio category rules:
  - Frontend hides/disables category overrides for `BASIC`.
  - Backend rejects category rule save/publish for `BASIC`.
- Quotation item table mobile actions compacted to icon buttons.
- Quotation wizard footer adjusted to keep primary action visible on mobile.
- Quotation item form updated to 3-column layout (material remains full width).
- Dropdown-like quotation item fields moved to searchable autosuggest input style.

### 17.2 Pending
- GST conditional engine (customer GST trigger, item GST input, summary switch logic).
- Remove Global server error persistence (single app-level error surface across pages), Error should be visible only on relevant form or page not across the site.
- Final cleanup of hardcoded quotation rendering/calculation conditions.
- Role dropdown cleanup in seller user creation (remove duplicate/irrelevant roles).
- Advanced Studio deep capabilities:
  - Category-to-field mapping engine end-to-end.
  - Multi-dimension conversion configuration and runtime conversion resolver.
  - Seller-scoped advanced hardcoded formula override mechanism.
