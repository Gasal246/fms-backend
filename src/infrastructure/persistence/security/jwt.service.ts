import jwt from "jsonwebtoken";
import type { TokenService } from "../../../domain/repositories/auth.repository.interface.js";
import { AppError } from "../../../shared/utils/AppError.js";

export class JwtService implements TokenService {
    async sign(payload: object): Promise<string> {
        try {
            return jwt.sign(payload, process.env.JWT_SECRET as string, {
                expiresIn: "24h",
            });
        }
        catch (error: any) {
            throw new AppError(`Token generation failed: ${error.message}`, 500);
        }
    }
}