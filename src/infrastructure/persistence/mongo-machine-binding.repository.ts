import mongoose from "mongoose";
import type { MachineBindingRepository } from "../../domain/repositories/machine-binding.repository.interface.js";
import Machine from "./models/machine.model.js";
import MachineBindingLog from "./models/machine-binding-log.model.js";
import { AppError } from "../../shared/utils/AppError.js";

export class MongoMachineBindingRepository implements MachineBindingRepository {

  async findMachineByMachineId(machineId: string): Promise<any | null> {
    return await Machine.findOne({
      machine_id: machineId,
      status: { $ne: "deleted" }
    }).lean();
  }

  async findMachineByMac(macId: string): Promise<any | null> {
    return await Machine.findOne({
      mac_id: macId,
      status: { $ne: "deleted" }
    }).lean();
  }

  async findMachineById(id: string): Promise<any | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }
    return await Machine.findOne({
      _id: new mongoose.Types.ObjectId(id),
      status: { $ne: "deleted" }
    }).lean();
  }

  async bindMachine(id: string, macId: string, userId: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid Machine ID", 400);
    }

    const machineObj = await Machine.findById(id);
    if (!machineObj || machineObj.status === "deleted") {
      throw new AppError("Machine not found", 404);
    }

    machineObj.binding_status = "bound";
    machineObj.mac_id = macId;
    machineObj.updated_by = new mongoose.Types.ObjectId(userId);

    await machineObj.save();
    return machineObj;
  }

  async createBindingLog(data: {
    client_id: string;
    machine_id: string;
    machine_ref_id?: string | null;
    mac_id: string;
    binding_status: "bound" | "failed";
    ip_address: string;
    user_agent: string;
    reason?: string;
  }): Promise<any> {
    const log = new MachineBindingLog({
      client_id: new mongoose.Types.ObjectId(data.client_id),
      machine_id: data.machine_id,
      machine_ref_id: data.machine_ref_id ? new mongoose.Types.ObjectId(data.machine_ref_id) : null,
      mac_id: data.mac_id,
      binding_status: data.binding_status,
      ip_address: data.ip_address,
      user_agent: data.user_agent,
      reason: data.reason || ""
    });
    return await log.save();
  }

  async getBindingHistory(machineRefId: string): Promise<any[]> {
    if (!mongoose.Types.ObjectId.isValid(machineRefId)) {
      return [];
    }
    return await MachineBindingLog.find({
      machine_ref_id: new mongoose.Types.ObjectId(machineRefId)
    })
      .sort({ createdAt: -1 })
      .lean();
  }
}
