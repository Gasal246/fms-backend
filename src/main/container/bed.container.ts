import { BedController } from "../../presentation/controllers/bed.controller.js";
import { BedUseCase } from "../../application/use-cases/bed.usecase.js";
import { MongoBedRepository } from "../../infrastructure/persistence/mongo-bed.repository.js";
import { MongoBedHistoryRepository } from "../../infrastructure/persistence/mongo-bed-history.repository.js";
import { MongoRoomRepository } from "../../infrastructure/persistence/mongo-room.repository.js";
import { MongoTenantRepository } from "../../infrastructure/persistence/mongo-tenant.repository.js";

export function createBedController() {
  const bedRepository = new MongoBedRepository();
  const bedHistoryRepository = new MongoBedHistoryRepository();
  const roomRepository = new MongoRoomRepository();
  const tenantRepository = new MongoTenantRepository();
  
  const bedUseCase = new BedUseCase(bedRepository, bedHistoryRepository, roomRepository, tenantRepository);
  const bedController = new BedController(bedUseCase);
  
  return bedController;
}
