import mongoose, { Schema, Document, type ObjectId } from "mongoose";

export interface IBed extends Document {
  client_id: mongoose.Types.ObjectId;
  room_id: mongoose.Types.ObjectId;
  bed_number: string;
  status: "available" | "occupied";
  type: "SINGLE_BED" | "BUNK_UPPER" | "BUNK_LOWER";
  tenant_id: mongoose.Types.ObjectId | null;
  deleted_at: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tenant_assigned_at: Date | null;
}

const BedSchema: Schema = new Schema(
  {
    client_id: {
      type: Schema.Types.ObjectId,
      ref: "client",
    },
    room_id: {
      type: Schema.Types.ObjectId,
      ref: "building_rooms",
    },

    bed_number: {
      type: String, // "BED 01"
    },

    status: {
      type: String,
      enum: ["available", "occupied", "reserved"],
      default: "available"
    },
    type: {
      type: String,
      enum: ["SINGLE_BED", "BUNK_UPPER", "BUNK_LOWER"],
      default: "SINGLE_BED"
    },

    tenant_id: {
      type: Schema.Types.ObjectId,
      ref: "user_register",
      default: null,
    },
    tenant_assigned_at: {
      type: Date,
      default: null,
    },
    deleted_at: {
      type: Date,
      default: null,
    }
  },
  { timestamps: true }
);

// Indexes
BedSchema.index({ room_id: 1, status: 1 });
BedSchema.index({ bed_number: 1 });

const Bed = mongoose.model<IBed>("Bed", BedSchema);

export default Bed;
