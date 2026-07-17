import mongoose from "mongoose";
import type { BedHistoryRepository } from "../../domain/repositories/bed-history.repository.interface.js";
import type { BedHistoryResponse, BedHistoryFilter, PaginatedBedHistoryResponse } from "../../domain/types/bed-history.types.js";
import BedHistory, { type IBedHistory } from "./models/bed-history.model.js";

export class MongoBedHistoryRepository implements BedHistoryRepository {
  async create(data: any): Promise<IBedHistory> {
    const history = new BedHistory(data);
    return history.save();
  }

  async findAll(
    page: number,
    limit: number,
    filters?: BedHistoryFilter
  ): Promise<PaginatedBedHistoryResponse> {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters?.camp_id && mongoose.Types.ObjectId.isValid(filters.camp_id)) {
      query.camp_id = new mongoose.Types.ObjectId(filters.camp_id);
    }
    if (filters?.zone_id && mongoose.Types.ObjectId.isValid(filters.zone_id)) {
      query.zone_id = new mongoose.Types.ObjectId(filters.zone_id);
    }
    if (filters?.building_id && mongoose.Types.ObjectId.isValid(filters.building_id)) {
      query.building_id = new mongoose.Types.ObjectId(filters.building_id);
    }
    if (filters?.room_id && mongoose.Types.ObjectId.isValid(filters.room_id)) {
      query.room_id = new mongoose.Types.ObjectId(filters.room_id);
    }
    if (filters?.tenant_id && mongoose.Types.ObjectId.isValid(filters.tenant_id)) {
      query.tenant_id = new mongoose.Types.ObjectId(filters.tenant_id);
    }

    if (filters?.assigned_at) {
      const searchDate = new Date(filters.assigned_at);
      const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));
      query.assigned_at = { $gte: startOfDay, $lte: endOfDay };
    }

    if (filters?.unassigned_at) {
      const searchDate = new Date(filters.unassigned_at);
      const startOfDay = new Date(searchDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(searchDate.setHours(23, 59, 59, 999));
      query.unassigned_at = { $gte: startOfDay, $lte: endOfDay };
    }

    // Scope to coordinator's assigned camps/zones from JWT token
    const hasAssignedCamps = filters?.assigned_camps && filters.assigned_camps.length > 0;
    const hasAssignedZones = filters?.assigned_zones && filters.assigned_zones.length > 0;
    if (hasAssignedCamps || hasAssignedZones) {
      const orConditions: any[] = [];
      if (hasAssignedCamps) {
        orConditions.push({ camp_id: { $in: filters!.assigned_camps!.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      if (hasAssignedZones) {
        orConditions.push({ zone_id: { $in: filters!.assigned_zones!.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      query.$or = orConditions;
    }

    const pipeline: any[] = [
      { $match: query },
      { $sort: { assigned_at: -1 } },
      {
        $group: {
          _id: "$tenant_id",
          doc: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$doc" } },
      { $sort: { assigned_at: -1 } }
    ];

    const [countResult, aggregatedItems] = await Promise.all([
      BedHistory.aggregate([...pipeline, { $count: "total" }]),
      BedHistory.aggregate([...pipeline, { $skip: skip }, { $limit: limit }])
    ]);

    const total = countResult[0]?.total || 0;

    const items = await BedHistory.populate(aggregatedItems, [
      { path: "tenant_id" },
      { path: "bed_id" },
      { path: "room_id" },
      { path: "building_id" },
      { path: "zone_id" },
      { path: "camp_id" }
    ]);

    const formattedItems: BedHistoryResponse[] = items.map((item: any) => ({
      id: item._id.toString(),
      tenant_id: item.tenant_id,
      bed_id: item.bed_id,
      room_id: item.room_id,
      building_id: item.building_id,
      zone_id: item.zone_id,
      camp_id: item.camp_id,
      assigned_at: item.assigned_at,
      unassigned_at: item.unassigned_at,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return {
      items: formattedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByTenantId(tenantId: string): Promise<BedHistoryResponse[]> {
    const query: any = { tenant_id: new mongoose.Types.ObjectId(tenantId) };
    const items = await BedHistory.find(query)
      .populate("tenant_id")
      .populate("bed_id")
      .populate("room_id")
      .populate("building_id")
      .populate("zone_id")
      .populate("camp_id")
      .sort({ assigned_at: -1 })
      .lean();

    return items.map((item: any) => ({
      id: item._id.toString(),
      tenant_id: item.tenant_id,
      bed_id: item.bed_id,
      room_id: item.room_id,
      building_id: item.building_id,
      zone_id: item.zone_id,
      camp_id: item.camp_id,
      assigned_at: item.assigned_at,
      unassigned_at: item.unassigned_at,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  async closeHistory(tenantId: string, bedId: string, unassignedAt: Date): Promise<void> {
    const query: any = {
      tenant_id: new mongoose.Types.ObjectId(tenantId),
      bed_id: new mongoose.Types.ObjectId(bedId),
      unassigned_at: null,
    };

    await BedHistory.findOneAndUpdate(
      query,
      {
        unassigned_at: unassignedAt,
      },
      { sort: { assigned_at: -1 } }
    );
  }
}
