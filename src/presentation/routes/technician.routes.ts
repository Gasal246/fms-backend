import express from "express";
import { createTechnicianController } from "../../main/container/technician.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = express.Router();
const controller = createTechnicianController();

router.get("/", tryCatch(controller.getAllTechnicians));
router.get("/:id", tryCatch(controller.getOneTechnician));
router.post("/", tryCatch(controller.createTechnician));
router.put("/:id", tryCatch(controller.updateTechnician));
router.delete("/:id", tryCatch(controller.deleteTechnician));

export default router;
