import type { ZoneResponse } from "../types/zone.types.js";

export interface ZoneRepository {
  findById(id: string): Promise<ZoneResponse | null>;
  findAll(client_id: string, camp_id?: string, assigned_camps?: string[], assigned_zones?: string[], search?: string): Promise<ZoneResponse[]>;
}

export interface ZoneService {
  getZone(id: string): Promise<ZoneResponse>;
  getAllZones(client_id: string, camp_id?: string, assigned_camps?: string[], assigned_zones?: string[], search?: string): Promise<ZoneResponse[]>;
}
