import mongoose, { Document, Schema } from "mongoose";

export interface IContractDocument extends Document {
  _id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;

  // Ownership Semantics
  owner_type: "contract" | "company" | "tenant";
  owner_id: mongoose.Types.ObjectId; // Links to the respective Collection depending on owner_type

  // Optional Cross-Links for fast queries
  contract_id?: mongoose.Types.ObjectId;
  company_id?: mongoose.Types.ObjectId;
  tenant_id?: mongoose.Types.ObjectId;

  document_scope: "company_contract" | "tenant_contract" | "company_compliance" | "tenant_compliance";
  document_type: string;
  title: string;
  document_number: string;
  start_date: Date;
  end_date: Date;
  renewal_reminder_days: number;
  is_restricted: boolean;
  status:
    | "draft"
    | "pending_verification"
    | "active"
    | "pending_renewal_approval"
    | "renewed"
    | "expired"
    | "pending_update_approval"
    | "pending_delete_approval"
    | "rejected"
    | "deleted";
  current_version_id?: mongoose.Types.ObjectId;

  uploaded_by: mongoose.Types.ObjectId;
  uploaded_by_role: string;
  verified_by?: mongoose.Types.ObjectId;
  verified_at?: Date;
  remarks?: string;
  deleted_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const contractDocumentSchema = new Schema<IContractDocument>(
  {
    client_id: {
      type: Schema.Types.ObjectId,
      ref: "client",
      required: true,
      index: true,
    },
    owner_type: {
      type: String,
      required: true,
      enum: ["contract", "company", "tenant"],
      index: true,
    },
    owner_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    contract_id: {
      type: Schema.Types.ObjectId,
      ref: "contracts",
      default: null,
      index: true,
    },
    company_id: {
      type: Schema.Types.ObjectId,
      ref: "companies",
      default: null,
      index: true,
    },
    tenant_id: {
      type: Schema.Types.ObjectId,
      ref: "user_register",
      default: null,
      index: true,
    },
    document_scope: {
      type: String,
      required: true,
      enum: ["company_contract", "tenant_contract", "company_compliance", "tenant_compliance"],
      index: true,
    },
    document_type: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    document_number: {
      type: String,
      required: true,
      trim: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    renewal_reminder_days: {
      type: Number,
      required: true,
      default: 30,
      min: 1,
      max: 365,
    },
    is_restricted: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: [
        "draft",
        "pending_verification",
        "active",
        "pending_renewal_approval",
        "renewed",
        "expired",
        "pending_update_approval",
        "pending_delete_approval",
        "rejected",
        "deleted",
      ],
      default: "draft",
      index: true,
    },
    current_version_id: {
      type: Schema.Types.ObjectId,
      ref: "contract_versions",
      default: null,
    },
    uploaded_by: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    uploaded_by_role: {
      type: String,
      required: true,
    },
    verified_by: {
      type: Schema.Types.ObjectId,
      ref: "user",
      default: null,
    },
    verified_at: {
      type: Date,
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
    },
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ─────────────────────────────────────────────────────────
contractDocumentSchema.index({ client_id: 1, document_number: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } });
contractDocumentSchema.index({ end_date: 1 });

contractDocumentSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id?.toString();
  return object;
});

const ContractDocument = mongoose.model<IContractDocument>(
  "contract_documents",
  contractDocumentSchema
);
export default ContractDocument;
