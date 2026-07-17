import { MongoZoneAssignCoordinatorRepository } from "../../infrastructure/persistence/mongo-zone-assign-coordinator.repository.js";
import { ZoneAssignCoordinatorUseCase } from "../../application/use-cases/zone-assign-coordinator.usecase.js";
import { ZoneAssignCoordinatorController } from "../../presentation/controllers/zone-assign-coordinator.controller.js";

export const createZoneAssignCoordinatorController = () => {
  const repository = new MongoZoneAssignCoordinatorRepository();
  const useCase = new ZoneAssignCoordinatorUseCase(repository);
  return new ZoneAssignCoordinatorController(useCase);
};
