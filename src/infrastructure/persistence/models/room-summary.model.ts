import mongoose, { Schema, Document } from "mongoose";

export interface IRoomSummary extends Document {
  room_id: mongoose.Types.ObjectId;
  room_number: string;
  Camp: string;
  Zone: string;
  Building: string;
  Floor: number;
  Capacity: string;
  Occupied: string;
  nationality?: string[];
  country_state?: string[];
  createdAt: Date;
  updatedAt: Date;
  company_id: mongoose.Types.ObjectId | null;
}

const RoomSummarySchema: Schema = new Schema(
  {
    room_id: { type: Schema.Types.ObjectId, ref: "building_rooms", required: true, unique: true },
    room_number: { type: String, required: true },
    Camp: { type: String, required: true },
    Zone: { type: String, required: true },
    Building: { type: String, required: true },
    Floor: { type: Number, required: true },
    Capacity: { type: String, required: true },
    Occupied: { type: String, required: true },
    nationality: { type: [String], default: [] },
    country_state: { type: [String], default: [] },
    company_id: {
      type: Schema.Types.ObjectId,
      ref: "companies",
      default: null
    },
  },
  { timestamps: true }
);

RoomSummarySchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const RoomSummary = mongoose.model<IRoomSummary>("room_summary", RoomSummarySchema);
export default RoomSummary;
