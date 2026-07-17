import type { TechnicianAssignCampsRepository } from "../../domain/repositories/technician-assign-camps.repository.interface.js";
import type {
  AssignTechnicianRequest,
  AssignTechnicianResponse,
} from "../../domain/types/technician-assign-camps.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export interface TechnicianAssignCampsService {
  assignSites(data: AssignTechnicianRequest): Promise<AssignTechnicianResponse>;
  unassignSite(technician_id: string, camp_id: string): Promise<AssignTechnicianResponse | null>;
  getAssignedCamps(technician_id: string): Promise<AssignTechnicianResponse | null>;
  listCampsForClient(client_id: string, assigned_camps?: string[]): Promise<{ id: string; camp_name: string; camp_city: string; status: number }[]>;
}

export class TechnicianAssignCampsUseCase implements TechnicianAssignCampsService {
  constructor(private repo: TechnicianAssignCampsRepository) {}

  async assignSites(data: AssignTechnicianRequest): Promise<AssignTechnicianResponse> {
    if (!data.technician_id || !data.client_id) {
      throw new AppError("technician_id and client_id are required", 400);
    }
    if (!data.camp_ids || data.camp_ids.length === 0) {
      throw new AppError("At least one camp_id is required", 400);
    }
    return this.repo.assignSites(data);
  }

  async unassignSite(
    technician_id: string,
    camp_id: string
  ): Promise<AssignTechnicianResponse | null> {
    if (!technician_id || !camp_id) {
      throw new AppError("technician_id and camp_id are required", 400);
    }
    return this.repo.unassignSite(technician_id, camp_id);
  }

  async getAssignedCamps(technician_id: string): Promise<AssignTechnicianResponse | null> {
    return this.repo.getAssignedCamps(technician_id);
  }

  async listCampsForClient(client_id: string, assigned_camps?: string[]) {
    if (!client_id) throw new AppError("client_id is required", 400);
    return this.repo.listCampsForClient(client_id, assigned_camps);
  }
}
