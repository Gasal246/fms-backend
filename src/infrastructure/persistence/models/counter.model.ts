import mongoose, { Schema, Document } from "mongoose";

export interface ICounter extends Document {
  client_id: mongoose.Types.ObjectId;
  camp_id: mongoose.Types.ObjectId;
  zone_id: mongoose.Types.ObjectId;
  counter_no: string;
  counter_name: string;
  description?: string;
  status: "Active" | "Inactive" | "Deleted";
  created_by: mongoose.Types.ObjectId;
  updated_by?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const CounterSchema: Schema = new Schema(
  {
    client_id: { type: Schema.Types.ObjectId, ref: "client", required: true },
    camp_id: { type: Schema.Types.ObjectId, ref: "camp", required: true },
    zone_id: { type: Schema.Types.ObjectId, ref: "camp_zones", required: true },
    counter_no: { type: String, required: true },
    counter_name: { type: String, required: true },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Deleted"],
      default: "Active",
      required: true
    },
    created_by: { type: Schema.Types.ObjectId, ref: "client", required: true },
    updated_by: { type: Schema.Types.ObjectId, ref: "client", default: null }
  },
  { timestamps: true }
);

// Indexes
CounterSchema.index({ client_id: 1, counter_no: 1 }, { unique: true });
CounterSchema.index(
  { client_id: 1, counter_name: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: "Deleted" } }
  }
);
CounterSchema.index({ camp_id: 1 });
CounterSchema.index({ zone_id: 1 });
CounterSchema.index({ status: 1 });

const Counter = mongoose.model<ICounter>("Counter", CounterSchema);
export default Counter;
