import type { Response } from "express";
import type { RoomSummaryService } from "../../domain/repositories/room-summary.repository.interface.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";

export class RoomSummaryController {
  constructor(private roomSummaryUseCase: RoomSummaryService) { }

  getSummary = async (req: AuthenticatedRequest, res: Response) => {
    const roomId = req.params.roomId as string;
    logger.info(`Fetching room summary for room ID: ${roomId}`);

    const summary = await this.roomSummaryUseCase.getSummary(roomId);
    console.log(summary,"summery")
    res.status(200).json(summary);
  };
}
