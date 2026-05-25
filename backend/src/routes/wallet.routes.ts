import { Router } from 'express';
import { z } from 'zod';
import * as walletController from '../controllers/wallet.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.middleware.js';

const router = Router();

const importSchema = z.object({
  privateKey: z.string().min(1),
  label: z.string().min(1).max(120),
});

const groupSchema = z.object({
  name: z.string().min(1).max(120),
  walletIds: z.array(z.string()).min(1),
});

router.post(
  '/import',
  requireAuth,
  validateBody(importSchema),
  asyncHandler(walletController.importWallet)
);

router.get('/groups', requireAuth, asyncHandler(walletController.listGroups));

router.post(
  '/groups',
  requireAuth,
  validateBody(groupSchema),
  asyncHandler(walletController.createGroup)
);

router.get('/', requireAuth, asyncHandler(walletController.listWallets));

router.delete('/:id', requireAuth, asyncHandler(walletController.deleteWallet));

export default router;
