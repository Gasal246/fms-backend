import { MongoContractAllocationRepository } from "../../infrastructure/persistence/mongo-contract-allocation.repository.js";
import { MongoContractRepository } from "../../infrastructure/persistence/mongo-contract.repository.js";
import { ContractAllocationUseCase } from "../../application/use-cases/contract-allocation.use-case.js";
import { ContractAllocationController } from "../../presentation/controllers/contract-allocation.controller.js";

const allocationRepository = new MongoContractAllocationRepository();
const contractRepository = new MongoContractRepository();
const allocationUseCase = new ContractAllocationUseCase(allocationRepository, contractRepository);
export const contractAllocationController = new ContractAllocationController(allocationUseCase);
