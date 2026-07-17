import mongoose, { Document, Schema } from "mongoose";

export interface ICompanyAssignedRoom extends Document {
  _id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;
  company_id: mongoose.Types.ObjectId;
  contract_id?: mongoose.Types.ObjectId | null;
  room_id: mongoose.Types.ObjectId;
  camp_id: mongoose.Types.ObjectId;
  zone_id: mongoose.Types.ObjectId;
  deleted_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const companyAssignedRoomSchema = new Schema<ICompanyAssignedRoom>(
  {
    client_id: {
      type: Schema.Types.ObjectId,
      ref: "client",
      required: true,
    },
    company_id: {
      type: Schema.Types.ObjectId,
      ref: "companies",
      required: true,
    },
    contract_id: {
      type: Schema.Types.ObjectId,
      ref: "contracts",
      required: false,
      default: null,
    },
    room_id: {
      type: Schema.Types.ObjectId,
      ref: "building_rooms",
      required: true,
    },
    camp_id: {
      type: Schema.Types.ObjectId,
      ref: "camp",
      required: true,
    },
    zone_id: {
      type: Schema.Types.ObjectId,
      ref: "camp_zones",
      required: true,
    },
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for query optimization
companyAssignedRoomSchema.index({ company_id: 1 });
companyAssignedRoomSchema.index({ contract_id: 1 });
companyAssignedRoomSchema.index({ room_id: 1 });
companyAssignedRoomSchema.index({ camp_id: 1 });
companyAssignedRoomSchema.index({ zone_id: 1 });
companyAssignedRoomSchema.index({ deleted_at: 1 });
companyAssignedRoomSchema.index(
  { company_id: 1, contract_id: 1, room_id: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } }
);

const CompanyAssignedRoom = mongoose.models.company_assigned_rooms || mongoose.model<ICompanyAssignedRoom>(
  "company_assigned_rooms",
  companyAssignedRoomSchema
);

export default CompanyAssignedRoom;
