import mongoose, { Document, Schema } from "mongoose";

export type KitchenManagerStatus = "Active" | "Blocked";

export interface IKitchenManager extends Document {
  client_id: mongoose.Types.ObjectId;
  role_id: mongoose.Types.ObjectId;
  kitchen_ids: mongoose.Types.ObjectId[];
  name: string;
  email: string;
  phone: string;
  password: string;
  status: KitchenManagerStatus;
  profile_picture?: string;
  created_by: mongoose.Types.ObjectId;
  updated_by?: mongoose.Types.ObjectId | null;
  deleted_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const kitchenManagerSchema = new Schema<IKitchenManager>(
  {
    client_id: { type: Schema.Types.ObjectId, ref: "client", required: true, index: true },
    role_id: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    kitchen_ids: [{ type: Schema.Types.ObjectId, required: true }],
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true, select: false },
    status: { type: String, enum: ["Active", "Blocked"], default: "Active", index: true },
    profile_picture: { type: String, default: "" },
    created_by: { type: Schema.Types.ObjectId, required: true },
    updated_by: { type: Schema.Types.ObjectId, default: null },
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: true, optimisticConcurrency: true, collection: "catering_kitchenManagers" }
);

kitchenManagerSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } }
);
kitchenManagerSchema.index({ client_id: 1, kitchen_ids: 1, deleted_at: 1 });
kitchenManagerSchema.path("kitchen_ids").validate(
  (value: mongoose.Types.ObjectId[]) => Array.isArray(value) && value.length > 0,
  "At least one kitchen assignment is required"
);

kitchenManagerSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    ret.id = ret._id?.toString();
    ret.clientId = ret.client_id?.toString();
    ret.roleId = ret.role_id?.toString();
    ret.kitchenIds = (ret.kitchen_ids || []).map((id: any) => id.toString());
    ret.version = ret.__v;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    delete ret.client_id;
    delete ret.role_id;
    delete ret.kitchen_ids;
    return ret;
  },
});

const KitchenManager = mongoose.models.KitchenManager
  || mongoose.model<IKitchenManager>("KitchenManager", kitchenManagerSchema);

export default KitchenManager;
