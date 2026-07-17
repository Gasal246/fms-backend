import type { RoomSummaryRepository, RoomSummaryService } from "../../domain/repositories/room-summary.repository.interface.js";
import { syncRoomSummary } from "../../infrastructure/persistence/helpers/room-summary.helper.js";
import { AppError } from "../../shared/utils/AppError.js";

export class RoomSummaryUseCase implements RoomSummaryService {
  constructor(private roomSummaryRepository: RoomSummaryRepository) { }

  async getSummary(roomId: string): Promise<any> {
    let summary = await this.roomSummaryRepository.findByRoomId(roomId);

    // Lazy-sync/Self-healing if summary doesn't exist yet
    if (!summary) {
      summary = await syncRoomSummary(roomId);
    }

    if (!summary) {
      throw new AppError("Room summary not found", 404);
    }

    return summary;
  }

  async syncSummary(roomId: string): Promise<any> {
    const summary = await syncRoomSummary(roomId);
    if (!summary) {
      throw new AppError("Room not found to generate summary", 404);
    }
    return summary;
  }
}
