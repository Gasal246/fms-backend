import type { RoleResponse } from "../types/role.types.js";

export interface RoleRepository {
  findAll(): Promise<RoleResponse[]>;
}

export interface RoleService {
  getAllRoles(): Promise<RoleResponse[]>;
}
