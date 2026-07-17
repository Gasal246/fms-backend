import { Router } from 'express';
import { createDashboardController } from '../../main/container/dashboard.container.js';
import tryCatch from '../../shared/middleware/asyncHandler.js';

const router = Router();
const controller = createDashboardController();

/**
 * GET /api/dashboard
 * Optional query: ?snapshot_type=tenants_overview|camps_overview|rooms_overview|occupancy_overview|analytical_summary
 * Requires: authenticated JWT (cookie)
 */
router.get('/', tryCatch(controller.getDashboard));

/**
 * GET /api/dashboard/summary
 * Returns the analytical dashboard summary matching the frontend JSON contract.
 * Optional query: ?startDate=X&endDate=Y&filter=Vacant
 */
router.get('/summary', tryCatch(controller.getAnalyticalSummary));

export default router;
