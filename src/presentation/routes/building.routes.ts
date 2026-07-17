import express from "express";
import { createBuildingController } from "../../main/container/building.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = express.Router();
const controller = createBuildingController();

router.get("/", tryCatch(controller.getBuildings));
router.get("/occupancy-summary", tryCatch(controller.getOccupancySummary));
router.get("/:id", tryCatch(controller.getBuilding));

export default router;
