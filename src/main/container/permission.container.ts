import { PermissionController } from "../../presentation/controllers/permission.controller.js";
import { PermissionUseCase } from "../../application/use-cases/permission.usecase.js";
import { MongoPermissionRepository } from "../../infrastructure/persistence/mongo-permission.repository.js";

export function createPermissionController() {
  const permissionRepository = new MongoPermissionRepository();
  const permissionUseCase = new PermissionUseCase(permissionRepository);
  const permissionController = new PermissionController(permissionUseCase);

  return permissionController;
}
