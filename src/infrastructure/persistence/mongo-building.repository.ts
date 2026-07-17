import mongoose from "mongoose";
import type { BuildingRepository } from "../../domain/repositories/building.repository.interface.js";
import type { BuildingResponse, BuildingOccupancySummary, PaginatedBuildingOccupancySummary } from "../../domain/types/building.types.js";
import Buildings from "./models/building.model.js";
import BuildingRooms from "./models/room.model.js";
import Statuses from "./models/status.model.js";

export class MongoBuildingRepository implements BuildingRepository {
  async findById(id: string): Promise<any | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid building ID");
    }
    const building = await Buildings.findById(id);
    return building ? building.toJSON() : null;
  }

  async findAll(client_id: string, camp_id?: string, zone_id?: string, assigned_camps?: string[], assigned_zones?: string[]): Promise<BuildingResponse[]> {
    const query: any = { client_id: new mongoose.Types.ObjectId(client_id) };

    if (camp_id) {
      query.camp_id = new mongoose.Types.ObjectId(camp_id);
    }

    if (zone_id) {
      query.zone_id = new mongoose.Types.ObjectId(zone_id);
    }

    if ((assigned_camps && assigned_camps.length > 0) || (assigned_zones && assigned_zones.length > 0)) {
      const orConditions: any[] = [];
      if (assigned_camps && assigned_camps.length > 0) {
        orConditions.push({ camp_id: { $in: assigned_camps.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      if (assigned_zones && assigned_zones.length > 0) {
        orConditions.push({ zone_id: { $in: assigned_zones.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      query.$or = orConditions;
    }

    const results = await Buildings.find(query).sort({ createdAt: -1 }).select(" _id building_name floors");
    return results.map(building => building.toJSON()) as unknown as BuildingResponse[];
  }

  async getOccupancySummary(
    client_id: string,
    camp_id?: string,
    zone_id?: string,
    building_name?: string,
    page: number = 1,
    limit: number = 1,
    assigned_camps?: string[],
    assigned_zones?: string[]
  ): Promise<PaginatedBuildingOccupancySummary> {

    // ── 1. Build match query ──────────────────────────────────────────
    const matchQuery: any = {
      client_id: new mongoose.Types.ObjectId(client_id)
    };
    if (camp_id) matchQuery.camp_id = new mongoose.Types.ObjectId(camp_id);
    if (zone_id) matchQuery.zone_id = new mongoose.Types.ObjectId(zone_id);
    if (building_name) matchQuery.building_name = { $regex: building_name, $options: "i" };

    if ((assigned_camps && assigned_camps.length > 0) || (assigned_zones && assigned_zones.length > 0)) {
      const orConditions: any[] = [];
      if (assigned_camps && assigned_camps.length > 0) {
        orConditions.push({ camp_id: { $in: assigned_camps.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      if (assigned_zones && assigned_zones.length > 0) {
        orConditions.push({ zone_id: { $in: assigned_zones.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      matchQuery.$or = orConditions;
    }

    const skip = (page - 1) * limit;

    // ── 2. Lightweight paginated query ────────────────────────────
    const [buildings, total] = await Promise.all([
      Buildings.find(matchQuery)
        .sort({ building_name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Buildings.countDocuments(matchQuery),
    ]);

    if (!buildings.length) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }

    const buildingIds = buildings.map((b) => b._id);

    // ── 3. Parallel fetch — rooms + statuses only for these buildings ─
    const [rooms, statuses] = await Promise.all([
      BuildingRooms.find({ building_id: { $in: buildingIds } } as any).sort({ updatedAt: -1 }).lean(),
      Statuses.find().lean() as any,   // small lookup table — fetch all once
    ]);;

    if (!rooms.length) {
      return {
        data: buildings.map((b: any) => ({
          id: b._id.toString(),
          building_name: b.building_name ?? "",
          totalRooms: 0,
          floors: [],
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    // ── 5. Build lookup maps in JS (zero DB cost) ─────────────────────
    const statusMap = new Map(statuses.map((s: any) => [s._id.toString(), s]));

    // rooms grouped by building_id
    const roomsByBuilding = new Map<string, any[]>();
    for (const room of rooms) {
      const key = (room as any).building_id.toString();
      if (!roomsByBuilding.has(key)) roomsByBuilding.set(key, []);
      roomsByBuilding.get(key)!.push(room);
    }

    // ── 6. Assemble final shape in memory ────────────────────────────
    const data: BuildingOccupancySummary[] = buildings.map((building: any) => {
      const buildingRooms = roomsByBuilding.get(building._id.toString()) ?? [];

      // group rooms by floor
      const floorMap = new Map<number, any[]>();

      for (const room of buildingRooms) {
        const status: any = statusMap.get((room as any).room_status?.toString());

        const totalBeds = room.occupancy ?? 0;
        const occupiedBeds = (room.occupancy ?? 0) - (room.available_space ?? 0);

        const roomShape = {
          id: room._id.toString(),
          room_number: room.room_number,
          status: {
            id: status?._id?.toString() ?? null,
            name: status?.name ?? null,
            slug: status?.slug ?? null,
          },
          totalBeds,
          occupiedBeds,
          updatedAt: (room as any).updatedAt || new Date()
        };

        const floor = room.floor ?? 0;
        if (!floorMap.has(floor)) floorMap.set(floor, []);
        floorMap.get(floor)!.push(roomShape);
      }

      // sort floors asc, slice first 7 rooms per floor (matches original $slice: 7)
      const floors = Array.from(floorMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([floorNumber, floorRooms]) => ({
          floorNumber,
          rooms: floorRooms
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()) // mirrors original $sort updatedAt desc
            .slice(0, 7),
        }));

      return {
        id: building._id.toString(),
        building_name: building.building_name ?? "",
        totalRooms: buildingRooms.length,
        floors,
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
