import type { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Role from '../../infrastructure/persistence/models/role.model.js';
import RoleAssignedPermission from '../../infrastructure/persistence/models/role-assigned-permission.model.js';
import Permission from '../../infrastructure/persistence/models/permissions.model.js';

// Simple in-memory cache to optimize API performance
const rolePermissionsCache = new Map<string, { permissions: string[], expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const authorize = (requiredPermissionSlug: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user || !user.roleId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: User role not found',
        });
      }

      const roleSlug = user.roleId;
      const client_id = user.client_id || user.id;

      const cacheKey = client_id ? `${roleSlug}_${client_id}` : roleSlug;

      const cached = rolePermissionsCache.get(cacheKey);
      const now = Date.now();

      let userPermissions: string[] = [];

      if (cached && cached.expiry > now) {
        userPermissions = cached.permissions;
      } else {
        const role = await Role.findOne({ slug: roleSlug }).lean();
        if (!role) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: Role not found',
          });
        }

        const permQuery: any = { role_id: role._id };
        if (client_id && mongoose.Types.ObjectId.isValid(client_id)) {
          permQuery.$or = [
            { client_id: new mongoose.Types.ObjectId(client_id) },
            { client_id: null },
            { client_id: { $exists: false } }
          ];
        } else {
          permQuery.$or = [
            { client_id: null },
            { client_id: { $exists: false } }
          ];
        }
        const rolePermissions = await RoleAssignedPermission.find(permQuery).lean();
        const permissionIds = rolePermissions.map(rp => rp.permission_id);

        const permissions = await Permission.find({ _id: { $in: permissionIds } }).lean();
        userPermissions = permissions.map((p: any) => p.slug);

        rolePermissionsCache.set(cacheKey, {
          permissions: userPermissions,
          expiry: now + CACHE_TTL
        });
      }

      if (!userPermissions.includes(requiredPermissionSlug)) {
        return res.status(403).json({
          success: false,
          message: `Access denied: Requires '${requiredPermissionSlug}' permission`,
        });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during authorization',
      });
    }
  };
};

export const clearRolePermissionsCache = (roleSlug?: string) => {
  if (roleSlug) {
    for (const key of rolePermissionsCache.keys()) {
      if (key === roleSlug || key.startsWith(`${roleSlug}_`)) {
        rolePermissionsCache.delete(key);
      }
    }
  } else {
    rolePermissionsCache.clear();
  }
};
