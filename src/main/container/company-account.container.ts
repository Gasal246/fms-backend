import { CompanyAccountUseCase } from "../../application/use-cases/company-account.usecase.js";
import { CompanyAccountController } from "../../presentation/controllers/company-account.controller.js";
import { BcryptHasher } from "../../infrastructure/persistence/security/bcrypt.hasher.js";
import { JwtService } from "../../infrastructure/persistence/security/jwt.service.js";
import { CompanyMailService } from "../../infrastructure/messaging/company-mail.service.js";

export const companyAccountService = new CompanyAccountUseCase(new BcryptHasher(), new JwtService(), new CompanyMailService());
export const companyAccountController = new CompanyAccountController(companyAccountService);

