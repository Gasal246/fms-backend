import mongoose from "mongoose";
import type { CampRepository } from "../../domain/repositories/camp.repository.interface.js";
import type { CampFilter, CampResponse, CampOccupancySummary, PaginatedCampOccupancySummary } from "../../domain/types/camp.types.js";
import Camp from "./models/camp.model.js";
import Camp_zones from "./models/zone.model.js";
import Buildings from "./models/building.model.js";
import BuildingRooms from "./models/room.model.js";

export class MongoCampRepository implements CampRepository {
  async findById(id: string): Promise<any | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid camp ID");
    }
    return Camp.findById(id);
  }

  async findAll(client_id: string, assigned_camps?: string[]): Promise<CampResponse[]> {
    const query: any = { client_id: new mongoose.Types.ObjectId(client_id) };

    if (assigned_camps && assigned_camps.length > 0) {
      query._id = { $in: assigned_camps.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const results = await Camp.find(query).sort({ createdAt: -1 }).select("_id camp_name");
    return results.map(camp => camp.toJSON()) as unknown as CampResponse[];
  }

  async getOccupancySummary(
    client_id: string,
    camp_name?: string,
    page: number = 1,
    limit: number = 6,
    assigned_camps?: string[]
  ): Promise<PaginatedCampOccupancySummary> {

    const skip = (page - 1) * limit;

    const query: any = {
      client_id: new mongoose.Types.ObjectId(client_id),
      status: { $ne: 0 },
    };

    if (camp_name) {
      query.camp_name = { $regex: camp_name, $options: "i" };
    }

    if (assigned_camps && assigned_camps.length > 0) {
      query._id = { $in: assigned_camps.map(id => new mongoose.Types.ObjectId(id)) };
    }

    // ── 1. Camps + total count ───────────────────────────────
    const [camps, total] = await Promise.all([
      Camp.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Camp.countDocuments(query),
    ]);

    if (!camps.length) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    const campIds = camps.map((c) => c._id);

    // ── 2. Parallel: counts + rooms ──────────────────────────
    const [zoneCountsArr, buildingCountsArr, rooms] = await Promise.all([
      Promise.all(
        campIds.map((id) =>
          Camp_zones.countDocuments({ camp_id: id as any })
        )
      ),
      Promise.all(
        campIds.map((id) =>
          Buildings.countDocuments({ camp_id: id as any })
        )
      ),
      BuildingRooms.find({ camp_id: { $in: campIds as any } })
        .select("_id camp_id occupancy available_space")
        .lean(),
    ]);

    // ── 3. Build maps ───────────────────────────────────────
    const zoneCountMap = new Map<string, number>();
    const buildingCountMap = new Map<string, number>();

    campIds.forEach((id, index) => {
      const key = id.toString();
      zoneCountMap.set(key, zoneCountsArr[index] ?? 0);
      buildingCountMap.set(key, buildingCountsArr[index] ?? 0);
    });

    const roomsByCamp = new Map<string, any[]>();
    for (const room of rooms) {
      const key = room.camp_id?.toString();
      if (!key) continue;

      if (!roomsByCamp.has(key)) roomsByCamp.set(key, []);
      roomsByCamp.get(key)!.push(room);
    }

    // ── 4. Final calculation ────────────────────────────────
    const statusMap: Record<number, string> = {
      1: "Active",
      2: "Pending",
      3: "Blocked",
    };

    const data: CampOccupancySummary[] = camps.map((camp: any) => {
      const campKey = camp._id.toString();
      const campRooms = roomsByCamp.get(campKey) ?? [];

      let totalOccupancy = 0;
      let totalAvailableBeds = 0;

      for (const room of campRooms) {
        totalOccupancy += room.occupancy ?? 0;
        totalAvailableBeds += room.available_space ?? 0;
      }

      const totalOccupiedBeds = totalOccupancy - totalAvailableBeds;

      const occupancyPercentage =
        totalOccupancy > 0
          ? Math.round((totalOccupiedBeds / totalOccupancy) * 100)
          : 0;

      return {
        id: campKey,
        camp_name: camp.camp_name,
        camp_address: camp.camp_address,
        camp_city: camp.camp_city,
        totalZones: zoneCountMap.get(campKey) ?? 0,
        totalBuildings: buildingCountMap.get(campKey) ?? 0,
        totalRooms: campRooms.length,
        totalOccupancy,
        totalOccupiedBeds,
        totalAvailableBeds,
        occupancyPercentage,
        status: {
          code: camp.status,
          name: statusMap[camp.status] ?? "Unknown",
        },
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
