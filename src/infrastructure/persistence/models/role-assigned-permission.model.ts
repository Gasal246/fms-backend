import mongoose, { Document, Schema } from "mongoose";

export interface IRoleAssignedPermission extends Document {
  role_id: mongoose.Types.ObjectId;
  permission_id: mongoose.Types.ObjectId;
  client_id?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const roleAssignedPermissionSchema = new Schema(
  {
    role_id: { type: Schema.Types.ObjectId, required: true, ref: "Role" },
    permission_id: { type: Schema.Types.ObjectId, required: true, ref: "Permission" },
    client_id: { type: Schema.Types.ObjectId, ref: "client" },
  },
  { timestamps: true }
);

// Unique index to prevent duplicate permission assignments to the same role
roleAssignedPermissionSchema.index({ role_id: 1, permission_id: 1 }, { unique: true });

roleAssignedPermissionSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const RoleAssignedPermission = mongoose.model<IRoleAssignedPermission>("RoleAssignedPermission", roleAssignedPermissionSchema);
export default RoleAssignedPermission;
