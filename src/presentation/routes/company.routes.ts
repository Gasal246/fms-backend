import { Router } from "express";
import { companyController } from "../../main/container/company.container.js";

const router = Router();

// ── CRUD ──────────────────────────────────────────────────────
router.get("/", companyController.getCompanies);           // GET  /companies
router.get("/:id", companyController.getCompanyById);      // GET  /companies/:id
router.post("/", companyController.createCompany);         // POST /companies
router.put("/:id", companyController.updateCompany);       // PUT  /companies/:id
router.delete("/:id", companyController.deleteCompany);    // DELETE /companies/:id

// ── Entity assignment (legacy) ────────────────────────────────
router.post("/:id/assign", companyController.assignEntities);
router.post("/:id/unassign", companyController.unassignEntities);

// ── Custom Summary/Contracts/Stats ────────────────────────────
router.get("/:id/summary", companyController.getCompanySummary);
router.get("/:id/contracts", companyController.getCompanyContracts);
router.get("/:id/tenant-stats", companyController.getCompanyTenantStats);
router.get("/:id/assigned-rooms", companyController.getCompanyAssignedRooms);

export default router;
