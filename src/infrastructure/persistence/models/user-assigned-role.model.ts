import mongoose, { Document, Schema } from "mongoose";

export interface IUserAssignedRole extends Document {
  user_id: mongoose.Types.ObjectId;
  role_id: any;
  createdAt: Date;
  updatedAt: Date;
}

const userAssignedRoleSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, required: true },
    role_id: { type: Schema.Types.Mixed, required: true, ref: "Role" },
  },
  { timestamps: true }
);

// Unique index to prevent duplicate role assignments
userAssignedRoleSchema.index({ user_id: 1, role_id: 1 }, { unique: true });

userAssignedRoleSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const UserAssignedRole = mongoose.model<IUserAssignedRole>("UserAssignedRole", userAssignedRoleSchema);
export default UserAssignedRole;
