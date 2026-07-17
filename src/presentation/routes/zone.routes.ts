import express from "express";
import { createZoneController } from "../../main/container/zone.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = express.Router();
const controller = createZoneController();

router.get("/", tryCatch(controller.getZones));
router.get("/:id", tryCatch(controller.getZone));

export default router;
