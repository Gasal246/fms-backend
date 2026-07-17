import express from "express";
import { createUserController } from "../../main/container/user.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = express.Router();
const controller = createUserController();

router.get("/profile", tryCatch(controller.getProfile));
router.put("/profile", tryCatch(controller.updateProfile));

export default router;
