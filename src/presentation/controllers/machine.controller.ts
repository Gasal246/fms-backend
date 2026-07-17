import type { Response } from "express";
import type { MachineService } from "../../domain/repositories/machine.repository.interface.js";
import type { MachineFilter } from "../../domain/types/machine.types.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { MachineValidator } from "../../application/validators/machine.validator.js";
import { logger } from "../../shared/logger/logger.js";

export class MachineController {
  constructor(private machineUseCase: MachineService) {
    this.machineUseCase = machineUseCase;
  }

  createMachine = async (req: AuthenticatedRequest, res: Response) => {
    const userId = (req.user.id || req.user._id) as string;
    req.body.client_id = req.user.client_id;
    req.body.created_by = userId;

    MachineValidator.validateCreate(req.body);

    logger.info(`Creating machine: ${req.body.machine_name}`);
    const machine = await this.machineUseCase.createMachine(req.body);
    res.status(201).json({ message: "Machine created successfully", machine });
  };

  getMachine = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching machine details: ${id}`);
    const machine = await this.machineUseCase.getMachine(id as string);
    res.status(200).json(machine);
  };

  getMachines = async (req: AuthenticatedRequest, res: Response) => {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const filters: MachineFilter = {
      camp_id: req.query.camp_id as string | undefined,
      zone_id: req.query.zone_id as string | undefined,
      counter_id: req.query.counter_id as string | undefined,
      counter_point_id: req.query.counter_point_id as string | undefined,
      machine_type: req.query.machine_type as string | undefined,
      binding_status: req.query.binding_status as string | undefined,
      assigned_status: req.query.assigned_status as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      sortField: req.query.sortField as string | undefined,
      sortOrder: req.query.sortOrder as any | undefined,
      assigned_camps: req.user.assigned_camps?.map((c: any) => c.camp_id),
      assigned_zones: req.user.assigned_zones?.map((z: any) => z.zone_id)
    };

    // Remove undefined filters
    Object.keys(filters).forEach(
      (key) => (filters as any)[key] === undefined && delete (filters as any)[key]
    );

    const machines = await this.machineUseCase.getAllMachines(page, limit, filters, req.user.client_id);
    res.status(200).json(machines);
  };

  updateMachine = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user.id || req.user._id) as string;
    req.body.updated_by = userId;

    MachineValidator.validateUpdate(req.body);

    logger.info(`Updating machine: ${id}`);
    const machine = await this.machineUseCase.updateMachine(id as string, req.body);
    res.status(200).json({ message: "Machine updated successfully", machine });
  };

  deleteMachine = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user.id || req.user._id) as string;

    logger.info(`Deleting machine: ${id}`);
    await this.machineUseCase.deleteMachine(id as string, userId);
    res.status(200).json({ message: "Machine deleted successfully" });
  };

  activateMachine = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user.id || req.user._id) as string;

    logger.info(`Activating machine: ${id}`);
    const machine = await this.machineUseCase.activateMachine(id as string, userId);
    res.status(200).json({ message: "Machine activated successfully", machine });
  };

  deactivateMachine = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req.user.id || req.user._id) as string;

    logger.info(`Deactivating machine: ${id}`);
    const machine = await this.machineUseCase.deactivateMachine(id as string, userId);
    res.status(200).json({ message: "Machine deactivated successfully", machine });
  };
}
