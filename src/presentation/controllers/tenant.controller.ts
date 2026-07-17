import type { Response, Request } from "express";
import type { TenantService } from "../../domain/repositories/tenant.repository.interface.js";
import { logger } from "../../shared/logger/logger.js";
import { successResponse } from "../../shared/utils/responseHandler.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";

export class TenantController {
    constructor(private tenantUseCase: TenantService) { }

    register = async (req: AuthenticatedRequest, res: Response) => {
        logger.info(`Attempting to register tenant with email: ${req.body.email}`);

        // Ensure client_id is set from authenticated user
        req.body.client_id = req.user.client_id;

        const result = await this.tenantUseCase.registerTenant(req.body);
        return successResponse(res, result, "Tenant registered successfully", 201);
    }

    getAll = async (req: AuthenticatedRequest, res: Response) => {
        const client_id = req.user?.client_id;
        if (!client_id) {
            return res.status(401).json({ success: false, message: "Unauthorized. Missing client info." });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;
        const isCompany = (req.user.roleId || req.user.role_slug) === "ROLE_COMPANY";
        const filters: any = {
            name: req.query.name as string | undefined,
            email: req.query.email as string | undefined,
            type: req.query.type as string | undefined,
            allocation_status: req.query.allocation_status !== undefined
                ? req.query.allocation_status === "true"
                : undefined,
            // New filter params
            search: req.query.search as string | undefined,
            site: req.query.site as string | undefined,
            zone: req.query.zone as string | undefined,
            building: req.query.building as string | undefined,
            room: req.query.room as string | undefined,
            company_id: isCompany ? String(req.user.id) : req.query.company_id as string | undefined,
            contract_id: req.query.contract_id as string | undefined,
            status: req.query.status !== undefined ? Number(req.query.status) : undefined,
            role: req.user?.roleId,
            assigned_camps: req.user?.assigned_camps?.map((c: any) => c.camp_id),
            assigned_zones: req.user?.assigned_zones?.map((z: any) => z.zone_id),
            country_state: req.query.country_state as string | undefined,
        };

        // Strip undefined and empty string values so they don't pollute the query


        const result = await this.tenantUseCase.getAllTenants(page, limit, filters, client_id);

        return successResponse(res, result, "Tenants retrieved successfully", 200);
    };

    edit = async (req: AuthenticatedRequest, res: Response) => {
        const tenantId = req.params.id as string;
        logger.info(`Attempting to edit tenant with id: ${tenantId}`);
        const payload = req.body.data || req.body;
        const performer = req.user?.name || req.user?.email || 'System';
        const result = await this.tenantUseCase.editTenant(tenantId, payload, performer);
        return successResponse(res, result, "Tenant updated successfully", 200);
    }

    getById = async (req: AuthenticatedRequest, res: Response) => {
        const tenantId = req.params.id as string;
        logger.info(`Fetching tenant details for id: ${tenantId}`);
        const result = await this.tenantUseCase.getTenantById(tenantId);
        return successResponse(res, result, "Tenant details retrieved successfully", 200);
    }

    getBasicById = async (req: AuthenticatedRequest, res: Response) => {
        const tenantId = req.params.id as string;
        logger.info(`Fetching basic tenant details for id: ${tenantId}`);
        const result = await this.tenantUseCase.getBasicTenantById(tenantId);
        return successResponse(res, result, "Basic tenant details retrieved successfully", 200);
    }

    delete = async (req: AuthenticatedRequest, res: Response) => {
        const tenantId = req.params.id as string;
        logger.info(`Attempting to delete tenant with id: ${tenantId}`);
        await this.tenantUseCase.deleteTenant(tenantId);
        return successResponse(res, null, "Tenant deleted successfully", 200);
    }

    downloadDocumentFile = async (req: AuthenticatedRequest, res: Response) => {
        const { documentFileId } = req.params;
        const performer = req.user?.name || req.user?.email || 'System';
        
        logger.info(`Attempting to download document file with id: ${documentFileId}`);

        const DocumentFileModel = (await import("../../infrastructure/persistence/models/document-file.model.js")).default;
        const DocumentModel = (await import("../../infrastructure/persistence/models/document.model.js")).default;
        const UserActivityLogModel = (await import("../../infrastructure/persistence/models/user-activity-log.model.js")).default;

        const fileRecord = await DocumentFileModel.findById(documentFileId);
        if (!fileRecord) {
            return res.status(404).json({ success: false, message: "Document file not found" });
        }

        const docRecord = await DocumentModel.findById(fileRecord.document_id);
        
        await UserActivityLogModel.create({
            performed_by: performer,
            tenant_id: docRecord ? docRecord.tenant_id : null,
            document_id: fileRecord.document_id,
            action: `Document downloaded: ${fileRecord.original_file_name}`,
            module: 'Compliance',
            timestamp: new Date()
        });

        return res.redirect(302, fileRecord.storage_path);
    }
}
