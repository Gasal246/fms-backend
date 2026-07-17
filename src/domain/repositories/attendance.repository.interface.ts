import type { IAttendance } from "../../infrastructure/persistence/models/attendance.model.js";
import type { AttendanceFilter } from "../types/attendance.types.js";

export interface AttendanceRepository {
  createCheckIn(data: Partial<IAttendance>): Promise<IAttendance>;
  updateCheckOut(id: string, checkOutDate: Date, notes?: string, is_manual?: boolean): Promise<IAttendance | null>;
  findActiveCheckIn(user_id: string, date?: Date): Promise<IAttendance | null>;
  findAttendanceByFilter(
    filters: AttendanceFilter,
    skip: number,
    limit: number
  ): Promise<{ items: IAttendance[]; total: number }>;
  findAttendanceByUserAndDate(user_id: string, date: Date): Promise<IAttendance[]>;
}
