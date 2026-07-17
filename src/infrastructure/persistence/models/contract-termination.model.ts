import mongoose, { Schema, Document } from "mongoose";

export interface IContractTermination extends Document {
  contract_id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;
  terminated_by?: mongoose.Types.ObjectId;
  termination_reason?: string;
  termination_date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const contractTerminationSchema = new Schema(
  {
    contract_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "contracts",
      required: true,
    },
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    terminated_by: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      refPath: "terminated_by_model",
    },

    terminated_by_model: {
      type: String,
      enum: ["coordinator", "clients"],
      required: false,
    },
    termination_reason: {
      type: String,
      default: "",
    },
    termination_date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const ContractTerminationModel = mongoose.model<IContractTermination>(
  "ContractTermination",
  contractTerminationSchema
);
