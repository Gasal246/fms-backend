import type {
  AssignCoordinatorRequest,
  AssignCoordinatorResponse,
  GetAssignedCampsForCoordinatorResponse,
} from "../types/camp-assign-coordinator.types.js";

export interface CampAssignCoordinatorRepository {
  assignSite(data: AssignCoordinatorRequest): Promise<AssignCoordinatorResponse>;
  unassignSite(coordinator_id: string, camp_id: string): Promise<boolean>;
  getAssignedCamps(coordinator_id: string): Promise<GetAssignedCampsForCoordinatorResponse>;
  getAssignedCoordinators(camp_id: string): Promise<AssignCoordinatorResponse[]>;
  listCampsForClient(client_id: string, assigned_camps?: string[]): Promise<{ id: string; camp_name: string; camp_city: string; status: number }[]>;
}
