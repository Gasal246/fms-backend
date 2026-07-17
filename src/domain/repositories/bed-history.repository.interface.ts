import type { BedHistoryResponse, BedHistoryFilter, PaginatedBedHistoryResponse } from "../types/bed-history.types.js";

export interface BedHistoryRepository {
  create(data: any): Promise<any>;
  findAll(page: number, limit: number, filters?: BedHistoryFilter): Promise<PaginatedBedHistoryResponse>;
  findByTenantId(tenantId: string): Promise<BedHistoryResponse[]>;
  closeHistory(tenantId: string, bedId: string, unassignedAt: Date): Promise<void>;
}

export interface BedHistoryService {
  getAllBedHistory(page: number, limit: number, filters?: BedHistoryFilter): Promise<PaginatedBedHistoryResponse>;
  getTenantBedHistory(tenantId: string): Promise<BedHistoryResponse[]>;
}
