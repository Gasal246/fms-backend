import type { CounterRepository, CounterService } from "../../domain/repositories/counter.repository.interface.js";
import type {
  CreateCounterRequest,
  UpdateCounterRequest,
  PaginatedCounterResponse,
  CounterFilter
} from "../../domain/types/counter.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export class CounterUseCase implements CounterService {
  constructor(private counterRepository: CounterRepository) {
    this.counterRepository = counterRepository;
  }

  async createCounter(data: CreateCounterRequest): Promise<any> {
    try {
      return await this.counterRepository.create(data);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to create counter", error.statusCode || 500);
    }
  }

  async getCounter(id: string): Promise<any> {
    const counter = await this.counterRepository.findById(id);
    if (!counter) {
      throw new AppError("Counter not found", 404);
    }
    return counter;
  }

  async getAllCounters(
    pageNum: number,
    limitNum: number,
    filters: CounterFilter,
    client_id: string
  ): Promise<PaginatedCounterResponse> {
    const page = pageNum > 0 ? pageNum : 1;
    const limit = limitNum > 0 ? limitNum : 10;
    return await this.counterRepository.findAll(page, limit, filters, client_id);
  }

  async updateCounter(id: string, data: UpdateCounterRequest): Promise<any> {
    try {
      return await this.counterRepository.update(id, data);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to update counter", error.statusCode || 500);
    }
  }

  async deleteCounter(id: string, userId: string): Promise<void> {
    try {
      await this.counterRepository.delete(id, userId);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to delete counter", error.statusCode || 500);
    }
  }

  async activateCounter(id: string, userId: string): Promise<any> {
    try {
      return await this.counterRepository.updateStatus(id, "Active", userId);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to activate counter", error.statusCode || 500);
    }
  }

  async deactivateCounter(id: string, userId: string): Promise<any> {
    try {
      return await this.counterRepository.updateStatus(id, "Inactive", userId);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || "Failed to deactivate counter", error.statusCode || 500);
    }
  }
}
