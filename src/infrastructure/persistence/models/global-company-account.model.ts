import mongoose, { Schema, type Document } from "mongoose";

export interface IGlobalCompanyAccount extends Document {
  company_name: string;
  normalized_name: string;
  login_email: string;
  password: string | null;
  logo?: string | null;
  status: "PendingSetup" | "Active" | "Suspended";
  setup_completed_at?: Date | null;
  deleted_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IGlobalCompanyAccount>({
  company_name: { type: String, required: true, trim: true },
  normalized_name: { type: String, required: true, trim: true, index: true },
  login_email: { type: String, required: true, trim: true, lowercase: true },
  password: { type: String, default: null, select: false },
  logo: { type: String, default: null },
  status: { type: String, enum: ["PendingSetup", "Active", "Suspended"], default: "PendingSetup", index: true },
  setup_completed_at: { type: Date, default: null },
  deleted_at: { type: Date, default: null },
}, { timestamps: true });

schema.index({ login_email: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } });
schema.index({ normalized_name: "text", company_name: "text", login_email: "text" });

export default mongoose.model<IGlobalCompanyAccount>("global_company_accounts", schema);

