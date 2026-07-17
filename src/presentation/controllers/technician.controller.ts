import type { Response } from "express";
import type { TechnicianService } from "../../application/use-cases/technician.usecase.js";
import type { TechnicianFilter } from "../../domain/types/technician.types.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";

import { TechnicianValidator } from "../../application/validators/technician.validator.js";

export class TechnicianController {
  constructor(private technicianUseCase: TechnicianService) { }

  getAllTechnicians = async (req: AuthenticatedRequest, res: Response) => {
    logger.info("Fetching all technicians");
    try {
      const client_id = req.user?.client_id;
      if (!client_id && !req.query.client_id) {
         return res.status(401).json({ success: false, message: "Unauthorized. Missing client info." });
      }
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const filters: TechnicianFilter = {
        client_id: (req.query.client_id as string) || req.user?.client_id,
        status: req.query.status ? parseInt(req.query.status as string) : undefined,
        name: req.query.name as string,
        email: req.query.email as string,
        phone: req.query.phone as string,
        search: req.query.search as string,
        assigned_camps: req.user?.assigned_camps?.map((c: any) => c.camp_id),
        assigned_zones: req.user?.assigned_zones?.map((z: any) => z.zone_id),
      };

      (Object.keys(filters) as (keyof TechnicianFilter)[]).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const technicians = await this.technicianUseCase.getAllTechnicians(page, limit, filters, req.user?.client_id);
      res.status(200).json(technicians);
    } catch (error: any) {
      logger.error(`Error fetching technicians: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  getOneTechnician = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching technician: ${id}`);
    try {
      const technician = await this.technicianUseCase.getTechnicianById(id as string);
      res.status(200).json(technician);
    } catch (error: any) {
      logger.error(`Error fetching technician ${id}: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  createTechnician = async (req: AuthenticatedRequest, res: Response) => {
    logger.info("Creating new technician");
    try {
      const client_id = req.user?.client_id || req.body.client_id;
      const data = { ...req.body, client_id };
      TechnicianValidator.validateCreateTechnician(data);
      const technician = await this.technicianUseCase.createTechnician(data);
      res.status(201).json(technician);
    } catch (error: any) {
      logger.error(`Error creating technician: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  updateTechnician = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Updating technician: ${id}`);
    try {
      const technician = await this.technicianUseCase.updateTechnician(id as string, req.body);
      res.status(200).json(technician);
    } catch (error: any) {
      logger.error(`Error updating technician ${id}: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  deleteTechnician = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Deleting technician: ${id}`);
    try {
      await this.technicianUseCase.deleteTechnician(id as string);
      res.status(204).send();
    } catch (error: any) {
      logger.error(`Error deleting technician ${id}: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };
}
