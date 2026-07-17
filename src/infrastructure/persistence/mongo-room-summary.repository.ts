import mongoose from "mongoose";
import type { RoomSummaryRepository } from "../../domain/repositories/room-summary.repository.interface.js";
import RoomSummary from "./models/room-summary.model.js";

export class MongoRoomSummaryRepository implements RoomSummaryRepository {
  async create(data: any): Promise<any> {
    const summary = new RoomSummary(data);
    return summary.save();
  }

  async findByRoomId(roomId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      throw new Error("Invalid room ID");
    }
    return RoomSummary.findOne({ room_id: new mongoose.Types.ObjectId(roomId) });
  }

  async updateByRoomId(roomId: string, data: any): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      throw new Error("Invalid room ID");
    }
    return RoomSummary.findOneAndUpdate(
      { room_id: new mongoose.Types.ObjectId(roomId) },
      data,
      { returnDocument: "after", upsert: true }
    );
  }

  async deleteByRoomId(roomId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      throw new Error("Invalid room ID");
    }
    await RoomSummary.deleteOne({ room_id: new mongoose.Types.ObjectId(roomId) });
  }
}
