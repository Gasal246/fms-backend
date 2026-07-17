import type { Request, Response } from "express";
import { UserAssignedRoleUseCase } from "../../application/use-cases/user-assigned-role.usecase.js";
import { logger } from "../../shared/logger/logger.js";
import { successResponse } from "../../shared/utils/responseHandler.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";

export class UserAssignedRoleController {
  constructor(private userAssignedRoleUseCase: UserAssignedRoleUseCase) { }

  assignRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { role_id, user_id } = req.body;
      const result = await this.userAssignedRoleUseCase.assignRole({ user_id, role_id });
      return successResponse(res, result, "Role assigned successfully", 201);
    } catch (error: any) {
      logger.error(`Error assigning role: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  };

  removeRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { role_id, user_id } = req.body;
      await this.userAssignedRoleUseCase.removeRole(user_id, role_id);
      return successResponse(res, null, "Role removed successfully", 200);
    } catch (error: any) {
      logger.error(`Error removing role: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  };

  getRolesByUserId = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await this.userAssignedRoleUseCase.getRolesByUserId(req.user.id);
      return successResponse(res, result, "Roles retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching roles for user: ${error.message}`);
      res.status(500).json({ message: error.message });
    }
  };
}
