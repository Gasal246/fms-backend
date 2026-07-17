import type { Response } from "express";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import type { CateringUseCase } from "../../application/use-cases/catering.usecase.js";
import { successResponse } from "../../shared/utils/responseHandler.js";
import { AppError } from "../../shared/utils/AppError.js";

export class CateringController {
  constructor(private service: CateringUseCase) {}

  private scope(req: AuthenticatedRequest) {
    const user = req.user || {};
    const role = user.roleId || user.role_slug;
    if (!["ROLE_CLIENT_ADMIN", "ROLE_COMPANY"].includes(role)) throw new AppError("Catering access is not allowed for this role", 403);
    return {
      clientId: String(user.client_id || user.id),
      ...(role === "ROLE_COMPANY" ? { companyId: String(user.id) } : {}),
      userId: String(user.id), role,
    };
  }

  bootstrap = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.bootstrap(this.scope(req)), "Catering data loaded");
  dashboard = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.dashboard(this.scope(req)), "Catering dashboard loaded");
  report = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.report(this.scope(req), String(req.params.type)), "Catering report loaded");
  generateDemand = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.generateDemand(this.scope(req), req.body.serviceDate), "Demand generated");
  list = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.list(String(req.params.entity), this.scope(req), req.query), "Records loaded");
  create = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.save(String(req.params.entity), this.scope(req), req.body), "Record created", 201);
  update = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.save(String(req.params.entity), this.scope(req), req.body, String(req.params.id), req.body.version), "Record updated");
  remove = async (req: AuthenticatedRequest, res: Response) => { await this.service.remove(String(req.params.entity), this.scope(req), String(req.params.id)); return successResponse(res, null, "Record deleted"); };
  transition = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.transition(String(req.params.entity), this.scope(req), String(req.params.id), req.body.expectedStatus, req.body.version, req.body.remarks), "Workflow advanced");
  assignStaff = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.assignStaff(this.scope(req), req.body.workSiteId, req.body.staffIds, req.body.assignedAt), "Staff assigned");
  allocateCompanyStaff = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.allocateCompanyStaff(this.scope(req), req.body), "Catering allocations saved");
}
