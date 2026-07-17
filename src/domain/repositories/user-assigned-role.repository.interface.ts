import type { AssignRoleRequest, UserAssignedRoleResponse } from "../types/user-assigned-role.types.js";


export interface UserAssignedRoleRepository {
  assignRole(data: AssignRoleRequest): Promise<UserAssignedRoleResponse>;
  removeRole(user_id: string, role_slug: string): Promise<void>;
  findByUserId(user_id: string): Promise<UserAssignedRoleResponse[]>;
}
