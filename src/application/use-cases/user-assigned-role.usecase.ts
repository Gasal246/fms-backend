import type { UserAssignedRoleRepository } from "../../domain/repositories/user-assigned-role.repository.interface.js";
import type { AssignRoleRequest, UserAssignedRoleResponse } from "../../domain/types/user-assigned-role.types.js";

export class UserAssignedRoleUseCase {
  constructor(private userAssignedRoleRepository: UserAssignedRoleRepository) { }

  async assignRole(data: AssignRoleRequest): Promise<UserAssignedRoleResponse> {
    return this.userAssignedRoleRepository.assignRole(data);
  }

  async removeRole(user_id: string, role_id: string): Promise<void> {
    return this.userAssignedRoleRepository.removeRole(user_id, role_id);
  }

  async getRolesByUserId(user_id: string): Promise<UserAssignedRoleResponse[]> {
    return this.userAssignedRoleRepository.findByUserId(user_id);
  }
}
