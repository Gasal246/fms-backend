import mongoose, { Document, Schema } from "mongoose";

export interface IBackgroundJob extends Document {
  _id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;
  job_type: "BULK_CONTRACT_TERMINATION";
  target_id: mongoose.Types.ObjectId; // E.g. contract_id
  status: "Pending" | "Processing" | "Completed" | "Failed";
  total_records: number;
  processed_records: number;
  error_message?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

const backgroundJobSchema = new Schema<IBackgroundJob>(
  {
    client_id: {
      type: Schema.Types.ObjectId,
      ref: "client",
      required: true,
      index: true,
    },
    job_type: {
      type: String,
      required: true,
      enum: ["BULK_CONTRACT_TERMINATION"],
    },
    target_id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["Pending", "Processing", "Completed", "Failed"],
      default: "Pending",
    },
    total_records: { type: Number, default: 0 },
    processed_records: { type: Number, default: 0 },
    error_message: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

backgroundJobSchema.index({ client_id: 1, target_id: 1, status: 1 });
backgroundJobSchema.index({ createdAt: -1 });

backgroundJobSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const BackgroundJob = mongoose.model<IBackgroundJob>(
  "background_jobs",
  backgroundJobSchema
);
export default BackgroundJob;
