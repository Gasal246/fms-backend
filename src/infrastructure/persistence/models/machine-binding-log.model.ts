import mongoose, { Schema, Document } from "mongoose";

export interface IMachineBindingLog extends Document {
  client_id: mongoose.Types.ObjectId;
  machine_id: string;
  machine_ref_id?: mongoose.Types.ObjectId | null;
  mac_id: string;
  binding_status: "bound" | "failed";
  ip_address: string;
  user_agent: string;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

const MachineBindingLogSchema: Schema = new Schema(
  {
    client_id: { type: Schema.Types.ObjectId, ref: "client", required: true },
    machine_id: { type: String, required: true },
    machine_ref_id: { type: Schema.Types.ObjectId, ref: "Machine", default: null },
    mac_id: { type: String, required: true },
    binding_status: { type: String, enum: ["bound", "failed"], required: true },
    ip_address: { type: String, required: true },
    user_agent: { type: String, required: true },
    reason: { type: String, default: "" }
  },
  { timestamps: true }
);

MachineBindingLogSchema.index({ client_id: 1 });
MachineBindingLogSchema.index({ machine_id: 1 });
MachineBindingLogSchema.index({ machine_ref_id: 1 });
MachineBindingLogSchema.index({ binding_status: 1 });

const MachineBindingLog = mongoose.model<IMachineBindingLog>("MachineBindingLog", MachineBindingLogSchema);
export default MachineBindingLog;
