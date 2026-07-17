import type { Response } from "express";
import type { TechnicianAssignCampsService } from "../../application/use-cases/technician-assign-camps.usecase.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";

export class TechnicianAssignCampsController {
  constructor(private service: TechnicianAssignCampsService) {}

  // POST /technician-sites/assign
  assignSites = async (req: AuthenticatedRequest, res: Response) => {
    logger.info("Assigning technician to site(s)");
    try {
      const client_id = req.user?.client_id || req.body.client_id;
      const result = await this.service.assignSites({ ...req.body, client_id });
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      logger.error(`Error assigning technician to sites: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };

  // DELETE /technician-sites/unassign
  unassignSite = async (req: AuthenticatedRequest, res: Response) => {
    const { technician_id, camp_id } = req.body;
    logger.info(`Unassigning technician ${technician_id} from site ${camp_id}`);
    try {
      const data = await this.service.unassignSite(technician_id, camp_id);
      res.status(200).json({ success: true, data, message: "Technician unassigned from site" });
    } catch (error: any) {
      logger.error(`Error unassigning technician: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };

  // GET /technician-sites/:technician_id/camps
  getAssignedCamps = async (req: AuthenticatedRequest, res: Response) => {
    const { technician_id } = req.params;
    logger.info(`Fetching camps for technician ${technician_id}`);
    try {
      const data = await this.service.getAssignedCamps(technician_id as string);
      res.status(200).json({ success: true, data });
    } catch (error: any) {
      logger.error(`Error fetching technician camps: ${error.message}`);
      res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
  };

  // GET /technician-sites/list-camps  → for frontend dropdown
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
