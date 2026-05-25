import { loadEnv } from './config/env.js';

loadEnv();

import { createServer } from 'node:http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';
import { Server } from 'socket.io';
import { connectDb } from './config/db.js';
import { getEnv } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import botRoutes from './routes/bot.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import holdingsRoutes from './routes/holdings.routes.js';
import priceRoutes from './routes/price.routes.js';
import debugRoutes from './routes/debug.routes.js';
import publicRoutes from './routes/public.routes.js';
import adminRoutes from './routes/admin/index.js';
import traderLimitRoutes from './routes/trader/limitRequests.routes.js';
import { requireAuth, requireAdmin } from './middleware/auth.middleware.js';
import { attachSocketIo } from './socket/txStream.js';
import { bnbPriceService } from './services/bnbPrice.service.js';
import { limitSyncService } from './services/limitSync.service.js';
import { seedDefaultAdminIfEmpty } from './utils/seedAdmin.js';
import { migrateUserFields } from './utils/migrateUsers.js';
import { createBullmqConnection } from './config/bullmqRedis.js';
import { AppError } from './utils/errors.js';
import { logger } from './utils/logger.js';

const app = express();
const httpServer = createServer(app);

const { PORT, FRONTEND_ORIGIN, JWT_ACCESS_SECRET } = getEnv();

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  },
});

attachSocketIo(io);

io.use((socket, next) => {
  const cookies = parseCookie(socket.handshake.headers.cookie ?? '');
  const auth = socket.handshake.auth as { token?: string };
  const header = socket.handshake.headers.authorization;
  const token =
    auth?.token ||
    (typeof header === 'string' ? header.replace(/^Bearer\s+/i, '') : undefined) ||
    cookies.accessToken;
  if (!token) {
    next(new Error('Unauthorized'));
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET) as jwt.JwtPayload;
    const sub = payload.sub;
    if (typeof sub !== 'string') {
      next(new Error('Unauthorized'));
      return;
    }
    socket.data.userId = sub;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const uid = socket.data.userId as string | undefined;
  if (uid) {
    void socket.join(`user:${uid}`);
  }
});

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const holdingsLimiter = rateLimit({
  windowMs: 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
});

const priceLimiter = rateLimit({
  windowMs: 60_000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/public', publicRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
app.use('/api/trader/limit-requests', traderLimitRoutes);
app.use('/api/holdings', holdingsLimiter, holdingsRoutes);
app.use('/api/price', priceLimiter, priceRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/analytics', analyticsRoutes);

if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRoutes);
}

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(
        `${req.method} ${req.path}: ${err.message}${err.stack ? '\n' + err.stack : ''}`
      );
    }
    // 4xx: expected client mistakes (e.g. no cookie on GET /api/auth/me) — do not log as errors
    res.status(err.statusCode).json({ error: err.code, message: err.message });
    return;
  }
  logger.error(
    `${req.method} ${req.path}: ${err.message}${err.stack ? '\n' + err.stack : ''}`
  );
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
});

async function main(): Promise<void> {
  await connectDb();
  await migrateUserFields();
  await seedDefaultAdminIfEmpty();

  bnbPriceService.setOnPriceUpdated(() => {
    void limitSyncService.syncAllLimits();
  });
  bnbPriceService.startPolling();

  logger.info({ message: 'Starting background worker diagnostics' });
  const probe = createBullmqConnection();
  try {
    const ping = await probe.ping();
    logger.info({ message: 'Redis PING (BullMQ probe connection)', result: ping });
  } catch (err: unknown) {
    logger.error({
      message: 'Redis PING failed at startup — bot jobs will not run until Redis is reachable',
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await probe.quit();
  }

  const shouldStartExecutionWorker =
    process.env.NODE_ENV === 'production'
      ? process.env.RUN_EXECUTION_WORKER === 'true'
      : process.env.RUN_EXECUTION_WORKER !== 'false';

  if (shouldStartExecutionWorker) {
    const { startExecutionWorker } = await import('./workers/execution.worker.js');
    await startExecutionWorker();
    logger.info({ message: 'Execution worker started in API process' });
  } else {
    logger.info({
      message:
        'Execution worker not started in API process (production default). Run `npm run worker:execution` or set RUN_EXECUTION_WORKER=true.',
    });
  }

  httpServer.listen(PORT, () => {
    logger.info(`API listening on port ${PORT}`);
  });
}

main().catch((err: unknown) => {
  logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
