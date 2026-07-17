import { Router } from "express";
import multer from "multer";
import { tenantImportController } from "../../main/container/tenant-import.container.js";

const router = Router();

// 10 MB file size limit — prevents memory OOM on extremely large uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
    ];
    const allowedExt = [".xlsx", ".xls", ".csv"];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    if (allowed.includes(file.mimetype) || allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx, .xls, and .csv files are allowed"));
    }
  },
});

router.post("/upload", upload.single("file"), tenantImportController.uploadAndValidate);
router.get("/template", tenantImportController.downloadTemplate);
// NOTE: specific sub-routes must come before the generic /:id wildcard
router.get("/:id/status", tenantImportController.getJobStatus);
router.get("/:id/preview", tenantImportController.getPreview);
router.get("/:id/errors", tenantImportController.downloadErrors);
router.post("/:id/confirm", tenantImportController.confirmImport);
router.delete("/:id/cancel", tenantImportController.cancelImport);
router.get("/", tenantImportController.listJobs);
router.get("/:id", tenantImportController.getJobById);

export default router;
