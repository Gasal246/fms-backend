import mongoose from "mongoose";
import type { ZoneRepository } from "../../domain/repositories/zone.repository.interface.js";
import type { ZoneFilter, ZoneResponse } from "../../domain/types/zone.types.js";
import CampZones from "./models/zone.model.js";

export class MongoZoneRepository implements ZoneRepository {
  async findById(id: string): Promise<any | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid zone ID");
    }
    return CampZones.findById(id);
  }

  async findAll(client_id: string, camp_id?: string, assigned_camps?: string[], assigned_zones?: string[], search?: string): Promise<ZoneResponse[]> {
    const query: any = { client_id: new mongoose.Types.ObjectId(client_id) };

    if (camp_id) {
      query.camp_id = new mongoose.Types.ObjectId(camp_id);
    }

    if (search && search.trim() !== '') {
      query.zone_name = { $regex: search.trim(), $options: 'i' };
    }

    if ((assigned_camps && assigned_camps.length > 0) || (assigned_zones && assigned_zones.length > 0)) {
      const orConditions: any[] = [];
      if (assigned_camps && assigned_camps.length > 0) {
        orConditions.push({ camp_id: { $in: assigned_camps.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      if (assigned_zones && assigned_zones.length > 0) {
        orConditions.push({ _id: { $in: assigned_zones.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      query.$or = orConditions;
    }

    const results = await CampZones.find(query).sort({ createdAt: -1 }).select(" _id zone_name");
    return results.map(zone => zone.toJSON()) as unknown as ZoneResponse[];
  }
}
