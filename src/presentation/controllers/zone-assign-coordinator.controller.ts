import type { Response } from "express";
import type { ZoneAssignCoordinatorService } from "../../application/use-cases/zone-assign-coordinator.usecase.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";

export class ZoneAssignCoordinatorController {
  constructor(private service: ZoneAssignCoordinatorService) {}

  // POST /coordinator-zones/assign
  assignZone = async (req: AuthenticatedRequest, res: Response) => {
    logger.info("Assigning coordinator to zone");
    try {
      const result = await this.service.assignZone(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      logger.error(`Error assigning coordinator to zone: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };

  // DELETE /coordinator-zones/unassign
  unassignZone = async (req: AuthenticatedRequest, res: Response) => {
    const { coordinator_id, zone_id } = req.body;
    logger.info(`Unassigning coordinator ${coordinator_id} from zone ${zone_id}`);
    try {
      await this.service.unassignZone(coordinator_id, zone_id);
      res.status(200).json({ success: true, message: "Coordinator unassigned from zone" });
    } catch (error: any) {
      logger.error(`Error unassigning coordinator from zone: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };

  // GET /coordinator-zones/:coordinator_id/zones
  getAssignedZones = async (req: AuthenticatedRequest, res: Response) => {
    const { coordinator_id } = req.params;
    logger.info(`Fetching zones for coordinator ${coordinator_id}`);
    try {
      const data = await this.service.getAssignedZones(coordinator_id as string);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error(`Error fetching coordinator zones: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };

  // GET /coordinator-zones/zones/:zone_id/coordinators
  getAssignedCoordinators = async (req: AuthenticatedRequest, res: Response) => {
    const { zone_id } = req.params;
    logger.info(`Fetching coordinators for zone ${zone_id}`);
    try {
      const data = await this.service.getAssignedCoordinators(zone_id as string);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error(`Error fetching zone coordinators: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };

  // GET /coordinator-zones/list-zones  → for frontend dropdown
  listZonesForClient = async (req: AuthenticatedRequest, res: Response) => {
    const client_id = (req.query.client_id as string) || req.user?.client_id;
    logger.info(`Listing zones for client ${client_id}`);
    try {
      if (!client_id) {
        return res.status(401).json({ success: false, message: "Unauthorized. Missing client info." });
      }
      const assignedZones = req.user?.assigned_zones?.map((z: any) => z.zone_id);
      const data = await this.service.listZonesForClient(client_id, assignedZones);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error(`Error listing zones: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };
}
