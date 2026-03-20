# BillBuddy Backend

API server for Sai Laser WhatsApp invoice automation.

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
- `GET/POST /api/products`
- `GET/POST /api/quotations`
- `GET/POST /api/payments`
- `GET /api/ledger`
- `GET /api/dashboard/summary?range=daily|weekly|monthly`
- `POST /api/whatsapp/parse`

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

