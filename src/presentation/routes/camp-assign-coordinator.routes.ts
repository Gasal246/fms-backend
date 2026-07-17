import express from "express";
import { createCampAssignCoordinatorController } from "../../main/container/camp-assign-coordinator.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = express.Router();
const controller = createCampAssignCoordinatorController();

// GET  /coordinator-sites/list-camps          → list sites for dropdown
router.get("/list-camps", tryCatch(controller.listCampsForClient));

// POST /coordinator-sites/assign              → assign coordinator to a site
router.post("/assign", tryCatch(controller.assignSite));

// DELETE /coordinator-sites/unassign         → remove coordinator from a site
router.delete("/unassign", tryCatch(controller.unassignSite));

// GET /coordinator-sites/:coordinator_id/camps → all camps this coordinator is assigned to
router.get("/:coordinator_id/camps", tryCatch(controller.getAssignedCamps));

// GET /coordinator-sites/camps/:camp_id/coordinators → all coordinators for a camp
router.get("/camps/:camp_id/coordinators", tryCatch(controller.getAssignedCoordinators));

export default router;
