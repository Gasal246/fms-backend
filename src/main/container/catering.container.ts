import { MongoCateringRepository } from "../../infrastructure/persistence/mongo-catering.repository.js";
import { CateringUseCase } from "../../application/use-cases/catering.usecase.js";
import { CateringController } from "../../presentation/controllers/catering.controller.js";
import { BcryptHasher } from "../../infrastructure/persistence/security/bcrypt.hasher.js";

export const createCateringController = () => new CateringController(new CateringUseCase(new MongoCateringRepository(), new BcryptHasher()));

