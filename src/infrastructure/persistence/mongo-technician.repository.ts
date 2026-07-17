import mongoose from "mongoose";
import type { TechnicianRepository } from "../../domain/repositories/technician.repository.interface.js";
import type { TechnicianFilter, TechnicianResponse, PaginatedTechnicianResponse, TechnicianRequest } from "../../domain/types/technician.types.js";
import Technician from "./models/technician.model.js";
import Coordinator from "./models/coordinator.model.js";
import UserAssignedRole from "./models/user-assigned-role.model.js";
import Role from "./models/role.model.js";
import TechnicianAssignCamps from "./models/technician-assign-camps.model.js";
import { AppError } from "../../shared/utils/AppError.js";

export class MongoTechnicianRepository implements TechnicianRepository {
  async findAll(
    page: number,
    limit: number,
    filters: TechnicianFilter,
    client_id?: string
  ) {
    const query: any = { deleted_at: null };

    if (client_id) {
      query.client_id = new mongoose.Types.ObjectId(client_id);
    } else if (filters.client_id) {
      query.client_id = new mongoose.Types.ObjectId(filters.client_id);
    }

    if (filters.status !== undefined) {
      query.status = filters.status;
    }

    if (filters.search) {
      const searchRegex = { $regex: filters.search, $options: "i" };
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }


    if (filters.assigned_camps && filters.assigned_camps.length > 0) {
      const allowedAssignments = await TechnicianAssignCamps.find({
        camp_id: { $in: filters.assigned_camps.map(id => new mongoose.Types.ObjectId(id)) }
      }).select("technician_id").lean();

      const allowedTechIds = allowedAssignments.map(a => a.technician_id);
      query._id = { $in: allowedTechIds };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Technician.find(query)
        .select("-__v -password -deleted_at")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Technician.countDocuments(query),
    ]);

    return {
      items: data.map((item: any) => ({
        ...item,
        id: item._id.toString(),
      })) as TechnicianResponse[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<TechnicianResponse | null> {
    const technician = await Technician.findOne({ _id: id, deleted_at: null }).select("-__v -password -createdAt -updatedAt -deleted_at")
      .lean();

    if (!technician) return null;

    const assignments = await TechnicianAssignCamps.aggregate([
      {
        $match: {
          technician_id: new mongoose.Types.ObjectId(id),
          status: 1,
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
    ]);

    const campObj = assignments[0]?.camp;
    const assignedSiteMapped = campObj ? {
      ...campObj,
      id: campObj._id ? campObj._id.toString() : undefined
    } : null;

    const site_name = campObj?.camp_name || "";

    const result: any = {
      ...technician,
    };
    return {
      ...result,
      id: result._id.toString(),
      site_name,
      assigned_site: assignedSiteMapped,
      site: assignedSiteMapped,
    };
  }

  async findByEmail(email: string): Promise<any> {
    return await Technician.findOne({ email, deleted_at: null });
  }

  async findByPhone(phone: string): Promise<any> {
    return await Technician.findOne({ phone, deleted_at: null });
  }

  async create(data: TechnicianRequest): Promise<TechnicianResponse> {
    const existing = await Technician.findOne({ email: data.email });

    if (existing) {
      if (!existing.deleted_at) {
        throw new AppError("Email already exists", 409);
      }

      // Reactivate soft-deleted technician
      Object.assign(existing, {
        ...data,
        client_id: new mongoose.Types.ObjectId(data.client_id),
        skills: data.skills?.map(skillId => new mongoose.Types.ObjectId(skillId)) || [],
        deleted_at: null,
        status: 1
      });

      let finalRoleSlug = data.role_id;
      if (finalRoleSlug) {
        if (mongoose.Types.ObjectId.isValid(finalRoleSlug)) {
          const roleObj = await Role.findById(finalRoleSlug).lean();
          if (roleObj) {
            finalRoleSlug = roleObj.slug;
          }
        }
      } else {
        const techRole = await Role.findOne({ slug: 'ROLE_TECHNICIAN' }).lean();
        if (techRole) finalRoleSlug = techRole.slug;
      }

      if (finalRoleSlug) {
        existing.role_id = finalRoleSlug;
      }

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
      const existingPhone = await Technician.findOne({ phone: data.phone, deleted_at: null });
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
      const techRole = await Role.findOne({ slug: 'ROLE_TECHNICIAN' }).lean();
      if (techRole) {
        finalRoleSlug = techRole.slug;
      }
    }

    const createPayload: any = {
      ...data,
      client_id: new mongoose.Types.ObjectId(data.client_id),
      skills: data.skills?.map(skillId => new mongoose.Types.ObjectId(skillId)) || []
    };

    if (finalRoleSlug) {
      createPayload.role_id = finalRoleSlug;
    }

    const technician = await Technician.create(createPayload);

    // Mirror coordinator pattern — write to userassignedroles so login
    // role-lookup (getUserRoles) works for technicians too.
    if (finalRoleSlug) {
      await UserAssignedRole.create({
        user_id: (technician as any)._id,
        role_id: finalRoleSlug,
      }).catch(() => {
        // Silently ignore if already exists (unique index)
      });
    }

    const result = await this.findById((technician as any)._id.toString());
    return result!;
  }

  async update(id: string, data: Partial<TechnicianRequest>): Promise<TechnicianResponse | null> {
    if (data.email) {
      const emailExists = await Technician.exists({
        email: data.email,
        _id: { $ne: new mongoose.Types.ObjectId(id) },
        deleted_at: null
      });
      if (emailExists) {
        throw new AppError("Email already exists", 409);
      }
    }
    if (data.phone) {
      const phoneExists = await Technician.exists({
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
    if (data.skills) updateData.skills = data.skills.map(skillId => new mongoose.Types.ObjectId(skillId));

    await Technician.findByIdAndUpdate(id, updateData);

    if (finalRoleSlug) {
      await UserAssignedRole.deleteMany({ user_id: id });
      await UserAssignedRole.create({
        user_id: new mongoose.Types.ObjectId(id),
        role_id: finalRoleSlug
      }).catch(() => { });
    }

    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await Technician.findByIdAndUpdate(id, {
      status: 0,
      deleted_at: new Date()
    });
    return !!result;
  }
}
