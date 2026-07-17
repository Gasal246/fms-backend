import type {
  ContractFilter,
  ContractRequest,
  ContractResponse,
  PaginatedContractResponse,
  ContractOccupancySummary,
} from "../types/contract.types.js";

export interface RenewContractRequest {
  contract_number: string;
  contract_name: string;
  billing_model: string;
  currency: string;
  start_date: string | Date;
  end_date: string | Date;
  agreed_rate?: number;
  max_head_count?: number;
  room_count?: number;
  notes?: string;
  grace_period_days?: number;
  notice_period_days?: number;
  renewal_terms?: string;
  contract_value?: number;
  tax_mode?: string;
  auto_renew?: boolean;
  compliance_required?: boolean;
  created_by?: string;
  selected_allocation_ids?: string[];
}

export interface ContractRepository {
  findAll(
    page: number,
    limit: number,
    filters: ContractFilter
  ): Promise<PaginatedContractResponse>;

  findById(id: string, clientId: string): Promise<ContractResponse | null>;
  exists(id: string, clientId: string): Promise<boolean>;

  findByNumber(
    contractNumber: string,
    clientId: string,
    excludeId?: string
  ): Promise<ContractResponse | null>;

  create(data: ContractRequest): Promise<ContractResponse>;

  update(
    id: string,
    clientId: string,
    data: Partial<ContractRequest>
  ): Promise<ContractResponse | null>;

  delete(id: string, clientId: string, userId?: string, userRole?: string): Promise<boolean>;

  getTerminationDetails(contractId: string): Promise<any | null>;

  getOccupancySummary(
    contractId: string,
    clientId: string
  ): Promise<ContractOccupancySummary>;

  findByCompany(
    companyId: string,
    clientId: string,
    page: number,
    limit: number
  ): Promise<PaginatedContractResponse>;

  renew(
    originalId: string,
    clientId: string,
    data: RenewContractRequest,
    copyAllocations: boolean,
    userId?: string
  ): Promise<ContractResponse>;

  extend(
    id: string,
    clientId: string,
    data: {
      new_end_date: string | Date;
      extension_reason?: string;
      document_id?: string | null;
    },
    userId: string,
    userRole: string
  ): Promise<ContractResponse>;

  getExtensions(contractId: string): Promise<any[]>;
}
