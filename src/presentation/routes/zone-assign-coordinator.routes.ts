import express from "express";
import { createZoneAssignCoordinatorController } from "../../main/container/zone-assign-coordinator.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = express.Router();
const controller = createZoneAssignCoordinatorController();

// GET  /coordinator-zones/list-zones          → list zones for dropdown
router.get("/list-zones", tryCatch(controller.listZonesForClient));

// POST /coordinator-zones/assign              → assign coordinator to a zone
router.post("/assign", tryCatch(controller.assignZone));

// DELETE /coordinator-zones/unassign         → remove coordinator from a zone
router.delete("/unassign", tryCatch(controller.unassignZone));

// GET /coordinator-zones/:coordinator_id/zones → all zones this coordinator is assigned to
router.get("/:coordinator_id/zones", tryCatch(controller.getAssignedZones));

// GET /coordinator-zones/zones/:zone_id/coordinators → all coordinators for a zone
router.get("/zones/:zone_id/coordinators", tryCatch(controller.getAssignedCoordinators));

export default router;
