import { Router } from "express";
import { companyAccountController as controller } from "../../main/container/company-account.container.js";
import { authenticate } from "../../shared/middleware/authenticate.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = Router();
router.get("/setup", tryCatch(controller.validateSetup));
router.post("/setup", tryCatch(controller.completeSetup));
router.get("/search", authenticate, tryCatch(controller.search));
router.post("/memberships", authenticate, tryCatch(controller.request));
router.get("/memberships", authenticate, tryCatch(controller.memberships));
router.post("/memberships/:id/respond", authenticate, tryCatch(controller.respond));
router.post("/memberships/:id/cancel", authenticate, tryCatch(controller.cancel));
router.post("/memberships/:id/action", authenticate, tryCatch(controller.manage));
router.post("/memberships/:id/resend", authenticate, tryCatch(controller.resend));
router.post("/context", authenticate, tryCatch(controller.switchContext));
export default router;
