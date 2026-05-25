import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validateQuery } from '../middleware/validate.middleware.js';
import { priceTokenQuerySchema } from '../schemas/priceTokenQuery.js';
import { getTokenPrice } from '../controllers/price.controller.js';

const router = Router();

router.get('/token', requireAuth, validateQuery(priceTokenQuerySchema), asyncHandler(getTokenPrice));

export default router;
