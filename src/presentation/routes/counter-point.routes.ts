import express from "express";

import tryCatch from "../../shared/middleware/asyncHandler.js";
import { createCounterPointController } from "../../main/container/counter-point.container.js";

const router = express.Router();
const controller = createCounterPointController();

router.post("/", tryCatch(controller.createCounterPoint));
router.get("/", tryCatch(controller.getCounterPoints));
router.get("/:id", tryCatch(controller.getCounterPoint));
router.patch("/:id", tryCatch(controller.updateCounterPoint));
router.delete("/:id", tryCatch(controller.deleteCounterPoint));
router.patch("/:id/activate", tryCatch(controller.activateCounterPoint));
router.patch("/:id/deactivate", tryCatch(controller.deactivateCounterPoint));

export default router;
