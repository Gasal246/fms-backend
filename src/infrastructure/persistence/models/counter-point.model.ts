import mongoose, { Schema, Document } from "mongoose";

export interface ICounterPoint extends Document {
  client_id: mongoose.Types.ObjectId;
  camp_id: mongoose.Types.ObjectId;
  zone_id: mongoose.Types.ObjectId;
  counter_id: mongoose.Types.ObjectId;
  point_no: string;
  name: string;
  direction_label: "entry" | "exit" | "both";
  description?: string;
  status: "active" | "inactive" | "deleted";
  created_by: mongoose.Types.ObjectId;
  updated_by?: mongoose.Types.ObjectId | null;
  deleted_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CounterPointSchema: Schema = new Schema(
  {
    client_id: { type: Schema.Types.ObjectId, ref: "client", required: true },
    camp_id: { type: Schema.Types.ObjectId, ref: "camp", required: true },
    zone_id: { type: Schema.Types.ObjectId, ref: "camp_zones", required: true },
    counter_id: { type: Schema.Types.ObjectId, ref: "Counter", required: true },
    point_no: { type: String, required: true },
    name: { type: String, required: true },
    direction_label: {
      type: String,
      enum: ["entry", "exit", "both"],
      required: true
    },
    description: { type: String, default: "" },
    status: {
      type: String,
      enum: ["active", "inactive", "deleted"],
      default: "active",
      required: true
    },
    created_by: { type: Schema.Types.ObjectId, ref: "client", required: true },
    updated_by: { type: Schema.Types.ObjectId, ref: "client", default: null },
    deleted_at: { type: Date, default: null }
  },
  { timestamps: true }
);

// Indexes
CounterPointSchema.index({ client_id: 1, point_no: 1 }, { unique: true });
CounterPointSchema.index(
  { client_id: 1, counter_id: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: "deleted" } }
  }
);
CounterPointSchema.index({ camp_id: 1 });
CounterPointSchema.index({ zone_id: 1 });
CounterPointSchema.index({ counter_id: 1 });
CounterPointSchema.index({ status: 1 });

const CounterPoint = mongoose.model<ICounterPoint>("CounterPoint", CounterPointSchema);
export default CounterPoint;
