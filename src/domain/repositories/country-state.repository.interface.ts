import type { CreateCountryStateRequest, UpdateCountryStateRequest, CountryStateFilter } from "../types/country-state.types.js";

export interface CountryStateRepository {
  create(data: CreateCountryStateRequest): Promise<any>;
  findById(id: string): Promise<any | null>;
  findAll(filter?: CountryStateFilter): Promise<any[]>;
  update(id: string, data: UpdateCountryStateRequest): Promise<any | null>;
  delete(id: string): Promise<void>;
}

export interface CountryStateService {
  createCountryState(data: CreateCountryStateRequest): Promise<any>;
  getCountryState(id: string): Promise<any>;
  getAllCountryStates(filter?: CountryStateFilter): Promise<any[]>;
  updateCountryState(id: string, data: UpdateCountryStateRequest): Promise<any>;
  deleteCountryState(id: string): Promise<void>;
}
