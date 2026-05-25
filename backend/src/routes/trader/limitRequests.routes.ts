import { Router } from 'express';
import { z } from 'zod';
import * as limitController from '../../controllers/trader/limitRequests.controller.js';
import { requireAuth, requireTrader } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validateBody } from '../../middleware/validate.middleware.js';

const router = Router();

router.use(requireAuth, requireTrader);

const submitSchema = z.object({
  requestedUSD: z.number().positive(),
  reason: z.string().min(20),
});

router.post('/', validateBody(submitSchema), asyncHandler(limitController.submitRequest));
router.get('/', asyncHandler(limitController.listMyRequests));
router.get('/:id', asyncHandler(limitController.getMyRequest));
router.delete('/:id', asyncHandler(limitController.cancelRequest));

export default router;
