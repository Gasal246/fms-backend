import mongoose from "mongoose";
import type { CoordinatorRepository } from "../../domain/repositories/coordinator.repository.interface.js";
import type { CoordinatorFilter, CoordinatorResponse, PaginatedCoordinatorResponse, CoordinatorRequest } from "../../domain/types/coordinator.types.js";

import Coordinator from "./models/coordinator.model.js";
import UserAssignedRole from "./models/user-assigned-role.model.js";
import Role from "./models/role.model.js";
import CampAssignCoordinator from "./models/camp-assign-coordinator.model.js";
import ZoneAssignCoordinator from "./models/zone-assign-coordinator.model.js";
import { AppError } from "../../shared/utils/AppError.js";

export class MongoCoordinatorRepository implements CoordinatorRepository {
  async findAll(
    page: number,
    limit: number,
    filters: CoordinatorFilter
  ) {
    const match: any = { deleted_at: null };

    if (filters.client_id) {
      match.client_id = new mongoose.Types.ObjectId(filters.client_id);
    }

    if (filters.status !== undefined) {
      match.status = filters.status;
    }

    if (filters.search) {
      const searchRegex = { $regex: filters.search, $options: "i" };
      match.$or = [
        { full_name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    if (filters.camp_id) {
      const assignedCoords = await CampAssignCoordinator.find({
        camp_id: new mongoose.Types.ObjectId(filters.camp_id),
        status: { $ne: 0 },
        deleted_at: null
      }).select('coordinator_id').lean();

      const assignedIds = assignedCoords.map(ac => ac.coordinator_id);

      const campFilter = {
        $or: [
          { camp_id: new mongoose.Types.ObjectId(filters.camp_id) },
          { _id: { $in: assignedIds } }
        ]
      };

      if (match.$or) {
        match.$and = [{ $or: match.$or }, campFilter];
        delete match.$or;
      } else {
        match.$or = campFilter.$or;
      }
    }

    if ((filters.assigned_camps && filters.assigned_camps.length > 0) || (filters.assigned_zones && filters.assigned_zones.length > 0)) {
      const allowedCoordinatorIds = new Set<string>();

      if (filters.assigned_camps && filters.assigned_camps.length > 0) {
        const assignedCoords = await CampAssignCoordinator.find({
          camp_id: { $in: filters.assigned_camps.map(id => new mongoose.Types.ObjectId(id)) },
          status: { $ne: 0 },
          deleted_at: null
        }).select('coordinator_id').lean();
        assignedCoords.forEach(ac => allowedCoordinatorIds.add(ac.coordinator_id.toString()));
      }

      if (filters.assigned_zones && filters.assigned_zones.length > 0) {
        const assignedZoneCoords = await ZoneAssignCoordinator.find({
          zone_id: { $in: filters.assigned_zones.map(id => new mongoose.Types.ObjectId(id)) },
          status: { $ne: 0 },
          deleted_at: null
        }).select('coordinator_id').lean();
        assignedZoneCoords.forEach(ac => allowedCoordinatorIds.add(ac.coordinator_id.toString()));
      }

      const allowedIdsArray = Array.from(allowedCoordinatorIds).map(id => new mongoose.Types.ObjectId(id));

      if (match._id && match._id.$in) {
        // Intersect if there was already an _id filter
        const existingSet = new Set(match._id.$in.map((id: any) => id.toString()));
        match._id.$in = allowedIdsArray.filter(id => existingSet.has(id.toString()));
      } else {
        match._id = { ...match._id, $in: allowedIdsArray };
      }
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Coordinator.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { __v: 0, password: 0, deleted_at: 0 } },

        // ── Join assigned site (camp) ──────────────────────────────────────
        {
          $lookup: {
            from: "camp_assign_coordinators",
            let: { cid: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$coordinator_id", "$$cid"] },
                      { $ne: ["$status", 0] },
                      { $eq: ["$deleted_at", null] }
                    ]
                  }
                }
              },
              { $lookup: { from: "camps", localField: "camp_id", foreignField: "_id", as: "camp" } },
              { $unwind: { path: "$camp", preserveNullAndEmptyArrays: true } }
            ],
            as: "_campAssign"
          }
        },

        // ── Join assigned zone ─────────────────────────────────────────────
        {
          $lookup: {
            from: "zone_assign_coordinators",
            let: { cid: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$coordinator_id", "$$cid"] },
                      { $ne: ["$status", 0] },
                      { $eq: ["$deleted_at", null] }
                    ]
                  }
                }
              },
              { $lookup: { from: "camp_zones", localField: "zone_id", foreignField: "_id", as: "zone" } },
              { $unwind: { path: "$zone", preserveNullAndEmptyArrays: true } }
            ],
            as: "_zoneAssign"
          }
        },

      ]),

      Coordinator.countDocuments(match),
    ]);

    return {
      items: data.map((item: any) => {
        const campDocs = item._campAssign?.map((a: any) => a.camp).filter(Boolean) || [];
        const zoneDocs = item._zoneAssign?.map((a: any) => a.zone).filter(Boolean) || [];

        const assignedSites = campDocs.map((c: any) => ({ ...c, id: c._id?.toString() }));
        const assignedZones = zoneDocs.map((z: any) => ({ ...z, id: z._id?.toString() }));

        return {
          ...item,
          id: item._id.toString(),
          camp_id: item.camp_id ? item.camp_id.toString() : (assignedSites[0]?.id ?? undefined),
          zone_id: item.zone_id ? item.zone_id.toString() : (assignedZones[0]?.id ?? undefined),
          assigned_sites: assignedSites,
          assigned_zones: assignedZones,
          _campAssign: undefined,
          _zoneAssign: undefined,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }


  async findById(id: string): Promise<CoordinatorResponse | null> {
    const coordinator: any = await Coordinator.findOne({ _id: id, deleted_at: null }).lean();
    if (!coordinator) return null;

    const [assignments, zoneAssignments] = await Promise.all([
      CampAssignCoordinator.aggregate([
        {
          $match: {
            coordinator_id: new mongoose.Types.ObjectId(id),
            status: { $ne: 0 },
            deleted_at: null,
          },
        },
        {
          $lookup: {
            from: "camps",
            localField: "camp_id",
            foreignField: "_id",
            as: "camp",
          },
        },
        { $unwind: { path: "$camp", preserveNullAndEmptyArrays: true } },
      ]),
      ZoneAssignCoordinator.aggregate([
        {
          $match: {
            coordinator_id: new mongoose.Types.ObjectId(id),
            status: { $ne: 0 },
            deleted_at: null,
          },
        },
        {
          $lookup: {
            from: "camp_zones",
            localField: "zone_id",
            foreignField: "_id",
            as: "zone",
          },
        },
        { $unwind: { path: "$zone", preserveNullAndEmptyArrays: true } },
      ])
    ]);

    const assignedSites = assignments.map((a: any) => a.camp).filter(Boolean).map((c: any) => ({
      ...c,
      id: c._id ? c._id.toString() : undefined
    }));

    const assignedZones = zoneAssignments.map((a: any) => a.zone).filter(Boolean).map((z: any) => ({
      ...z,
      id: z._id ? z._id.toString() : undefined
    }));
    return {
      id: coordinator._id.toString(),
      client_id: coordinator.client_id,
      camp_id: coordinator.camp_id ? coordinator.camp_id.toString() : undefined,
      zone_id: coordinator.zone_id ? coordinator.zone_id.toString() : undefined,
      full_name: coordinator.full_name,
      email: coordinator.email,
      phone: coordinator.phone,
      uuid: coordinator.uuid,
      status: coordinator.status,
      is_mess_management: coordinator.is_mess_management,
      is_water_management: coordinator.is_water_management,
      is_internet_management: coordinator.is_internet_management,
      isAdmin: coordinator.isAdmin,
      profile_picture: coordinator.profile_picture || '',
      createdAt: coordinator.createdAt,
      updatedAt: coordinator.updatedAt,
      assigned_sites: assignedSites,
      assigned_zones: assignedZones,
    };
  }

  async findByEmail(email: string): Promise<any> {
    return await Coordinator.findOne({ email, deleted_at: null });
  }

  async findByPhone(phone: string): Promise<any> {
    return await Coordinator.findOne({ phone, deleted_at: null });
  }

  async create(data: CoordinatorRequest): Promise<CoordinatorResponse> {
    const existing = await Coordinator.findOne({ email: data.email });

    if (existing) {
      if (!existing.deleted_at) {
        throw new AppError("Email already exists", 409);
      }

      // Reactivate soft-deleted coordinator
      const updatePayload: any = {
        ...data,
        client_id: new mongoose.Types.ObjectId(data.client_id),
        deleted_at: null,
        status: 1
      };

      let finalRoleSlug = data.role_id;
      if (finalRoleSlug) {
        if (mongoose.Types.ObjectId.isValid(finalRoleSlug)) {
          const roleObj = await Role.findById(finalRoleSlug).lean();
          if (roleObj) {
            finalRoleSlug = roleObj.slug;
          }
        }
      } else {
        const coordRole = await Role.findOne({ slug: 'ROLE_COORDINATOR' }).lean();
        if (coordRole) finalRoleSlug = coordRole.slug;
      }

      if (finalRoleSlug) {
        updatePayload.role_id = finalRoleSlug;
      }

      Object.assign(existing, updatePayload);
      await existing.save();

      if (finalRoleSlug) {
        await UserAssignedRole.findOneAndUpdate(
          { user_id: existing._id, role_id: finalRoleSlug },
          { user_id: existing._id, role_id: finalRoleSlug },
          { upsert: true }
        );
      }

      const result = await this.findById(existing._id.toString());
      return result!;
    }

    if (data.phone) {
      const existingPhone = await Coordinator.findOne({ phone: data.phone, deleted_at: null });
      if (existingPhone) {
        throw new AppError("Phone number already exists", 409);
      }
    }

    let finalRoleSlug = data.role_id;
    if (finalRoleSlug) {
      if (mongoose.Types.ObjectId.isValid(finalRoleSlug)) {
        const roleObj = await Role.findById(finalRoleSlug).lean();
        if (roleObj) {
          finalRoleSlug = roleObj.slug;
        }
      }
    } else {
      const coordRole = await Role.findOne({ slug: 'ROLE_COORDINATOR' }).lean();
      if (coordRole) {
        finalRoleSlug = coordRole.slug;
      }
    }

    const createPayload: any = {
      ...data,
      client_id: new mongoose.Types.ObjectId(data.client_id)
    };

    if (finalRoleSlug) {
      createPayload.role_id = finalRoleSlug;
    }

    const coordinator = await Coordinator.create(createPayload);

    if (finalRoleSlug) {
      await UserAssignedRole.create({
        user_id: coordinator._id,
        role_id: finalRoleSlug
      });
    }

    if (data.camp_id && mongoose.Types.ObjectId.isValid(data.camp_id)) {
      await CampAssignCoordinator.create({
        coordinator_id: coordinator._id,
        camp_id: new mongoose.Types.ObjectId(data.camp_id),
        status: 1
      });
    }

    const result = await this.findById(coordinator._id.toString());
    return result!;
  }

  async update(id: string, data: Partial<CoordinatorRequest>): Promise<CoordinatorResponse | null> {
    if (data.email) {
      const emailExists = await Coordinator.exists({
        email: data.email,
        _id: { $ne: new mongoose.Types.ObjectId(id) },
        deleted_at: null
      });
      if (emailExists) {
        throw new AppError("Email already exists", 409);
      }
    }
    if (data.phone) {
      const phoneExists = await Coordinator.exists({
        phone: data.phone,
        _id: { $ne: new mongoose.Types.ObjectId(id) },
        deleted_at: null
      });
      if (phoneExists) {
        throw new AppError("Phone number already exists", 409);
      }
    }
    const updateData: any = { ...data };
    if (data.client_id) updateData.client_id = new mongoose.Types.ObjectId(data.client_id);

    let finalRoleSlug = data.role_id;
    if (finalRoleSlug) {
      if (mongoose.Types.ObjectId.isValid(finalRoleSlug)) {
        const roleObj = await Role.findById(finalRoleSlug).lean();
        if (roleObj) {
          finalRoleSlug = roleObj.slug;
        }
      }
      updateData.role_id = finalRoleSlug;
    }

    await Coordinator.findByIdAndUpdate(id, updateData);

    if (finalRoleSlug) {
      await UserAssignedRole.deleteMany({ user_id: id });
      await UserAssignedRole.create({
        user_id: new mongoose.Types.ObjectId(id),
        role_id: finalRoleSlug
      });
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await Coordinator.findByIdAndUpdate(id, {
      status: 0,
      deleted_at: new Date()
    });
    return !!result;
  }
}
