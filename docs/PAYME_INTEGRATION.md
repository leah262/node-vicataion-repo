# PayMe integration (vacation-rentals-agency)

This project integrates PayMe as a **server-side** payment provider. **Never** put PayMe secrets in the React app or in `VITE_*` variables.

## Folder structure (added)

```text
server/src/
  config/payme.js                 # env helpers + safe health status
  controllers/paymentController.js
  middlewares/validatePayMeCreate.js
  routes/payments.js              # extended with PayMe routes + existing listing payments
  services/paymeService.js        # all outbound PayMe HTTP + webhook verification helpers

db/
  payments_payme.sql              # standalone schema snippet
  schema.sql                      # includes `payments` for fresh installs

client/src/
  pages/PaymentPage.jsx
  pages/PaymentSuccess.jsx
  pages/PaymentFailed.jsx
  pages/PaymentPages.css
  services/paymentService.js
```

## Installation

1. **Server dependencies**

PayMe HTTP calls use Node’s built-in **`fetch`** (Node 18+), so no extra HTTP client package is required. Run `npm install` in `server/` only when you add or change other dependencies.

2. **צרו את טבלת `payments` (PayMe)**

מתוך `server/` (עם `server/.env` שמצביע על אותו מסד כמו הפריסה):

```bash
npm run setup-payments
```

סקריפט זה מריץ `CREATE TABLE IF NOT EXISTS payments ...` ומתאים ל־Railway גם כש־`DB_HOST` הוא `*.internal` (משתמש ב־`DATABASE_URL` הציבורי) וגם כשיש `db/ca.pem` מקומי — ל־`*.rlwy.net` נעשה TLS רפוי כדי לא לשבור את החיבור.

חלופה: להדביק את תוכן `db/payments_payme.sql` ב־**Railway → MySQL → Query** (או `npm run migrate` כשיש חיבור תקין למסד).

3. **מיגרציה כללית (אופציונלי)**

לשאר העדכונים האידמפוטנטיים של `migrate.mjs`:

```bash
cd server
npm run migrate
```

4. **Configure environment variables (server)**

Copy `server/.env.example` to `server/.env` and fill values (see below). Restart the API after changes.

5. **Configure PayMe dashboard**

- Set the webhook URL to your public API: `https://YOUR_API_DOMAIN/api/payments/webhook`
- Ensure PayMe allows your server IP if they use IP allowlists.

## Environment variables (server)

Add these to `server/.env` (placeholders are in `server/.env.example`):

| Variable | Purpose |
|----------|---------|
| `PAYME_BASE_URL` | REST API base URL (sandbox vs production). **No trailing slash.** |
| `PAYME_MERCHANT_ID` | Merchant / seller id from PayMe. |
| `PAYME_API_KEY` | Often used for API authentication (scheme depends on PayMe docs). |
| `PAYME_SECRET` | Often used for signing / secondary auth. |
| `PAYME_WEBHOOK_SECRET` | Dedicated secret for verifying webhooks (recommended). If PayMe does not provide a separate webhook secret, you may be able to verify using `PAYME_SECRET` instead — see comments in `server/src/services/paymeService.js`. |

Optional tuning:

- `PAYME_HTTP_TIMEOUT_MS` (default `20000`)
- `PAYME_CREATE_PAYMENT_PATH` (override create endpoint path)
- `PAYME_GET_STATUS_PATH` / `PAYME_VERIFY_PAYMENT_PATH` (override status/verify paths)
- `RATE_LIMIT_PAYME_CREATE_MAX` (default `60` per 15 minutes / IP for `POST /api/payments/create`)

Also required for correct default return URLs:

- `APP_URL` — public site base (example: `https://your-site.com`)

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/payments/create` | JWT | Creates DB row + PayMe session; returns `checkoutUrl`. |
| `GET` | `/api/payments/:id/status?sync=1` | JWT | Reads DB; with `sync=1` tries to refresh from PayMe (best-effort). |
| `POST` | `/api/payments/webhook` | PayMe | **Raw JSON body** route registered in `server/src/index.js` before `express.json()`. |

> Note: `POST /api/payments` remains the existing **listing payment** endpoint for apartment publishing.

## Security notes

- **Webhook signature**: implemented as a **TODO-shaped** HMAC example in `paymeService.handleWebhook()`. Replace header names, digest format, and payload parsing with PayMe’s official specification.
- **Rate limiting**: `paymeCreateLimiter` is an in-memory limiter (OK for single instance). For multiple instances, use Redis / edge rate limits — see comments in `server/src/middlewares/rateLimit.js`.
- **Secrets**: only on the server process environment. The React client uses JWT to call your API only.

## Frontend flow

1. User opens `/pay` (protected).
2. Client calls `POST /api/payments/create` via `client/src/services/paymentService.js`.
3. Server returns `checkoutUrl` → browser navigates to PayMe.
4. User pays (or cancels).
5. PayMe calls `POST /api/payments/webhook` → server updates `payments.status`.
6. User lands on `/pay/success` (or `/pay/failed`) and the UI polls `GET /api/payments/:id/status?sync=1`.

## Health check

`GET /api/health` includes a non-secret `payme` configuration summary (similar to `paypal`).

## TODOs before production

Search the codebase for:

- `TODO: Insert actual PayMe`

and replace endpoint paths, auth headers, response parsing, and webhook verification with PayMe’s official documentation.
