import mongoose from "mongoose";
import type { ContractAllocationRepository } from "../../domain/repositories/contract-allocation.repository.interface.js";
import type {
  ContractAllocationFilter,
  ContractAllocationRequest,
  ContractAllocationResponse,
  PaginatedContractAllocationResponse,
  AvailabilityCheckRequest,
  AvailabilityCheckResult,
} from "../../domain/types/contract-allocation.types.js";
import ContractAllocation from "./models/contract-allocation.model.js";
import { AppError } from "../../shared/utils/AppError.js";

export class MongoContractAllocationRepository implements ContractAllocationRepository {
  // ── Helper ────────────────────────────────────────────────────
  private mapToResponse(doc: any): ContractAllocationResponse {
    return {
      ...doc,
      id: doc._id?.toString() ?? doc.id,
      client_id: doc.client_id?.toString(),
      contract_id: doc.contract_id?.toString(),
      company_id: doc.company_id?.toString(),
      site_id: doc.site_id?.toString(),
      building_id: doc.building_id?.toString(),
      floor_id: doc.floor_id?.toString(),
      room_id: typeof doc.room_id === "object" && doc.room_id !== null && "_id" in doc.room_id
        ? { ...doc.room_id, id: doc.room_id._id?.toString() }
        : doc.room_id?.toString(),
      bed_id: doc.bed_id?.toString(),
    } as ContractAllocationResponse;
  }

  // ── Read ──────────────────────────────────────────────────────
  async findAll(
    page: number,
    limit: number,
    filters: ContractAllocationFilter
  ): Promise<PaginatedContractAllocationResponse> {
    const query: any = {};
    if (filters.client_id) query.client_id = new mongoose.Types.ObjectId(filters.client_id);
    if (filters.contract_id) query.contract_id = new mongoose.Types.ObjectId(filters.contract_id);
    if (filters.company_id) query.company_id = new mongoose.Types.ObjectId(filters.company_id);
    if (filters.allocation_type) query.allocation_type = filters.allocation_type;
    if (filters.status) query.status = filters.status;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      ContractAllocation.find(query)
        .select("-__v")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      ContractAllocation.countDocuments(query),
    ]);

    return {
      items: data.map((d: any) => this.mapToResponse(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, clientId: string): Promise<ContractAllocationResponse | null> {
    const doc = await ContractAllocation.findOne({
      _id: new mongoose.Types.ObjectId(id),
      client_id: new mongoose.Types.ObjectId(clientId),
    })
      .select("-__v")
      .lean();
    if (!doc) return null;
    return this.mapToResponse(doc);
  }

  async findByContract(
    contractId: string,
    clientId: string
  ): Promise<ContractAllocationResponse[]> {
    const docs = await ContractAllocation.find({
      contract_id: new mongoose.Types.ObjectId(contractId),
      client_id: new mongoose.Types.ObjectId(clientId),
    })
      .populate("room_id", "room_number floor")
      .select("-__v")
      .lean();

    if (docs.length > 0) {
      return docs.map((d: any) => this.mapToResponse(d));
    }

    // Fallback: If no new allocations exist, look up legacy CompanyAssignedRoom records
    const CompanyAssignedRoomModel = mongoose.model("company_assigned_rooms");
    const ContractModel = mongoose.model("contracts");

    const [legacyDocs, contractDoc] = await Promise.all([
      CompanyAssignedRoomModel.find({
        contract_id: new mongoose.Types.ObjectId(contractId),
        client_id: new mongoose.Types.ObjectId(clientId),
        deleted_at: null,
      })
        .populate("room_id", "room_number floor")
        .lean(),
      ContractModel.findById(contractId).lean(),
    ]);

    if (!contractDoc || legacyDocs.length === 0) {
      return [];
    }

    // Map legacy documents to ContractAllocationResponse structure
    return legacyDocs.map((ld: any) => {
      const mapped = {
        _id: ld._id,
        id: ld._id.toString(),
        client_id: ld.client_id.toString(),
        contract_id: ld.contract_id?.toString() ?? contractId,
        company_id: ld.company_id.toString(),
        allocation_type: "ROOM",
        site_id: ld.camp_id?.toString() ?? ld.site_id?.toString(),
        building_id: ld.zone_id?.toString() ?? ld.building_id?.toString(),
        room_id: ld.room_id, // already populated object or ID
        start_date: (contractDoc as any).start_date,
        end_date: (contractDoc as any).end_date,
        status: "Active",
        quantity: 1,
        rate: 0,
      };
      return this.mapToResponse(mapped);
    });
  }

  // ── Create ────────────────────────────────────────────────────
  async create(data: ContractAllocationRequest): Promise<ContractAllocationResponse> {
    const payload: any = {
      ...data,
      client_id: new mongoose.Types.ObjectId(data.client_id),
      contract_id: new mongoose.Types.ObjectId(data.contract_id),
      company_id: new mongoose.Types.ObjectId(data.company_id),
      start_date: new Date(data.start_date),
      end_date: new Date(data.end_date),
    };

    // Coerce optional ObjectId fields
    const oidFields = ["site_id", "building_id", "floor_id", "room_id", "bed_id"] as const;
    for (const field of oidFields) {
      if (data[field]) {
        payload[field] = new mongoose.Types.ObjectId(data[field]);
      }
    }

    const created = await ContractAllocation.create(payload);
    const result = await this.findById(
      (created as any)._id.toString(),
      data.client_id
    );
    return result!;
  }

  // ── Update ────────────────────────────────────────────────────
  async update(
    id: string,
    clientId: string,
    data: Partial<ContractAllocationRequest>
  ): Promise<ContractAllocationResponse | null> {
    const payload: any = { ...data };
    if (data.start_date) payload.start_date = new Date(data.start_date);
    if (data.end_date) payload.end_date = new Date(data.end_date);
    const oidFields = ["contract_id", "company_id", "site_id", "building_id", "floor_id", "room_id", "bed_id"] as const;
    for (const field of oidFields) {
      if ((data as any)[field]) {
        payload[field] = new mongoose.Types.ObjectId((data as any)[field]);
      }
    }

    await ContractAllocation.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        client_id: new mongoose.Types.ObjectId(clientId),
      },
      { $set: payload },
      { returnDocument: 'after' }
    );
    return this.findById(id, clientId);
  }

  // ── Delete ────────────────────────────────────────────────────
  async delete(id: string, clientId: string): Promise<boolean> {
    const result = await ContractAllocation.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(id),
      client_id: new mongoose.Types.ObjectId(clientId),
    });
    return !!result;
  }

  // ── Availability ──────────────────────────────────────────────
  async checkRoomAvailability(
    params: AvailabilityCheckRequest,
    clientId: string
  ): Promise<AvailabilityCheckResult> {
    if (!params.room_id) return { available: true };

    const query: any = {
      room_id: new mongoose.Types.ObjectId(params.room_id),
      client_id: new mongoose.Types.ObjectId(clientId),
      status: "Active",
      start_date: { $lte: new Date(params.end_date) },
      end_date: { $gte: new Date(params.start_date) },
    };
    if (params.exclude_allocation_id) {
      query._id = { $ne: new mongoose.Types.ObjectId(params.exclude_allocation_id) };
    }

    const conflict = await ContractAllocation.findOne(query).lean();
    if (!conflict) return { available: true };

    return {
      available: false,
      conflict_allocation_id: (conflict as any)._id.toString(),
      message: `Room is already allocated in contract ${(conflict as any).contract_id} during this period`,
    };
  }

  async checkBedAvailability(
    params: AvailabilityCheckRequest,
    clientId: string
  ): Promise<AvailabilityCheckResult> {
    if (!params.bed_id) return { available: true };

    const query: any = {
      bed_id: new mongoose.Types.ObjectId(params.bed_id),
      client_id: new mongoose.Types.ObjectId(clientId),
      status: "Active",
      start_date: { $lte: new Date(params.end_date) },
      end_date: { $gte: new Date(params.start_date) },
    };
    if (params.exclude_allocation_id) {
      query._id = { $ne: new mongoose.Types.ObjectId(params.exclude_allocation_id) };
    }

    const conflict = await ContractAllocation.findOne(query).lean();
    if (!conflict) return { available: true };

    return {
      available: false,
      conflict_allocation_id: (conflict as any)._id.toString(),
      message: `Bed is already allocated in contract ${(conflict as any).contract_id} during this period`,
    };
  }
}
