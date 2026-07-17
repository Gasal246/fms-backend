import type {
  AssignZoneCoordinatorRequest,
  AssignZoneCoordinatorResponse,
  GetAssignedZonesForCoordinatorResponse,
} from "../types/zone-assign-coordinator.types.js";

export interface ZoneAssignCoordinatorRepository {
  assignZone(data: AssignZoneCoordinatorRequest): Promise<AssignZoneCoordinatorResponse>;
  unassignZone(coordinator_id: string, zone_id: string): Promise<boolean>;
  getAssignedZones(coordinator_id: string): Promise<GetAssignedZonesForCoordinatorResponse>;
  getAssignedCoordinators(zone_id: string): Promise<AssignZoneCoordinatorResponse[]>;
  listZonesForClient(client_id: string, assigned_zones?: string[]): Promise<{ id: string; zone_name: string; status: number }[]>;
}
