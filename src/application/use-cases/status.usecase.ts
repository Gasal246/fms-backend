import type { StatusRepository, StatusService } from "../../domain/repositories/status.repository.interface.js";
import type { StatusResponse } from "../../domain/types/status.types.js";

export class StatusUseCase implements StatusService {
  constructor(private statusRepository: StatusRepository) {}

  async getAllStatuses(): Promise<StatusResponse[]> {
    return this.statusRepository.findAll();
  }
}
