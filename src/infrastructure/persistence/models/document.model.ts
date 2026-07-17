import mongoose, { Document, Schema } from 'mongoose';

export interface IDocument extends Document {
  tenant_id: mongoose.Types.ObjectId;
  camp_id: mongoose.Types.ObjectId;
  document_type: 'Passport' | 'Government ID' | 'Visa/Residency' | 'Other';
  document_number: string;
  issue_date?: Date | null;
  expiry_date?: Date | null;
  verification_status: 'Pending' | 'Verified' | 'Rejected';
  rejection_reason?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: 'user_register', required: true },
    camp_id: { type: Schema.Types.ObjectId, ref: 'camp', required: true },
    document_type: { type: String, enum: ['Passport', 'Government ID', 'Visa/Residency', 'Other'], required: true },
    document_number: { type: String, default: '' },
    issue_date: { type: Date, default: null },
    expiry_date: { type: Date, default: null },
    verification_status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
    rejection_reason: { type: String, default: '' },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

// Indexes for query performance
documentSchema.index({ tenant_id: 1, document_type: 1 });
documentSchema.index({ camp_id: 1 });
documentSchema.index({ verification_status: 1 });

export const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);
export default DocumentModel;
