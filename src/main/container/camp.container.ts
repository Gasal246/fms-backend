import { CampController } from "../../presentation/controllers/camp.controller.js";
import { CampUseCase } from "../../application/use-cases/camp.usecase.js";
import { MongoCampRepository } from "../../infrastructure/persistence/mongo-camp.repository.js";

export function createCampController() {
  const campRepository = new MongoCampRepository();
  const campUseCase = new CampUseCase(campRepository);
  const campController = new CampController(campUseCase);
  
  return campController;
}
