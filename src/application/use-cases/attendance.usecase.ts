import type { AttendanceRepository } from "../../domain/repositories/attendance.repository.interface.js";
import type { AttendanceRequest, AttendanceFilter, PaginatedAttendanceResponse, AttendanceResponse } from "../../domain/types/attendance.types.js";
import { AppError } from "../../shared/utils/AppError.js";
import type { IAttendance } from "../../infrastructure/persistence/models/attendance.model.js";
import Coordinator from "../../infrastructure/persistence/models/coordinator.model.js";
import UserRegister from "../../infrastructure/persistence/models/tenant.model.js";

export class AttendanceService {
  constructor(private attendanceRepository: AttendanceRepository) {}

  private mapToResponse(attendance: IAttendance): AttendanceResponse {
    let total_hours = 0;
    if (attendance.check_in && attendance.check_out) {
      const diffInMs = attendance.check_out.getTime() - attendance.check_in.getTime();
      total_hours = parseFloat((diffInMs / (1000 * 60 * 60)).toFixed(2));
    }

    const response: AttendanceResponse = {
      id: attendance._id.toString(),
      user_id: attendance.user_id.toString(),
      user_type: attendance.user_type,
      client_id: attendance.client_id.toString(),
      date: attendance.date,
      check_in: attendance.check_in,
      is_manual: attendance.is_manual,
      createdAt: attendance.createdAt,
      updatedAt: attendance.updatedAt,
    };

    if (attendance.check_out) response.check_out = attendance.check_out;
    if (attendance.notes) response.notes = attendance.notes;
    if (total_hours > 0) response.total_hours = total_hours;

    return response;
  }

  private async resolveUser(request: AttendanceRequest): Promise<{ userId: string; userType: "staff" | "tenant" }> {
    let resolvedUserId = request.user_id;
    let resolvedUserType = request.user_type;

    if ((!resolvedUserId || !resolvedUserType) && request.uuid) {
      // Look up in Coordinator (staff)
      const coord = await Coordinator.findOne({ uuid: request.uuid, deleted_at: null }).lean();
      if (coord) {
        resolvedUserId = coord._id.toString();
        resolvedUserType = "staff";
      } else {
        // Look up in UserRegister (tenant)
        const tenant = await UserRegister.findOne({ uuid: request.uuid, deleted_at: null }).lean();
        if (tenant) {
          resolvedUserId = tenant._id.toString();
          resolvedUserType = "tenant";
        }
      }
    }

    if (!resolvedUserId || !resolvedUserType) {
      throw new AppError("Invalid user details. User ID and User Type or a valid UUID is required.", 400);
    }

    return { userId: resolvedUserId, userType: resolvedUserType };
  }

  async checkIn(client_id: string, request: AttendanceRequest): Promise<AttendanceResponse> {
    const { userId, userType } = await this.resolveUser(request);
    const requestDate = request.date ? new Date(request.date) : new Date();
    
    // Normalize date to start of day for the `date` field
    const dateOnly = new Date(requestDate);
    dateOnly.setUTCHours(0, 0, 0, 0);

    // Check if there is an active check-in without check-out
    const activeCheckIn = await this.attendanceRepository.findActiveCheckIn(userId);
    if (activeCheckIn) {
      throw new AppError("User is already checked in. Please check out first.", 400);
    }

    const attendanceData: Partial<IAttendance> = {
      user_id: userId as any,
      user_type: userType,
      client_id: client_id as any,
      date: dateOnly,
      check_in: requestDate,
      is_manual: request.is_manual || false,
    };

    if (request.notes) {
      attendanceData.notes = request.notes;
    }

    const newAttendance = await this.attendanceRepository.createCheckIn(attendanceData);
    return this.mapToResponse(newAttendance);
  }

  async checkOut(request: AttendanceRequest): Promise<AttendanceResponse> {
    const { userId } = await this.resolveUser(request);
    const requestDate = request.date ? new Date(request.date) : new Date();
    
    // Normalize date to start of day
    const dateOnly = new Date(requestDate);
    dateOnly.setUTCHours(0, 0, 0, 0);

    const activeCheckIn = await this.attendanceRepository.findActiveCheckIn(userId);
    if (!activeCheckIn) {
      throw new AppError("No active check-in found for the user.", 400);
    }

    const updatedAttendance = await this.attendanceRepository.updateCheckOut(
      activeCheckIn._id.toString(),
      requestDate,
      request.notes,
      request.is_manual
    );

    if (!updatedAttendance) {
      throw new AppError("Failed to checkout", 500);
    }

    return this.mapToResponse(updatedAttendance);
  }

  async getAllAttendance(
    page: number = 1,
    limit: number = 10,
    filters: AttendanceFilter
  ): Promise<PaginatedAttendanceResponse> {
    const skip = (page - 1) * limit;
    const { items, total } = await this.attendanceRepository.findAttendanceByFilter(
      filters,
      skip,
      limit
    );

    const totalPages = Math.ceil(total / limit);
    return {
      items: items.map(this.mapToResponse),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getAttendanceSummary(user_id: string, date: string): Promise<{ records: AttendanceResponse[], total_hours: number }> {
    const targetDate = new Date(date);
    const records = await this.attendanceRepository.findAttendanceByUserAndDate(user_id, targetDate);

    const responseRecords = records.map(this.mapToResponse);
    const total_hours = responseRecords.reduce((sum: number, record: AttendanceResponse) => sum + (record.total_hours || 0), 0);

    return {
      records: responseRecords,
      total_hours: parseFloat(total_hours.toFixed(2)),
    };
  }
}
