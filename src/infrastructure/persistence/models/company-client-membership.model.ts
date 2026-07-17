import mongoose, { Schema, type Document } from "mongoose";

export const COMPANY_MEMBERSHIP_STATUSES = ["PendingCompanyApproval", "ApprovedAwaitingClientSetup", "PendingAccountSetup", "Active", "Rejected", "Suspended", "Revoked"] as const;
export type CompanyMembershipStatus = typeof COMPANY_MEMBERSHIP_STATUSES[number];

export interface ICompanyClientMembership extends Document {
  global_company_account_id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;
  company_id?: mongoose.Types.ObjectId | null;
  status: CompanyMembershipStatus;
  requested_by: mongoose.Types.ObjectId;
  requested_at: Date;
  responded_at?: Date | null;
  activated_at?: Date | null;
  rejection_reason?: string;
  history: Array<{ from?: string; to: string; actor_id: mongoose.Types.ObjectId; actor_role: string; remarks?: string; at: Date }>;
  deleted_at?: Date | null;
}

const schema = new Schema<ICompanyClientMembership>({
  global_company_account_id: { type: Schema.Types.ObjectId, ref: "global_company_accounts", required: true, index: true },
  client_id: { type: Schema.Types.ObjectId, ref: "client", required: true, index: true },
  company_id: { type: Schema.Types.ObjectId, ref: "companies", default: null, index: true },
  status: { type: String, enum: COMPANY_MEMBERSHIP_STATUSES, required: true, index: true },
  requested_by: { type: Schema.Types.ObjectId, required: true },
  requested_at: { type: Date, default: Date.now },
  responded_at: { type: Date, default: null },
  activated_at: { type: Date, default: null },
  rejection_reason: { type: String, default: "" },
  history: [{ from: String, to: { type: String, required: true }, actor_id: Schema.Types.ObjectId, actor_role: String, remarks: String, at: { type: Date, default: Date.now } }],
  deleted_at: { type: Date, default: null },
}, { timestamps: true });

schema.index({ global_company_account_id: 1, client_id: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } });
schema.index({ global_company_account_id: 1, status: 1, createdAt: 1 });

export default mongoose.model<ICompanyClientMembership>("company_client_memberships", schema);

