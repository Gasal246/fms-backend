import mongoose, { Document, Schema } from "mongoose";

export type AllocationType = "ROOM" | "BED" | "BUILDING" | "FLOOR" | "HEADCOUNT";
export type AllocationStatus = "Active" | "Expired" | "Suspended" | "Cancelled";

export interface IContractAllocation extends Document {
  _id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;
  contract_id: mongoose.Types.ObjectId;
  company_id: mongoose.Types.ObjectId;
  allocation_type: AllocationType;

  // Inventory references (conditional by type)
  site_id?: mongoose.Types.ObjectId;
  building_id?: mongoose.Types.ObjectId;
  floor_id?: mongoose.Types.ObjectId;
  room_id?: mongoose.Types.ObjectId;
  bed_id?: mongoose.Types.ObjectId;

  quantity?: number;
  rate?: number;
  start_date: Date;
  end_date: Date;
  remarks?: string;
  status: AllocationStatus;

  // Audit
  created_by?: string;
  updated_by?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contractAllocationSchema = new Schema<IContractAllocation>(
  {
    client_id: {
      type: Schema.Types.ObjectId,
      ref: "client",
      required: true,
    },
    contract_id: {
      type: Schema.Types.ObjectId,
      ref: "contracts",
      required: true,
    },
    company_id: {
      type: Schema.Types.ObjectId,
      ref: "companies",
      required: true,
    },
    allocation_type: {
      type: String,
      required: true,
      enum: ["ROOM", "BED", "BUILDING", "FLOOR", "HEADCOUNT"],
    },
    site_id: {
      type: Schema.Types.ObjectId,
      ref: "camp",
    },
    building_id: {
      type: Schema.Types.ObjectId,
      ref: "zone_buildings",
    },
    floor_id: {
      type: Schema.Types.ObjectId,
    },
    room_id: {
      type: Schema.Types.ObjectId,
      ref: "building_rooms",
    },
    bed_id: {
      type: Schema.Types.ObjectId,
      ref: "Bed",
    },
    quantity: {
      type: Number,
      min: 0,
    },
    rate: {
      type: Number,
      min: 0,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["Active", "Expired", "Suspended", "Cancelled"],
      default: "Active",
    },
    created_by: { type: String, trim: true },
    updated_by: { type: String, trim: true },
  },
  { timestamps: true }
);

// ── Indexes ─────────────────────────────────────────────────────────
contractAllocationSchema.index({ contract_id: 1, status: 1 });
contractAllocationSchema.index({ client_id: 1, status: 1 });
contractAllocationSchema.index({ room_id: 1, status: 1 });
contractAllocationSchema.index({ bed_id: 1, status: 1 });
contractAllocationSchema.index({ room_id: 1, status: 1, start_date: 1, end_date: 1 });
contractAllocationSchema.index({ bed_id: 1, status: 1, start_date: 1, end_date: 1 });
contractAllocationSchema.index({ company_id: 1, status: 1 });

contractAllocationSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const ContractAllocation = mongoose.model<IContractAllocation>(
  "contract_allocations",
  contractAllocationSchema
);
export default ContractAllocation;
