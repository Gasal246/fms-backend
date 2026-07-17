import type { Response } from "express";
import type { CounterPointService } from "../../domain/repositories/counter-point.repository.interface.js";
import type { CounterPointFilter } from "../../domain/types/counter-point.types.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { CounterPointValidator } from "../../application/validators/counter-point.validator.js";
import { logger } from "../../shared/logger/logger.js";

export class CounterPointController {
  constructor(private counterPointUseCase: CounterPointService) {
    this.counterPointUseCase = counterPointUseCase;
  }

  createCounterPoint = async (req: AuthenticatedRequest, res: Response) => {
    const userId = (req.user.id || req.user._id) as string;
    req.body.client_id = req.user.client_id;
    req.body.created_by = userId;

    CounterPointValidator.validateCreate(req.body);

    logger.info(`Creating counter point: ${req.body.name}`);
    const counterPoint = await this.counterPointUseCase.createCounterPoint(req.body);
    res.status(201).json({ message: "Counter Point created successfully", counterPoint });
  };

  getCounterPoint = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching counter point details: ${id}`);
    const counterPoint = await this.counterPointUseCase.getCounterPoint(id as string);
    res.status(200).json(counterPoint);
  };

  getCounterPoints = async (req: AuthenticatedRequest, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const filters: CounterPointFilter = {
      camp_id: req.query.camp_id as string | undefined,
      zone_id: req.query.zone_id as string | undefined,
      counter_id: req.query.counter_id as string | undefined,
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

    const counterPoints = await this.counterPointUseCase.getAllCounterPoints(page, limit, filters, req.user.client_id);
    res.status(200).json(counterPoints);
  };

  updateCounterPoint = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user.id || req.user._id) as string;
    req.body.updated_by = userId;

    CounterPointValidator.validateUpdate(req.body);

    logger.info(`Updating counter point: ${id}`);
    const counterPoint = await this.counterPointUseCase.updateCounterPoint(id as string, req.body);
    res.status(200).json({ message: "Counter Point updated successfully", counterPoint });
  };

  deleteCounterPoint = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user.id || req.user._id) as string;

    logger.info(`Deleting counter point: ${id}`);
    await this.counterPointUseCase.deleteCounterPoint(id as string, userId);
    res.status(200).json({ message: "Counter Point deleted successfully" });
  };

  activateCounterPoint = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user.id || req.user._id) as string;

    logger.info(`Activating counter point: ${id}`);
    const counterPoint = await this.counterPointUseCase.activateCounterPoint(id as string, userId);
    res.status(200).json({ message: "Counter Point activated successfully", counterPoint });
  };

  deactivateCounterPoint = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user.id || req.user._id) as string;

    logger.info(`Deactivating counter point: ${id}`);
    const counterPoint = await this.counterPointUseCase.deactivateCounterPoint(id as string, userId);
    res.status(200).json({ message: "Counter Point deactivated successfully", counterPoint });
  };
}
