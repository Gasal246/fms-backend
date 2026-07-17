import type { AttendanceRepository } from "../../domain/repositories/attendance.repository.interface.js";
import type { AttendanceFilter } from "../../domain/types/attendance.types.js";
import mongoose from "mongoose";
import Attendance, { type IAttendance } from "./models/attendance.model.js";
import Tenant from "./models/tenant.model.js";
import TechnicianAssignCamps from "./models/technician-assign-camps.model.js";

export class MongoAttendanceRepository implements AttendanceRepository {
  async createCheckIn(data: Partial<IAttendance>): Promise<IAttendance> {
    const attendance = new Attendance(data);
    return await attendance.save();
  }

  async updateCheckOut(id: string, checkOutDate: Date, notes?: string, is_manual?: boolean): Promise<IAttendance | null> {
    const active = await Attendance.findById(id);
    const updateData: any = { check_out: checkOutDate };
    if (notes) {
      updateData.notes = active?.notes ? `${active.notes} | Check-out: ${notes}` : notes;
    }
    if (is_manual !== undefined) {
      updateData.is_manual = is_manual;
    } else if (notes) {
      updateData.is_manual = true;
    }
    return await Attendance.findByIdAndUpdate(id, updateData, { returnDocument: 'after' });
  }

  async findActiveCheckIn(user_id: string, date?: Date): Promise<IAttendance | null> {
    const query: any = {
      user_id: new mongoose.Types.ObjectId(user_id),
      check_out: { $exists: false }
    };
    if (date) {
      query.date = date;
    }
    return await Attendance.findOne(query).sort({ check_in: -1 });
  }

  async findAttendanceByFilter(
    filters: AttendanceFilter,
    skip: number,
    limit: number
  ): Promise<{ items: IAttendance[]; total: number }> {
    const query: any = {};

    if (filters.client_id) query.client_id = new mongoose.Types.ObjectId(filters.client_id as string);
    if (filters.user_id) query.user_id = new mongoose.Types.ObjectId(filters.user_id as string);
    if (filters.user_type) query.user_type = filters.user_type;
    
    if (filters.date) {
      const dateStr = filters.date;
      const startOfDay = new Date(dateStr);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(dateStr);
      endOfDay.setUTCHours(23, 59, 59, 999);

      // Check if the requested date is today
      const today = new Date();
      const isToday = today.getUTCFullYear() === startOfDay.getUTCFullYear() &&
                      today.getUTCMonth() === startOfDay.getUTCMonth() &&
                      today.getUTCDate() === startOfDay.getUTCDate();

      if (isToday) {
        query.$or = [
          { date: { $gte: startOfDay, $lte: endOfDay } },
          { check_out: { $exists: false } }
        ];
      } else {
        query.date = { $gte: startOfDay, $lte: endOfDay };
      }
    }

    if (filters.status === "present") {
      query.check_in = { $exists: true };
    }

    if ((filters.assigned_camps && filters.assigned_camps.length > 0) || (filters.assigned_zones && filters.assigned_zones.length > 0)) {
      const allowedUserIds = new Set<string>();

      // Tenants
      const tenantMatchQuery: any = {};
      const orConditions: any[] = [];
      if (filters.assigned_camps && filters.assigned_camps.length > 0) {
        orConditions.push({ camp_id: { $in: filters.assigned_camps.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      if (filters.assigned_zones && filters.assigned_zones.length > 0) {
        orConditions.push({ zone_id: { $in: filters.assigned_zones.map(id => new mongoose.Types.ObjectId(id)) } });
      }
      tenantMatchQuery.$or = orConditions;

      const allowedTenants = await Tenant.find(tenantMatchQuery).select("_id").lean();
      allowedTenants.forEach((t: any) => allowedUserIds.add(t._id.toString()));

      // Staff (Technicians)
      // Technicians only have assigned camps (via TechnicianAssignCamps)
      if (filters.assigned_camps && filters.assigned_camps.length > 0) {
        const allowedStaff = await TechnicianAssignCamps.find({
          camp_id: { $in: filters.assigned_camps.map(id => new mongoose.Types.ObjectId(id)) }
        }).select("technician_id").lean();
        allowedStaff.forEach((s: any) => allowedUserIds.add(s.technician_id.toString()));
      }

      const allowedIdsArray = Array.from(allowedUserIds).map(id => new mongoose.Types.ObjectId(id));
      
      if (query.user_id) {
        if (!allowedUserIds.has(query.user_id.toString())) {
          query.user_id = new mongoose.Types.ObjectId(); // force no match
        }
      } else {
        query.user_id = { $in: allowedIdsArray };
      }
    }

    const [items, total] = await Promise.all([
      Attendance.find(query)
        .sort({ check_in: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Attendance.countDocuments(query),
    ]);

    return { items, total };
  }

  async findAttendanceByUserAndDate(user_id: string, date: Date): Promise<IAttendance[]> {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    return await Attendance.find({
      user_id: new mongoose.Types.ObjectId(user_id),
      date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ check_in: 1 }).exec();
  }
}
