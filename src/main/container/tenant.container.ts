import { TenantController } from "../../presentation/controllers/tenant.controller.js";
import { RegisterTenantUseCase } from "../../application/use-cases/tenant.usecase.js";
import { MongoTenantRepository } from "../../infrastructure/persistence/mongo-tenant.repository.js";
import { BcryptHasher } from "../../infrastructure/persistence/security/bcrypt.hasher.js";

export function createTenantController() {
    const tenantRepository = new MongoTenantRepository();
    const passwordService = new BcryptHasher();

    const tenantUseCase = new RegisterTenantUseCase(tenantRepository, passwordService);
    const tenantController = new TenantController(tenantUseCase);

    return tenantController;
}
