import { RoleController } from "../../presentation/controllers/role.controller.js";
import { RoleUseCase } from "../../application/use-cases/role.usecase.js";
import { MongoRoleRepository } from "../../infrastructure/persistence/mongo-role.repository.js";

export function createRoleController() {
  const roleRepository = new MongoRoleRepository();
  const roleUseCase = new RoleUseCase(roleRepository);
  const roleController = new RoleController(roleUseCase);

  return roleController;
}
