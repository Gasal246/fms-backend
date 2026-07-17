import { Router } from "express";
import { userAssignedRoleController } from "../../main/container/user-assigned-role.container.js";

const router = Router();

router.post("/assign", userAssignedRoleController.assignRole);
router.post("/remove", userAssignedRoleController.removeRole);
router.get("/user/:userId", userAssignedRoleController.getRolesByUserId);

export default router;
