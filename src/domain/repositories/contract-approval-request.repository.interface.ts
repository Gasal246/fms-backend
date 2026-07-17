import type {
  ContractApprovalRequestInput,
  ContractApprovalRequestResponse,
  ContractApprovalRequestFilter,
} from "../types/contract-approval-request.types.js";

export interface ContractApprovalRequestRepository {
  findById(id: string, clientId: string): Promise<ContractApprovalRequestResponse | null>;
  findAll(
    page: number,
    limit: number,
    filters: ContractApprovalRequestFilter
  ): Promise<{ items: ContractApprovalRequestResponse[]; total: number }>;
  create(data: ContractApprovalRequestInput): Promise<ContractApprovalRequestResponse>;
  update(
    id: string,
    clientId: string,
    data: Partial<ContractApprovalRequestResponse>
  ): Promise<ContractApprovalRequestResponse | null>;
}
