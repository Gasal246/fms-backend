import type { RoomRepository, RoomService } from "../../domain/repositories/room.repository.interface.js";
import type { CreateRoomRequest, UpdateRoomRequest, PaginatedRoomResponse, RoomFilter } from "../../domain/types/room.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export class RoomUseCase implements RoomService {
  constructor(private roomRepository: RoomRepository) {
    this.roomRepository = roomRepository;
  }

  async createRoom(data: CreateRoomRequest): Promise<any> {
    try {
      const room = await this.roomRepository.create(data);
      return room;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new AppError("Room number already exists", 400);
      }
      throw new AppError(error.message, error.statusCode || 500);
    }
  }

  async getRoom(id: string): Promise<any> {
    const room = await this.roomRepository.findById(id);
    if (!room) {
      throw new AppError("Room not found", 404);
    }
    return room;
  }

  async getAllRooms(pageNum: number, limitNum: number, filters?: RoomFilter, client_id?: string): Promise<PaginatedRoomResponse> {
    const page = pageNum > 0 ? pageNum : 1;
    const limit = limitNum > 0 ? limitNum : 10;
    return this.roomRepository.findAll(page, limit, filters, client_id);
  }

  async updateRoom(id: string, data: UpdateRoomRequest): Promise<any> {
    const room = await this.roomRepository.update(id, data);
    if (!room) {
      throw new AppError("Room not found", 404);
    }
    return room;
  }

  async deleteRoom(id: string): Promise<void> {
    const room = await this.roomRepository.findById(id);
    if (!room) {
      throw new AppError("Room not found", 404);
    }
    await this.roomRepository.delete(id);
  }
}
