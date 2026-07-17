import { MachineController } from "../../presentation/controllers/machine.controller.js";
import { MachineUseCase } from "../../application/use-cases/machine.usecase.js";
import { MongoMachineRepository } from "../../infrastructure/persistence/mongo-machine.repository.js";

export function createMachineController() {
  const machineRepository = new MongoMachineRepository();
  const machineUseCase = new MachineUseCase(machineRepository);
  const machineController = new MachineController(machineUseCase);

  return machineController;
}
