# User-Based Subscription Specification

## Overview

This document defines the user-based subscription model for Quotsy.

The goal is to move Quotsy from a seller-account subscription model to a commercial model where subscription pricing and access are tied to the number of users (seats) purchased by each seller account.

This specification is designed to work with the existing Quotsy plan, subscription, seller, and user architecture.

## Current State

Today Quotsy supports:

- seller-level plans
- seller-level subscriptions
- plan feature limits such as `max_users`
- seller subscription banners and upgrade suggestions

However, Quotsy does not yet support a true per-user subscription model.

### Current Gaps

1. No seat-based billing model
2. No purchased seat count in subscription records
3. No distinction between active users and billable users
4. No workflow for purchasing or requesting additional users
5. No billing logic for user expansion
6. No audit trail for seat changes
7. No enforcement tied to purchased seat count

## Product Goal

Enable Quotsy to sell subscriptions based on number of users, while keeping the product practical for MSMEs.

The system should support:

- plan subscription for seller account
- included user seats per plan
- optional purchase of additional user seats
- enforcement during user creation and activation
- platform-side visibility into purchased and used seats
- seller-side ability to request more seats

## Recommended Commercial Model

## v1 Recommendation

Use:

- base plan + included users + optional extra seats

### Example

- Starter plan includes 3 users
- Growth plan includes 8 users
- Enterprise plan includes 20 users
- Extra users can be added at a per-user monthly or yearly price

## Why This Model Is Best

1. Easy for MSMEs to understand
2. Easy for sales to explain
3. Easy to enforce in product
4. Easier than pure per-user pricing for mixed feature plans
5. Keeps plan structure and seat structure compatible

## Commercial Terms

Each paid plan should support:

- `included_users`
- `max_users_allowed`
- `extra_user_price_monthly`
- `extra_user_price_yearly`
- optional `minimum_purchased_users`

### Meaning

- `included_users`
  - users included in the base plan price

- `max_users_allowed`
  - hard cap for that plan unless platform admin overrides

- `extra_user_price_monthly`
  - cost per extra user beyond included users for monthly billing

- `extra_user_price_yearly`
  - cost per extra user beyond included users for yearly billing

- `minimum_purchased_users`
  - optional floor if business wants minimum user commitment

## Subscription Model

A seller subscription should now have two dimensions:

1. plan entitlement
2. purchased seat entitlement

That means a seller is not just on `Growth Plan`, but on:

- `Growth Plan`
- `Purchased Users: 11`
- `Included Users: 8`
- `Extra Paid Users: 3`

## Core Concepts

## 1. Included Users

Seats bundled with the plan.

## 2. Purchased Users

Total seats purchased for the subscription.

Formula:

- `purchased_users = included_users + additional_users`

## 3. Active Billable Users

Users who count toward seat usage.

### Recommended v1 Billable Rule

Count users as billable if:

- user belongs to seller
- user is active
- user is not deleted/archived
- user is not platform admin

## 4. Available Seats

Formula:

- `available_seats = purchased_users - active_billable_users`

## 5. Seat Expansion

If seller needs more seats:

- they request or purchase additional users
- platform admin approves and updates subscription
- new seat count becomes active

## Design Principles

1. Seat counting must be backend-enforced
2. Active user creation and reactivation must respect seat limits
3. Seller admins must understand seat usage clearly
4. Platform admins must have full visibility of seat allocation
5. Subscription billing model should not require complex ERP behavior in v1
6. Seats should be auditable
7. Trial and demo plans should also define included user count
8. User suspension/deactivation should immediately free seat usage if configured

## Data Model Changes

## 1. Plan Features Table Extension

Extend `plan_features` with:

- `included_users`
- `max_users_allowed`
- `extra_user_price_monthly`
- `extra_user_price_yearly`
- `seat_expansion_allowed`

### Notes

- `max_users` can either be migrated to `included_users` or retained temporarily for backward compatibility
- recommended approach is to replace business meaning cleanly:
  - `max_users` today is too ambiguous
  - `included_users` and `max_users_allowed` are clearer

## 2. Subscriptions Table Extension

Add fields to `subscriptions`:

- `included_users_snapshot`
- `purchased_user_count`
- `additional_user_count`
- `extra_user_unit_price`
- `seat_billing_cycle`
- `seat_amount`
- `total_subscription_amount`
- `seat_limit_enforced`

### Meaning

- `included_users_snapshot`
  - included users copied from plan at time of subscription activation

- `purchased_user_count`
  - total seats seller can use

- `additional_user_count`
  - purchased extra seats over the included plan seats

- `extra_user_unit_price`
  - price per added user at the time of purchase

- `seat_billing_cycle`
  - monthly or yearly for seat pricing

- `seat_amount`
  - amount attributable to extra users

- `total_subscription_amount`
  - full amount including base plan + additional seats

- `seat_limit_enforced`
  - whether system blocks seat overrun for this subscription

## 3. Sellers Table Cache Extension

Add or maintain cached fields on `sellers`:

- `included_users`
- `purchased_user_count`
- `active_user_count`
- `available_user_count`
- `seat_status`

### Why

This helps fast UI rendering and seller dashboard visibility.

## 4. Seat Change Audit Table

Create table:

- `subscription_seat_events`

Suggested fields:

- `id`
- `seller_id`
- `subscription_id`
- `event_type`
- `previous_purchased_user_count`
- `new_purchased_user_count`
- `delta_user_count`
- `unit_price`
- `seat_amount`
- `performed_by_user_id`
- `approval_status`
- `note`
- `created_at`

### Event Types

- `subscription_created`
- `seat_increase`
- `seat_decrease`
- `seat_override`
- `seat_sync`

## 5. Seat Request Table

Create table:

- `subscription_seat_requests`

Suggested fields:

- `id`
- `seller_id`
- `subscription_id`
- `requested_by_user_id`
- `requested_user_count`
- `current_purchased_user_count`
- `reason_note`
- `status`
- `reviewed_by_user_id`
- `decision_note`
- `approved_at`
- `rejected_at`
- `created_at`
- `updated_at`

### Status Values

- `pending`
- `approved`
- `rejected`
- `cancelled`

## Seat Counting Rules

## Billable Users in v1

Count toward seat usage:

- seller admin
- approver users
- requester users
- both-type approval users
- normal seller-side users

Do not count:

- platform admin users
- deleted/archived users
- inactive users if deactivation disables login and access fully

## Recommended Seat Usage Formula

- `active_user_count = count(users where seller_id = X and is_active = true)`

### Optional Exception Later

If business wants to avoid charging for disabled but retained users, v1 can count only active users.

That is the recommended model.

## Enforcement Rules

## 1. User Creation

If seller admin tries to create a user and:

- active users >= purchased_user_count

Then:

- block creation
- show:
  - `No seats available. Upgrade your plan or request more users.`

## 2. User Activation / Reactivation

If inactive user is reactivated and no seat is available:

- block activation
- show same seat warning

## 3. Demo and Trial Plans

Demo and trial plans should still have:

- included users
- optional hard limit

Example:

- demo includes 3 users only

## 4. Platform Override

Platform admin can override purchased seat count manually.

This should be audited.

## 5. Seat Decrease

If seller purchased seats are reduced below active user count:

Recommended v1 behavior:

- allow change only if active users <= new purchased count
- otherwise block seat reduction

This is simpler and safer than partial forced deactivation.

## Seller-Side UX

## Subscription Summary Card

Show:

- current plan
- included users
- purchased users
- active users
- available seats
- extra users purchased
- seat status

### Example

- Plan: Growth
- Included Users: 8
- Purchased Users: 11
- Active Users: 9
- Available Seats: 2

## User Creation Screen

If seats are nearly full:

- show seat counter in Users page
- show warning when only 1 seat remains

## Seat Request Flow

Seller admin should be able to:

- request more users
- specify desired total users or additional users
- add reason note

Suggested CTA:

- `Request More Users`

## Platform-Side UX

## Sellers Module

Show per seller:

- current plan
- purchased users
- active users
- seat utilization percentage
- seat request pending yes/no

## Subscriptions Module

Show:

- base plan amount
- included users
- additional users
- extra seat unit price
- total amount

## Subscription Detail Modal

Add seat controls:

- purchased user count
- included users snapshot
- extra seats count
- extra seat price
- total amount
- seat enforcement toggle

## Seat Request Review Queue

Platform admin should have a queue for:

- seller seat expansion requests

Actions:

- approve
- reject
- override with different seat count

## Billing Rules

## v1 Simplification

Quotsy v1 should not try to implement complex proration automatically.

Recommended v1 rules:

1. seat count changes are effective immediately
2. billing amount is stored as agreed commercial value
3. platform admin updates subscription record manually or semi-manually
4. audit seat events for commercial traceability

This keeps v1 practical.

## Later Enhancements

Future versions may support:

- automatic prorated seat billing
- billing invoices for seat upgrades
- payment gateway integration
- scheduled renewal recalculation

## Scenario Matrix

## Scenario 1

Starter plan includes 3 users
Seller has 2 active users

Result:

- 1 seat available
- new user creation allowed

## Scenario 2

Starter plan includes 3 users
Seller has 3 active users

Result:

- no seats available
- new user creation blocked
- request more users flow offered

## Scenario 3

Growth plan includes 8 users
Seller purchases 3 extra users
Total purchased users = 11
Active users = 9

Result:

- 2 seats still available

## Scenario 4

Seller deactivates one active user

Result:

- active seat count reduces by 1
- one seat becomes available immediately

## Scenario 5

Platform admin reduces purchased users from 10 to 6
But seller has 8 active users

Result:

- seat reduction blocked in v1
- admin must first reduce active users or keep higher seat count

## Scenario 6

Seller admin requests 5 more users
Platform admin approves only 3

Result:

- purchased user count updated accordingly
- audit event created
- seller notified

## Scenario 7

Trial plan allows 3 users
Seller tries to create 4th user

Result:

- user creation blocked
- upgrade suggestion shown

## Scenario 8

Seller user is inactive and not counted
Seller admin reactivates user while no seats are free

Result:

- reactivation blocked

## Scenario 9

Platform admin gives override seat count for temporary commercial exception

Result:

- override saved
- seat event audited

## Scenario 10

Subscription expires but users still exist

Result:

- user count remains for records
- creation of new users can be blocked if seat limit enforcement remains active
- quotation creation follows existing subscription expiry rules

## API Requirements

## Seller-Side

### Seat Summary API

Return:

- included users
- purchased users
- active users
- available seats
- seat status

### Seat Request API

Allow seller admin to:

- create seat request
- list own seat requests
- cancel pending request

## Platform-Side

### Subscription Update API

Allow platform admin to:

- update purchased users
- update extra seat price
- update total amount
- approve or reject seat request

### Seat Audit API

Allow platform admin to:

- view seat event history

## Recommended Backend Services

Create one seat management service that supports:

- `getSellerSeatSummary(sellerId)`
- `assertSeatAvailable(sellerId)`
- `syncSellerSeatCache(sellerId)`
- `increaseSubscriptionSeats(subscriptionId, count, actorUserId)`
- `decreaseSubscriptionSeats(subscriptionId, count, actorUserId)`
- `createSeatRequest(...)`

## UI Modules Affected

1. Plans
2. Subscriptions
3. Sellers
4. Users
5. Dashboard
6. Notifications

## RBAC Additions

Add permission keys:

- `subscription.seat_request`
- `subscription.seat_view`
- `subscription.seat_manage`
- `subscription.seat_override`

### Seller Admin

- seat view
- seat request

### Platform Admin

- seat manage
- seat override

## Notifications

## Seller Notifications

- seat request submitted
- seat request approved
- seat request rejected
- seats updated by platform admin

## Platform Notifications

- new seller seat request

## Audit Requirements

Audit these events:

- seat request created
- seat request approved
- seat request rejected
- subscription seat count changed
- seat override applied
- user creation blocked due to seats
- user reactivation blocked due to seats

## Recommended Build Order

### Phase 1

- define plan seat model
- extend subscriptions with seat counts
- add seat summary service
- enforce user creation and activation against seats

### Phase 2

- seller seat summary UI
- platform seat management UI
- seat request workflow
- notifications and audit

### Phase 3

- reporting and seat analytics
- override workflow polish
- pricing automation later

## Recommended v1 Scope

Build this first:

1. included users per plan
2. purchased users per subscription
3. active user count
4. user creation/reactivation block when no seats remain
5. seller seat summary
6. platform seat editing
7. seller seat request flow

This delivers the actual business value quickly without overbuilding billing automation too early.

## Key Recommendation

Quotsy should not jump directly into complex usage billing.

The best first step is:

- plan + included users + purchasable additional users
- strict backend seat enforcement
- visible seat summary for seller and platform
- audited seat requests and seat changes

That gives Quotsy a practical MSME-friendly user-based subscription model that sales, support, and engineering can all operate reliably.
