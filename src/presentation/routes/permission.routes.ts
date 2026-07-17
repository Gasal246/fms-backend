import express from "express";
import tryCatch from "../../shared/middleware/asyncHandler.js";
import { createPermissionController } from "../../main/container/permission.container.js";

const router = express.Router();
const controller = createPermissionController();

router.get("/", tryCatch(controller.getAllPermissions));
router.get("/role/:roleId", tryCatch(controller.getPermissionsByRole));
router.post("/assign", tryCatch(controller.assignPermissionsToRole));

export default router;
