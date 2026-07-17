import type { Response } from "express";
import type { RoomService } from "../../domain/repositories/room.repository.interface.js";
import type { RoomFilter } from "../../domain/types/room.types.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { RoomValidator } from "../../application/validators/room.validator.js";
import { logger } from "../../shared/logger/logger.js";
import { log } from "node:console";

export class RoomController {
  constructor(private roomUseCase: RoomService) { }

  createRoom = async (req: AuthenticatedRequest, res: Response) => {
    req.body.client_id = req.user.client_id;
    RoomValidator.validateCreateRoom(req.body);

    logger.info(`Creating room: ${req.body.room_number}`);
    const room = await this.roomUseCase.createRoom(req.body);
    res.status(201).json({ message: "Room created successfully", room });
  };

  getRoom = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    logger.info(`Fetching room: ${id}`);
    const room = await this.roomUseCase.getRoom(id as string);
    res.status(200).json(room);
  };
  getRooms = async (req: AuthenticatedRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    // Extract filters from query
    const isCompany = (req.user.roleId || req.user.role_slug) === "ROLE_COMPANY";
    const filters: RoomFilter = {
      client_id: req.query.client_id as string | undefined,
      company_id: isCompany ? String(req.user.id) : req.query.company_id as string | undefined,
      contract_id: req.query.contract_id as string | undefined,
      camp_id: req.query.camp_id as string | undefined,
      zone_id: req.query.zone_id as string | undefined,
      building_id: req.query.building_id as string | undefined,
      room_number: req.query.room_number as string | undefined,
      room_id: req.query.room_id as string | undefined,
      floor: req.query.floor ? parseInt(req.query.floor as string) : undefined,
      status: req.query.status ? parseInt(req.query.status as string) : undefined,
      room_status: req.query.room_status as string | undefined,
      assigned_camps: req.user.assigned_camps?.map((c: any) => c.camp_id),
      assigned_zones: req.user.assigned_zones?.map((z: any) => z.zone_id),
      nationality: req.query.nationality as string | undefined,
      country_state: req.query.country_state as string | undefined,
    };


    // Remove undefined filters
    Object.keys(filters).forEach(key => (filters as any)[key] === undefined && delete (filters as any)[key]);
    const rooms = await this.roomUseCase.getAllRooms(page, limit, filters, req.user.client_id);

    res.status(200).json(rooms);
  };

  updateRoom = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Updating room: ${id}`);
    const room = await this.roomUseCase.updateRoom(id as string, req.body);
    res.status(200).json({ message: "Room updated successfully", room });
  };

  deleteRoom = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Deleting room: ${id}`);
    await this.roomUseCase.deleteRoom(id as string);
    res.status(200).json({ message: "Room deleted successfully" });
  };
}
