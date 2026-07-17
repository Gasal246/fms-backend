import type { Response } from "express";
import type { IPermissionService } from "../../domain/repositories/permission.repository.interface.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";

import { PermissionValidator } from "../../application/validators/permission.validator.js";
import { logger } from "../../shared/logger/logger.js";

export class PermissionController {
  constructor(private permissionUseCase: IPermissionService) { }

  getAllPermissions = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { role_slug } = req.query;
      
      const client_id = req.user?.client_id || req.user?.id;
      const permissions = await this.permissionUseCase.getAllPermissions(role_slug as string, client_id as string);
      res.status(200).json({
        success: true,
        data: permissions
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message
      });
    }
  };


  getPermissionsByRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { roleId } = req.params;
      const permissions = await this.permissionUseCase.getPermissionsByRole(roleId as string);
      res.status(200).json({
        success: true,
        data: permissions
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message
      });
    }
  };

  assignPermissionsToRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
      PermissionValidator.validateAssignPermissions(req.body);

      const { role_id, permission_ids } = req.body;

      await this.permissionUseCase.assignPermissionsToRole(role_id, permission_ids);

      res.status(200).json({
        success: true,
        message: "Permissions assigned to role successfully"
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message
      });
    }
  };
}
