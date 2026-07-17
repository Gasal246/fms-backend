import type { PermissionResponse } from "../types/permission.types.js";
import type { RoleAssignedPermissionResponse } from "../types/permission.types.js";

export interface IPermissionRepository {
  getAllPermissions(roleSlug?: string, client_id?: string): Promise<PermissionResponse[]>;
  getPermissionsByRole(roleId: string, client_id?: string): Promise<RoleAssignedPermissionResponse[]>;
  assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void>;
}

export interface IPermissionService {
  getAllPermissions(roleSlug?: string, client_id?: string): Promise<PermissionResponse[]>;
  getPermissionsByRole(roleId: string, client_id?: string): Promise<RoleAssignedPermissionResponse[]>;
  assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void>;
}

