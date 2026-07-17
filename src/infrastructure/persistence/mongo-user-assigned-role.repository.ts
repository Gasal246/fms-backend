import type { UserAssignedRoleRepository } from "../../domain/repositories/user-assigned-role.repository.interface.js";
import type { AssignRoleRequest, UserAssignedRoleResponse } from "../../domain/types/user-assigned-role.types.js";
import UserAssignedRole from "./models/user-assigned-role.model.js";
import Role from "./models/role.model.js";
import mongoose from "mongoose";

export class MongoUserAssignedRoleRepository implements UserAssignedRoleRepository {
  async assignRole(data: AssignRoleRequest): Promise<UserAssignedRoleResponse> {
    let finalRoleId: any = data.role_id;
    if (mongoose.Types.ObjectId.isValid(finalRoleId)) {
      finalRoleId = new mongoose.Types.ObjectId(finalRoleId);
    }
    const assignedRole = await UserAssignedRole.findOneAndUpdate(
      { user_id: new mongoose.Types.ObjectId(data.user_id), role_id: finalRoleId },
      { user_id: new mongoose.Types.ObjectId(data.user_id), role_id: finalRoleId },
      { upsert: true, returnDocument: 'after', lean: true }
    );
    if (!assignedRole) {
      throw new Error("Failed to assign role");
    }
    // Find the resolved role so mapToResponse can map it correctly
    let roleDoc = null;
    if (mongoose.Types.ObjectId.isValid(assignedRole.role_id)) {
      roleDoc = await Role.findById(assignedRole.role_id).lean();
    } else {
      roleDoc = await Role.findOne({ slug: assignedRole.role_id }).lean();
    }
    const resolvedAssignedRole = {
      ...assignedRole,
      role_id: roleDoc || { _id: assignedRole.role_id, slug: assignedRole.role_id, name: assignedRole.role_id }
    };
    return this.mapToResponse(resolvedAssignedRole);
  }

  async removeRole(user_id: string, role_id: string): Promise<void> {
    let finalRoleId: any = role_id;
    if (mongoose.Types.ObjectId.isValid(finalRoleId)) {
      finalRoleId = new mongoose.Types.ObjectId(finalRoleId);
    }
    await UserAssignedRole.deleteOne({
      user_id: new mongoose.Types.ObjectId(user_id),
      role_id: finalRoleId
    });
  }

  async findByUserId(user_id: string): Promise<UserAssignedRoleResponse[]> {
    const roles = await UserAssignedRole.find({
      user_id: new mongoose.Types.ObjectId(user_id)
    }).lean();

    const populatedRoles = await Promise.all(roles.map(async (role) => {
      let roleDoc = null;
      if (mongoose.Types.ObjectId.isValid(role.role_id)) {
        roleDoc = await Role.findById(role.role_id).lean();
      } else {
        roleDoc = await Role.findOne({ slug: role.role_id }).lean();
      }
      return {
        ...role,
        role_id: roleDoc || { _id: role.role_id, slug: role.role_id, name: role.role_id }
      };
    }));

    return populatedRoles.map(role => this.mapToResponse(role));
  }

  private mapToResponse(role: any): UserAssignedRoleResponse {
    const roleDetails = role.role_id || {};
    return {
      id: role._id.toString(),
      role_id: roleDetails._id ? roleDetails._id.toString() : (role.role_id?.toString() || ""),
      role_name: roleDetails.name || (roleDetails.slug ? roleDetails.name : (role.role_id?.toString() || "Unknown Role")),
      role_slug: roleDetails.slug || (role.role_id?.toString() || "unknown"),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
