import { RoomController } from "../../presentation/controllers/room.controller.js";
import { RoomUseCase } from "../../application/use-cases/room.usecase.js";
import { MongoRoomRepository } from "../../infrastructure/persistence/mongo-room.repository.js";

export function createRoomController() {
  const roomRepository = new MongoRoomRepository();
  const roomUseCase = new RoomUseCase(roomRepository);
  const roomController = new RoomController(roomUseCase);
  
  return roomController;
}
