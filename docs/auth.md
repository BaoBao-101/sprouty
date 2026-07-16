# Craftory Authentication & Security

## Method: Cookie-based Session + CSRF

### Session Cookie
- **Cookie name**: `session_id`
- **Flags**: `httpOnly`, `SameSite=Strict`, `Secure` (in production), `Path=/`
- **Idle timeout**: 30 minutes by default (`SESSION_IDLE_TIMEOUT_MINUTES`)
- **Absolute timeout**: 12 hours by default (`SESSION_ABSOLUTE_TIMEOUT_HOURS`)
- **Renewal**: active sessions refresh `lastSeenAt` at most every 5 minutes (`SESSION_TOUCH_INTERVAL_MINUTES`)
- **Storage**: PostgreSQL `Session` table (not Redis)
- **httpOnly**: JavaScript cannot read the cookie — prevents XSS token theft
- **Rotation**: login/register deletes any existing session cookie before issuing a new session

### CSRF Protection
- **Primary**: `SameSite=Strict` session cookie prevents cross-site request forgery automatically
- **Defense-in-depth**: Synchronizer token pattern
  - On login/register, server returns `csrfToken` in response body
  - Client stores in memory (never localStorage)
  - All authenticated mutations include `X-CSRF-Token` header
  - Server validates against session's stored `data.csrfToken`

### Password Hashing
- Algorithm: **bcryptjs** (bcrypt implementation in pure JS)
- Cost factor: **12 rounds** (~300ms on modern hardware)
- Passwords are NEVER stored in plaintext, NEVER sent to client

## Authentication Flow

```
1. Client → POST /api/v1/auth/login { email, password }
2. Server verifies password against bcrypt hash
3. Server deletes any existing session from the current browser and creates a new Session record in DB
4. Server sets session_id cookie (httpOnly)
5. Server returns { user, csrfToken } in response body
6. Client stores csrfToken in memory (api.js _csrfToken variable)
7. Subsequent authenticated mutations include X-CSRF-Token header
```

## Session Expiration

Sessions expire on the server when either condition is true:
- `expiresAt` is older than the current time (absolute lifetime)
- `lastSeenAt` is older than the configured idle timeout

Expired, malformed, or disabled-user sessions are deleted or ignored and the browser cookie is cleared. Expired sessions are also cleaned on startup and every hour.

## RBAC (Role-Based Access Control)

Three roles:
- **customer** — browse, cart, checkout, order history
- **employee** — all customer permissions + manage products and orders
- **admin** — all employee permissions + manage users/roles + stats dashboard

Middleware applied per-route:
- `requireAuth` — must be logged in (any role)
- `requireEmployee` — role must be `employee` or `admin`
- `requireAdmin` — role must be `admin`
- `requireCsrf` — validates X-CSRF-Token for mutations

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| POST /auth/login | 10/min per IP |
| POST /auth/register | 5/min per IP |
| POST /chat | 20/min per IP |
| Global | 120/min per IP |

## Security Headers (via helmet)

Configured globally on Fastify. Content-Security-Policy is managed by nginx.

## Data Not Stored in Client

- Passwords (never sent from server)
- Session ID (httpOnly cookie, JS cannot read)
- CSRF token (in-memory variable, cleared on refresh)
- Long-lived tokens in localStorage (never used)

## Demo Accounts

Demo accounts are seeded only when `SEED_DEMO_USERS=true` is set. The admin email, employee email, and initial passwords are configured via environment variables (`ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`, `EMPLOYEE_EMAIL`, `EMPLOYEE_INITIAL_PASSWORD`). Do not commit credentials to the repository.
