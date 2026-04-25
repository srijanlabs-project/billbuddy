# BillBuddy Backend

API server for Quotsy quotation and business workflow automation.

## Setup

1. Create database in PostgreSQL: `billbuddy`
2. Run schema:
   - `psql -U postgres -d billbuddy -f db/schema.sql`
3. Copy env:
   - `copy .env.example .env`
4. Install deps:
   - `npm install`
5. Start API:
   - `npm start`

## Main APIs

- `POST /api/auth/login`
- `GET/POST /api/users`
- `GET /api/roles`, `POST /api/roles/seed`
- `GET/POST /api/customers`
- `POST /api/customers/gst/validate`
- `GET/POST /api/products`
- `GET/POST /api/quotations`
- `GET/POST /api/payments`
- `GET /api/ledger`
- `GET /api/dashboard/summary?range=daily|weekly|monthly`
- `POST /api/whatsapp/parse`

## GST Validation Integration

Set these environment variables in `.env`:

- `GST_VALIDATION_API_URL`
- `GST_VALIDATION_API_KEY`
- `GST_VALIDATION_METHOD` (default: `GET`)
- `GST_VALIDATION_QUERY_PARAM` (default: `gstin`)
- `GST_VALIDATION_TIMEOUT_MS` (default: `12000`)
- `GST_VALIDATION_AUTH_HEADER` (default: `authorization`)
- `GST_VALIDATION_AUTHORIZATION` (optional explicit `authorization` header value, e.g. sandbox JWT)
- `GST_VALIDATION_AUTH_SCHEME` (default: `Bearer`, set `none` to send raw API key)
- `GST_VALIDATION_SEND_API_KEY_HEADER` (default: `true`, set `false` for Bearer-only providers like GSTZen)
- `GST_VALIDATION_AUTH_LOGIN_URL` (optional token login URL for providers with short-lived bearer tokens)
- `GST_VALIDATION_AUTH_USERNAME` (optional username/email for token login)
- `GST_VALIDATION_AUTH_PASSWORD` (optional password for token login)
- `GST_VALIDATION_API_VERSION` (optional, sends `x-api-version` header)

Sandbox.co.in example:

```
GST_VALIDATION_API_URL=https://api.sandbox.co.in/gst/compliance/public/gstin/search
GST_VALIDATION_API_KEY=YOUR_API_KEY
GST_VALIDATION_METHOD=POST
GST_VALIDATION_AUTHORIZATION=eyJ0eXAiOiJKV1QiLCJhbGc...
GST_VALIDATION_API_VERSION=1.0
```

GSTZen JWT GSTIN Validator example:

```
GST_VALIDATION_API_URL=https://my.gstzen.in/api/j/gstin-validator/
GST_VALIDATION_METHOD=POST
GST_VALIDATION_API_KEY=
GST_VALIDATION_AUTH_HEADER=authorization
GST_VALIDATION_AUTHORIZATION=Bearer YOUR_GSTZEN_ACCESS_TOKEN
GST_VALIDATION_SEND_API_KEY_HEADER=false
GST_VALIDATION_QUERY_PARAM=gstin
GST_VALIDATION_TIMEOUT_MS=12000
```

GSTZen automatic token refresh example:

```
GST_VALIDATION_API_URL=https://my.gstzen.in/api/j/gstin-validator/
GST_VALIDATION_METHOD=POST
GST_VALIDATION_API_KEY=60768c46-ee98-40bb-8b42-f8ea1052c676
GST_VALIDATION_AUTH_HEADER=authorization
GST_VALIDATION_AUTH_SCHEME=Bearer
GST_VALIDATION_SEND_API_KEY_HEADER=false
GST_VALIDATION_AUTH_LOGIN_URL=https://my.gstzen.in/accounts/api/login/token/
GST_VALIDATION_AUTH_USERNAME=your-gstzen-login
GST_VALIDATION_AUTH_PASSWORD=your-gstzen-password
GST_VALIDATION_QUERY_PARAM=gstin
GST_VALIDATION_TIMEOUT_MS=12000
GST_VALIDATION_API_VERSION=1.0
```

When `GST_VALIDATION_AUTH_LOGIN_URL`, `GST_VALIDATION_AUTH_USERNAME`, and `GST_VALIDATION_AUTH_PASSWORD` are present, the backend automatically fetches and caches a fresh bearer token and retries once on token expiry.

If customer GST is provided during customer creation, backend validates GST first and uses GST legal profile data for customer name/address.

## WhatsApp Message Example

```
Customer: Raj Steel
Phone: 9876543210
Service: Laser Cutting
Qty: 12
Rate: 150
GST: 18
Transport: 250
Design: 100
Payment Status: pending
```


## Auth
- Bootstrap first admin: POST /api/auth/bootstrap-admin
- Login: POST /api/auth/login
- Validate session: GET /api/auth/me (Bearer token)
- Logout: POST /api/auth/logout

