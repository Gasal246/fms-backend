import mongoose, { Document, Schema } from "mongoose";

export interface IGovernmentId {
  _id?: mongoose.Types.ObjectId | string;
  document_type: string;
  document_number: string;
  issue_date: Date;
  expiry_date: Date;
  front_file: string;
  back_file: string;
  verification_status: 'Pending' | 'Verified' | 'Rejected' | 'Expired' | 'Replaced';
  rejection_reason?: string;
}

export interface IVisaResidency {
  _id?: mongoose.Types.ObjectId | string;
  visa_type: string;
  visa_number: string;
  issue_date: Date;
  expiry_date: Date;
  supporting_document: string;
  verification_status: 'Pending' | 'Verified' | 'Rejected' | 'Expired' | 'Replaced';
  rejection_reason?: string;
}

export interface IGenericDocument {
  _id?: mongoose.Types.ObjectId | string;
  file_name: string;
  file_url: string;
  upload_date: Date;
  uploaded_by: string;
  verification_status: 'Pending' | 'Verified' | 'Rejected' | 'Expired' | 'Replaced';
  expiry_date?: Date | null;
  rejection_reason?: string;
}

export interface IActivityLog {
  _id?: mongoose.Types.ObjectId | string;
  action: string;
  performed_by: string;
  date: Date;
}

export interface ITenantCompliance extends Document {
  tenant_id: mongoose.Types.ObjectId;
  first_name: string;
  last_name: string;
  nationality: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  passport_no?: string;
  passport_country?: string;
  passport_issue_date?: Date | null;
  passport_expiry_date?: Date | null;
  passport_image?: string;
  passport_verification_status?: 'Pending' | 'Verified' | 'Rejected' | 'Expired' | 'Replaced';
  passport_rejection_reason?: string;
  government_ids: IGovernmentId[];
  visa_residency: IVisaResidency[];
  documents: IGenericDocument[];
  activity_log: IActivityLog[];
  createdAt: Date;
  updatedAt: Date;
}

const GovernmentIdSchema = new Schema({
  document_type: { type: String, required: true },
  document_number: { type: String, required: true },
  issue_date: { type: Date, required: true },
  expiry_date: { type: Date, required: true },
  front_file: { type: String, default: "" },
  back_file: { type: String, default: "" },
  verification_status: { type: String, enum: ['Pending', 'Verified', 'Rejected', 'Expired', 'Replaced'], default: 'Pending' },
  rejection_reason: { type: String, default: "" }
});

const VisaResidencySchema = new Schema({
  visa_type: { type: String, required: true },
  visa_number: { type: String, required: true },
  issue_date: { type: Date, required: true },
  expiry_date: { type: Date, required: true },
  supporting_document: { type: String, default: "" },
  verification_status: { type: String, enum: ['Pending', 'Verified', 'Rejected', 'Expired', 'Replaced'], default: 'Pending' },
  rejection_reason: { type: String, default: "" }
});

const GenericDocumentSchema = new Schema({
  file_name: { type: String, required: true },
  file_url: { type: String, required: true },
  upload_date: { type: Date, default: Date.now },
  uploaded_by: { type: String, default: "System" },
  verification_status: { type: String, enum: ['Pending', 'Verified', 'Rejected', 'Expired', 'Replaced'], default: 'Pending' },
  expiry_date: { type: Date, default: null },
  rejection_reason: { type: String, default: "" }
});

const ActivityLogSchema = new Schema({
  action: { type: String, required: true },
  performed_by: { type: String, default: "System" },
  date: { type: Date, default: Date.now }
});

const schema = new Schema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "user_register", required: true, unique: true },
    first_name: { type: String, default: "" },
    last_name: { type: String, default: "" },
    nationality: { type: String, default: "" },
    emergency_contact_name: { type: String, default: "" },
    emergency_contact_phone: { type: String, default: "" },
    passport_no: { type: String, default: "" },
    passport_country: { type: String, default: "" },
    passport_issue_date: { type: Date, default: null },
    passport_expiry_date: { type: Date, default: null },
    passport_image: { type: String, default: "" },
    passport_verification_status: { type: String, enum: ['Pending', 'Verified', 'Rejected', 'Expired', 'Replaced'], default: 'Pending' },
    passport_rejection_reason: { type: String, default: "" },
    government_ids: { type: [GovernmentIdSchema], default: [] },
    visa_residency: { type: [VisaResidencySchema], default: [] },
    documents: { type: [GenericDocumentSchema], default: [] },
    activity_log: { type: [ActivityLogSchema], default: [] }
  },
  { timestamps: true }
);

schema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const TenantCompliance = mongoose.model<ITenantCompliance>("tenant_compliance", schema);
export default TenantCompliance;
