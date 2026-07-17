import mongoose from "mongoose";
import type { TenantImportRepository } from "../../domain/repositories/tenant-import.repository.interface.js";
import type {
  TenantImportJobRequest,
  TenantImportJobResponse,
  TenantImportRowResponse,
  PaginatedImportJobResponse,
  RowValidationResult,
  ImportStatus,
} from "../../domain/types/tenant-import.types.js";
import TenantImportJob from "./models/tenant-import-job.model.js";
import TenantImportRow from "./models/tenant-import-row.model.js";

export class MongoTenantImportRepository implements TenantImportRepository {
  private mapJobToResponse(doc: any): TenantImportJobResponse {
    return {
      ...doc,
      id: doc._id?.toString() ?? doc.id,
      client_id: doc.client_id?.toString(),
    } as TenantImportJobResponse;
  }

  private mapRowToResponse(doc: any): TenantImportRowResponse {
    return {
      ...doc,
      id: doc._id?.toString() ?? doc.id,
      import_job_id: doc.import_job_id?.toString(),
      tenant_ref: doc.tenant_ref?.toString(),
    } as TenantImportRowResponse;
  }

  // ── Job CRUD ──────────────────────────────────────────────────
  async createJob(data: TenantImportJobRequest): Promise<TenantImportJobResponse> {
    const created = await TenantImportJob.create({
      client_id: new mongoose.Types.ObjectId(data.client_id),
      file_name: data.file_name,
      import_type: "TENANT",
      import_mode: data.import_mode,
      duplicate_strategy: data.duplicate_strategy,
      allocation_mode: "NONE", // Force NONE as room/bed allocation is removed from import
      uploaded_by: data.uploaded_by,
      status: "Uploaded",
    });
    const doc = await TenantImportJob.findById((created as any)._id).select("-__v").lean();
    return this.mapJobToResponse(doc!);
  }

  async updateJobStatus(
    jobId: string,
    clientId: string,
    status: ImportStatus,
    counters?: Partial<{
      total_rows: number;
      valid_rows: number;
      invalid_rows: number;
      warning_rows: number;
      processed_rows: number;
      imported_rows: number;
      failed_rows: number;
      duplicate_rows: number;
      started_at: Date;
      completed_at: Date;
      error_file_url: string;
      summary: any;

      // Progress fields
      current_batch: number;
      total_batches: number;
      progress_percent: number;
      estimated_completion_at: Date;

      // Audit fields
      confirmed_by: string;
      confirmed_at: Date;
      cancelled_by: string;
      cancelled_at: Date;

      // Retry fields
      retry_count: number;
      last_error: string;
    }>
  ): Promise<TenantImportJobResponse | null> {
    const update: any = { status, ...counters };
    const doc = await TenantImportJob.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(jobId),
        client_id: new mongoose.Types.ObjectId(clientId),
      },
      { $set: update },
      { returnDocument: 'after' }
    )
      .select("-__v")
      .lean();
    if (!doc) return null;
    return this.mapJobToResponse(doc);
  }

  async findJobById(
    jobId: string,
    clientId: string
  ): Promise<TenantImportJobResponse | null> {
    const doc = await TenantImportJob.findOne({
      _id: new mongoose.Types.ObjectId(jobId),
      client_id: new mongoose.Types.ObjectId(clientId),
    })
      .select("-__v")
      .lean();
    if (!doc) return null;
    return this.mapJobToResponse(doc);
  }

  async listJobs(
    clientId: string,
    page: number,
    limit: number
  ): Promise<PaginatedImportJobResponse> {
    const query = { client_id: new mongoose.Types.ObjectId(clientId) };
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      TenantImportJob.find(query)
        .select("-__v")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      TenantImportJob.countDocuments(query),
    ]);
    return {
      items: data.map((d) => this.mapJobToResponse(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Row staging ────────────────────────────────────────────────
  async saveRowResults(
    jobId: string,
    rows: RowValidationResult[]
  ): Promise<void> {
    const CHUNK = 500;
    const jobOId = new mongoose.Types.ObjectId(jobId);
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const docs = chunk.map((r) => {
        const nd = r.normalized_data || {};
        const phone = nd.phone ? String(nd.phone).trim() : "";
        const empId = nd.employee_id ? String(nd.employee_id).trim().toUpperCase() : "";
        const passport = nd.passport_number ? String(nd.passport_number).trim().toUpperCase() : "";
        const nationalId = nd.national_id ? String(nd.national_id).trim() : "";
        // Generate deterministic row fingerprint for within-file duplicate detection/idempotency
        const fingerprint = phone || empId || passport || nationalId
          ? `${phone}:${empId}:${passport}:${nationalId}`
          : "";

        return {
          import_job_id: jobOId,
          row_number: r.row_number,
          raw_data: r.raw_data,
          normalized_data: r.normalized_data,
          validation_status: r.validation_status,
          import_status: "Pending",
          warnings: r.warnings,
          errors: r.errors,
          duplicate_of: r.duplicate_of,
          row_fingerprint: fingerprint || undefined,
        };
      });
      await TenantImportRow.insertMany(docs, { ordered: false });
    }
  }

  async getRowResults(
    jobId: string,
    page: number,
    limit: number,
    statusFilter?: string
  ): Promise<{ rows: TenantImportRowResponse[]; total: number }> {
    const query: any = { import_job_id: new mongoose.Types.ObjectId(jobId) };
    if (statusFilter) query.validation_status = statusFilter;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      TenantImportRow.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ row_number: 1 })
        .lean(),
      TenantImportRow.countDocuments(query),
    ]);

    return {
      rows: data.map((d) => this.mapRowToResponse(d)),
      total,
    };
  }

  async deleteRowResults(jobId: string): Promise<void> {
    await TenantImportRow.deleteMany({
      import_job_id: new mongoose.Types.ObjectId(jobId),
    });
  }
}
