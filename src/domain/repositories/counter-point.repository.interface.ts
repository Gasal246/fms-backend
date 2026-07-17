import type {
  CreateCounterPointRequest,
  UpdateCounterPointRequest,
  CounterPointResponse,
  PaginatedCounterPointResponse,
  CounterPointFilter
} from "../types/counter-point.types.js";

export interface CounterPointRepository {
  create(data: CreateCounterPointRequest): Promise<CounterPointResponse>;
  findById(id: string): Promise<CounterPointResponse | null>;
  findAll(page: number, limit: number, filters: CounterPointFilter, client_id: string): Promise<PaginatedCounterPointResponse>;
  update(id: string, data: UpdateCounterPointRequest): Promise<CounterPointResponse>;
  delete(id: string, userId: string): Promise<void>;
  updateStatus(id: string, status: "active" | "inactive", userId: string): Promise<CounterPointResponse>;
}

export interface CounterPointService {
  createCounterPoint(data: CreateCounterPointRequest): Promise<CounterPointResponse>;
  getCounterPoint(id: string): Promise<CounterPointResponse>;
  getAllCounterPoints(page: number, limit: number, filters: CounterPointFilter, client_id: string): Promise<PaginatedCounterPointResponse>;
  updateCounterPoint(id: string, data: UpdateCounterPointRequest): Promise<CounterPointResponse>;
  deleteCounterPoint(id: string, userId: string): Promise<void>;
  activateCounterPoint(id: string, userId: string): Promise<CounterPointResponse>;
  deactivateCounterPoint(id: string, userId: string): Promise<CounterPointResponse>;
}
