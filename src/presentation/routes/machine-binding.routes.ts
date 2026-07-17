import express from "express";
import tryCatch from "../../shared/middleware/asyncHandler.js";
import { createMachineBindingController } from "../../main/container/machine-binding.container.js";

const router = express.Router();
const controller = createMachineBindingController();

router.post("/bind", tryCatch(controller.bindMachine));
router.get("/:id/binding-history", tryCatch(controller.getBindingHistory));
router.get("/:id/binding-status", tryCatch(controller.getBindingStatus));

export default router;
