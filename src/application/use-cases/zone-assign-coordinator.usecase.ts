import type { ZoneAssignCoordinatorRepository } from "../../domain/repositories/zone-assign-coordinator.repository.interface.js";
import type {
  AssignZoneCoordinatorRequest,
  AssignZoneCoordinatorResponse,
  GetAssignedZonesForCoordinatorResponse,
} from "../../domain/types/zone-assign-coordinator.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export interface ZoneAssignCoordinatorService {
  assignZone(data: AssignZoneCoordinatorRequest): Promise<AssignZoneCoordinatorResponse>;
  unassignZone(coordinator_id: string, zone_id: string): Promise<void>;
  getAssignedZones(coordinator_id: string): Promise<GetAssignedZonesForCoordinatorResponse>;
  getAssignedCoordinators(zone_id: string): Promise<AssignZoneCoordinatorResponse[]>;
  listZonesForClient(client_id: string, assigned_zones?: string[]): Promise<{ id: string; zone_name: string; status: number }[]>;
}

export class ZoneAssignCoordinatorUseCase implements ZoneAssignCoordinatorService {
  constructor(private repo: ZoneAssignCoordinatorRepository) {}

  async assignZone(data: AssignZoneCoordinatorRequest): Promise<AssignZoneCoordinatorResponse> {
    if (!data.coordinator_id || !data.zone_id) {
      throw new AppError("coordinator_id and zone_id are required", 400);
    }
    return this.repo.assignZone(data);
  }

  async unassignZone(coordinator_id: string, zone_id: string): Promise<void> {
    const success = await this.repo.unassignZone(coordinator_id, zone_id);
    if (!success) throw new AppError("Assignment not found", 404);
  }

  async getAssignedZones(coordinator_id: string): Promise<GetAssignedZonesForCoordinatorResponse> {
    return this.repo.getAssignedZones(coordinator_id);
  }

  async getAssignedCoordinators(zone_id: string): Promise<AssignZoneCoordinatorResponse[]> {
    return this.repo.getAssignedCoordinators(zone_id);
  }

  async listZonesForClient(client_id: string, assigned_zones?: string[]) {
    if (!client_id) throw new AppError("client_id is required", 400);
    return this.repo.listZonesForClient(client_id, assigned_zones);
  }
}
