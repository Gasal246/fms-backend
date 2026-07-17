import type {
  ContractAllocationFilter,
  ContractAllocationRequest,
  ContractAllocationResponse,
  PaginatedContractAllocationResponse,
  AvailabilityCheckRequest,
  AvailabilityCheckResult,
} from "../types/contract-allocation.types.js";

export interface ContractAllocationRepository {
  findAll(
    page: number,
    limit: number,
    filters: ContractAllocationFilter
  ): Promise<PaginatedContractAllocationResponse>;

  findById(id: string, clientId: string): Promise<ContractAllocationResponse | null>;

  findByContract(
    contractId: string,
    clientId: string
  ): Promise<ContractAllocationResponse[]>;

  create(data: ContractAllocationRequest): Promise<ContractAllocationResponse>;

  update(
    id: string,
    clientId: string,
    data: Partial<ContractAllocationRequest>
  ): Promise<ContractAllocationResponse | null>;

  delete(id: string, clientId: string): Promise<boolean>;

  checkRoomAvailability(
    params: AvailabilityCheckRequest,
    clientId: string
  ): Promise<AvailabilityCheckResult>;

  checkBedAvailability(
    params: AvailabilityCheckRequest,
    clientId: string
  ): Promise<AvailabilityCheckResult>;
}
