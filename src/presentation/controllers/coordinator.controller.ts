import type { Response } from "express";
import type { CoordinatorService } from "../../application/use-cases/coordinator.usecase.js";
import type { CoordinatorFilter } from "../../domain/types/coordinator.types.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";

import { CoordinatorValidator } from "../../application/validators/coordinator.validator.js";

export class CoordinatorController {
  constructor(private coordinatorUseCase: CoordinatorService) { }

  getAllCoordinators = async (req: AuthenticatedRequest, res: Response) => {
    logger.info("Fetching all coordinators");
    try {
      const client_id = req.user?.client_id;
      if (!client_id && !req.query.client_id) {
         return res.status(401).json({ success: false, message: "Unauthorized. Missing client info." });
      }
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const filters: CoordinatorFilter = {
        client_id: (req.query.client_id as string) || req.user?.client_id,
        status: req.query.status ? parseInt(req.query.status as string) : undefined,
        full_name: req.query.full_name as string,
        email: req.query.email as string,
        phone: req.query.phone as string,
        search: req.query.search as string,
        camp_id: req.query.camp_id as string,
        assigned_camps: req.user?.assigned_camps?.map((c: any) => c.camp_id),
        assigned_zones: req.user?.assigned_zones?.map((z: any) => z.zone_id),
      };

      // Remove undefined filters to satisfy exactOptionalPropertyTypes
      (Object.keys(filters) as (keyof CoordinatorFilter)[]).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const coordinators = await this.coordinatorUseCase.getAllCoordinators(page, limit, filters);
      res.status(200).json(coordinators);
    } catch (error: any) {
      logger.error(`Error fetching coordinators: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  getOneCoordinator = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching coordinator: ${id}`);
    try {
      const coordinator = await this.coordinatorUseCase.getCoordinatorById(id as string);
      res.status(200).json(coordinator);
    } catch (error: any) {
      logger.error(`Error fetching coordinator ${id}: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  createCoordinator = async (req: AuthenticatedRequest, res: Response) => {
    logger.info("Creating new coordinator");
    try {
      const client_id = req.user?.client_id || req.body.client_id;
      const data = { ...req.body, client_id };
      CoordinatorValidator.validateCreateCoordinator(data);
      const coordinator = await this.coordinatorUseCase.createCoordinator(data);
      res.status(201).json(coordinator);
    } catch (error: any) {
      logger.error(`Error creating coordinator: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  updateCoordinator = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Updating coordinator: ${id}`);
    try {
      const coordinator = await this.coordinatorUseCase.updateCoordinator(id as string, req.body);
      res.status(200).json(coordinator);
    } catch (error: any) {
      logger.error(`Error updating coordinator ${id}: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  deleteCoordinator = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Deleting coordinator: ${id}`);
    try {
      await this.coordinatorUseCase.deleteCoordinator(id as string);
      res.status(204).send();
    } catch (error: any) {
      logger.error(`Error deleting coordinator ${id}: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };
}
