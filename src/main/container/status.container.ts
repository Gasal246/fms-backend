import { StatusController } from "../../presentation/controllers/status.controller.js";
import { StatusUseCase } from "../../application/use-cases/status.usecase.js";
import { MongoStatusRepository } from "../../infrastructure/persistence/mongo-status.repository.js";

export function createStatusController() {
  const statusRepository = new MongoStatusRepository();
  const statusUseCase = new StatusUseCase(statusRepository);
  const statusController = new StatusController(statusUseCase);
  
  return statusController;
}
