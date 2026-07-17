import express from "express";
import { createTechnicianAssignCampsController } from "../../main/container/technician-assign-camps.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = express.Router();
const controller = createTechnicianAssignCampsController();

// GET  /technician-sites/list-camps           → list sites for dropdown
router.get("/list-camps", tryCatch(controller.listCampsForClient));

// POST /technician-sites/assign               → assign technician to one or many sites
router.post("/assign", tryCatch(controller.assignSites));

// DELETE /technician-sites/unassign           → remove one site from technician
router.delete("/unassign", tryCatch(controller.unassignSite));

// GET /technician-sites/:technician_id/camps  → all camps this technician is assigned to
router.get("/:technician_id/camps", tryCatch(controller.getAssignedCamps));

export default router;
