import type { CreateBedRequest, UpdateBedRequest, BedResponse, PaginatedBedResponse, BedFilter, BulkAllocateRequest } from "../types/bed.types.js";

export interface BedRepository {
  create(data: CreateBedRequest): Promise<any>;
  findById(id: string): Promise<any>;
  findAll(page: number, limit: number, filters?: BedFilter, client_id?: string): Promise<PaginatedBedResponse>;
  update(id: string, data: UpdateBedRequest): Promise<any>;
  delete(id: string): Promise<void>;
}

export interface BedService {
  createBed(data: CreateBedRequest): Promise<any>;
  getBed(id: string): Promise<any>;
  getAllBeds(page: number, limit: number, filters?: BedFilter, client_id?: string): Promise<PaginatedBedResponse>;
  updateBed(id: string, data: UpdateBedRequest): Promise<any>;
  deleteBed(id: string): Promise<void>;
  bulkAllocate(data: BulkAllocateRequest): Promise<any>;
}
