import mongoose from "mongoose";
import type { CounterPointRepository } from "../../domain/repositories/counter-point.repository.interface.js";
import type {
  CreateCounterPointRequest,
  UpdateCounterPointRequest,
  CounterPointResponse,
  PaginatedCounterPointResponse,
  CounterPointFilter
} from "../../domain/types/counter-point.types.js";
import CounterPoint from "./models/counter-point.model.js";
import Counter from "./models/counter.model.js";
import Camp from "./models/camp.model.js";
import CampZones from "./models/zone.model.js";
import Client from "./models/client.model.js";
import Machine from "./models/machine.model.js";
import { AppError } from "../../shared/utils/AppError.js";

export class MongoCounterPointRepository implements CounterPointRepository {
  
  async validateRelationships(
    clientId: string,
    campId: string,
    zoneId: string,
    counterId: string
  ): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      throw new AppError("Invalid Client ID", 400);
    }
    if (!mongoose.Types.ObjectId.isValid(campId)) {
      throw new AppError("Invalid Camp ID", 400);
    }
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      throw new AppError("Invalid Zone ID", 400);
    }
    if (!mongoose.Types.ObjectId.isValid(counterId)) {
      throw new AppError("Invalid Counter ID", 400);
    }

    const [clientExists, campExists, zone, counter] = await Promise.all([
      Client.exists({ _id: clientId, status: 1 }), // Active client
      Camp.exists({ _id: campId, status: { $ne: 0 } }), // Not deleted camp
      CampZones.findOne({ _id: zoneId, status: { $ne: 0 } }).lean(),
      Counter.findOne({ _id: counterId }).lean()
    ]);

    if (!clientExists) {
      throw new AppError("Client not found or inactive", 400);
    }
    if (!campExists) {
      throw new AppError("Camp not found or inactive", 400);
    }
    if (!zone) {
      throw new AppError("Zone not found or inactive", 400);
    }
    if (zone.camp_id && zone.camp_id.toString() !== campId) {
      throw new AppError("Zone does not belong to Camp", 400);
    }
    if (!counter) {
      throw new AppError("Counter not found", 400);
    }
    if (counter.status === "Deleted") {
      throw new AppError("Counter has been deleted", 400);
    }
    if (counter.status !== "Active") {
      throw new AppError("Counter is not active", 400);
    }
    if (counter.zone_id && counter.zone_id.toString() !== zoneId) {
      throw new AppError("Counter does not belong to Zone", 400);
    }
  }

  async validateUniquePointName(
    clientId: string,
    counterId: string,
    name: string,
    excludeId?: string
  ): Promise<void> {
    const query: any = {
      client_id: new mongoose.Types.ObjectId(clientId),
      counter_id: new mongoose.Types.ObjectId(counterId),
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      status: { $ne: "deleted" }
    };

    if (excludeId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const exists = await CounterPoint.exists(query);
    if (exists) {
      throw new AppError("Duplicate Counter Point Name in this Counter", 400);
    }
  }

  async generatePointNumber(clientId: string): Promise<string> {
    // Find the latest point number sequence for this client (including deleted/inactive counter points)
    const lastPoint = await CounterPoint.findOne({ client_id: new mongoose.Types.ObjectId(clientId) })
      .sort({ point_no: -1 })
      .select("point_no")
      .lean();

    let nextNum = 1;
    if (lastPoint && lastPoint.point_no) {
      const match = lastPoint.point_no.match(/POINT-(\d+)/);
      if (match && match[1]) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `POINT-${String(nextNum).padStart(6, "0")}`;
  }

  async create(data: CreateCounterPointRequest): Promise<CounterPointResponse> {
    await this.validateRelationships(data.client_id, data.camp_id, data.zone_id, data.counter_id);
    await this.validateUniquePointName(data.client_id, data.counter_id, data.name);

    const pointNo = await this.generatePointNumber(data.client_id);

    const counterPoint = new CounterPoint({
      client_id: new mongoose.Types.ObjectId(data.client_id),
      camp_id: new mongoose.Types.ObjectId(data.camp_id),
      zone_id: new mongoose.Types.ObjectId(data.zone_id),
      counter_id: new mongoose.Types.ObjectId(data.counter_id),
      point_no: pointNo,
      name: data.name,
      direction_label: data.direction_label,
      description: data.description,
      status: data.status || "active",
      created_by: new mongoose.Types.ObjectId(data.created_by)
    });

    const saved = await counterPoint.save();
    const result = await this.findById(saved._id.toString());
    if (!result) {
      throw new AppError("Failed to retrieve created Counter Point", 500);
    }
    return result;
  }

  async findById(id: string): Promise<CounterPointResponse | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Counter Point ID", 400);
    }

    const point = await CounterPoint.findById(id)
      .populate("camp_id")
      .populate("zone_id")
      .populate("counter_id")
      .lean();

    if (!point || point.status === "deleted") {
      return null;
    }

    const attached = await Machine.find({ counter_point_id: point._id, status: { $ne: "deleted" } })
      .select("machine_id machine_name machine_type binding_status status")
      .lean();

    return {
      id: point._id.toString(),
      client_id: point.client_id.toString(),
      camp_id: point.camp_id
        ? {
            id: (point.camp_id as any)._id.toString(),
            camp_name: (point.camp_id as any).camp_name
          }
        : null,
      zone_id: point.zone_id
        ? {
            id: (point.zone_id as any)._id.toString(),
            zone_name: (point.zone_id as any).zone_name
          }
        : null,
      counter_id: point.counter_id
        ? {
            id: (point.counter_id as any)._id.toString(),
            counter_name: (point.counter_id as any).counter_name
          }
        : null,
      point_no: point.point_no,
      name: point.name,
      direction_label: point.direction_label,
      description: point.description,
      status: point.status,
      created_by: point.created_by.toString(),
      updated_by: point.updated_by ? point.updated_by.toString() : null,
      machineCount: attached.length,
      machine_count: attached.length,
      attached_machines: attached.map((m: any) => ({
        machine_id: m.machine_id,
        machine_name: m.machine_name,
        machine_type: m.machine_type,
        binding_status: m.binding_status,
        status: m.status
      })),
      createdAt: point.createdAt,
      updatedAt: point.updatedAt
    };
  }

  async findAll(
    page: number,
    limit: number,
    filters: CounterPointFilter,
    client_id: string
  ): Promise<PaginatedCounterPointResponse> {
    const skip = (page - 1) * limit;

    const query: any = {
      client_id: new mongoose.Types.ObjectId(client_id),
      status: { $ne: "deleted" }
    };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.camp_id) {
      query.camp_id = new mongoose.Types.ObjectId(filters.camp_id);
    }

    if (filters.zone_id) {
      query.zone_id = new mongoose.Types.ObjectId(filters.zone_id);
    }

    if (filters.counter_id) {
      query.counter_id = new mongoose.Types.ObjectId(filters.counter_id);
    }

    if (filters.search && filters.search.trim() !== '') {
      const searchRegex = { $regex: filters.search.trim(), $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { point_no: searchRegex },
        { description: searchRegex }
      ];
    }

    // Access control lists (Assigned Camps / Assigned Zones)
    if ((filters.assigned_camps && filters.assigned_camps.length > 0) || (filters.assigned_zones && filters.assigned_zones.length > 0)) {
      const orConditions: any[] = [];
      if (filters.assigned_camps && filters.assigned_camps.length > 0) {
        orConditions.push({ camp_id: { $in: filters.assigned_camps.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      if (filters.assigned_zones && filters.assigned_zones.length > 0) {
        orConditions.push({ zone_id: { $in: filters.assigned_zones.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          { $or: orConditions }
        ];
        delete query.$or;
      } else {
        query.$or = orConditions;
      }
    }

    const sort: any = {};
    if (filters.sortField) {
      const field = filters.sortField;
      const order = filters.sortOrder === 'desc' || filters.sortOrder === -1 ? -1 : 1;
      sort[field] = order;
    } else {
      sort.createdAt = -1;
    }

    const [items, total] = await Promise.all([
      CounterPoint.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("camp_id", "camp_name")
        .populate("zone_id", "zone_name")
        .populate("counter_id", "counter_name")
        .lean(),
      CounterPoint.countDocuments(query)
    ]);

    const pointIds = items.map((p: any) => p._id);

    const machineCounts = await Machine.aggregate([
      { $match: { counter_point_id: { $in: pointIds }, status: { $ne: "deleted" } } },
      { $group: { _id: "$counter_point_id", count: { $sum: 1 } } }
    ]);

    const machineMap = new Map(machineCounts.map(m => [m._id.toString(), m.count]));

    const mappedItems: CounterPointResponse[] = items.map((point: any) => {
      const pId = point._id.toString();
      const mchCount = machineMap.get(pId) || 0;
      return {
        id: pId,
        client_id: point.client_id.toString(),
        camp_id: point.camp_id ? { id: point.camp_id._id.toString(), camp_name: point.camp_id.camp_name } : null,
        zone_id: point.zone_id ? { id: point.zone_id._id.toString(), zone_name: point.zone_id.zone_name } : null,
        counter_id: point.counter_id ? { id: point.counter_id._id.toString(), counter_name: point.counter_id.counter_name } : null,
        point_no: point.point_no,
        name: point.name,
        direction_label: point.direction_label,
        description: point.description,
        status: point.status,
        created_by: point.created_by.toString(),
        updated_by: point.updated_by ? point.updated_by.toString() : null,
        machineCount: mchCount,
        machine_count: mchCount,
        createdAt: point.createdAt,
        updatedAt: point.updatedAt
      };
    });

    return {
      items: mappedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async update(id: string, data: UpdateCounterPointRequest): Promise<CounterPointResponse> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Counter Point ID", 400);
    }

    const pointObj = await CounterPoint.findById(id);
    if (!pointObj || pointObj.status === "deleted") {
      throw new AppError("Counter Point not found", 404);
    }

    const targetClientId = pointObj.client_id.toString();
    const targetCamp = (data.camp_id || pointObj.camp_id.toString()) as string;
    const targetZone = (data.zone_id || pointObj.zone_id.toString()) as string;
    const targetCounter = (data.counter_id || pointObj.counter_id.toString()) as string;

    if (data.camp_id || data.zone_id || data.counter_id) {
      await this.validateRelationships(targetClientId, targetCamp, targetZone, targetCounter);
    }

    if (data.name && data.name.trim() !== pointObj.name) {
      await this.validateUniquePointName(targetClientId, targetCounter, data.name, id);
    }

    if (data.camp_id) pointObj.camp_id = new mongoose.Types.ObjectId(data.camp_id);
    if (data.zone_id) pointObj.zone_id = new mongoose.Types.ObjectId(data.zone_id);
    if (data.counter_id) pointObj.counter_id = new mongoose.Types.ObjectId(data.counter_id);
    if (data.name) pointObj.name = data.name;
    if (data.direction_label) pointObj.direction_label = data.direction_label;
    if (data.description !== undefined) pointObj.description = data.description;
    if (data.status) pointObj.status = data.status;
    pointObj.updated_by = new mongoose.Types.ObjectId(data.updated_by);

    await pointObj.save();

    const updated = await this.findById(id);
    if (!updated) {
      throw new AppError("Failed to retrieve updated Counter Point", 500);
    }
    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Counter Point ID", 400);
    }

    const pointObj = await CounterPoint.findById(id);
    if (!pointObj || pointObj.status === "deleted") {
      throw new AppError("Counter Point not found", 404);
    }

    // Enforce validation: Do not allow deleting when Machines are attached
    const machineExists = await Machine.exists({ counter_point_id: id, status: { $ne: "deleted" } });
    if (machineExists) {
      throw new AppError("Cannot delete Counter Point because machines are attached to it", 400);
    }

    pointObj.status = "deleted";
    pointObj.deleted_at = new Date();
    pointObj.updated_by = new mongoose.Types.ObjectId(userId);
    await pointObj.save();
  }

  async updateStatus(id: string, status: "active" | "inactive", userId: string): Promise<CounterPointResponse> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Counter Point ID", 400);
    }

    const pointObj = await CounterPoint.findById(id);
    if (!pointObj || pointObj.status === "deleted") {
      throw new AppError("Counter Point not found", 404);
    }

    pointObj.status = status;
    pointObj.updated_by = new mongoose.Types.ObjectId(userId);
    await pointObj.save();

    const updated = await this.findById(id);
    if (!updated) {
      throw new AppError("Failed to retrieve updated Counter Point", 500);
    }
    return updated;
  }
}
