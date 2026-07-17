import type { Response } from "express";
import { CompanyUseCase } from "../../application/use-cases/company.use-case.js";
import { successResponse } from "../../shared/utils/responseHandler.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";
import { companyAccountService } from "../../main/container/company-account.container.js";

export class CompanyController {
  constructor(private readonly companyUseCase: CompanyUseCase) {}

  private isCompany(req: AuthenticatedRequest) {
    return (req.user?.roleId || req.user?.role_slug) === "ROLE_COMPANY";
  }

  private allowCompanyId(req: AuthenticatedRequest, res: Response, companyId: string) {
    if (this.isCompany(req) && String(req.user.id) !== String(companyId)) {
      res.status(403).json({ success: false, message: "Company access is limited to the selected Client Admin membership" });
      return false;
    }
    return true;
  }

  // ── GET /companies ────────────────────────────────────────────
  getCompanies = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      if (this.isCompany(req)) {
        const company = await this.companyUseCase.getCompanyById(String(req.user.id));
        return successResponse(res, { items: company ? [company] : [], total: company ? 1 : 0, page: 1, limit: 1, totalPages: company ? 1 : 0 }, "Company retrieved successfully", 200);
      }

      const filters: any = {
        client_id:
          (req.query.client_id as string) ||
          (req.user?.client_id ? req.user.client_id.toString() : undefined),
        search: req.query.search as string,
      };
      if (req.query.status !== undefined) filters.status = req.query.status as string;

      const companies = await this.companyUseCase.getCompanies(page, limit, filters);
      return successResponse(res, companies, "Companies retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching companies: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve companies" });
    }
  };

  // ── GET /companies/:id ────────────────────────────────────────
  getCompanyById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!this.allowCompanyId(req, res, id)) return;
      const company = await this.companyUseCase.getCompanyById(id);
      if (!company) {
        return res.status(404).json({ success: false, message: "Company not found" });
      }
      return successResponse(res, company, "Company retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching company ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve company" });
    }
  };

  // ── POST /companies ───────────────────────────────────────────
  createCompany = async (req: AuthenticatedRequest, res: Response) => {
    logger.info("Creating new company");
    let createdCompanyId: string | null = null;
    try {
      if (this.isCompany(req)) return res.status(403).json({ success: false, message: "Company Admin cannot create Client Admin company records" });
      const client_id =
        req.user?.client_id?.toString() || req.body.client_id;

      if (!client_id) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized. Missing client info." });
      }

      const data = { ...req.body, client_id };
      const membershipId = data.membership_id;
      delete data.membership_id;

      // ── Conditional field validation ──────────────────────────
      // cr_expiry_date required if cr_number is provided
      if (data.cr_number && !data.cr_expiry_date) {
        return res.status(400).json({
          success: false,
          message: "cr_expiry_date is required when cr_number is provided",
        });
      }

      // account_manager required if status is 'Suspended'
      if (data.status === "Suspended" && !data.account_manager?.trim()) {
        return res.status(400).json({
          success: false,
          message: "account_manager is required when status is Suspended",
        });
      }

      // last_review_date required if compliance_required is true
      if (data.compliance_required === true && !data.last_review_date) {
        return res.status(400).json({
          success: false,
          message: "last_review_date is required when compliance_required is true",
        });
      }

      const company = await this.companyUseCase.createCompany(data);
      createdCompanyId = company.id;
      const accountSetup = membershipId
        ? await companyAccountService.completeApprovedMembership(client_id, membershipId, company.id, String(req.user.id))
        : await companyAccountService.provisionNewCompany(company, String(req.user.id));
      return successResponse(res, { company, accountSetup }, "Company created successfully", 201);
    } catch (error: any) {
      if (createdCompanyId) {
        try { await this.companyUseCase.deleteCompany(createdCompanyId); }
        catch (cleanupError: any) { logger.error(`Failed to roll back company ${createdCompanyId}: ${cleanupError.message}`); }
      }
      logger.error(`Error creating company: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to create company" });
    }
  };

  // ── PUT /companies/:id ────────────────────────────────────────
  updateCompany = async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    logger.info(`Updating company: ${id}`);
    try {
      if (this.isCompany(req)) return res.status(403).json({ success: false, message: "Use the Company profile to update account information" });
      const data = { ...req.body };

      // ── Conditional field validation ──────────────────────────
      if (data.cr_number && !data.cr_expiry_date) {
        return res.status(400).json({
          success: false,
          message: "cr_expiry_date is required when cr_number is provided",
        });
      }

      if (data.status === "Suspended" && !data.account_manager?.trim()) {
        return res.status(400).json({
          success: false,
          message: "account_manager is required when status is Suspended",
        });
      }

      if (data.compliance_required === true && !data.last_review_date) {
        return res.status(400).json({
          success: false,
          message: "last_review_date is required when compliance_required is true",
        });
      }

      const company = await this.companyUseCase.updateCompany(id, data);
      return successResponse(res, company, "Company updated successfully", 200);
    } catch (error: any) {
      logger.error(`Error updating company ${id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to update company" });
    }
  };

  // ── DELETE /companies/:id ─────────────────────────────────────
  deleteCompany = async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id as string;
    logger.info(`Soft-deleting company: ${id}`);
    try {
      if (this.isCompany(req)) return res.status(403).json({ success: false, message: "Company Admin cannot delete Client Admin company records" });
      await this.companyUseCase.deleteCompany(id);
      return successResponse(res, null, "Company deleted successfully", 200);
    } catch (error: any) {
      logger.error(`Error deleting company ${id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to delete company" });
    }
  };

  // ── POST /companies/:id/assign ────────────────────────────────
  assignEntities = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (this.isCompany(req)) return res.status(403).json({ success: false, message: "Company Admin cannot modify Client Admin assignments" });
      const id = req.params.id as string;
      const { tenant_ids = [], room_ids = [], contract_id } = req.body;
      await this.companyUseCase.assignEntities(id, tenant_ids, room_ids, contract_id);
      return successResponse(res, null, "Entities assigned to company successfully", 200);
    } catch (error: any) {
      logger.error(`Error assigning entities: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to assign entities" });
    }
  };

  // ── POST /companies/:id/unassign ──────────────────────────────
  unassignEntities = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (this.isCompany(req)) return res.status(403).json({ success: false, message: "Company Admin cannot modify Client Admin assignments" });
      const id = req.params.id as string;
      const { tenant_ids = [], room_ids = [], contract_id } = req.body;
      await this.companyUseCase.unassignEntities(id, tenant_ids, room_ids, contract_id);
      return successResponse(res, null, "Entities unassigned from company successfully", 200);
    } catch (error: any) {
      logger.error(`Error unassigning entities: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to unassign entities" });
    }
  };

  // ── GET /companies/:id/summary ────────────────────────────────
  getCompanySummary = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!this.allowCompanyId(req, res, id)) return;
      const client_id = req.user.client_id.toString();
      logger.info(`Fetching company summary: ${id}`);
      const summary = await this.companyUseCase.getCompanySummary(id, client_id);
      return successResponse(res, summary, "Company summary retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching company summary ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve company summary" });
    }
  };

  // ── GET /companies/:id/contracts ──────────────────────────────
  getCompanyContracts = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!this.allowCompanyId(req, res, id)) return;
      const client_id = req.user.client_id.toString();
      logger.info(`Fetching company contracts: ${id}`);
      const contracts = await this.companyUseCase.getCompanyContracts(id, client_id);
      return successResponse(res, contracts, "Company contracts retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching company contracts ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve company contracts" });
    }
  };

  // ── GET /companies/:id/tenant-stats ───────────────────────────
  getCompanyTenantStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!this.allowCompanyId(req, res, id)) return;
      const client_id = req.user.client_id.toString();
      logger.info(`Fetching company tenant stats: ${id}`);
      const stats = await this.companyUseCase.getCompanyTenantStats(id, client_id);
      return successResponse(res, stats, "Company tenant stats retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching company tenant stats ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve company tenant stats" });
    }
  };

  // ── GET /companies/:id/assigned-rooms ────────────────────────
  getCompanyAssignedRooms = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      if (!this.allowCompanyId(req, res, id)) return;
      const client_id = req.user.client_id.toString();
      const filters = {
        contract_id: req.query.contract_id as string | undefined,
      };
      logger.info(`Fetching company assigned rooms: ${id}`);
      const rooms = await this.companyUseCase.getCompanyAssignedRooms(id, client_id, filters);
      return successResponse(res, rooms, "Company assigned rooms retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching company assigned rooms ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve company assigned rooms" });
    }
  };
}
