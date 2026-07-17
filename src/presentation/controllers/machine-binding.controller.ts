import type { Response } from "express";
import type { MachineBindingService } from "../../domain/repositories/machine-binding.repository.interface.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";

export class MachineBindingController {
  constructor(private machineBindingUseCase: MachineBindingService) {
    this.machineBindingUseCase = machineBindingUseCase;
  }

  bindMachine = async (req: AuthenticatedRequest, res: Response) => {
    const clientId = req.user?.client_id;
    const userId = (req.user?.id || req.user?._id) as string;
    
    // Resolve client IP address
    let ipAddress = "127.0.0.1";
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
      if (firstForwarded) {
        ipAddress = firstForwarded.trim();
      }
    } else if (req.ip) {
      ipAddress = req.ip;
    } else if (req.socket?.remoteAddress) {
      ipAddress = req.socket.remoteAddress;
    }
    
    const userAgent = (req.headers["user-agent"] || "unknown") as string;

    logger.info(`Attempting machine bind: ${req.body?.machine_id} from IP: ${ipAddress}`);
    const result = await this.machineBindingUseCase.bindMachine(
      req.body,
      clientId,
      userId,
      ipAddress,
      userAgent
    );

    res.status(200).json(result);
  };

  getBindingHistory = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching binding history for machine: ${id}`);
    const history = await this.machineBindingUseCase.getBindingHistory(id as string);
    res.status(200).json(history);
  };

  getBindingStatus = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching binding status for machine: ${id}`);
    const status = await this.machineBindingUseCase.getBindingStatus(id as string);
    res.status(200).json(status);
  };
}
