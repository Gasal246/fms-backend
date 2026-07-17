import { CoordinatorUseCase } from "../../application/use-cases/coordinator.usecase.js";
import { MongoCoordinatorRepository } from "../../infrastructure/persistence/mongo-coordinator.repository.js";
import { BcryptHasher } from "../../infrastructure/persistence/security/bcrypt.hasher.js";
import { CoordinatorController } from "../../presentation/controllers/coordinator.controller.js";

export const createCoordinatorController = () => {
  const repository = new MongoCoordinatorRepository();
  const passwordService = new BcryptHasher();
  const useCase = new CoordinatorUseCase(repository, passwordService);
  return new CoordinatorController(useCase);
};
