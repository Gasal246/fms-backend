import type { ZoneRepository, ZoneService } from "../../domain/repositories/zone.repository.interface.js";
import type { ZoneFilter, ZoneResponse } from "../../domain/types/zone.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export class ZoneUseCase implements ZoneService {
  constructor(private zoneRepository: ZoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  async getZone(id: string): Promise<ZoneResponse> {
    const zone = await this.zoneRepository.findById(id);
    if (!zone) {
      throw new AppError("Zone not found", 404);
    }
    return zone;
  }

  async getAllZones(client_id: string, camp_id?: string, assigned_camps?: string[], assigned_zones?: string[], search?: string): Promise<ZoneResponse[]> {
    return this.zoneRepository.findAll(client_id, camp_id, assigned_camps, assigned_zones, search);
  }
}
