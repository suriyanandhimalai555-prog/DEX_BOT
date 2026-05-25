import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/volume', requireAuth, asyncHandler(analyticsController.volumeAnalytics));
router.get('/summary', requireAuth, asyncHandler(analyticsController.summaryAnalytics));
router.get('/transactions', requireAuth, asyncHandler(analyticsController.listTransactionsAnalytics));

export default router;
