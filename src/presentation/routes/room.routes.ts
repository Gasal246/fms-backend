import express from "express";
import { createRoomController } from "../../main/container/room.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = express.Router();
const controller = createRoomController();
router.post("/", tryCatch(controller.createRoom));
router.get("/", tryCatch(controller.getRooms));
router.get("/:id", tryCatch(controller.getRoom));
router.put("/:id", tryCatch(controller.updateRoom));
router.delete("/:id", tryCatch(controller.deleteRoom));

export default router;
