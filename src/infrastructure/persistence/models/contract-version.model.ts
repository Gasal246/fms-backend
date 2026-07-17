import mongoose, { Document, Schema } from "mongoose";

export interface IContractVersion extends Document {
  _id: mongoose.Types.ObjectId;
  document_id: mongoose.Types.ObjectId; // References the main contract_documents record
  version_no: number;
  file_name: string;
  file_url: string;
  mime_type: string;
  file_size: number;
  start_date: Date;
  end_date: Date;
  uploaded_by: mongoose.Types.ObjectId;
  uploaded_by_role: string;
  upload_date: Date;
  status: "active" | "renewed" | "rejected" | "pending";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contractVersionSchema = new Schema<IContractVersion>(
  {
    document_id: {
      type: Schema.Types.ObjectId,
      ref: "contract_documents",
      required: true,
      index: true,
    },
    version_no: {
      type: Number,
      required: true,
    },
    file_name: {
      type: String,
      required: true,
      trim: true,
    },
    file_url: {
      type: String,
      required: true,
      trim: true,
    },
    mime_type: {
      type: String,
      required: true,
      trim: true,
    },
    file_size: {
      type: Number,
      required: true,
      min: 0,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    uploaded_by: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    uploaded_by_role: {
      type: String,
      required: true,
    },
    upload_date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "renewed", "rejected", "pending"],
      default: "pending",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

contractVersionSchema.index({ document_id: 1, version_no: 1 }, { unique: true });

contractVersionSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id?.toString();
  return object;
});

const ContractVersion = mongoose.model<IContractVersion>(
  "contract_versions",
  contractVersionSchema
);
export default ContractVersion;
