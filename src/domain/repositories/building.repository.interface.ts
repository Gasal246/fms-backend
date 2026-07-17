import type { BuildingResponse, BuildingOccupancySummary, PaginatedBuildingOccupancySummary } from "../types/building.types.js";

export interface BuildingRepository {
  findById(id: string): Promise<BuildingResponse | null>;
  findAll(client_id: string, camp_id?: string, zone_id?: string, assigned_camps?: string[], assigned_zones?: string[]): Promise<BuildingResponse[]>;
  getOccupancySummary(client_id: string, camp_id?: string, zone_id?: string, building_name?: string, page?: number, limit?: number, assigned_camps?: string[], assigned_zones?: string[]): Promise<PaginatedBuildingOccupancySummary>;
}

export interface BuildingService {
  getBuilding(id: string): Promise<BuildingResponse>;
  getAllBuildings(client_id: string, camp_id?: string, zone_id?: string, assigned_camps?: string[], assigned_zones?: string[]): Promise<BuildingResponse[]>;
  getOccupancySummary(client_id: string, camp_id?: string, zone_id?: string, building_name?: string, page?: number, limit?: number, assigned_camps?: string[], assigned_zones?: string[]): Promise<PaginatedBuildingOccupancySummary>;
}
