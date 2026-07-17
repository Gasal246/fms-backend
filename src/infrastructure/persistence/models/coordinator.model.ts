import mongoose, { Document, Schema } from "mongoose";

export interface ICoordinator extends Document {
  client_id: mongoose.Types.ObjectId | null;
  camp_id?: mongoose.Types.ObjectId | null;
  zone_id?: mongoose.Types.ObjectId | null;
  role_id: any;
  full_name: string;
  email: string;
  phone: string;
  password: string;
  status: number;
  is_mess_management: number;
  is_water_management: number;
  is_internet_management: number;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  deleted_at: Date;
  profile_picture: string;
  uuid: string;
}

const coordinatorSchema = new Schema(
  {
    client_id: { type: Schema.Types.ObjectId, ref: "client" },
    camp_id: { type: Schema.Types.ObjectId, ref: "camp" },
    zone_id: { type: Schema.Types.ObjectId, ref: "camp_zones" },
    role_id: { type: Schema.Types.Mixed, ref: "Role" },

    full_name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },

    password: {
      type: String,
      required: true,
    },

    uuid: {
      type: String,
      default: "",
    },

    // 0=delete,1=active,2=pending,3=block
    status: {
      type: Number,
      enum: [0, 1, 2, 3],
      default: 1
    },

    //0=disable,1=enable
    is_mess_management: {
      type: Number,
      enum: [0, 1],
      required: true,
      default: 0
    },

    //0=disable,1=enable
    is_water_management: {
      type: Number,
      enum: [0, 1],
      required: true,
      default: 0
    },

    //0=disable,1=enable
    is_internet_management: {
      type: Number,
      enum: [0, 1],
      required: true,
      default: 0
    },

    deleted_at: {
      type: Date,
    },

    isAdmin: {
      type: Boolean,
      default: false,
    },

    profile_picture: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

coordinatorSchema.method("toJSON", function () {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const Coordinator = mongoose.model<ICoordinator>("coordinator", coordinatorSchema);
export default Coordinator;
