import mongoose, { Document, Schema } from 'mongoose';

export interface IDocumentFile extends Document {
  document_id: mongoose.Types.ObjectId;
  original_file_name: string;
  stored_file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: Date;
  status: 'Active' | 'Archived';
  replaced_by?: string | null;
  replaced_at?: Date | null;
  metadata?: any;
}

const documentFileSchema = new Schema<IDocumentFile>(
  {
    document_id: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
    original_file_name: { type: String, required: true },
    stored_file_name: { type: String, required: true },
    mime_type: { type: String, default: '' },
    file_size: { type: Number, default: 0 },
    storage_path: { type: String, required: true },
    uploaded_by: { type: String, default: 'System' },
    uploaded_at: { type: Date, default: Date.now },
    status: { type: String, enum: ['Active', 'Archived'], default: 'Active' },
    replaced_by: { type: String, default: null },
    replaced_at: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

// Indexes
documentFileSchema.index({ document_id: 1 });
documentFileSchema.index({ status: 1 });

export const DocumentFileModel = mongoose.model<IDocumentFile>('DocumentFile', documentFileSchema);
export default DocumentFileModel;
