import { MongoCampAssignCoordinatorRepository } from "../../infrastructure/persistence/mongo-camp-assign-coordinator.repository.js";
import { CampAssignCoordinatorUseCase } from "../../application/use-cases/camp-assign-coordinator.usecase.js";
import { CampAssignCoordinatorController } from "../../presentation/controllers/camp-assign-coordinator.controller.js";

export const createCampAssignCoordinatorController = () => {
  const repository = new MongoCampAssignCoordinatorRepository();
  const useCase = new CampAssignCoordinatorUseCase(repository);
  return new CampAssignCoordinatorController(useCase);
};
