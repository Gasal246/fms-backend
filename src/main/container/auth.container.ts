import { AuthController } from "../../presentation/controllers/auth.controller.js";
import { AuthUseCase } from "../../application/use-cases/auth.usecase.js";

import { MongoAuthRepository } from "../../infrastructure/persistence/mongo-auth.repository.js";
import { MongoUserAssignedRoleRepository } from "../../infrastructure/persistence/mongo-user-assigned-role.repository.js";
import { MongoPermissionRepository } from "../../infrastructure/persistence/mongo-permission.repository.js";
import { BcryptHasher } from "../../infrastructure/persistence/security/bcrypt.hasher.js";
import { JwtService } from "../../infrastructure/persistence/security/jwt.service.js";
import { MongoZoneAssignCoordinatorRepository } from "../../infrastructure/persistence/mongo-zone-assign-coordinator.repository.js";
import { MongoCampAssignCoordinatorRepository } from "../../infrastructure/persistence/mongo-camp-assign-coordinator.repository.js";

export function createAuthController() {

    const authRepository = new MongoAuthRepository();
    const userAssignedRoleRepository = new MongoUserAssignedRoleRepository();
    const permissionRepository = new MongoPermissionRepository();
    const passwordService = new BcryptHasher();
    const tokenService = new JwtService();
    const zoneAssignCoordinatorRepository = new MongoZoneAssignCoordinatorRepository();
    const campAssignCoordinatorRepository = new MongoCampAssignCoordinatorRepository();

    const authUseCase = new AuthUseCase(
        authRepository,
        passwordService,
        tokenService,
        userAssignedRoleRepository,
        permissionRepository,
        zoneAssignCoordinatorRepository,
        campAssignCoordinatorRepository
    );

    const authController = new AuthController(authUseCase);

    return authController;
}