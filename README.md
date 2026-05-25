# DEX Bot Platform (MERN)

Monorepo for BSC DEX bot orchestration: Express + MongoDB + BullMQ + Socket.io backend, Vite + React frontend.

## Prerequisites

- Node.js 20+
- MongoDB and Redis running locally (or cloud URLs)

## Environment files (separate per app)

| App      | Example file              | Your local file   |
|----------|-----------------------------|-------------------|
| Backend  | [`backend/.env.example`](backend/.env.example) | `backend/.env`   |
| Frontend | [`frontend/.env.example`](frontend/.env.example) | `frontend/.env` |

1. **Backend:** copy `backend/.env.example` → `backend/.env` and set real values (JWT secrets 32+ chars, 64-hex `ENCRYPTION_MASTER_KEY`, Alchemy URLs, `TELEGRAM_BOT_TOKEN`, etc.). `FRONTEND_ORIGIN` must match where you open the UI (default `http://localhost:5173`).

2. **Frontend:** copy `frontend/.env.example` → `frontend/.env`. For normal local dev you only need `VITE_DEV_BACKEND_URL` if the API is **not** on `http://localhost:4000`. Leave `VITE_API_BASE_URL` unset so the browser uses `/api` and Vite proxies to the backend.

If you serve the built UI without the Vite proxy, set in `frontend/.env`:

- `VITE_API_BASE_URL=http://localhost:4000/api`
- `VITE_SOCKET_URL=http://localhost:4000`

and ensure `FRONTEND_ORIGIN` on the backend matches the URL where you host the UI.

## Install and run

**Terminal 1 — API**

```bash
cd backend
npm install
copy .env.example .env
# edit .env, then:
npm run dev
```

**Terminal 2 & 3 — workers (needed for scheduled bot runs and tx confirmations)**

```bash
cd backend
npm run worker:execution
```

```bash
cd backend
npm run worker:confirmation
```

**Terminal 4 — UI**

```bash
cd frontend
npm install
copy .env.example .env
# edit .env if needed, then:
npm run dev
```

Open **http://localhost:5173**.

## Roles, panels, and trade limits

On first start with an **empty MongoDB**, the API seeds an admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env` (see `backend/.env.example`). Default: `admin@dexbot.local` / `Admin@123456`.

| Panel | URL | Who |
|-------|-----|-----|
| Login / Register | `/login`, `/register` | Public |
| Admin | `/admin/dashboard`, `/admin/traders`, `/admin/requests`, … | `admin` only |
| Trader | `/trader/dashboard`, `/trader/bots`, `/trader/limit`, … | `trader` (admins may use trader routes too) |

New traders get a **$1 USD** per-trade cap (`DEFAULT_TRADE_LIMIT_USD`), converted to BNB via CoinGecko (`GET /api/public/bnb-price`). The execution worker **caps** WBNB spend to `tradeLimitBNB` in `executor.service.ts`. Traders can request a higher limit at `/trader/limit`; admins approve at `/admin/requests`.

Auth uses httpOnly cookies (`accessToken`, `refreshToken`). Bootstrap: `GET /api/auth/check` (always 200).

## How to test RBAC and limits

1. Start API with empty DB → confirm seeded admin in console logs.
2. Log in as admin → lands on `/admin/dashboard`.
3. Register a trader at `/register` (display name, password 8+ with upper case and a number) → `/trader/dashboard` with limit banner showing **$1**.
4. Trader: `/trader/limit` → submit increase request (reason ≥ 20 chars).
5. Admin: `/admin/requests` → approve → trader limit updates on refresh.
6. Trader creates a bot with `amountMax` above limit → run bot with execution worker → transaction may show `wasLimitCapped` in DB.
7. Admin: `/admin/traders` → deactivate trader → trader gets 401 on next API call.
8. Trader cannot access `GET /api/admin/users` (403).
9. `GET /api/public/bnb-price` works without login.
10. `GET /api/auth/check` returns `{ authenticated: false }` before login (no error).

## How to test the flow (happy path)

1. **Register** at `/register` (or log in at `/login`), submit email + display name + password (8+ chars, upper case + number).

2. **Open Settings** → **Generate QR** for 2FA → scan with an authenticator app → enter the 6-digit code → **Verify & enable**.  
   Wallet import and bot **start/stop** require 2FA once it is enabled.

3. **Optional — Telegram:** in Settings, save your **Telegram chat ID** (same user as in `backend/.env` `TELEGRAM_BOT_TOKEN` bot must be able to message you).

4. **Wallets** → **Import wallet:** label + private key + **TOTP** → submit. Confirm the wallet appears in the table (no private key in the response).

5. **Wallets** → **Create group:** pick that wallet, name the group, create.

6. **Bots** → **New bot:** choose the group, token addresses (valid checksummed BSC addresses), amounts in **wei** as strings, interval ≥ 30s → **Create draft**.

7. **Bots** → **Start** on the card → enter **TOTP** → confirm. Ensure **Terminal 2** (execution worker) is running or the job will not run.

8. **Dashboard:** watch the live transaction strip for `tx:*` events (requires **Terminal 3** for confirmations to flip to `confirmed` after on-chain inclusion).

9. **Stop** a bot from the card → **TOTP** when prompted.

10. **Health check:** with the API running, open **http://localhost:4000/health** — expect `{"ok":true}`.

## Manual quote smoke test (backend + chain)

With a valid `backend/.env`:

```bash
cd backend
npx tsx src/scripts/quote-smoke.ts
```

## Security notes

- Private keys are encrypted at rest; never returned by the API.
- JWT access and refresh tokens are httpOnly cookies.
- Wallet import and bot start/stop require TOTP when 2FA is enabled.
# DEX_BOT1
