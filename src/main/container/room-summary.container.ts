import { RoomSummaryController } from "../../presentation/controllers/room-summary.controller.js";
import { RoomSummaryUseCase } from "../../application/use-cases/room-summary.usecase.js";
import { MongoRoomSummaryRepository } from "../../infrastructure/persistence/mongo-room-summary.repository.js";

export function createRoomSummaryController() {
  const repository = new MongoRoomSummaryRepository();
  const useCase = new RoomSummaryUseCase(repository);
  const controller = new RoomSummaryController(useCase);
  
  return controller;
}
