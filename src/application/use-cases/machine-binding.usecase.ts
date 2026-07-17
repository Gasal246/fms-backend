import type {
  MachineBindingRepository,
  MachineBindingService
} from "../../domain/repositories/machine-binding.repository.interface.js";
import type {
  BindMachineRequest,
  BindMachineResponse,
  BindingHistoryResponse,
  BindingStatusResponse,
  MachineBindingLogResponse
} from "../../domain/types/machine-binding.types.js";
import { MachineBindingValidator } from "../validators/machine-binding.validator.js";
import { AppError } from "../../shared/utils/AppError.js";

export class MachineBindingUseCase implements MachineBindingService {
  constructor(private machineBindingRepository: MachineBindingRepository) {
    this.machineBindingRepository = machineBindingRepository;
  }

  async bindMachine(
    data: BindMachineRequest,
    clientId: string,
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<BindMachineResponse> {
    let machine: any = null;

    try {
      // 0. Perform Joi payload validation inside UseCase to capture failed validations in the log
      try {
        MachineBindingValidator.validateBind(data);
      } catch (valError: any) {
        await this.machineBindingRepository.createBindingLog({
          client_id: clientId,
          machine_id: data?.machine_id || "UNKNOWN",
          machine_ref_id: null,
          mac_id: data?.mac_id || "UNKNOWN",
          binding_status: "failed",
          ip_address: ipAddress,
          user_agent: userAgent,
          reason: valError.message || "Invalid payload"
        });
        throw valError;
      }

      // 1. Find Machine by machine_id
      machine = await this.machineBindingRepository.findMachineByMachineId(data.machine_id);
      if (!machine) {
        await this.machineBindingRepository.createBindingLog({
          client_id: clientId,
          machine_id: data.machine_id,
          machine_ref_id: null,
          mac_id: data.mac_id,
          binding_status: "failed",
          ip_address: ipAddress,
          user_agent: userAgent,
          reason: "Machine not found"
        });
        throw new AppError("Machine not found", 404);
      }

      const machineRefId = machine._id.toString();

      // 2. Validate client ownership
      if (machine.client_id.toString() !== clientId) {
        await this.machineBindingRepository.createBindingLog({
          client_id: clientId,
          machine_id: data.machine_id,
          machine_ref_id: machineRefId,
          mac_id: data.mac_id,
          binding_status: "failed",
          ip_address: ipAddress,
          user_agent: userAgent,
          reason: "Machine does not belong to client"
        });
        throw new AppError("Machine does not belong to client", 400);
      }

      // 3. Validate status is active
      if (machine.status !== "active") {
        await this.machineBindingRepository.createBindingLog({
          client_id: clientId,
          machine_id: data.machine_id,
          machine_ref_id: machineRefId,
          mac_id: data.mac_id,
          binding_status: "failed",
          ip_address: ipAddress,
          user_agent: userAgent,
          reason: "Machine is not active"
        });
        throw new AppError("Machine is not active", 400);
      }

      // 4. Validate binding status is pending (prevent rebinding without explicit unbind)
      if (machine.binding_status !== "pending") {
        await this.machineBindingRepository.createBindingLog({
          client_id: clientId,
          machine_id: data.machine_id,
          machine_ref_id: machineRefId,
          mac_id: data.mac_id,
          binding_status: "failed",
          ip_address: ipAddress,
          user_agent: userAgent,
          reason: "Machine binding status is not Pending"
        });
        throw new AppError("Machine is already bound. Please unbind first", 400);
      }

      // 5. Validate MAC address uniqueness against active machines
      const existingActiveMacMachine = await this.machineBindingRepository.findMachineByMac(data.mac_id);
      if (existingActiveMacMachine && existingActiveMacMachine.status === "active" && existingActiveMacMachine._id.toString() !== machineRefId) {
        await this.machineBindingRepository.createBindingLog({
          client_id: clientId,
          machine_id: data.machine_id,
          machine_ref_id: machineRefId,
          mac_id: data.mac_id,
          binding_status: "failed",
          ip_address: ipAddress,
          user_agent: userAgent,
          reason: "MAC Address is already in use by another active machine"
        });
        throw new AppError("MAC Address is already in use by another active machine", 400);
      }

      // 6. Bind Machine
      await this.machineBindingRepository.bindMachine(machineRefId, data.mac_id, userId);

      // 7. Write success log
      await this.machineBindingRepository.createBindingLog({
        client_id: clientId,
        machine_id: data.machine_id,
        machine_ref_id: machineRefId,
        mac_id: data.mac_id,
        binding_status: "bound",
        ip_address: ipAddress,
        user_agent: userAgent,
        reason: "Success"
      });

      // 8. Generate API Key
      const apiKey = `${data.machine_id}.${data.mac_id}`;

      return {
        success: true,
        message: "Machine bound successfully",
        data: {
          machine_id: data.machine_id,
          mac_id: data.mac_id,
          binding_status: "bound",
          api_key: apiKey
        }
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to bind machine", error.statusCode || 500);
    }
  }

  async getBindingHistory(machineId: string): Promise<BindingHistoryResponse> {
    // 1. Resolve machine by id (could be Mongo ObjectId or machine_id sequential ID)
    let machine = await this.machineBindingRepository.findMachineById(machineId);
    if (!machine) {
      machine = await this.machineBindingRepository.findMachineByMachineId(machineId);
    }

    if (!machine) {
      throw new AppError("Machine not found", 404);
    }

    const logs = await this.machineBindingRepository.getBindingHistory(machine._id.toString());

    const mappedHistory: MachineBindingLogResponse[] = logs.map((log: any) => ({
      id: log._id.toString(),
      client_id: log.client_id.toString(),
      machine_id: log.machine_id,
      machine_ref_id: log.machine_ref_id ? log.machine_ref_id.toString() : null,
      mac_id: log.mac_id,
      binding_status: log.binding_status,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      reason: log.reason,
      createdAt: log.createdAt
    }));

    return {
      success: true,
      history: mappedHistory
    };
  }

  async getBindingStatus(machineId: string): Promise<BindingStatusResponse> {
    // 1. Resolve machine
    let machine = await this.machineBindingRepository.findMachineById(machineId);
    if (!machine) {
      machine = await this.machineBindingRepository.findMachineByMachineId(machineId);
    }

    if (!machine) {
      throw new AppError("Machine not found", 404);
    }

    return {
      success: true,
      data: {
        machine_id: machine.machine_id,
        mac_id: machine.mac_id,
        binding_status: machine.binding_status
      }
    };
  }
}
