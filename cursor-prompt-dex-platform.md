# Cursor Prompt — DEX Market-Making Automation Platform (MERN Stack)

---

## ROLE

You are a senior Web3 fullstack engineer. You write production-quality MERN stack code with strong TypeScript typing, clean separation of concerns, and deep knowledge of BSC/EVM chain interactions via ethers.js v6. You never take shortcuts on wallet security, error handling, or async chain operations.

---

## PROJECT OVERVIEW

Build a **DEX bot orchestration platform** for BSC (Binance Smart Chain) that lets an operator:

- Import wallets and manage them in groups
- Create automated trading bots (smooth buy, smooth sell, volume cycle)
- Schedule bots to execute swaps on PancakeSwap V2 and V3 via Alchemy RPC
- Monitor all transactions in a real-time dashboard
- Receive Telegram alerts for failures and lifecycle events

**Stack**: MongoDB + Express.js + React.js + Node.js (MERN), TypeScript throughout, ethers.js v6, BullMQ + Redis for job queues, Socket.io for real-time updates.

---

## TECH STACK — EXACT VERSIONS

```
Backend:
  - Node.js 20 LTS
  - TypeScript 5.x
  - Express.js 4.x
  - Mongoose 8.x (MongoDB ODM)
  - ethers.js 6.x
  - BullMQ 5.x (job queues, backed by Redis)
  - ioredis (Redis client)
  - jsonwebtoken (JWT auth)
  - speakeasy + qrcode (2FA / TOTP)
  - axios (HTTP calls to Alchemy, Telegram)
  - dotenv, zod (env validation + request validation)
  - winston (structured logging)
  - socket.io 4.x (real-time tx stream to frontend)

Frontend:
  - React 18 + TypeScript
  - Vite (build tool)
  - React Router v6
  - Zustand (global state)
  - TanStack Query v5 (server state, polling)
  - Axios (API calls)
  - socket.io-client
  - Recharts (volume/analytics charts)
  - Tailwind CSS 3.x
  - shadcn/ui components (built on Radix UI)
  - react-hook-form + zod (forms)
  - react-hot-toast (notifications)

Infrastructure:
  - MongoDB Atlas (or local MongoDB 7)
  - Redis 7 (local or Upstash)
  - Alchemy RPC (BSC mainnet + testnet)
  - PancakeSwap V2 Router: 0x10ED43C718714eb63d5aA57B78B54704E256024E
  - PancakeSwap V3 Router: 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4
  - WBNB: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
```

---

## REPOSITORY STRUCTURE

Generate this exact monorepo structure:

```
dex-bot-platform/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts              # zod-validated env schema
│   │   │   ├── db.ts               # mongoose connection
│   │   │   └── redis.ts            # ioredis client singleton
│   │   ├── models/
│   │   │   ├── User.ts
│   │   │   ├── Wallet.ts
│   │   │   ├── WalletGroup.ts
│   │   │   ├── Bot.ts
│   │   │   ├── BotRun.ts
│   │   │   └── Transaction.ts
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── wallet.routes.ts
│   │   │   ├── bot.routes.ts
│   │   │   └── analytics.routes.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   ├── wallet.controller.ts
│   │   │   ├── bot.controller.ts
│   │   │   └── analytics.controller.ts
│   │   ├── services/
│   │   │   ├── signer.service.ts       # encrypted key handling ONLY
│   │   │   ├── strategy.service.ts     # pure strategy logic, no chain calls
│   │   │   ├── executor.service.ts     # chain-facing execution
│   │   │   ├── pancake.adapter.ts      # PancakeSwap V2+V3 adapter
│   │   │   ├── scheduler.service.ts    # BullMQ job registration
│   │   │   └── telegram.service.ts     # Telegram Bot API
│   │   ├── workers/
│   │   │   ├── execution.worker.ts     # dequeues and runs ExecutionIntents
│   │   │   └── confirmation.worker.ts  # polls tx receipts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   └── validate.middleware.ts
│   │   ├── utils/
│   │   │   ├── errors.ts              # normalized error classes
│   │   │   ├── logger.ts              # winston logger
│   │   │   └── crypto.ts             # AES-256-GCM encrypt/decrypt for keys
│   │   ├── socket/
│   │   │   └── txStream.ts            # socket.io event emitters
│   │   └── index.ts                   # app entry point
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── api/                        # axios instances + typed API functions
│   │   ├── components/
│   │   │   ├── ui/                     # shadcn/ui base components
│   │   │   ├── layout/                 # Sidebar, Header, PageWrapper
│   │   │   ├── bots/                   # BotCard, BotForm, BotControls
│   │   │   ├── wallets/                # WalletTable, ImportWalletModal
│   │   │   └── transactions/           # TxTable, TxRow, StatusBadge
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Bots.tsx
│   │   │   ├── BotDetail.tsx
│   │   │   ├── Wallets.tsx
│   │   │   ├── Analytics.tsx
│   │   │   └── Settings.tsx
│   │   ├── store/                      # zustand stores
│   │   ├── hooks/                      # useSocket, useBot, useWallet
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── .env.example
└── README.md
```

---

## MONGODB SCHEMAS

### User model (`User.ts`)

```typescript
import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  totpSecret?: string;
  isTotpEnabled: boolean;
  telegramChatId?: string;
  role: 'admin' | 'trader' | 'observer';
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  totpSecret: { type: String },
  isTotpEnabled: { type: Boolean, default: false },
  telegramChatId: { type: String },
  role: { type: String, enum: ['admin', 'trader', 'observer'], default: 'trader' },
}, { timestamps: true });
```

### Wallet model (`Wallet.ts`)

```typescript
export interface IWallet extends Document {
  label: string;
  address: string;               // checksummed EVM address
  encryptedPrivateKey: string;   // AES-256-GCM encrypted, never raw
  walletGroupId?: mongoose.Types.ObjectId;
  chain: 'bsc';                  // only BSC for now
  status: 'active' | 'quarantined' | 'drained';
  nativeBalance: string;         // in ether units, refreshed periodically
  dailySpentNotional: number;    // USD equivalent, reset daily
  lastExecutedAt?: Date;
  activeBotCount: number;
  createdBy: mongoose.Types.ObjectId;
}
```

### Bot model (`Bot.ts`)

```typescript
export type StrategyType = 'smooth_buy' | 'smooth_sell' | 'volume_cycle';
export type DexVersion = 'v2' | 'v3';
export type BotStatus = 'draft' | 'active' | 'paused' | 'stopped' | 'errored';

export interface IBot extends Document {
  name: string;
  strategyType: StrategyType;
  chain: 'bsc';
  dex: 'pancakeswap';
  dexVersion: DexVersion;
  baseToken: string;           // token address to buy/sell
  quoteToken: string;          // usually WBNB or BUSD
  walletGroupId: mongoose.Types.ObjectId;
  buyEnabled: boolean;
  sellEnabled: boolean;
  amountMin: string;           // in quoteToken units (string for bigint safety)
  amountMax: string;
  intervalSeconds: number;
  slippageBps: number;         // e.g. 300 = 3%
  gasPolicy: {
    mode: 'auto' | 'fixed';
    maxGweiOverride?: number;
  };
  riskPolicy: {
    maxDailyNotionalUSD: number;
    cooldownOnFailureSeconds: number;
    maxConcurrentWallets: number;
  };
  status: BotStatus;
  lastRunAt?: Date;
  consecutiveFailures: number;
  createdBy: mongoose.Types.ObjectId;
}
```

### Transaction model (`Transaction.ts`)

```typescript
export type TxStatus = 'pending' | 'submitted' | 'confirmed' | 'failed';
export type FailureCode =
  | 'INSUFFICIENT_BALANCE'
  | 'ROUTE_UNAVAILABLE'
  | 'SLIPPAGE_EXCEEDED'
  | 'ALLOWANCE_REQUIRED'
  | 'NONCE_CONFLICT'
  | 'RPC_UNAVAILABLE'
  | 'TOKEN_RESTRICTED'
  | 'GAS_ESTIMATION_FAILED'
  | 'UNKNOWN_REVERT';

export interface ITransaction extends Document {
  botId: mongoose.Types.ObjectId;
  botRunId: mongoose.Types.ObjectId;
  walletId: mongoose.Types.ObjectId;
  walletAddress: string;
  chain: 'bsc';
  dex: 'pancakeswap';
  dexVersion: 'v2' | 'v3';
  side: 'buy' | 'sell';
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount?: string;
  txHash?: string;
  status: TxStatus;
  failureCode?: FailureCode;
  failureReason?: string;
  gasSpentBNB?: string;
  quotedPrice?: string;
  executedPrice?: string;
  submittedAt?: Date;
  confirmedAt?: Date;
}
```

---

## CORE SERVICES — IMPLEMENTATION REQUIREMENTS

### `crypto.ts` — key encryption utility

```typescript
// Use Node.js built-in crypto module
// Algorithm: AES-256-GCM
// Key derivation: PBKDF2 from ENCRYPTION_MASTER_KEY env var
// Each wallet gets a unique salt + IV stored alongside the ciphertext
// Format: base64(iv):base64(salt):base64(ciphertext):base64(authTag)
// NEVER log decrypted keys. NEVER store raw private keys.

export function encryptPrivateKey(privateKey: string): string { ... }
export function decryptPrivateKey(encrypted: string): string { ... }
```

### `pancake.adapter.ts` — PancakeSwap adapter

Implement a single adapter that handles both V2 and V3:

```typescript
// V2 Router ABI (minimum needed):
//   getAmountsOut(uint amountIn, address[] path) returns (uint[])
//   swapExactTokensForTokensSupportingFeeOnTransferTokens(...)
//   swapExactETHForTokensSupportingFeeOnTransferTokens(...)
//   swapExactTokensForETHSupportingFeeOnTransferTokens(...)

// V3 Router ABI (minimum needed):
//   exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)
//   quoteExactInputSingle via QuoterV2

// Interface:
export interface QuoteResult {
  amountOut: bigint;
  priceImpactBps: number;
  path: string[];
}

export interface SwapParams {
  dexVersion: 'v2' | 'v3';
  side: 'buy' | 'sell';
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  slippageBps: number;
  recipient: string;
  deadlineSeconds?: number;   // default 120
  v3FeeTier?: 100 | 500 | 2500 | 10000;  // V3 only
}

export async function getQuote(params: SwapParams, provider: JsonRpcProvider): Promise<QuoteResult>
export async function buildSwapTx(params: SwapParams, provider: JsonRpcProvider): Promise<TransactionRequest>
```

Rules:
- Always use `Supporting FeeOnTransferTokens` variants on V2 to handle deflationary tokens
- Deadline: `Math.floor(Date.now() / 1000) + deadlineSeconds`
- For V3, use `exactInputSingle` with `sqrtPriceLimitX96: 0n`
- Slippage: `amountOutMinimum = amountOut * (10000n - BigInt(slippageBps)) / 10000n`
- Never hardcode gas limits — use `provider.estimateGas()` then multiply by 1.2

### `strategy.service.ts` — pure strategy logic

```typescript
// NO blockchain calls in here. Pure math and randomization.

export interface ExecutionIntent {
  walletId: string;
  walletAddress: string;
  side: 'buy' | 'sell';
  amountIn: bigint;      // in wei
  slippageBps: number;
  gasPolicy: Bot['gasPolicy'];
  reason: string;
}

// smooth_buy: pick a random amount between amountMin and amountMax
// smooth_sell: same but direction is sell, check wallet has enough token balance
// volume_cycle: alternate buy/sell across wallets in the group

export async function generateIntents(
  bot: IBotDocument,
  wallets: IWalletDocument[]
): Promise<ExecutionIntent[]>
```

### `executor.service.ts` — the chain-facing core

This is the most critical service. Implement each step with explicit error handling:

```typescript
// Step 1: Load wallet, decrypt key, create ethers Wallet instance
// Step 2: Check native BNB balance >= estimated gas cost (abort if not)
// Step 3: Get fresh quote from pancake.adapter
// Step 4: Check price impact < 15% (abort if exceeded, log SLIPPAGE_EXCEEDED)
// Step 5: If ERC-20 input, check allowance; if < amountIn, send approve tx first
// Step 6: Estimate gas with 20% buffer
// Step 7: Get current gas price from provider, apply gasPolicy
// Step 8: Build swap transaction
// Step 9: Sign and send via provider
// Step 10: Persist Transaction doc with status 'submitted' and txHash
// Step 11: Emit socket event 'tx:submitted' with transaction doc
// Step 12: Return txHash (confirmation handled by confirmation.worker)

// On any error: classify into FailureCode, persist failed Transaction, emit 'tx:failed'
```

### `scheduler.service.ts` — BullMQ job registration

```typescript
// On bot creation/resume: register a repeatable job in BullMQ
// Job ID: `bot:${botId}`
// Repeat: every intervalSeconds with ±20% jitter
// On bot pause/stop: remove the repeatable job

// Execution job payload:
interface BotExecutionJob {
  botId: string;
  triggeredAt: number;
}

// The execution.worker picks this up and calls:
// 1. Load bot + validate status is 'active'
// 2. Check consecutive failures < 5 (pause bot if exceeded)
// 3. Check dailyNotional not exceeded
// 4. Call strategy.service.generateIntents()
// 5. For each intent: call executor.service.executeIntent()
// 6. Update bot.lastRunAt and bot.consecutiveFailures
```

---

## API ROUTES

### Auth routes (`/api/auth`)

```
POST /api/auth/register          body: { email, password }
POST /api/auth/login             body: { email, password, totpCode? }
POST /api/auth/2fa/setup         returns: { qrCodeUrl, secret }
POST /api/auth/2fa/verify        body: { token } → enables 2FA
POST /api/auth/refresh           body: { refreshToken }
```

### Wallet routes (`/api/wallets`)

```
POST   /api/wallets/import         body: { privateKey, label }  → encrypts key, derives address
GET    /api/wallets                 returns all wallets (no private key field, ever)
DELETE /api/wallets/:id
POST   /api/wallets/groups         body: { name, walletIds[] }
GET    /api/wallets/groups
```

### Bot routes (`/api/bots`)

```
POST   /api/bots                   create bot (status: 'draft')
GET    /api/bots                   list all bots
GET    /api/bots/:id               single bot with last 20 runs
PATCH  /api/bots/:id               update config (only when paused/draft)
POST   /api/bots/:id/start         → status: active, register scheduler job
POST   /api/bots/:id/pause         → status: paused, remove scheduler job
POST   /api/bots/:id/resume        → status: active, re-register scheduler job
POST   /api/bots/:id/stop          → status: stopped, remove scheduler job
DELETE /api/bots/:id
GET    /api/bots/:id/transactions  paginated tx history for this bot
```

### Analytics routes (`/api/analytics`)

```
GET /api/analytics/volume          query: { from, to, botId? }
GET /api/analytics/summary         today's stats: total bots, success rate, gas spent
GET /api/analytics/transactions    global paginated tx list with filters
```

---

## REAL-TIME SOCKET EVENTS

Use socket.io with JWT auth on the handshake.

**Server emits** (to operator's room):
```typescript
'tx:submitted'  → { transaction: ITransaction }
'tx:confirmed'  → { transaction: ITransaction }
'tx:failed'     → { transaction: ITransaction, failureCode: FailureCode }
'bot:status'    → { botId: string, status: BotStatus }
'bot:error'     → { botId: string, message: string }
```

**Client subscribes** after connecting with JWT token in auth header.

---

## FRONTEND PAGES

### Dashboard page (`/`)
- Stats cards: Active bots, Today's tx count, Success rate %, Total gas spent BNB
- Live transaction feed (socket-driven, newest at top, auto-scroll)
- Status badge colors: confirmed=green, failed=red, submitted=yellow, pending=gray

### Bots page (`/bots`)
- Grid of BotCards showing: name, strategy type, status, last run time, today's tx count
- "New Bot" button → opens BotForm modal
- Each card: Start / Pause / Stop action buttons with confirmation dialogs

### BotForm modal (create/edit)
Fields (use react-hook-form + zod):
```
name (text)
strategyType (select: smooth_buy | smooth_sell | volume_cycle)
dexVersion (select: v2 | v3)
baseToken (text, EVM address, validate checksum)
quoteToken (text, EVM address)
walletGroupId (select from loaded groups)
buyEnabled / sellEnabled (toggle)
amountMin / amountMax (number, in BNB)
intervalSeconds (number, min 30)
slippageBps (number, 50–2000, shown as %)
maxDailyNotionalUSD (number)
```

### BotDetail page (`/bots/:id`)
- Bot config summary
- Real-time execution log table: time, side, wallet address (truncated), input amount, output amount, price, status, tx hash (links to BscScan)
- Recharts line chart: execution price over time

### Wallets page (`/wallets`)
- Table: label, address (truncated + copy button), status, BNB balance, daily spent, active bots, last executed
- "Import Wallet" button → modal with private key input (masked) + label
- "Create Group" modal → select wallets from list + name the group

### Analytics page (`/analytics`)
- Date range picker
- Bar chart: daily volume (BNB) per strategy type
- Line chart: success rate over time
- Summary stats table per bot

---

## SECURITY REQUIREMENTS (NON-NEGOTIABLE)

1. **Private keys**: Import endpoint immediately encrypts with `crypto.ts`, discards the raw value. The `encryptedPrivateKey` field is excluded from ALL GET responses using Mongoose `select: false` on the field.

2. **JWT**: Access token 15min expiry, refresh token 7d, stored in httpOnly cookies (not localStorage).

3. **2FA**: Required for any wallet import or bot start/stop action. Verify TOTP on those specific endpoints even if already logged in.

4. **Input validation**: All request bodies validated with `zod` before reaching controllers. EVM addresses validated with `ethers.isAddress()` and `ethers.getAddress()` (checksum).

5. **Rate limiting**: Apply `express-rate-limit` — 100 req/min general, 10 req/min on auth endpoints.

6. **Env validation**: Use zod in `config/env.ts` to validate all required env vars at startup. Crash fast if missing.

---

## ENVIRONMENT VARIABLES

```bash
# Server
PORT=4000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/dex-bot-platform

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=<32+ char random>
JWT_REFRESH_SECRET=<32+ char random>

# Encryption (for private keys)
ENCRYPTION_MASTER_KEY=<32 byte hex>

# Alchemy (BSC)
ALCHEMY_BSC_MAINNET_URL=https://bnb-mainnet.g.alchemy.com/v2/<key>
ALCHEMY_BSC_TESTNET_URL=https://bnb-testnet.g.alchemy.com/v2/<key>

# Telegram
TELEGRAM_BOT_TOKEN=<from BotFather>

# PancakeSwap
PANCAKE_V2_ROUTER=0x10ED43C718714eb63d5aA57B78B54704E256024E
PANCAKE_V3_ROUTER=0x13f4EA83D0bd40E75C8222255bc855a974568Dd4
PANCAKE_V3_QUOTER=0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997
WBNB_ADDRESS=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
```

---

## ERROR HANDLING PATTERN

Every async route handler must be wrapped:

```typescript
// utils/asyncHandler.ts
export const asyncHandler = (fn: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Global error middleware in index.ts
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, path: req.path, method: req.method });
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.code, message: err.message });
  }
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
});
```

---

## IMPLEMENTATION ORDER

Cursor must build in this exact order to avoid dependency issues:

**Phase A — Foundation**
1. `backend/src/config/` — env.ts, db.ts, redis.ts
2. `backend/src/utils/` — logger.ts, errors.ts, crypto.ts
3. `backend/src/models/` — all 6 Mongoose models
4. `backend/src/middleware/` — auth, validate
5. `backend/src/routes/auth.routes.ts` + controller — login, register, 2FA
6. Verify: `POST /api/auth/register` and `POST /api/auth/login` work

**Phase B — Wallets**
7. `wallet.routes.ts` + controller
8. Import wallet endpoint (encrypt key, derive address with ethers)
9. Wallet group endpoints
10. Verify: import a wallet, list wallets, no private key in response

**Phase C — Chain Layer**
11. `pancake.adapter.ts` — getQuote() for V2 and V3
12. `signer.service.ts` — decrypt key, return ethers.Wallet
13. `executor.service.ts` — full execution flow with all 12 steps
14. Verify: call getQuote() on testnet manually

**Phase D — Strategy + Scheduler**
15. `strategy.service.ts` — smooth_buy, smooth_sell, volume_cycle
16. `scheduler.service.ts` — BullMQ job registration
17. `workers/execution.worker.ts` — dequeue and run
18. `workers/confirmation.worker.ts` — poll receipts
19. Bot CRUD routes + controller

**Phase E — Real-time + Alerts**
20. `socket/txStream.ts` — socket.io setup
21. Emit events from executor and confirmation worker
22. `telegram.service.ts` — send alerts on failure/lifecycle

**Phase F — Analytics**
23. `analytics.routes.ts` + controller
24. MongoDB aggregation pipelines for volume, success rate, gas

**Phase G — Frontend**
25. Vite + React + Tailwind + shadcn/ui setup
26. Axios instance with JWT interceptors + refresh logic
27. Auth pages (login, 2FA setup)
28. Wallets page + ImportWalletModal
29. Bots page + BotForm modal
30. BotDetail page with socket-driven tx feed
31. Analytics page with Recharts
32. Dashboard with live feed

---

## CODE QUALITY RULES

- All functions async/await, no raw `.then()` chains
- All ethers.js values handled as `bigint`, never `number` for on-chain amounts
- Mongoose documents typed with their interface — no `any` types
- Log every execution step with `logger.info({ botId, walletId, step: '...' })`
- Sensitive fields (`encryptedPrivateKey`, `totpSecret`, `passwordHash`) always `select: false` in Mongoose
- PancakeSwap contract calls always go through the adapter — never raw contract calls in executor
- Strategy engine never imports from executor or adapter — strict one-way dependency
- Every BullMQ worker has a dedicated Redis connection (BullMQ requirement)
- Socket.io rooms are per-user (`userId`) so operators only see their own events

---

## WHAT NOT TO DO

- Do NOT use `web3.js` — use `ethers.js v6` exclusively
- Do NOT store private keys unencrypted anywhere — not in DB, not in logs, not in memory longer than needed for signing
- Do NOT call `provider.getGasPrice()` — use `provider.getFeeData()` for EIP-1559-aware gas
- Do NOT use `parseInt` or `Number()` on token amounts — use `BigInt` or `ethers.parseUnits`
- Do NOT trust frontend-sent amounts without server-side validation against `amountMin/amountMax`
- Do NOT implement V2 and V3 in the same code path — keep them as separate branches in the adapter
- Do NOT skip the allowance check — many tokens on BSC revert silently without it
