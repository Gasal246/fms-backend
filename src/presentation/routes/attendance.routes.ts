import { Router } from "express";
import { AttendanceController } from "../controllers/attendance.controller.js";
import { AttendanceService } from "../../application/use-cases/attendance.usecase.js";
import { MongoAttendanceRepository } from "../../infrastructure/persistence/mongo-attendance.repository.js";

const router = Router();

const attendanceRepository = new MongoAttendanceRepository();
const attendanceService = new AttendanceService(attendanceRepository);
const attendanceController = new AttendanceController(attendanceService);

router.post("/check-in", attendanceController.checkIn);
router.post("/check-out", attendanceController.checkOut);
router.get("/", attendanceController.getAllAttendance);
router.get("/:user_id/summary", attendanceController.getAttendanceSummary);

export default router;
