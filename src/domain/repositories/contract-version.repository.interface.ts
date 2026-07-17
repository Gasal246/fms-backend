import type {
  ContractVersionRequest,
  ContractVersionResponse,
} from "../types/contract-version.types.js";

export interface ContractVersionRepository {
  findById(id: string): Promise<ContractVersionResponse | null>;
  findByDocument(documentId: string): Promise<ContractVersionResponse[]>;
  findLatestVersion(documentId: string): Promise<ContractVersionResponse | null>;
  create(data: ContractVersionRequest): Promise<ContractVersionResponse>;
  update(id: string, data: Partial<ContractVersionRequest>): Promise<ContractVersionResponse | null>;
}
