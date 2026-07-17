import mongoose, { Document, Schema } from "mongoose";

export interface IZoneAssignCoordinator extends Document {
  zone_id: mongoose.Types.ObjectId;
  coordinator_id: mongoose.Types.ObjectId;
  // 0=delete,1=active,2=pending,3=block
  status: number;
  deleted_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema: Schema = new mongoose.Schema(
  {
    zone_id: { type: mongoose.Schema.Types.ObjectId, ref: "camp_zones", required: true },
    coordinator_id: { type: mongoose.Schema.Types.ObjectId, ref: "coordinator", required: true },
    // 0=delete,1=active,2=pending,3=block
    status: { type: Number, enum: [0, 1, 2, 3], required: true, default: 1 },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound unique index: one coordinator can be assigned to a zone only once
schema.index({ zone_id: 1, coordinator_id: 1 }, { unique: true });

const ZoneAssignCoordinator = mongoose.model<IZoneAssignCoordinator>(
  "zone_assign_coordinator",
  schema
);
export default ZoneAssignCoordinator;
