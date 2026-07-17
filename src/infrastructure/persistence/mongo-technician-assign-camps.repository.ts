import mongoose from "mongoose";
import type { TechnicianAssignCampsRepository } from "../../domain/repositories/technician-assign-camps.repository.interface.js";
import type {
  AssignTechnicianRequest,
  AssignTechnicianResponse,
} from "../../domain/types/technician-assign-camps.types.js";
import TechnicianAssignCamps from "./models/technician-assign-camps.model.js";
import Camp, { type ICamp } from "./models/camp.model.js";

// Shared projection pipeline
const ASSIGNMENT_PIPELINE = [
  {
    $lookup: {
      from: "technicians",
      localField: "technician_id",
      foreignField: "_id",
      as: "technician_id",
      pipeline: [{ $project: { name: 1, email: 1, phone: 1, status: 1 } }],
    },
  },
  { $unwind: { path: "$technician_id", preserveNullAndEmptyArrays: false } },
  {
    $lookup: {
      from: "camps",
      localField: "camp_id",
      foreignField: "_id",
      as: "camp_id",
      pipeline: [{ $project: { camp_name: 1, camp_city: 1, camp_address: 1, status: 1, site_type: 1 } }],
    },
  },
  {
    $project: {
      id: "$_id",
      technician_id: 1,
      client_id: 1,
      camp_id: 1,
      status: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  },
];

export class MongoTechnicianAssignCampsRepository
  implements TechnicianAssignCampsRepository
{
  // ── Assign one OR many camps to a technician (upsert camps array) ────────
  async assignSites(data: AssignTechnicianRequest): Promise<AssignTechnicianResponse> {
    const technician_id = new mongoose.Types.ObjectId(data.technician_id);
    const client_id = new mongoose.Types.ObjectId(data.client_id);
    const camp_ids = data.camp_ids.map((id) => new mongoose.Types.ObjectId(id));

    // Use $addToSet to merge new camps into the existing array (no duplicates)
    await TechnicianAssignCamps.findOneAndUpdate(
      { technician_id, client_id },
      {
        $addToSet: { camp_id: { $each: camp_ids } },
        $set: { status: data.status ?? 1 },
      },
      { upsert: true, returnDocument: 'after' }
    );

    const [result] = await TechnicianAssignCamps.aggregate([
      { $match: { technician_id, client_id } },
      ...ASSIGNMENT_PIPELINE,
    ]);

    return result as AssignTechnicianResponse;
  }

  // ── Remove a single camp from the technician's array (soft-remove) ────────
  async unassignSite(
    technician_id: string,
    camp_id: string
  ): Promise<AssignTechnicianResponse | null> {
    const techId = new mongoose.Types.ObjectId(technician_id);
    const campId = new mongoose.Types.ObjectId(camp_id);

    await TechnicianAssignCamps.findOneAndUpdate(
      { technician_id: techId },
      { $pull: { camp_id: campId } }
    );

    const [result] = await TechnicianAssignCamps.aggregate([
      { $match: { technician_id: techId } },
      ...ASSIGNMENT_PIPELINE,
    ]);

    return (result as AssignTechnicianResponse) ?? null;
  }

  // ── Get all assigned camps for a technician ───────────────────────────────
  async getAssignedCamps(technician_id: string): Promise<AssignTechnicianResponse | null> {
    const [result] = await TechnicianAssignCamps.aggregate([
      {
        $match: {
          technician_id: new mongoose.Types.ObjectId(technician_id),
          status: 1,
        },
      },
      ...ASSIGNMENT_PIPELINE,
    ]);

    return (result as AssignTechnicianResponse) ?? null;
  }

  // ── List camps available for the frontend dropdown ────────────────────────
  async listCampsForClient(client_id: string, assigned_camps?: string[]) {
    const filter = {
      client_id: new mongoose.Types.ObjectId(client_id),
      status: { $ne: 0 },
      deleted_at: null,
    } as any;

    if (assigned_camps && assigned_camps.length > 0) {
      filter._id = { $in: assigned_camps.map((id: string) => new mongoose.Types.ObjectId(id)) };
    }

    const camps = await Camp.find(filter, { camp_name: 1, camp_city: 1, status: 1 })
      .lean()
      .exec();

    return camps.map((c: any) => ({
      id: c._id.toString(),
      camp_name: c.camp_name,
      camp_city: c.camp_city,
      status: c.status,
    }));
  }
}
