import mongoose from "mongoose";
import type { CounterRepository } from "../../domain/repositories/counter.repository.interface.js";
import type {
  CreateCounterRequest,
  UpdateCounterRequest,
  CounterResponse,
  PaginatedCounterResponse,
  CounterFilter
} from "../../domain/types/counter.types.js";
import Counter from "./models/counter.model.js";
import Camp from "./models/camp.model.js";
import CampZones from "./models/zone.model.js";
import CounterPoint from "./models/counter-point.model.js";
import Machine from "./models/machine.model.js";
import { AppError } from "../../shared/utils/AppError.js";

export class MongoCounterRepository implements CounterRepository {
  
  async generateCounterNumber(clientId: string): Promise<string> {
    // Find the latest counter number sequence for this client (including deleted/inactive counters to ensure unique sequences)
    const lastCounter = await Counter.findOne({ client_id: new mongoose.Types.ObjectId(clientId) })
      .sort({ counter_no: -1 })
      .select("counter_no")
      .lean();

    let nextNum = 1;
    if (lastCounter && lastCounter.counter_no) {
      const match = lastCounter.counter_no.match(/COUNTER-(\d+)/);
      if (match && match[1]) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `COUNTER-${String(nextNum).padStart(4, "0")}`;
  }

  async validateCampAndZone(campId: string, zoneId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(campId)) {
      throw new AppError("Invalid Camp ID", 400);
    }
    if (!mongoose.Types.ObjectId.isValid(zoneId)) {
      throw new AppError("Invalid Zone ID", 400);
    }

    const [campExists, zone] = await Promise.all([
      Camp.exists({ _id: campId, status: { $ne: 0 } }),
      CampZones.findOne({ _id: zoneId, status: { $ne: 0 } }).lean()
    ]);

    if (!campExists) {
      throw new AppError("Invalid Camp", 400);
    }
    if (!zone) {
      throw new AppError("Invalid Zone", 400);
    }

    if (zone.camp_id?.toString() !== campId) {
      throw new AppError("Zone not belonging to Camp", 400);
    }
  }

  async validateUniqueCounterName(clientId: string, counterName: string, excludeId?: string): Promise<void> {
    const query: any = {
      client_id: new mongoose.Types.ObjectId(clientId),
      counter_name: { $regex: `^${counterName.trim()}$`, $options: "i" },
      status: { $ne: "Deleted" }
    };

    if (excludeId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const exists = await Counter.exists(query);
    if (exists) {
      throw new AppError("Duplicate Counter Name", 400);
    }
  }

  async create(data: CreateCounterRequest): Promise<any> {
    await this.validateCampAndZone(data.camp_id, data.zone_id);
    await this.validateUniqueCounterName(data.client_id, data.counter_name);

    const counterNo = await this.generateCounterNumber(data.client_id);

    const counter = new Counter({
      client_id: new mongoose.Types.ObjectId(data.client_id),
      camp_id: new mongoose.Types.ObjectId(data.camp_id),
      zone_id: new mongoose.Types.ObjectId(data.zone_id),
      counter_no: counterNo,
      counter_name: data.counter_name,
      description: data.description,
      status: data.status || "Active",
      created_by: new mongoose.Types.ObjectId(data.created_by)
    });

    const saved = await counter.save();
    return this.findById(saved._id.toString());
  }

  async findById(id: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Counter ID", 400);
    }

    const counter = await Counter.findById(id)
      .populate("camp_id")
      .populate("zone_id")
      .lean();

    if (!counter) {
      return null;
    }

    const [activePoints, totalPoints, deletedPoints, totalMch, activeMch, inactiveMch] = await Promise.all([
      CounterPoint.countDocuments({ counter_id: counter._id, status: "active" }),
      CounterPoint.countDocuments({ counter_id: counter._id, status: { $ne: "deleted" } }),
      CounterPoint.countDocuments({ counter_id: counter._id, status: "deleted" }),
      Machine.countDocuments({ counter_id: counter._id, status: { $ne: "deleted" } }),
      Machine.countDocuments({ counter_id: counter._id, status: "active" }),
      Machine.countDocuments({ counter_id: counter._id, status: "inactive" })
    ]);

    // Map DB doc to detail response format
    return {
      id: counter._id.toString(),
      client_id: counter.client_id.toString(),
      camp: counter.camp_id ? { id: (counter.camp_id as any)._id.toString(), camp_name: (counter.camp_id as any).camp_name } : null,
      zone: counter.zone_id ? { id: (counter.zone_id as any)._id.toString(), zone_name: (counter.zone_id as any).zone_name } : null,
      counter_no: counter.counter_no,
      counter_name: counter.counter_name,
      description: counter.description,
      status: counter.status,
      created_by: counter.created_by.toString(),
      updated_by: counter.updated_by ? counter.updated_by.toString() : null,
      counter_points: totalPoints,
      counterPointsCount: activePoints,
      deletedCounterPointsCount: deletedPoints,
      total_counter_points: totalPoints,
      total_machines: totalMch,
      active_machines: activeMch,
      inactive_machines: inactiveMch,
      machines: totalMch,
      machineCount: totalMch,
      machine_count: totalMch,
      createdAt: counter.createdAt,
      updatedAt: counter.updatedAt
    };
  }

  async findAll(
    page: number,
    limit: number,
    filters: CounterFilter,
    client_id: string
  ): Promise<PaginatedCounterResponse> {
    const skip = (page - 1) * limit;

    const query: any = {
      client_id: new mongoose.Types.ObjectId(client_id),
      status: { $ne: "Deleted" }
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

    if (filters.search && filters.search.trim() !== '') {
      const searchRegex = { $regex: filters.search.trim(), $options: 'i' };
      query.$or = [
        { counter_name: searchRegex },
        { counter_no: searchRegex },
        { description: searchRegex }
      ];
    }

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
      Counter.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("camp_id", "camp_name")
        .populate("zone_id", "zone_name")
        .lean(),
      Counter.countDocuments(query)
    ]);

    const counterIds = items.map((c: any) => c._id);

    const [activeCounts, totalCounts, deletedCounts, machineCounts] = await Promise.all([
      CounterPoint.aggregate([
        { $match: { counter_id: { $in: counterIds }, status: "active" } },
        { $group: { _id: "$counter_id", count: { $sum: 1 } } }
      ]),
      CounterPoint.aggregate([
        { $match: { counter_id: { $in: counterIds }, status: { $ne: "deleted" } } },
        { $group: { _id: "$counter_id", count: { $sum: 1 } } }
      ]),
      CounterPoint.aggregate([
        { $match: { counter_id: { $in: counterIds }, status: "deleted" } },
        { $group: { _id: "$counter_id", count: { $sum: 1 } } }
      ]),
      Machine.aggregate([
        { $match: { counter_id: { $in: counterIds }, status: { $ne: "deleted" } } },
        { $group: { _id: "$counter_id", count: { $sum: 1 } } }
      ])
    ]);

    const activeMap = new Map(activeCounts.map(c => [c._id.toString(), c.count]));
    const totalMap = new Map(totalCounts.map(c => [c._id.toString(), c.count]));
    const deletedMap = new Map(deletedCounts.map(c => [c._id.toString(), c.count]));
    const machineMap = new Map(machineCounts.map(m => [m._id.toString(), m.count]));

    const mappedItems: CounterResponse[] = items.map((counter: any) => {
      const cId = counter._id.toString();
      const mchCount = machineMap.get(cId) || 0;
      return {
        id: cId,
        client_id: counter.client_id.toString(),
        camp_id: counter.camp_id ? { id: counter.camp_id._id.toString(), camp_name: counter.camp_id.camp_name } : null,
        zone_id: counter.zone_id ? { id: counter.zone_id._id.toString(), zone_name: counter.zone_id.zone_name } : null,
        counter_no: counter.counter_no,
        counter_name: counter.counter_name,
        description: counter.description,
        status: counter.status,
        created_by: counter.created_by.toString(),
        updated_by: counter.updated_by ? counter.updated_by.toString() : null,
        counterPointsCount: activeMap.get(cId) || 0,
        counter_points: totalMap.get(cId) || 0,
        deletedCounterPointsCount: deletedMap.get(cId) || 0,
        machineCount: mchCount,
        machine_count: mchCount,
        machines: mchCount,
        createdAt: counter.createdAt,
        updatedAt: counter.updatedAt
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

  async update(id: string, data: UpdateCounterRequest): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Counter ID", 400);
    }

    const counterObj = await Counter.findById(id);
    if (!counterObj) {
      throw new AppError("Counter not found", 404);
    }

    if (counterObj.status === "Deleted") {
      throw new AppError("Counter already deleted", 400);
    }

    const clientId = counterObj.client_id.toString();

    const targetCamp = (data.camp_id || counterObj.camp_id.toString()) as string;
    const targetZone = (data.zone_id || counterObj.zone_id.toString()) as string;
    if (data.camp_id || data.zone_id) {
      await this.validateCampAndZone(targetCamp, targetZone);
    }

    // Validate duplicate name if changed
    if (data.counter_name && data.counter_name.trim() !== counterObj.counter_name) {
      await this.validateUniqueCounterName(clientId, data.counter_name, id);
    }

    if (data.counter_name) counterObj.counter_name = data.counter_name;
    if (data.description !== undefined) counterObj.description = data.description;
    if (data.camp_id) counterObj.camp_id = new mongoose.Types.ObjectId(data.camp_id);
    if (data.zone_id) counterObj.zone_id = new mongoose.Types.ObjectId(data.zone_id);
    if (data.status) counterObj.status = data.status;
    counterObj.updated_by = new mongoose.Types.ObjectId(data.updated_by);

    await counterObj.save();

    return this.findById(id);
  }

  async delete(id: string, userId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Counter ID", 400);
    }

    const counterObj = await Counter.findById(id);
    if (!counterObj) {
      throw new AppError("Counter not found", 404);
    }

    if (counterObj.status === "Deleted") {
      throw new AppError("Counter already deleted", 400);
    }

    const machineExists = await Machine.exists({ counter_id: id, status: { $ne: "deleted" } });
    if (machineExists) {
      throw new AppError("Cannot delete Counter because active or inactive machines are registered under it", 400);
    }

    counterObj.status = "Deleted";
    counterObj.updated_by = new mongoose.Types.ObjectId(userId);
    await counterObj.save();
  }

  async updateStatus(id: string, status: "Active" | "Inactive", userId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Counter ID", 400);
    }

    const counterObj = await Counter.findById(id);
    if (!counterObj) {
      throw new AppError("Counter not found", 404);
    }

    if (counterObj.status === "Deleted") {
      throw new AppError("Counter already deleted", 400);
    }

    counterObj.status = status;
    counterObj.updated_by = new mongoose.Types.ObjectId(userId);
    await counterObj.save();

    return this.findById(id);
  }
}
