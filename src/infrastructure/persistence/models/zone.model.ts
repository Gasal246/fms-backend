import mongoose, { Schema, Document, type ObjectId } from "mongoose";

export interface ICamp_zones extends Document {
  client_id: ObjectId | null;
  status: number | null;
  camp_id: ObjectId | null;
  zone_name: string | null;
  wm_ssid: string | null;
  wm_pass: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const Camp_zonesSchema: Schema = new Schema(
  {
    client_id: { type: Schema.Types.ObjectId, ref: "client" },
    camp_id: { type: Schema.Types.ObjectId, ref: "camp" },
    zone_name: { type: String },
    wm_ssid: { type: String },
    wm_pass: { type: String },
    status: { type: Number, enum: [0, 1, 2, 3], default: 1 },
  },
  { timestamps: true }
);

Camp_zonesSchema.method("toJSON", function () {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const Camp_zones = mongoose.model<ICamp_zones>("camp_zones", Camp_zonesSchema);

export default Camp_zones;
