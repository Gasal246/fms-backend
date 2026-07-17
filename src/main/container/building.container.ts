import { BuildingController } from "../../presentation/controllers/building.controller.js";
import { BuildingUseCase } from "../../application/use-cases/building.usecase.js";
import { MongoBuildingRepository } from "../../infrastructure/persistence/mongo-building.repository.js";

export function createBuildingController() {
  const buildingRepository = new MongoBuildingRepository();
  const buildingUseCase = new BuildingUseCase(buildingRepository);
  const buildingController = new BuildingController(buildingUseCase);
  
  return buildingController;
}
