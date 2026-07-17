import express from "express";
import { createGuestController } from "../../main/container/guest.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = express.Router();
const controller = createGuestController();

router.get("/", tryCatch(controller.getAllGuests));
router.get("/:id", tryCatch(controller.getOneGuest));
router.post("/", tryCatch(controller.createGuest));
router.put("/:id", tryCatch(controller.updateGuest));
router.delete("/:id", tryCatch(controller.deleteGuest));

export default router;
