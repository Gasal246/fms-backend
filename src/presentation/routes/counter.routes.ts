import express from "express";
import { createCounterController } from "../../main/container/counter.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = express.Router();
const controller = createCounterController();

router.post("/", tryCatch(controller.createCounter));
router.get("/", tryCatch(controller.getCounters));
router.get("/:id", tryCatch(controller.getCounter));
router.put("/:id", tryCatch(controller.updateCounter));
router.delete("/:id", tryCatch(controller.deleteCounter));
router.patch("/:id/activate", tryCatch(controller.activateCounter));
router.patch("/:id/deactivate", tryCatch(controller.deactivateCounter));

export default router;
