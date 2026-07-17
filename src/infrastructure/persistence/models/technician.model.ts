import mongoose, { Document, model, Schema } from "mongoose";

export interface ITechnician extends Document {
  name: string;
  email: string;
  password: string;
  phone: string;
  role_id: any;
  client_id: mongoose.Types.ObjectId;
  isAdmin: boolean;
  status: number;
  skills: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  deleted_at?: Date | null;
  profile_picture?: string;
}

const TechnicianSchema: Schema = new Schema(
  {
    name: { type: String },
    email: { type: String },
    password: { type: String },
    phone: { type: String },
    role_id: { type: Schema.Types.Mixed, ref: "Role" },
    client_id: { type: Schema.Types.ObjectId, ref: "client" },
    isAdmin: { type: Boolean, default: false },
    status: { type: Number, enum: [0, 1], default: 1 },
    skills: [{ type: Schema.Types.ObjectId }],
    deleted_at: { type: Date, default: null },
    profile_picture: { type: String, default: '' },
  },
  { timestamps: true }
);

TechnicianSchema.method("toJSON", function () {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const TechnicianModel = model<ITechnician>("technicians", TechnicianSchema);
export default TechnicianModel;
