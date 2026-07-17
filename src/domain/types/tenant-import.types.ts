export type ImportStatus =
  | "Uploaded"
  | "Validating"
  | "Validation Failed"
  | "Partially Valid"
  | "Ready For Import"
  | "Queued For Import"
  | "Importing"
  | "Completed"
  | "Partially Completed"
  | "Failed"
  | "Cancelled";

export type ImportMode = "CREATE_ONLY" | "UPSERT" | "UPDATE_ONLY";
export type DuplicateStrategy =
  | "SKIP_DUPLICATES"
  | "UPDATE_DUPLICATES"
  | "FAIL_ON_DUPLICATES";
export type AllocationMode =
  | "NONE"
  | "CONTRACT_ONLY"
  | "AUTO_ALLOCATE"
  | "EXPLICIT_ROOM_BED";
export type RowValidationStatus = "Valid" | "Warning" | "Error";
export type RowImportStatus = "Pending" | "Imported" | "Skipped" | "Failed" | "Updated";

// ── Job ────────────────────────────────────────────────────────────

export interface TenantImportJobRequest {
  client_id: string;
  file_name: string;
  import_mode: ImportMode;
  duplicate_strategy: DuplicateStrategy;
  allocation_mode: AllocationMode;
  uploaded_by: string;
}

export interface TenantImportJobResponse {
  id: string;
  client_id: string;
  file_name: string;
  import_type: string;
  status: ImportStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  warning_rows: number;
  processed_rows: number;
  imported_rows: number;
  failed_rows: number;
  duplicate_rows: number;
  started_at?: Date;
  completed_at?: Date;
  uploaded_by: string;
  import_mode: ImportMode;
  duplicate_strategy: DuplicateStrategy;
  allocation_mode: AllocationMode;
  summary?: any;
  error_file_url?: string;
  createdAt: Date;
  updatedAt: Date;

  // Progress/Retry tracking
  current_batch?: number;
  total_batches?: number;
  progress_percent?: number;
  estimated_completion_at?: Date;
  confirmed_by?: string;
  confirmed_at?: Date;
  cancelled_by?: string;
  cancelled_at?: Date;
  retry_count?: number;
  last_error?: string;
}

// ── Row ────────────────────────────────────────────────────────────

export interface TenantImportRowResponse {
  id: string;
  import_job_id: string;
  row_number: number;
  raw_data: Record<string, any>;
  normalized_data: Record<string, any>;
  validation_status: RowValidationStatus;
  import_status: RowImportStatus;
  warnings: string[];
  errors: string[];
  duplicate_of?: string;
  tenant_ref?: string;
  registration_error?: string;
  row_fingerprint?: string;
}

// ── Preview ────────────────────────────────────────────────────────

export interface ImportPreviewResponse {
  job: TenantImportJobResponse;
  rows: TenantImportRowResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Normalized Row (internal) ──────────────────────────────────────

export interface NormalizedImportRow {
  row_number: number;
  raw_data: Record<string, any>;
  employee_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  gender?: string;
  dob?: string;
  phone?: string;
  email?: string;
  nationality?: string;
  passport_number?: string;
  national_id?: string;
  company_code?: string;
  company_id?: string;
  contract_number?: string;
  contract_id?: string;
  site_code?: string;
  site_id?: string;
  building_code?: string;
  building_id?: string;
  room_number?: string;
  room_id?: string;
  bed_number?: string;
  bed_id?: string;
  status?: string;
  custom_fields?: Record<string, any>;
  [key: string]: any;
}

// ── Validation Result (internal) ──────────────────────────────────

export interface RowValidationResult {
  row_number: number;
  raw_data: Record<string, any>;
  normalized_data: NormalizedImportRow;
  validation_status: RowValidationStatus;
  warnings: string[];
  errors: string[];
  duplicate_of?: string;
}

// ── Pagination for job list ────────────────────────────────────────

export interface PaginatedImportJobResponse {
  items: TenantImportJobResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
