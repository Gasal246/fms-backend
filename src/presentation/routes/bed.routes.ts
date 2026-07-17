import express from "express";
import tryCatch from "../../shared/middleware/asyncHandler.js";
import { createBedController } from "../../main/container/bed.container.js";

const router = express.Router();
const controller = createBedController();

router.post("/", tryCatch(controller.createBed));
router.get("/", tryCatch(controller.getBeds));
router.post("/bulk-allocate", tryCatch(controller.bulkAllocate));
router.get("/:id", tryCatch(controller.getBed));
router.put("/:id", tryCatch(controller.updateBed));
router.delete("/:id", tryCatch(controller.deleteBed));

export default router;
