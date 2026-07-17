import type { RoleRepository, RoleService } from "../../domain/repositories/role.repository.interface.js";
import type { RoleResponse } from "../../domain/types/role.types.js";

export class RoleUseCase implements RoleService {
  constructor(private roleRepository: RoleRepository) {}

  async getAllRoles(): Promise<RoleResponse[]> {
    return this.roleRepository.findAll();
  }
}
