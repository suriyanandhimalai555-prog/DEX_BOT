# FLOW

This file describes implemented user/system flows from current code.

**Maintenance:** When you change auth, wallets, bots, DEX routing, workers, or API behavior, update this file in the same PR/commit so it stays accurate. Mirror structural changes in `docs/PROJECT_CONTEXT.md`.

---

## Flow 1: Operator Registration & Login

```text
[/login page]
    |
    v
[Login.tsx form submit]
    |
    +--> POST /api/auth/register  (mode=register)
    |
    +--> POST /api/auth/login     (mode=login)
              |
              v
      [backend auth.controller]
              |
              v
   setAuthCookies(accessToken, refreshToken)
              |
              v
 [frontend setUser + navigate('/')]
```

1. Operator visits `/login`, rendered by `frontend/src/pages/Login.tsx`.
2. User chooses mode: `login` or `register`.
3. Register path:
   - `Login.tsx` calls `api.post('/auth/register', values)`.
   - Backend `register()` validates uniqueness, hashes password via `bcrypt.hash`, creates user.
   - Backend signs JWTs and sets httpOnly cookies via `setAuthCookies`.
   - Response includes `user` object; frontend writes `useAuthStore.setUser` and redirects to `/`.
4. Login path:
   - `Login.tsx` calls `api.post('/auth/login', body)`.
   - Backend `login()` verifies password.
   - If `user.isTotpEnabled && user.totpSecret`, `totpCode` becomes mandatory and is validated with `speakeasy.totp.verify`.
   - Backend sets auth cookies and returns `user`; frontend stores user and redirects to `/`.
5. Protected session bootstrap:
   - `App.tsx` `ProtectedRoute` runs `GET /api/auth/me`.
   - If unauthenticated and no stored user: redirect to `/login`.
6. Axios refresh behavior:
   - `frontend/src/api/client.ts` intercepts `401`, calls `POST /api/auth/refresh` once, retries original request if refresh succeeds.

---

## Flow 2: Connect Browser Wallet (MetaMask / Trust Wallet / WalletConnect / Phantom EVM)

```text
[ConnectWalletButton]
      |
      v
[ConnectWalletModal]
  |         |            |            |
  v         v            v            v
MetaMask  TrustWallet  WalletConnect  PhantomEvm
  \         |            |            /
   \--------+------------+-----------/
                    |
                    v
            useConnect().connect()
                    |
                    v
              useAccount() updates
                    |
                    v
          useWalletConnectionSync()
                    |
                    v
      walletStore.setConnected(address, chainId)
                    |
                    +--> if chainId===56 -> loadHoldingsToStore(address)
                    +--> else clear holdings + show wrong network UI
```

1. Operator clicks `Connect wallet` in `frontend/src/components/layout/ConnectWalletButton.tsx`.
2. `ConnectWalletModal` opens (`frontend/src/components/wallets/ConnectWalletModal.tsx`).
3. Modal shows explicit wallet cards mapped to connector IDs:
   - `metaMaskSDK` (MetaMask)
   - `trustWallet`
   - `walletConnect` (if configured)
   - `phantom` (EVM provider `window.phantom?.ethereum`)
4. On wallet card click:
   - `handleConnect(connectorId)` finds matching wagmi connector and calls `connect({ connector, chainId: bsc.id })`.
5. Wagmi config (`frontend/src/lib/wagmi.config.ts`) enforces BSC chain set and connector definitions.
6. `useAccount()` state changes trigger `useWalletConnectionSync()` (mounted by `WalletConnectSync` inside `AppLayout`).
7. Sync hook writes store:
   - `setConnected(address, chainId)` and `isWrongNetwork = chainId !== 56`.
8. If wrong network:
   - `ConnectWalletButton` shows “Switch to BSC”.
   - `WrongNetworkBanner` shows sticky warning with `switchChain({ chainId: 56 })`.
9. On disconnect:
   - `useWalletConnectActions.disconnect()` invalidates holdings requests and calls wagmi disconnect.

---

## Flow 3: View Token Holdings

```text
[Wallet connected on chain 56]
          |
          v
useWalletConnectionSync -> loadHoldingsToStore(address)
          |
          v
GET /api/holdings/:walletAddress
          |
          v
holdings.controller.getHoldings()
  |- alchemy_getTokenBalances
  |- alchemy_getTokenMetadata (per token)
  |- eth_getBalance (native BNB)
  |- optional CoinGecko USD enrich
          |
          v
{ holdings[] } -> walletStore.setHoldings()
          |
          v
TokenHoldingsModal renders list / loading / error / empty
```

1. Trigger conditions:
   - Automatic on connect in `useWalletConnectionSync()` when `isConnected && chainId === 56`.
   - Manual via `Refresh` button in `TokenHoldingsModal`.
2. Frontend loader (`frontend/src/lib/walletHoldingsLoader.ts`):
   - Sets `holdingsLoading=true`, clears `holdingsError`.
   - Calls `fetchTokenHoldings(address)` -> `GET /holdings/:walletAddress`.
   - Uses `holdingsSeq` guard to avoid stale race overwrites.
3. Backend endpoint (`backend/src/controllers/holdings.controller.ts`):
   - Validates EVM address (`ethers.isAddress`), else `INVALID_ADDRESS` 400.
   - Calls Alchemy RPC method `alchemy_getTokenBalances`.
   - Filters zero/error balances.
   - Fetches native BNB via `eth_getBalance`.
   - Fetches ERC-20 metadata with `alchemy_getTokenMetadata`.
   - Builds holdings payload and filters dust balances `< 0.000001`.
   - Runs optional USD enrichment:
     - BNB price via CoinGecko `/simple/price`.
     - Up to 25 token prices via CoinGecko `/simple/token_price/binance-smart-chain`.
4. Response shape:
   - `{ holdings: [{ address, symbol, name, decimals, balance, balanceRaw, logoUrl?, priceUsd?, usdValue? }] }`.
5. UI render (`frontend/src/components/wallets/TokenHoldingsModal.tsx`):
   - Loading: skeleton rows.
   - Error: message + Retry button.
   - Empty: “No tokens found on BSC for this wallet.”
   - Success: searchable list with native `BNB` pinned first.

---

## Flow 4: Import a Wallet to the Bot System

```text
[Wallets page or TokenHoldingsModal CTA]
             |
             v
       [ImportWalletDialog]
             |
             v
POST /api/wallets/import { privateKey, label }
             |
             v
wallet.controller.importWallet()
  |- getOrCreateUserEncryptionKey(userId)
  |- normalize key (0x prefix)
  |- validate with ethers.Wallet
  |- encryptPrivateKey(pk, userEncryptionKey)
  |- save Wallet document
             |
             v
201 { wallet } (no private key)
             |
             v
invalidate ['wallets'] query -> table updates
```

1. User opens `ImportWalletDialog` from:
   - `Wallets` page (`Import wallet` button), or
   - `TokenHoldingsModal` footer CTA.
2. User enters `label` and `privateKey`.
3. Frontend mutation posts:
   - `POST /api/wallets/import` body `{ privateKey, label }`.
4. Backend `importWallet()`:
   - Requires authenticated `req.userId`.
   - Loads or creates per-user encryption key via `getOrCreateUserEncryptionKey(userId)` (`User.encryptionKey`, 64-char hex, `select: false`).
   - Normalizes private key to `0x...`.
   - Validates key/address by constructing `new ethers.Wallet(normalizedKey)`.
   - Encrypts private key with `encryptPrivateKey(normalizedKey, userEncryptionKey)` (AES-256-GCM; key material is per user, not from `.env`).
   - Enforces uniqueness per user by `address + createdBy`.
   - Creates wallet with defaults (`chain='bsc'`, `status='active'`, balances/counters).
5. Backend returns wallet metadata only; encrypted private key is never returned.
6. Frontend success handler:
   - toast success,
   - close modal,
   - invalidate `['wallets']` query.

Notes:
- Import-wallet route currently does **not** require TOTP.
- Legacy wallets encrypted with old global `ENCRYPTION_MASTER_KEY` may be auto-migrated on first bot run (see Flow 7); if both keys fail, operator must delete and re-import with plaintext key.

---

## Flow 5: Create a Bot

```text
[/bots page] -> [New bot]
        |
        v
    [BotForm]
        |
        v
POST /api/bots { ..., dex, dexVersion, ... }
        |
        v
bot.controller.createBot()
  |- validate walletGroup ownership
  |- normalize token addresses
  |- create Bot(status='draft', dex, dexVersion)
        |
        v
{ bot } -> invalidate ['bots'] -> BotCard appears
```

1. User navigates to `/bots` page (`frontend/src/pages/Bots.tsx`).
2. Clicks `New bot`, opening `BotForm`.
3. Form fields (`frontend/src/components/bots/BotForm.tsx`):
   - `name`
   - `strategyType` (`smooth_buy|smooth_sell|volume_cycle`)
   - **DEX / router** (combined dropdown sets both):
     - `dex` (`pancakeswap|uniswap`)
     - `dexVersion` (`v2|v3`)
     - Options: PancakeSwap V2, PancakeSwap V3, Uniswap V2 (labels from `frontend/src/config/dexOptions.ts`)
   - `baseToken`, `quoteToken` (address validated with `ethers.getAddress`)
   - `walletGroupId`
   - `buyEnabled`, `sellEnabled`
   - `amountMin`, `amountMax` (wei strings)
   - `intervalSeconds` (>=30)
   - `slippageBps` (50..2000)
   - `maxDailyNotionalUSD`
4. Step 2 price check (while configuring pair):
   - `usePriceCheck` sends `dex` + `dexVersion` from step 1 (same router the bot will use); clears stale results when either changes.
   - Debounced `GET /api/price/token?baseToken&quoteToken&dex&dexVersion&baseDecimals`.
   - Backend resolves V2 router via `backend/src/config/dex.ts` (`resolveV2RouterAddress(dex)` for V2; Pancake V3 quoter for V3).
   - `TokenPriceDisplay` labels use `getDexLabel(dex, dexVersion)` (e.g. "Listed on Uniswap V2", not hardcoded PancakeSwap).
5. `Bots.tsx` submits transformed payload (`...values` includes `dex` + `dexVersion`):
   - Adds `gasPolicy: { mode: 'auto' }`
   - Adds `riskPolicy: { maxDailyNotionalUSD, cooldownOnFailureSeconds: 120, maxConcurrentWallets: 3 }`
6. Backend `createBot()`:
   - `validateBody(createBotSchema)` must include `dex` (Zod previously stripped it — bots always saved as `pancakeswap`).
   - Validates auth and wallet-group ownership.
   - Normalizes token addresses.
   - Creates bot with `chain='bsc'`, `dex` + `dexVersion` from validated body, and `status='draft'`.
   - API response includes `dexLabel` and `routerAddress` from `resolveRouterAddress(bot.dex, bot.dexVersion)`.
7. Frontend on success:
   - closes form,
   - invalidates `['bots']`,
   - new bot appears as `BotCard` with DEX label from `getDexLabel(dex, dexVersion)`.

**Existing bots created before the routing fix:** MongoDB may still have `dex: pancakeswap` even if the UI showed Uniswap. Delete and recreate the bot, or `PATCH /api/bots/:id` with `{ "dex": "uniswap", "dexVersion": "v2" }` while `draft` or `paused`.

---

## Flow 6: Start a Bot

```text
[BotCard Start]
      |
      v
[TOTP modal in Bots.tsx]
      |
      v
POST /api/bots/:id/start { totpCode }
      |
      v
requireTotpForAction
      |
      v
bot.controller.startBot()
  |- status -> active
  |- consecutiveFailures -> 0
  |- scheduleBotExecution(botId, intervalSeconds)
  |- emitBotStatus(..., 'active')
  |- sendTelegramAlert("started")
```

1. On `/bots`, user clicks `Start` on a bot in status `draft` or `paused`.
2. Frontend opens inline TOTP modal and collects code.
3. Frontend calls `POST /api/bots/:id/start` with `{ totpCode }`.
4. Backend middleware chain:
   - `requireAuth`
   - `requireTotpForAction` (must have 2FA enabled + valid TOTP token)
5. `startBot()` sets state to `active`, schedules queue job, emits bot status, and sends Telegram alert.
6. Frontend invalidates `['bots']` and card status updates.

---

## Flow 7: Bot Execution Cycle (core loop)

```text
[BullMQ queue: bot-execution job 'execute']
              |
              v
execution.worker.ts
  -> load bot/status checks/cooldown/risk checks
  -> getOrCreateUserEncryptionKey(bot.createdBy)
  -> autoMigrateWalletEncryption() per wallet (legacy ENCRYPTION_MASTER_KEY -> per-user key)
  -> generateIntents()
  -> executeIntent() per intent
       -> signer/decrypt key (per-user encryption key)
       -> balances/quote/allowance/gas checks
       -> getQuote/buildSwapTx via dex registry (bot.dex + bot.dexVersion)
       -> sendTransaction()
       -> save Transaction(submitted) + emit tx:submitted
  -> update BotRun + bot failure counters
  -> scheduleNextRun()
              |
              v
confirmation.worker.ts polls submitted tx receipts
  -> confirmed => tx:confirmed
  -> reverted  => tx:failed
```

1. `scheduleBotExecution()` or `scheduleNextRun()` adds job `{ botId, triggeredAt }` to `bot-execution`.
2. `execution.worker.ts` dequeues job.
3. Loads `Bot` by `botId`; skips if absent or not `active`.
4. Checks `cooldownUntil`; if in cooldown, re-schedules next run and exits.
5. Resets bot daily notional date boundary when needed.
6. If `consecutiveFailures >= 5`, worker auto-pauses bot, cancels jobs, emits:
   - `bot:status` (`paused`)
   - `bot:error` (`Paused after consecutive failures`)
   - Telegram alert.
7. Loads wallet group + active wallets (with `+encryptedPrivateKey`).
8. Loads per-user encryption key via `getOrCreateUserEncryptionKey(bot.createdBy)`.
9. For each wallet, runs `autoMigrateWalletEncryption(wallet, encryptionKey)`:
   - If decrypt succeeds with per-user key: no-op.
   - Else if `ENCRYPTION_MASTER_KEY` in `.env` decrypts: re-encrypt with per-user key and save.
   - Else: wallet stays broken until manual re-import.
10. Resets per-wallet daily counters when day changes.
11. Checks bot daily-notional cap gate (`dailyNotionalUSD >= maxDailyNotionalUSD`), reschedules if capped.
12. Calls `generateIntents(bot, wallets)`:
    - `smooth_buy`: one buy intent
    - `smooth_sell`: one sell intent
    - `volume_cycle`: alternating buy/sell across sorted wallets
13. Limits intents by `riskPolicy.maxConcurrentWallets`.
14. Creates `BotRun(status='running', intentCount=...)`.
15. For each intent, calls `executeIntent(..., encryptionKey)`:
    - Resolves token side mapping.
    - Creates signer via `createSignerFromWallet(wallet, encryptionKey)` (decrypts with per-user key).
    - Resolves `routerAddr = resolveRouterAddress(bot.dex, bot.dexVersion)` for approvals and logging (not hardcoded Pancake env).
    - Checks token/native balance.
    - Builds `SwapParams` with `dex: bot.dex`, `dexVersion: bot.dexVersion`.
    - Calls `getQuote()` / `buildSwapTx()` from `pancake.adapter` (same router as `routerAddr`).
    - Logs `executeIntent_swap` with `routerAddress` and `swapTo`; warns if mismatch.
    - Fails with `ROUTE_UNAVAILABLE` if quote fails.
    - Fails with `SLIPPAGE_EXCEEDED` if `priceImpactBps > 1500`.
    - Checks allowance and submits `approve(MaxUint256)` if needed.
    - Calls `buildSwapTx()`.
    - Estimates gas, computes gas policy override (if fixed), checks BNB for gas.
    - Sends transaction.
    - Persists `Transaction(status='submitted', txHash, quotedPrice, ...)`.
    - Emits `tx:submitted`.
16. Failure paths classify code via `classifyFailure()`:
    - `INSUFFICIENT_BALANCE`
    - `SLIPPAGE_EXCEEDED`
    - `NONCE_CONFLICT`
    - `GAS_ESTIMATION_FAILED`
    - `RPC_UNAVAILABLE`
    - `UNKNOWN_REVERT`
    - plus explicit `ROUTE_UNAVAILABLE`, `TOKEN_RESTRICTED`
17. For any execution failure, transaction is persisted as failed and `tx:failed` is emitted immediately.
18. Worker finalizes `BotRun` counts/status and sets `endedAt`.
19. Bot post-run updates:
    - successes > 0 => `consecutiveFailures = 0`
    - all failed with intents > 0 => increment `consecutiveFailures`
    - if any failure => set `cooldownUntil = now + cooldownOnFailureSeconds`
    - sets `lastRunAt`
20. Worker schedules next run via `scheduleNextRun()`.
21. `confirmation.worker.ts` polls submitted txs every 5s:
    - Receipt success (`status=1`) -> marks tx confirmed, stores `gasSpentBNB`, emits `tx:confirmed`.
    - Receipt revert (`status=0`) -> marks failed (`UNKNOWN_REVERT`), emits `tx:failed`.

Differences vs planned narrative:
- There is no separate `BotExecutionRequested` named job; queue job name is `'execute'`.
- Step “update bot.lastRunAt, resets consecutiveFailures” is conditional (resets only when successes > 0).

---

## Flow 8: Real-time Transaction Feed on Dashboard

```text
[Dashboard.tsx]
    |
    v
useSocket(true) -> io(...)
    |
    v
socket auth via cookie (or auth token/header)
    |
    v
server joins room user:<userId>
    |
    v
listen tx:submitted / tx:confirmed / tx:failed
    |
    v
setFeed(prev => [tx, ...prev].slice(0, 50))
```

1. Operator opens `/dashboard`.
2. `useSocket(true)` creates socket.io client connection.
3. Backend socket middleware validates JWT and joins room `user:<uid>`.
4. Dashboard subscribes to:
   - `tx:submitted`
   - `tx:confirmed`
   - `tx:failed`
5. On each event payload `{ transaction }`, dashboard prepends tx row into local `feed`.
6. UI re-renders live tx list and keeps max 50 entries.
7. If no events yet, UI shows “Waiting for events…”.

---

## Flow 9: Pause / Stop a Bot

```text
[BotCard action]
   |              |
   v              v
Pause         Stop(with TOTP)
   |              |
POST /pause    POST /stop { totpCode }
   |              |
cancelBotExecution(botId)
   |              |
status update + socket bot:status + telegram alert
```

1. Pause path:
   - User clicks `Pause` on active bot.
   - Frontend calls `POST /api/bots/:id/pause`.
   - Backend `pauseBot()` requires bot currently active.
   - Sets status `paused`, cancels queued jobs via `cancelBotExecution`, emits status, sends Telegram alert.
2. Stop path:
   - User clicks `Stop`; frontend opens TOTP modal and posts `POST /api/bots/:id/stop` with `{ totpCode }`.
   - `requireTotpForAction` validates 2FA.
   - Backend sets status `stopped`, cancels jobs, emits status, sends Telegram alert.
3. In-flight execution behavior:
   - Already-running worker callback is not force-aborted.
   - Future scheduling is prevented by queue cancellation + status checks on subsequent job handling.

---

## Flow 10: Analytics Data Flow

```text
[/analytics page]
     |
     +--> GET /api/analytics/volume?from&to
     |          |
     |          v
     |      Transaction.aggregate(...)
     |          |
     |          v
     |      byStrategy[] -> BarChart
     |
     +--> GET /api/analytics/summary
                |
                v
       activeBots/txToday/successRate/gasSpent
                |
                v
       successRate snapshot -> LineChart
```

1. Operator opens `/analytics`.
2. Frontend state tracks date range (`from`, `to`) with default last 7 days.
3. Frontend requests `GET /api/analytics/volume?from=<date>&to=<date>`.
4. Backend `volumeAnalytics()`:
   - matches by `createdBy`, date range, `status='confirmed'`, optional `botId`.
   - `$lookup` to `bots`, `$group` by `bot.strategyType`, sum of `inputAmount` as `volumeWei`.
5. Frontend maps `byStrategy` to Recharts `BarChart`.
6. Frontend also requests `GET /api/analytics/summary`.
7. Backend `summaryAnalytics()` computes:
   - active bot count,
   - today tx count,
   - success rate percent (`confirmed / total`),
   - gas spent BNB (sum over today tx rows with `gasSpentBNB`).
8. Frontend renders a line chart snapshot with one point (`today`, `successRatePercent`).

---

## Flow 11: Telegram Alert Flow

```text
[Trigger in controller/worker]
        |
        v
sendTelegramAlert(userId, text)
        |
        v
lookup User.telegramChatId
        |
        +--> missing chatId -> return silently
        |
        v
POST https://api.telegram.org/bot<TOKEN>/sendMessage
        |
        v
Telegram DM delivered
```

Implemented alert triggers:

1. Bot lifecycle controller events (`backend/src/controllers/bot.controller.ts`):
   - start -> `Bot "<name>" started`
   - pause -> `Bot "<name>" paused`
   - resume -> `Bot "<name>" resumed`
   - stop -> `Bot "<name>" stopped`
2. Execution worker events (`backend/src/workers/execution.worker.ts`):
   - auto-pause after too many consecutive failures -> `Bot <name> paused after consecutive failures`
   - per intent failure -> `Bot <name> tx failed: <FailureCode>`

`sendTelegramAlert()` behavior:
1. Loads user by `userId`.
2. If `telegramChatId` missing, exits with no error.
3. Sends `sendMessage` request to Telegram Bot API using `TELEGRAM_BOT_TOKEN`.
4. On errors, logs `Telegram send failed: ...` and continues (non-blocking to core execution).

Note about threshold:
- Current auto-pause threshold is `consecutiveFailures >= 5` (not 3).

---

## Requested-but-different items

Some requested flow labels differ from implementation:

- “ConnectWalletModal shows 3 wallets”: current code shows 4 cards (`MetaMask`, `Trust Wallet`, `WalletConnect`, `Phantom`).
- “useWalletConnect hook”: current implementation uses `useWalletConnectionSync` + `walletHoldingsLoader` + `useWalletConnectActions`.
- “Import requires TOTP”: current code does not require TOTP for wallet import.
- “Bot execution step updates executedPrice”: `executedPrice` exists in schema but is not currently populated.

