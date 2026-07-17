import mongoose from "mongoose";
import Tenant from "../../infrastructure/persistence/models/tenant.model.js";
import Contract from "../../infrastructure/persistence/models/contract.model.js";
import CompanyAssignedRoom from "../../infrastructure/persistence/models/company-assigned-room.model.js";
const EXPIRING_SOON_DAYS = 30;

/**
 * Reusable occupancy/summary helper methods.
 * Used by Contract use-case, Company use-case, Import engine, and Dashboard.
 */
export class OccupancyService {
  /**
   * Count active tenants (allocated) belonging to a company.
   */
  static async getActiveTenantsCountByCompany(
    companyId: string,
    clientId: string
  ): Promise<number> {
    return Tenant.countDocuments({
      company_id: new mongoose.Types.ObjectId(companyId),
      client_id: new mongoose.Types.ObjectId(clientId),
      allocation_status: true,
      deleted_at: null,
    });
  }

  /**
   * Count active tenants linked to a specific contract.
   */
  static async getActiveTenantsCountByContract(
    contractId: string,
    clientId: string
  ): Promise<number> {
    return Tenant.countDocuments({
      contract_id: new mongoose.Types.ObjectId(contractId),
      client_id: new mongoose.Types.ObjectId(clientId),
      allocation_status: true,
      deleted_at: null,
    });
  }

  /**
   * List all active allocations for a contract (rooms, beds, etc.).
   */
  static async getAllocatedByContract(
    contractId: string,
    clientId: string
  ): Promise<any[]> {
    return CompanyAssignedRoom.find({
      contract_id: new mongoose.Types.ObjectId(contractId),
      client_id: new mongoose.Types.ObjectId(clientId),
      status: "Active",
    }).lean();
  }

  /**
   * Distinct occupied room IDs by active tenants under a contract.
   */
  static async getOccupiedRoomsByContract(
    contractId: string,
    clientId: string
  ): Promise<string[]> {
    const ids = await Tenant.distinct("room_id", {
      contract_id: new mongoose.Types.ObjectId(contractId),
      client_id: new mongoose.Types.ObjectId(clientId),
      room_id: { $ne: null },
      allocation_status: true,
      deleted_at: null,
    });
    return ids.map((id: any) => id.toString());
  }

  /**
   * Get all contracts expiring within threshold days.
   */
  static async getExpiringContracts(
    clientId: string,
    thresholdDays = EXPIRING_SOON_DAYS
  ): Promise<any[]> {
    const now = new Date();
    const soon = new Date();
    soon.setDate(soon.getDate() + thresholdDays);

    return Contract.find({
      client_id: new mongoose.Types.ObjectId(clientId),
      end_date: { $gte: now, $lte: soon },
      deleted_at: null,
      status: { $nin: ["Terminated", "Suspended"] },
    })
      .select("contract_number contract_name company_id end_date status")
      .lean();
  }

  /**
   * Get contracts that have no linked documents.
   */
  static async getContractsWithoutDocuments(clientId: string): Promise<string[]> {
    const { default: ContractDocument } = await import(
      "../../infrastructure/persistence/models/contract-document.model.js"
    );

    const contractsWithDocs = await ContractDocument.distinct("contract_id", {
      client_id: new mongoose.Types.ObjectId(clientId),
    });

    const contracts = await Contract.find({
      client_id: new mongoose.Types.ObjectId(clientId),
      _id: { $nin: contractsWithDocs },
      deleted_at: null,
      compliance_required: true,
    })
      .select("_id contract_number contract_name")
      .lean();

    return contracts.map((c: any) => c._id.toString());
  }

  /**
   * Calculate available capacity for a contract.
   * Returns { rooms, beds, headcount } available.
   */
  static async getAvailableCapacity(
    contractId: string,
    clientId: string
  ): Promise<{ available_rooms: number; available_beds: number; available_headcount: number }> {
    const allocations = await CompanyAssignedRoom.find({
      contract_id: new mongoose.Types.ObjectId(contractId),
      client_id: new mongoose.Types.ObjectId(clientId),
      status: "Active",
    }).lean();

    const contract = await Contract.findOne({
      _id: new mongoose.Types.ObjectId(contractId),
      client_id: new mongoose.Types.ObjectId(clientId),
    }).lean();

    const currentTenants = await OccupancyService.getActiveTenantsCountByContract(
      contractId,
      clientId
    );
    const occupiedRooms = await OccupancyService.getOccupiedRoomsByContract(
      contractId,
      clientId
    );

    const roomAllocations = allocations.filter((a: any) => a.allocation_type === "ROOM");
    const bedAllocations = allocations.filter((a: any) => a.allocation_type === "BED");
    const headcountAllocations = allocations.filter((a: any) => a.allocation_type === "HEADCOUNT");

    const totalRooms = roomAllocations.length;
    const totalBeds = bedAllocations.length;
    const totalHeadcount = headcountAllocations.reduce((s: number, a: any) => s + (a.quantity || 0), 0) +
      ((contract as any)?.max_head_count ?? 0);

    return {
      available_rooms: Math.max(0, totalRooms - occupiedRooms.length),
      available_beds: Math.max(0, totalBeds - currentTenants),
      available_headcount: Math.max(0, totalHeadcount - currentTenants),
    };
  }
}
