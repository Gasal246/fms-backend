import mongoose, { Document } from "mongoose";

export interface IClient extends Document {
  _id: mongoose.Types.ObjectId;
  role_id: mongoose.Types.ObjectId;
  full_name: String;
  email: String;
  password: string;
  business_name: String;
  phone: String;
  business_address: String;
  city: String;
  country: String;
  status: Number;
  no_user: Number;
  no_camp: Number;
  no_cordinator: Number;
  no_pos: Number;
  no_kiosk: Number;
  no_accountant: Number;
  is_mess_management: Number;
  is_water_management: Number;
  is_internet_management: Number;
  subscription_start: Date;
  subscription_end: Date;
  grace_period_days: Date;
  payment_type: String;
  package_rate: Number;
  is_investor_management: Number;
  currency_code: String;
  deleted_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new mongoose.Schema(
  {
    role_id: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
    full_name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    business_name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    business_address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    country: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "countries",
    },
    // 0=delete,1=active,2=pending,3=block
    status: {
      type: Number,
      enum: [0, 1, 2, 3],
      required: true,
    },

    deleted_at: {
      type: Date,
    },

    no_user: {
      type: Number,
      required: true,
    },
    no_camp: {
      type: Number,
      required: true,
    },
    no_cordinator: {
      type: Number,
      required: true,
    },
    no_pos: {
      type: Number,
      required: true,
    },
    no_kiosk: {
      type: Number,
      required: true,
    },
    no_accountant: {
      type: Number,
      required: true,
    },

    //0=disable,1=enable
    is_mess_management: {
      type: Number,
      enum: [0, 1],
      required: true,
    },

    //0=disable,1=enable
    is_water_management: {
      type: Number,
      enum: [0, 1],
      required: true,
    },

    //0=disable,1=enable
    is_internet_management: {
      type: Number,
      enum: [0, 1],
      required: true,
    },
    subscription_start: {
      type: Date,
      required: true,
    },
    subscription_end: {
      type: Date,
      required: true,
    },
    grace_period_days: {
      type: Number,
      required: true,
    },
    payment_type: {
      type: String,
      enum: ["ONE-TIME", "SUBSCRIPTION"],
      required: true,
    },

    package_rate: {
      type: Number,
      required: true,
    },

    //1 =yes, 0 =no
    is_investor_management: {
      type: Number,
      enum: [0, 1],
      required: true,
    },

    currency_code: {
      type: String,
      required: true,
    },

    is_companion_allowed: {
      type: Number,
      enum: [0, 1],
      required: true,
    },
    allowed_devices: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);
const Client = mongoose .model<IClient>("client", schema);
export default Client;