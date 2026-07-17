import express from "express";
import { createTenantController } from "../../main/container/tenant.container.js";
import tryCatch from "../../shared/middleware/asyncHandler.js";
import { authorize } from "../../shared/middleware/authorize.js";

const router = express.Router();
const controller = createTenantController();

router.post("/register", tryCatch(controller.register)); 
router.get("/", tryCatch(controller.getAll));
router.get("/document-files/:documentFileId/download", authorize("DOCUMENT_DOWNLOAD"), tryCatch(controller.downloadDocumentFile));
router.get("/:id/basic", tryCatch(controller.getBasicById));
router.get("/:id", tryCatch(controller.getById));
router.put("/:id", tryCatch(controller.edit));
router.delete("/:id", tryCatch(controller.delete));

export default router;
