import { MongoContractDocumentRepository } from "../../infrastructure/persistence/mongo-contract-document.repository.js";
import { MongoContractVersionRepository } from "../../infrastructure/persistence/mongo-contract-version.repository.js";
import { MongoContractApprovalRequestRepository } from "../../infrastructure/persistence/mongo-contract-approval-request.repository.js";
import { MongoContractStaffAccessRepository } from "../../infrastructure/persistence/mongo-contract-staff-access.repository.js";
import { MongoContractNotificationRepository } from "../../infrastructure/persistence/mongo-contract-notification.repository.js";
import { ContractDocumentUseCase } from "../../application/use-cases/contract-document.use-case.js";
import { ContractDocumentController } from "../../presentation/controllers/contract-document.controller.js";

const documentRepository = new MongoContractDocumentRepository();
const versionRepository = new MongoContractVersionRepository();
const approvalRepository = new MongoContractApprovalRequestRepository();
const staffAccessRepository = new MongoContractStaffAccessRepository();
const notificationRepository = new MongoContractNotificationRepository();

const documentUseCase = new ContractDocumentUseCase(
  documentRepository,
  versionRepository,
  approvalRepository,
  staffAccessRepository,
  notificationRepository
);

export const contractDocumentController = new ContractDocumentController(documentUseCase);
