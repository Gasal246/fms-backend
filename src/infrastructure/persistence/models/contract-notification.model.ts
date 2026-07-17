import mongoose, { Document, Schema } from "mongoose";

export interface IContractNotification extends Document {
  _id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;
  document_id?: mongoose.Types.ObjectId; // Optional link to document
  receiver_type: "company" | "tenant" | "client_admin";
  receiver_id: mongoose.Types.ObjectId; // References company _id or tenant user_register _id or client admin _id
  title: string;
  message: string;
  notification_type: "expiry" | "renewal" | "compliance" | "general";
  sent_by?: mongoose.Types.ObjectId;
  sent_by_role: string;
  is_read: boolean;
  sent_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const contractNotificationSchema = new Schema<IContractNotification>(
  {
    client_id: {
      type: Schema.Types.ObjectId,
      ref: "client",
      required: true,
      index: true,
    },
    document_id: {
      type: Schema.Types.ObjectId,
      ref: "contract_documents",
      default: null,
      index: true,
    },
    receiver_type: {
      type: String,
      required: true,
      enum: ["company", "tenant", "client_admin"],
      index: true,
    },
    receiver_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    notification_type: {
      type: String,
      required: true,
      enum: ["expiry", "renewal", "compliance", "general"],
      index: true,
    },
    sent_by: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    sent_by_role: {
      type: String,
      required: true,
    },
    is_read: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    sent_at: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

contractNotificationSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id?.toString();
  return object;
});

const ContractNotification = mongoose.model<IContractNotification>(
  "contract_notifications",
  contractNotificationSchema
);
export default ContractNotification;
