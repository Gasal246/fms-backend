import express from "express";
import tryCatch from "../../shared/middleware/asyncHandler.js";
import { createStatusController } from "../../main/container/status.container.js";

const router = express.Router();
const controller = createStatusController();

router.get("/", tryCatch(controller.getStatuses));

export default router;
