import mongoose from "mongoose";
import type { MachineRepository } from "../../domain/repositories/machine.repository.interface.js";
import type {
  CreateMachineRequest,
  UpdateMachineRequest,
  MachineResponse,
  PaginatedMachineResponse,
  MachineFilter
} from "../../domain/types/machine.types.js";
import Machine from "./models/machine.model.js";
import CounterPoint from "./models/counter-point.model.js";
import Counter from "./models/counter.model.js";
import Camp from "./models/camp.model.js";
import CampZones from "./models/zone.model.js";
import Client from "./models/client.model.js";
import { AppError } from "../../shared/utils/AppError.js";

export class MongoMachineRepository implements MachineRepository {

  async generateMachineId(clientId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `MCH-${currentYear}-`;

    const lastMachine = await Machine.findOne({
      client_id: new mongoose.Types.ObjectId(clientId),
      machine_id: { $regex: `^${prefix}` }
    })
      .sort({ machine_id: -1 })
      .select("machine_id")
      .lean();

    let nextNum = 1;
    if (lastMachine && lastMachine.machine_id) {
      const match = lastMachine.machine_id.match(new RegExp(`MCH-${currentYear}-(\\d+)`));
      if (match && match[1]) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `${prefix}${String(nextNum).padStart(6, "0")}`;
  }

  async validateRelationships(
    clientId: string,
    campId: string,
    zoneId: string,
    counterId: string,
    pointId: string
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
    if (!mongoose.Types.ObjectId.isValid(pointId)) {
      throw new AppError("Invalid Counter Point ID", 400);
    }

    const [clientExists, camp, zone, counter, point] = await Promise.all([
      Client.exists({ _id: clientId, status: 1 }),
      Camp.findById(campId).lean(),
      CampZones.findById(zoneId).lean(),
      Counter.findById(counterId).lean(),
      CounterPoint.findById(pointId).lean()
    ]);

    if (!clientExists) {
      throw new AppError("Client not found or inactive", 400);
    }
    if (!camp) {
      throw new AppError("Camp not found", 400);
    }
    if (camp.status !== 1) {
      throw new AppError("Camp is not Active", 400);
    }
    if (!zone) {
      throw new AppError("Zone not found", 400);
    }
    if (zone.status !== 1) {
      throw new AppError("Zone is not Active", 400);
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
      throw new AppError("Counter is not Active", 400);
    }
    if (counter.zone_id && counter.zone_id.toString() !== zoneId) {
      throw new AppError("Counter does not belong to Zone", 400);
    }
    if (!point) {
      throw new AppError("Counter Point not found", 400);
    }
    if (point.status === "deleted") {
      throw new AppError("Counter Point has been deleted", 400);
    }
    if (point.status !== "active") {
      throw new AppError("Counter Point is not Active", 400);
    }
    if (point.counter_id && point.counter_id.toString() !== counterId) {
      throw new AppError("Counter Point does not belong to Counter", 400);
    }
  }

  async validateSerialNumber(
    clientId: string,
    serialNumber?: string,
    excludeId?: string
  ): Promise<void> {
    if (!serialNumber || serialNumber.trim() === "") {
      return;
    }
    const query: any = {
      client_id: new mongoose.Types.ObjectId(clientId),
      serial_number: serialNumber.trim(),
      status: { $ne: "deleted" }
    };

    if (excludeId) {
      query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const exists = await Machine.exists(query);
    if (exists) {
      throw new AppError("Serial Number must be unique", 400);
    }
  }

  async create(data: CreateMachineRequest): Promise<MachineResponse> {
    await this.validateRelationships(
      data.client_id,
      data.camp_id,
      data.zone_id,
      data.counter_id,
      data.counter_point_id
    );
    await this.validateSerialNumber(data.client_id, data.serial_number);

    const mchId = await this.generateMachineId(data.client_id);

    const machine = new Machine({
      client_id: new mongoose.Types.ObjectId(data.client_id),
      machine_id: mchId,
      machine_name: data.machine_name.trim(),
      machine_type: data.machine_type.trim(),
      manufacturer: data.manufacturer ? data.manufacturer.trim() : "",
      model: data.model ? data.model.trim() : "",
      serial_number: data.serial_number ? data.serial_number.trim() : "",
      description: data.description ? data.description.trim() : "",
      mac_id: data.mac_id || null,
      binding_status: data.binding_status || "pending",
      assigned_status: data.assigned_status || "unallocated",
      camp_id: new mongoose.Types.ObjectId(data.camp_id),
      zone_id: new mongoose.Types.ObjectId(data.zone_id),
      counter_id: new mongoose.Types.ObjectId(data.counter_id),
      counter_point_id: new mongoose.Types.ObjectId(data.counter_point_id),
      assigned_action: data.assigned_action || null,
      last_ping_at: null,
      status: data.status || "active",
      created_by: new mongoose.Types.ObjectId(data.created_by)
    });

    const saved = await machine.save();
    const result = await this.findById(saved._id.toString());
    if (!result) {
      throw new AppError("Failed to retrieve created Machine", 500);
    }
    return result;
  }

  async findById(id: string): Promise<MachineResponse | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Machine ID", 400);
    }

    const machine = await Machine.findById(id)
      .populate("camp_id")
      .populate("zone_id")
      .populate("counter_id")
      .populate("counter_point_id")
      .lean();

    if (!machine || machine.status === "deleted") {
      return null;
    }

    return {
      id: machine._id.toString(),
      client_id: machine.client_id.toString(),
      machine_id: machine.machine_id,
      machine_name: machine.machine_name,
      machine_type: machine.machine_type,
      manufacturer: machine.manufacturer,
      model: machine.model,
      serial_number: machine.serial_number,
      description: machine.description,
      mac_id: machine.mac_id,
      binding_status: machine.binding_status,
      assigned_status: machine.assigned_status,
      camp_id: machine.camp_id
        ? {
            id: (machine.camp_id as any)._id.toString(),
            camp_name: (machine.camp_id as any).camp_name
          }
        : null,
      zone_id: machine.zone_id
        ? {
            id: (machine.zone_id as any)._id.toString(),
            zone_name: (machine.zone_id as any).zone_name
          }
        : null,
      counter_id: machine.counter_id
        ? {
            id: (machine.counter_id as any)._id.toString(),
            counter_name: (machine.counter_id as any).counter_name
          }
        : null,
      counter_point_id: machine.counter_point_id
        ? {
            id: (machine.counter_point_id as any)._id.toString(),
            name: (machine.counter_point_id as any).name
          }
        : null,
      assigned_action: machine.assigned_action,
      last_ping_at: machine.last_ping_at,
      status: machine.status,
      created_by: machine.created_by.toString(),
      updated_by: machine.updated_by ? machine.updated_by.toString() : null,
      createdAt: machine.createdAt,
      updatedAt: machine.updatedAt
    };
  }

  async findAll(
    page: number,
    limit: number,
    filters: MachineFilter,
    client_id: string
  ): Promise<PaginatedMachineResponse> {
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

    if (filters.counter_point_id) {
      query.counter_point_id = new mongoose.Types.ObjectId(filters.counter_point_id);
    }

    if (filters.machine_type) {
      query.machine_type = filters.machine_type;
    }

    if (filters.binding_status) {
      query.binding_status = filters.binding_status;
    }

    if (filters.assigned_status) {
      query.assigned_status = filters.assigned_status;
    }

    if (filters.search && filters.search.trim() !== '') {
      const searchRegex = { $regex: filters.search.trim(), $options: 'i' };
      query.$or = [
        { machine_name: searchRegex },
        { machine_id: searchRegex },
        { serial_number: searchRegex },
        { description: searchRegex }
      ];
    }

    // Role-based coordinate limits (assigned_camps/assigned_zones)
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
      Machine.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("camp_id", "camp_name")
        .populate("zone_id", "zone_name")
        .populate("counter_id", "counter_name")
        .populate("counter_point_id", "name")
        .lean(),
      Machine.countDocuments(query)
    ]);

    const mappedItems: MachineResponse[] = items.map((machine: any) => ({
      id: machine._id.toString(),
      client_id: machine.client_id.toString(),
      machine_id: machine.machine_id,
      machine_name: machine.machine_name,
      machine_type: machine.machine_type,
      manufacturer: machine.manufacturer,
      model: machine.model,
      serial_number: machine.serial_number,
      description: machine.description,
      mac_id: machine.mac_id,
      binding_status: machine.binding_status,
      assigned_status: machine.assigned_status,
      camp_id: machine.camp_id ? { id: machine.camp_id._id.toString(), camp_name: machine.camp_id.camp_name } : null,
      zone_id: machine.zone_id ? { id: machine.zone_id._id.toString(), zone_name: machine.zone_id.zone_name } : null,
      counter_id: machine.counter_id ? { id: machine.counter_id._id.toString(), counter_name: machine.counter_id.counter_name } : null,
      counter_point_id: machine.counter_point_id ? { id: machine.counter_point_id._id.toString(), name: machine.counter_point_id.name } : null,
      assigned_action: machine.assigned_action,
      last_ping_at: machine.last_ping_at,
      status: machine.status,
      created_by: machine.created_by.toString(),
      updated_by: machine.updated_by ? machine.updated_by.toString() : null,
      createdAt: machine.createdAt,
      updatedAt: machine.updatedAt
    }));

    return {
      items: mappedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async update(id: string, data: UpdateMachineRequest): Promise<MachineResponse> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Machine ID", 400);
    }

    const machineObj = await Machine.findById(id);
    if (!machineObj || machineObj.status === "deleted") {
      throw new AppError("Machine not found", 404);
    }

    const targetClientId = machineObj.client_id.toString();
    const targetCamp = (data.camp_id || machineObj.camp_id.toString()) as string;
    const targetZone = (data.zone_id || machineObj.zone_id.toString()) as string;
    const targetCounter = (data.counter_id || machineObj.counter_id.toString()) as string;
    const targetPoint = (data.counter_point_id || machineObj.counter_point_id.toString()) as string;

    if (data.camp_id || data.zone_id || data.counter_id || data.counter_point_id) {
      await this.validateRelationships(targetClientId, targetCamp, targetZone, targetCounter, targetPoint);
    }

    if (data.serial_number && data.serial_number.trim() !== machineObj.serial_number) {
      await this.validateSerialNumber(targetClientId, data.serial_number, id);
    }

    if (data.machine_name) machineObj.machine_name = data.machine_name.trim();
    if (data.machine_type) machineObj.machine_type = data.machine_type.trim();
    if (data.manufacturer !== undefined) machineObj.manufacturer = data.manufacturer.trim();
    if (data.model !== undefined) (machineObj as any).model = data.model.trim();
    if (data.serial_number !== undefined) machineObj.serial_number = data.serial_number.trim();
    if (data.description !== undefined) machineObj.description = data.description.trim();
    if (data.mac_id !== undefined) machineObj.mac_id = data.mac_id;
    if (data.binding_status) machineObj.binding_status = data.binding_status;
    if (data.assigned_status) machineObj.assigned_status = data.assigned_status;
    if (data.camp_id) machineObj.camp_id = new mongoose.Types.ObjectId(data.camp_id);
    if (data.zone_id) machineObj.zone_id = new mongoose.Types.ObjectId(data.zone_id);
    if (data.counter_id) machineObj.counter_id = new mongoose.Types.ObjectId(data.counter_id);
    if (data.counter_point_id) machineObj.counter_point_id = new mongoose.Types.ObjectId(data.counter_point_id);
    if (data.assigned_action !== undefined) machineObj.assigned_action = data.assigned_action;
    if (data.status) machineObj.status = data.status;
    machineObj.updated_by = new mongoose.Types.ObjectId(data.updated_by);

    await machineObj.save();

    const updated = await this.findById(id);
    if (!updated) {
      throw new AppError("Failed to retrieve updated Machine", 500);
    }
    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Machine ID", 400);
    }

    const machineObj = await Machine.findById(id);
    if (!machineObj || machineObj.status === "deleted") {
      throw new AppError("Machine not found", 404);
    }

    machineObj.status = "deleted";
    machineObj.deleted_at = new Date();
    machineObj.updated_by = new mongoose.Types.ObjectId(userId);
    await machineObj.save();
  }

  async updateStatus(id: string, status: "active" | "inactive", userId: string): Promise<MachineResponse> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Machine ID", 400);
    }

    const machineObj = await Machine.findById(id);
    if (!machineObj || machineObj.status === "deleted") {
      throw new AppError("Machine not found", 404);
    }

    machineObj.status = status;
    machineObj.updated_by = new mongoose.Types.ObjectId(userId);
    await machineObj.save();

    const updated = await this.findById(id);
    if (!updated) {
      throw new AppError("Failed to retrieve updated Machine", 500);
    }
    return updated;
  }
}
