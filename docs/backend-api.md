# Craftory Backend API v1

Base URL: `/api/v1` (proxied by nginx from `/api/`)

See `docs/assets-entitlements-blog.md` for the asset upload, instruction video, redeem code, entitlement, and blog endpoints.
See `docs/virtual-plants.md` for the simulated plant (`/me/plants/*`), the AI coach, and the "mua 3 tặng 1 workshop" reward (`/me/rewards`).

## Authentication

Uses httpOnly session cookie (`session_id`). Sessions have a server-enforced idle timeout and absolute timeout. All mutating authenticated requests require `X-CSRF-Token` header.

---

## Auth Endpoints

### `GET /api/v1/auth/me`
Returns current user from session.
```json
{ "user": { "id": "...", "email": "...", "name": "...", "role": "customer" } }
```

### `POST /api/v1/auth/login`
Rate limited: 10/min
```json
// Request
{ "email": "user@example.com", "password": "mypassword" }

// Response 200
{ "user": { "id": "...", "email": "...", "name": "...", "role": "customer" }, "csrfToken": "abc..." }
// Sets a rotated session_id cookie (httpOnly, SameSite=Strict)
```

### `POST /api/v1/auth/register`
Rate limited: 5/min
```json
// Request
{ "name": "Nguyen Van A", "email": "user@example.com", "password": "mypassword" }

// Response 201
{ "user": { ... }, "csrfToken": "abc..." }
```

### `POST /api/v1/auth/logout`
Requires auth + CSRF token.
```json
// Response 200
{ "message": "Đã đăng xuất." }
```

### `GET /api/v1/auth/csrf`
Returns CSRF token for current session. Requires auth.
```json
{ "csrfToken": "64-char-hex-token" }
```

---

## Products (Public)

### `GET /api/v1/products`
Query params: `category` (kit|book), `search`, `badge` (hot|new|sale)
```json
{ "products": [ { "id": 1, "name": "...", "price": 59000, ... } ] }
```

### `GET /api/v1/products/:id`
```json
{ "product": { "id": 1, "name": "...", "description": "...", "includes": [...], ... } }
```

---

## Workshops (Public)

### `GET /api/v1/workshops`
```json
{ "workshops": [ { "id": "...", "title": "...", "dateTime": "...", "capacity": 20, "_count": { "registrations": 5 } } ] }
```

### `POST /api/v1/workshops/register`
```json
// Request (guest)
{ "workshopId": "...", "guestName": "Nguyen Van A", "guestPhone": "0901234567" }

// Request (logged-in user)
{ "workshopId": "..." }

// Response 201
{ "message": "Đăng ký thành công!", "registration": { ... } }
```

---

## Orders (Requires Auth)

### `POST /api/v1/orders`
Requires auth + CSRF.
```json
// Request
{
  "items": [{ "productId": 1, "qty": 2 }],
  "shippingName": "Nguyen Van A",
  "shippingPhone": "0901234567",
  "shippingAddress": "123 ABC Street, Q1, HCM",
  "note": "Giao buổi chiều"
}

// Response 201
{
  "order":   { "id": "...", "total": 118000, "status": "pending", "items": [...] },
  "payment": { "qrUrl": "...", "bankCode": "...", "accountNumber": "...",
               "accountName": "...", "memo": "CRAFTORY-XXXXXXXX", "amount": 118000 }
}
```

### `GET /api/v1/orders`
Returns current user's orders.

### `GET /api/v1/orders/:id`
Returns specific order (owner only). Response shape: `{ order, payment }`.
`payment` is only returned while `order.status === 'pending'` and SePay is configured;
otherwise it is `null`.

---

## Payment Page

Customer-facing payment URL: `/pages/payment.html?orderId=<ORDER_ID>`

- **Trang thanh toán yêu cầu đăng nhập.** Logged-out visitors are blocked from
  loading order/payment data and shown a login CTA.
- The page polls `GET /api/v1/orders/:id` every 4s (max 10 minutes) and updates
  the UI when the SePay webhook flips the order out of `pending`.
- Cart checkout redirects to this page after a successful `POST /api/v1/orders`.

### SePay env vars (backend)

| Variable                | Required | Purpose                                  |
|-------------------------|----------|------------------------------------------|
| `SEPAY_API_KEY`         | prod     | Webhook bearer token (validated on `POST /api/v1/webhooks/sepay`) |
| `SEPAY_ACCOUNT_NUMBER`  | prod     | Receiving bank account number            |
| `SEPAY_BANK_CODE`       | prod     | Bank code accepted by `qr.sepay.vn` (e.g. `MB`, `VCB`, `ICB` for VietinBank — **not** `VTB`) |
| `SEPAY_ACCOUNT_NAME`    | optional | Display-only account holder name         |

When `SEPAY_ACCOUNT_NUMBER` or `SEPAY_BANK_CODE` is missing the order endpoints
return `payment: null` and the payment page shows a "SePay chưa được cấu hình"
state — the order itself is still created.

A **wrong-but-present** `SEPAY_BANK_CODE` fails differently and less obviously:
`buildPaymentInfo()` still returns a `qrUrl`, so the payment page renders
normally, but `qr.sepay.vn` responds with an HTML error body
(`"Ngân hàng này không được hỗ trợ"`) instead of a PNG when the `<img>` tries
to load it — the QR silently doesn't appear, no error surfaces anywhere in
the app. Verify a bank code before deploying:
```bash
curl -s -o /dev/null -w "%{content_type}\n" \
  "https://qr.sepay.vn/img?acc=<account_number>&bank=<bank_code>&amount=10000&des=TEST"
# image/png  -> valid code
# text/html  -> invalid code, response body has the real error message
```

---

## Chat (Public, Rate Limited)

### `POST /api/v1/chat`
Rate limited: 20/min
```json
// Request
{
  "messages": [
    { "role": "user", "content": "Cho tôi xem kit origami" }
  ],
  "systemPrompt": "(optional custom system prompt)"
}

// Response 200
{ "reply": "Craftory có kit Origami Rừng Nhiệt Đới..." }
```

---

## Admin — Users (Admin Only)

### `GET /api/v1/admin/users`
### `PATCH /api/v1/admin/users/:id`
```json
// Request (partial update)
{ "role": "employee" }
// or
{ "status": "disabled" }
```

---

## Admin — Products (Employee+)

### `GET /api/v1/admin/products`
Query: `status` (published|draft|archived)

### `POST /api/v1/admin/products`
### `PUT /api/v1/admin/products/:id`
### `DELETE /api/v1/admin/products/:id`

---

## Admin — Orders (Employee+)

### `GET /api/v1/admin/orders`
Query: `status`, `search`, `page`, `limit`
```json
{ "orders": [...], "total": 50, "page": 1, "limit": 20, "pages": 3 }
```

### `PATCH /api/v1/admin/orders/:id/status`
```json
{ "status": "processing" }
```

---

## Admin — Stats (Admin Only)

### `GET /api/v1/admin/stats`
```json
{
  "totals": { "users": 150, "orders": 89, "products": 10, "revenue7d": 5230000, "revenue30d": 18500000, "newUsers7d": 12 },
  "ordersByStatus": { "pending": 5, "processing": 12, ... },
  "topProducts": [ { "product": {...}, "totalQty": 45, "totalRevenue": 3060000 } ],
  "revenueByDay": [ { "date": "2026-04-23", "revenue": 780000, "orders": 8 } ],
  "recentOrders": [...]
}
```

---

## Health

### `GET /api/v1/health`
```json
{ "status": "ok", "timestamp": "2026-04-30T..." }
```
