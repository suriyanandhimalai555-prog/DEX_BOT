import { Router } from 'express';
import { z } from 'zod';
import * as botController from '../controllers/bot.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.middleware.js';

const router = Router();

const gasPolicySchema = z.object({
  mode: z.enum(['auto', 'fixed']),
  maxGweiOverride: z.number().optional(),
});

const riskPolicySchema = z.object({
  maxDailyNotionalUSD: z.number().nonnegative(),
  cooldownOnFailureSeconds: z.number().nonnegative(),
  maxConcurrentWallets: z.number().int().positive(),
});

const botBodySchema = z.object({
  name: z.string().min(1).max(120),
  strategyType: z.enum(['smooth_buy', 'smooth_sell', 'volume_cycle']),
  dex: z.enum(['pancakeswap', 'uniswap']).default('pancakeswap'),
  dexVersion: z.enum(['v2', 'v3']),
  baseToken: z.string(),
  quoteToken: z.string(),
  walletGroupId: z.string(),
  buyEnabled: z.boolean(),
  sellEnabled: z.boolean(),
  amountMin: z.string(),
  amountMax: z.string(),
  intervalSeconds: z.number().min(30),
  slippageBps: z.number().min(50).max(2000),
  gasPolicy: gasPolicySchema,
  riskPolicy: riskPolicySchema,
});

function refineDexCombo(
  data: { dex?: 'pancakeswap' | 'uniswap'; dexVersion?: 'v2' | 'v3' },
  ctx: z.RefinementCtx
): void {
  if (data.dex === 'uniswap' && data.dexVersion === 'v3') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Uniswap on BSC only supports V2. Select Uniswap V2 or PancakeSwap V3.',
      path: ['dexVersion'],
    });
  }
}

const createBotSchema = botBodySchema.superRefine(refineDexCombo);
const updateBotSchema = botBodySchema.partial().superRefine(refineDexCombo);

router.post(
  '/',
  requireAuth,
  validateBody(createBotSchema),
  asyncHandler(botController.createBot)
);

router.get('/', requireAuth, asyncHandler(botController.listBots));

router.get('/:id/transactions', requireAuth, asyncHandler(botController.listBotTransactions));

router.get('/:id', requireAuth, asyncHandler(botController.getBot));

router.patch(
  '/:id',
  requireAuth,
  validateBody(updateBotSchema),
  asyncHandler(botController.updateBot)
);

router.post('/:id/start', requireAuth, asyncHandler(botController.startBot));

router.post('/:id/pause', requireAuth, asyncHandler(botController.pauseBot));

router.post('/:id/resume', requireAuth, asyncHandler(botController.resumeBot));

router.post('/:id/stop', requireAuth, asyncHandler(botController.stopBot));

router.delete('/:id', requireAuth, asyncHandler(botController.deleteBot));

export default router;
