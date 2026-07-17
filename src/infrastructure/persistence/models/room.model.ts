import mongoose, { Schema, Document } from "mongoose";

export interface IBuildingRooms extends Document {
  client_id: mongoose.Types.ObjectId;
  company_assigned_room_id?: mongoose.Types.ObjectId | null;
  camp_id: mongoose.Types.ObjectId;
  zone_id: mongoose.Types.ObjectId;
  building_id: mongoose.Types.ObjectId;
  floor: number;
  room_number: string;
  space: number;
  occupancy: number;
  status: number; // active/deactive
  room_status: mongoose.Types.ObjectId | null;
  available_space: number;
  createdAt: Date;
  updatedAt: Date;
}

const Building_Rooms: Schema = new Schema(
  {
    client_id: { type: Schema.Types.ObjectId, ref: "client" },
    company_assigned_room_id: { type: Schema.Types.ObjectId, ref: "company_assigned_rooms", default: null },

    camp_id: { type: Schema.Types.ObjectId, ref: "camp" },

    zone_id: { type: Schema.Types.ObjectId, ref: "camp_zones" },

    building_id: { type: Schema.Types.ObjectId, ref: "zone_buildings" },

    floor: { type: Number },

    room_number: { type: String },

    space: { type: Number },

    occupancy: { type: Number },

    available_space: {
      type: Number,
      default: function (this: any) {
        return this.occupancy ?? null;
      }
    },

    // 0 = inactive
    // 1 = available
    // 2 = occupied
    // 3 = other
    status: {
      type: Number,
      default: function (this: any) {
        if (this.status === 1 && this.available_space === 0) {
          return 2;
        }
        return 1;
      },
      enum: [0, 1, 2, 3]
    },

    room_status: {
      type: Schema.Types.ObjectId,
      ref: "statuses",
      default: null
    }
  },
  { timestamps: true }
);

// Indexes

const Building_rooms = mongoose.model<IBuildingRooms>(
  "building_rooms",
  Building_Rooms
);

export default Building_rooms;