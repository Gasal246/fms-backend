import type { Response } from "express";
import type { CampAssignCoordinatorService } from "../../application/use-cases/camp-assign-coordinator.usecase.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";

export class CampAssignCoordinatorController {
  constructor(private service: CampAssignCoordinatorService) {}

  // POST /coordinator-sites/assign
  assignSite = async (req: AuthenticatedRequest, res: Response) => {
    logger.info("Assigning coordinator to site");
    try {
      const result = await this.service.assignSite(req.body);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      logger.error(`Error assigning coordinator to site: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };

  // DELETE /coordinator-sites/unassign
  unassignSite = async (req: AuthenticatedRequest, res: Response) => {
    const { coordinator_id, camp_id } = req.body;
    logger.info(`Unassigning coordinator ${coordinator_id} from site ${camp_id}`);
    try {
      await this.service.unassignSite(coordinator_id, camp_id);
      res.status(200).json({ success: true, message: "Coordinator unassigned from site" });
    } catch (error: any) {
      logger.error(`Error unassigning coordinator: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };

  // GET /coordinator-sites/:coordinator_id/camps
  getAssignedCamps = async (req: AuthenticatedRequest, res: Response) => {
    const { coordinator_id } = req.params;
    logger.info(`Fetching camps for coordinator ${coordinator_id}`);
    try {
      const data = await this.service.getAssignedCamps(coordinator_id as string);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error(`Error fetching coordinator camps: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };

  // GET /coordinator-sites/camps/:camp_id/coordinators
  getAssignedCoordinators = async (req: AuthenticatedRequest, res: Response) => {
    const { camp_id } = req.params;
    logger.info(`Fetching coordinators for camp ${camp_id}`);
    try {
      const data = await this.service.getAssignedCoordinators(camp_id as string);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error(`Error fetching camp coordinators: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };

  // GET /coordinator-sites/list-camps  → for frontend dropdown
  listCampsForClient = async (req: AuthenticatedRequest, res: Response) => {
    const client_id = (req.query.client_id as string) || req.user?.client_id;
    logger.info(`Listing camps for client ${client_id}`);
    try {
      if (!client_id) {
        return res.status(401).json({ success: false, message: "Unauthorized. Missing client info." });
      }
      const assignedCamps = req.user?.assigned_camps?.map((c: any) => c.camp_id);
      const data = await this.service.listCampsForClient(client_id, assignedCamps);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error(`Error listing camps: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };
}
