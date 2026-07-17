import mongoose, { Document, Schema } from "mongoose";

export interface IContractStaffAccess extends Document {
  _id: mongoose.Types.ObjectId;
  document_id: mongoose.Types.ObjectId; // References the main contract_documents record
  staff_id: mongoose.Types.ObjectId; // References the coordinator
  role: string; // Coordinator/staff role
  can_view: boolean;
  can_edit: boolean;
  assigned_by: mongoose.Types.ObjectId; // Client Admin who granted access
  createdAt: Date;
  updatedAt: Date;
}

const contractStaffAccessSchema = new Schema<IContractStaffAccess>(
  {
    document_id: {
      type: Schema.Types.ObjectId,
      ref: "contract_documents",
      required: true,
      index: true,
    },
    staff_id: {
      type: Schema.Types.ObjectId,
      ref: "coordinators", // references the coordinators collection
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      default: "ROLE_COORDINATOR",
    },
    can_view: {
      type: Boolean,
      required: true,
      default: false,
    },
    can_edit: {
      type: Boolean,
      required: true,
      default: false,
    },
    assigned_by: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  { timestamps: true }
);

contractStaffAccessSchema.index({ document_id: 1, staff_id: 1 }, { unique: true });

contractStaffAccessSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id?.toString();
  return object;
});

const ContractStaffAccess = mongoose.model<IContractStaffAccess>(
  "contract_staff_access",
  contractStaffAccessSchema
);
export default ContractStaffAccess;
