# VAPT Readiness Checklist

## Purpose

This checklist helps Quotsy prepare for internal security review and an external VAPT engagement. It is organized by risk area and should be used as a living readiness tracker.

## Status Legend

- `Open`
- `In Progress`
- `Ready for Test`
- `Passed`
- `Accepted Risk`

## 1. Authentication and Session Management

### Authentication

- [ ] Brute force protection on login is implemented and tested
- [ ] Account lockout or throttling strategy is defined and safe from abuse
- [ ] Weak password policy is enforced
- [ ] No default or hardcoded credentials remain
- [ ] OTP bypass paths are removed, or OTP is fully disabled until final integration
- [ ] OTP expiry is enforced
- [ ] OTP cannot be reused after successful validation
- [ ] OTP response does not leak secrets or dev shortcuts in production
- [ ] Password reset token expiry is enforced
- [ ] Password reset tokens are single use
- [ ] Password reset tokens are unpredictable
- [ ] Login and forgot-password flows do not allow account enumeration

### Session

- [ ] Session tokens are generated securely
- [ ] JWT signature verification is enforced correctly
- [ ] JWT `exp` is enforced server-side
- [ ] JWT algorithm handling is explicit and safe
- [ ] JWT payload does not expose unnecessary sensitive data
- [ ] Logout invalidates the active session in the chosen model
- [ ] Password change invalidates prior sessions if required by policy
- [ ] Concurrent session policy is defined
- [ ] Cookie or browser storage strategy is documented and justified
- [ ] Session timeout behavior is enforced and tested

## 2. Multi-Tenant Isolation

- [ ] Quotations are accessible only within the authenticated tenant
- [ ] Customers are accessible only within the authenticated tenant
- [ ] Products are accessible only within the authenticated tenant
- [ ] Users are accessible only within the authenticated tenant unless platform scope is valid
- [ ] Search results remain tenant-scoped
- [ ] PDFs and quotation documents remain tenant-scoped
- [ ] Bulk export remains tenant-scoped
- [ ] Reporting and analytics remain tenant-scoped
- [ ] File URLs cannot be used to access another tenant's documents
- [ ] APIs do not trust client-provided tenant or seller IDs
- [ ] Direct object IDs cannot be used for cross-tenant access

## 3. API Security

- [ ] All sensitive endpoints require authentication
- [ ] All sensitive endpoints require backend authorization
- [ ] Platform-only endpoints reject seller users
- [ ] Seller-only endpoints reject unrelated tenants
- [ ] HTTP methods are limited appropriately
- [ ] Mass assignment is prevented on write routes
- [ ] Old or alternate API versions are reviewed for auth parity
- [ ] Rate limiting exists beyond login for sensitive endpoints
- [ ] Public APIs expose only the minimum surface required

## 4. Injection Security

- [ ] Search inputs are reviewed for SQL injection
- [ ] Sort/order/filter parameters are validated
- [ ] Raw SQL usage is reviewed and parameterized
- [ ] Stored values cannot trigger second-order SQL injection
- [ ] PDF/template rendering is reviewed for template injection
- [ ] CSV export escapes formula-injection payloads
- [ ] File-processing paths are reviewed for command injection risk

## 5. Cross-Site Scripting and Output Safety

- [ ] Stored XSS review is complete for customer, product, address, and message fields
- [ ] Reflected XSS review is complete for URL/query inputs
- [ ] DOM XSS review is complete for frontend rendering paths
- [ ] HTML-to-PDF rendering is reviewed for script execution risk
- [ ] SVG and rich upload formats are restricted or sanitized
- [ ] CSP is defined for production deployment

## 6. Broken Access Control

- [ ] Vertical privilege escalation tests are complete
- [ ] Horizontal privilege escalation tests are complete
- [ ] Admin features are not reachable by forced browsing alone
- [ ] Feature flags are not relied on as security controls
- [ ] Direct API calls cannot bypass frontend restrictions
- [ ] Sensitive operations are protected:
  - [ ] customer deletion
  - [ ] quotation edit and revise
  - [ ] pricing changes
  - [ ] seller configuration changes
  - [ ] export and reporting

## 7. Sensitive Data Exposure

- [ ] API responses do not overexpose PII
- [ ] Logs do not contain passwords, tokens, OTPs, or secrets
- [ ] Secrets are not present in frontend bundles
- [ ] Secrets are not committed to Git history
- [ ] Error messages do not expose stack traces or internal queries in production
- [ ] Financial and tax fields are handled with appropriate access control

## 8. File Upload Security

- [ ] Allowed file types are explicitly restricted
- [ ] MIME type is validated, not only file extension
- [ ] File size limits are enforced
- [ ] Filenames are sanitized
- [ ] Path traversal is prevented
- [ ] Uploaded files are not served in a way that enables XSS
- [ ] Direct file URL access is tenant-isolated
- [ ] Malware scanning plan is defined if required

## 9. Business Logic Security

### Quotation Flow

- [ ] Negative amounts are rejected
- [ ] Discount over 100 percent is rejected
- [ ] Advance greater than total amount is rejected
- [ ] Server-side totals cannot be overridden by client input
- [ ] Locked quotations cannot be edited without authorization
- [ ] Unauthorized version rollback is blocked
- [ ] Duplicate quotation submission is handled safely

### General Workflow

- [ ] Status rollback is authorized and controlled
- [ ] Required workflow steps cannot be skipped via direct API access
- [ ] Race conditions on sensitive actions are reviewed
- [ ] Time-of-check/time-of-use issues are reviewed on critical routes

## 10. Infrastructure and Configuration

- [ ] Debug mode is disabled in production
- [ ] Default server pages are not exposed
- [ ] Directory listing is disabled
- [ ] Unnecessary HTTP methods are disabled where possible
- [ ] Security headers are set:
  - [ ] HSTS
  - [ ] X-Content-Type-Options
  - [ ] X-Frame-Options
  - [ ] Content-Security-Policy
  - [ ] Referrer-Policy
  - [ ] Permissions-Policy
- [ ] TLS is configured for modern protocols only
- [ ] Mixed content is not present
- [ ] Database and admin services are not publicly exposed
- [ ] Firewall and IAM rules are reviewed

## 11. Third-Party and Integration Security

- [ ] Webhook endpoints verify authenticity
- [ ] Webhook replay protection is considered
- [ ] External integration secrets are stored securely
- [ ] Dependency scan is current
- [ ] Supply-chain review is part of release readiness
- [ ] Third-party scripts on frontend are minimized and reviewed

## 12. Denial of Service and Abuse

- [ ] Large request body limits are enforced
- [ ] Expensive routes are rate-limited
- [ ] Bulk APIs have abuse controls
- [ ] PDF generation abuse is controlled
- [ ] Search abuse is controlled
- [ ] Lockout strategy cannot be used to trivially deny service to real users

## 13. Logging and Monitoring

- [ ] Failed logins are logged safely
- [ ] Failed authorization attempts are logged safely
- [ ] Sensitive actions are audit logged
- [ ] Logs are access-controlled
- [ ] Suspicious activity alerts are defined
- [ ] Log injection risk is considered for user-controlled text

## 14. Evidence Pack for External VAPT

- [ ] Route security matrix is current
- [ ] RBAC matrix is current
- [ ] Security header evidence is captured
- [ ] Dependency scan report is captured
- [ ] Secret scan report is captured
- [ ] Tenant isolation test notes are captured
- [ ] Sensitive route test notes are captured
- [ ] Accepted risks are documented with owner and rationale

## Suggested Execution Order

1. Authentication and session management
2. Multi-tenant isolation
3. Backend authorization coverage
4. Sensitive data exposure and secrets
5. File upload hardening
6. Business logic validation
7. Logging, monitoring, and evidence

## Related Documents

- [QUOTSY_SECURITY_PLAN.md](/C:/Users/Rahul/billbuddy/QUOTSY_SECURITY_PLAN.md)
- [ROUTE_SECURITY_MATRIX.md](/C:/Users/Rahul/billbuddy/ROUTE_SECURITY_MATRIX.md)
- [QUOTSY_RBAC_MATRIX.md](/C:/Users/Rahul/billbuddy/QUOTSY_RBAC_MATRIX.md)
- [MULTITENANT_GAP_TRACKER.md](/C:/Users/Rahul/billbuddy/MULTITENANT_GAP_TRACKER.md)
