import { Router } from "express";
import { createCateringController } from "../../main/container/catering.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";
import { authorize } from "../../shared/middleware/authorize.js";

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
router.get("/kitchen-managers", tryCatch(controller.listKitchenManagers));
router.post("/kitchen-managers", tryCatch(controller.createKitchenManager));
router.put("/kitchen-managers/:id", tryCatch(controller.updateKitchenManager));
router.post("/kitchen-managers/:id/reset-password", tryCatch(controller.resetKitchenManagerPassword));
router.delete("/kitchen-managers/:id", tryCatch(controller.removeKitchenManager));
router.get("/kitchen/context", tryCatch(controller.kitchenManagerContext));
router.get("/kitchen/:kitchenId/bootstrap", authorize("view_kitchen_dashboard"), tryCatch(controller.kitchenBootstrap));
router.get("/kitchen/:kitchenId/dashboard", authorize("view_kitchen_dashboard"), tryCatch(controller.kitchenDashboard));
router.get("/kitchen/:kitchenId/preparation-sheet", authorize("manage_kitchen_orders"), tryCatch(controller.kitchenPreparationSheet));
router.get("/kitchen/:kitchenId/reports/:type", authorize("view_kitchen_reports"), tryCatch(controller.kitchenReport));
router.post("/kitchen/orders/:id/actions", authorize("manage_kitchen_orders"), tryCatch(controller.kitchenOrderAction));
router.post("/kitchen/dispatches", authorize("manage_kitchen_dispatches"), tryCatch(controller.createKitchenDispatch));
router.put("/kitchen/dispatches/:id", authorize("manage_kitchen_dispatches"), tryCatch(controller.updateKitchenDispatch));
router.post("/kitchen/dispatches/:id/actions", authorize("manage_kitchen_dispatches"), tryCatch(controller.kitchenDispatchAction));
router.post("/:entity/:id/transition", tryCatch(controller.transition));
router.get("/:entity", tryCatch(controller.list));
router.post("/:entity", tryCatch(controller.create));
router.put("/:entity/:id", tryCatch(controller.update));
router.delete("/:entity/:id", tryCatch(controller.remove));

export default router;
