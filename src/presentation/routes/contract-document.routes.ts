import { Router } from "express";
import multer from "multer";
import { contractDocumentController } from "../../main/container/contract-document.container.js";
import { authorize } from "../../shared/middleware/authorize.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// 1. Approvals routes (placed before parameter paths to avoid overlaps)
router.get("/approvals", authorize("view_contract"), contractDocumentController.listPendingApprovals);
router.post("/approvals/:requestId/approve", authorize("manage_contract_documents"), contractDocumentController.handleApproval);
router.post("/approvals/:requestId/reject", authorize("manage_contract_documents"), contractDocumentController.handleApproval);

// 2. Collection routes
router.get("/", authorize("view_contract"), contractDocumentController.listContractDocuments);
router.post("/", authorize("manage_contract_documents"), upload.single("file"), contractDocumentController.uploadContractDocument);

// 3. Instance routes
router.get("/:id", authorize("view_contract"), contractDocumentController.getContractDocumentById);
router.post("/:id/update", authorize("manage_contract_documents"), upload.single("file"), contractDocumentController.requestUpdate);
router.post("/:id/renew", authorize("manage_contract_documents"), upload.single("file"), contractDocumentController.requestRenewal);
router.post("/:id/delete-request", authorize("manage_contract_documents"), contractDocumentController.requestDelete);

// 4. Access lists
router.get("/:id/staff-access", authorize("manage_contract_documents"), contractDocumentController.getStaffAccessList);
router.post("/:id/staff-access", authorize("manage_contract_documents"), contractDocumentController.updateStaffAccess);

export default router;
