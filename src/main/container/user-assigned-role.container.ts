import { MongoUserAssignedRoleRepository } from "../../infrastructure/persistence/mongo-user-assigned-role.repository.js";
import { UserAssignedRoleUseCase } from "../../application/use-cases/user-assigned-role.usecase.js";
import { UserAssignedRoleController } from "../../presentation/controllers/user-assigned-role.controller.js";

const userAssignedRoleRepository = new MongoUserAssignedRoleRepository();
const userAssignedRoleUseCase = new UserAssignedRoleUseCase(userAssignedRoleRepository);
export const userAssignedRoleController = new UserAssignedRoleController(userAssignedRoleUseCase);
