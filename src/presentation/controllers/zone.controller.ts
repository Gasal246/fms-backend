import type { Response } from "express";
import type { ZoneService } from "../../domain/repositories/zone.repository.interface.js";
import type { ZoneFilter } from "../../domain/types/zone.types.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";

export class ZoneController {
  constructor(private zoneUseCase: ZoneService) { }

  getZone = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching zone: ${id}`);
    const zone = await this.zoneUseCase.getZone(id as string);
    res.status(200).json(zone);
  };

  getZones = async (req: AuthenticatedRequest, res: Response) => {
    const { camp_id, search } = req.query;
    console.log("camp_id",camp_id);
    
    const assignedCamps = req.user.assigned_camps?.map((c: any) => c.camp_id);
    const assignedZones = req.user.assigned_zones?.map((z: any) => z.zone_id);
    const zones = await this.zoneUseCase.getAllZones(req.user.client_id, camp_id as string, assignedCamps, assignedZones, search as string);
    console.log("zones",zones);
    
    res.status(200).json(zones);
  };
}
 