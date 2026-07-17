import type { Response } from "express";
import type { BuildingService } from "../../domain/repositories/building.repository.interface.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";

export class BuildingController {
  constructor(private buildingUseCase: BuildingService) { }

  getBuilding = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching building: ${id}`);
    const building = await this.buildingUseCase.getBuilding(id as string);
    res.status(200).json(building);
  };

  getBuildings = async (req: AuthenticatedRequest, res: Response) => {
    const { camp_id, zone_id } = req.query;
    const assignedCamps = req.user.assigned_camps?.map((c: any) => c.camp_id);
    const assignedZones = req.user.assigned_zones?.map((z: any) => z.zone_id);
    const buildings = await this.buildingUseCase.getAllBuildings(req.user.client_id, camp_id as string, zone_id as string, assignedCamps, assignedZones);
    res.status(200).json(buildings);
  };

  getOccupancySummary = async (req: AuthenticatedRequest, res: Response) => {
    const { camp_id, zone_id, building_name, page, limit } = req.query;

    const summary = await this.buildingUseCase.getOccupancySummary(
      req.user.client_id,
      camp_id as string,
      zone_id as string,
      building_name as string,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      req.user.assigned_camps?.map((c: any) => c.camp_id),
      req.user.assigned_zones?.map((z: any) => z.zone_id)
    );
    res.status(200).json(summary);
  };
}
