import mongoose, { Document } from "mongoose";

export interface IAttendance extends Document {
  user_id: mongoose.Types.ObjectId;
  user_type: "staff" | "tenant";
  client_id: mongoose.Types.ObjectId;
  date: Date;
  check_in: Date;
  check_out?: Date;
  is_manual: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    user_type: { type: String, enum: ["staff", "tenant"], required: true },
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: "client", required: true },
    date: { type: Date, required: true }, // The day at 00:00:00 to easily query by day
    check_in: { type: Date, required: true },
    check_out: { type: Date },
    is_manual: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true }
);

schema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const Attendance = mongoose.model<IAttendance>("attendance", schema);
export default Attendance;
