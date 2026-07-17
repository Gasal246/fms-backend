import type { CampFilter, CampResponse, CampOccupancySummary, PaginatedCampOccupancySummary } from "../types/camp.types.js";

export interface CampRepository {
  findById(id: string): Promise<CampResponse | null>;
  findAll(client_id: string, assigned_camps?: string[]): Promise<CampResponse[]>;
  getOccupancySummary(client_id: string, camp_name?: string, page?: number, limit?: number, assigned_camps?: string[]): Promise<PaginatedCampOccupancySummary>;
}

export interface CampService {
  getCamp(id: string): Promise<CampResponse>;
  getAllCamps(client_id: string, assigned_camps?: string[]): Promise<CampResponse[]>;
  getOccupancySummary(client_id: string, camp_name?: string, page?: number, limit?: number, assigned_camps?: string[]): Promise<PaginatedCampOccupancySummary>;
}
