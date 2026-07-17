import type { CampAssignCoordinatorRepository } from "../../domain/repositories/camp-assign-coordinator.repository.interface.js";
import type {
  AssignCoordinatorRequest,
  AssignCoordinatorResponse,
  GetAssignedCampsForCoordinatorResponse,
} from "../../domain/types/camp-assign-coordinator.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export interface CampAssignCoordinatorService {
  assignSite(data: AssignCoordinatorRequest): Promise<AssignCoordinatorResponse>;
  unassignSite(coordinator_id: string, camp_id: string): Promise<void>;
  getAssignedCamps(coordinator_id: string): Promise<GetAssignedCampsForCoordinatorResponse>;
  getAssignedCoordinators(camp_id: string): Promise<AssignCoordinatorResponse[]>;
  listCampsForClient(client_id: string, assigned_camps?: string[]): Promise<{ id: string; camp_name: string; camp_city: string; status: number }[]>;
}

export class CampAssignCoordinatorUseCase implements CampAssignCoordinatorService {
  constructor(private repo: CampAssignCoordinatorRepository) {}

  async assignSite(data: AssignCoordinatorRequest): Promise<AssignCoordinatorResponse> {
    if (!data.coordinator_id || !data.camp_id) {
      throw new AppError("coordinator_id and camp_id are required", 400);
    }
    return this.repo.assignSite(data);
  }

  async unassignSite(coordinator_id: string, camp_id: string): Promise<void> {
    const success = await this.repo.unassignSite(coordinator_id, camp_id);
    if (!success) throw new AppError("Assignment not found", 404);
  }

  async getAssignedCamps(coordinator_id: string): Promise<GetAssignedCampsForCoordinatorResponse> {
    return this.repo.getAssignedCamps(coordinator_id);
  }

  async getAssignedCoordinators(camp_id: string): Promise<AssignCoordinatorResponse[]> {
    return this.repo.getAssignedCoordinators(camp_id);
  }

  async listCampsForClient(client_id: string, assigned_camps?: string[]) {
    if (!client_id) throw new AppError("client_id is required", 400);
    return this.repo.listCampsForClient(client_id, assigned_camps);
  }
}
