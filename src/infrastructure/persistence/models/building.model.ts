import mongoose, { Schema, Document, type ObjectId } from "mongoose";

export interface IZone_buildings extends Document {
  client_id: ObjectId | null;
  camp_id: ObjectId | null;
  zone_id: ObjectId | null;
  building_name: string | null;
  floors: number | null;
  status: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const Zone_buildingsSchema: Schema = new Schema(
  {
    client_id: { type: Schema.Types.ObjectId, ref: "client" },
    camp_id: { type: Schema.Types.ObjectId, ref: "camp" },
    zone_id: { type: Schema.Types.ObjectId, ref: "camp_zones" },
    building_name: { type: String },
    floors: { type: Number },
    status: { type: Number, enum: [0, 1, 2, 3], default: 1 },
  },
  { timestamps: true }
);

Zone_buildingsSchema.method("toJSON", function () {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const Zone_buildings = mongoose.model<IZone_buildings>(
  "zone_buildings",
  Zone_buildingsSchema
);

export default Zone_buildings;
