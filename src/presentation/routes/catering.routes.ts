import { Router } from "express";
import { createCateringController } from "../../main/container/catering.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";

const router = Router();
const controller = createCateringController();

router.get("/bootstrap", tryCatch(controller.bootstrap));
router.get("/dashboard", tryCatch(controller.dashboard));
router.get("/company/dashboard", tryCatch(controller.dashboard));
router.get("/reports/:type", tryCatch(controller.report));
router.get("/company/reports/:type", tryCatch(controller.report));
router.post("/demands/generate", tryCatch(controller.generateDemand));
router.post("/company/work-site-assignments/bulk", tryCatch(controller.assignStaff));
router.post("/company/staff-allocations/bulk", tryCatch(controller.allocateCompanyStaff));
router.post("/:entity/:id/transition", tryCatch(controller.transition));
router.get("/:entity", tryCatch(controller.list));
router.post("/:entity", tryCatch(controller.create));
router.put("/:entity/:id", tryCatch(controller.update));
router.delete("/:entity/:id", tryCatch(controller.remove));

export default router;
