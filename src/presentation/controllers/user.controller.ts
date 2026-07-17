
import type { Response } from "express";
import { UserUseCase } from "../../application/use-cases/user.usecase.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";

import { logger } from "../../shared/logger/logger.js";
import GlobalCompanyAccount from "../../infrastructure/persistence/models/global-company-account.model.js";
import CompanyClientMembership from "../../infrastructure/persistence/models/company-client-membership.model.js";
import Client from "../../infrastructure/persistence/models/user.model.js";


export class UserController {
    constructor(private userUseCase: UserUseCase) { }

    getProfile = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user.id;
            const roleSlug = req.user.roleId;
            logger.info(`Fetching profile for user ID: ${userId} with role: ${roleSlug}`);
            let profile = await this.userUseCase.getProfile(userId, roleSlug);
            if (roleSlug === "ROLE_COMPANY" && req.user.company_account_id) {
                const [account, membership, client] = await Promise.all([
                    GlobalCompanyAccount.findById(req.user.company_account_id).select("-password").lean(),
                    CompanyClientMembership.findById(req.user.company_membership_id).lean(),
                    Client.findById(req.user.client_id).select("business_name full_name city").lean(),
                ]);
                profile = { ...profile, globalAccount: account, selectedMembership: membership, selectedClient: client ? { id: (client as any)._id.toString(), name: (client as any).business_name || (client as any).full_name, city: (client as any).city || "" } : null };
            }
            res.status(200).json({
                success: true,
                data: profile
            });
        } catch (error: any) {
            logger.error(`Error fetching profile: ${error.message}`);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || "Internal server error"
            });
        }
    }

    updateProfile = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user.id;
            const roleSlug = req.user.roleId;
            const updateData = req.body;
            logger.info(`Updating profile for user ID: ${userId} with role: ${roleSlug}`);
            const updatedProfile = await this.userUseCase.updateProfile(userId, roleSlug, updateData);
            res.status(200).json({
                success: true,
                message: "Profile updated successfully",
                data: updatedProfile
            });
        } catch (error: any) {
            logger.error(`Error updating profile: ${error.message}`);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || "Internal server error"
            });
        }
    }
}
