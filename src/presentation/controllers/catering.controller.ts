import type { Response } from "express";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import type { CateringUseCase } from "../../application/use-cases/catering.usecase.js";
import { successResponse } from "../../shared/utils/responseHandler.js";
import { AppError } from "../../shared/utils/AppError.js";

export class CateringController {
  constructor(private service: CateringUseCase) {}

  private scope(req: AuthenticatedRequest, allowKitchenManager = false) {
    const user = req.user || {};
    const role = user.roleId || user.role_slug;
    const allowed = allowKitchenManager ? ["ROLE_CLIENT_ADMIN", "ROLE_COMPANY", "ROLE_KITCHEN_MANAGER"] : ["ROLE_CLIENT_ADMIN", "ROLE_COMPANY"];
    if (!allowed.includes(role)) throw new AppError("Catering access is not allowed for this role", 403);
    return {
      clientId: String(user.client_id || user.id),
      ...(role === "ROLE_COMPANY" ? { companyId: String(user.id) } : {}),
      ...(role === "ROLE_KITCHEN_MANAGER" ? { kitchenIds: (user.kitchen_ids || []).map((id: any) => String(id)) } : {}),
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
  listKitchenManagers = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.listKitchenManagers(this.scope(req)), "Kitchen Managers loaded");
  createKitchenManager = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.createKitchenManager(this.scope(req), req.body), "Kitchen Manager created", 201);
  updateKitchenManager = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.updateKitchenManager(this.scope(req), String(req.params.id), req.body), "Kitchen Manager updated");
  resetKitchenManagerPassword = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.resetKitchenManagerPassword(this.scope(req), String(req.params.id), req.body.password), "Kitchen Manager password reset");
  removeKitchenManager = async (req: AuthenticatedRequest, res: Response) => { await this.service.removeKitchenManager(this.scope(req), String(req.params.id)); return successResponse(res, null, "Kitchen Manager removed"); };
  kitchenManagerContext = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.kitchenManagerContext(this.scope(req, true)), "Kitchen Manager context loaded");
  kitchenBootstrap = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.kitchenBootstrap(this.scope(req, true), String(req.params.kitchenId)), "Kitchen workspace loaded");
  kitchenDashboard = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.kitchenDashboard(this.scope(req, true), String(req.params.kitchenId)), "Kitchen dashboard loaded");
  kitchenPreparationSheet = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.kitchenPreparationSheet(this.scope(req, true), String(req.params.kitchenId), req.query.date ? String(req.query.date) : undefined), "Preparation sheet loaded");
  kitchenReport = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.kitchenReport(this.scope(req, true), String(req.params.kitchenId), String(req.params.type), req.query.from ? String(req.query.from) : undefined, req.query.to ? String(req.query.to) : undefined), "Kitchen report loaded");
  kitchenOrderAction = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.kitchenOrderAction(this.scope(req, true), String(req.params.id), req.body), "Kitchen order updated");
  createKitchenDispatch = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.createKitchenDispatch(this.scope(req, true), req.body), "Kitchen dispatch created", 201);
  updateKitchenDispatch = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.updateKitchenDispatch(this.scope(req, true), String(req.params.id), req.body), "Kitchen dispatch updated");
  kitchenDispatchAction = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.kitchenDispatchAction(this.scope(req, true), String(req.params.id), req.body), "Kitchen dispatch updated");
}
