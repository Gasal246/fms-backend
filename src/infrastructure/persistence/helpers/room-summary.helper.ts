import mongoose from "mongoose";
import Room from "../models/room.model.js";
import Camp from "../models/camp.model.js";
import Camp_zones from "../models/zone.model.js";
import Zone_buildings from "../models/building.model.js";
import RoomSummary from "../models/room-summary.model.js";
import Bed from "../models/bed.model.js";
import UserRegister from "../models/tenant.model.js";
import { logger } from "../../../shared/logger/logger.js";

/**
 * Synchronizes the RoomSummary document for the given roomId.
 * Fetches the room, populates names of related entities, calculates occupancy
 * and capacity metrics, and upserts a document in the room_summaries collection.
 * 
 * @param roomId The ID of the room to sync.
 */
export async function syncRoomSummary(roomIdOrRoom: any, session?: mongoose.ClientSession): Promise<any> {
  try {
    if (!roomIdOrRoom) return null;

    let room: any;
    let id: mongoose.Types.ObjectId;

    if (roomIdOrRoom && (roomIdOrRoom._id || roomIdOrRoom.id)) {
      room = roomIdOrRoom;
      id = room._id;
    } else {
      id = typeof roomIdOrRoom === "string" ? new mongoose.Types.ObjectId(roomIdOrRoom) : roomIdOrRoom;
      let roomQuery = Room.findById(id);
      if (session) roomQuery = roomQuery.session(session);
      room = await roomQuery;
    }

    if (!room) {
      // Room was deleted, clean up summary as well
      let delQuery = RoomSummary.deleteOne({ room_id: id } as any);
      if (session) delQuery = delQuery.session(session);
      await delQuery;
      logger.info(`Deleted RoomSummary for non-existent room: ${id}`);
      return null;
    }

    // Fetch related names if they are not already populated
    let campName = "Unknown Camp";
    let zoneName = "Unknown Zone";
    let buildingName = "Unknown Building";

    const promises: Promise<any>[] = [];

    // Check if camp_id is populated (it will be an object and have camp_name)
    if (room.camp_id && typeof room.camp_id === "object" && "camp_name" in room.camp_id) {
      campName = room.camp_id.camp_name || "Unknown Camp";
    } else if (room.camp_id) {
      let q = Camp.findById(room.camp_id).select("camp_name").lean();
      if (session) q = q.session(session);
      promises.push(
        q.then(c => {
          if (c) campName = c.camp_name || "Unknown Camp";
        })
      );
    }

    // Check if zone_id is populated
    if (room.zone_id && typeof room.zone_id === "object" && "zone_name" in room.zone_id) {
      zoneName = room.zone_id.zone_name || "Unknown Zone";
    } else if (room.zone_id) {
      let q = Camp_zones.findById(room.zone_id).select("zone_name").lean();
      if (session) q = q.session(session);
      promises.push(
        q.then(z => {
          if (z) zoneName = z.zone_name || "Unknown Zone";
        })
      );
    }

    // Check if building_id is populated
    if (room.building_id && typeof room.building_id === "object" && "building_name" in room.building_id) {
      buildingName = room.building_id.building_name || "Unknown Building";
    } else if (room.building_id) {
      let q = Zone_buildings.findById(room.building_id).select("building_name").lean();
      if (session) q = q.session(session);
      promises.push(
        q.then(b => {
          if (b) buildingName = b.building_name || "Unknown Building";
        })
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    // Fetch beds and occupied tenants for summaries
    const bedQuery: any = {
      room_id: id,
      deleted_at: null,
      status: "occupied"
    };
    let bedsFindQuery = Bed.find(bedQuery).populate({
      path: "tenant_id",
      match: { deleted_at: null },
      select: "nationality country_state"
    }).lean();
    if (session) bedsFindQuery = bedsFindQuery.session(session);
    const beds = await bedsFindQuery;

    const nationalityCounts: Record<string, number> = {};
    const stateCounts: Record<string, number> = {};
    const originalNationalityNames: Record<string, string> = {};
    const originalStateNames: Record<string, string> = {};

    for (const bed of beds) {
      const tenant: any = bed.tenant_id;
      if (tenant) {
        if (tenant.nationality) {
          const nat = tenant.nationality.trim();
          if (nat) {
            const lowerNat = nat.toLowerCase();
            nationalityCounts[lowerNat] = (nationalityCounts[lowerNat] || 0) + 1;
            if (!originalNationalityNames[lowerNat]) {
              originalNationalityNames[lowerNat] = nat;
            }
          }
        }
        if (tenant.country_state) {
          const state = tenant.country_state.trim();
          if (state) {
            const lowerState = state.toLowerCase();
            stateCounts[lowerState] = (stateCounts[lowerState] || 0) + 1;
            if (!originalStateNames[lowerState]) {
              originalStateNames[lowerState] = state;
            }
          }
        }
      }
    }

    const nationality_summary = Object.entries(nationalityCounts)
      .map(([lowerNat, count]) => `${originalNationalityNames[lowerNat]}:${count}`);

    const country_state_summary = Object.entries(stateCounts)
      .map(([lowerState, count]) => `${originalStateNames[lowerState]}:${count}`);

    const floor = room.floor ?? 0;
    const capacity = `${room.occupancy ?? 0} Beds`;
    const occupied = `${(room.occupancy ?? 0) - (room.available_space ?? 0)} Tenants`;

    const summary = await RoomSummary.findOneAndUpdate(
      { room_id: id } as any,
      {
        room_number: room.room_number || "",
        Camp: campName,
        Zone: zoneName,
        Building: buildingName,
        Floor: floor,
        Capacity: capacity,
        Occupied: occupied,
        nationality: nationality_summary,
        country_state: country_state_summary,
        company_id: room.company_id || null,
      } as any,
      { upsert: true, new: true, session } as any
    );

    logger.info(`Successfully synced RoomSummary for room: ${room.room_number || id}`);
    return summary;
  } catch (error) {
    const errorId = roomIdOrRoom && (roomIdOrRoom._id || roomIdOrRoom.id) ? roomIdOrRoom._id : roomIdOrRoom;
    logger.error(`Error in syncRoomSummary for room ID ${errorId}: ${error}`);
    throw error;
  }
}

/**
 * Deletes the RoomSummary document for the given roomId.
 * 
 * @param roomId The ID of the room.
 */
export async function deleteRoomSummary(roomId: string | mongoose.Types.ObjectId): Promise<void> {
  try {
    if (!roomId) return;
    const id = typeof roomId === "string" ? new mongoose.Types.ObjectId(roomId) : roomId;
    await RoomSummary.deleteOne({ room_id: id });
    logger.info(`Deleted RoomSummary for room ID: ${id}`);
  } catch (error) {
    logger.error(`Error deleting RoomSummary for room ID ${roomId}: ${error}`);
  }
}
