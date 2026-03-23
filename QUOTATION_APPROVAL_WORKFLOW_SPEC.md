# Quotation Approval Workflow Specification

## Overview

This document defines the quotation approval workflow required for Quotsy.

The goal is to support:

- user-wise approval authority
- amount-based quotation approval
- price-exception approval for below-limit rate cases
- version-aware approval history
- seller-controlled approver and requester relationships
- download blocking until approval is complete

This workflow should cover both normal quotation approval and special pricing exceptions through one common approval engine.

## Objectives

1. Allow seller admins to define which users are requesters, approvers, or both
2. Route quotations for approval when total quotation value exceeds user authority
3. Route quotations for approval when any item violates allowed minimum rate rules
4. Prevent final download and send until approval is granted
5. Preserve quotation version history and approval history together
6. Ensure old approvals cannot be used after quotation changes
7. Provide a clean UI for requesters and approvers
8. Keep the first release simple enough to implement and support

## Design Principles

1. Approval must be explicit, not hidden in the system
2. Approval relationship must be seller-defined
3. Approval must be tied to a quotation version
4. Only the latest active approval request can be approved
5. Old approval requests must remain visible for audit but not actionable
6. Approval logic must be backend-enforced
7. Download permission must depend on approval state
8. Rejection must not destroy quotation history
9. The same quotation can be revised and resubmitted
10. Seller admins control the approval network

## Approval Roles

Each seller-side user should have one approval mode:

- `requester`
- `approver`
- `both`

### Requester
- can create quotations
- can submit quotations for approval
- must have an approver assigned
- cannot create approver users from approval flow

### Approver
- can review pending quotations
- can approve or reject quotations within authority
- can have multiple requester users assigned
- can create requester users from approval mapping flow if allowed by seller admin permissions

### Both
- can create quotations and submit for approval
- can approve quotations for assigned requester users
- must also have an approver assigned above them if their own quotation needs escalation
- can create requester users from approval mapping flow if allowed

## Relationship Model

Quotsy should use explicit approval mappings instead of relying only on hidden manager hierarchy.

The seller admin defines the requester and approver relationship in the Users module.

### Recommended Relationship Rules

1. A requester must have one active approver in v1
2. An approver can have multiple requesters
3. A both-type user must also have one active approver above them
4. Seller admin can create requester, approver, and both users
5. Requester cannot create approver users
6. Approver and both users can create requester users only from approval assignment flow
7. If no approver exists, requester creation should be blocked with a clear message

## Data Model

## 1. Users Table Changes

Add the following fields in `users`:

- `approval_mode` text
- `approval_limit_amount` numeric
- `can_approve_quotations` boolean
- `can_approve_price_exception` boolean
- `approval_priority` integer
- `is_active` boolean already exists or should be respected

### Field Meaning

- `approval_mode`
  - `requester`
  - `approver`
  - `both`

- `approval_limit_amount`
  - maximum quotation amount user can approve without escalation
  - for requester users this defines self-authority if allowed later
  - for approver users this defines their approval ceiling

- `can_approve_quotations`
  - whether user can approve amount-based quotations

- `can_approve_price_exception`
  - whether user can approve below-minimum-rate cases

- `approval_priority`
  - optional helper for future routing when more than one approver exists
  - lower number can mean closer or preferred approver

## 2. User Approval Mapping Table

Create table:

- `user_approval_mappings`

Suggested fields:

- `id`
- `seller_id`
- `requester_user_id`
- `approver_user_id`
- `is_active`
- `created_by_user_id`
- `created_at`
- `updated_at`

### v1 Rule

In v1, enforce:

- one active approver per requester

The table should still be designed flexibly enough for future one-to-many routing.

## 3. Quotation Approval Requests Table

Create table:

- `quotation_approval_requests`

Suggested fields:

- `id`
- `seller_id`
- `quotation_id`
- `quotation_version_no`
- `requested_by_user_id`
- `assigned_approver_user_id`
- `status`
- `approval_type_summary`
- `request_note`
- `decision_note`
- `requested_amount`
- `approved_at`
- `approved_by_user_id`
- `rejected_at`
- `rejected_by_user_id`
- `superseded_at`
- `superseded_by_request_id`
- `created_at`
- `updated_at`

### Status Values

- `pending`
- `approved`
- `rejected`
- `superseded`
- `cancelled` later if needed

## 4. Quotation Approval Reasons Table

Create table:

- `quotation_approval_reasons`

Suggested fields:

- `id`
- `approval_request_id`
- `reason_type`
- `item_index`
- `product_id`
- `requested_value`
- `allowed_value`
- `base_value`
- `meta_json`
- `created_at`

### Supported v1 Reason Types

- `amount_limit_exceeded`
- `price_exception_below_min_rate`

## 5. Quotation Table Extensions

Add approval fields to `quotations`:

- `approval_status`
- `active_approval_request_id`
- `approval_required`
- `approved_for_download_at`

### Recommended Approval Status Values

- `not_required`
- `pending`
- `approved`
- `rejected`

Quotation business status and approval status should remain separate.

## Approval Triggers

Approval should be required if any of the following is true:

### 1. Amount Limit Exceeded

If:

- quotation total > requester's approval limit

Then:

- approval is required

### 2. Price Exception Below Minimum Rate

If:

- product has rate-edit control enabled
- entered rate is below allowed minimum

Then:

- approval is required

### Combined Case

If both amount and item exception are true:

- create one approval request
- store multiple approval reasons under the same request

## Approval Routing Logic

## v1 Routing Rule

For a requester quotation:

1. get requester's active approver mapping
2. check whether assigned approver is active
3. check whether approver can approve the case
4. if approver can approve, assign to that approver
5. if approver cannot approve because of amount or exception restrictions, escalate upward
6. if no valid higher approver exists, fallback to seller admin
7. if no active approver and no seller admin fallback exists, block submission with clear message

## Escalation Logic

The escalation chain for v1 should be:

1. assigned approver
2. approver's assigned approver if approver mode is `both`
3. seller admin fallback

## Parked Item

Approver leave management is out of scope for v1.

For now:

- if approver is inactive, fallback to seller admin
- leave calendar or delegation should be handled later

## User Creation and Edit Flow

## Create User Screen

When seller admin creates a user, show:

- `Approval Role`
  - `Requester`
  - `Approver`
  - `Both`

### If Approval Role = Requester

Show:

- `Select Approver`

Behavior:

- approver list should include users with mode `approver` or `both`
- if no approver exists, show:
  - `No approver exists yet. Create an approver first.`
- requester cannot create approver from this flow

### If Approval Role = Approver

Show:

- `Assign Requesters`

Behavior:

- multi-select existing requester users
- optional quick action:
  - `Create Requester`
- quick create must only allow requester user creation

### If Approval Role = Both

Show:

- `Select Approver`
- `Assign Requesters`
- optional quick action:
  - `Create Requester`

Behavior:

- both-type user must have an approver selected
- both-type user can have requesters assigned below them
- quick create must only allow requester creation

## Edit User Screen

Seller admin should be able to:

- change approval mode
- change approval limit amount
- change quotation approval capability
- change price exception approval capability
- reassign approver
- reassign requesters
- deactivate user

If user is approver for active requesters, UI should warn before removing or deactivating the user.

## Quotation Workflow

## Case A: No Approval Needed

If:

- quotation is within allowed amount
- no item violates minimum rate

Then:

- quotation approval status = `not_required`
- quotation is immediately ready for download

## Case B: Amount Approval Needed

If:

- quotation exceeds requester's amount authority

Then:

- quotation is saved
- quotation approval status = `pending`
- approval request is created
- final PDF download is blocked
- preview may still be allowed

## Case C: Price Exception Approval Needed

If:

- item rate is below allowed minimum

Then:

- user should see minimum allowed rate
- user should be able to raise approval request
- quotation can proceed into approval workflow
- final download is blocked until approval

## Case D: Combined Approval Needed

If both triggers apply:

- create one approval request
- store both reasons
- block download until approval

## Approval Decision Flow

## Approve

If approver approves:

- approval request status = `approved`
- quotation approval status = `approved`
- quotation becomes ready for final download and send
- audit log is created

## Reject

If approver rejects:

- approval request status = `rejected`
- quotation approval status = `rejected`
- quotation remains blocked from final download
- requester can edit and resubmit the same quotation
- new version and new approval request should be created on resubmission

## Supersede

If quotation is edited while approval is pending:

- old approval request becomes `superseded`
- new approval request is created for the latest quotation version
- old request remains visible for audit only

## Critical Rule for Superseded Approvals

If approver opens an old request:

- show clear banner:
  - `This is not the latest version of the quotation. Please review the latest PDF before approving.`
- normal approve action must be disabled
- show actions:
  - `Open Latest Version`
  - `Open Latest PDF`

Only the latest active request can be approved.

## Download Rules

### Allowed

- preview before final approval can be allowed
- internal review PDF can be allowed if business agrees

### Blocked

Final quotation download and send must be blocked when:

- approval status = `pending`
- approval status = `rejected`
- approval request has been superseded and latest one is not approved

## UI Modules

## 1. Users Module

Add approval fields and relationship management.

## 2. Create and Edit User Modal

Add:

- approval role selector
- approver selector
- requester assignment selector
- approval limit
- can approve quotation toggle
- can approve price exception toggle

## 3. Quotation Wizard

Add:

- message when approval is required
- raise approval request option for price exception
- approval status notice after submission

## 4. Quotation Details

Add:

- approval status chip
- approval reason summary
- approval history
- block download when not approved
- show latest request state

## 5. Approvals Module

New seller-side module:

- `Approvals`

Suggested tabs:

- `Pending`
- `Approved`
- `Rejected`
- `Superseded` optional

Suggested columns:

- quotation number
- customer
- amount
- requested by
- assigned approver
- approval reasons
- status
- requested on
- action buttons

## 6. Notification Surface

v1 should support at least in-app notification to approver for:

- new approval request
- revised quotation requiring fresh approval

Later:

- WhatsApp
- email

## Scenario Matrix

## Scenario 1

Sub-user limit = `50,000`
Quotation total = `42,000`

Result:

- no approval
- quotation ready for download

## Scenario 2

Sub-user limit = `50,000`
Quotation total = `78,000`

Result:

- amount approval required
- request routed to assigned approver
- download blocked

## Scenario 3

Quotation total within limit
One item below allowed minimum rate

Result:

- price exception approval required
- request routed to assigned approver
- download blocked

## Scenario 4

Both amount and price exception are triggered

Result:

- single approval request
- multiple reasons
- download blocked

## Scenario 5

Approval pending
Requester edits quotation

Result:

- old request becomes `superseded`
- new request created
- approver must see that old request is not latest

## Scenario 6

Approver rejects quotation

Result:

- quotation blocked from download
- requester edits same quotation
- new version maintained
- approval history remains visible
- resubmission creates new approval request

## Scenario 7

Requester has no valid approver assigned

Result:

- submission blocked or routed to seller admin fallback
- UI should show:
  - `No approver configured for this user.`

## Scenario 8

Assigned approver is inactive

Result:

- route to seller admin fallback

## Scenario 9

Approver is also a requester
Approver creates quotation above own authority

Result:

- route to that user's assigned approver above them

## Scenario 10

Seller admin has unlimited or highest authority

Result:

- no approval needed for their own quotations unless business chooses otherwise

## Exception Cases

## 1. No Approver Exists

- requester creation must be blocked
- seller admin must create approver first

## 2. Approver Removed While Requesters Are Mapped

- system should warn seller admin
- requester mappings must be reassigned
- existing pending requests should fallback to seller admin or remain blocked for reassignment

## 3. Approver Opens Outdated Request

- approval action disabled
- latest quotation link shown

## 4. Quotation Already Approved, Then Edited

- approval should be invalidated
- quotation returns to pending approval if approval trigger still exists

## 5. Requester Raises Repeated Below-Rate Exceptions

- allowed
- each revised quotation version gets its own approval record

## 6. Approver Can Approve Amount But Not Price Exception

- system should escalate to higher approver with required capability

## 7. Approver Can Approve Price Exception But Amount Exceeds Their Limit

- system should escalate upward

## 8. Multiple Requesters Under One Approver

- fully supported in v1

## 9. Multiple Approvers For One Requester

- not supported in v1 as active approval path
- keep schema flexible for future support

## 10. Leave Management

- parked for now
- not part of v1

## Approval Engine Requirements

Create one backend evaluation service that returns:

- `requiresApproval`
- `approvalReasons`
- `assignedApproverId`
- `approvalStatus`
- `downloadBlocked`

This service should be called during:

1. quotation create
2. quotation revise
3. final download validation
4. approval decision validation

## RBAC Additions

Add new permission keys:

- `approval.request`
- `approval.view_own`
- `approval.view_team`
- `approval.decide`
- `approval.override`

### Suggested Role Mapping

#### Requester-capable roles

- `approval.request`
- quotation create and revise permissions

#### Approver-capable roles

- `approval.view_team`
- `approval.decide`

#### Seller Admin

- `approval.override`

## Audit Requirements

Audit logs should be created for:

- approval request created
- approval request approved
- approval request rejected
- approval request superseded
- approver reassigned
- user approval mapping changed
- user approval mode changed

## Recommended v1 Scope

Build in this order:

### Phase 1

- user approval role fields
- approver-requester mapping
- amount-based approval
- approvals module
- block final download until approved

### Phase 2

- price exception approval
- item-level approval reasons
- superseded request UX

### Phase 3

- notifications
- richer escalation rules
- approval override controls
- leave and delegation later

## Recommended Build Order

1. database schema
2. user create and edit flow
3. approval mapping management
4. approval engine service
5. quotation create and revise integration
6. download blocking
7. approvals module UI
8. notifications and audit polish

