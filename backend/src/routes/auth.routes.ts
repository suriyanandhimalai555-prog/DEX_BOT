import { Router } from 'express';
import { z } from 'zod';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validateBody } from '../middleware/validate.middleware.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(120),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

const verify2faSchema = z.object({
  token: z.string().min(6).max(8),
});

router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(authController.register)
);

router.post('/login', validateBody(loginSchema), asyncHandler(authController.login));

router.post('/2fa/setup', requireAuth, asyncHandler(authController.setup2fa));

router.post(
  '/2fa/verify',
  requireAuth,
  validateBody(verify2faSchema),
  asyncHandler(authController.verify2fa)
);

router.post('/refresh', asyncHandler(authController.refresh));

router.post('/logout', asyncHandler(authController.logout));

router.get('/check', asyncHandler(authController.checkAuth));

router.get('/me', requireAuth, asyncHandler(authController.me));

const profileSchema = z.object({
  telegramChatId: z.string().optional(),
});

router.patch(
  '/profile',
  requireAuth,
  validateBody(profileSchema),
  asyncHandler(authController.updateProfile)
);

export default router;
