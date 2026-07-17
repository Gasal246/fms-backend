import type { Response } from "express";
import { TenantImportUseCase } from "../../application/use-cases/tenant-import.use-case.js";
import { successResponse } from "../../shared/utils/responseHandler.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";
import { AppError } from "../../shared/utils/AppError.js";

export class TenantImportController {
  constructor(private readonly importUseCase: TenantImportUseCase) {}

  uploadAndValidate = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const client_id = req.user.client_id as string;
      const file = req.file;
      if (!file) throw new AppError("No import file uploaded", 400);

      const importMode = (req.body.importMode ?? "CREATE_ONLY") as any;
      const duplicateStrategy = (req.body.duplicateStrategy ?? "SKIP_DUPLICATES") as any;
      // allocationMode is accepted for backward-compat but silently stored as "NONE"
      const allocationMode = (req.body.allocationMode ?? "NONE") as any;

      logger.info(`Starting upload and validation for file: ${file.originalname}`);
      const job = await this.importUseCase.uploadAndValidate({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        clientId: client_id,
        uploadedBy: req.user.id as string,
        importMode,
        duplicateStrategy,
        allocationMode,
      });

      // 202 Accepted — background validation worker will process rows asynchronously.
      // Frontend should poll GET /:id/status until status is no longer "Uploaded"/"Validating".
      return successResponse(res, job, "File uploaded. Background validation started.", 202);
    } catch (error: any) {
      logger.error(`Error uploading and validating file: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to upload and validate file" });
    }
  };

  getPreview = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = req.params.id as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const statusFilter = req.query.status as string;
      const client_id = req.user.client_id as string;

      logger.info(`Fetching preview for job: ${jobId}`);
      const preview = await this.importUseCase.getPreview(jobId, client_id, page, limit, statusFilter);
      return successResponse(res, preview, "Preview retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching job preview: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to fetch job preview" });
    }
  };

  confirmImport = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = req.params.id as string;
      const client_id = req.user.client_id as string;
      logger.info(`Confirming import for job: ${jobId}`);
      const result = await this.importUseCase.confirmImport(jobId, client_id);

      // 202 Accepted — registration worker will process in the background.
      // Frontend should poll GET /:id/status until status is "Completed"/"Failed".
      return successResponse(res, result, "Import confirmed. Background registration started.", 202);
    } catch (error: any) {
      logger.error(`Error confirming import: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to confirm import" });
    }
  };

  cancelImport = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = req.params.id as string;
      const client_id = req.user.client_id as string;
      logger.info(`Cancelling import for job: ${jobId}`);
      const result = await this.importUseCase.cancelImport(jobId, client_id);
      return successResponse(res, result, "Import job cancelled successfully", 200);
    } catch (error: any) {
      logger.error(`Error cancelling import: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to cancel import" });
    }
  };

  listJobs = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const client_id = req.user.client_id as string;

      logger.info(`Listing import jobs`);
      const result = await this.importUseCase.listJobs(client_id, page, limit);
      return successResponse(res, result, "Import jobs retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error listing jobs: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve import jobs" });
    }
  };

  getJobById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = req.params.id as string;
      const client_id = req.user.client_id as string;
      logger.info(`Fetching import job: ${jobId}`);
      const job = await this.importUseCase.getJobById(jobId, client_id);
      return successResponse(res, job, "Import job retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching job: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve import job" });
    }
  };

  /**
   * Lightweight status endpoint designed for polling.
   * Returns only progress fields — no row data.
   * Frontend polls this every 2–3 seconds during Validating/Importing phases.
   */
  getJobStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = req.params.id as string;
      const client_id = req.user.client_id as string;

      const job = await this.importUseCase.getJobById(jobId, client_id);

      const statusPayload = {
        id:                     job.id,
        status:                 job.status,
        progress_percent:       job.progress_percent ?? 0,
        current_batch:          job.current_batch ?? 0,
        total_batches:          job.total_batches ?? 0,
        total_rows:             job.total_rows,
        valid_rows:             job.valid_rows,
        invalid_rows:           job.invalid_rows,
        warning_rows:           job.warning_rows,
        duplicate_rows:         job.duplicate_rows,
        imported_rows:          job.imported_rows,
        failed_rows:            job.failed_rows,
        processed_rows:         job.processed_rows,
        estimated_completion_at: job.estimated_completion_at ?? null,
        last_error:             job.last_error ?? null,
      };

      return successResponse(res, statusPayload, "Job status retrieved", 200);
    } catch (error: any) {
      logger.error(`Error fetching job status: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve job status" });
    }
  };

  downloadTemplate = async (req: AuthenticatedRequest, res: Response) => {
    try {
      logger.info(`Generating Excel import template`);
      const buffer = await this.importUseCase.downloadTemplate();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="tenant_import_template.xlsx"');
      return res.status(200).send(buffer);
    } catch (error: any) {
      logger.error(`Error downloading template: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to download template" });
    }
  };

  downloadErrors = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = req.params.id as string;
      const client_id = req.user.client_id as string;
      logger.info(`Generating error report for job: ${jobId}`);
      const buffer = await this.importUseCase.downloadErrors(jobId, client_id);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="import_errors_${jobId}.xlsx"`);
      return res.status(200).send(buffer);
    } catch (error: any) {
      logger.error(`Error downloading error report: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to download error report" });
    }
  };
}
