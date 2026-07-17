import type {
  CreateCounterRequest,
  UpdateCounterRequest,
  CounterResponse,
  PaginatedCounterResponse,
  CounterFilter
} from "../types/counter.types.js";

export interface CounterRepository {
  create(data: CreateCounterRequest): Promise<any>;
  findById(id: string): Promise<any>;
  findAll(page: number, limit: number, filters: CounterFilter, client_id: string): Promise<PaginatedCounterResponse>;
  update(id: string, data: UpdateCounterRequest): Promise<any>;
  delete(id: string, userId: string): Promise<void>;
  updateStatus(id: string, status: "Active" | "Inactive", userId: string): Promise<any>;
}

export interface CounterService {
  createCounter(data: CreateCounterRequest): Promise<any>;
  getCounter(id: string): Promise<any>;
  getAllCounters(page: number, limit: number, filters: CounterFilter, client_id: string): Promise<PaginatedCounterResponse>;
  updateCounter(id: string, data: UpdateCounterRequest): Promise<any>;
  deleteCounter(id: string, userId: string): Promise<void>;
  activateCounter(id: string, userId: string): Promise<any>;
  deactivateCounter(id: string, userId: string): Promise<any>;
}
