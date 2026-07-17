import { MongoContractRepository } from "../../infrastructure/persistence/mongo-contract.repository.js";
import { MongoContractAllocationRepository } from "../../infrastructure/persistence/mongo-contract-allocation.repository.js";
import { ContractUseCase } from "../../application/use-cases/contract.use-case.js";
import { ContractController } from "../../presentation/controllers/contract.controller.js";

const contractRepository = new MongoContractRepository();
const allocationRepository = new MongoContractAllocationRepository();
const contractUseCase = new ContractUseCase(contractRepository, allocationRepository);
export const contractController = new ContractController(contractUseCase);
