import type { Response } from "express";
import { ContractDocumentUseCase } from "../../application/use-cases/contract-document.use-case.js";
import { successResponse } from "../../shared/utils/responseHandler.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";
import { AppError } from "../../shared/utils/AppError.js";

export class ContractDocumentController {
  constructor(private readonly documentUseCase: ContractDocumentUseCase) {}

  uploadContractDocument = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const client_id = req.user.client_id as string;
      const file = req.file;
      if (!file) throw new AppError("No file uploaded", 400);

      // Scaffold a dummy URL for locally saved files
      const file_url = `/uploads/contracts/${Date.now()}_${file.originalname}`;
      
      const payload: any = {
        owner_type: req.body.owner_type,
        owner_id: req.body.owner_id,
        document_scope: req.body.document_scope,
        document_type: req.body.document_type || "CONTRACT_PDF",
        title: req.body.title,
        document_number: req.body.document_number,
        start_date: new Date(req.body.start_date),
        end_date: new Date(req.body.end_date),
        renewal_reminder_days: parseInt(req.body.renewal_reminder_days) || 30,
        is_restricted: req.body.is_restricted === 'true' || req.body.is_restricted === true,
        remarks: req.body.remarks,
        notes: req.body.notes,
        file_url,
        file_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
      };

      const result = await this.documentUseCase.uploadDocument(
        payload,
        client_id,
        req.user.id.toString(),
        req.user.roleId as string
      );
      return successResponse(res, result, "Contract document uploaded and approval requested", 201);
    } catch (error: any) {
      logger.error(`Error uploading contract document: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to upload document" });
    }
  };

  listContractDocuments = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const client_id = req.user.client_id as string;
      const userRole = req.user.roleId as string;
      const userId = req.user.id.toString();

      const filters: any = {
        owner_type: req.query.owner_type as string,
        owner_id: req.query.owner_id as string,
        contract_id: req.query.contract_id as string,
        company_id: req.query.company_id as string,
        tenant_id: req.query.tenant_id as string,
        document_scope: req.query.document_scope as string,
        document_type: req.query.document_type as string,
        status: req.query.status as string,
        is_restricted: req.query.is_restricted !== undefined ? (req.query.is_restricted === "true") : undefined,
        search: req.query.search as string,
      };

      // Clean undefined keys
      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

      const result = await this.documentUseCase.listDocuments(client_id, page, limit, filters, userRole, userId);
      return successResponse(res, result, "Contract documents retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error listing contract documents: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve documents" });
    }
  };

  getContractDocumentById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id as string;
      const userRole = req.user.roleId as string;
      const userId = req.user.id.toString();

      const doc = await this.documentUseCase.getDocumentById(id, client_id, userRole, userId);
      return successResponse(res, doc, "Contract document retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error retrieving contract document ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve document" });
    }
  };

  requestUpdate = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id as string;
      const userRole = req.user.roleId as string;
      const userId = req.user.id.toString();

      const file = req.file;
      const file_url = file ? `/uploads/contracts/${Date.now()}_${file.originalname}` : undefined;

      const payload: any = {
        title: req.body.title,
        document_number: req.body.document_number,
        start_date: req.body.start_date ? new Date(req.body.start_date) : undefined,
        end_date: req.body.end_date ? new Date(req.body.end_date) : undefined,
        renewal_reminder_days: req.body.renewal_reminder_days ? parseInt(req.body.renewal_reminder_days) : undefined,
        remarks: req.body.remarks,
        notes: req.body.notes,
        file_url,
        file_name: file?.originalname,
        mime_type: file?.mimetype,
        file_size: file?.size,
      };

      // Clean undefined keys
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      const result = await this.documentUseCase.requestUpdate(id, payload, client_id, userId, userRole);
      return successResponse(res, result, "Update request processed successfully", 200);
    } catch (error: any) {
      logger.error(`Error requesting update: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to submit update request" });
    }
  };

  requestRenewal = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id as string;
      const userRole = req.user.roleId as string;
      const userId = req.user.id.toString();

      const file = req.file;
      if (!file) throw new AppError("A renewal file upload is required", 400);

      const file_url = `/uploads/contracts/${Date.now()}_${file.originalname}`;

      const payload = {
        document_number: req.body.document_number,
        start_date: new Date(req.body.start_date),
        end_date: new Date(req.body.end_date),
        renewal_reminder_days: parseInt(req.body.renewal_reminder_days) || 30,
        remarks: req.body.remarks,
        notes: req.body.notes,
        file_url,
        file_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
      };

      const result = await this.documentUseCase.requestRenewal(id, payload, client_id, userId, userRole);
      return successResponse(res, result, "Renewal request processed successfully", 200);
    } catch (error: any) {
      logger.error(`Error requesting renewal: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to submit renewal request" });
    }
  };

  requestDelete = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id as string;
      const userRole = req.user.roleId as string;
      const userId = req.user.id.toString();
      const remarks = req.body.remarks as string;

      const result = await this.documentUseCase.requestDelete(id, client_id, userId, userRole, remarks);
      return successResponse(res, result, "Delete request processed successfully", 200);
    } catch (error: any) {
      logger.error(`Error requesting delete: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to submit delete request" });
    }
  };

  handleApproval = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const requestId = req.params.requestId as string;
      const client_id = req.user.client_id as string;
      const adminId = req.user.id.toString();
      const action = req.body.action as "approve" | "reject";
      const remarks = req.body.remarks as string;

      if (!action || (action !== "approve" && action !== "reject")) {
        throw new AppError("action must be 'approve' or 'reject'", 400);
      }

      const result = await this.documentUseCase.handleApproval(requestId, client_id, adminId, action, remarks);
      return successResponse(res, result, `Approval request ${action}d successfully`, 200);
    } catch (error: any) {
      logger.error(`Error handling approval request: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to handle approval request" });
    }
  };

  listPendingApprovals = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const client_id = req.user.client_id as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const requestType = req.query.request_type as string;

      const result = await this.documentUseCase.listPendingApprovals(client_id, page, limit, requestType);
      return successResponse(res, result, "Pending approval requests retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error listing pending approvals: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve pending approvals" });
    }
  };

  updateStaffAccess = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id as string;
      const adminId = req.user.id.toString();
      const { staff_id, can_view, can_edit } = req.body;

      if (!staff_id) throw new AppError("staff_id is required", 400);

      const result = await this.documentUseCase.updateStaffAccess(
        id,
        client_id,
        staff_id,
        can_view === 'true' || can_view === true,
        can_edit === 'true' || can_edit === true,
        adminId
      );
      return successResponse(res, result, "Staff access updated successfully", 200);
    } catch (error: any) {
      logger.error(`Error updating staff access: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to update staff access" });
    }
  };

  getStaffAccessList = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id as string;

      const result = await this.documentUseCase.getStaffAccessList(id, client_id);
      return successResponse(res, result, "Staff access list retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error getting staff access list: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve staff access list" });
    }
  };
}
