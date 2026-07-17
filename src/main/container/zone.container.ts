import { ZoneController } from "../../presentation/controllers/zone.controller.js";
import { ZoneUseCase } from "../../application/use-cases/zone.usecase.js";
import { MongoZoneRepository } from "../../infrastructure/persistence/mongo-zone.repository.js";

export function createZoneController() {
  const zoneRepository = new MongoZoneRepository();
  const zoneUseCase = new ZoneUseCase(zoneRepository);
  const zoneController = new ZoneController(zoneUseCase);
  
  return zoneController;
}
