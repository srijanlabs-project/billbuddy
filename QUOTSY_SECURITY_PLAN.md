# Quotsy Security Plan

## Purpose

This document turns Quotsy's security concerns into an execution plan that the product, engineering, and security teams can work through before public launch and before external VAPT.

It is designed for Quotsy's current architecture:

- React frontend
- Node/Express backend
- PostgreSQL shared-schema multi-tenant model
- Seller-side and platform-side roles
- PDF generation, uploads, onboarding, OTP, and RBAC

## Security Goals

1. Prevent unauthorized access to seller, platform, and customer data.
2. Prevent cross-tenant data leakage in shared-schema architecture.
3. Enforce backend authorization consistently, not only frontend visibility.
4. Reduce OWASP Top 10 exposure before external testing.
5. Produce evidence that supports a VAPT engagement and customer due diligence.

## Workstreams

### 1. Authentication, Session, and RBAC

Focus:

- login hardening
- password reset hardening
- OTP final hardening
- session lifecycle
- route-level authorization
- role-permission consistency

Primary risks:

- brute force
- account enumeration
- OTP bypass or OTP reuse
- missing backend permission checks
- stale or overly permissive sessions

Definition of done:

- all login and reset flows are hardened
- OTP is production-safe or fully disabled
- backend authorization exists for every sensitive route
- role permissions are visible, testable, and persisted

### 2. Multi-Tenant Isolation and API Security

Focus:

- seller ownership checks
- BOLA/IDOR testing
- tenant-scoped search, exports, PDFs, analytics, and documents
- admin-to-seller isolation

Primary risks:

- Seller A reading Seller B data
- direct ID access without ownership validation
- cross-tenant export/download leakage
- search suggestions leaking other tenants

Definition of done:

- every seller-scoped object is checked against authenticated tenant ownership
- no route trusts client-provided seller or tenant identifiers
- all exports and PDFs are tenant-isolated

### 3. Application Hardening

Focus:

- headers
- CORS
- TLS deployment posture
- file upload hardening
- dependency/secret scanning
- abuse protection

Primary risks:

- reflected or stored XSS
- unrestricted uploads
- exposed secrets
- excessive body sizes or expensive request abuse

Definition of done:

- security headers are correctly set
- uploads are restricted and validated
- secrets are not committed or leaked to clients
- expensive operations are rate-limited

### 4. Business Logic and Workflow Abuse

Focus:

- quotation lifecycle rules
- pricing and discount abuse
- revision/version misuse
- race conditions
- workflow bypass

Primary risks:

- negative or impossible values
- unauthorized status rollback
- server-side calculation bypass
- duplicate submission

Definition of done:

- business rules are enforced on the backend
- invalid workflow steps are blocked
- critical actions are auditable

### 5. Monitoring, Audit, and Evidence

Focus:

- audit logging
- anomaly detection
- evidence collection
- tester-ready artifacts

Primary risks:

- missing traceability
- no visibility into abuse patterns
- weak customer assurance during due diligence

Definition of done:

- sensitive actions are logged safely
- logs avoid passwords, OTPs, and secrets
- evidence exists for each major control

## Phased Execution Plan

## Phase 0 - Baseline Inventory

Target duration:

- 0.5 to 1 day

Deliverables:

1. [ROUTE_SECURITY_MATRIX.md](/C:/Users/Rahul/billbuddy/ROUTE_SECURITY_MATRIX.md)
2. [VAPT_READINESS_CHECKLIST.md](/C:/Users/Rahul/billbuddy/VAPT_READINESS_CHECKLIST.md)
3. updated notes in [MULTITENANT_GAP_TRACKER.md](/C:/Users/Rahul/billbuddy/MULTITENANT_GAP_TRACKER.md) where helpful

Tasks:

- inventory all auth and write routes
- mark required permission per route
- mark tenant ownership expectation per route
- identify sensitive data returned by each module
- identify upload points and external integrations

Exit criteria:

- every route has a preliminary security owner and status

## Phase 1 - Critical Risk Closure

Target duration:

- 2 to 4 days

Priority themes:

1. Authentication and session hardening
2. Tenant isolation enforcement
3. Remaining RBAC enforcement
4. Safe reset and recovery paths

Tasks:

- remove OTP shortcuts or keep OTP fully disabled until final integration
- verify password reset token flow for expiry, single use, and unpredictability
- complete backend permission coverage on all sensitive operations
- verify seller ownership checks on all object fetch/update/download routes
- review search, PDF download, exports, and notifications for tenant leakage

Exit criteria:

- no known cross-tenant access path
- no known sensitive route without backend authorization
- no known plaintext secret or credential fallback

## Phase 2 - VAPT Readiness Hardening

Target duration:

- 2 to 3 days

Priority themes:

1. OWASP-style hardening
2. abuse controls
3. secure deployment defaults

Tasks:

- tighten security headers, especially CSP
- tighten production CORS to exact origins
- enforce rate limiting on search, PDF generation, bulk export, and uploads
- review file validation, MIME checks, and storage access control
- run secret and dependency scans
- ensure production does not expose debug behavior

Exit criteria:

- common scanner findings are either fixed or explicitly accepted with rationale

## Phase 3 - Business Logic Security

Target duration:

- 2 to 4 days

Priority themes:

1. quotation integrity
2. workflow authorization
3. concurrency and replay protection

Tasks:

- enforce safe numeric ranges on quotations and revisions
- verify server-side calculation integrity
- verify lock/revision rules cannot be bypassed by direct API access
- review send, paid, status, and logistics transitions
- test duplicate submission and race conditions

Exit criteria:

- business abuse scenarios are covered by server-side validation

## Phase 4 - Monitoring and Evidence

Target duration:

- 1 to 2 days

Priority themes:

1. auditability
2. alerting
3. evidence package

Tasks:

- add audit logs for auth failures and sensitive actions
- redact secrets and sensitive PII from logs
- define alert conditions for suspicious activity
- collect screenshots, route proof, scan output, and config evidence

Exit criteria:

- internal security review is evidence-backed
- external VAPT handoff is organized

## Top Priority Security Backlog

These are the most important next actions for Quotsy.

1. Finish OTP hardening or keep OTP fully disabled until real integration is complete.
2. Complete backend permission enforcement for remaining seller and platform routes.
3. Verify tenant ownership checks across all seller-scoped object routes.
4. Harden password reset token lifecycle.
5. Add audit logging for sensitive operations and failed access attempts.
6. Add rate limiting for PDF generation, bulk export, uploads, and search.
7. Harden file upload validation and access control.
8. Tighten production CORS and HTTPS deployment rules.
9. Add CSP and review browser security headers.
10. Run secret scan and dependency scan before each release candidate.

## Suggested Ownership

### Auth and RBAC

- login
- password reset
- OTP
- session lifecycle
- route permission middleware

### Tenant Isolation and API Security

- ownership checks
- search/export/PDF isolation
- platform vs seller boundary

### App Hardening

- headers
- uploads
- dependency scans
- secret scans
- body limits

### Business Logic and Audit

- quotation validation
- pricing restrictions
- workflow state transitions
- audit trails

## Evidence We Should Collect

1. Route-by-route authorization matrix
2. Screenshots of RBAC configuration and read-only seller view
3. Output of lint/security scan/dependency scan
4. Header test results
5. Sample audit logs for:
   - failed login
   - permission denial
   - quotation revise/send/paid
   - config publish
6. Test notes for tenant isolation scenarios

## Execution Notes

- Backend authorization is the source of truth. Frontend gating supports UX but does not count as a security control by itself.
- Multi-tenant isolation is a first-class requirement and should be tested independently from RBAC.
- OTP remains a special case and must either be fully production-safe or fully disabled.
- External VAPT should happen after Phases 1 to 4 are substantially complete, not before.

## Related Documents

- [QUOTSY_RBAC_MATRIX.md](/C:/Users/Rahul/billbuddy/QUOTSY_RBAC_MATRIX.md)
- [MULTITENANT_GAP_TRACKER.md](/C:/Users/Rahul/billbuddy/MULTITENANT_GAP_TRACKER.md)
- [ROUTE_SECURITY_MATRIX.md](/C:/Users/Rahul/billbuddy/ROUTE_SECURITY_MATRIX.md)
- [VAPT_READINESS_CHECKLIST.md](/C:/Users/Rahul/billbuddy/VAPT_READINESS_CHECKLIST.md)
