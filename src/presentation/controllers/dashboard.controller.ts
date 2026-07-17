import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../shared/types/index.js';
import type { DashboardRepository } from '../../domain/repositories/dashboard.repository.interface.js';
import type { SnapshotType, RbacScope } from '../../domain/types/dashboard.types.js';
import { logger } from '../../shared/logger/logger.js';
import { successResponse } from '../../shared/utils/responseHandler.js';
import { runAllAggregations } from '../../infrastructure/dashboard/aggregation.service.js';

export class DashboardController {
  constructor(private readonly repo: DashboardRepository) { }

  /**
   * GET /api/dashboard?snapshot_type=<type>
   * Returns pre-computed snapshots scoped to the caller's role / orgId / userId.
   */
  getDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user ?? {};
    const orgId = user.client_id ?? user.orgId ?? undefined;

    const snapshotType = req.query.snapshot_type as SnapshotType | undefined;

    logger.info(
      `[DashboardController] getDashboard | orgId=${orgId} | snapshot_type=${snapshotType ?? 'all'}`
    );

    const documents = await this.repo.findByScope({ orgId }, snapshotType);
    successResponse(res, documents, 'Dashboard data retrieved successfully', 200);
  };

  /**
   * GET /api/dashboard/summary
   * Returns pre-computed analytical dashboard summary specifically for the user's Client.
   * If no snapshot exists yet (e.g. server just booted), triggers a fresh compute and waits.
   */
  getAnalyticalSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = req.user ?? {};

    const orgId = user.client_id ?? user.orgId;
    const roleId = user.roleId ?? user.role;

    logger.info(`[DashboardController] getAnalyticalSummary | orgId=${orgId} | role=${roleId}`);

    let snapshotData: any = {
      heroStats: {},
      miniCards: {},
      occupancyDonut: { rate: 0, breakdown: [] },
      liveActivity: [],
      sitePerformance: [],
    };

    if (orgId) {
      let documents = await this.repo.findByScope({ orgId }, 'analytical_summary');

      // ── On-demand compute if no snapshot exists yet ───────────────────────
      if (!documents || documents.length === 0) {
        logger.info('[DashboardController] No snapshot found – triggering on-demand aggregation...');
        try {
          await runAllAggregations();
          documents = await this.repo.findByScope({ orgId }, 'analytical_summary');
        } catch (err) {
          logger.error(`[DashboardController] On-demand aggregation failed: ${err}`);
        }
      }

      const firstDoc = documents?.[0];
      if (firstDoc?.data) {
        snapshotData = firstDoc.data;
      }
    }

    // ── Role-based response filtering ────────────────────────────────────────
    let finalData = snapshotData;
    switch (roleId) {
      case 'ROLE_TECHNICIAN':
        finalData = { liveActivity: snapshotData.liveActivity || [] };
        break;
      case 'ROLE_ACCOUNTANT':
        finalData = { miniCards: snapshotData.miniCards || {} };
        break;
      default:
        finalData = snapshotData;
    }

    res.status(200).json({
      success: true,
      message: 'Analytical summary retrieved successfully',
      data: finalData,
    });
  };
}
