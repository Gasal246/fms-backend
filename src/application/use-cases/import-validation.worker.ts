import mongoose from "mongoose";
import TenantImportJob from "../../infrastructure/persistence/models/tenant-import-job.model.js";
import TenantImportRow from "../../infrastructure/persistence/models/tenant-import-row.model.js";
import { ImportValidationEngine } from "./import-validation.engine.js";
import { logger } from "../../shared/logger/logger.js";
import type { NormalizedImportRow } from "../../domain/types/tenant-import.types.js";

const CHUNK_SIZE = 500;

export async function runValidationWorker(): Promise<void> {
  // Find one job with status "Uploaded" (FIFO)
  // Use findOneAndUpdate to atomically lock the job so multiple workers don't pick it up
  const job = await TenantImportJob.findOneAndUpdate(
    { status: "Uploaded" },
    {
      $set: {
        status: "Validating",
        started_at: new Date(),
      },
    },
    { returnDocument: 'after', sort: { createdAt: 1 } }
  );

  if (!job) return;

  logger.info(`[ValidationWorker] Started validation for import job ${job._id} (${job.file_name})`);

  try {
    const clientId = job.client_id.toString();
    let processedCount = 0;
    let hasMore = true;
    let page = 1;

    while (hasMore) {
      // Fetch staged rows in chunks
      const rows = await TenantImportRow.find({ import_job_id: job._id })
        .skip((page - 1) * CHUNK_SIZE)
        .limit(CHUNK_SIZE)
        .sort({ row_number: 1 })
        .lean();

      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      // Convert rows to NormalizedImportRow format
      const normalizedRows: NormalizedImportRow[] = rows.map((r) => r.normalized_data as NormalizedImportRow);

      // Perform validation for this chunk
      let validationResults = await ImportValidationEngine.validateRows(normalizedRows, clientId);

      // Apply duplicate Strategy logic if FAIL_ON_DUPLICATES
      if (job.duplicate_strategy === "FAIL_ON_DUPLICATES") {
        validationResults = validationResults.map((r) => {
          if (r.duplicate_of) {
            const dupWarnings = r.warnings.filter((w) => w.toLowerCase().includes("duplicate"));
            const remainingWarnings = r.warnings.filter((w) => !w.toLowerCase().includes("duplicate"));
            return {
              ...r,
              validation_status: "Error" as const,
              errors: [...r.errors, ...dupWarnings],
              warnings: remainingWarnings,
            };
          }
          return r;
        });
      }

      // Write results back to database in a bulk write operation
      const bulkOps = validationResults.map((r) => ({
        updateOne: {
          filter: { import_job_id: job._id, row_number: r.row_number },
          update: {
            $set: {
              validation_status: r.validation_status,
              warnings: r.warnings,
              errors: r.errors,
              duplicate_of: r.duplicate_of,
              normalized_data: r.normalized_data,
            },
          },
        },
      }));

      if (bulkOps.length > 0) {
        // Cast to any[] to avoid AnyBulkWriteOperation generic strictness on the filter shape
        await TenantImportRow.bulkWrite(bulkOps as any[]);
      }

      processedCount += rows.length;
      page++;

      // Update progress percent
      const progressPercent = Math.min(Math.round((processedCount / job.total_rows) * 100), 99);
      await TenantImportJob.findByIdAndUpdate(job._id, {
        $set: {
          progress_percent: progressPercent,
          current_batch: page - 1,
          total_batches: Math.ceil(job.total_rows / CHUNK_SIZE),
        },
      });
    }

    // Compute final validation statistics
    const [totalRows, validRows, warningRows, invalidRows, duplicateRows] = await Promise.all([
      TenantImportRow.countDocuments({ import_job_id: job._id }),
      TenantImportRow.countDocuments({ import_job_id: job._id, validation_status: "Valid" }),
      TenantImportRow.countDocuments({ import_job_id: job._id, validation_status: "Warning" }),
      TenantImportRow.countDocuments({ import_job_id: job._id, validation_status: "Error" }),
      TenantImportRow.countDocuments({ import_job_id: job._id, duplicate_of: { $ne: null } }),
    ]);

    // Determine final status
    const finalStatus =
      invalidRows === 0
        ? "Ready For Import"
        : validRows > 0
        ? "Partially Valid"
        : "Validation Failed";

    await TenantImportJob.findByIdAndUpdate(job._id, {
      $set: {
        status: finalStatus,
        total_rows: totalRows,
        valid_rows: validRows,
        warning_rows: warningRows,
        invalid_rows: invalidRows,
        duplicate_rows: duplicateRows,
        progress_percent: 100,
        completed_at: new Date(),
      },
    });

    logger.info(`[ValidationWorker] Completed validation for job ${job._id}. Status: ${finalStatus}`);
  } catch (error: any) {
    logger.error(`[ValidationWorker] Error validating job ${job._id}: ${error.message}`);
    await TenantImportJob.findByIdAndUpdate(job._id, {
      $set: {
        status: "Failed",
        last_error: error.message,
        completed_at: new Date(),
      },
    });
  }
}
