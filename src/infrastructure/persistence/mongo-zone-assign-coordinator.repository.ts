import mongoose from "mongoose";
import type { ZoneAssignCoordinatorRepository } from "../../domain/repositories/zone-assign-coordinator.repository.interface.js";
import type {
  AssignZoneCoordinatorRequest,
  AssignZoneCoordinatorResponse,
  GetAssignedZonesForCoordinatorResponse,
} from "../../domain/types/zone-assign-coordinator.types.js";
import ZoneAssignCoordinator from "./models/zone-assign-coordinator.model.js";
import Camp_zones from "./models/zone.model.js";
import Coordinator from "./models/coordinator.model.js";

const ASSIGNMENT_PIPELINE = [
  {
    $lookup: {
      from: "camp_zones",
      localField: "zone_id",
      foreignField: "_id",
      as: "zone_id",
      pipeline: [{ $project: { zone_name: 1, status: 1 } }],
    },
  },
  { $unwind: { path: "$zone_id", preserveNullAndEmptyArrays: false } },
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
      zone_id: 1,
      coordinator_id: 1,
      status: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  },
];

export class MongoZoneAssignCoordinatorRepository
  implements ZoneAssignCoordinatorRepository {
  async assignZone(data: AssignZoneCoordinatorRequest): Promise<AssignZoneCoordinatorResponse> {
    const zone_id = new mongoose.Types.ObjectId(data.zone_id);
    const coordinator_id = new mongoose.Types.ObjectId(data.coordinator_id);

    await ZoneAssignCoordinator.findOneAndUpdate(
      { zone_id, coordinator_id },
      { status: data.status ?? 1, deleted_at: null },
      { upsert: true, returnDocument: 'after' }
    );

    // Sync coordinator document with the assigned zone_id
    await Coordinator.findByIdAndUpdate(coordinator_id, {
      zone_id,
    });

    const [result] = await ZoneAssignCoordinator.aggregate([
      { $match: { zone_id, coordinator_id } },
      ...ASSIGNMENT_PIPELINE,
    ]);

    return result as AssignZoneCoordinatorResponse;
  }

  async unassignZone(coordinator_id: string, zone_id: string): Promise<boolean> {
    const result = await ZoneAssignCoordinator.findOneAndUpdate(
      {
        coordinator_id: new mongoose.Types.ObjectId(coordinator_id),
        zone_id: new mongoose.Types.ObjectId(zone_id),
      },
      { status: 0, deleted_at: new Date() }
    );

    if (result) {
      // Clear the zone_id field
      await Coordinator.findByIdAndUpdate(coordinator_id, { zone_id: null });
    }

    return !!result;
  }

  async getAssignedZones(coordinator_id: string): Promise<GetAssignedZonesForCoordinatorResponse> {
    return ZoneAssignCoordinator.aggregate([
      {
        $match: {
          coordinator_id: new mongoose.Types.ObjectId(coordinator_id),
          status: { $ne: 0 },
          deleted_at: null,
        },
      },
      ...ASSIGNMENT_PIPELINE,
    ]) as Promise<AssignZoneCoordinatorResponse[]>;
  }

  async getAssignedCoordinators(zone_id: string): Promise<AssignZoneCoordinatorResponse[]> {
    return ZoneAssignCoordinator.aggregate([
      {
        $match: {
          zone_id: new mongoose.Types.ObjectId(zone_id),
          status: { $ne: 0 },
          deleted_at: null,
        },
      },
      ...ASSIGNMENT_PIPELINE,
    ]) as Promise<AssignZoneCoordinatorResponse[]>;
  }

  async listZonesForClient(client_id: string, assigned_zones?: string[]) {
    const filter = {
      client_id: new mongoose.Types.ObjectId(client_id),
      status: { $ne: 0 },
      deleted_at: null,
    } as any;
    
    if (assigned_zones && assigned_zones.length > 0) {
      filter._id = { $in: assigned_zones.map((id: string) => new mongoose.Types.ObjectId(id)) };
    }

    const zones = await Camp_zones.find(filter, { zone_name: 1, status: 1 })
      .lean()
      .exec();

    return zones.map((z: any) => ({
      id: z._id.toString(),
      zone_name: z.zone_name,
      status: z.status,
    }));
  }
}
