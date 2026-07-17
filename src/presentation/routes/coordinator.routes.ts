import express from "express";
import { createCoordinatorController } from "../../main/container/coordinator.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = express.Router();
const controller = createCoordinatorController();

router.get("/", tryCatch(controller.getAllCoordinators));
router.get("/:id", tryCatch(controller.getOneCoordinator));
router.post("/", tryCatch(controller.createCoordinator));
router.put("/:id", tryCatch(controller.updateCoordinator));
router.delete("/:id", tryCatch(controller.deleteCoordinator));

export default router;
