import mongoose, { Document, Schema } from "mongoose";

export interface IContractExtensionDetail {
  previous_end_date: Date;
  new_end_date: Date;
  extension_reason?: string;
  document_id?: mongoose.Types.ObjectId | null;
  extended_by: mongoose.Types.ObjectId;
  extended_by_role: string;
  extended_at: Date;
}

export interface IContract extends Document {
  _id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;
  company_id: mongoose.Types.ObjectId;

  // Basic
  contract_number: string;
  contract_name: string;
  billing_model: "Per Room" | "Per Bed" | "Per Head" | "Flat Fee";
  currency: string;
  start_date: Date;
  end_date: Date;
  status: "Draft" | "Pending Approval" | "Approved" | "Active" | "Expiring Soon" | "Expired" | "Suspended" | "Terminated" | "Renewed" | "Scheduled";
  notes?: string;
  auto_renew: boolean;
  max_head_count?: number;
  room_count?: number;
  expire_alert_days?: number;

  // Commercial
  agreed_rate?: number;
  grace_period_days?: number;
  notice_period_days?: number;
  renewal_terms?: string;
  contract_value?: number;
  tax_mode?: string;

  // Compliance / Document flags
  compliance_required: boolean;
  document_checklist?: string[];

  // ── Renewal / Extension chain ──────────────────────────────────
  /** ID of the contract this was renewed from (null for originals) */
  renewedFromContractId?: mongoose.Types.ObjectId | null;
  /** ID of the contract that replaced this one (null if not yet renewed) */
  renewedToContractId?: mongoose.Types.ObjectId | null;
  /** false for originals, true for every renewal */
  isRenewal: boolean;
  /** 1 = original, 2 = first renewal, 3 = second renewal, … */
  renewalVersion: number;

  extensions: IContractExtensionDetail[];

  // Audit
  created_by?: mongoose.Types.ObjectId;
  updated_by?: mongoose.Types.ObjectId;
  termination_reason?: string;
  deleted_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const contractSchema = new Schema<IContract>(
  {
    client_id: {
      type: Schema.Types.ObjectId,
      ref: "client",
      required: true,
      index: true,
    },
    company_id: {
      type: Schema.Types.ObjectId,
      ref: "companies",
      required: true,
      index: true,
    },

    // ── Basic ──────────────────────────────────────────────────────
    contract_number: {
      type: String,
      required: true,
      trim: true,
    },
    contract_name: {
      type: String,
      required: true,
      trim: true,
    },
    billing_model: {
      type: String,
      required: true,
      enum: ["Per Room", "Per Bed", "Per Head", "Flat Fee"],
    },
    currency: {
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
    status: {
      type: String,
      required: true,
      enum: [
        "Draft",
        "Pending Approval",
        "Approved",
        "Active",
        "Expiring Soon",
        "Expired",
        "Suspended",
        "Terminated",
        "Renewed",
        "Scheduled",
      ],
      default: "Draft",
    },
    notes: {
      type: String,
      trim: true,
    },
    auto_renew: {
      type: Boolean,
      default: false,
    },
    expire_alert_days: {
      type: Number,
      default: 30,
      min: 0,
    },
    max_head_count: {
      type: Number,
      min: 0,
    },
    room_count: {
      type: Number,
      min: 0,
    },

    // ── Commercial ─────────────────────────────────────────────────
    agreed_rate: {
      type: Number,
      min: 0,
    },
    grace_period_days: {
      type: Number,
      min: 0,
    },
    notice_period_days: {
      type: Number,
      min: 0,
    },
    renewal_terms: {
      type: String,
      trim: true,
    },
    contract_value: {
      type: Number,
      min: 0,
    },
    tax_mode: {
      type: String,
      trim: true,
    },

    // ── Compliance ─────────────────────────────────────────────────
    compliance_required: {
      type: Boolean,
      default: false,
    },
    document_checklist: [{ type: String, trim: true }],

    // ── Renewal chain ──────────────────────────────────────────────
    renewedFromContractId: {
      type: Schema.Types.ObjectId,
      ref: "contracts",
      default: null,
    },
    renewedToContractId: {
      type: Schema.Types.ObjectId,
      ref: "contracts",
      default: null,
    },
    isRenewal: {
      type: Boolean,
      default: false,
    },
    renewalVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
    extensions: [
      {
        previous_end_date: { type: Date, required: true },
        new_end_date: { type: Date, required: true },
        extension_reason: { type: String, trim: true },
        document_id: { type: Schema.Types.ObjectId, ref: "contract_documents", default: null },
        extended_by: { type: Schema.Types.ObjectId, ref: "coordinator", required: true },
        extended_by_role: { type: String, required: true },
        extended_at: { type: Date, default: Date.now },
      },
    ],

    // ── Audit ──────────────────────────────────────────────────────
    created_by: { type: Schema.Types.ObjectId, ref: "coordinator", default: null },
    updated_by: { type: Schema.Types.ObjectId, ref: "coordinator", default: null },
    termination_reason: { type: String, trim: true, default: "" },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────
contractSchema.index({ client_id: 1, contract_number: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } });
contractSchema.index({ company_id: 1, status: 1 });
contractSchema.index({ end_date: 1 });
contractSchema.index({ client_id: 1, status: 1 });

contractSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const Contract = mongoose.model<IContract>("contracts", contractSchema);
export default Contract;
