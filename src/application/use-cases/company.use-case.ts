import mongoose from "mongoose";
import type { CompanyRepository } from "../../domain/repositories/company.repository.interface.js";
import type {
  CompanyFilter,
  CompanyRequest,
  CompanyResponse,
  PaginatedCompanyResponse,
} from "../../domain/types/company.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export class CompanyUseCase {
  constructor(private readonly companyRepository: CompanyRepository) {}

  // ── Read ─────────────────────────────────────────────────────
  async getCompanies(
    page: number,
    limit: number,
    filters: CompanyFilter
  ): Promise<PaginatedCompanyResponse> {
    return this.companyRepository.findAll(page, limit, filters);
  }

  async getCompanyById(id: string): Promise<CompanyResponse | null> {
    return this.companyRepository.findById(id);
  }

  // ── Create ───────────────────────────────────────────────────
  async createCompany(data: CompanyRequest): Promise<CompanyResponse> {
    return this.companyRepository.create(data);
  }

  // ── Update ───────────────────────────────────────────────────
  async updateCompany(
    id: string,
    data: Partial<CompanyRequest>
  ): Promise<CompanyResponse> {
    const existing = await this.companyRepository.findById(id);
    if (!existing) {
      throw new AppError("Company not found", 404);
    }

    const updated = await this.companyRepository.update(id, data);
    if (!updated) {
      throw new AppError("Company not found after update", 404);
    }
    return updated;
  }

  // ── Delete ───────────────────────────────────────────────────
  async deleteCompany(id: string): Promise<boolean> {
    const existing = await this.companyRepository.findById(id);
    if (!existing) {
      throw new AppError("Company not found", 404);
    }

    const success = await this.companyRepository.delete(id);
    if (!success) {
      throw new AppError("Company could not be deleted", 500);
    }
    return success;
  }

  // ── Entity Assignment ─────────────────────────────────────────
  async assignEntities(
    companyId: string,
    tenantIds: string[],
    roomIds: string[],
    contractId?: string
  ): Promise<void> {
    return this.companyRepository.assignEntities(companyId, tenantIds, roomIds, contractId);
  }

  async unassignEntities(
    companyId: string,
    tenantIds: string[],
    roomIds: string[],
    contractId?: string
  ): Promise<void> {
    return this.companyRepository.unassignEntities(companyId, tenantIds, roomIds, contractId);
  }

  // ── Custom Summary/Contracts/Stats ────────────────────────────
  async getCompanySummary(companyId: string, clientId: string): Promise<any> {
    return this.companyRepository.getCompanySummary(companyId, clientId);
  }

  async getCompanyContracts(companyId: string, clientId: string): Promise<any[]> {
    const { default: Contract } = await import(
      "../../infrastructure/persistence/models/contract.model.js"
    );
    return Contract.find({
      company_id: new mongoose.Types.ObjectId(companyId),
      client_id: new mongoose.Types.ObjectId(clientId),
      deleted_at: null,
    }).lean();
  }

  async getCompanyTenantStats(companyId: string, clientId: string): Promise<any> {
    const { default: Tenant } = await import(
      "../../infrastructure/persistence/models/tenant.model.js"
    );
    const [total, active, inactive] = await Promise.all([
      Tenant.countDocuments({
        company_id: new mongoose.Types.ObjectId(companyId),
        client_id: new mongoose.Types.ObjectId(clientId),
        deleted_at: null,
      }),
      Tenant.countDocuments({
        company_id: new mongoose.Types.ObjectId(companyId),
        client_id: new mongoose.Types.ObjectId(clientId),
        allocation_status: true,
        deleted_at: null,
      }),
      Tenant.countDocuments({
        company_id: new mongoose.Types.ObjectId(companyId),
        client_id: new mongoose.Types.ObjectId(clientId),
        allocation_status: false,
        deleted_at: null,
      }),
    ]);

    const nationalityBreakdown = await Tenant.aggregate([
      {
        $match: {
          company_id: new mongoose.Types.ObjectId(companyId),
          client_id: new mongoose.Types.ObjectId(clientId),
          deleted_at: null,
        },
      },
      {
        $group: {
          _id: "$nationality",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          nationality: { $ifNull: ["$_id", "Unknown"] },
          count: 1,
          _id: 0,
        },
      },
    ]);

    return {
      total,
      active,
      inactive,
      nationalityBreakdown,
    };
  }

  async getCompanyAssignedRooms(
    companyId: string,
    clientId: string,
    filters: { contract_id?: string | undefined }
  ): Promise<any[]> {
    return this.companyRepository.getCompanyAssignedRooms(companyId, clientId, filters);
  }
}
