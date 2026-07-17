import type { Response } from "express";
import type { CounterService } from "../../domain/repositories/counter.repository.interface.js";
import type { CounterFilter } from "../../domain/types/counter.types.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { CounterValidator } from "../../application/validators/counter.validator.js";
import { logger } from "../../shared/logger/logger.js";

export class CounterController {
  constructor(private counterUseCase: CounterService) {
    this.counterUseCase = counterUseCase;
  }

  createCounter = async (req: AuthenticatedRequest, res: Response) => {
    const userId = (req.user.id || req.user._id) as string;
    req.body.client_id = req.user.client_id;
    req.body.created_by = userId;

    CounterValidator.validateCreate(req.body);

    logger.info(`Creating counter: ${req.body.counter_name}`);
    const counter = await this.counterUseCase.createCounter(req.body);
    res.status(201).json({ message: "Counter created successfully", counter });
  };

  getCounter = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching counter details: ${id}`);
    const counter = await this.counterUseCase.getCounter(id as string);
    res.status(200).json(counter);
  };

  getCounters = async (req: AuthenticatedRequest, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const filters: CounterFilter = {
      camp_id: req.query.camp_id as string | undefined,
      zone_id: req.query.zone_id as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      sortField: req.query.sortField as string | undefined,
      sortOrder: req.query.sortOrder as any | undefined,
      assigned_camps: req.user.assigned_camps?.map((c: any) => c.camp_id),
      assigned_zones: req.user.assigned_zones?.map((z: any) => z.zone_id)
    };

    // Remove undefined filters
    Object.keys(filters).forEach(
      (key) => (filters as any)[key] === undefined && delete (filters as any)[key]
    );

    const counters = await this.counterUseCase.getAllCounters(page, limit, filters, req.user.client_id);
    res.status(200).json(counters);
  };

  updateCounter = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user.id || req.user._id) as string;
    req.body.updated_by = userId;

    CounterValidator.validateUpdate(req.body);

    logger.info(`Updating counter: ${id}`);
    const counter = await this.counterUseCase.updateCounter(id as string, req.body);
    res.status(200).json({ message: "Counter updated successfully", counter });
  };

  deleteCounter = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user.id || req.user._id) as string;

    logger.info(`Deleting counter: ${id}`);
    await this.counterUseCase.deleteCounter(id as string, userId);
    res.status(200).json({ message: "Counter deleted successfully" });
  };

  activateCounter = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user.id || req.user._id) as string;

    logger.info(`Activating counter: ${id}`);
    const counter = await this.counterUseCase.activateCounter(id as string, userId);
    res.status(200).json({ message: "Counter activated successfully", counter });
  };

  deactivateCounter = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user.id || req.user._id) as string;

    logger.info(`Deactivating counter: ${id}`);
    const counter = await this.counterUseCase.deactivateCounter(id as string, userId);
    res.status(200).json({ message: "Counter deactivated successfully", counter });
  };
}
