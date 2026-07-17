import type {
  ContractStaffAccessInput,
  ContractStaffAccessResponse,
} from "../types/contract-staff-access.types.js";

export interface ContractStaffAccessRepository {
  findByStaffAndDocument(staffId: string, documentId: string): Promise<ContractStaffAccessResponse | null>;
  findByDocument(documentId: string): Promise<ContractStaffAccessResponse[]>;
  createOrUpdate(data: ContractStaffAccessInput): Promise<ContractStaffAccessResponse>;
  delete(staffId: string, documentId: string): Promise<boolean>;
}
