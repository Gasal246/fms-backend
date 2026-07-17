import type { CounterPointRepository, CounterPointService } from "../../domain/repositories/counter-point.repository.interface.js";
import type {
  CreateCounterPointRequest,
  UpdateCounterPointRequest,
  CounterPointResponse,
  PaginatedCounterPointResponse,
  CounterPointFilter
} from "../../domain/types/counter-point.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export class CounterPointUseCase implements CounterPointService {
  constructor(private counterPointRepository: CounterPointRepository) {
    this.counterPointRepository = counterPointRepository;
  }

  async createCounterPoint(data: CreateCounterPointRequest): Promise<CounterPointResponse> {
    try {
      return await this.counterPointRepository.create(data);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to create counter point", error.statusCode || 500);
    }
  }

  async getCounterPoint(id: string): Promise<CounterPointResponse> {
    const point = await this.counterPointRepository.findById(id);
    if (!point) {
      throw new AppError("Counter Point not found", 404);
    }
    return point;
  }

  async getAllCounterPoints(
    pageNum: number,
    limitNum: number,
    filters: CounterPointFilter,
    client_id: string
  ): Promise<PaginatedCounterPointResponse> {
    const page = pageNum > 0 ? pageNum : 1;
    const limit = limitNum > 0 ? limitNum : 10;
    return await this.counterPointRepository.findAll(page, limit, filters, client_id);
  }

  async updateCounterPoint(id: string, data: UpdateCounterPointRequest): Promise<CounterPointResponse> {
    try {
      return await this.counterPointRepository.update(id, data);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to update counter point", error.statusCode || 500);
    }
  }

  async deleteCounterPoint(id: string, userId: string): Promise<void> {
    try {
      await this.counterPointRepository.delete(id, userId);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to delete counter point", error.statusCode || 500);
    }
  }

  async activateCounterPoint(id: string, userId: string): Promise<CounterPointResponse> {
    try {
      return await this.counterPointRepository.updateStatus(id, "active", userId);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to activate counter point", error.statusCode || 500);
    }
  }

  async deactivateCounterPoint(id: string, userId: string): Promise<CounterPointResponse> {
    try {
      return await this.counterPointRepository.updateStatus(id, "inactive", userId);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to deactivate counter point", error.statusCode || 500);
    }
  }
}
