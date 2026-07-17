import { CountryStateController } from "../../presentation/controllers/country-state.controller.js";
import { CountryStateUseCase } from "../../application/use-cases/country-state.usecase.js";
import { MongoCountryStateRepository } from "../../infrastructure/persistence/mongo-country-state.repository.js";

export function createCountryStateController() {
  const repository = new MongoCountryStateRepository();
  const useCase = new CountryStateUseCase(repository);
  const controller = new CountryStateController(useCase);
  
  return controller;
}
