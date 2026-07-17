import type { Response } from "express";
import type { AuthUseCase } from "../../application/use-cases/auth.usecase.js";
import type { AuthService } from "../../domain/repositories/auth.repository.interface.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";
import { AuthValidator } from "../../application/validators/auth.validator.js";


export class AuthController {
    constructor(private authuseCase: AuthService) {
        this.authuseCase = authuseCase;
    }
    signIn = async (req: AuthenticatedRequest, res: Response) => {
        const { email, password, role_slug, preferred_membership_id } = req.body;
        const result = await this.authuseCase.signIn({ email, password, role_slug, preferred_membership_id });
        res.cookie("token", result.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });
        res.status(200).json({ message: "Signed in successfully", user: result.user });
    }

    getRoles = async (req: AuthenticatedRequest, res: Response) => {
        const { email } = req.query;
        if (!email) {
            res.status(400).json({ message: "Email parameter is required" });
            return;
        }
        logger.info(`Fetching roles for email: ${email}`);
        const roles = await this.authuseCase.getRolesByEmail(email as string);
        res.status(200).json(roles);
    }

    getPermissions = async (req: AuthenticatedRequest, res: Response) => {
        const user = req.user;
        if (!user || !user.roleId) {
            res.status(400).json({ message: "User or role not found in request" });
            return;
        }
        const client_id = user.client_id || user.id;


        let permissions: any[] = [];

        if (user.roleId !== "ROLE_CLIENT_ADMIN" && user.role_slug !== "ROLE_CLIENT_ADMIN") {
            permissions = await this.authuseCase.getUserPermissions(user.roleId, client_id);
        }

        res.status(200).json({
            permissions,
            role: user.roleId,
            user: {
                id: user.id,
                email: user.email
            }
        });
    }

    signOut = async (req: AuthenticatedRequest, res: Response) => {
        logger.info("Signing out user");
        res.clearCookie("token");
        res.status(200).json({ message: "Signed out successfully" });
    }
}
