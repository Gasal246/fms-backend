import mongoose, { Schema, Document } from "mongoose";

export interface IStatus extends Document {
  name: string;
  slug: string;
  code: string;
  deleted_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const StatusSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    code: { type: String, required: true },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

const Status = mongoose.model<IStatus>("statuses", StatusSchema);

export default Status;