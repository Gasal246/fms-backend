import mongoose from "mongoose";
import TenantImportJob from "../../infrastructure/persistence/models/tenant-import-job.model.js";
import TenantImportRow from "../../infrastructure/persistence/models/tenant-import-row.model.js";
import Tenant from "../../infrastructure/persistence/models/tenant.model.js";
import { logger } from "../../shared/logger/logger.js";
import type { NormalizedImportRow } from "../../domain/types/tenant-import.types.js";
import { ImportAuditService } from "./import-audit.service.js";

const BATCH_SIZE = 200;

export async function runRegistrationWorker(): Promise<void> {
  // Find one job with status "Queued For Import" (FIFO)
  const job = await TenantImportJob.findOneAndUpdate(
    { status: "Queued For Import" },
    {
      $set: {
        status: "Importing",
        started_at: new Date(),
      },
    },
    { returnDocument: 'after', sort: { createdAt: 1 } }
  );

  if (!job) return;

  logger.info(`[RegistrationWorker] Started registration for import job ${job._id} (${job.file_name})`);

  let importedRows = 0;
  let failedRows = 0;
  let processedRows = 0;

  try {
    const clientId = job.client_id.toString();
    let hasMore = true;
    let page = 1;

    while (hasMore) {
      // Get a batch of rows from staging
      const { rows, total } = await getRowResultsForJob(job._id.toString(), page, BATCH_SIZE);
      if (rows.length === 0) {
        hasMore = false;
        break;
      }

      hasMore = (page - 1) * BATCH_SIZE + rows.length < total;
      page++;

      // Filter rows: only process Valid or Warning rows that are still Pending
      const toProcess = rows.filter(
        (r) =>
          (r.validation_status === "Valid" || r.validation_status === "Warning") &&
          r.import_status === "Pending"
      );

      // Skip rows based on duplicate strategy
      const toRegister = toProcess.filter((r) => {
        if (!r.duplicate_of) return true;
        if (job.duplicate_strategy === "SKIP_DUPLICATES") {
          return false;
        }
        if (job.duplicate_strategy === "FAIL_ON_DUPLICATES") {
          return false;
        }
        return true; // UPDATE_DUPLICATES
      });

      // Track how many are skipped
      const skippedCount = toProcess.length - toRegister.length;
      if (skippedCount > 0) {
        const skippedRowIds = toProcess
          .filter((r) => !toRegister.includes(r))
          .map((r) => r._id);
        
        await TenantImportRow.updateMany(
          { _id: { $in: skippedRowIds } },
          { $set: { import_status: "Skipped" } }
        );
        processedRows += skippedCount;
      }

      // Build batch list
      const batchList: { row: any; doc: any }[] = [];
      const updateList: { row: any; doc: any }[] = [];

      for (const row of toRegister) {
        const nd = row.normalized_data as NormalizedImportRow;

        const nameFull = nd.full_name ?? `${nd.first_name ?? ""} ${nd.last_name ?? ""}`.trim();
        const [firstName, ...lastParts] = nameFull.split(" ");
        const lastName = lastParts.join(" ");

        const tenantDoc: any = {
          client_id: new mongoose.Types.ObjectId(clientId),
          name: nameFull,
          first_name: nd.first_name ?? firstName ?? "",
          last_name: nd.last_name ?? lastName ?? "",
          gender: nd.gender ?? "",
          dob: nd.dob ? new Date(nd.dob) : undefined,
          phone: nd.phone ?? "",
          email: nd.email ? nd.email.toLowerCase().trim() : "",
          nationality: nd.nationality ?? "",
          passport_no: nd.passport_number ?? "",
          national_id: nd.national_id ?? "",
          employee_id: nd.employee_id ?? "",
          company_id: nd.company_id ? new mongoose.Types.ObjectId(nd.company_id) : null,
          contract_id: nd.contract_id ? new mongoose.Types.ObjectId(nd.contract_id) : null,
          custom_data: nd.custom_fields ?? {},
          allocation_status: false, // Force false — allocation is decoupled
          status: 1,
        };

        if (row.duplicate_of && job.duplicate_strategy === "UPDATE_DUPLICATES") {
          updateList.push({ row, doc: tenantDoc });
        } else {
          batchList.push({ row, doc: tenantDoc });
        }
      }

      // ── Handle updates for duplicates ────────────────────────────────────
      const updatedTenantIds: mongoose.Types.ObjectId[] = [];
      for (const item of updateList) {
        try {
          const tenantId = new mongoose.Types.ObjectId(item.row.duplicate_of);
          await Tenant.findByIdAndUpdate(tenantId, { $set: item.doc });
          await TenantImportRow.findByIdAndUpdate(item.row._id, {
            $set: {
              import_status: "Updated",
              tenant_ref: tenantId,
            },
          });
          importedRows++;
          updatedTenantIds.push(tenantId);
        } catch (err: any) {
          await TenantImportRow.findByIdAndUpdate(item.row._id, {
            $set: {
              import_status: "Failed",
              registration_error: err.message,
            },
          });
          failedRows++;
        }
        processedRows++;
      }
      
      if (updatedTenantIds.length > 0) {
        // Fire & forget audit log
        ImportAuditService.logBulkTenantUpdate(updatedTenantIds, job.uploaded_by).catch(err => 
          logger.error(`[RegistrationWorker] Audit log failed for updates: ${err.message}`)
        );
      }

      // ── Handle inserts in bulk ───────────────────────────────────────────
      if (batchList.length > 0) {
        const docsToInsert = batchList.map((b) => b.doc);
        try {
          const insertedDocs = await Tenant.insertMany(docsToInsert, {
            ordered: false,
          });

          // Mongoose populates _id fields on elements of docsToInsert array.
          // Since docsToInsert corresponds directly to batchList, we can bulk update.
          const rowUpdates = batchList.map((b) => ({
            updateOne: {
              filter: { _id: b.row._id },
              update: {
                $set: {
                  import_status: "Imported" as const,
                  tenant_ref: b.doc._id,
                },
              },
            },
          }));

          if (rowUpdates.length > 0) {
            await TenantImportRow.bulkWrite(rowUpdates);
          }
          importedRows += insertedDocs.length;
          
          // Fire & forget audit log
          const insertedIds = docsToInsert.map(d => d._id).filter(id => id);
          if (insertedIds.length > 0) {
            ImportAuditService.logBulkTenantCreation(insertedIds, job.uploaded_by).catch(err => 
              logger.error(`[RegistrationWorker] Audit log failed for full batch insert: ${err.message}`)
            );
          }
        } catch (err: any) {
          // insertMany with ordered: false returns a bulkWriteError where some succeeded and some failed
          const successIds = new Set<string>();
          if (err.insertedDocs) {
            err.insertedDocs.forEach((d: any) => {
              if (d._id) successIds.add(d._id.toString());
            });
          }

          // Generate updates for successes and failures
          const rowUpdates: any[] = [];
          const insertedTenantIds: mongoose.Types.ObjectId[] = [];
          for (const b of batchList) {
            const tenantOId = b.doc._id;
            const tenantIdStr = tenantOId ? tenantOId.toString() : "";
            const wasSuccessful = successIds.has(tenantIdStr) || (!err.insertedDocs && !tenantIdStr);

            if (wasSuccessful) {
              rowUpdates.push({
                updateOne: {
                  filter: { _id: b.row._id },
                  update: {
                    $set: {
                      import_status: "Imported",
                      tenant_ref: tenantOId,
                    },
                  },
                },
              });
              insertedTenantIds.push(tenantOId);
              importedRows++;
            } else {
              rowUpdates.push({
                updateOne: {
                  filter: { _id: b.row._id },
                  update: {
                    $set: {
                      import_status: "Failed",
                      registration_error: err.message || "Bulk insert conflict/error",
                    },
                  },
                },
              });
              failedRows++;
            }
          }

          if (rowUpdates.length > 0) {
            await TenantImportRow.bulkWrite(rowUpdates);
          }
          if (insertedTenantIds.length > 0) {
            ImportAuditService.logBulkTenantCreation(insertedTenantIds, job.uploaded_by).catch(e =>
              logger.error(`[RegistrationWorker] Audit log failed for inserts: ${e.message}`)
            );
          }
        }
        processedRows += batchList.length;
      }

      // Update progress percent
      const progressPercent = Math.min(Math.round((processedCount(job.total_rows, page, BATCH_SIZE) / job.total_rows) * 100), 99);
      await TenantImportJob.findByIdAndUpdate(job._id, {
        $set: {
          progress_percent: progressPercent,
          current_batch: page - 1,
          total_batches: Math.ceil(job.total_rows / BATCH_SIZE),
        },
      });
    }

    // Final status
    const finalStatus =
      failedRows === 0
        ? "Completed"
        : importedRows > 0
        ? "Partially Completed"
        : "Failed";

    await TenantImportJob.findByIdAndUpdate(job._id, {
      $set: {
        status: finalStatus,
        imported_rows: importedRows,
        failed_rows: failedRows,
        processed_rows: processedRows,
        progress_percent: 100,
        completed_at: new Date(),
      },
    });

    logger.info(`[RegistrationWorker] Completed registration for job ${job._id}. Status: ${finalStatus}`);
  } catch (error: any) {
    logger.error(`[RegistrationWorker] Error processing job ${job._id}: ${error.message}`);
    await TenantImportJob.findByIdAndUpdate(job._id, {
      $set: {
        status: "Failed",
        last_error: error.message,
        completed_at: new Date(),
      },
    });
  }
}

// ── Helper functions ────────────────────────────────────────────────────────

function processedCount(totalRows: number, page: number, batchSize: number): number {
  return Math.min((page - 1) * batchSize, totalRows);
}

async function getRowResultsForJob(
  jobId: string,
  page: number,
  limit: number
): Promise<{ rows: any[]; total: number }> {
  const query = { import_job_id: new mongoose.Types.ObjectId(jobId) };
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    TenantImportRow.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ row_number: 1 })
      .lean(),
    TenantImportRow.countDocuments(query),
  ]);
  return { rows, total };
}
