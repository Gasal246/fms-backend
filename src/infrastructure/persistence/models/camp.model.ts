import mongoose, { Document, type ObjectId } from "mongoose";

const schema = new mongoose.Schema(
  {
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: "clients" },
    camp_name: {
      type: String,
      required: true,
    },
    camp_address: {
      type: String,
      required: true,
    },
    camp_city: {
      type: String,
      required: true,
    },
    router_primary_ip: {
      type: String,
      required: true,
    },
    no_of_allowed_user: {
      type: Number,
      required: true,
    },
    no_of_allowed_kiosk: {
      type: Number,
      required: true,
    },
    no_of_allowed_account: {
      type: Number,
      required: true,
    },
    no_of_allowed_coordinators: {
      type: Number,
      required: true,
    },

    // 0=disAllow,1=Allowed
    is_allowed_package_meal: {
      type: Number,
      enum: [0, 1],
      required: true,
    },

    // 0=disAllow,1=Allowed
    is_allowed_package_water: {
      type: Number,
      enum: [0, 1],
      required: true,
    },

    // 0=disAllow,1=Allowed
    is_allowed_package_internet: {
      type: Number,
      enum: [0, 1],
      required: true,
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

    router_mac_address: {
      type: String,
      required: true,
    },
    router_ssid: {
      type: String,
    },

    router_secondary_ip: {
      type: String,
    },

    router_pass: {
      type: String,
    },

    router_secret: {
      type: String,
    },

    router_alias: {
      type: String,
    },

    router_hostname: {
      type: String,
    },

    washing_router_ssid: {
      type: String,
    },

    washing_router_pass: {
      type: String,
    },

    camp_uuid: {
      type: String,
    },
    site: {
      type: String,
      enum: ["global", "local", "client-camps", "selected-camps"],
      required: true,
    },
    selected_camps: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "camp",
      },
    ],
    site_type: {
      type: String,
      enum: ["offsite", "onsite"],
      required: true,
    },
    mobile_numbers: [
      {
        type: String,
      },
    ],
  },
  { timestamps: true }
);

export interface ICamp extends Document {
  client_id: ObjectId;
  camp_name: string;
  camp_address: string;
  camp_city: string;
  router_primary_ip: string;
  no_of_allowed_user: number;
  no_of_allowed_kiosk: number;
  no_of_allowed_account: number;
  no_of_allowed_coordinators: number;
  is_allowed_package_meal: number;
  is_allowed_package_water: number;
  is_allowed_package_internet: number;
  status: number;
  deleted_at: Date;
  router_mac_address: string;
  router_ssid: string;
  router_secondary_ip: string;
  router_pass: string;
  router_secret: string;
  router_alias: string;
  router_hostname: string;
  washing_router_ssid: string;
  washing_router_pass: string;
  selected_camps: ObjectId[];
  camp_uuid: string;
  site: string;
  site_type: string;
  mobile_numbers: string[] | [];
  createdAt: Date;
  updatedAt: Date;
}

schema.method("toJSON", function () {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;

  return object;
});

const Camp = mongoose.model<ICamp>("camp", schema);
export default Camp;
