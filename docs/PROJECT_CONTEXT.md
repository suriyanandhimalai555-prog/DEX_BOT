# PROJECT_CONTEXT

**Maintenance:** When you add env vars, models, routes, DEXes, encryption behavior, or workers, update this file and `docs/FLOW.md` together so onboarding docs match the codebase.

## Section 1: What This Project Is

This project is a BSC-focused DEX bot operator platform where a human operator signs in, imports wallets (server-side encrypted private keys, one encryption key per user in MongoDB), groups wallets, creates strategy bots, and runs them on schedules while monitoring live transaction status in a web dashboard. Swaps can execute on **PancakeSwap** (V2 or V3) or **Uniswap V2** on BSC; router addresses are centralized in `backend/src/config/dex.ts`. It is designed for an operator/trader who wants controlled market-making style automation (smooth buy/sell/volume cycle) with risk controls, execution telemetry, analytics, and optional Telegram alerts, instead of manually placing repetitive swaps.

## Section 2: Tech Stack (actual versions from package.json)

BACKEND  
Runtime: Node.js `>=20` (`backend/package.json` engines)  
Language: TypeScript `^5.6.3`  
Framework: Express `^4.21.1`  
Database: MongoDB via Mongoose `^8.8.0`  
Queue: BullMQ `^5.21.0` + Redis via ioredis `^5.4.1`  
Blockchain: ethers `^6.13.4`  
Auth: jsonwebtoken `^9.0.2` + speakeasy `^2.0.0` + bcryptjs `^2.4.3`  
Realtime: socket.io `^4.8.1`  
Validation: zod `^3.23.8`  
HTTP clients/helpers: axios `^1.7.7`, cookie-parser `^1.4.6`, cookie `^1.1.1`, cors `^2.8.5`, express-rate-limit `^7.4.1`, qrcode `^1.5.4`  
Logging: winston `^3.17.0`

FRONTEND  
Framework: React `^18.3.1` + TypeScript `~5.6.3`  
Build: Vite `^5.4.10`  
State: Zustand `^5.0.1`  
Server State: TanStack Query `@tanstack/react-query ^5.59.0`  
Wallet: wagmi `^3.6.11` + viem `^2.48.11` + @wagmi/connectors `^8.0.11` + @metamask/connect-evm `^1.2.0`  
UI: Tailwind CSS `^3.4.14` + custom local UI primitives in `frontend/src/components/ui/*`  
Charts: Recharts `^2.13.3`  
Routing: react-router-dom `^6.28.0`  
Other UI/form libs: react-hook-form `^7.53.2`, @hookform/resolvers `^3.9.1`, lucide-react `^0.454.0`, react-hot-toast `^2.4.1`

## Section 3: Environment Variables

`/.env.example` has no variables (instructions only). Variables are defined in `backend/.env.example` and `frontend/.env.example`.

| Variable | Purpose | Used In | Required |
|---|---|---|---|
| `PORT` | API listen port | `backend/src/index.ts` | Yes |
| `NODE_ENV` | Cookie `secure` behavior and log level mode | `backend/src/controllers/auth.controller.ts`, `backend/src/utils/logger.ts` | Yes (defaulted in schema) |
| `FRONTEND_ORIGIN` | CORS origin for HTTP and Socket.IO | `backend/src/index.ts` | Yes (defaulted in schema) |
| `BSC_CHAIN_ID` | Chain ID for provider/tx building | `backend/src/config/chain.ts`, `backend/src/services/pancake.adapter.ts` | Yes (defaulted in schema) |
| `MONGODB_URI` | MongoDB connection URI | `backend/src/config/db.ts` | Yes |
| `MONGODB_DNS_SERVERS` | Optional DNS override for SRV lookup issues | `backend/src/config/db.ts` | Optional |
| `REDIS_URL` | Redis connection for queue/workers | `backend/src/config/redis.ts`, `backend/src/services/scheduler.service.ts`, `backend/src/workers/execution.worker.ts` | Yes |
| `JWT_ACCESS_SECRET` | Access JWT signing/verifying | `backend/src/controllers/auth.controller.ts`, `backend/src/middleware/auth.middleware.ts`, `backend/src/index.ts` (socket auth) | Yes |
| `JWT_REFRESH_SECRET` | Refresh JWT signing/verifying | `backend/src/controllers/auth.controller.ts` | Yes |
| `ENCRYPTION_MASTER_KEY` | Legacy global key for decrypting old wallets during auto-migration only | `backend/src/workers/execution.worker.ts`, `backend/src/scripts/re-encrypt-wallet.ts` | Optional (64 hex chars); not used for new imports |
| `ALCHEMY_BSC_MAINNET_URL` | Mainnet RPC endpoint | `backend/src/config/chain.ts`, `backend/src/controllers/holdings.controller.ts` | Yes |
| `ALCHEMY_BSC_TESTNET_URL` | Testnet RPC URL (validated only) | `backend/src/config/env.ts` (validation) | Yes (currently not used in runtime services) |
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API auth for alerts | `backend/src/services/telegram.service.ts` | Yes |
| `PANCAKE_V2_ROUTER` | PancakeSwap V2 router on BSC | `backend/src/config/dex.ts` → `pancake.adapter.ts` | Yes |
| `PANCAKE_V3_ROUTER` | PancakeSwap V3 router on BSC | `backend/src/config/dex.ts` → `pancake.adapter.ts` | Yes |
| `PANCAKE_V3_QUOTER` | PancakeSwap V3 quoter on BSC | `backend/src/config/dex.ts`, `price.controller.ts` (V3 quotes) | Yes |
| `UNISWAP_V2_ROUTER` | Uniswap V2 router on BSC | `backend/src/config/dex.ts` → `pancake.adapter.ts`, `price.controller.ts` | Optional (defaults to `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24` in registry) |
| `WBNB_ADDRESS` | Wrapped BNB token address for native path checks | `backend/src/services/pancake.adapter.ts`, `backend/src/services/executor.service.ts` | Yes |
| `VITE_DEV_BACKEND_URL` | Frontend dev proxy/WS backend target | `frontend/vite.config.ts`, `frontend/src/hooks/useSocket.ts` | Optional (defaults to `http://localhost:4000`) |
| `VITE_ALCHEMY_BSC_URL` | Frontend wagmi transport RPC URL | `frontend/src/lib/wagmi.config.ts` | Optional (fallback to public BSC RPC) |
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect connector activation | `frontend/src/lib/wagmi.config.ts` | Optional (if unset, WalletConnect connector is not added) |
| `VITE_API_BASE_URL` | Override frontend API base URL | `frontend/src/api/client.ts` | Optional (defaults to `/api`) |
| `VITE_SOCKET_URL` | Override frontend socket base URL | `frontend/src/hooks/useSocket.ts` | Optional |
| `DEFAULT_TRADE_LIMIT_USD` | Default per-user max trade notional (USD) | `backend/src/config/env.ts`, `User` defaults, `seedAdmin` | Yes (default `1`) |
| `MAX_TRADE_LIMIT_USD` | Cap for limit-increase requests / admin override | limit request + admin controllers | Yes (default `10000`) |
| `ADMIN_EMAIL` | Seed first admin when DB has zero users | `backend/src/utils/seedAdmin.ts` | Optional (default `admin@dexbot.local`) |
| `ADMIN_PASSWORD` | Seed admin password | `seedAdmin.ts` | Optional (must meet register rules) |
| `BNB_PRICE_POLL_INTERVAL_MS` | CoinGecko poll interval | `bnbPrice.service.ts` | Optional (default `60000`) |
| `BNB_PRICE_FALLBACK_USD` | BNB/USD when API unavailable | `bnbPrice.service.ts`, limit sync | Optional (default `600`) |

## Section 4: Repository Structure

```text
DEX_BOT_1/
├─ .env.example
├─ README.md
├─ backend/
│  ├─ .env.example
│  ├─ package.json
│  └─ src/
│     ├─ index.ts
│     ├─ config/
│     │  ├─ dex.ts          # DEX registry (routers/quoters per dex id)
│     │  ├─ env.ts, chain.ts, db.ts, redis.ts, ...
│     ├─ controllers/
│     ├─ middleware/
│     ├─ models/
│     ├─ routes/
│     ├─ scripts/
│     ├─ services/
│     ├─ socket/
│     ├─ types/
│     ├─ utils/
│     └─ workers/
├─ frontend/
│  ├─ .env.example
│  ├─ package.json
│  ├─ vite.config.ts
│  └─ src/
│     ├─ main.tsx
│     ├─ App.tsx
│     ├─ api/
│     ├─ components/
│     ├─ hooks/
│     ├─ lib/
│     ├─ pages/
│     └─ store/
└─ docs/
   ├─ PROJECT_CONTEXT.md
   └─ FLOW.md
```

- `backend/src/config`: environment validation, **DEX registry** (`dex.ts`), and external infra clients (DB, Redis, chain provider).
- `backend/src/models`: Mongoose schemas for users, wallets, groups, bots, runs, transactions.
- `backend/src/routes`: Express route declarations + request validation wiring.
- `backend/src/controllers`: HTTP handlers (auth, wallets, bots, analytics, holdings).
- `backend/src/services`: execution logic, DEX adapter, scheduler, signer, strategy, Telegram integration.
- `backend/src/workers`: BullMQ execution worker and confirmation polling worker.
- `backend/src/socket`: server-side event emitters and Socket.IO attachment helpers.
- `backend/src/middleware`: auth, 2FA gate, body validation.
- `backend/src/utils`: crypto (`encryptPrivateKey` / `decryptPrivateKey` with explicit key arg), `userKey.ts` (per-user encryption key), logging, typed errors, async wrapper.
- `frontend/src/pages`: route-level screens.
- `frontend/src/components`: reusable UI and feature components (bots, wallets, layouts, transactions).
- `frontend/src/hooks`: socket and wallet lifecycle hooks.
- `frontend/src/store`: Zustand stores (auth and wallet connection/holdings state).
- `frontend/src/api`: axios client and API DTO types.
- `frontend/src/lib`: wagmi config, utilities, holdings loading helper.
- `frontend/src/config`: `quoteTokens.ts`, `dexOptions.ts` (DEX labels/options for UI).

## Section 5: MongoDB Models (actual schema)

### `User` (`backend/src/models/User.ts`) — collection `users`

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | `String` | Yes | unique, lowercased |
| `passwordHash` | `String` | Yes | `select: false` |
| `totpSecret` | `String` | No | `select: false` |
| `isTotpEnabled` | `Boolean` | No | default `false` |
| `telegramChatId` | `String` | No | alert destination |
| `encryptionKey` | `String` | No | Per-user AES master key (64 hex chars); `select: false`; auto-created on first wallet import |
| `displayName` | `String` | Yes (new users) | shown in admin/trader UI |
| `role` | `String` enum | No | `admin|trader|observer`, default `trader`; first registrant or empty DB seed → `admin` |
| `isActive` | `Boolean` | No | default `true`; deactivated users get 401 |
| `tradeLimitUSD` | `Number` | No | default from `DEFAULT_TRADE_LIMIT_USD` (typically `1`) |
| `tradeLimitBNB` | `Number` | No | synced from USD via CoinGecko BNB price |
| `tokenVersion` | `Number` | No | incremented on deactivate to invalidate JWTs |
| `createdAt`, `updatedAt` | `Date` | Auto | timestamps |

Indexes: unique index on `email` (via schema option).  
Virtuals/methods/statics: none.  
Helper: `getOrCreateUserEncryptionKey(userId)` in `backend/src/utils/userKey.ts`.

### `LimitRequest` (`backend/src/models/LimitRequest.ts`) — collection `limitrequests`

Trader requests a higher `tradeLimitUSD`. Fields: `userId`, `requestedUSD`, `currentUSD`, `reason`, `status` (`pending|approved|rejected`), `adminNote`, `reviewedBy`, `reviewedAt`.

### `AuditLog` (`backend/src/models/AuditLog.ts`) — collection `auditlogs`

Admin/security events: `userId?`, `action`, `details`, `ipAddress`, `createdAt`. Served on `GET /api/admin/logs`.

### `Wallet` (`backend/src/models/Wallet.ts`) — collection `wallets`

| Field | Type | Required | Notes |
|---|---|---|---|
| `label` | `String` | Yes | user label |
| `address` | `String` | Yes | indexed |
| `encryptedPrivateKey` | `String` | Yes | `select: false` |
| `walletGroupId` | `ObjectId` | No | ref `WalletGroup` |
| `chain` | `String` enum | No | only `bsc`, default `bsc` |
| `status` | `String` enum | No | `active|quarantined|drained` |
| `nativeBalance` | `String` | No | default `'0'` |
| `dailySpentNotional` | `Number` | No | default `0` |
| `dailyResetAt` | `Date` | No | default now |
| `lastExecutedAt` | `Date` | No | nullable |
| `activeBotCount` | `Number` | No | default `0` |
| `createdBy` | `ObjectId` | Yes | ref `User` |
| `createdAt`, `updatedAt` | `Date` | Auto | timestamps |

Indexes: `{ address: 1 }`, `{ createdBy: 1, address: 1 }`.  
Virtuals/methods/statics: none.

### `WalletGroup` (`backend/src/models/WalletGroup.ts`) — collection `walletgroups`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | `String` | Yes | group name |
| `walletIds` | `ObjectId[]` | No | refs `Wallet` |
| `createdBy` | `ObjectId` | Yes | ref `User` |
| `createdAt`, `updatedAt` | `Date` | Auto | timestamps |

Indexes: none explicit.  
Virtuals/methods/statics: none.

### `Bot` (`backend/src/models/Bot.ts`) — collection `bots`

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | `String` | Yes | bot display name |
| `strategyType` | `String` enum | Yes | `smooth_buy|smooth_sell|volume_cycle` |
| `chain` | `String` enum | No | default `bsc` |
| `dex` | `String` enum | No | `pancakeswap|uniswap`, default `pancakeswap` |
| `dexVersion` | `String` enum | Yes | `v2|v3` (Uniswap currently V2 only) |
| `baseToken` | `String` | Yes | address |
| `quoteToken` | `String` | Yes | address |
| `walletGroupId` | `ObjectId` | Yes | ref `WalletGroup` |
| `buyEnabled` | `Boolean` | No | default `true` |
| `sellEnabled` | `Boolean` | No | default `true` |
| `amountMin` | `String` | Yes | wei string |
| `amountMax` | `String` | Yes | wei string |
| `intervalSeconds` | `Number` | Yes | min `30` |
| `slippageBps` | `Number` | Yes | basis points |
| `gasPolicy.mode` | `String` enum | Yes | `auto|fixed` |
| `gasPolicy.maxGweiOverride` | `Number` | No | fixed mode cap |
| `riskPolicy.maxDailyNotionalUSD` | `Number` | Yes | daily cap |
| `riskPolicy.cooldownOnFailureSeconds` | `Number` | Yes | cooloff |
| `riskPolicy.maxConcurrentWallets` | `Number` | Yes | intents limit |
| `status` | `String` enum | No | `draft|active|paused|stopped|errored`, default `draft` |
| `lastRunAt` | `Date` | No | last loop time |
| `consecutiveFailures` | `Number` | No | default `0` |
| `cooldownUntil` | `Date` | No | worker-set cooldown |
| `dailyNotionalUSD` | `Number` | No | default `0` |
| `dailyNotionalResetAt` | `Date` | No | default now |
| `createdBy` | `ObjectId` | Yes | ref `User` |
| `createdAt`, `updatedAt` | `Date` | Auto | timestamps |

Indexes: none explicit.  
Virtuals/methods/statics: none.

### `BotRun` (`backend/src/models/BotRun.ts`) — collection `botruns`

| Field | Type | Required | Notes |
|---|---|---|---|
| `botId` | `ObjectId` | Yes | indexed, ref `Bot` |
| `triggeredAt` | `Date` | Yes | scheduler trigger time |
| `startedAt` | `Date` | Yes | worker start |
| `endedAt` | `Date` | No | end time |
| `status` | `String` enum | No | `running|completed|failed` |
| `intentCount` | `Number` | No | default `0` |
| `successCount` | `Number` | No | default `0` |
| `failureCount` | `Number` | No | default `0` |
| `errorMessage` | `String` | No | optional |
| `createdAt`, `updatedAt` | `Date` | Auto | timestamps |

Indexes: `{ botId: 1 }`, `{ botId: 1, startedAt: -1 }`.  
Virtuals/methods/statics: none.

### `Transaction` (`backend/src/models/Transaction.ts`) — collection `transactions`

| Field | Type | Required | Notes |
|---|---|---|---|
| `botId` | `ObjectId` | Yes | indexed |
| `botRunId` | `ObjectId` | Yes | ref `BotRun` |
| `walletId` | `ObjectId` | Yes | ref `Wallet` |
| `walletAddress` | `String` | Yes | denormalized |
| `chain` | `String` enum | No | default `bsc` |
| `dex` | `String` enum | No | `pancakeswap|uniswap`, default `pancakeswap` |
| `dexVersion` | `String` enum | Yes | `v2|v3` |
| `side` | `String` enum | Yes | `buy|sell` |
| `inputToken` | `String` | Yes | address |
| `outputToken` | `String` | Yes | address |
| `inputAmount` | `String` | Yes | wei string |
| `outputAmount` | `String` | No | optional |
| `txHash` | `String` | No | indexed |
| `status` | `String` enum | No | `pending|submitted|confirmed|failed` |
| `failureCode` | `String` | No | domain failure code |
| `failureReason` | `String` | No | free text |
| `gasSpentBNB` | `String` | No | set on confirmation |
| `quotedPrice` | `String` | No | set on submission |
| `wasLimitCapped` | `Boolean` | No | true when executor reduced WBNB spend to user limit |
| `limitCapDetails` | `Object` | No | `{ requestedBNB, cappedToBNB, limitUSD, bnbPriceAtTrade }` |
| `executedPrice` | `String` | No | schema field, currently not populated |
| `submittedAt` | `Date` | No | submission timestamp |
| `confirmedAt` | `Date` | No | confirmation timestamp |
| `createdBy` | `ObjectId` | Yes | ref `User` |
| `createdAt`, `updatedAt` | `Date` | Auto | timestamps |

Indexes: `{ botId: 1 }`, `{ txHash: 1 }`, `{ botId: 1, createdAt: -1 }`, `{ createdBy: 1, createdAt: -1 }`.  
Virtuals/methods/statics: none.

## Section 6: API Routes Reference

Routes are mounted in `backend/src/index.ts`.

### Router: `backend/src/routes/auth.routes.ts`

`GET /api/auth/check`  
Auth required: no  
Response: always `200` — `{ authenticated: boolean, user?: { id, email, displayName, role, ... }, role? }`  
What it does: bootstrap session without throwing 401 when logged out.

`POST /api/auth/register`  
Auth required: no  
2FA required: no  
Request body: `{ email, password (min 8, upper + number), displayName }`  
Response: `{ user: { id, email, displayName, role, isTotpEnabled, tradeLimitUSD, tradeLimitBNB, ... } }` + httpOnly `accessToken` / `refreshToken` cookies  
What it does: first user → `admin`, else `trader`; sets trade limits; audit log.

`POST /api/auth/login`  
Auth required: no  
2FA required: conditional (if user has 2FA enabled)  
Request body: `{ email: string, password: string, totpCode?: string }`  
Response: `{ user: { id, email, displayName, role, isTotpEnabled, tradeLimitUSD, tradeLimitBNB, ... } }` + sets cookies  
What it does: verifies credentials; blocks deactivated users; optional TOTP; issues session cookies.

`POST /api/auth/login`  
Auth required: no  
2FA required: conditional (if user has 2FA enabled)  
Request body: `{ email: string, password: string, totpCode?: string }`  
Response: `{ user: { id, email, role, isTotpEnabled } }` + sets cookies  
What it does: verifies credentials and optional TOTP, then issues session cookies.

`POST /api/auth/2fa/setup`  
Auth required: yes  
2FA required: no  
Request body: none  
Response: `{ qrCodeUrl: string, secret: string }`  
What it does: generates TOTP secret/otpauth, stores secret, returns QR image.

`POST /api/auth/2fa/verify`  
Auth required: yes  
2FA required: no  
Request body: `{ token: string(6..8) }`  
Response: `{ enabled: true }`  
What it does: verifies TOTP token against stored secret and enables 2FA.

`POST /api/auth/refresh`  
Auth required: no (uses refresh cookie)  
2FA required: no  
Request body: none  
Response: `{ ok: true }` (or 401 on invalid/missing refresh)  
What it does: verifies refresh token cookie and rotates both auth cookies.

`POST /api/auth/logout`  
Auth required: no  
2FA required: no  
Request body: none  
Response: `204 No Content`  
What it does: clears auth cookies.

`GET /api/auth/me`  
Auth required: yes  
2FA required: no  
Request body: none  
Response: `{ user: { id, email, displayName, role, isActive, isTotpEnabled, tradeLimitUSD, tradeLimitBNB, telegramChatId? } }`  
What it does: returns current authenticated user profile.

### Router: `backend/src/routes/public.routes.ts`

`GET /api/public/bnb-price` — no auth; `{ currentPriceUSD, oneDollarInBNB, lastFetchAt, ... }` for login/register footer and limit UI.

### Router: `backend/src/routes/admin/*` (requires `requireAuth` + `requireAdmin`)

- `GET /api/admin/users`, `GET /api/admin/users/:id` — trader list/detail (no password hashes)
- `POST /api/admin/users/:id/activate|deactivate` — deactivate bumps `tokenVersion`
- `PATCH /api/admin/users/:id/role`, `PATCH /api/admin/users/:id/limit`
- `GET /api/admin/limit-requests`, `GET /api/admin/limit-requests/pending/count`
- `POST /api/admin/limit-requests/:id/approve|reject` (reject needs `adminNote` ≥ 10 chars)
- `GET /api/admin/stats`, `GET /api/admin/bots`, `GET /api/admin/logs`

### Router: `backend/src/routes/trader/limitRequests.routes.ts` (`requireAuth` + `requireTrader` — admin allowed)

- `POST /api/trader/limit-requests` — increase-only, max `MAX_TRADE_LIMIT_USD`, reason ≥ 20, one pending
- `GET /api/trader/limit-requests`, `DELETE /api/trader/limit-requests/:id` (pending only)

### Frontend panels (Vite app)

| Role | Base path | Notes |
|------|-----------|--------|
| Admin | `/admin/*` | Purple accent; dashboard, traders, limit requests, all bots, audit logs |
| Trader | `/trader/*` | Emerald brand; dashboard + `LimitBanner`, bots, wallets, analytics, `/trader/limit` |
| Public | `/login`, `/register` | BNB ticker from `/api/public/bnb-price`; redirect by role after login |

Session: `AuthContext` calls `GET /api/auth/check` on mount; cookies remain `accessToken` / `refreshToken` (not a separate `dexbot_token` header).

`PATCH /api/auth/profile`  
Auth required: yes  
2FA required: no  
Request body: `{ telegramChatId?: string }`  
Response: `{ ok: true }`  
What it does: updates profile fields currently used for Telegram chat ID.

### Router: `backend/src/routes/wallet.routes.ts`

`POST /api/wallets/import`  
Auth required: yes  
2FA required: no  
Request body: `{ privateKey: string, label: string }`  
Response: `{ wallet: { id, label, address, chain, status, nativeBalance, dailySpentNotional, activeBotCount, walletGroupId, lastExecutedAt, createdAt } }`  
What it does: validates private key, derives wallet address, loads/creates per-user `encryptionKey`, encrypts with `encryptPrivateKey(pk, userEncryptionKey)`, creates wallet record.

`GET /api/wallets/groups`  
Auth required: yes  
2FA required: no  
Request body: none  
Response: `{ groups: [{ id, name, walletIds[], createdAt }] }`  
What it does: returns wallet groups owned by the user.

`POST /api/wallets/groups`  
Auth required: yes  
2FA required: no  
Request body: `{ name: string, walletIds: string[] }`  
Response: `{ group: { id, name, walletIds[], createdAt } }`  
What it does: validates wallet ownership and creates a wallet group.

`GET /api/wallets`  
Auth required: yes  
2FA required: no  
Request body: none  
Response: `{ wallets: WalletRow[] }`  
What it does: returns user wallets for wallet table and selection flows.

`DELETE /api/wallets/:id`  
Auth required: yes  
2FA required: no  
Request body: none  
Response: `204 No Content`  
What it does: deletes wallet if it belongs to user and has no active bots; removes it from groups.

### Router: `backend/src/routes/bot.routes.ts`

`POST /api/bots`  
Auth required: yes  
2FA required: no  
Request body: `{ name, strategyType, dex, dexVersion, baseToken, quoteToken, walletGroupId, buyEnabled, sellEnabled, amountMin, amountMax, intervalSeconds, slippageBps, gasPolicy, riskPolicy }` (`dex` required in schema, default `pancakeswap`; `uniswap` + `v3` rejected)  
Response: `{ bot }` includes `dex`, `dexVersion`, `dexLabel`, `routerAddress`  
What it does: creates draft bot; persists selected DEX; resolves router from `backend/src/config/dex.ts`.

`GET /api/bots`  
Auth required: yes  
2FA required: no  
Request body: none  
Response: `{ bots: BotSummaryLike[] }`  
What it does: returns bot list for dashboard/cards.

`GET /api/bots/:id/transactions`  
Auth required: yes  
2FA required: no  
Request query: `page?`, `limit?`  
Response: `{ total, page, limit, transactions: [{ id, walletAddress, side, inputAmount, outputAmount?, status, txHash?, failureCode?, quotedPrice?, executedPrice?, createdAt }] }`  
What it does: paginated transaction history per bot.

`GET /api/bots/:id`  
Auth required: yes  
2FA required: no  
Request body: none  
Response: `{ bot, runs: [{ id, startedAt, endedAt?, status, intentCount, successCount, failureCount }] }`  
What it does: returns bot details and recent runs.

`PATCH /api/bots/:id`  
Auth required: yes  
2FA required: no  
Request body: partial create schema  
Response: `{ bot }`  
What it does: updates bot only when status is `draft` or `paused`.

`POST /api/bots/:id/start`  
Auth required: yes  
2FA required: yes (`requireTotpForAction`)  
Request body: `{ totpCode: string }`  
Response: `{ bot }`  
What it does: sets bot active, schedules first execution job, emits bot status, sends Telegram alert.

`POST /api/bots/:id/pause`  
Auth required: yes  
2FA required: no  
Request body: none  
Response: `{ bot }`  
What it does: pauses active bot and cancels pending jobs.

`POST /api/bots/:id/resume`  
Auth required: yes  
2FA required: no  
Request body: none  
Response: `{ bot }`  
What it does: resumes paused bot and schedules execution.

`POST /api/bots/:id/stop`  
Auth required: yes  
2FA required: yes (`requireTotpForAction`)  
Request body: `{ totpCode: string }`  
Response: `{ bot }`  
What it does: marks bot stopped and cancels queue jobs.

`DELETE /api/bots/:id`  
Auth required: yes  
2FA required: no  
Request body: none  
Response: `204 No Content`  
What it does: deletes non-active bot and related transactions/runs.

### Router: `backend/src/routes/analytics.routes.ts`

`GET /api/analytics/volume`  
Auth required: yes  
2FA required: no  
Request query: `from`, `to`, optional `botId`  
Response: `{ from, to, byStrategy: [{ _id: strategyType, volumeWei, count }] }`  
What it does: aggregates confirmed transaction input volumes by strategy.

`GET /api/analytics/summary`  
Auth required: yes  
2FA required: no  
Request body: none  
Response: `{ activeBots, txToday, successRatePercent, gasSpentBNB }`  
What it does: computes current-day KPI summary.

`GET /api/analytics/transactions`  
Auth required: yes  
2FA required: no  
Request query: `page?`, `limit?`, `status?`, `botId?`  
Response: `{ total, page, limit, transactions: [{ id, botId, walletAddress, side, status, txHash, inputAmount, createdAt }] }`  
What it does: paginated account-wide transaction view.

### Router: `backend/src/routes/price.routes.ts`

`GET /api/price/token`  
Auth required: yes  
2FA required: no  
Request query: `{ baseToken, quoteToken (address or NATIVE), dexVersion, dex?, baseDecimals? }` (`dex` optional, default `pancakeswap`)  
Response: `{ listed, priceInQuote, priceInUsd, quoteName, poolFee?, liquidityWarning, route[], error? }`  
What it does: quotes token price for bot form; V2 uses `resolveV2RouterAddress(dex)` from DEX registry; V3 uses Pancake V3 quoter.

### Router: `backend/src/routes/debug.routes.ts` (development / ops)

`GET /api/debug/queue-status` — BullMQ job counts for `bot-execution`.  
`GET /api/debug/test-decrypt/:walletId` — tests per-user key decryption for owned wallet.  
`POST /api/debug/re-encrypt-wallet` — body `{ walletId, privateKey }`; re-encrypts wallet with current user's per-user key.

CLI: `npx tsx src/scripts/re-encrypt-wallet.ts` (dry-run) / `--fix` (auto-migrate legacy wallets per user).

### Router: `backend/src/routes/holdings.routes.ts`

`GET /api/holdings/:walletAddress`  
Auth required: no  
2FA required: no  
Request body: none  
Response: `{ holdings: [{ address, symbol, name, decimals, balance, balanceRaw, logoUrl?, priceUsd?, usdValue? }] }`  
What it does: reads wallet holdings from Alchemy (plus optional CoinGecko USD enrichment).

## Section 7: Background Workers & Queues

### Queue: `bot-execution` (`backend/src/services/scheduler.service.ts`)

- Queue name: `bot-execution`
- Job name: `execute`
- Job payload shape: `{ botId: string, triggeredAt: number }`
- Added by:
  - `scheduleBotExecution(botId, intervalSeconds)` for first/explicit scheduling (`jobId: bot:<id>`)
  - `scheduleNextRun(botId, intervalSeconds)` for loop continuation (`jobId: bot:<id>:<timestamp>`)
- Delay: jittered `intervalSeconds * (0.8 .. 1.2)`
- Cancel path: `cancelBotExecution(botId)` scans delayed/waiting/paused jobs and removes matching bot jobs.

### Worker: execution worker (`backend/src/workers/execution.worker.ts`)

Processes jobs from `bot-execution`:
1. Loads bot by `botId`, requires `status === active`.
2. Enforces cooldown (`cooldownUntil`) and daily notional reset.
3. Auto-pauses bot after `consecutiveFailures >= 5`, emits socket status/error, sends Telegram alert.
4. Loads wallet group + active wallets (`+encryptedPrivateKey`).
5. `getOrCreateUserEncryptionKey(bot.createdBy)`; `autoMigrateWalletEncryption` per wallet (legacy `ENCRYPTION_MASTER_KEY` → per-user key when possible).
6. Resets wallet daily counters.
7. Enforces `riskPolicy.maxDailyNotionalUSD` gate.
8. Generates intents via `generateIntents(bot, wallets)`.
9. Limits intents by `riskPolicy.maxConcurrentWallets`.
10. Creates `BotRun(status=running)`.
11. Executes each intent via `executeIntent(..., encryptionKey)` with `SwapParams.dex = bot.dex`.
12. Updates run success/failure counts + final status.
13. Updates bot failure counters and cooldown.
14. Saves `lastRunAt` and schedules next run.

### Worker: confirmation worker (`backend/src/workers/confirmation.worker.ts`)

- Poll loop: every 5 seconds (`setInterval`).
- Query: transactions with `status='submitted'` and `txHash`.
- For each tx:
  - Fetches receipt.
  - If `receipt.status === 1`: sets `status=confirmed`, `confirmedAt`, `gasSpentBNB`, emits `tx:confirmed`.
  - If `receipt.status === 0`: sets `status=failed`, `failureCode=UNKNOWN_REVERT`, emits `tx:failed`.

## Section 8: Socket.io Events

Socket auth and room join:
- `backend/src/index.ts` validates JWT from `handshake.auth.token`, `Authorization` header, or `accessToken` cookie.
- On connect, socket joins room `user:<userId>`.

Events emitted by server (`backend/src/socket/txStream.ts`):

| Event | Direction | Payload | When emitted | Frontend listeners |
|---|---|---|---|---|
| `tx:submitted` | server → client | `{ transaction }` | after `executeIntent` persists submitted tx | `Dashboard`, `BotDetail` (via `useSocket`) |
| `tx:confirmed` | server → client | `{ transaction }` | confirmation worker marks tx confirmed | `Dashboard`, `BotDetail` |
| `tx:failed` | server → client | `{ transaction, failureCode }` | execute failure or confirmation revert | `Dashboard`, `BotDetail` |
| `bot:status` | server → client | `{ botId, status }` | bot start/pause/resume/stop and failure-auto-pause paths | No current frontend listener found |
| `bot:error` | server → client | `{ botId, message }` | worker-level operational bot errors | No current frontend listener found |

## Section 9: Wallet Connection System

- Connector configuration (`frontend/src/lib/wagmi.config.ts`):
  - `metaMask(...)` (`id: metaMaskSDK`)
  - Trust wallet targeted injected connector (`id: trustWallet`)
  - WalletConnect (`id: walletConnect`) only when `VITE_WALLETCONNECT_PROJECT_ID` exists
  - Phantom EVM targeted injected connector (`id: phantom`)
- Chain enforcement:
  - wagmi is configured for BSC chain set.
  - UI treats non-`56` as wrong network (`ConnectWalletButton`, `WrongNetworkBanner`).
  - `switchToBsc()` uses `useSwitchChain` with `chainId: 56`.
- State storage (`frontend/src/store/walletStore.ts`):
  - Connection fields: `connectedAddress`, `chainId`, `isWrongNetwork`.
  - Holdings fields: `holdings`, `holdingsLoading`, `holdingsError`.
  - Persisted keys: only connection metadata, not holdings list.
- Sync flow:
  - `WalletConnectSync` mounts `useWalletConnectionSync` in `AppLayout`.
  - On connected + BSC: `loadHoldingsToStore(address)` auto-fetches holdings.
  - On disconnect/wrong-chain: in-flight request invalidated; holdings cleared.
- Connect UX:
  - `ConnectWalletModal` shows explicit cards/logos for MetaMask, Trust Wallet, WalletConnect, Phantom.
  - Detection badges are based on browser-injected providers.

## Section 10: Key Security Decisions

- Private key encryption at rest (per user):
  - `backend/src/utils/crypto.ts` + `backend/src/utils/userKey.ts`
  - Each `User` has `encryptionKey` (32 random bytes as 64-char hex), created on first wallet import; never returned by API (`select: false`).
  - `encryptPrivateKey(privateKey, masterKeyHex)` / `decryptPrivateKey(payload, masterKeyHex)` use that hex as PBKDF2 input material.
  - AES-256-GCM (`aes-256-gcm`) with per-record random IV + salt; PBKDF2-SHA256 (`310000` iterations, key length 32).
  - Stored format: `base64(iv):base64(salt):base64(ciphertext):base64(authTag)`.
  - **Legacy:** optional `ENCRYPTION_MASTER_KEY` in `.env` only for auto-migration of wallets encrypted before per-user keys; not required for new imports.
  - Broken wallets (encrypted with unknown/lost key): delete and re-import; script `re-encrypt-wallet.ts` reports OK / fixable / unfixable per user.
- JWT/session storage:
  - Access + refresh tokens set in httpOnly cookies (`accessToken`, `refreshToken`) in `auth.controller.ts`.
  - `secure` cookie flag is enabled in production.
- 2FA:
  - Login requires TOTP only when user has enabled 2FA.
  - Action-level 2FA middleware (`requireTotpForAction`) is currently attached to bot start and bot stop routes.
  - Wallet import no longer requires 2FA.
- Hidden DB fields (`select: false`):
  - `User.passwordHash`
  - `User.totpSecret`
  - `User.encryptionKey`
  - `Wallet.encryptedPrivateKey`
- Rate limits (`backend/src/index.ts`):
  - General: `100 req/min`
  - Auth: `10 req/min` on `/api/auth`
  - Holdings: `40 req/min` on `/api/holdings`
- Scope/ownership checks:
  - Controllers consistently filter by `createdBy` and reject cross-user resource access.
- Socket security:
  - JWT verification before joining per-user room.

## Section 11: DEX Integration (PancakeSwap + Uniswap V2)

**Registry (add new DEXes here):** `backend/src/config/dex.ts`  
**Swap/quote implementation:** `backend/src/services/pancake.adapter.ts` (Uniswap V2–compatible ABI; not Pancake-only despite filename)  
**Execution:** `backend/src/services/executor.service.ts`, `backend/src/services/signer.service.ts`  
**UI options:** `frontend/src/config/dexOptions.ts`

| `dex` (Bot field) | `dexVersion` | Router / quoter source |
|---|---|---|
| `pancakeswap` | `v2` | `PANCAKE_V2_ROUTER` |
| `pancakeswap` | `v3` | `PANCAKE_V3_ROUTER` + `PANCAKE_V3_QUOTER` |
| `uniswap` | `v2` | `UNISWAP_V2_ROUTER` (env or default `0x4752…2AD24`) |

- `SwapParams` includes `dex: DexId` and `dexVersion`; executor sets them from `bot.dex` / `bot.dexVersion`.
- `resolveV2RouterAddress(dex)` / `resolveV3RouterAddress(dex)` / `resolveV3QuoterAddress(dex)` pick on-chain addresses from the registry.
- Native reference token: `WBNB_ADDRESS` for ETH/WBNB swap paths.
- Quote fetching (`getQuote`):
  - V2: `getAmountsOut` on the resolved V2 router
  - V3: `quoteExactInputSingle.staticCall` on Pancake V3 quoter (only when `dex=pancakeswap` and `dexVersion=v3`)
  - Computes `priceImpactBps` by comparing full-size quote vs smaller marginal quote.
- Slippage:
  - `amountOutMinimum = amountOut * (10000 - slippageBps) / 10000`
  - encoded in tx build path.
- Swap tx build:
  - V2:
    - `swapExactETHForTokensSupportingFeeOnTransferTokens`
    - `swapExactTokensForETHSupportingFeeOnTransferTokens`
    - `swapExactTokensForTokensSupportingFeeOnTransferTokens`
  - V3:
    - `exactInputSingle`
  - Includes chain ID from `BSC_CHAIN_ID`.
- Allowance handling:
  - For ERC-20 input paths, checks `allowance(owner, router)` against `resolveRouterAddress(bot.dex, bot.dexVersion)` (same router as the swap tx).
  - Sends `approve(MaxUint256)` when needed.
- Gas handling:
  - Estimates gas from signer, applies 20% buffer (`gasLimit = estimated * 1.2`).
  - Uses EIP-1559 fees when available; fixed mode can override gas price with `maxGweiOverride`.
  - Enforces native balance checks for gas + value.
- Submission/confirmation:
  - On submit, persists `Transaction(status=submitted, txHash, quotedPrice)` and emits `tx:submitted`.
  - Confirmation worker later sets confirmed/failed status and emits corresponding events.

## Changelog

### 2026-05-20 — Per-bot DEX routing fix

**Root cause:** `createBotSchema` in `bot.routes.ts` omitted `dex`, so `validateBody` stripped it and every bot was saved as `pancakeswap`. The executor also used `PANCAKE_V2_ROUTER` / `PANCAKE_V3_ROUTER` for ERC-20 approvals regardless of `bot.dex`.

**Changes:**
- Added `dex` to create/update bot Zod schemas; reject `uniswap` + `v3`.
- Added `resolveRouterAddress()` and `getDexDisplayLabel()` in `backend/src/config/dex.ts`.
- Executor uses `resolveRouterAddress(bot.dex, bot.dexVersion)` for approve + swap; transaction records use `bot.dex`.
- Bot API responses include `dexLabel` and `routerAddress`; Bot detail/card show router address.
- Execution logs `executeIntent_swap` with router address for BscScan verification.

**Action for existing bots:** Recreate or `PATCH` with correct `dex` if swaps still hit PancakeSwap on-chain.

## Section 12: What Is NOT Yet Built

Observed gaps between current schema/events and currently wired behavior:

1. `bot:status` and `bot:error` socket events are emitted, but frontend currently subscribes only to `tx:*` events.
2. `Transaction.executedPrice` and `Transaction.outputAmount` exist in schema but are not populated in current execution/confirmation code paths.
3. `Bot` status enum includes `errored`, but no route/worker path currently sets this status.
4. Bots backend supports `POST /api/bots/:id/resume`, but `BotCard` UI currently exposes Start/Pause/Stop only (no explicit Resume button).
5. `ALCHEMY_BSC_TESTNET_URL` is validated and documented but not used by runtime execution/holding paths.
6. Selecting Uniswap V2 + `dexVersion=v3` in the UI is not offered; backend should reject invalid dex/version pairs if added via API without validation.
7. `backend/.env.example` may still list `ENCRYPTION_MASTER_KEY` as required for older setups; runtime treats it as optional for per-user encryption.

