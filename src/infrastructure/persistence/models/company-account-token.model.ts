import mongoose, { Schema, type Document } from "mongoose";

export interface ICompanyAccountToken extends Document {
  global_company_account_id: mongoose.Types.ObjectId;
  membership_id: mongoose.Types.ObjectId;
  token_hash: string;
  purpose: "AccountSetup";
  expires_at: Date;
  consumed_at?: Date | null;
}

const schema = new Schema<ICompanyAccountToken>({
  global_company_account_id: { type: Schema.Types.ObjectId, ref: "global_company_accounts", required: true, index: true },
  membership_id: { type: Schema.Types.ObjectId, ref: "company_client_memberships", required: true, index: true },
  token_hash: { type: String, required: true, unique: true },
  purpose: { type: String, enum: ["AccountSetup"], default: "AccountSetup" },
  expires_at: { type: Date, required: true, expires: 0 },
  consumed_at: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model<ICompanyAccountToken>("company_account_tokens", schema);

