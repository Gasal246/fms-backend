import type { Response } from "express";
import type { GuestService } from "../../application/use-cases/guest.usecase.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";
import type { GuestFilter } from "../../domain/types/guest.types.js";

export class GuestController {
  constructor(private guestUseCase: GuestService) {}

  getAllGuests = async (req: AuthenticatedRequest, res: Response) => {
    logger.info("Fetching all guests");
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const filters: GuestFilter = {
        Camp_id: req.query.Camp_id as string,
        Client_id: req.query.Client_id as string,
        Zone_id: req.query.Zone_id as string,
        Guest_name: req.query.Guest_name as string,
        Hosted_by: req.query.Hosted_by as string,
        Created_by: req.query.Created_by as string,
        search: req.query.search as string,
        status: req.query.status as any,
      };

      // Remove undefined filters
      (Object.keys(filters) as (keyof GuestFilter)[]).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const result = await this.guestUseCase.getAllGuests(page, limit, filters);
      res.status(200).json(result);
    } catch (error: any) {
      logger.error(`Error fetching guests: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  getOneGuest = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching guest: ${id}`);
    try {
      const guest = await this.guestUseCase.getGuestById(id as string);
      res.status(200).json(guest);
    } catch (error: any) {
      logger.error(`Error fetching guest ${id}: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  createGuest = async (req: AuthenticatedRequest, res: Response) => {
    logger.info("Creating new guest");
    try {
      const guest = await this.guestUseCase.createGuest(req.body);
      res.status(201).json(guest);
    } catch (error: any) {
      logger.error(`Error creating guest: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  updateGuest = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Updating guest: ${id}`);
    try {
      const guest = await this.guestUseCase.updateGuest(id as string, req.body);
      res.status(200).json(guest);
    } catch (error: any) {
      logger.error(`Error updating guest ${id}: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  deleteGuest = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Deleting guest: ${id}`);
    try {
      await this.guestUseCase.deleteGuest(id as string);
      res.status(204).send();
    } catch (error: any) {
      logger.error(`Error deleting guest ${id}: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };
}
