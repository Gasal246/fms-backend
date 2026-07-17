import { MachineBindingController } from "../../presentation/controllers/machine-binding.controller.js";
import { MachineBindingUseCase } from "../../application/use-cases/machine-binding.usecase.js";
import { MongoMachineBindingRepository } from "../../infrastructure/persistence/mongo-machine-binding.repository.js";

export function createMachineBindingController() {
  const repository = new MongoMachineBindingRepository();
  const useCase = new MachineBindingUseCase(repository);
  const controller = new MachineBindingController(useCase);

  return controller;
}
