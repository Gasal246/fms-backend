import type { CoordinatorRepository } from "../../domain/repositories/coordinator.repository.interface.js";
import type { CoordinatorFilter, CoordinatorResponse, PaginatedCoordinatorResponse, CoordinatorRequest } from "../../domain/types/coordinator.types.js";
import { AppError } from "../../shared/utils/AppError.js";
import type { PasswordService } from "../../domain/repositories/auth.repository.interface.js";
import { getDefaultAvatarUrl } from "../../shared/utils/avatar.js";

export interface CoordinatorService {
  getAllCoordinators(page: number, limit: number, filters: CoordinatorFilter): Promise<PaginatedCoordinatorResponse>;
  getCoordinatorById(id: string): Promise<CoordinatorResponse>;
  createCoordinator(data: CoordinatorRequest): Promise<CoordinatorResponse>;
  updateCoordinator(id: string, data: Partial<CoordinatorRequest>): Promise<CoordinatorResponse>;
  deleteCoordinator(id: string): Promise<void>;
}

export class CoordinatorUseCase implements CoordinatorService {
  constructor(
    private coordinatorRepository: CoordinatorRepository,
    private passwordService: PasswordService
  ) { }

  async getAllCoordinators(pageNum: number, limitNum: number, filters: CoordinatorFilter): Promise<PaginatedCoordinatorResponse> {
    const page = pageNum > 0 ? pageNum : 1;
    const limit = limitNum > 0 ? limitNum : 10;
    return this.coordinatorRepository.findAll(page, limit, filters);
  }

  async getCoordinatorById(id: string): Promise<CoordinatorResponse> {
    const coordinator = await this.coordinatorRepository.findById(id);
    if (!coordinator) {
      throw new AppError("Coordinator not found", 404);
    }
    return coordinator;
  }

  async createCoordinator(data: CoordinatorRequest): Promise<CoordinatorResponse> {
    const normalizedEmail = data.email.trim().toLowerCase();

    const existingEmail = await this.coordinatorRepository.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new AppError("Coordinator with this email already exists", 409);
    }

    if (data.phone) {
      const existingPhone = await this.coordinatorRepository.findByPhone(data.phone.trim());
      if (existingPhone) {
        throw new AppError("Coordinator with this phone number already exists", 409);
      }
    }

    const profilePic = data.profile_picture?.trim()
      ? data.profile_picture.trim()
      : getDefaultAvatarUrl(data.full_name);

    const generateUUID = (phone?: string) => {
      const timestamp = Date.now().toString(); // 13 digits
      const last3Digits = phone ? phone.slice(-3).padStart(3, "0") : "000"; // ensure 3 digits
      return timestamp + last3Digits; // total 16 digits
    };

    const hashedPassword = await this.passwordService.hash(data.password || "123456");
    const createPayload: CoordinatorRequest = {
      ...data,
      email: normalizedEmail,
      password: hashedPassword,
      profile_picture: profilePic,
      uuid: generateUUID(data.phone)
    };
    if (data.phone) {
      createPayload.phone = data.phone.trim();
    } else {
      delete createPayload.phone;
    }
    return this.coordinatorRepository.create(createPayload);
  }

  async updateCoordinator(id: string, data: Partial<CoordinatorRequest>): Promise<CoordinatorResponse> {
    const coordinatorExists = await this.coordinatorRepository.findById(id);
    if (!coordinatorExists) {
      throw new AppError("Coordinator not found", 404);
    }

    const updateData = { ...data };

    if (data.profile_picture !== undefined && data.profile_picture !== coordinatorExists.profile_picture) {
      if (data.profile_picture === '') {
        const existingName = data.full_name || coordinatorExists.full_name;
        updateData.profile_picture = getDefaultAvatarUrl(existingName);
      }
    }
    if (data.email) {
      const normalizedEmail = data.email.trim().toLowerCase();
      updateData.email = normalizedEmail;
      const existingEmail = await this.coordinatorRepository.findByEmail(normalizedEmail);
      if (existingEmail && existingEmail._id.toString() !== id) {
        throw new AppError("Coordinator with this email already exists", 409);
      }
    }

    if (data.phone) {
      const trimmedPhone = data.phone.trim();
      updateData.phone = trimmedPhone;
      const existingPhone = await this.coordinatorRepository.findByPhone(trimmedPhone);
      if (existingPhone && existingPhone._id.toString() !== id) {
        throw new AppError("Coordinator with this phone number already exists", 409);
      }
    }

    if (data.password && data.password.trim() !== "") {
      updateData.password = await this.passwordService.hash(data.password);
    } else {
      delete updateData.password;
    }
    const coordinator = await this.coordinatorRepository.update(id, updateData);
    if (!coordinator) {
      throw new AppError("Coordinator not found for update", 404);
    }
    return coordinator;
  }

  async deleteCoordinator(id: string): Promise<void> {
    const success = await this.coordinatorRepository.delete(id);
    if (!success) {
      throw new AppError("Coordinator not found for deletion", 404);
    }
  }
}
