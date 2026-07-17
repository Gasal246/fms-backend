import type { CreateRoomRequest, UpdateRoomRequest, RoomResponse, PaginatedRoomResponse, RoomFilter } from "../types/room.types.js";

export interface RoomRepository {
  create(data: CreateRoomRequest): Promise<any>;
  findById(id: string): Promise<any>;
  findByRoomNumber(room_number: string): Promise<any>;
  findAll(page: number, limit: number, filters?: RoomFilter, client_id?: string): Promise<PaginatedRoomResponse>;
  update(id: string, data: UpdateRoomRequest): Promise<any>;
  delete(id: string): Promise<void>;
  incrementAvailableSpace(id: string): Promise<void>;
  decrementAvailableSpace(id: string): Promise<void>;
}

export interface RoomService {
  createRoom(data: CreateRoomRequest): Promise<any>;
  getRoom(id: string): Promise<any>;
  getAllRooms(page: number, limit: number, filters?: RoomFilter, client_id?: string): Promise<PaginatedRoomResponse>;
  updateRoom(id: string, data: UpdateRoomRequest): Promise<any>;
  deleteRoom(id: string): Promise<void>;
}
