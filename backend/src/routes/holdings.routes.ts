import { Router } from 'express';
import * as holdingsController from '../controllers/holdings.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/:walletAddress', asyncHandler(holdingsController.getHoldings));

export default router;
