import mongoose, { Document, Schema } from "mongoose";

export type RowValidationStatus = "Valid" | "Warning" | "Error";
export type RowImportStatus = "Pending" | "Imported" | "Skipped" | "Failed" | "Updated";

export interface ITenantImportRow extends Omit<Document, 'errors'> {
  _id: mongoose.Types.ObjectId;
  import_job_id: mongoose.Types.ObjectId;
  row_number: number;
  raw_data: Record<string, any>;
  normalized_data: Record<string, any>;
  validation_status: RowValidationStatus;
  import_status: RowImportStatus;
  warnings: string[];
  errors: string[];
  duplicate_of?: string;
  tenant_ref?: mongoose.Types.ObjectId;
  registration_error?: string;
  row_fingerprint?: string;
  createdAt: Date;
}

const tenantImportRowSchema = new Schema<ITenantImportRow>(
  {
    import_job_id: {
      type: Schema.Types.ObjectId,
      ref: "tenant_import_jobs",
      required: true,
    },
    row_number: {
      type: Number,
      required: true,
    },
    raw_data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    normalized_data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    validation_status: {
      type: String,
      required: true,
      enum: ["Valid", "Warning", "Error"],
    },
    import_status: {
      type: String,
      required: true,
      enum: ["Pending", "Imported", "Skipped", "Failed", "Updated"],
      default: "Pending",
    },
    warnings: [{ type: String }],
    errors: [{ type: String }],
    duplicate_of: {
      type: String,
      trim: true,
    },
    tenant_ref: {
      type: Schema.Types.ObjectId,
      ref: "user_register",
      default: null,
    },
    registration_error: {
      type: String,
      trim: true,
    },
    row_fingerprint: {
      type: String,
      trim: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ── Indexes ─────────────────────────────────────────────────────────
tenantImportRowSchema.index({ import_job_id: 1, validation_status: 1 });
tenantImportRowSchema.index({ import_job_id: 1, import_status: 1 });
tenantImportRowSchema.index({ import_job_id: 1, row_number: 1 });
tenantImportRowSchema.index({ row_fingerprint: 1 });

const TenantImportRow = mongoose.model<ITenantImportRow>(
  "tenant_import_rows",
  tenantImportRowSchema
);
export default TenantImportRow;
