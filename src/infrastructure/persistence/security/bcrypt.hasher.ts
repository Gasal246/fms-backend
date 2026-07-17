import bcrypt from "bcrypt";
import type { PasswordService } from "../../../domain/repositories/auth.repository.interface.js";
export class BcryptHasher implements PasswordService {
    async compare(plainText: string, hash: string): Promise<boolean> {
        return bcrypt.compare(plainText, hash);
    }
    
    async hash(plainText: string): Promise<string> {
        const saltRounds = 10;
        return bcrypt.hash(plainText, saltRounds);
    }
}