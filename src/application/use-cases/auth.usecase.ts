import type { AuthRepository, AuthService, PasswordService, TokenService } from "../../domain/repositories/auth.repository.interface.js";
import type { UserAssignedRoleRepository } from "../../domain/repositories/user-assigned-role.repository.interface.js";
import type { IPermissionRepository } from "../../domain/repositories/permission.repository.interface.js";
import type { SignInRequest } from "../../domain/types/auth.types.js";
import { AppError } from "../../shared/utils/AppError.js";
import type { ZoneAssignCoordinatorRepository } from "../../domain/repositories/zone-assign-coordinator.repository.interface.js";
import type { CampAssignCoordinatorRepository } from "../../domain/repositories/camp-assign-coordinator.repository.interface.js";
import GlobalCompanyAccount from "../../infrastructure/persistence/models/global-company-account.model.js";
import CompanyClientMembership from "../../infrastructure/persistence/models/company-client-membership.model.js";
import Client from "../../infrastructure/persistence/models/user.model.js";
import { selectCompanyMembership } from "../rules/company-account.rules.js";

export class AuthUseCase implements AuthService {
  constructor(
    private authRepository: AuthRepository,
    private passwordService: PasswordService,
    private tokenService: TokenService,
    private userAssignedRoleRepository: UserAssignedRoleRepository,
    private permissionRepository: IPermissionRepository,
    private zoneAssignCoordinatorRepository: ZoneAssignCoordinatorRepository,
    private campAssignCoordinatorRepository: CampAssignCoordinatorRepository
  ) { }

  async signIn(data: SignInRequest): Promise<any> {
    try {
      if (data.role_slug === "ROLE_COMPANY") return this.signInCompany(data as any);
      const user = await this.authRepository.findByEmailAndRoleSlug(data.email, data.role_slug);
      if (!user) {
        throw new AppError("User not found", 404);
      }
      const isPasswordValid = await this.passwordService.compare(data.password, user.password);
      if (!isPasswordValid) {
        throw new AppError("Invalid password", 404);
      }
      if (user.status === 0) {
        throw new AppError("Your account has been blocked. Please contact the administrator.", 403);
      }

      // Fetch all permissions assigned to this role using the user's role_id
      const rolePermissions = await this.permissionRepository.getPermissionsByRole(user.role_id.toString());
      const permissions = rolePermissions.map(rp => rp.permission_slug);

      let assigned_camps: any[] = [];
      let assigned_zones: any[] = [];

      if (data.role_slug === 'ROLE_COORDINATOR' || data.role_slug === 'ROLE_ZONE_COORDINATOR') {
        const coordinatorId = (user._id || user.id).toString();
        const zones = await this.zoneAssignCoordinatorRepository.getAssignedZones(coordinatorId);
        const camps = await this.campAssignCoordinatorRepository.getAssignedCamps(coordinatorId);

        assigned_zones = zones.map(z => ({ zone_id: z.zone_id._id.toString() }));
        assigned_camps = camps.map(c => ({ camp_id: c.camp_id._id.toString() }));
      }

      const token = await this.tokenService.sign({
        id: user._id || user.id,
        client_id: user.client_id || user._id,
        email: user.email,
        roleId: data.role_slug,
        camp_id: user.camp_id ? user.camp_id.toString() : undefined,
        zone_id: user.zone_id ? user.zone_id.toString() : undefined,
        assigned_camps,
        assigned_zones
      });

      return {
        token,
        user: {
          id: user._id || user.id,
          email: user.email,
          role: data.role_slug,
          permissions: permissions
        }
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`${error.message}`, 500);
    }
  }

  private async signInCompany(data: { email: string; password: string; role_slug: string; preferred_membership_id?: string }) {
    const account: any = await GlobalCompanyAccount.findOne({ login_email: data.email.trim().toLowerCase(), deleted_at: null }).select("+password").lean();
    if (!account || !account.password || !(await this.passwordService.compare(data.password, account.password))) throw new AppError("Invalid email or password", 401);
    if (account.status !== "Active") throw new AppError(account.status === "PendingSetup" ? "Complete Company Account setup before signing in" : "Company Account is suspended", 403);
    const memberships: any[] = await CompanyClientMembership.find({ global_company_account_id: account._id, status: "Active", company_id: { $ne: null }, deleted_at: null }).sort({ createdAt: 1 }).lean();
    if (!memberships.length) throw new AppError("No active Client Admin membership is available", 403);
    const selected = selectCompanyMembership(memberships, data.preferred_membership_id);
    const [role] = await this.authRepository.getRolesBySlugs(["ROLE_COMPANY"]);
    const permissions = role ? (await this.permissionRepository.getPermissionsByRole(role._id.toString())).map(item => item.permission_slug) : [];
    const client: any = await Client.findById(selected.client_id).select("business_name").lean();
    const token = await this.tokenService.sign({ id: selected.company_id.toString(), company_account_id: account._id.toString(), company_membership_id: selected._id.toString(), client_id: selected.client_id.toString(), email: account.login_email, roleId: "ROLE_COMPANY" });
    return { token, user: { id: selected.company_id.toString(), companyAccountId: account._id.toString(), email: account.login_email, name: account.company_name, role: "ROLE_COMPANY", permissions, selectedClient: { membershipId: selected._id.toString(), clientId: selected.client_id.toString(), name: client?.business_name || "Client Admin" } } };
  }


  async getRolesByEmail(email: string): Promise<any> {
    try {
      const roles = await this.authRepository.getUserRoles(email);

      if (!roles || roles.length === 0) {
        throw new AppError("user not exist", 404);
      }
      return {
        email: email,
        roles: roles
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`${error.message}`, 500);
    }
  }

  async getUserPermissions(roleSlug: string, client_id?: string): Promise<string[]> {
    const rolePermissions = await this.permissionRepository.getPermissionsByRole(roleSlug, client_id);
    return rolePermissions
      .map(rp => rp.permission_slug)
      .filter((slug): slug is string => !!slug);
  }

  async signOut(): Promise<void> {
    // Implementation for sign out if needed in use case
    return Promise.resolve();
  }
}
