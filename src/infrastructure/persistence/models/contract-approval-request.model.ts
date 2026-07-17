import mongoose, { Document, Schema } from "mongoose";

export interface IContractApprovalRequest extends Document {
  _id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;
  document_id: mongoose.Types.ObjectId; // References the main contract_documents record
  version_id?: mongoose.Types.ObjectId; // References the specific version being approved
  request_type: "upload" | "update" | "renew" | "delete";
  requested_by: mongoose.Types.ObjectId;
  requested_by_role: string;
  requested_at: Date;
  approval_status: "pending" | "approved" | "rejected";
  approved_by?: mongoose.Types.ObjectId;
  approved_at?: Date;
  remarks?: string;
  old_data?: Record<string, any>; // Previous document metadata state (for updates)
  new_data?: Record<string, any>; // Proposed document metadata state
  createdAt: Date;
  updatedAt: Date;
}

const contractApprovalRequestSchema = new Schema<IContractApprovalRequest>(
  {
    client_id: {
      type: Schema.Types.ObjectId,
      ref: "client",
      required: true,
      index: true,
    },
    document_id: {
      type: Schema.Types.ObjectId,
      ref: "contract_documents",
      required: true,
      index: true,
    },
    version_id: {
      type: Schema.Types.ObjectId,
      ref: "contract_versions",
      default: null,
      index: true,
    },
    request_type: {
      type: String,
      required: true,
      enum: ["upload", "update", "renew", "delete"],
      index: true,
    },
    requested_by: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    requested_by_role: {
      type: String,
      required: true,
    },
    requested_at: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    approval_status: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    approved_by: {
      type: Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    approved_at: {
      type: Date,
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
    },
    old_data: {
      type: Schema.Types.Mixed,
      default: null,
    },
    new_data: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

contractApprovalRequestSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id?.toString();
  return object;
});

const ContractApprovalRequest = mongoose.model<IContractApprovalRequest>(
  "contract_approval_requests",
  contractApprovalRequestSchema
);
export default ContractApprovalRequest;
