import mongoose, { Schema, Document } from "mongoose";

export interface IMachine extends Omit<Document, "model"> {
  client_id: mongoose.Types.ObjectId;
  machine_id: string;
  machine_name: string;
  machine_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  description: string;
  mac_id: string | null;
  binding_status: "pending" | "bound" | "unbound";
  assigned_status: "unallocated" | "allocated";
  camp_id: mongoose.Types.ObjectId;
  zone_id: mongoose.Types.ObjectId;
  counter_id: mongoose.Types.ObjectId;
  counter_point_id: mongoose.Types.ObjectId;
  assigned_action: string | null;
  last_ping_at: Date | null;
  status: "active" | "inactive" | "deleted";
  created_by: mongoose.Types.ObjectId;
  updated_by?: mongoose.Types.ObjectId | null;
  deleted_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MachineSchema: Schema = new Schema(
  {
    client_id: { type: Schema.Types.ObjectId, ref: "client", required: true },
    machine_id: { type: String, required: true },
    machine_name: { type: String, required: true },
    machine_type: { type: String, required: true },
    manufacturer: { type: String, default: "" },
    model: { type: String, default: "" },
    serial_number: { type: String, default: "" },
    description: { type: String, default: "" },
    mac_id: { type: String, default: null },
    binding_status: {
      type: String,
      enum: ["pending", "bound", "unbound"],
      default: "pending",
      required: true
    },
    assigned_status: {
      type: String,
      enum: ["unallocated", "allocated"],
      default: "unallocated",
      required: true
    },
    camp_id: { type: Schema.Types.ObjectId, ref: "camp", required: true },
    zone_id: { type: Schema.Types.ObjectId, ref: "camp_zones", required: true },
    counter_id: { type: Schema.Types.ObjectId, ref: "Counter", required: true },
    counter_point_id: { type: Schema.Types.ObjectId, ref: "CounterPoint", required: true },
    assigned_action: { type: String, default: null },
    last_ping_at: { type: Date, default: null },
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
MachineSchema.index({ client_id: 1, machine_id: 1 }, { unique: true });

// Enforce unique serial_number per client if serial_number is non-empty and non-null, and status is not deleted
MachineSchema.index(
  { client_id: 1, serial_number: 1 },
  {
    unique: true,
    partialFilterExpression: {
      serial_number: { $type: "string", $ne: "" },
      status: { $ne: "deleted" }
    }
  }
);

MachineSchema.index({ camp_id: 1 });
MachineSchema.index({ zone_id: 1 });
MachineSchema.index({ counter_id: 1 });
MachineSchema.index({ counter_point_id: 1 });
MachineSchema.index({ status: 1 });

const Machine = mongoose.model<IMachine>("Machine", MachineSchema);
export default Machine;
