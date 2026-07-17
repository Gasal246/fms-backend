import type { TechnicianFilter, TechnicianResponse, PaginatedTechnicianResponse, TechnicianRequest } from "../types/technician.types.js";

export interface TechnicianRepository {
  findAll(page: number, limit: number, filters: TechnicianFilter, client_id?: string): Promise<PaginatedTechnicianResponse>;
  findById(id: string): Promise<TechnicianResponse | null>;
  findByEmail(email: string): Promise<any>;
  findByPhone(phone: string): Promise<any>;
  create(data: TechnicianRequest): Promise<TechnicianResponse>;
  update(id: string, data: Partial<TechnicianRequest>): Promise<TechnicianResponse | null>;
  delete(id: string): Promise<boolean>;
}
