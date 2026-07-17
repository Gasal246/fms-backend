import type { BedHistoryRepository, BedHistoryService } from "../../domain/repositories/bed-history.repository.interface.js";
import type { BedHistoryResponse, BedHistoryFilter, PaginatedBedHistoryResponse } from "../../domain/types/bed-history.types.js";
import { logger } from "../../shared/logger/logger.js";
import { AppError } from "../../shared/utils/AppError.js";

export class BedHistoryUseCase implements BedHistoryService {
  constructor(private bedHistoryRepository: BedHistoryRepository) { }

  async getAllBedHistory(
    page: number,
    limit: number,
    filters?: BedHistoryFilter
  ): Promise<PaginatedBedHistoryResponse> {
    try {
      const pageNum = page > 0 ? page : 1;
      const limitNum = limit > 0 ? limit : 12;
      return await this.bedHistoryRepository.findAll(pageNum, limitNum, filters);
    } catch (error: any) {
      throw new AppError(error.message, error.statusCode || 500);
    }
  }

  async getTenantBedHistory(tenantId: string): Promise<BedHistoryResponse[]> {
    try {
      logger.info("Fetching tenant bed history");
      return await this.bedHistoryRepository.findByTenantId(tenantId);
    } catch (error: any) {
      throw new AppError(error.message, error.statusCode || 500);
    }
  }
}
