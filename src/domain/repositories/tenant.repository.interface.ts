import type { TenantRegistrationRequest, TenantResponse, PaginatedTenantResponse, TenantFilter } from "../types/tenant.types.js";

export interface TenantRepository {
  findByEmail(email: string): Promise<any>;
  findByPhone(phone: string): Promise<any>;
  findById(id: string): Promise<any>;
  findBasicById(id: string): Promise<any>;
  createTenant(data: any): Promise<any>;
  updateTenant(id: string, data: any): Promise<any>;
  deleteTenant(id: string): Promise<any>;
  findAll(page?: number, limit?: number, filters?: TenantFilter, client_id?: string): Promise<{ data: any[], total: number }>;
}

export interface TenantService {
  registerTenant(data: TenantRegistrationRequest): Promise<TenantResponse>;
  getAllTenants(page?: number, limit?: number, filters?: TenantFilter, client_id?: string): Promise<PaginatedTenantResponse>;
  editTenant(id: string, data: Partial<TenantRegistrationRequest>, performedBy?: string): Promise<TenantResponse>;
  deleteTenant(id: string): Promise<void>;
  getTenantById(id: string): Promise<TenantResponse>;
  getBasicTenantById(id: string): Promise<any>;
}
