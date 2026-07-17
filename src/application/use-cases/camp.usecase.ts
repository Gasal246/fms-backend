import type { CampRepository, CampService } from "../../domain/repositories/camp.repository.interface.js";
import type { CampResponse, CampOccupancySummary, PaginatedCampOccupancySummary } from "../../domain/types/camp.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export class CampUseCase implements CampService {
  constructor(private campRepository: CampRepository) {}

  async getCamp(id: string): Promise<CampResponse> {
    const camp = await this.campRepository.findById(id);
    if (!camp) {
      throw new AppError("Camp not found", 404);
    }
    return camp;
  }

  async getAllCamps(client_id: string, assigned_camps?: string[]): Promise<CampResponse[]> {
    return this.campRepository.findAll(client_id, assigned_camps);
  }

  async getOccupancySummary(
    client_id: string,
    camp_name?: string,
    page: number = 1,
    limit: number = 6,
    assigned_camps?: string[]
  ): Promise<PaginatedCampOccupancySummary> {
    return this.campRepository.getOccupancySummary(client_id, camp_name, page, limit, assigned_camps);
  }
}
