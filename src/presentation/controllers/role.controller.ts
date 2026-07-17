import type { Response } from "express";
import type { RoleService } from "../../domain/repositories/role.repository.interface.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";

export class RoleController {
  constructor(private roleUseCase: RoleService) { }

  getRoles = async (req: AuthenticatedRequest, res: Response) => {
    const roles = await this.roleUseCase.getAllRoles();
    res.status(200).json(roles);
  };
}
