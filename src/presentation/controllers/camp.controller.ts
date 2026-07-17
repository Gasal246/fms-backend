import type { Response } from "express";
import type { CampService } from "../../domain/repositories/camp.repository.interface.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { successResponse } from "../../shared/utils/responseHandler.js";

export class CampController {
  constructor(private campUseCase: CampService) { }

  getCamp = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const camp = await this.campUseCase.getCamp(id as string);
    return successResponse(res, camp, "Camp retrieved successfully");
  };

  getAllCamps = async (req: AuthenticatedRequest, res: Response) => {
    const assignedCamps = req.user.assigned_camps?.map((c: any) => c.camp_id);
    const camps = await this.campUseCase.getAllCamps(req.user.client_id, assignedCamps);
    return successResponse(res, camps, "Camps retrieved successfully");
  };

  getOccupancySummary = async (req: AuthenticatedRequest, res: Response) => {
    const { camp_name, page, limit } = req.query;
    const assignedCamps = req.user.assigned_camps?.map((c: any) => c.camp_id);
    const summary = await this.campUseCase.getOccupancySummary( 
      req.user.client_id,
      camp_name as string,
      page ? Number(page) : undefined,
      limit ? Number(limit) : undefined,
      assignedCamps
    );

    return successResponse(res, summary, "Camp occupancy summary retrieved successfully");
  };
}
