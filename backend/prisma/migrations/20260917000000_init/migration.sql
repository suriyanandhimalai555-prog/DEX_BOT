CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserRole" AS ENUM ('admin', 'trader', 'observer');
CREATE TYPE "StrategyType" AS ENUM ('smooth_buy', 'smooth_sell', 'volume_cycle');
CREATE TYPE "DexId" AS ENUM ('pancakeswap', 'uniswap');
CREATE TYPE "DexVersion" AS ENUM ('v2', 'v3');
CREATE TYPE "BotStatus" AS ENUM ('draft', 'active', 'paused', 'stopped', 'errored');
CREATE TYPE "WalletStatus" AS ENUM ('active', 'quarantined', 'drained');
CREATE TYPE "BotRunStatus" AS ENUM ('running', 'completed', 'failed');
CREATE TYPE "TxStatus" AS ENUM ('pending', 'submitted', 'confirmed', 'failed');
CREATE TYPE "FailureCode" AS ENUM (
  'INSUFFICIENT_BALANCE',
  'ROUTE_UNAVAILABLE',
  'SLIPPAGE_EXCEEDED',
  'ALLOWANCE_REQUIRED',
  'NONCE_CONFLICT',
  'RPC_UNAVAILABLE',
  'TOKEN_RESTRICTED',
  'GAS_ESTIMATION_FAILED',
  'UNKNOWN_REVERT'
);
CREATE TYPE "TradeSide" AS ENUM ('buy', 'sell');
CREATE TYPE "LimitRequestStatus" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "ChainId" AS ENUM ('bsc');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "display_name" TEXT NOT NULL DEFAULT 'User',
  "totp_secret" TEXT,
  "is_totp_enabled" BOOLEAN NOT NULL DEFAULT false,
  "telegram_chat_id" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'trader',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "trade_limit_usd" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "trade_limit_bnb" DOUBLE PRECISION NOT NULL DEFAULT 0.003,
  "token_version" INTEGER NOT NULL DEFAULT 0,
  "encryption_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "wallet_groups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wallet_groups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "wallet_groups_created_by_idx" ON "wallet_groups"("created_by");

CREATE TABLE "wallets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "label" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "encrypted_private_key" TEXT NOT NULL,
  "wallet_group_id" UUID,
  "chain" "ChainId" NOT NULL DEFAULT 'bsc',
  "status" "WalletStatus" NOT NULL DEFAULT 'active',
  "native_balance" TEXT NOT NULL DEFAULT '0',
  "daily_spent_notional" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "daily_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_executed_at" TIMESTAMP(3),
  "active_bot_count" INTEGER NOT NULL DEFAULT 0,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallets_created_by_address_key" ON "wallets"("created_by", "address");
CREATE INDEX "wallets_address_idx" ON "wallets"("address");

CREATE TABLE "wallet_group_members" (
  "group_id" UUID NOT NULL,
  "wallet_id" UUID NOT NULL,

  CONSTRAINT "wallet_group_members_pkey" PRIMARY KEY ("group_id", "wallet_id")
);

CREATE INDEX "wallet_group_members_wallet_id_idx" ON "wallet_group_members"("wallet_id");

CREATE TABLE "bots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "strategy_type" "StrategyType" NOT NULL,
  "chain" "ChainId" NOT NULL DEFAULT 'bsc',
  "dex" "DexId" NOT NULL DEFAULT 'pancakeswap',
  "dex_version" "DexVersion" NOT NULL,
  "base_token" TEXT NOT NULL,
  "quote_token" TEXT NOT NULL,
  "wallet_group_id" UUID NOT NULL,
  "buy_enabled" BOOLEAN NOT NULL DEFAULT true,
  "sell_enabled" BOOLEAN NOT NULL DEFAULT true,
  "amount_min" TEXT NOT NULL,
  "amount_max" TEXT NOT NULL,
  "interval_seconds" INTEGER NOT NULL,
  "slippage_bps" INTEGER NOT NULL,
  "gas_policy" JSONB NOT NULL,
  "risk_policy" JSONB NOT NULL,
  "status" "BotStatus" NOT NULL DEFAULT 'draft',
  "last_run_at" TIMESTAMP(3),
  "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
  "cooldown_until" TIMESTAMP(3),
  "daily_notional_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "daily_notional_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bots_created_by_idx" ON "bots"("created_by");
CREATE INDEX "bots_wallet_group_id_idx" ON "bots"("wallet_group_id");

CREATE TABLE "bot_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bot_id" UUID NOT NULL,
  "triggered_at" TIMESTAMP(3) NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "ended_at" TIMESTAMP(3),
  "status" "BotRunStatus" NOT NULL DEFAULT 'running',
  "intent_count" INTEGER NOT NULL DEFAULT 0,
  "success_count" INTEGER NOT NULL DEFAULT 0,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bot_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bot_runs_bot_id_idx" ON "bot_runs"("bot_id");
CREATE INDEX "bot_runs_bot_id_started_at_idx" ON "bot_runs"("bot_id", "started_at" DESC);

CREATE TABLE "transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bot_id" UUID NOT NULL,
  "bot_run_id" UUID NOT NULL,
  "wallet_id" UUID NOT NULL,
  "wallet_address" TEXT NOT NULL,
  "chain" "ChainId" NOT NULL DEFAULT 'bsc',
  "dex" "DexId" NOT NULL DEFAULT 'pancakeswap',
  "dex_version" "DexVersion" NOT NULL,
  "side" "TradeSide" NOT NULL,
  "input_token" TEXT NOT NULL,
  "output_token" TEXT NOT NULL,
  "input_amount" TEXT NOT NULL,
  "output_amount" TEXT,
  "tx_hash" TEXT,
  "status" "TxStatus" NOT NULL DEFAULT 'pending',
  "failure_code" "FailureCode",
  "failure_reason" TEXT,
  "gas_spent_bnb" TEXT,
  "quoted_price" TEXT,
  "executed_price" TEXT,
  "submitted_at" TIMESTAMP(3),
  "confirmed_at" TIMESTAMP(3),
  "was_limit_capped" BOOLEAN NOT NULL DEFAULT false,
  "limit_cap_details" JSONB,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "transactions_bot_id_idx" ON "transactions"("bot_id");
CREATE INDEX "transactions_tx_hash_idx" ON "transactions"("tx_hash");
CREATE INDEX "transactions_bot_id_created_at_idx" ON "transactions"("bot_id", "created_at" DESC);
CREATE INDEX "transactions_created_by_created_at_idx" ON "transactions"("created_by", "created_at" DESC);
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

CREATE TABLE "limit_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "requested_usd" DOUBLE PRECISION NOT NULL,
  "current_usd" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "LimitRequestStatus" NOT NULL DEFAULT 'pending',
  "admin_note" TEXT,
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "limit_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "limit_requests_user_id_idx" ON "limit_requests"("user_id");
CREATE INDEX "limit_requests_status_idx" ON "limit_requests"("status");
CREATE INDEX "limit_requests_user_id_status_idx" ON "limit_requests"("user_id", "status");

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "action" TEXT NOT NULL,
  "details" TEXT,
  "ip_address" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

ALTER TABLE "wallet_groups" ADD CONSTRAINT "wallet_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_wallet_group_id_fkey" FOREIGN KEY ("wallet_group_id") REFERENCES "wallet_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "wallet_group_members" ADD CONSTRAINT "wallet_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "wallet_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "wallet_group_members" ADD CONSTRAINT "wallet_group_members_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bots" ADD CONSTRAINT "bots_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bots" ADD CONSTRAINT "bots_wallet_group_id_fkey" FOREIGN KEY ("wallet_group_id") REFERENCES "wallet_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bot_runs" ADD CONSTRAINT "bot_runs_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bot_run_id_fkey" FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "limit_requests" ADD CONSTRAINT "limit_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "limit_requests" ADD CONSTRAINT "limit_requests_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
