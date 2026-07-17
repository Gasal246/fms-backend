import type { ContractAllocationRepository } from "../../domain/repositories/contract-allocation.repository.interface.js";
import type { ContractRepository } from "../../domain/repositories/contract.repository.interface.js";
import type {
  ContractAllocationFilter,
  ContractAllocationRequest,
  ContractAllocationResponse,
  PaginatedContractAllocationResponse,
} from "../../domain/types/contract-allocation.types.js";
import { ContractAllocationValidator } from "../validators/contract-allocation.validator.js";
import { AppError } from "../../shared/utils/AppError.js";

export class ContractAllocationUseCase {
  constructor(
    private readonly allocationRepo: ContractAllocationRepository,
    private readonly contractRepo: ContractRepository
  ) {}

  async getAllAllocations(
    page: number,
    limit: number,
    filters: ContractAllocationFilter
  ): Promise<PaginatedContractAllocationResponse> {
    return this.allocationRepo.findAll(page, limit, filters);
  }

  async getAllocationById(id: string, clientId: string): Promise<ContractAllocationResponse> {
    const result = await this.allocationRepo.findById(id, clientId);
    if (!result) throw new AppError("Allocation not found", 404);
    return result;
  }

  async createAllocation(
    data: Omit<ContractAllocationRequest, "client_id">,
    clientId: string
  ): Promise<ContractAllocationResponse> {
    ContractAllocationValidator.validateCreate(data);

    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    if (endDate <= startDate) {
      throw new AppError("end_date must be after start_date", 400);
    }

    // Validate contract exists
    const contract = await this.contractRepo.findById(data.contract_id, clientId);
    if (!contract) throw new AppError("Contract not found", 404);

    // Check room overlap
    if (data.allocation_type === "ROOM" && data.room_id) {
      const roomCheck = await this.allocationRepo.checkRoomAvailability(
        {
          room_id: data.room_id,
          start_date: data.start_date,
          end_date: data.end_date,
        },
        clientId
      );
      if (!roomCheck.available) {
        throw new AppError(roomCheck.message ?? "Room is not available", 409);
      }
    }

    // Check bed overlap
    if (data.allocation_type === "BED" && data.bed_id) {
      const bedCheck = await this.allocationRepo.checkBedAvailability(
        {
          bed_id: data.bed_id,
          start_date: data.start_date,
          end_date: data.end_date,
        },
        clientId
      );
      if (!bedCheck.available) {
        throw new AppError(bedCheck.message ?? "Bed is not available", 409);
      }
    }

    return this.allocationRepo.create({ ...data, client_id: clientId });
  }

  async updateAllocation(
    id: string,
    clientId: string,
    data: Partial<ContractAllocationRequest>
  ): Promise<ContractAllocationResponse> {
    ContractAllocationValidator.validateUpdate(data);

    const existing = await this.allocationRepo.findById(id, clientId);
    if (!existing) throw new AppError("Allocation not found", 404);

    // Re-check overlaps on update if inventory references changed
    if (data.room_id || data.start_date || data.end_date) {
      const checkReq: any = {
        start_date: data.start_date ?? existing.start_date,
        end_date: data.end_date ?? existing.end_date,
        exclude_allocation_id: id,
      };
      const roomId = data.room_id ?? existing.room_id;
      if (roomId) {
        checkReq.room_id = roomId;
      }

      const roomCheck = await this.allocationRepo.checkRoomAvailability(checkReq, clientId);
      if (!roomCheck.available) {
        throw new AppError(roomCheck.message ?? "Room is not available", 409);
      }
    }

    if (data.bed_id || data.start_date || data.end_date) {
      const checkReq: any = {
        start_date: data.start_date ?? existing.start_date,
        end_date: data.end_date ?? existing.end_date,
        exclude_allocation_id: id,
      };
      const bedId = data.bed_id ?? existing.bed_id;
      if (bedId) {
        checkReq.bed_id = bedId;
      }

      const bedCheck = await this.allocationRepo.checkBedAvailability(checkReq, clientId);
      if (!bedCheck.available) {
        throw new AppError(bedCheck.message ?? "Bed is not available", 409);
      }
    }

    const updated = await this.allocationRepo.update(id, clientId, data);
    if (!updated) throw new AppError("Allocation not found", 404);
    return updated;
  }

  async deleteAllocation(id: string, clientId: string): Promise<void> {
    const deleted = await this.allocationRepo.delete(id, clientId);
    if (!deleted) throw new AppError("Allocation not found", 404);
  }
}
