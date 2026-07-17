import express from "express";
import tryCatch from "../../shared/middleware/asyncHandler.js";
import { createBedHistoryController } from "../../main/container/bed-history.container.js";

const router = express.Router();
const controller = createBedHistoryController();

router.get("/", tryCatch(controller.getAllBedHistory));
router.get("/tenant/:tenantId", tryCatch(controller.getTenantBedHistory));

export default router;
