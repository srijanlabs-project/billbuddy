# Item Display and Quotation Edit Specification

## Overview

This document defines three related enhancements for Quotsy:

1. Category-based item display builder
2. Full item add and remove support while editing quotations
3. Reference Request ID capture and universal quotation PDF naming

These changes should work together with the existing quotation, approval, versioning, and configuration systems.

## Scope

This specification covers:

- how item text should be composed for quotation items
- how category-specific item display rules should work
- how quotation edit should support item add/remove
- how internal reference data should be captured without appearing on PDF
- how PDF filenames should be standardized everywhere

## Objectives

1. Allow seller admins to define how item text is shown in quotations
2. Support different item text logic for different product categories
3. Keep one seller/system default item display rule as fallback
4. Ensure generated item text is used consistently across the platform
5. Ensure old quotations remain unchanged even if rules are updated later
6. Allow quotations under edit/revision to add or remove items freely
7. Capture internal `Reference Request ID` without printing it in PDF
8. Standardize quotation PDF file naming everywhere

## Feature 1: Category-Based Item Display Builder

## Business Need

Different categories need different item wording.

Examples:

### Acrylic / Signage
Catalogue or form fields may include:
- color = Gold
- material = Acrylic
- base_type = Plastic Sheet

Expected item text:
- `Gold Acrylic with Plastic Sheet`

### Laptop / Electronics
Catalogue or form fields may include:
- product_type = Laptop
- processor = i7
- brand = Dell
- ram = 8GB

Expected item text:
- `i7 Dell Laptop`

A single fixed item title rule is not enough.

## Final Design

Quotsy should support:

1. one default item display rule
2. category-specific override rules

### Rule Priority

Apply rules in this order:

1. category-specific rule
2. seller/system default rule

If neither produces text, fallback to base system item name logic.

## Category Source

Categories must be pulled from seller catalogue.

### v1 Rule

- only categories already present in catalogue can be configured
- no manual free-text category entry in v1

## Rule Matching

### v1 Rule

- exact category matching only
- no parent-child category inheritance in v1

## Pattern Inputs

Item display patterns may use:

1. system fields
2. custom catalogue fields
3. quotation/form fields

### Examples of Token Sources

- `{material_name}`
- `{category}`
- `{color}`
- `{brand}`
- `{processor}`
- `{base_type}`
- `{service_type}`

## Pattern Style

### v1 Supports Free-Form Template Text

Seller admin can write patterns like:

- `{color} {material} with {base_type}`
- `{processor} {brand} {product_type}`
- `{material} - {service_type}`
- `{brand} {product_type} for {segment}`

This means free-form connector words are allowed in v1.

## Blank Token Handling

This is a critical rule.

### Final Rule

If a token is blank:

1. hide the token
2. hide the immediately previous static connector text
3. collapse extra spaces or separators after cleanup

### Example

Pattern:
- `{color} {material} with {base_type}`

If `base_type` is blank:
- output should become `Gold Acrylic`
- not `Gold Acrylic with`

Pattern:
- `{material} - {service_type}`

If `service_type` is blank:
- output should become `Acrylic`
- not `Acrylic -`

## Preview Behavior

Preview is required.

### Final Rule

The builder should show preview using:
- any available product from that category
- together with available category and form field values

If no meaningful sample data exists:
- show placeholder sample values or an empty-state warning

## Manual Override

### Final Rule

- no manual override in v1
- item display text is system-generated only

## Generated Item Text Usage

Generated item text must be used everywhere.

### Final Rule

Use the same generated item text in:
- quotation form review
- quotation preview
- orders list and detail
- approval views
- PDF
- email attachment content
- exports
- quotation version snapshots

## Historical Stability

### Final Rule

Old quotations must remain unchanged.

That means:
- item display text must be generated and stored at quotation item level
- later rule changes must not rewrite old quotation items

## Category Rename Behavior

### Final Rule

If category name changes in catalogue:
- old category rule becomes orphaned
- seller admin must reassign or recreate the rule

No automatic remapping in v1.

## Ownership and Permissions

### Final Rule

Only seller admin can manage item display rules.

## Recommended Data Model

### Configuration Storage

Store:

- seller/system default item display rule
- category-specific display rules

Suggested structure:

- `seller_default_item_display_pattern`
- `seller_category_item_display_rules`

Example JSON:

```json
{
  "defaultItemDisplayPattern": "{material_name}",
  "categoryItemDisplayRules": [
    {
      "category": "Acrylic",
      "pattern": "{color} {material} with {base_type}"
    },
    {
      "category": "Laptop",
      "pattern": "{processor} {brand} {product_type}"
    }
  ]
}
```

### Quotation Item Storage

Add a stored field to quotation item layer:

- `item_display_text`

This should be captured in:
- live quotation item row
- quotation version snapshot

## Feature 2: Quotation Edit Must Allow Add and Remove Item

## Business Need

When a quotation is revised, user must be able to:

- add new items
- remove existing items
- modify existing items

Current limitation should be removed.

## Final Rule

During quotation edit or revision:

1. item list remains fully editable
2. user can add items
3. user can remove items
4. user can update item quantities, rates, dimensions, and text fields

## Approval Impact

If quotation is under approval and item list changes:

- old approval request becomes `superseded`
- approval is recalculated for the revised quotation
- new approval request is created if approval is still required

## Versioning Impact

When item list changes:

- new quotation version is created
- snapshot stores latest item list including added/removed items

## Feature 3: Reference Request ID

## Business Need

The business needs an internal field to capture request linkage/reference without showing it in customer-facing PDF.

## Final Rule

Add field:

- `Reference Request ID`

### Placement

- final quotation step
- alongside discount, advance, and summary-level commercial fields

### Behavior

- field is stored in quotation record
- field is available in internal detail views if needed
- field is not printed in PDF
- field is not shown in customer-facing document output

### Suggested DB Field

- `reference_request_id VARCHAR(150)`

## Feature 4: Universal PDF Filename Rule

## Final Rule

Quotation PDF filename should be standardized everywhere.

### Required Format

- `QuotationNumber_VVersionNumber.pdf`

### Examples

- `QTN-0042_V1.pdf`
- `QTN-0042_V3.pdf`
- `REQ-108_V2.pdf`

## Apply Everywhere

This filename rule must be used for:
- preview download
- order download
- direct download route
- email attachment name
- any future quotation PDF export

## Feature Interaction Rules

## Item Display Builder + Edit Flow

If quotation is edited:
- item display text should be regenerated for affected items using current applicable rule
- generated text should then be stored in the new quotation version

## Reference Request ID + Approval

Reference Request ID is internal only.

### Final Rule

- may appear in internal quotation detail
- may appear in approval view if useful
- must not appear in customer PDF

## PDF Name + Versioning

Filename must use current quotation number and current version number at the time of download/export.

## UI Requirements

## Configuration Studio

Add section:
- `Item Display Rules`

### Block 1: Default Rule

Fields:
- default item display pattern
- preview

### Block 2: Category Rules

Fields:
- category selector sourced from catalogue categories
- pattern input
- preview
- edit and delete actions

### Validation

- only existing catalogue categories selectable
- warn if tokens reference removed fields
- warn if output preview is blank

## Quotation Final Step

Add field:
- `Reference Request ID`

Rules:
- optional unless business later makes it required
- stored in quotation record
- not printed in PDF

## Quotation Edit Screen

Item section must support:
- add item
- remove item
- update item

## Orders / Detail / Approval Screens

Use stored generated item display text consistently.

## API / Backend Requirements

## Item Display Service

Create helper/service that:

1. detects item category
2. finds category rule if present
3. falls back to default rule
4. generates cleaned item text
5. removes empty-token connector text and extra spaces

Suggested output:

- `itemDisplayText`
- `appliedRuleType`
- `appliedCategory`

## Quotation Save / Revise Flow

On quotation create and revise:

- generate `item_display_text`
- store it per quotation item
- store in version snapshot

## PDF Generation

Always use:
- stored item display text
- universal filename rule

## Email Sending

Attachment filename should follow:
- `QuotationNumber_VVersionNumber.pdf`

## Scenario Matrix

## Scenario 1

Category has specific rule.

Result:
- use category rule

## Scenario 2

Category has no rule.

Result:
- use seller/system default rule

## Scenario 3

Token is blank and connector text exists immediately before it.

Result:
- token hidden
- immediate connector hidden
- final text cleaned

## Scenario 4

Quotation edited and one item removed.

Result:
- revised quotation version stores updated item list
- removed item no longer appears in new version

## Scenario 5

Quotation edited and new item added.

Result:
- item list expands
- generated display text calculated for new item
- new version created

## Scenario 6

Quotation under approval is revised by adding or removing items.

Result:
- old approval superseded
- new approval calculated

## Scenario 7

Reference Request ID entered.

Result:
- stored internally
- hidden from PDF

## Scenario 8

Quotation downloaded from preview and from order list.

Result:
- both use same filename format

## Scenario 9

Category renamed in catalogue.

Result:
- old rule becomes orphaned
- seller admin must reassign

## Scenario 10

Rule changed after quotation already exists.

Result:
- old quotation remains unchanged
- new quotations use updated rule

## Recommended Build Order

### Phase 1

- add `reference_request_id`
- standardize universal PDF filename
- enable add/remove items during quotation edit

### Phase 2

- add default item display rule
- add category rule builder
- add generated item display text storage

### Phase 3

- add preview polish and orphaned-rule warnings
- extend rule validation UX

## v1 Delivery Summary

The first release should include:

1. seller/system default item display rule
2. category-level override rule
3. categories pulled from catalogue only
4. system + custom + form fields as supported pattern tokens
5. free-form pattern text in v1
6. blank token cleanup including immediate previous connector removal
7. no manual override
8. stored generated item text on quotation items
9. add/remove support during quotation edit
10. Reference Request ID internal capture
11. universal quotation PDF naming everywhere

This gives Quotsy a flexible but still manageable item-display system while also fixing important quotation editing and document consistency gaps.
