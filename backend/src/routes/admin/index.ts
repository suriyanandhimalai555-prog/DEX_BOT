import { Router } from 'express';
import { z } from 'zod';
import * as usersController from '../../controllers/admin/users.controller.js';
import * as limitRequestsController from '../../controllers/admin/limitRequests.controller.js';
import * as statsController from '../../controllers/admin/stats.controller.js';
import * as botsController from '../../controllers/admin/bots.controller.js';
import * as logsController from '../../controllers/admin/logs.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validateBody } from '../../middleware/validate.middleware.js';

const router = Router();

router.get('/users', asyncHandler(usersController.listUsers));
router.get('/users/:userId', asyncHandler(usersController.getUser));
router.post('/users/:userId/activate', asyncHandler(usersController.activateUser));
router.post('/users/:userId/deactivate', asyncHandler(usersController.deactivateUser));
router.patch(
  '/users/:userId/role',
  validateBody(z.object({ role: z.enum(['admin', 'trader']) })),
  asyncHandler(usersController.setUserRole)
);
router.patch(
  '/users/:userId/limit',
  validateBody(z.object({ tradeLimitUSD: z.number().positive() })),
  asyncHandler(usersController.overrideUserLimit)
);

router.get('/limit-requests', asyncHandler(limitRequestsController.listLimitRequests));
router.get(
  '/limit-requests/pending/count',
  asyncHandler(limitRequestsController.pendingCount)
);
router.post(
  '/limit-requests/:id/approve',
  validateBody(z.object({ adminNote: z.string().optional() })),
  asyncHandler(limitRequestsController.approveRequest)
);
router.post(
  '/limit-requests/:id/reject',
  validateBody(z.object({ adminNote: z.string().min(10) })),
  asyncHandler(limitRequestsController.rejectRequest)
);

router.get('/stats', asyncHandler(statsController.platformStats));
router.get('/bots', asyncHandler(botsController.listAllBots));
router.get('/logs', asyncHandler(logsController.listLogs));

export default router;
