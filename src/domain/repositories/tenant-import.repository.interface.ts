import type {
  TenantImportJobResponse,
  TenantImportJobRequest,
  TenantImportRowResponse,
  PaginatedImportJobResponse,
  RowValidationResult,
  ImportStatus,
} from "../types/tenant-import.types.js";

export interface TenantImportRepository {
  createJob(data: TenantImportJobRequest): Promise<TenantImportJobResponse>;

  updateJobStatus(
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
      // Progress
      current_batch: number;
      total_batches: number;
      progress_percent: number;
      estimated_completion_at: Date;
      // Audit
      confirmed_by: string;
      confirmed_at: Date;
      cancelled_by: string;
      cancelled_at: Date;
      // Retry
      retry_count: number;
      last_error: string;
    }>
  ): Promise<TenantImportJobResponse | null>;

  findJobById(
    jobId: string,
    clientId: string
  ): Promise<TenantImportJobResponse | null>;

  listJobs(
    clientId: string,
    page: number,
    limit: number
  ): Promise<PaginatedImportJobResponse>;

  saveRowResults(
    jobId: string,
    rows: RowValidationResult[]
  ): Promise<void>;

  getRowResults(
    jobId: string,
    page: number,
    limit: number,
    statusFilter?: string
  ): Promise<{ rows: TenantImportRowResponse[]; total: number }>;

  deleteRowResults(jobId: string): Promise<void>;
}
