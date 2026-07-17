import { MongoTenantImportRepository } from "../../infrastructure/persistence/mongo-tenant-import.repository.js";
import { TenantImportUseCase } from "../../application/use-cases/tenant-import.use-case.js";
import { TenantImportController } from "../../presentation/controllers/tenant-import.controller.js";

const importRepository = new MongoTenantImportRepository();
const importUseCase = new TenantImportUseCase(importRepository);
export const tenantImportController = new TenantImportController(importUseCase);
