import { TechnicianUseCase } from "../../application/use-cases/technician.usecase.js";
import { MongoTechnicianRepository } from "../../infrastructure/persistence/mongo-technician.repository.js";
import { BcryptHasher } from "../../infrastructure/persistence/security/bcrypt.hasher.js";
import { TechnicianController } from "../../presentation/controllers/technician.controller.js";

export const createTechnicianController = () => {
  const repository = new MongoTechnicianRepository();
  const passwordService = new BcryptHasher();
  const useCase = new TechnicianUseCase(repository, passwordService);
  return new TechnicianController(useCase);
};
