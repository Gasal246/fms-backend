import type { Response } from "express";
import type { StatusService } from "../../domain/repositories/status.repository.interface.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";

export class StatusController {
  constructor(private statusUseCase: StatusService) { }

  getStatuses = async (req: AuthenticatedRequest, res: Response) => {
    const statuses = await this.statusUseCase.getAllStatuses();
    res.status(200).json(statuses);
  };
}
