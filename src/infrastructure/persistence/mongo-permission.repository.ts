
import type { IPermissionRepository } from "../../domain/repositories/permission.repository.interface.js";
import type { PermissionResponse, RoleAssignedPermissionResponse } from "../../domain/types/permission.types.js";
import Permission from "./models/permissions.model.js";
import RoleAssignedPermission from "./models/role-assigned-permission.model.js";
import Role from "./models/role.model.js";
import mongoose from "mongoose";

export class MongoPermissionRepository implements IPermissionRepository {
  async getAllPermissions(roleSlug?: string, client_id?: string): Promise<PermissionResponse[]> {
    if (roleSlug) {
      const role = await Role.findOne({ slug: roleSlug, deleted_at: null });
      if (role) {
        const assignedPermissions = await RoleAssignedPermission.find({ role_id: role._id ,client_id:client_id ? new mongoose.Types.ObjectId(client_id) : null})
          .populate("permission_id")
          .lean();
        return assignedPermissions.map((ap: any) => ({
          id: ap.permission_id._id.toString(),
          name: ap.permission_id.name,
          slug: ap.permission_id.slug,
          module: ap.permission_id.module
        }));
      }
      return []; // Return empty if role not found but slug was provided
    }

    const query: any = { deleted_at: null };
    if (client_id && mongoose.Types.ObjectId.isValid(client_id)) {
      query.$or = [
        { client_id: new mongoose.Types.ObjectId(client_id) },
        { client_id: null },
        { client_id: { $exists: false } }
      ];
    }

    const permissions = await Permission.find(query).sort({ name: 1 });
   
    return permissions.map(p => ({
      id: (p as any).id || (p as any)._id?.toString(),
      name: p.name,
      slug: p.slug,
      module: p.module
    }));
  }

  async getPermissionsByRole(roleId: string, client_id?: string): Promise<RoleAssignedPermissionResponse[]> {
    let finalRoleId: any = roleId;
    if (!mongoose.Types.ObjectId.isValid(roleId)) {
      const role = await Role.findOne({ slug: roleId }).lean();
      if (role) {
        finalRoleId = role._id;
      }
    }

    const query: any = { role_id: finalRoleId };
    if (client_id && mongoose.Types.ObjectId.isValid(client_id)) {
      query.$or = [
        { client_id: new mongoose.Types.ObjectId(client_id) },
        { client_id: null },
        { client_id: { $exists: false } }
      ];
    } else {
      query.$or = [
        { client_id: null },
        { client_id: { $exists: false } }
      ];
    }

    const assignedPermissions = await RoleAssignedPermission.find(query)
      .populate("permission_id")
      .lean();

    return assignedPermissions.map((ap: any) => ({
      id: ap._id.toString(),
      role_id: ap.role_id.toString(),
      permission_id: ap.permission_id._id.toString(),
      permission_name: ap.permission_id.name,
      permission_slug: ap.permission_id.slug,
      createdAt: ap.createdAt,
      updatedAt: ap.updatedAt
    }));
  }

  async assignPermissionsToRole(roleId: string, permissionIds: string[]): Promise<void> {
    // First remove all existing permissions for this role
    await RoleAssignedPermission.deleteMany({ role_id: new mongoose.Types.ObjectId(roleId) });

    // Then add the new ones
    if (permissionIds.length > 0) {
      const assignments = permissionIds.map(permissionId => ({
        role_id: new mongoose.Types.ObjectId(roleId),
        permission_id: new mongoose.Types.ObjectId(permissionId)
      }));
      await RoleAssignedPermission.insertMany(assignments);
    }
  }
}

