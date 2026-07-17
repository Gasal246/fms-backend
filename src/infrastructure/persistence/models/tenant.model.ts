import mongoose, { Document } from "mongoose";
import type { type } from "node:os";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;
  company_id?: mongoose.Types.ObjectId;
  camp_id?: mongoose.Types.ObjectId;
  username: string;
  name: string;
  email: string;
  password: string;
  country_code: number;
  phone: string;
  dob: Date;
  age: number;
  gender: string;
  country_id: mongoose.Types.ObjectId;
  country_state?: string;
  home_address: string;
  blood_group: string;
  company_name: string;
  job_title: string;
  passport_no: string;
  uuid: string;
  driver_licence_no: string;
  visa_number: string;
  national_id_type: mongoose.Types.ObjectId;
  national_id: string;
  national_id_issue_at: Date;
  national_id_expiry_at: Date;
  user_image: string;
  passport_image: string;
  zone_id: mongoose.Types.ObjectId;
  building_id: mongoose.Types.ObjectId;
  floor_no: number;
  room_id: mongoose.Types.ObjectId;
  api_token: string;
  created_by: mongoose.Types.ObjectId;
  status: number;
  otp: number;
  has_transfer_request: number;
  device_mac_id: string | null;
  expo_push_token: string;
  new_phone: string;
  client_mac_id: string;
  socket_id: string | null;
  next_mobile_change_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
  is_new_user: boolean;
  type: string;
  allocation_status: boolean;
  contract_end_date?: Date | null;
  deleted_at: Date | null;
  nationality?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;

  // ── Contract + Import extensions ──────────────────────────
  contract_id?: mongoose.Types.ObjectId;
  employee_id?: string;
  custom_data?: Record<string, any>;
}

const schema = new mongoose.Schema(
  {
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: "client" },
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: "companies", default: null },
    camp_id: { type: mongoose.Schema.Types.ObjectId, ref: "camp", default: null },
    user_name: {
      default: "",
      type: String,
    },
    client_mac_id: {
      type: String,
    },
    name: {
      default: "",
      type: String,
    },
    email: {
      default: "",
      type: String,
    },
    password: {
      default: "",
      type: String,
    },
    country_code: {
      type: Number,
    },
    phone: {
      type: String,
    },
    dob: {
      type: Date,
    },
    age: {
      default: 0,
      type: Number,
    },
    gender: {
      default: "",
      type: String,
    },

    country_id: { type: mongoose.Schema.Types.ObjectId, ref: "countries" },
    country_state: { type: String, default: "" },

    home_address: {
      default: "",
      type: String,
    },
    blood_group: {
      default: "",
      type: String,
    },
    company_name: {
      default: "",
      type: String,
    },
    job_title: {
      default: "",
      type: String,
    },
    passport_no: {
      default: "",
      type: String,
    },
    uuid: {
      default: "",
      type: String,
    },
    driver_licence_no: {
      default: "",
      type: String,
    },
    visa_number: {
      default: "",
      type: String,
    },
    national_id_type: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "national_type",
    },

    national_id: {
      default: "",
      type: String,
    },
    national_id_issue_at: {
      type: Date,
    },
    national_id_expiry_at: {
      type: Date,
    },

    user_image: {
      default: "",
      type: String,
    },
    passport_image: {
      default: "",
      type: String,
    },
    api_token: {
      default: "",
      type: String,
    },

    created_by: { type: mongoose.Schema.Types.ObjectId },

    // 0=delete,1=active,2=pending,3=block,4=deActive,5=Unverified,
    status: {
      type: Number,
      enum: [0, 1, 2, 3, 4, 5],
    },
    otp: {
      type: Number,
    },
    has_transfer_request: {
      type: Number,
      default: 0,
    },
    wallet_balance: {
      default: 0.0,
      type: Number,
    },
    zone_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "camp_zones",
    },
    building_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "zone_buildings",
    },
    room_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "building_rooms",
    },
    floor_no: {
      default: "",
      type: String,
    },
    device_mac_id: {
      default: "",
      type: String,
    },
    expo_push_token: {
      default: "",
      type: String,
    },
    new_phone: {
      default: "0",
      type: String,
    },
    is_new_user: {
      default: false,
      type: Boolean,
    },
    socket_id: {
      type: String,
    },
    next_mobile_change_at: {
      type: Date,
    },
    type: {
      type: String,
      enum: ["client", "individual"],
      default: "individual",
    },
    allocation_status: {
      type: Boolean,
      default: false,
    },
    contract_end_date: {
      type: Date,
      default: null,
    },

    deleted_at: {
      type: Date,
      default: null,
    },
    nationality: {
      type: String,
      default: "",
    },
    emergency_contact_name: {
      type: String,
      default: "",
    },
    emergency_contact_phone: {
      type: String,
      default: "",
    },

    // ── Contract + Import extensions ──────────────────────────
    contract_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "contracts",
      default: null,
    },
    employee_id: {
      type: String,
      trim: true,
      default: "",
    },
    custom_data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// ── Indexes for GET /tenant filter performance ─────────────────────────────
// Compound with client_id so queries scoped to a client hit a tight index
schema.index({ client_id: 1, camp_id: 1 });
schema.index({ client_id: 1, zone_id: 1 });
schema.index({ client_id: 1, building_id: 1 });
schema.index({ client_id: 1, room_id: 1 });
schema.index({ client_id: 1, allocation_status: 1 });
schema.index({ contract_id: 1 });
schema.index({ room_id: 1, allocation_status: 1 });
// Text-style fields — use collation-friendly single indexes for regex support
schema.index({ name: 1 });
schema.index({ email: 1 });


schema.method("toJSON", function () {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const UserRegister = mongoose.model<IUser>("user_register", schema);
export default UserRegister;
