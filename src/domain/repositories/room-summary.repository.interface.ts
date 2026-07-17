export interface RoomSummaryRepository {
  create(data: any): Promise<any>;
  findByRoomId(roomId: string): Promise<any>;
  updateByRoomId(roomId: string, data: any): Promise<any>;
  deleteByRoomId(roomId: string): Promise<void>;
}

export interface RoomSummaryService {
  getSummary(roomId: string): Promise<any>;
  syncSummary(roomId: string): Promise<any>;
}
