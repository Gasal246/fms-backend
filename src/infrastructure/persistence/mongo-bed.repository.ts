import mongoose from "mongoose";
import type { BedRepository } from "../../domain/repositories/bed.repository.interface.js";
import type { CreateBedRequest, UpdateBedRequest, BedResponse, PaginatedBedResponse, BedFilter } from "../../domain/types/bed.types.js";
import Bed, { type IBed } from "./models/bed.model.js";
import Room from "./models/room.model.js";
import { logger } from "../../shared/logger/logger.js";

export class MongoBedRepository implements BedRepository {
  async create(data: CreateBedRequest): Promise<IBed> {
    const bed = new Bed(data);
    return bed.save();
  }

  async findById(id: string): Promise<IBed | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid bed ID");
    }
    return Bed.findOne({ _id: id, deleted_at: null }).populate("room_id").populate("tenant_id");
  }

  async findAll(
    page: number,
    limit: number,
    filters?: BedFilter,
    client_id?: string
  ): Promise<PaginatedBedResponse> {
    const skip = (page - 1) * limit;
    const query: any = { deleted_at: null };

    if (filters?.room_id && mongoose.Types.ObjectId.isValid(filters.room_id)) {
      query.room_id = new mongoose.Types.ObjectId(filters.room_id.toString());
    }

    if (filters?.bed_number) {
      query.bed_number = { $regex: filters.bed_number, $options: "i" };
    }

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.tenant_id !== undefined) {
      query.tenant_id = filters.tenant_id === null ? null : new mongoose.Types.ObjectId(filters.tenant_id.toString());
    }

    if ((filters?.assigned_camps && filters.assigned_camps.length > 0) || (filters?.assigned_zones && filters.assigned_zones.length > 0)) {
      const roomMatchQuery: any = {};
      const orConditions: any[] = [];
      if (filters?.assigned_camps && filters.assigned_camps.length > 0) {
        orConditions.push({ camp_id: { $in: filters.assigned_camps.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      if (filters?.assigned_zones && filters.assigned_zones.length > 0) {
        orConditions.push({ zone_id: { $in: filters.assigned_zones.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      roomMatchQuery.$or = orConditions;

      const allowedRooms = await Room.find(roomMatchQuery).select("_id").lean();
      const allowedRoomIds = allowedRooms.map(r => r._id);

      if (query.room_id) {
        // If a specific room_id was requested, ensure it's in the allowed list
        const requestedRoomId = query.room_id.toString();
        if (!allowedRoomIds.some(id => id.toString() === requestedRoomId)) {
          // Force no results
          query.room_id = new mongoose.Types.ObjectId();
        }
      } else {
        query.room_id = { $in: allowedRoomIds };
      }
    }

    if (client_id) {
      // If client_id is provided, you might want to filter by it if your model supports it.
      // Assuming for now it's a field on the room or bed.
      // query.client_id = new mongoose.Types.ObjectId(client_id);
    }

    const [items, total] = await Promise.all([
      Bed.find(query)
        .populate("tenant_id")
        .populate("room_id")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Bed.countDocuments(query),
    ]);

    const formattedItems: BedResponse[] = items.map((item: any) => ({
      id: item._id.toString(),
      room_id: item.room_id,
      bed_number: item.bed_number,
      status: item.status,
      type: item.type || "SINGLE_BED",
      tenant_id: item.tenant_id,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      tenant_assigned_at: item.tenant_assigned_at,
    }));

    return {
      items: formattedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, data: UpdateBedRequest): Promise<IBed | null> {

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid bed ID");
    }
    return Bed.findOneAndUpdate({ _id: id, deleted_at: null }, data, { returnDocument: "after" }).populate("room_id").populate("tenant_id");
  }

  async delete(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid bed ID");
    }
    await Bed.findByIdAndUpdate(id, { deleted_at: new Date() });
  }
}
