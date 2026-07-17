import express from "express";
import { createCampController } from "../../main/container/camp.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = express.Router();
const controller = createCampController();

router.get("/", tryCatch(controller.getAllCamps));
router.get("/occupancy", tryCatch(controller.getOccupancySummary));
router.get("/:id", tryCatch(controller.getCamp));

export default router;
