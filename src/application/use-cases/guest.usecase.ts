import type { GuestRepository } from "../../domain/repositories/guest.repository.interface.js";
import type { GuestFilter, GuestResponse, PaginatedGuestResponse, GuestRequest } from "../../domain/types/guest.types.js";
import { GuestValidator } from "../validators/guest.validator.js";
import { AppError } from "../../shared/utils/AppError.js";

export interface GuestService {
  getAllGuests(page: number, limit: number, filters: GuestFilter): Promise<PaginatedGuestResponse>;
  getGuestById(id: string): Promise<GuestResponse>;
  createGuest(data: GuestRequest): Promise<GuestResponse>;
  updateGuest(id: string, data: Partial<GuestRequest>): Promise<GuestResponse>;
  deleteGuest(id: string): Promise<void>;
}

export class GuestUseCase implements GuestService {
  constructor(private guestRepository: GuestRepository) {}

  async getAllGuests(pageNum: number, limitNum: number, filters: GuestFilter): Promise<PaginatedGuestResponse> {
    const page = pageNum > 0 ? pageNum : 1;
    const limit = limitNum > 0 ? limitNum : 10;
    return this.guestRepository.findAll(page, limit, filters);
  }

  async getGuestById(id: string): Promise<GuestResponse> {
    const guest = await this.guestRepository.findById(id);
    if (!guest) {
      throw new AppError("Guest not found", 404);
    }
    return guest;
  }

  async createGuest(data: GuestRequest): Promise<GuestResponse> {
    GuestValidator.validateCreateGuest(data);
    return this.guestRepository.create(data);
  }

  async updateGuest(id: string, data: Partial<GuestRequest>): Promise<GuestResponse> {
    GuestValidator.validateUpdateGuest(data);
    const guest = await this.guestRepository.update(id, data);
    if (!guest) {
      throw new AppError("Guest not found for update", 404);
    }
    return guest;
  }

  async deleteGuest(id: string): Promise<void> {
    const success = await this.guestRepository.delete(id);
    if (!success) {
      throw new AppError("Guest not found for deletion", 404);
    }
  }
}
