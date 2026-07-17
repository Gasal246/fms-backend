import mongoose, { Document, Schema } from "mongoose";

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

export interface IImportSummary {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  warning_rows: number;
  processed_rows: number;
  imported_rows: number;
  failed_rows: number;
  duplicate_rows: number;
}

export interface ITenantImportJob extends Document {
  _id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;
  file_name: string;
  original_file_url?: string;
  import_type: "TENANT";
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
  /** @deprecated allocation_mode is always NONE. Kept for backward compatibility. */
  allocation_mode: AllocationMode;

  // ── Progress tracking (Sprint 2) ──────────────────────────────────
  current_batch?: number;
  total_batches?: number;
  progress_percent?: number;
  estimated_completion_at?: Date;

  // ── Audit ────────────────────────────────────────────────
  confirmed_by?: string;
  confirmed_at?: Date;
  cancelled_by?: string;
  cancelled_at?: Date;

  // ── Retry ──────────────────────────────────────────────────
  retry_count?: number;
  last_error?: string;

  summary?: any;
  error_file_url?: string;

  createdAt: Date;
  updatedAt: Date;
}

const tenantImportJobSchema = new Schema<ITenantImportJob>(
  {
    client_id: {
      type: Schema.Types.ObjectId,
      ref: "client",
      required: true,
    },
    file_name: {
      type: String,
      required: true,
      trim: true,
    },
    original_file_url: {
      type: String,
      trim: true,
    },
    import_type: {
      type: String,
      required: true,
      enum: ["TENANT"],
      default: "TENANT",
    },
    status: {
      type: String,
      required: true,
      enum: [
        "Uploaded",
        "Validating",
        "Validation Failed",
        "Partially Valid",
        "Ready For Import",
        "Queued For Import",
        "Importing",
        "Completed",
        "Partially Completed",
        "Failed",
        "Cancelled",
      ],
      default: "Uploaded",
    },

    // Counters
    total_rows: { type: Number, default: 0 },
    valid_rows: { type: Number, default: 0 },
    invalid_rows: { type: Number, default: 0 },
    warning_rows: { type: Number, default: 0 },
    processed_rows: { type: Number, default: 0 },
    imported_rows: { type: Number, default: 0 },
    failed_rows: { type: Number, default: 0 },
    duplicate_rows: { type: Number, default: 0 },

    started_at: { type: Date },
    completed_at: { type: Date },
    uploaded_by: { type: String, required: true, trim: true },

    import_mode: {
      type: String,
      required: true,
      enum: ["CREATE_ONLY", "UPSERT", "UPDATE_ONLY"],
      default: "CREATE_ONLY",
    },
    duplicate_strategy: {
      type: String,
      required: true,
      enum: ["SKIP_DUPLICATES", "UPDATE_DUPLICATES", "FAIL_ON_DUPLICATES"],
      default: "SKIP_DUPLICATES",
    },
    allocation_mode: {
      type: String,
      required: true,
      enum: ["NONE", "CONTRACT_ONLY", "AUTO_ALLOCATE", "EXPLICIT_ROOM_BED"],
      default: "NONE",
    },

    // ── Progress tracking ───────────────────────────────────────
    current_batch:            { type: Number, default: 0 },
    total_batches:            { type: Number, default: 0 },
    progress_percent:         { type: Number, default: 0 },
    estimated_completion_at:  { type: Date },

    // ── Audit fields ────────────────────────────────────────
    confirmed_by:   { type: String, trim: true },
    confirmed_at:   { type: Date },
    cancelled_by:   { type: String, trim: true },
    cancelled_at:   { type: Date },

    // ── Retry support ─────────────────────────────────────
    retry_count:  { type: Number, default: 0 },
    last_error:   { type: String, trim: true },

    summary:        { type: Schema.Types.Mixed },
    error_file_url: { type: String, trim: true },
  },
  { timestamps: true }
);

// ── Indexes ──────────────────────────────────────────────────
tenantImportJobSchema.index({ client_id: 1, status: 1, createdAt: -1 });
tenantImportJobSchema.index({ uploaded_by: 1, createdAt: -1 });
tenantImportJobSchema.index({ createdAt: -1 });
// Partial index for worker queue polling (only jobs needing processing)
tenantImportJobSchema.index(
  { status: 1, createdAt: 1 },
  { partialFilterExpression: { status: { $in: ["Uploaded", "Queued For Import"] } } }
);

tenantImportJobSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const TenantImportJob = mongoose.model<ITenantImportJob>(
  "tenant_import_jobs",
  tenantImportJobSchema
);
export default TenantImportJob;
