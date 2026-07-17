import type {
  BindMachineRequest,
  BindMachineResponse,
  BindingHistoryResponse,
  BindingStatusResponse
} from "../types/machine-binding.types.js";

export interface MachineBindingRepository {
  findMachineByMachineId(machineId: string): Promise<any | null>;
  findMachineByMac(macId: string): Promise<any | null>;
  bindMachine(id: string, macId: string, userId: string): Promise<any>;
  createBindingLog(data: {
    client_id: string;
    machine_id: string;
    machine_ref_id?: string | null;
    mac_id: string;
    binding_status: "bound" | "failed";
    ip_address: string;
    user_agent: string;
    reason?: string;
  }): Promise<any>;
  getBindingHistory(machineRefId: string): Promise<any[]>;
  findMachineById(id: string): Promise<any | null>;
}

export interface MachineBindingService {
  bindMachine(
    data: BindMachineRequest,
    clientId: string,
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<BindMachineResponse>;
  getBindingHistory(machineId: string): Promise<BindingHistoryResponse>;
  getBindingStatus(machineId: string): Promise<BindingStatusResponse>;
}
