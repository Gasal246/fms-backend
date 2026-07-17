import type { Response } from "express";
import type { AttendanceService } from "../../application/use-cases/attendance.usecase.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";
import type { AttendanceFilter, AttendanceRequest } from "../../domain/types/attendance.types.js";

export class AttendanceController {
  constructor(private attendanceUseCase: AttendanceService) {}

  checkIn = async (req: AuthenticatedRequest, res: Response) => {
    logger.info(`Processing check-in request for user ${req.body.user_id || req.body.uuid}`);
    try {
      const client_id = req.user?.client_id;
      if (!client_id) {
        return res.status(401).json({ message: "Unauthorized. Missing client info." });
      }

      const requestData: AttendanceRequest = {
        user_id: req.body.user_id,
        user_type: req.body.user_type,
        uuid: req.body.uuid,
        date: req.body.date,
        is_manual: req.body.is_manual,
        notes: req.body.notes,
      };

      const result = await this.attendanceUseCase.checkIn(client_id, requestData);
      res.status(201).json(result);
    } catch (error: any) {
      logger.error(`Error during check-in: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  checkOut = async (req: AuthenticatedRequest, res: Response) => {
    logger.info(`Processing check-out request for user ${req.body.user_id || req.body.uuid}`);
    try {
      const requestData: AttendanceRequest = {
        user_id: req.body.user_id,
        user_type: req.body.user_type,
        uuid: req.body.uuid,
        date: req.body.date,
        is_manual: req.body.is_manual,
        notes: req.body.notes,
      };

      const result = await this.attendanceUseCase.checkOut(requestData);
      res.status(200).json(result);
    } catch (error: any) {
      logger.error(`Error during check-out: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  getAllAttendance = async (req: AuthenticatedRequest, res: Response) => {
    logger.info("Fetching all attendance records");
    try {
      const client_id = req.user?.client_id || req.query.client_id;
      if (!client_id) {
         return res.status(401).json({ success: false, message: "Unauthorized. Missing client info." });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const filters: AttendanceFilter = {
        client_id: (req.query.client_id as string) || req.user?.client_id,
        user_id: req.query.user_id as string,
        user_type: req.query.user_type as "staff" | "tenant",
        date: req.query.date as string,
        status: req.query.status as "present" | "absent",
        assigned_camps: req.user?.assigned_camps?.map((c: any) => c.camp_id),
        assigned_zones: req.user?.assigned_zones?.map((z: any) => z.zone_id),
      };

      Object.keys(filters).forEach(key => (filters as any)[key] === undefined && delete (filters as any)[key]);

      const attendanceRecords = await this.attendanceUseCase.getAllAttendance(page, limit, filters);
      res.status(200).json(attendanceRecords);
    } catch (error: any) {
      logger.error(`Error fetching attendance records: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };

  getAttendanceSummary = async (req: AuthenticatedRequest, res: Response) => {
    const user_id = req.params.user_id as string;
    const date = (req.query.date as string) || new Date().toISOString();
    
    logger.info(`Fetching attendance summary for user ${user_id} on date ${date}`);
    try {
      const summary = await this.attendanceUseCase.getAttendanceSummary(user_id, date);
      res.status(200).json(summary);
    } catch (error: any) {
      logger.error(`Error fetching attendance summary: ${error.message}`);
      res.status(error.statusCode || 500).json({ message: error.message });
    }
  };
}
