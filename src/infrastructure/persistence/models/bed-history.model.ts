import mongoose, { Schema, Document, type ObjectId } from "mongoose";

export interface IBedHistory extends Document {
  tenant_id: ObjectId;
  bed_id: ObjectId;
  room_id: ObjectId;
  building_id: ObjectId;
  zone_id: ObjectId;
  camp_id: ObjectId;
  assigned_at: Date;
  unassigned_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const BedHistorySchema: Schema = new Schema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "user_register", required: true },
    bed_id: { type: Schema.Types.ObjectId, ref: "Bed", required: true },
    room_id: { type: Schema.Types.ObjectId, ref: "building_rooms", required: true },
    building_id: { type: Schema.Types.ObjectId, ref: "zone_buildings", required: true },
    zone_id: { type: Schema.Types.ObjectId, ref: "camp_zones", required: true },
    camp_id: { type: Schema.Types.ObjectId, ref: "camp", required: true },
    assigned_at: { type: Date, required: true },
    unassigned_at: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes for efficient location-based lookups
BedHistorySchema.index({ camp_id: 1, unassigned_at: 1 });
BedHistorySchema.index({ zone_id: 1, unassigned_at: 1 });
BedHistorySchema.index({ building_id: 1, unassigned_at: 1 });
BedHistorySchema.index({ room_id: 1, unassigned_at: 1 });
BedHistorySchema.index({ tenant_id: 1, unassigned_at: 1 });


BedHistorySchema.method("toJSON", function () {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const BedHistory = mongoose.model<IBedHistory>("BedHistory", BedHistorySchema);

export default BedHistory;
