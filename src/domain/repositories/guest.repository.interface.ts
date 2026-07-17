import type { GuestFilter, GuestResponse, PaginatedGuestResponse, GuestRequest } from "../types/guest.types.js";

export interface GuestRepository {
  findAll(page: number, limit: number, filters: GuestFilter): Promise<PaginatedGuestResponse>;
  findById(id: string): Promise<GuestResponse | null>;
  create(data: GuestRequest): Promise<GuestResponse>;
  update(id: string, data: Partial<GuestRequest>): Promise<GuestResponse | null>;
  delete(id: string): Promise<boolean>;
}
