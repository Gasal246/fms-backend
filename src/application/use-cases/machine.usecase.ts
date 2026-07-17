import type { MachineRepository, MachineService } from "../../domain/repositories/machine.repository.interface.js";
import type {
  CreateMachineRequest,
  UpdateMachineRequest,
  MachineResponse,
  PaginatedMachineResponse,
  MachineFilter
} from "../../domain/types/machine.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export class MachineUseCase implements MachineService {
  constructor(private machineRepository: MachineRepository) {
    this.machineRepository = machineRepository;
  }

  async createMachine(data: CreateMachineRequest): Promise<MachineResponse> {
    try {
      return await this.machineRepository.create(data);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to create machine", error.statusCode || 500);
    }
  }

  async getMachine(id: string): Promise<MachineResponse> {
    const machine = await this.machineRepository.findById(id);
    if (!machine) {
      throw new AppError("Machine not found", 404);
    }
    return machine;
  }

  async getAllMachines(
    pageNum: number,
    limitNum: number,
    filters: MachineFilter,
    client_id: string
  ): Promise<PaginatedMachineResponse> {
    const page = pageNum > 0 ? pageNum : 1;
    const limit = limitNum > 0 ? limitNum : 10;
    return await this.machineRepository.findAll(page, limit, filters, client_id);
  }

  async updateMachine(id: string, data: UpdateMachineRequest): Promise<MachineResponse> {
    try {
      return await this.machineRepository.update(id, data);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to update machine", error.statusCode || 500);
    }
  }

  async deleteMachine(id: string, userId: string): Promise<void> {
    try {
      await this.machineRepository.delete(id, userId);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to delete machine", error.statusCode || 500);
    }
  }

  async activateMachine(id: string, userId: string): Promise<MachineResponse> {
    try {
      return await this.machineRepository.updateStatus(id, "active", userId);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to activate machine", error.statusCode || 500);
    }
  }

  async deactivateMachine(id: string, userId: string): Promise<MachineResponse> {
    try {
      return await this.machineRepository.updateStatus(id, "inactive", userId);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to deactivate machine", error.statusCode || 500);
    }
  }
}
