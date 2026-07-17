import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.config.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { logger } from '../logger/logger.js';
import CompanyClientMembership from '../../infrastructure/persistence/models/company-client-membership.model.js';
import GlobalCompanyAccount from '../../infrastructure/persistence/models/global-company-account.model.js';

export const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided',
            });
        }

        const decoded: any = jwt.verify(token, env.jwtSecret);
       

        if (decoded.roleId === 'ROLE_COMPANY') {
            if (!decoded.company_account_id || !decoded.company_membership_id || !decoded.client_id || !decoded.id) {
                return res.status(401).json({ success: false, message: 'Company session context is invalid. Please sign in again.' });
            }
            const [membership, account] = await Promise.all([
                CompanyClientMembership.findOne({
                    _id: decoded.company_membership_id,
                    global_company_account_id: decoded.company_account_id,
                    client_id: decoded.client_id,
                    company_id: decoded.id,
                    status: 'Active',
                    deleted_at: null,
                }).select('_id').lean(),
                GlobalCompanyAccount.findOne({ _id: decoded.company_account_id, status: 'Active', deleted_at: null }).select('_id').lean(),
            ]);
            if (!membership || !account) return res.status(401).json({ success: false, message: 'Company membership is no longer active. Please sign in again.' });
        }

        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid token',
        });
    }
};
