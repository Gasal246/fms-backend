import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.config.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { logger } from '../logger/logger.js';
import CompanyClientMembership from '../../infrastructure/persistence/models/company-client-membership.model.js';
import GlobalCompanyAccount from '../../infrastructure/persistence/models/global-company-account.model.js';
import KitchenManager from '../../infrastructure/persistence/models/kitchen-manager.model.js';

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

        if (decoded.roleId === 'ROLE_KITCHEN_MANAGER') {
            const manager: any = await KitchenManager.findOne({
                _id: decoded.id,
                client_id: decoded.client_id,
                status: 'Active',
                deleted_at: null,
            }).select('client_id kitchen_ids email name phone status').lean();
            if (!manager || !manager.kitchen_ids?.length) {
                return res.status(401).json({ success: false, message: 'Kitchen Manager access is no longer active. Please sign in again.' });
            }
            decoded.kitchen_ids = manager.kitchen_ids.map((value: any) => value.toString());
            decoded.email = manager.email;
            decoded.name = manager.name;

            const requestPath = req.originalUrl.split('?')[0] || '';
            const managerRouteAllowed = [
                /^\/(?:api\/)?apm\/catering\/kitchen(?:\/|$)/,
                /^\/(?:api\/)?user\/profile(?:\/|$)/,
                /^\/(?:api\/)?auth\/permissions(?:\/|$)/,
            ].some(pattern => pattern.test(requestPath));
            if (!managerRouteAllowed) {
                return res.status(403).json({ success: false, message: 'Kitchen Managers can access only their kitchen workspace and profile.' });
            }
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
