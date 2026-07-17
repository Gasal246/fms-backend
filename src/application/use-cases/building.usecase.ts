import type { BuildingRepository, BuildingService } from "../../domain/repositories/building.repository.interface.js";
import type { BuildingResponse, BuildingOccupancySummary, PaginatedBuildingOccupancySummary } from "../../domain/types/building.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export class BuildingUseCase implements BuildingService {
  constructor(private buildingRepository: BuildingRepository) {
    this.buildingRepository = buildingRepository;
  }

  async getBuilding(id: string): Promise<BuildingResponse> {
    const building = await this.buildingRepository.findById(id);
    if (!building) {
      throw new AppError("Building not found", 404);
    }
    return building;
  }

  async getAllBuildings(client_id: string, camp_id?: string, zone_id?: string, assigned_camps?: string[], assigned_zones?: string[]): Promise<BuildingResponse[]> {
    return this.buildingRepository.findAll(client_id, camp_id, zone_id, assigned_camps, assigned_zones);
  }

  async getOccupancySummary(client_id: string, camp_id?: string, zone_id?: string, building_name?: string, page?: number, limit?: number, assigned_camps?: string[], assigned_zones?: string[]): Promise<PaginatedBuildingOccupancySummary> {
    return this.buildingRepository.getOccupancySummary(client_id, camp_id, zone_id, building_name, page, limit, assigned_camps, assigned_zones);
  }
}
