import type { Response } from "express";
import type { BedHistoryService } from "../../domain/repositories/bed-history.repository.interface.js";
import type { BedHistoryFilter } from "../../domain/types/bed-history.types.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";

export class BedHistoryController {
  constructor(private bedHistoryService: BedHistoryService) {}

  getAllBedHistory = async (req: AuthenticatedRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const filters: BedHistoryFilter = {
      assigned_at: req.query.assigned_at as string,
      unassigned_at: req.query.unassigned_at as string,
      tenant_id: req.query.tenant_id as string,
      bed_id: req.query.bed_id as string,
      room_id: req.query.room_id as string,
      building_id: req.query.building_id as string,
      zone_id: req.query.zone_id as string,
      camp_id: req.query.camp_id as string,
      assigned_camps: req.user?.assigned_camps?.map((c: any) => c.camp_id),
      assigned_zones: req.user?.assigned_zones?.map((z: any) => z.zone_id),
    };

    logger.info(`Fetching bed history with filters: ${JSON.stringify(filters)}`);
    const history = await this.bedHistoryService.getAllBedHistory(page, limit, filters);
    res.status(200).json(history);
  };

  getTenantBedHistory = async (req: AuthenticatedRequest, res: Response) => {
    const tenantId = req.params.tenantId as string;
    logger.info(`Fetching bed history for tenant: ${tenantId}`);
    const history = await this.bedHistoryService.getTenantBedHistory(tenantId);
    res.status(200).json(history);
  };
}
