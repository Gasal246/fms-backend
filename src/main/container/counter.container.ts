import { CounterController } from "../../presentation/controllers/counter.controller.js";
import { CounterUseCase } from "../../application/use-cases/counter.usecase.js";
import { MongoCounterRepository } from "../../infrastructure/persistence/mongo-counter.repository.js";

export function createCounterController() {
  const counterRepository = new MongoCounterRepository();
  const counterUseCase = new CounterUseCase(counterRepository);
  const counterController = new CounterController(counterUseCase);

  return counterController;
}
