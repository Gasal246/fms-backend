import express from "express";
import tryCatch from "../../shared/middleware/asyncHandler.js";
import { createRoleController } from "../../main/container/role.container.js";

const router = express.Router();
const controller = createRoleController();

router.get("/", tryCatch(controller.getRoles));

export default router;
