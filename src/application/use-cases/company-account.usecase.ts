import crypto from "node:crypto";
import mongoose from "mongoose";
import GlobalCompanyAccount from "../../infrastructure/persistence/models/global-company-account.model.js";
import CompanyClientMembership, { type CompanyMembershipStatus } from "../../infrastructure/persistence/models/company-client-membership.model.js";
import CompanyAccountToken from "../../infrastructure/persistence/models/company-account-token.model.js";
import Company from "../../infrastructure/persistence/models/company.model.js";
import Client from "../../infrastructure/persistence/models/user.model.js";
import { AppError } from "../../shared/utils/AppError.js";
import type { PasswordService, TokenService } from "../../domain/repositories/auth.repository.interface.js";
import type { CompanyMailService } from "../../infrastructure/messaging/company-mail.service.js";
import { env } from "../../config/env.config.js";
import { managedMembershipTransition, normalizeCompanyEmail, normalizeCompanyName } from "../rules/company-account.rules.js";

const oid = (value: string) => new mongoose.Types.ObjectId(value);

export class CompanyAccountUseCase {
  constructor(private passwordService: PasswordService, private tokenService: TokenService, private mail: CompanyMailService) {}

  async search(query: string) {
    const value = query.trim();
    if (value.length < 2) return [];
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rows = await GlobalCompanyAccount.find({ deleted_at: null, $or: [{ company_name: { $regex: escaped, $options: "i" } }, { login_email: { $regex: escaped, $options: "i" } }] }).select("company_name login_email logo status").limit(20).lean();
    return rows.map((row: any) => ({ id: row._id.toString(), companyName: row.company_name, loginEmail: row.login_email, logo: row.logo, status: row.status }));
  }

  async requestMembership(accountId: string, clientId: string, actorId: string) {
    const [account, client] = await Promise.all([
      GlobalCompanyAccount.findOne({ _id: accountId, deleted_at: null }).lean(),
      Client.findOne({ _id: clientId, deleted_at: null }).select("business_name").lean(),
    ]);
    if (!account || !client) throw new AppError("Company account or Client Admin was not found", 404);
    const existing = await CompanyClientMembership.findOne({ global_company_account_id: accountId, client_id: clientId, deleted_at: null });
    if (existing && !["Rejected", "Revoked"].includes(existing.status)) throw new AppError("A membership already exists or is pending", 409);
    const history = {
      ...(existing?.status ? { from: existing.status } : {}),
      to: "PendingCompanyApproval",
      actor_id: oid(actorId),
      actor_role: "ROLE_CLIENT_ADMIN",
      at: new Date(),
    };
    const membership = existing
      ? await CompanyClientMembership.findByIdAndUpdate(existing._id, { $set: { status: "PendingCompanyApproval", requested_by: actorId, requested_at: new Date(), responded_at: null, rejection_reason: "" }, $push: { history } }, { new: true })
      : await CompanyClientMembership.create({ global_company_account_id: accountId, client_id: clientId, status: "PendingCompanyApproval", requested_by: actorId, history: [history] });
    const delivery = await this.mail.sendMembershipRequest(account.login_email, account.company_name, (client as any).business_name);
    return { id: membership!._id.toString(), status: membership!.status, delivery };
  }

  async listMemberships(accountId: string) {
    const rows = await CompanyClientMembership.find({ global_company_account_id: accountId, deleted_at: null }).sort({ createdAt: 1 }).lean();
    const clientIds = rows.map((row: any) => row.client_id);
    const companyIds = rows.map((row: any) => row.company_id).filter(Boolean);
    const [clients, companies] = await Promise.all([
      Client.find({ _id: { $in: clientIds } }).select("business_name full_name city status").lean(),
      Company.find({ _id: { $in: companyIds } }).select("company_name company_code status").lean(),
    ]);
    const clientMap = new Map(clients.map((row: any) => [row._id.toString(), row]));
    const companyMap = new Map(companies.map((row: any) => [row._id.toString(), row]));
    return rows.map((row: any) => {
      const client: any = clientMap.get(row.client_id.toString());
      const company: any = row.company_id ? companyMap.get(row.company_id.toString()) : null;
      return { id: row._id.toString(), clientId: row.client_id.toString(), companyId: row.company_id?.toString() || null, status: row.status, requestedAt: row.requested_at, respondedAt: row.responded_at, client: { name: client?.business_name || client?.full_name || "Client Admin", city: client?.city || "" }, company: company ? { name: company.company_name, code: company.company_code, status: company.status } : null };
    });
  }

  async listClientMemberships(clientId: string) {
    const rows: any[] = await CompanyClientMembership.find({ client_id: clientId, deleted_at: null }).populate("global_company_account_id", "company_name login_email logo status").sort({ createdAt: -1 }).lean();
    return rows.map((row: any) => ({ id: row._id.toString(), clientId: row.client_id.toString(), companyId: row.company_id?.toString() || null, status: row.status, requestedAt: row.requested_at, account: { id: row.global_company_account_id?._id?.toString(), companyName: row.global_company_account_id?.company_name, loginEmail: row.global_company_account_id?.login_email, logo: row.global_company_account_id?.logo } }));
  }

  async respond(accountId: string, membershipId: string, action: "accept" | "reject", actorId: string, reason = "") {
    const membership = await CompanyClientMembership.findOne({ _id: membershipId, global_company_account_id: accountId, status: "PendingCompanyApproval", deleted_at: null });
    if (!membership) throw new AppError("Pending membership request not found", 404);
    const next: CompanyMembershipStatus = action === "accept" ? "ApprovedAwaitingClientSetup" : "Rejected";
    membership.status = next; membership.responded_at = new Date(); membership.rejection_reason = action === "reject" ? reason : "";
    membership.history.push({ from: "PendingCompanyApproval", to: next, actor_id: oid(actorId), actor_role: "ROLE_COMPANY", remarks: reason, at: new Date() });
    await membership.save();
    return { id: membership.id, status: membership.status };
  }

  async cancel(clientId: string, membershipId: string, actorId: string) {
    const membership = await CompanyClientMembership.findOne({ _id: membershipId, client_id: clientId, status: { $in: ["PendingCompanyApproval", "ApprovedAwaitingClientSetup"] }, deleted_at: null });
    if (!membership) throw new AppError("Cancelable membership request not found", 404);
    const from = membership.status; membership.status = "Revoked";
    membership.history.push({ from, to: "Revoked", actor_id: oid(actorId), actor_role: "ROLE_CLIENT_ADMIN", at: new Date() });
    await membership.save();
    return { id: membership.id, status: membership.status };
  }

  async manageMembership(clientId: string, membershipId: string, action: "suspend" | "resume" | "revoke", actorId: string, reason = "") {
    const membership = await CompanyClientMembership.findOne({ _id: membershipId, client_id: clientId, deleted_at: null });
    if (!membership) throw new AppError("Company membership was not found", 404);
    const next = managedMembershipTransition(membership.status, action);
    if (!next) throw new AppError(`Membership cannot be ${action}ed from ${membership.status}`, 409);
    const from = membership.status;
    membership.status = next;
    membership.history.push({ from, to: next, actor_id: oid(actorId), actor_role: "ROLE_CLIENT_ADMIN", remarks: reason, at: new Date() });
    await membership.save();
    return { id: membership.id, status: membership.status };
  }

  async resend(clientId: string, membershipId: string) {
    const membership: any = await CompanyClientMembership.findOne({ _id: membershipId, client_id: clientId, deleted_at: null });
    if (!membership) throw new AppError("Company membership was not found", 404);
    const account: any = await GlobalCompanyAccount.findOne({ _id: membership.global_company_account_id, deleted_at: null }).lean();
    if (!account) throw new AppError("Global company account was not found", 404);
    if (membership.status === "PendingAccountSetup") return this.issueSetupToken(account, membership);
    if (membership.status === "PendingCompanyApproval") {
      const client: any = await Client.findById(clientId).select("business_name full_name").lean();
      const delivery = await this.mail.sendMembershipRequest(account.login_email, account.company_name, client?.business_name || client?.full_name || "Client Admin");
      return { membershipId: membership.id, delivery };
    }
    throw new AppError("This membership has no pending email to resend", 409);
  }

  async provisionNewCompany(company: any, actorId: string) {
    const loginEmail = normalizeCompanyEmail(company.email || company.primary_contact_email);
    if (!loginEmail) throw new AppError("Company Portal login email is required", 422);
    const existing = await GlobalCompanyAccount.findOne({ login_email: loginEmail, deleted_at: null });
    if (existing) throw new AppError("A global company already uses this email; send a membership request instead", 409);
    const session = await mongoose.startSession();
    let account: any; let membership: any;
    try {
      await session.withTransaction(async () => {
        [account] = await GlobalCompanyAccount.create([{ company_name: company.company_name, normalized_name: normalizeCompanyName(company.company_name), login_email: loginEmail, status: "PendingSetup" }], { session });
        await Company.updateOne({ _id: company.id || company._id }, { $set: { global_company_account_id: account._id, email: loginEmail } }, { session });
        [membership] = await CompanyClientMembership.create([{ global_company_account_id: account._id, client_id: company.client_id, company_id: company.id || company._id, status: "PendingAccountSetup", requested_by: actorId, history: [{ to: "PendingAccountSetup", actor_id: actorId, actor_role: "ROLE_CLIENT_ADMIN", at: new Date() }] }], { session });
      });
    } catch (error: any) {
      if (error?.code === 11000) throw new AppError("A global company account or Client Admin membership already exists", 409);
      throw error;
    } finally {
      await session.endSession();
    }
    return this.issueSetupToken(account, membership);
  }

  async completeApprovedMembership(clientId: string, membershipId: string, companyId: string, actorId: string) {
    const session = await mongoose.startSession();
    let membership: any;
    try {
      await session.withTransaction(async () => {
        membership = await CompanyClientMembership.findOneAndUpdate(
          { _id: membershipId, client_id: clientId, status: "ApprovedAwaitingClientSetup", deleted_at: null },
          {
            $set: { company_id: oid(companyId), status: "Active", activated_at: new Date() },
            $push: { history: { from: "ApprovedAwaitingClientSetup", to: "Active", actor_id: oid(actorId), actor_role: "ROLE_CLIENT_ADMIN", at: new Date() } },
          },
          { new: true, session }
        );
        if (!membership) throw new AppError("Approved membership setup was not found", 404);
        const linked = await Company.updateOne({ _id: companyId, client_id: clientId, deleted_at: null }, { $set: { global_company_account_id: membership.global_company_account_id } }, { session });
        if (!linked.modifiedCount && !linked.matchedCount) throw new AppError("Client-specific company record was not found", 404);
      });
    } finally {
      await session.endSession();
    }
    return membership;
  }

  private async issueSetupToken(account: any, membership: any) {
    await CompanyAccountToken.deleteMany({ global_company_account_id: account._id, purpose: "AccountSetup", consumed_at: null });
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await CompanyAccountToken.create({ global_company_account_id: account._id, membership_id: membership._id, token_hash: tokenHash, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
    const setupUrl = `${env.frontendUrl}/company/setup?token=${encodeURIComponent(token)}`;
    const delivery = await this.mail.sendSetup(account.login_email, account.company_name, setupUrl);
    return { accountId: account._id.toString(), membershipId: membership._id.toString(), setupUrl, delivery };
  }

  async validateSetupToken(token: string) {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const row = await CompanyAccountToken.findOne({ token_hash: tokenHash, consumed_at: null, expires_at: { $gt: new Date() } }).populate("global_company_account_id", "company_name login_email").lean();
    if (!row) throw new AppError("Setup link is invalid or expired", 410);
    return { company: row.global_company_account_id, expiresAt: row.expires_at };
  }

  async completeSetup(token: string, password: string) {
    if (password.length < 8) throw new AppError("Password must contain at least 8 characters", 422);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const row = await CompanyAccountToken.findOne({ token_hash: tokenHash, consumed_at: null, expires_at: { $gt: new Date() } });
    if (!row) throw new AppError("Setup link is invalid or expired", 410);
    const hash = await this.passwordService.hash(password);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const consumed = await CompanyAccountToken.findOneAndUpdate(
          { _id: row._id, consumed_at: null, expires_at: { $gt: new Date() } },
          { $set: { consumed_at: new Date() } },
          { new: true, session }
        );
        if (!consumed) throw new AppError("Setup link has already been used or expired", 410);
        await GlobalCompanyAccount.updateOne({ _id: row.global_company_account_id }, { $set: { password: hash, status: "Active", setup_completed_at: new Date() } }, { session });
        await CompanyClientMembership.updateMany({ global_company_account_id: row.global_company_account_id, status: "PendingAccountSetup", deleted_at: null }, { $set: { status: "Active", activated_at: new Date() }, $push: { history: { from: "PendingAccountSetup", to: "Active", actor_id: row.global_company_account_id, actor_role: "ROLE_COMPANY", at: new Date() } } }, { session });
      });
    } finally {
      await session.endSession();
    }
    return { success: true };
  }

  async switchContext(accountId: string, membershipId: string, email: string) {
    const membership = await CompanyClientMembership.findOne({ _id: membershipId, global_company_account_id: accountId, status: "Active", company_id: { $ne: null }, deleted_at: null }).lean();
    if (!membership) throw new AppError("Active Client Admin membership not found", 403);
    const token = await this.tokenService.sign({ id: membership.company_id!.toString(), company_account_id: accountId, company_membership_id: membership._id.toString(), client_id: membership.client_id.toString(), email, roleId: "ROLE_COMPANY" });
    return { token, selected: { membershipId: membership._id.toString(), companyId: membership.company_id!.toString(), clientId: membership.client_id.toString() } };
  }
}
