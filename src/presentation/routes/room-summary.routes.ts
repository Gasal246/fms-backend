import express from "express";

import tryCatch from "../../shared/middleware/asyncHandler.js";
import { createRoomSummaryController } from "../../main/container/room-summary.container.js";

const router = express.Router();
const controller = createRoomSummaryController();

router.get("/:roomId", tryCatch(controller.getSummary));

export default router;
