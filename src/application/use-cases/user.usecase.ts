import { AppError } from "../../shared/utils/AppError.js";
import type { UserRepository } from "../../domain/repositories/user.repository.interface.js";

export class UserUseCase {
    constructor(private userRepository: UserRepository) { }

    async getProfile(userId: string, roleSlug: string): Promise<any> {
        const user = await this.userRepository.findById(userId, roleSlug);
        if (!user) {
            throw new AppError("User not found", 404);
        }
        return user;
    }

    async updateProfile(userId: string, roleSlug: string, data: any): Promise<any> {
        const updatedUser = await this.userRepository.updateProfile(userId, roleSlug, data);
        if (!updatedUser) {
            throw new AppError("User not found or update failed", 404);
        }
        return updatedUser;
    }
}
