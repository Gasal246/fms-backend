import type { RoleRepository } from "../../domain/repositories/role.repository.interface.js";
import type { RoleResponse } from "../../domain/types/role.types.js";
import Role from "./models/role.model.js";

export class MongoRoleRepository implements RoleRepository {
  async findAll(): Promise<RoleResponse[]> {
    const results = await Role.aggregate([
      { $match: { deleted_at: null, slug: { $ne: "ROLE_CLIENT_ADMIN" } } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "roleassignedpermissions",
          localField: "_id",
          foreignField: "role_id",
          as: "assigned"
        }
      },
      {
        $lookup: {
          from: "permissions",
          localField: "assigned.permission_id",
          foreignField: "_id",
          as: "permissions"
        }
      },
      {
        $project: {
          _id: 0,
          id: "$_id",
          name: 1,
          permissions: {
            $map: {
              input: "$permissions",
              as: "p",
              in: {
                id: "$$p._id",
                name: "$$p.name",
                slug: "$$p.slug",
                module: "$$p.module"
              }
            }
          }
        }
      }
    ]);

    return results as RoleResponse[];
  }
}
