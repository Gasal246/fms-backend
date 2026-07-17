import type {
  ContractDocumentFilter,
  ContractDocumentRequest,
  ContractDocumentResponse,
  PaginatedContractDocumentResponse,
} from "../types/contract-document.types.js";

export interface ContractDocumentRepository {
  findAll(
    page: number,
    limit: number,
    filters: ContractDocumentFilter
  ): Promise<PaginatedContractDocumentResponse>;

  findById(id: string, clientId: string): Promise<ContractDocumentResponse | null>;

  findByContract(
    contractId: string,
    clientId: string
  ): Promise<ContractDocumentResponse[]>;

  create(data: ContractDocumentRequest): Promise<ContractDocumentResponse>;

  update(
    id: string,
    clientId: string,
    data: Partial<ContractDocumentRequest>
  ): Promise<ContractDocumentResponse | null>;

  delete(id: string, clientId: string): Promise<boolean>;
}
