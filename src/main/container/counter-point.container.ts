import { CounterPointController } from "../../presentation/controllers/counter-point.controller.js";
import { CounterPointUseCase } from "../../application/use-cases/counter-point.usecase.js";
import { MongoCounterPointRepository } from "../../infrastructure/persistence/mongo-counter-point.repository.js";


export function createCounterPointController() {
  const counterPointRepository = new MongoCounterPointRepository();
  const counterPointUseCase = new CounterPointUseCase(counterPointRepository);
  const counterPointController = new CounterPointController(counterPointUseCase);

  return counterPointController;
}
