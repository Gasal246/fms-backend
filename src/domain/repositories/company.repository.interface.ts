import type {
  CompanyFilter,
  CompanyRequest,
  CompanyResponse,
  PaginatedCompanyResponse,
  CompanySummary,
} from "../types/company.types.js";

export interface CompanyRepository {
  findAll(page: number, limit: number, filters: CompanyFilter): Promise<PaginatedCompanyResponse>;
  findById(id: string): Promise<CompanyResponse | null>;
  findByCode(company_code: string, excludeId?: string): Promise<CompanyResponse | null>;
  create(data: CompanyRequest): Promise<CompanyResponse>;
  update(id: string, data: Partial<CompanyRequest>): Promise<CompanyResponse | null>;
  delete(id: string): Promise<boolean>;
  assignEntities(companyId: string, tenantIds: string[], roomIds: string[], contractId?: string): Promise<void>;
  unassignEntities(companyId: string, tenantIds: string[], roomIds: string[], contractId?: string): Promise<void>;
  getCompanySummary(companyId: string, clientId: string): Promise<CompanySummary>;
  getCompanyAssignedRooms(companyId: string, clientId: string, filters: { contract_id?: string | undefined }): Promise<any[]>;
}
