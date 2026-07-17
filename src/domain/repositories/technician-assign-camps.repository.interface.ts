import type {
  AssignTechnicianRequest,
  AssignTechnicianResponse,
} from "../types/technician-assign-camps.types.js";

export interface TechnicianAssignCampsRepository {
  assignSites(data: AssignTechnicianRequest): Promise<AssignTechnicianResponse>;
  unassignSite(technician_id: string, camp_id: string): Promise<AssignTechnicianResponse | null>;
  getAssignedCamps(technician_id: string): Promise<AssignTechnicianResponse | null>;
  listCampsForClient(client_id: string, assigned_camps?: string[]): Promise<{ id: string; camp_name: string; camp_city: string; status: number }[]>;
}
