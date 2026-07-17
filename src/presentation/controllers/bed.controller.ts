import type { Response } from "express";
import type { BedService } from "../../domain/repositories/bed.repository.interface.js";
import type { BedFilter } from "../../domain/types/bed.types.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { BedValidator } from "../../application/validators/bed.validator.js";
import { logger } from "../../shared/logger/logger.js";
import { AppError } from "../../shared/utils/AppError.js";

export class BedController {
  constructor(private bedUseCase: BedService) { }

  createBed = async (req: AuthenticatedRequest, res: Response) => {
    BedValidator.validateCreateBed(req.body);

    logger.info(`Creating bed: ${req.body.bed_number} for room: ${req.body.room_id}`);
    const bed = await this.bedUseCase.createBed(req.body);
    res.status(201).json({ message: "Bed created successfully", bed });
  };

  getBed = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    logger.info(`Fetching bed: ${id}`);
    const bed = await this.bedUseCase.getBed(id as string);
    res.status(200).json(bed);
  };

  getBeds = async (req: AuthenticatedRequest, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const { room_id, bed_number, status, type, tenant_id } = req.query;

    const filters: BedFilter = {
      room_id: room_id as string,
      bed_number: bed_number as string,
      status: status as "available" | "occupied",
      type: type as "SINGLE_BED" | "BUNK_UPPER" | "BUNK_LOWER",
      tenant_id: tenant_id === "null" ? null : (tenant_id as string || undefined),
      assigned_camps: req.user.assigned_camps?.map((c: any) => c.camp_id),
      assigned_zones: req.user.assigned_zones?.map((z: any) => z.zone_id)
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => (filters as any)[key] === undefined && delete (filters as any)[key]);

    const beds = await this.bedUseCase.getAllBeds(
      page,
      limit,
      filters,
      req.user.client_id
    );

    res.status(200).json(beds);
  };

  updateBed = async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id || req.body.id;
    
    // Safely extract update fields to avoid updating immutable '_id'
    const updateData: any = { client_id: req.user.client_id };
    
    if (req.body.bed_number !== undefined) updateData.bed_number = req.body.bed_number;
    else if (req.body.new_bed_number !== undefined) updateData.bed_number = req.body.new_bed_number;    
    
    if (req.body.room_id && req.body.room_id !== "") {
      updateData.room_id = req.body.room_id;
    }

    if (req.body.status && req.body.status !== "") {
      updateData.status = req.body.status;
    }
    
    if (req.body.tenant_id && req.body.tenant_id !== "") {
      updateData.tenant_id = req.body.tenant_id;
    } else if (req.body.tenant_id === null) {
      updateData.tenant_id = null; // Explicit null to unassign
    }

    if (req.body.type && req.body.type !== "") {
      updateData.type = req.body.type;
    }

    if (req.body.assignment_date) {
      updateData.assignment_date = req.body.assignment_date;
    }

    logger.info(`Updating bed: ${id}`);
    const bed = await this.bedUseCase.updateBed(id as string, updateData);
    res.status(200).json({ message: "Bed updated successfully", bed });
  };

  deleteBed = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Deleting bed: ${id}`);
    await this.bedUseCase.deleteBed(id as string);
    res.status(200).json({ message: "Bed deleted successfully" });
  };

  bulkAllocate = async (req: AuthenticatedRequest, res: Response) => {
    const { assignments, assignmentDate, targetCompanyId } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      res.status(400).json({ message: "Assignments list is required and cannot be empty." });
      return;
    }

    logger.info(`Bulk allocating ${assignments.length} tenants...`);
    await this.bedUseCase.bulkAllocate({
      assignments,
      assignmentDate,
      targetCompanyId,
      client_id: req.user.client_id
    });

    res.status(200).json({ message: "Bulk allocation completed successfully." });
  };
}
