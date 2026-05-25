import { Router } from 'express';
import { bnbPricePublic } from '../controllers/trader/limitRequests.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/bnb-price', asyncHandler(bnbPricePublic));

export default router;
