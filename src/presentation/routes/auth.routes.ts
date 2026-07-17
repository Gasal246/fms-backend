import express from "express";
import { createAuthController } from "../../main/container/auth.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";
import { authenticate } from "../../shared/middleware/authenticate.js";

const router = express.Router();
const controller = createAuthController();

router.post("/signin", tryCatch(controller.signIn));
router.get("/roles", tryCatch(controller.getRoles));
router.get("/permissions", authenticate, tryCatch(controller.getPermissions));
router.post("/signout", tryCatch(controller.signOut));

export default router;