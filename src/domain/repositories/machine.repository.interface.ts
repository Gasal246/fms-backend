import type {
  CreateMachineRequest,
  UpdateMachineRequest,
  MachineResponse,
  PaginatedMachineResponse,
  MachineFilter
} from "../types/machine.types.js";

export interface MachineRepository {
  create(data: CreateMachineRequest): Promise<MachineResponse>;
  findById(id: string): Promise<MachineResponse | null>;
  findAll(page: number, limit: number, filters: MachineFilter, client_id: string): Promise<PaginatedMachineResponse>;
  update(id: string, data: UpdateMachineRequest): Promise<MachineResponse>;
  delete(id: string, userId: string): Promise<void>;
  updateStatus(id: string, status: "active" | "inactive", userId: string): Promise<MachineResponse>;
}

export interface MachineService {
  createMachine(data: CreateMachineRequest): Promise<MachineResponse>;
  getMachine(id: string): Promise<MachineResponse>;
  getAllMachines(page: number, limit: number, filters: MachineFilter, client_id: string): Promise<PaginatedMachineResponse>;
  updateMachine(id: string, data: UpdateMachineRequest): Promise<MachineResponse>;
  deleteMachine(id: string, userId: string): Promise<void>;
  activateMachine(id: string, userId: string): Promise<MachineResponse>;
  deactivateMachine(id: string, userId: string): Promise<MachineResponse>;
}
