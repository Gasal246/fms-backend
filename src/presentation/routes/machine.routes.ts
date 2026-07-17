import express from "express";

import tryCatch from "../../shared/middleware/asyncHandler.js";
import { createMachineController } from "../../main/container/machine.container.js";

const router = express.Router();
const controller = createMachineController();

router.post("/", tryCatch(controller.createMachine));
router.get("/", tryCatch(controller.getMachines));
router.get("/:id", tryCatch(controller.getMachine));
router.patch("/:id", tryCatch(controller.updateMachine));
router.delete("/:id", tryCatch(controller.deleteMachine));
router.patch("/:id/activate", tryCatch(controller.activateMachine));
router.patch("/:id/deactivate", tryCatch(controller.deactivateMachine));

export default router;
