import type { TechnicianRepository } from "../../domain/repositories/technician.repository.interface.js";
import type { TechnicianFilter, TechnicianResponse, PaginatedTechnicianResponse, TechnicianRequest } from "../../domain/types/technician.types.js";
import { AppError } from "../../shared/utils/AppError.js";
import type { PasswordService } from "../../domain/repositories/auth.repository.interface.js";
import { getDefaultAvatarUrl } from "../../shared/utils/avatar.js";

export interface TechnicianService {
  getAllTechnicians(page: number, limit: number, filters: TechnicianFilter, client_id?: string): Promise<PaginatedTechnicianResponse>;
  getTechnicianById(id: string): Promise<TechnicianResponse>;
  createTechnician(data: TechnicianRequest): Promise<TechnicianResponse>;
  updateTechnician(id: string, data: Partial<TechnicianRequest>): Promise<TechnicianResponse>;
  deleteTechnician(id: string): Promise<void>;
}

export class TechnicianUseCase implements TechnicianService {
  constructor(
    private technicianRepository: TechnicianRepository,
    private passwordService: PasswordService
  ) { }

  async getAllTechnicians(pageNum: number, limitNum: number, filters: TechnicianFilter, client_id?: string): Promise<PaginatedTechnicianResponse> {
    const page = pageNum > 0 ? pageNum : 1;
    const limit = limitNum > 0 ? limitNum : 10;
    return this.technicianRepository.findAll(page, limit, filters, client_id);
  }

  async getTechnicianById(id: string): Promise<TechnicianResponse> {
    const technician = await this.technicianRepository.findById(id);
    if (!technician) {
      throw new AppError("Technician not found", 404);
    }
    return technician;
  }

  async createTechnician(data: TechnicianRequest): Promise<TechnicianResponse> {
    const normalizedEmail = data.email.trim().toLowerCase();

    const existingEmail = await this.technicianRepository.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new AppError("Technician with this email already exists", 409);
    }

    if (data.phone) {
      const existingPhone = await this.technicianRepository.findByPhone(data.phone.trim());
      if (existingPhone) {
        throw new AppError("Technician with this phone number already exists", 409);
      }
    }

    const profilePic = data.profile_picture?.trim()
      ? data.profile_picture.trim()
      : getDefaultAvatarUrl(data.name);

    const hashedPassword = await this.passwordService.hash(data.password || "123456");
    return this.technicianRepository.create({
      ...data,
      email: normalizedEmail,
      phone: data.phone ? data.phone.trim() : data.phone,
      password: hashedPassword,
      profile_picture: profilePic
    });
  }

  async updateTechnician(id: string, data: Partial<TechnicianRequest>): Promise<TechnicianResponse> {
    const technicianExists = await this.technicianRepository.findById(id);
    if (!technicianExists) {
      throw new AppError("Technician not found", 404);
    }

    const updateData = { ...data };

    if (data.profile_picture !== undefined && data.profile_picture !== technicianExists.profile_picture) {
      if (data.profile_picture === '') {
        const existingName = data.name || technicianExists.name;
        updateData.profile_picture = getDefaultAvatarUrl(existingName);
      }
    }
    if (data.email) {
      const normalizedEmail = data.email.trim().toLowerCase();
      updateData.email = normalizedEmail;
      const existingEmail = await this.technicianRepository.findByEmail(normalizedEmail);
      if (existingEmail && existingEmail._id.toString() !== id) {
        throw new AppError("Technician with this email already exists", 409);
      }
    }

    if (data.phone) {
      const trimmedPhone = data.phone.trim();
      updateData.phone = trimmedPhone;
      const existingPhone = await this.technicianRepository.findByPhone(trimmedPhone);
      if (existingPhone && existingPhone._id.toString() !== id) {
        throw new AppError("Technician with this phone number already exists", 409);
      }
    }

    if (data.password && data.password.trim() !== "") {
      updateData.password = await this.passwordService.hash(data.password);
    } else {
      delete updateData.password;
    }
    const technician = await this.technicianRepository.update(id, updateData);
    if (!technician) {
      throw new AppError("Technician not found for update", 404);
    }
    return technician;
  }

  async deleteTechnician(id: string): Promise<void> {
    const success = await this.technicianRepository.delete(id);
    if (!success) {
      throw new AppError("Technician not found for deletion", 404);
    }
  }
}
