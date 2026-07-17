import type { IPermissionRepository } from "../../domain/repositories/permission.repository.interface.js";
import type { IPermissionService } from "../../domain/repositories/permission.repository.interface.js";
import type { PermissionResponse, RoleAssignedPermissionResponse } from "../../domain/types/permission.types.js";

export class PermissionUseCase implements IPermissionService {
  constructor(private permissionRepository: IPermissionRepository) { }

  async getAllPermissions(roleSlug?: string, client_id?: string): Promise<PermissionResponse[]> {
    return this.permissionRepository.getAllPermissions(roleSlug, client_id);
  }

  async getPermissionsByRole(roleId: string): Promise<RoleAssignedPermissionResponse[]> {
    return this.permissionRepository.getPermissionsByRole(roleId);
  }

  async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
    return this.permissionRepository.assignPermissionsToRole(roleId, permissionIds);
  }
}

