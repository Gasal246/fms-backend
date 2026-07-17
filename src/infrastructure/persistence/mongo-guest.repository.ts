import mongoose from "mongoose";
import type { GuestRepository } from "../../domain/repositories/guest.repository.interface.js";
import type { GuestFilter, GuestResponse, PaginatedGuestResponse, GuestRequest } from "../../domain/types/guest.types.js";
import Guest from "./models/guest.model.js";
import UserRegister from "./models/tenant.model.js";
import Coordinator from "./models/coordinator.model.js";
import Client from "./models/client.model.js";
import Camp from "./models/camp.model.js";
import Camp_zones from "./models/zone.model.js";

export class MongoGuestRepository implements GuestRepository {
  private mapToResponse(doc: any): GuestResponse {
    let campId: string | null = null;
    let campName: string | null = null;
    if (doc.Camp_id) {
      if (typeof doc.Camp_id === "object" && "_id" in doc.Camp_id) {
        campId = doc.Camp_id._id.toString();
        campName = doc.Camp_id.camp_name || null;
      } else {
        campId = doc.Camp_id.toString();
      }
    }

    let zoneId: string | null = null;
    let zoneName: string | null = null;
    if (doc.Zone_id) {
      if (typeof doc.Zone_id === "object" && "_id" in doc.Zone_id) {
        zoneId = doc.Zone_id._id.toString();
        zoneName = doc.Zone_id.zone_name || null;
      } else {
        zoneId = doc.Zone_id.toString();
      }
    }

    let clientId: string | null = null;
    if (doc.Client_id) {
      if (typeof doc.Client_id === "object" && "_id" in doc.Client_id) {
        clientId = doc.Client_id._id.toString();
      } else {
        clientId = doc.Client_id.toString();
      }
    }

    let hostedById: string | null = null;
    let hostedByName: string | null = null;
    if (doc.Hosted_by) {
      if (typeof doc.Hosted_by === "object" && "_id" in doc.Hosted_by) {
        hostedById = doc.Hosted_by._id.toString();
        if (doc.Hosted_by_model === "coordinator") {
          hostedByName = doc.Hosted_by.full_name || null;
        } else if (doc.Hosted_by_model === "user_register") {
          hostedByName = doc.Hosted_by.name || null;
        }
      } else {
        hostedById = doc.Hosted_by.toString();
      }
    }

    let createdById: string | null = null;
    let createdByName: string | null = null;
    if (doc.Created_by) {
      if (typeof doc.Created_by === "object" && "_id" in doc.Created_by) {
        createdById = doc.Created_by._id.toString();
        if (doc.Created_by_model === "coordinator" || doc.Created_by_model === "clients") {
          createdByName = doc.Created_by.full_name || null;
        }
      } else {
        createdById = doc.Created_by.toString();
      }
    }

    return {
      _id: doc._id ? doc._id.toString() : doc.id,
      id: doc._id ? doc._id.toString() : doc.id,
      Camp_id: campId,
      Camp_name: campName,
      Client_id: clientId,
      Zone_id: zoneId,
      Zone_name: zoneName,
      Guest_name: doc.Guest_name,
      Purpose: doc.Purpose || null,
      Hosted_by: hostedById,
      Hosted_by_name: hostedByName,
      Hosted_by_model: doc.Hosted_by_model || null,
      Created_by: createdById,
      Created_by_name: createdByName,
      Created_by_model: doc.Created_by_model || null,
      Entry_time: doc.Entry_time,
      Exit_time: doc.Exit_time || null,
      Expected_exit_time: doc.Expected_exit_time || null,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private async resolveUserModels(hostedById?: string, createdById?: string) {
    let Hosted_by_model: string | undefined = undefined;
    let Created_by_model: string | undefined = undefined;

    if (hostedById && mongoose.Types.ObjectId.isValid(hostedById)) {
      // Look up in UserRegister (tenant)
      const tenantExists = await UserRegister.exists({ _id: new mongoose.Types.ObjectId(hostedById) });
      if (tenantExists) {
        Hosted_by_model = "user_register";
      } else {
        // Look up in Coordinator
        const coordExists = await Coordinator.exists({ _id: new mongoose.Types.ObjectId(hostedById) });
        if (coordExists) {
          Hosted_by_model = "coordinator";
        }
      }
    }

    if (createdById && mongoose.Types.ObjectId.isValid(createdById)) {
      // Look up in Coordinator
      const coordExists = await Coordinator.exists({ _id: new mongoose.Types.ObjectId(createdById) });
      if (coordExists) {
        Created_by_model = "coordinator";
      } else {
        // Look up in Client
        const clientExists = await Client.exists({ _id: new mongoose.Types.ObjectId(createdById) });
        if (clientExists) {
          Created_by_model = "clients";
        }
      }
    }

    return { Hosted_by_model, Created_by_model };
  }

  async findAll(page: number, limit: number, filters: GuestFilter): Promise<PaginatedGuestResponse> {
    const query: any = { deleted_at: null };

    if (filters.Camp_id) query.Camp_id = new mongoose.Types.ObjectId(filters.Camp_id);
    if (filters.Client_id) query.Client_id = new mongoose.Types.ObjectId(filters.Client_id);
    if (filters.Zone_id) query.Zone_id = new mongoose.Types.ObjectId(filters.Zone_id);
    if (filters.Hosted_by) query.Hosted_by = new mongoose.Types.ObjectId(filters.Hosted_by);
    if (filters.Created_by) query.Created_by = new mongoose.Types.ObjectId(filters.Created_by);
    if (filters.Guest_name) query.Guest_name = { $regex: filters.Guest_name, $options: "i" };
    if (filters.status) query.status = filters.status;

    if (filters.search) {
      query.$or = [
        { Guest_name: { $regex: filters.search, $options: "i" } },
        { Purpose: { $regex: filters.search, $options: "i" } }
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Guest.find(query)
        .populate("Hosted_by")
        .populate("Created_by")
        .populate("Camp_id")
        .populate("Zone_id")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Guest.countDocuments(query),
    ]);

    return {
      items: data.map(d => this.mapToResponse(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<GuestResponse | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const doc = await Guest.findOne({ _id: id, deleted_at: null })
      .populate("Hosted_by")
      .populate("Created_by")
      .populate("Camp_id")
      .populate("Zone_id")
      .lean();
    if (!doc) return null;
    return this.mapToResponse(doc);
  }

  async create(data: GuestRequest): Promise<GuestResponse> {
    const { Hosted_by_model, Created_by_model } = await this.resolveUserModels(data.Hosted_by, data.Created_by);

    const payload: any = {
      ...data,
      Camp_id: data.Camp_id ? new mongoose.Types.ObjectId(data.Camp_id) : null,
      Client_id: data.Client_id ? new mongoose.Types.ObjectId(data.Client_id) : null,
      Zone_id: data.Zone_id ? new mongoose.Types.ObjectId(data.Zone_id) : null,
      Hosted_by: new mongoose.Types.ObjectId(data.Hosted_by),
      Hosted_by_model: Hosted_by_model || data.Hosted_by_model,
      Created_by: new mongoose.Types.ObjectId(data.Created_by),
      Created_by_model: Created_by_model || data.Created_by_model,
      Entry_time: new Date(data.Entry_time),
      Exit_time: data.Exit_time ? new Date(data.Exit_time) : null,
      Expected_exit_time: data.Expected_exit_time ? new Date(data.Expected_exit_time) : null,
    };

    const doc = await Guest.create(payload);
    const result = await this.findById(doc._id.toString());
    return result!;
  }

  async update(id: string, data: Partial<GuestRequest>): Promise<GuestResponse | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;

    const { Hosted_by_model, Created_by_model } = await this.resolveUserModels(data.Hosted_by, data.Created_by);

    const payload: any = { ...data };
    if (data.Camp_id) payload.Camp_id = new mongoose.Types.ObjectId(data.Camp_id);
    if (data.Client_id) payload.Client_id = new mongoose.Types.ObjectId(data.Client_id);
    if (data.Zone_id) payload.Zone_id = new mongoose.Types.ObjectId(data.Zone_id);
    if (data.Hosted_by) {
      payload.Hosted_by = new mongoose.Types.ObjectId(data.Hosted_by);
      payload.Hosted_by_model = Hosted_by_model || data.Hosted_by_model;
    }
    if (data.Created_by) {
      payload.Created_by = new mongoose.Types.ObjectId(data.Created_by);
      payload.Created_by_model = Created_by_model || data.Created_by_model;
    }
    if (data.Entry_time) payload.Entry_time = new Date(data.Entry_time);
    if (data.Exit_time !== undefined) payload.Exit_time = data.Exit_time ? new Date(data.Exit_time) : null;
    if (data.Expected_exit_time !== undefined) payload.Expected_exit_time = data.Expected_exit_time ? new Date(data.Expected_exit_time) : null;

    const doc = await Guest.findOneAndUpdate(
      { _id: id, deleted_at: null },
      { $set: payload },
      { returnDocument: 'after' }
    );
    if (!doc) return null;
    return this.findById(doc._id.toString());
  }

  async delete(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) return false;
    const result = await Guest.findOneAndUpdate(
      { _id: id, deleted_at: null },
      { $set: { deleted_at: new Date() } }
    );
    return !!result;
  }
}
