import mongoose from "mongoose";
import ExcelJS from "exceljs";
import type { TenantImportRepository } from "../../domain/repositories/tenant-import.repository.interface.js";
import type {
  TenantImportJobResponse,
  ImportPreviewResponse,
  PaginatedImportJobResponse,
  NormalizedImportRow,
  RowValidationResult,
  DuplicateStrategy,
} from "../../domain/types/tenant-import.types.js";
import { ImportParserService } from "./import-parser.service.js";
import { ImportValidationEngine } from "./import-validation.engine.js";
import Tenant from "../../infrastructure/persistence/models/tenant.model.js";
import { AppError } from "../../shared/utils/AppError.js";

// ── Batch size for tenant registration (keeps memory bounded) ─────────────
const BATCH_SIZE = 200;

export class TenantImportUseCase {
  constructor(private readonly importRepo: TenantImportRepository) {}

  // ── Phase 1: Upload + Validate ────────────────────────────────

  async uploadAndValidate(params: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    clientId: string;
    uploadedBy: string;
    importMode: "CREATE_ONLY" | "UPSERT" | "UPDATE_ONLY";
    duplicateStrategy: DuplicateStrategy;
    // allocationMode accepted for backward-compat with existing clients but always stored as "NONE"
    allocationMode?: string;
  }): Promise<TenantImportJobResponse> {
    // 1. Create the import job record
    // NOTE: allocation_mode is always stored as "NONE" — allocation is handled
    // by the dedicated Room Allocation module after tenant registration.
    const job = await this.importRepo.createJob({
      client_id: params.clientId,
      file_name: params.originalName,
      import_mode: params.importMode,
      duplicate_strategy: params.duplicateStrategy,
      allocation_mode: "NONE",
      uploaded_by: params.uploadedBy,
    });

    // 2. Parse file
    let rows: NormalizedImportRow[];
    try {
      const isExcel =
        params.mimeType.includes("spreadsheet") ||
        params.mimeType.includes("excel") ||
        params.originalName.toLowerCase().endsWith(".xlsx") ||
        params.originalName.toLowerCase().endsWith(".xls");

      rows = isExcel
        ? await ImportParserService.parseExcel(params.buffer)
        : ImportParserService.parseCsv(params.buffer.toString("utf-8"));
    } catch (parseError: any) {
      await this.importRepo.updateJobStatus(job.id, params.clientId, "Failed", {
        summary: { error: parseError.message },
      });
      throw new AppError(`File parsing failed: ${parseError.message}`, 400);
    }

    if (rows.length === 0) {
      await this.importRepo.updateJobStatus(job.id, params.clientId, "Validation Failed", {
        total_rows: 0,
        summary: { error: "File contains no data rows" },
      });
      throw new AppError("The uploaded file contains no data rows", 400);
    }

    // 3. Stage row results (unvalidated initially — background validation worker will process them)
    const initialRows: RowValidationResult[] = rows.map((r) => ({
      row_number: r.row_number,
      raw_data: r.raw_data ?? {},
      normalized_data: r,
      validation_status: "Valid", // placeholder until background validation starts
      warnings: [],
      errors: [],
    }));

    await this.importRepo.saveRowResults(job.id, initialRows);

    // 4. Update job status to Uploaded (which signals the background validation worker to start)
    const updatedJob = await this.importRepo.updateJobStatus(
      job.id,
      params.clientId,
      "Uploaded",
      {
        total_rows: rows.length,
      }
    );

    return updatedJob!;
  }

  // ── Phase 2: Confirm Import ───────────────────────────────────

  async confirmImport(jobId: string, clientId: string): Promise<TenantImportJobResponse> {
    const job = await this.importRepo.findJobById(jobId, clientId);
    if (!job) throw new AppError("Import job not found", 404);
    if (!["Ready For Import", "Partially Valid", "Validation Failed"].includes(job.status)) {
      throw new AppError(
        `Import job is in status "${job.status}". Only validated jobs can be confirmed.`,
        409
      );
    }

    // Atomically transition the job to Queued For Import for background registration worker
    const updatedJob = await this.importRepo.updateJobStatus(jobId, clientId, "Queued For Import", {
      confirmed_at: new Date(),
    });

    if (!updatedJob) {
      throw new AppError("Failed to confirm import, please try again", 409);
    }

    return updatedJob;
  }

  // ── Cancel ─────────────────────────────────────────────────────

  async cancelImport(jobId: string, clientId: string): Promise<TenantImportJobResponse> {
    const job = await this.importRepo.findJobById(jobId, clientId);
    if (!job) throw new AppError("Import job not found", 404);
    if (["Completed", "Failed", "Cancelled"].includes(job.status)) {
      throw new AppError(`Cannot cancel import in status "${job.status}"`, 409);
    }

    await this.importRepo.deleteRowResults(jobId);
    const updated = await this.importRepo.updateJobStatus(jobId, clientId, "Cancelled");
    return updated!;
  }

  // ── Preview ─────────────────────────────────────────────────────

  async getPreview(
    jobId: string,
    clientId: string,
    page: number,
    limit: number,
    statusFilter?: string
  ): Promise<ImportPreviewResponse> {
    const job = await this.importRepo.findJobById(jobId, clientId);
    if (!job) throw new AppError("Import job not found", 404);

    const { rows, total } = await this.importRepo.getRowResults(
      jobId,
      page,
      limit,
      statusFilter
    );

    return {
      job,
      rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── List + Get ───────────────────────────────────────────────

  async listJobs(
    clientId: string,
    page: number,
    limit: number
  ): Promise<PaginatedImportJobResponse> {
    return this.importRepo.listJobs(clientId, page, limit);
  }

  async getJobById(jobId: string, clientId: string): Promise<TenantImportJobResponse> {
    const job = await this.importRepo.findJobById(jobId, clientId);
    if (!job) throw new AppError("Import job not found", 404);
    return job;
  }

  // ── Template ─────────────────────────────────────────────────

  async downloadTemplate(): Promise<Buffer> {
    return ImportParserService.generateTemplate();
  }

  // ── Error Report ─────────────────────────────────────────────

  async downloadErrors(jobId: string, clientId: string): Promise<Buffer> {
    const job = await this.importRepo.findJobById(jobId, clientId);
    if (!job) throw new AppError("Import job not found", 404);

    // Get all error rows
    let page = 1;
    const limit = 1000;
    const allRows: any[] = [];
    let hasMore = true;

    while (hasMore) {
      const { rows, total } = await this.importRepo.getRowResults(jobId, page, limit, "Error");
      allRows.push(...rows);
      hasMore = (page - 1) * limit + rows.length < total;
      page++;
    }

    // Build Excel report
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Import Errors");

    // Dynamic columns from raw_data keys of first row
    const sampleKeys = allRows.length > 0 ? Object.keys(allRows[0].raw_data ?? {}) : [];
    const baseColumns = [
      { header: "Row #", key: "row_number", width: 10 },
      ...sampleKeys.map((k) => ({ header: k, key: k, width: 20 })),
      { header: "Errors", key: "errors", width: 60 },
      { header: "Warnings", key: "warnings", width: 40 },
    ];
    ws.columns = baseColumns;

    // Style header
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDC2626" } };
    headerRow.height = 22;

    // Data rows
    for (const row of allRows) {
      const rowData: any = {
        row_number: row.row_number,
        errors: row.errors.join("; "),
        warnings: row.warnings.join("; "),
      };
      for (const k of sampleKeys) {
        rowData[k] = row.raw_data[k] ?? "";
      }
      const addedRow = ws.addRow(rowData);
      addedRow.getCell("errors").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFEE2E2" },
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
