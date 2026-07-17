import type { StatusResponse } from "../types/status.types.js";

export interface StatusRepository {
  findAll(): Promise<StatusResponse[]>;
}

export interface StatusService {
  getAllStatuses(): Promise<StatusResponse[]>;
}
