import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  /** Comma-separated DNS IPs for Node SRV lookups (fixes querySrv ECONNREFUSED with mongodb+srv on some Windows setups). */
  MONGODB_DNS_SERVERS: z
    .string()
    .optional()
    .transform((v) => (v?.trim() ? v.trim() : undefined)),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  /** Legacy global key — no longer required. Per-user keys are now stored in MongoDB. */
  ENCRYPTION_MASTER_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'Must be 64 hex chars (32 bytes)').optional(),
  ALCHEMY_BSC_MAINNET_URL: z.string().url(),
  ALCHEMY_BSC_TESTNET_URL: z.string().url(),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  PANCAKE_V2_ROUTER: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  PANCAKE_V3_ROUTER: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  PANCAKE_V3_QUOTER: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  WBNB_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  /** Uniswap V2 router on BSC. Falls back to the official deployment if not set. */
  UNISWAP_V2_ROUTER: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  BSC_CHAIN_ID: z.coerce.number().default(56),
  DEFAULT_TRADE_LIMIT_USD: z.coerce.number().positive().default(1),
  MAX_TRADE_LIMIT_USD: z.coerce.number().positive().default(10000),
  ADMIN_EMAIL: z.string().email().default('admin@dexbot.local'),
  ADMIN_PASSWORD: z.string().min(8).default('Admin@123456'),
  BNB_PRICE_POLL_INTERVAL_MS: z.coerce.number().positive().default(60_000),
  BNB_PRICE_FALLBACK_USD: z.coerce.number().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
    throw new Error('Environment validation failed');
  }
  cached = parsed.data;
  return parsed.data;
}

export function getEnv(): Env {
  if (!cached) return loadEnv();
  return cached;
}
