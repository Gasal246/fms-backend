import mongoose from "mongoose";
import type { CampAssignCoordinatorRepository } from "../../domain/repositories/camp-assign-coordinator.repository.interface.js";
import type {
  AssignCoordinatorRequest,
  AssignCoordinatorResponse,
  GetAssignedCampsForCoordinatorResponse,
} from "../../domain/types/camp-assign-coordinator.types.js";
import CampAssignCoordinator from "./models/camp-assign-coordinator.model.js";
import Camp, { type ICamp } from "./models/camp.model.js";
import Coordinator from "./models/coordinator.model.js";

// Shared projection for populated assignment docs
const ASSIGNMENT_PIPELINE = [
  {
    $lookup: {
      from: "camps",
      localField: "camp_id",
      foreignField: "_id",
      as: "camp_id",
      pipeline: [{ $project: { camp_name: 1, camp_city: 1, camp_address: 1, status: 1, site_type: 1 } }],
    },
  },
  { $unwind: { path: "$camp_id", preserveNullAndEmptyArrays: false } },
  {
    $lookup: {
      from: "coordinators",
      localField: "coordinator_id",
      foreignField: "_id",
      as: "coordinator_id",
      pipeline: [{ $project: { full_name: 1, email: 1, status: 1 } }],
    },
  },
  { $unwind: { path: "$coordinator_id", preserveNullAndEmptyArrays: false } },
  {
    $project: {
      id: "$_id",
      camp_id: 1,
      coordinator_id: 1,
      status: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  },
];

export class MongoCampAssignCoordinatorRepository
  implements CampAssignCoordinatorRepository
{
  // ── Assign a coordinator to a single site ────────────────────────────────
  async assignSite(data: AssignCoordinatorRequest): Promise<AssignCoordinatorResponse> {
    const camp_id = new mongoose.Types.ObjectId(data.camp_id);
    const coordinator_id = new mongoose.Types.ObjectId(data.coordinator_id);

    // Upsert: if record exists, reactivate it; otherwise create fresh
    await CampAssignCoordinator.findOneAndUpdate(
      { camp_id, coordinator_id },
      { status: data.status ?? 1, deleted_at: null },
      { upsert: true, returnDocument: 'after' }
    );

    // Sync coordinator document with the assigned camp_id
    await Coordinator.findByIdAndUpdate(coordinator_id, { camp_id });

    const [result] = await CampAssignCoordinator.aggregate([
      { $match: { camp_id, coordinator_id } },
      ...ASSIGNMENT_PIPELINE,
    ]);

    return result as AssignCoordinatorResponse;
  }

  // ── Soft-delete: unassign coordinator from a site ────────────────────────
  async unassignSite(coordinator_id: string, camp_id: string): Promise<boolean> {
    const result = await CampAssignCoordinator.findOneAndUpdate(
      {
        coordinator_id: new mongoose.Types.ObjectId(coordinator_id),
        camp_id: new mongoose.Types.ObjectId(camp_id),
      },
      { status: 0, deleted_at: new Date() }
    );

    if (result) {
      // Clear the coordinator's camp_id
      await Coordinator.findByIdAndUpdate(coordinator_id, { camp_id: null });
    }

    return !!result;
  }

  // ── All active camp assignments for a coordinator ────────────────────────
  async getAssignedCamps(coordinator_id: string): Promise<GetAssignedCampsForCoordinatorResponse> {
    return CampAssignCoordinator.aggregate([
      {
        $match: {
          coordinator_id: new mongoose.Types.ObjectId(coordinator_id),
          status: { $ne: 0 },
          deleted_at: null,
        },
      },
      ...ASSIGNMENT_PIPELINE,
    ]) as Promise<AssignCoordinatorResponse[]>;
  }

  // ── All coordinators assigned to a specific camp ─────────────────────────
  async getAssignedCoordinators(camp_id: string): Promise<AssignCoordinatorResponse[]> {
    return CampAssignCoordinator.aggregate([
      {
        $match: {
          camp_id: new mongoose.Types.ObjectId(camp_id),
          status: { $ne: 0 },
          deleted_at: null,
        },
      },
      ...ASSIGNMENT_PIPELINE,
    ]) as Promise<AssignCoordinatorResponse[]>;
  }

  // ── List camps available to select (for the frontend dropdown) ───────────
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
