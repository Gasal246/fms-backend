import type { CoordinatorFilter, CoordinatorResponse, PaginatedCoordinatorResponse, CoordinatorRequest } from "../types/coordinator.types.js";

export interface CoordinatorRepository {
  findAll(page: number, limit: number, filters: CoordinatorFilter): Promise<PaginatedCoordinatorResponse>;
  findById(id: string): Promise<CoordinatorResponse | null>;
  findByEmail(email: string): Promise<any>;
  findByPhone(phone: string): Promise<any>;
  create(data: CoordinatorRequest): Promise<CoordinatorResponse>;
  update(id: string, data: Partial<CoordinatorRequest>): Promise<CoordinatorResponse | null>;
  delete(id: string): Promise<boolean>;
}
