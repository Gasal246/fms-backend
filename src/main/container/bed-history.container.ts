import { BedHistoryController } from "../../presentation/controllers/bed-history.controller.js";
import { BedHistoryUseCase } from "../../application/use-cases/bed-history.usecase.js";
import { MongoBedHistoryRepository } from "../../infrastructure/persistence/mongo-bed-history.repository.js";

export function createBedHistoryController() {
  const bedHistoryRepository = new MongoBedHistoryRepository();
  const bedHistoryUseCase = new BedHistoryUseCase(bedHistoryRepository);
  const bedHistoryController = new BedHistoryController(bedHistoryUseCase);
  
  return bedHistoryController;
}
