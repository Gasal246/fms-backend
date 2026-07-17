import { MongoCompanyRepository } from "../../infrastructure/persistence/mongo-company.repository.js";
import { CompanyUseCase } from "../../application/use-cases/company.use-case.js";
import { CompanyController } from "../../presentation/controllers/company.controller.js";

const companyRepository = new MongoCompanyRepository();
const companyUseCase = new CompanyUseCase(companyRepository);
export const companyController = new CompanyController(companyUseCase);
