import type { CountryStateRepository, CountryStateService } from "../../domain/repositories/country-state.repository.interface.js";
import type { CreateCountryStateRequest, UpdateCountryStateRequest, CountryStateFilter } from "../../domain/types/country-state.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export class CountryStateUseCase implements CountryStateService {
  constructor(private countryStateRepository: CountryStateRepository) {}

  async createCountryState(data: CreateCountryStateRequest): Promise<any> {
    try {
      return await this.countryStateRepository.create(data);
    } catch (error: any) {
      throw new AppError(error.message, error.statusCode || 500);
    }
  }

  async getCountryState(id: string): Promise<any> {
    const countryState = await this.countryStateRepository.findById(id);
    if (!countryState) {
      throw new AppError("Country State not found", 404);
    }
    return countryState;
  }

  async getAllCountryStates(filter?: CountryStateFilter): Promise<any[]> {
    return this.countryStateRepository.findAll(filter);
  }

  async updateCountryState(id: string, data: UpdateCountryStateRequest): Promise<any> {
    const countryState = await this.countryStateRepository.update(id, data);
    if (!countryState) {
      throw new AppError("Country State not found", 404);
    }
    return countryState;
  }

  async deleteCountryState(id: string): Promise<void> {
    const countryState = await this.countryStateRepository.findById(id);
    if (!countryState) {
      throw new AppError("Country State not found", 404);
    }
    await this.countryStateRepository.delete(id);
  }
}
