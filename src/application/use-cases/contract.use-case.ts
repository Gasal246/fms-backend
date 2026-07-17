import type { ContractRepository, RenewContractRequest } from "../../domain/repositories/contract.repository.interface.js";
import type { ContractAllocationRepository } from "../../domain/repositories/contract-allocation.repository.interface.js";
import type {
  ContractFilter,
  ContractRequest,
  ContractResponse,
  PaginatedContractResponse,
  ContractOccupancySummary,
} from "../../domain/types/contract.types.js";
import type { ContractAllocationResponse } from "../../domain/types/contract-allocation.types.js";
import { ContractValidator } from "../validators/contract.validator.js";
import { AppError } from "../../shared/utils/AppError.js";

export class ContractUseCase {
  constructor(
    private readonly contractRepo: ContractRepository,
    private readonly allocationRepo: ContractAllocationRepository
  ) {}

  async getAllContracts(
    page: number,
    limit: number,
    filters: ContractFilter
  ): Promise<PaginatedContractResponse> {
    return this.contractRepo.findAll(page, limit, filters);
  }

  async getContractById(id: string, clientId: string): Promise<ContractResponse> {
    const contract = await this.contractRepo.findById(id, clientId);
    if (!contract) throw new AppError("Contract not found", 404);
    return contract;
  }

  async createContract(
    data: Omit<ContractRequest, "client_id">,
    clientId: string
  ): Promise<ContractResponse> {
    ContractValidator.validateCreate(data);

    const startDate = new Date(data.start_date);
    const endDate = new Date(data.end_date);
    if (endDate <= startDate) {
      throw new AppError("end_date must be after start_date", 400);
    }

    return this.contractRepo.create({ ...data, client_id: clientId });
  }

  async updateContract(
    id: string,
    clientId: string,
    data: Partial<ContractRequest>
  ): Promise<ContractResponse> {
    ContractValidator.validateUpdate(data);

    // Validate date logic if both are provided
    if (data.start_date && data.end_date) {
      if (new Date(data.end_date) <= new Date(data.start_date)) {
        throw new AppError("end_date must be after start_date", 400);
      }
    }

    const updated = await this.contractRepo.update(id, clientId, data);
    if (!updated) throw new AppError("Contract not found", 404);
    return updated;
  }

  async deleteContract(id: string, clientId: string, userId?: string, userRole?: string): Promise<void> {
    const deleted = await this.contractRepo.delete(id, clientId, userId, userRole);
    if (!deleted) throw new AppError("Contract not found", 404);
  }

  async getContractTerminationDetails(contractId: string): Promise<any> {
    const details = await this.contractRepo.getTerminationDetails(contractId);
    if (!details) throw new AppError("Termination details not found", 404);
    return details;
  }

  async getContractsByCompany(
    companyId: string,
    clientId: string,
    page: number,
    limit: number
  ): Promise<PaginatedContractResponse> {
    return this.contractRepo.findByCompany(companyId, clientId, page, limit);
  }

  async getOccupancySummary(
    contractId: string,
    clientId: string
  ): Promise<ContractOccupancySummary> {
    const exists = await this.contractRepo.exists(contractId, clientId);
    if (!exists) throw new AppError("Contract not found", 404);
    return this.contractRepo.getOccupancySummary(contractId, clientId);
  }

  async getContractAllocations(
    contractId: string,
    clientId: string
  ): Promise<ContractAllocationResponse[]> {
    const exists = await this.contractRepo.exists(contractId, clientId);
    if (!exists) throw new AppError("Contract not found", 404);
    return this.allocationRepo.findByContract(contractId, clientId);
  }

  async amendContract(
    id: string,
    clientId: string,
    data: {
      end_date?: string | Date;
      agreed_rate?: number;
      max_head_count?: number;
      room_count?: number;
      billing_frequency?: string;
      notes?: string;
    }
  ): Promise<ContractResponse> {
    const existing = await this.contractRepo.findById(id, clientId);
    if (!existing) throw new AppError("Contract not found", 404);

    const updates: Partial<ContractRequest> = {};
    if (data.end_date) {
      if (new Date(data.end_date) <= new Date(existing.start_date)) {
        throw new AppError("New end_date must be after start_date", 400);
      }
      updates.end_date = data.end_date;
    }
    if (data.agreed_rate !== undefined) updates.agreed_rate = data.agreed_rate;
    if (data.max_head_count !== undefined) updates.max_head_count = data.max_head_count;
    if (data.room_count !== undefined) updates.room_count = data.room_count;
    if (data.notes) updates.notes = data.notes;

    const updated = await this.contractRepo.update(id, clientId, updates);
    if (!updated) throw new AppError("Contract amendment failed", 404);
    return updated;
  }

  async renewContract(
    originalId: string,
    clientId: string,
    data: RenewContractRequest,
    copyAllocations: boolean,
    userId?: string
  ): Promise<ContractResponse> {
    if (!data.contract_number?.trim()) {
      throw new AppError("contract_number is required for renewal", 400);
    }
    if (!data.contract_name?.trim()) {
      throw new AppError("contract_name is required for renewal", 400);
    }
    if (!data.start_date || !data.end_date) {
      throw new AppError("start_date and end_date are required for renewal", 400);
    }
    if (new Date(data.end_date) <= new Date(data.start_date)) {
      throw new AppError("end_date must be after start_date", 400);
    }
    return this.contractRepo.renew(originalId, clientId, data, copyAllocations, userId);
  }

  async extendContract(
    id: string,
    clientId: string,
    data: {
      new_end_date: string | Date;
      extension_reason?: string;
      document_id?: string | null;
    },
    userId: string,
    userRole: string
  ): Promise<ContractResponse> {
    const { ContractExtensionValidator } = await import("../validators/contract-extension.validator.js");
    ContractExtensionValidator.validate(data);

    return this.contractRepo.extend(id, clientId, data, userId, userRole);
  }

  async getContractExtensions(contractId: string): Promise<any[]> {
    return this.contractRepo.getExtensions(contractId);
  }
}
