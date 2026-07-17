import mongoose, { Document, Schema } from "mongoose";

export interface ITechnicianAssignCamps extends Document {
  client_id: mongoose.Types.ObjectId;
  camp_id: mongoose.Types.ObjectId | mongoose.Types.ObjectId[];
  technician_id: mongoose.Types.ObjectId;
  // 0=inactive, 1=active
  status: number;
  createdAt: Date;
  updatedAt: Date;
}

const TechnicianAssignCampsSchema: Schema = new Schema(
  {
    client_id: { type: Schema.Types.ObjectId, ref: "client", required: true },
    // Support multiple camps per technician (array)
    camp_id: [{ type: Schema.Types.ObjectId, ref: "camp" }],
    technician_id: { type: Schema.Types.ObjectId, ref: "technicians", required: true },
    status: { type: Number, enum: [0, 1], default: 1 },
  },
  { timestamps: true }
);

// One technician has one assignment record per client; camps are stored as array inside
TechnicianAssignCampsSchema.index({ technician_id: 1, client_id: 1 }, { unique: true });

const TechnicianAssignCamps = mongoose.model<ITechnicianAssignCamps>(
  "technician_assign_camps",
  TechnicianAssignCampsSchema
);
export default TechnicianAssignCamps;
