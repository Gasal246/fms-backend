import type { Response } from "express";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import type { CompanyAccountUseCase } from "../../application/use-cases/company-account.usecase.js";
import { successResponse } from "../../shared/utils/responseHandler.js";
import { AppError } from "../../shared/utils/AppError.js";

export class CompanyAccountController {
  constructor(private service: CompanyAccountUseCase) {}
  private role(req: AuthenticatedRequest, allowed: string[]) { const role = req.user?.roleId; if (!allowed.includes(role)) throw new AppError("Action is not allowed for this role", 403); }

  search = async (req: AuthenticatedRequest, res: Response) => { this.role(req, ["ROLE_CLIENT_ADMIN"]); return successResponse(res, await this.service.search(String(req.query.q || "")), "Company accounts loaded"); };
  request = async (req: AuthenticatedRequest, res: Response) => { this.role(req, ["ROLE_CLIENT_ADMIN"]); return successResponse(res, await this.service.requestMembership(req.body.accountId, String(req.user.client_id || req.user.id), String(req.user.id)), "Membership request sent", 201); };
  memberships = async (req: AuthenticatedRequest, res: Response) => {
    this.role(req, ["ROLE_COMPANY", "ROLE_CLIENT_ADMIN"]);
    const data = req.user.roleId === "ROLE_COMPANY"
      ? (await this.service.listMemberships(String(req.user.company_account_id))).map(item => ({ ...item, selected: item.id === String(req.user.company_membership_id) }))
      : await this.service.listClientMemberships(String(req.user.client_id || req.user.id));
    return successResponse(res, data, "Memberships loaded");
  };
  respond = async (req: AuthenticatedRequest, res: Response) => { this.role(req, ["ROLE_COMPANY"]); return successResponse(res, await this.service.respond(String(req.user.company_account_id), String(req.params.id), req.body.action, String(req.user.company_account_id), req.body.reason), "Membership request updated"); };
  cancel = async (req: AuthenticatedRequest, res: Response) => { this.role(req, ["ROLE_CLIENT_ADMIN"]); return successResponse(res, await this.service.cancel(String(req.user.client_id || req.user.id), String(req.params.id), String(req.user.id)), "Membership request canceled"); };
  manage = async (req: AuthenticatedRequest, res: Response) => { this.role(req, ["ROLE_CLIENT_ADMIN"]); return successResponse(res, await this.service.manageMembership(String(req.user.client_id || req.user.id), String(req.params.id), req.body.action, String(req.user.id), req.body.reason), "Membership updated"); };
  resend = async (req: AuthenticatedRequest, res: Response) => { this.role(req, ["ROLE_CLIENT_ADMIN"]); return successResponse(res, await this.service.resend(String(req.user.client_id || req.user.id), String(req.params.id)), "Membership email processed"); };
  switchContext = async (req: AuthenticatedRequest, res: Response) => { this.role(req, ["ROLE_COMPANY"]); const result = await this.service.switchContext(String(req.user.company_account_id), req.body.membershipId, req.user.email); res.cookie("token", result.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" }); return successResponse(res, result.selected, "Client Admin context switched"); };
  validateSetup = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.validateSetupToken(String(req.query.token || "")), "Setup token valid");
  completeSetup = async (req: AuthenticatedRequest, res: Response) => successResponse(res, await this.service.completeSetup(req.body.token, req.body.password), "Company account setup completed");
}
