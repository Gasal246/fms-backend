import mongoose from "mongoose";
import type { ContractRepository, RenewContractRequest } from "../../domain/repositories/contract.repository.interface.js";
import type {
  ContractFilter,
  ContractRequest,
  ContractResponse,
  PaginatedContractResponse,
  ContractOccupancySummary,
} from "../../domain/types/contract.types.js";
import Contract from "./models/contract.model.js";
import ContractAllocation from "./models/contract-allocation.model.js";
import CompanyAssignedRoom from "./models/company-assigned-room.model.js";
import Tenant from "./models/tenant.model.js";
import Building_rooms from "./models/room.model.js";
import { AppError } from "../../shared/utils/AppError.js";
import { ContractTerminationModel } from "./models/contract-termination.model.js";

const EXPIRING_SOON_DAYS = 30;

export class MongoContractRepository implements ContractRepository {
  // ── Helper ────────────────────────────────────────────────────
  private resolveStatus(doc: any): string {
    if (["Suspended", "Terminated"].includes(doc.status)) return doc.status;
    const now = new Date();
    const start = new Date(doc.start_date);
    const end = new Date(doc.end_date);
    
    // Future-dated contract: treat as Scheduled regardless of stored status
    if (["Active", "Approved", "Scheduled", "Draft"].includes(doc.status) && start > now) {
      return "Scheduled";
    }

    const alertDays = doc.expire_alert_days !== undefined && doc.expire_alert_days !== null ? Number(doc.expire_alert_days) : EXPIRING_SOON_DAYS;
    console.log("alertDays", doc.expire_alert_days);
    // Expiry check logic (Expired and Expiring Soon) only works if the stored status is Active or Expiring Soon.
    if (["Active", "Expiring Soon"].includes(doc.status)) {
      if (end < now) {
        if (doc.renewedToContractId || doc.renewed_to_contract_id) {
          return "Renewed";
        }
        return "Expired";
      }

      // Contract is currently running (start <= now <= end): resolve to Active or Expiring Soon
      if (start <= now && end >= now) {
        const soonDate = new Date();
        soonDate.setDate(soonDate.getDate() + alertDays);
        if (end <= soonDate) return "Expiring Soon";
        return "Active";
      }
    }

    return doc.status;
  }

  private mapToResponse(doc: any): ContractResponse {
    return {
      ...doc,
      id: doc._id?.toString() ?? doc.id,
      client_id: doc.client_id?.toString(),
      company_id: doc.company_id && typeof doc.company_id === 'object'
        ? {
            ...doc.company_id,
            id: doc.company_id._id?.toString() ?? doc.company_id.id,
            company_name: doc.company_id.company_name || doc.company_id.name
          }
        : doc.company_id?.toString(),
      created_by: doc.created_by && typeof doc.created_by === 'object'
        ? {
            id: doc.created_by._id?.toString() ?? doc.created_by.id,
            name: doc.created_by.name,
            email: doc.created_by.email
          }
        : doc.created_by?.toString(),
      updated_by: doc.updated_by && typeof doc.updated_by === 'object'
        ? {
            id: doc.updated_by._id?.toString() ?? doc.updated_by.id,
            name: doc.updated_by.name,
            email: doc.updated_by.email
          }
        : doc.updated_by?.toString(),
      // Renewal chain fields
      renewed_from_contract_id: doc.renewedFromContractId?.toString() ?? null,
      renewed_to_contract_id: doc.renewedToContractId?.toString() ?? null,
      is_renewal: doc.isRenewal ?? false,
      renewal_version: doc.renewalVersion ?? 1,
      expire_alert_days: doc.expire_alert_days !== undefined ? doc.expire_alert_days : 30,
      status: this.resolveStatus(doc),
    } as ContractResponse;
  }

  // ── Read ──────────────────────────────────────────────────────
  async findAll(
    page: number,
    limit: number,
    filters: ContractFilter
  ): Promise<PaginatedContractResponse> {
    const query: any = { deleted_at: null };
    if (filters.client_id) query.client_id = new mongoose.Types.ObjectId(filters.client_id);

    if (filters.user_role === "ROLE_COORDINATOR" || filters.user_role === "ROLE_ZONE_COORDINATOR") {
      const assignedCamps = filters.assigned_camps || [];
      const assignedZones = filters.assigned_zones || [];
      
      // 1. Get room IDs under the coordinator's assigned camps/zones
      const allowedRooms = await Building_rooms.find({
        $or: [
          { camp_id: { $in: assignedCamps.map((id: any) => new mongoose.Types.ObjectId(id)) } },
          { zone_id: { $in: assignedZones.map((id: any) => new mongoose.Types.ObjectId(id)) } }
        ]
      }).select("_id").lean();
      
      const allowedRoomIds = allowedRooms.map(r => r._id);

      // 2. Find all contract IDs that have allocations matching these rooms or matching camps
      const allowedAllocations = await ContractAllocation.find({
        $or: [
          { room_id: { $in: allowedRoomIds } },
          { site_id: { $in: assignedCamps.map((id: any) => new mongoose.Types.ObjectId(id)) } }
        ]
      }).select("contract_id").lean();

      const allowedContractIds = allowedAllocations.map(a => a.contract_id);
      
      // Apply to query
      query._id = { $in: allowedContractIds };
    }

    if (filters.company_id) query.company_id = new mongoose.Types.ObjectId(filters.company_id);
    if (filters.billing_model) query.billing_model = filters.billing_model;
    if (filters.created_by) query.created_by = new mongoose.Types.ObjectId(filters.created_by);

    // Status and Renewal filter logic
    const isIncludeRenewed = filters.include_renewed === "true" || filters.include_renewed === true;

    if (isIncludeRenewed) {
      if (filters.status) {
        if (filters.status === "Expired") {
          query.status = { $in: ["Active", "Expiring Soon", "Expired"] };
          query.end_date = { $lt: new Date() };
        } else if (filters.status === "Expiring Soon") {
          query.status = { $in: ["Active", "Expiring Soon"] };
          query.$expr = {
            $and: [
              { $gte: ["$end_date", new Date()] },
              {
                $lte: [
                  "$end_date",
                  {
                    $add: [
                      new Date(),
                      { $multiply: [{ $ifNull: ["$expire_alert_days", 30] }, 86400000] }
                    ]
                  }
                ]
              }
            ]
          };
        } else if (filters.status === "Renewed") {
          query.renewedToContractId = { $ne: null };
          query.end_date = { $lt: new Date() };
        } else if (filters.status === "Active") {
          query.status = { $in: ["Active", "Expiring Soon"] };
          query.$expr = {
            $and: [
              { $gte: ["$end_date", new Date()] },
              {
                $gt: [
                  "$end_date",
                  {
                    $add: [
                      new Date(),
                      { $multiply: [{ $ifNull: ["$expire_alert_days", 30] }, 86400000] }
                    ]
                  }
                ]
              }
            ]
          };
        } else {
          query.status = filters.status;
        }
      }
    } else {
      if (filters.status === "Renewed") {
        query.renewedToContractId = { $ne: null };
        query.end_date = { $lt: new Date() };
      } else {
        query.renewedToContractId = null;
        if (filters.status) {
          if (filters.status === "Expired") {
            query.status = { $in: ["Active", "Expiring Soon", "Expired"] };
            query.end_date = { $lt: new Date() };
          } else if (filters.status === "Expiring Soon") {
            query.status = { $in: ["Active", "Expiring Soon"] };
            query.$expr = {
              $and: [
                { $gte: ["$end_date", new Date()] },
                {
                  $lte: [
                    "$end_date",
                    {
                      $add: [
                        new Date(),
                        { $multiply: [{ $ifNull: ["$expire_alert_days", 30] }, 86400000] }
                      ]
                    }
                  ]
                }
              ]
            };
          } else if (filters.status === "Active") {
            query.status = { $in: ["Active", "Expiring Soon"] };
            query.$expr = {
              $and: [
                { $gte: ["$end_date", new Date()] },
                {
                  $gt: [
                    "$end_date",
                    {
                      $add: [
                        new Date(),
                        { $multiply: [{ $ifNull: ["$expire_alert_days", 30] }, 86400000] }
                      ]
                    }
                  ]
                }
              ]
            };
          } else {
            query.status = filters.status;
          }
        }
      }
    }

    // Renewal filter
    if (filters.is_renewal !== undefined) {
      query.isRenewal = filters.is_renewal;
    }

    if (filters.date_from || filters.date_to) {
      query.start_date = {};
      if (filters.date_from) query.start_date.$gte = new Date(filters.date_from);
      if (filters.date_to) query.start_date.$lte = new Date(filters.date_to);
    }

    if (filters.search) {
      query.$or = [
        { contract_number: { $regex: filters.search, $options: "i" } },
        { contract_name: { $regex: filters.search, $options: "i" } },
      ];
    }

    console.log(query,"query");
     
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Contract.find(query)
        .populate("company_id","company_name")
        .select("contract_number room_count contract_name status allocationCount linkedTenantsCount start_date end_date billing_model renewedFromContractId renewedToContractId isRenewal renewalVersion expire_alert_days")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Contract.countDocuments(query),
    ]);

    const contractIds = data.map((d: any) => d._id);

    // 1. Bulk query for allocation counts
    const allocationCounts = await ContractAllocation.aggregate([
      { $match: { contract_id: { $in: contractIds }, status: "Active" } },
      { $group: { _id: "$contract_id", count: { $sum: 1 } } }
    ]);
    const allocationCountMap: Record<string, number> = {};
    allocationCounts.forEach((item: any) => {
      if (item._id) {
        allocationCountMap[item._id.toString()] = item.count;
      }
    });

    // 2. Bulk query for active room IDs
    const activeRoomsGroupByContract = await ContractAllocation.aggregate([
      { $match: { contract_id: { $in: contractIds }, allocation_type: "ROOM", status: "Active" } },
      { $group: { _id: "$contract_id", roomIds: { $push: "$room_id" } } }
    ]);
    const roomIdsMap: Record<string, any[]> = {};
    const allRoomIds: any[] = [];
    activeRoomsGroupByContract.forEach((item: any) => {
      if (item._id) {
        const cid = item._id.toString();
        roomIdsMap[cid] = item.roomIds || [];
        (item.roomIds || []).forEach((rid: any) => {
          if (rid) {
            allRoomIds.push(rid);
          }
        });
      }
    });

    // 3. Bulk query for tenants
    const tenants = await Tenant.find({
      deleted_at: null,
      $or: [
        { contract_id: { $in: contractIds } },
        { room_id: { $in: allRoomIds }, allocation_status: true }
      ]
    }, { contract_id: 1, room_id: 1, allocation_status: 1 }).lean();

    // Map counts in memory
    const items = data.map((d: any) => {
      const cidStr = d._id.toString();
      const contractRoomsSet = new Set((roomIdsMap[cidStr] || []).map((r: any) => r.toString()));
      
      let tenantsCount = 0;
      tenants.forEach((t: any) => {
        if (t.contract_id && t.contract_id.toString() === cidStr) {
          tenantsCount++;
        } else if (t.room_id && t.allocation_status && contractRoomsSet.has(t.room_id.toString())) {
          tenantsCount++;
        }
      });

      const mapped = this.mapToResponse(d);
      mapped.allocationCount = allocationCountMap[cidStr] || 0;
      mapped.linkedTenantsCount = tenantsCount;
      return mapped;
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, clientId: string): Promise<ContractResponse | null> {
    const doc = await Contract.findOne({
      _id: new mongoose.Types.ObjectId(id),
      client_id: new mongoose.Types.ObjectId(clientId),
      deleted_at: null,
    })
      .populate("company_id","company_name")
      .populate("created_by", "_id name email")
      .populate("updated_by", "_id name email")
      .select("-__v")
      .lean();
    if (!doc) return null;

    const assignedRoomIds = await ContractAllocation.distinct("room_id", {
      contract_id: doc._id,
      allocation_type: "ROOM",
      status: "Active"
    });
    const [allocationCount, linkedTenantsCount] = await Promise.all([
      ContractAllocation.countDocuments({ contract_id: doc._id, status: "Active" }),
      Tenant.countDocuments({
        deleted_at: null,
        $or: [
          { contract_id: doc._id },
          { room_id: { $in: assignedRoomIds }, allocation_status: true }
        ]
      }),
    ]);

    const mapped = this.mapToResponse(doc);
    mapped.allocationCount = allocationCount;
    mapped.linkedTenantsCount = linkedTenantsCount;
    return mapped;
  }

  async exists(id: string, clientId: string): Promise<boolean> {
    const found = await Contract.findOne({
      _id: new mongoose.Types.ObjectId(id),
      client_id: new mongoose.Types.ObjectId(clientId),
      deleted_at: null,
    }).select("_id").lean();
    return !!found;
  }

  async findByNumber(
    contractNumber: string,
    clientId: string,
    excludeId?: string
  ): Promise<ContractResponse | null> {
    const query: any = {
      contract_number: contractNumber,
      client_id: new mongoose.Types.ObjectId(clientId),
      deleted_at: null,
    };
    if (excludeId) query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    const doc = await Contract.findOne(query).lean();
    if (!doc) return null;
    return this.mapToResponse(doc);
  }

  async findByCompany(
    companyId: string,
    clientId: string,
    page: number,
    limit: number
  ): Promise<PaginatedContractResponse> {
    return this.findAll(page, limit, { company_id: companyId, client_id: clientId });
  }

  // ── Create ────────────────────────────────────────────────────
  async create(data: ContractRequest): Promise<ContractResponse> {
    const duplicate = await Contract.findOne({
      contract_number: data.contract_number,
      client_id: new mongoose.Types.ObjectId(data.client_id),
      deleted_at: null,
    });
    if (duplicate) {
      throw new AppError(
        `Contract number "${data.contract_number}" already exists for this client`,
        409
      );
    }

    const payload: any = {
      ...data,
      client_id: new mongoose.Types.ObjectId(data.client_id),
      company_id: new mongoose.Types.ObjectId(data.company_id),
      start_date: new Date(data.start_date),
      end_date: new Date(data.end_date),
    };

    const created = await Contract.create(payload);

    try {
      const UserActivityLogModel = (await import("./models/user-activity-log.model.js")).default;
      await UserActivityLogModel.create({
        performed_by: data.created_by ? data.created_by.toString() : "System",
        action: "Contract Created",
        module: "Contract",
        timestamp: new Date(),
        new_state: { contract_id: created._id.toString(), contract_number: created.contract_number },
      });
    } catch (logErr) {
      console.error("Failed to write activity log for contract creation:", logErr);
    }

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
    data: Partial<ContractRequest>
  ): Promise<ContractResponse | null> {
    if (data.contract_number) {
      const dup = await Contract.findOne({
        contract_number: data.contract_number,
        client_id: new mongoose.Types.ObjectId(clientId),
        _id: { $ne: new mongoose.Types.ObjectId(id) },
        deleted_at: null,
      });
      if (dup) {
        throw new AppError(
          `Contract number "${data.contract_number}" already exists`,
          409
        );
      }
    }

    const payload: any = { ...data };
    if (data.company_id) payload.company_id = new mongoose.Types.ObjectId(data.company_id);
    if (data.start_date) payload.start_date = new Date(data.start_date);
    if (data.end_date) payload.end_date = new Date(data.end_date);

    if (data.status === "Terminated") {
      const cId = new mongoose.Types.ObjectId(id);
      const clId = new mongoose.Types.ObjectId(clientId);

      const assignedRoomIds = await ContractAllocation.distinct("room_id", {
        contract_id: cId,
        allocation_type: "ROOM",
        status: "Active"
      });

      const [allocationCount, tenantCount] = await Promise.all([
        ContractAllocation.countDocuments({ contract_id: cId, client_id: clId, status: "Active" }),
        Tenant.countDocuments({
          client_id: clId,
          deleted_at: null,
          $or: [
            { contract_id: cId, allocation_status: true },
            { room_id: { $in: assignedRoomIds }, allocation_status: true }
          ]
        })
      ]);

      if (allocationCount > 0 || tenantCount > 0) {
        throw new AppError(
          `Cannot terminate contract. There are still ${allocationCount} active room allocation(s) and ${tenantCount} active tenant(s). Please unassign all rooms and deallocate all tenants first.`,
          400
        );
      }
    }

    const oldContract = await Contract.findOne({ _id: new mongoose.Types.ObjectId(id), client_id: new mongoose.Types.ObjectId(clientId), deleted_at: null }).lean();

    const updated = await Contract.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), client_id: new mongoose.Types.ObjectId(clientId), deleted_at: null },
      { $set: payload },
      { returnDocument: 'after' }
    );

    if (data.status === "Terminated") {
      const assignedRooms = await CompanyAssignedRoom.find({
        contract_id: new mongoose.Types.ObjectId(id),
        deleted_at: null
      }).lean();

      if (assignedRooms.length > 0) {
        const assignedRoomIds = assignedRooms.map((ar: any) => ar._id);
        await CompanyAssignedRoom.updateMany(
          { _id: { $in: assignedRoomIds } },
          { $set: { deleted_at: new Date() } }
        );
        await Building_rooms.updateMany(
          { company_assigned_room_id: { $in: assignedRoomIds } },
          { $set: { company_assigned_room_id: null } }
        );
      }

      await ContractTerminationModel.create({
        contract_id: new mongoose.Types.ObjectId(id),
        client_id: new mongoose.Types.ObjectId(clientId),
        ...(data.updated_by ? { terminated_by: new mongoose.Types.ObjectId(data.updated_by) } : {}),
        ...(data.updated_by_role ? { terminated_by_model: data.updated_by_role === 'client_admin' ? 'clients' : 'coordinator' } : {}),
        termination_reason: data.termination_reason || "",
      });
    }

    try {
      const UserActivityLogModel = (await import("./models/user-activity-log.model.js")).default;
      await UserActivityLogModel.create({
        performed_by: data.updated_by ? data.updated_by.toString() : "System",
        action: "Contract Updated",
        module: "Contract",
        timestamp: new Date(),
        previous_state: oldContract,
        new_state: payload,
      });
    } catch (logErr) {
      console.error("Failed to write activity log for contract update:", logErr);
    }

    return this.findById(id, clientId);
  }

  // ── Terminate Contract ───────────────────────────────────────────────
  async delete(id: string, clientId: string, userId?: string, userRole?: string): Promise<boolean> {
    const result = await Contract.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), client_id: new mongoose.Types.ObjectId(clientId), deleted_at: null },
      { $set: { status: "Terminated" } }
    );

    if (result) {
      const assignedRooms = await CompanyAssignedRoom.find({
        contract_id: result._id,
        deleted_at: null
      }).lean();

      if (assignedRooms.length > 0) {
        const assignedRoomIds = assignedRooms.map((ar: any) => ar._id);
        await CompanyAssignedRoom.updateMany(
          { _id: { $in: assignedRoomIds } },
          { $set: { deleted_at: new Date() } }
        );
        await Building_rooms.updateMany(
          { company_assigned_room_id: { $in: assignedRoomIds } },
          { $set: { company_assigned_room_id: null } }
        );
      }

      await ContractTerminationModel.create({
        contract_id: result._id,
        client_id: result.client_id,
        ...(userId ? { terminated_by: new mongoose.Types.ObjectId(userId) } : {}),
        ...(userRole ? { terminated_by_model: userRole === 'client_admin' ? 'clients' : 'coordinator' } : {}),
        termination_reason: "Terminated via delete endpoint",
      });
    }

    return !!result;
  }

  // ── Get Termination Details ─────────────────────────────────────────
  async getTerminationDetails(contractId: string): Promise<any | null> {
    const termination = await ContractTerminationModel.findOne({
      contract_id: new mongoose.Types.ObjectId(contractId)
    })
      .populate("terminated_by","full_name role_id")
      .populate("contract_id","contract_number contract_name")
      .select("terminated_by termination_reason termination_date contract_id terminated_by_model")
      .lean();
      
    return termination;
  }

  // ── Occupancy Summary ───────────────────────────────────────────
  async getOccupancySummary(
    contractId: string,
    clientId: string
  ): Promise<ContractOccupancySummary> {
    const cId = new mongoose.Types.ObjectId(contractId);
    const clId = new mongoose.Types.ObjectId(clientId);

    const assignedRoomIds = await ContractAllocation.distinct("room_id", {
      contract_id: cId,
      allocation_type: "ROOM",
      status: "Active"
    });

    const [allocations, occupants] = await Promise.all([
      ContractAllocation.find({
        contract_id: cId,
        client_id: clId,
        status: "Active",
      }).lean(),
      Tenant.countDocuments({
        client_id: clId,
        allocation_status: true,
        deleted_at: null,
        $or: [
          { contract_id: cId },
          { room_id: { $in: assignedRoomIds } }
        ]
      }),
    ]);

    const roomAllocations = allocations.filter((a) => a.allocation_type === "ROOM");
    const bedAllocations = allocations.filter((a) => a.allocation_type === "BED");
    const headcountAllocations = allocations.filter((a) => a.allocation_type === "HEADCOUNT");

    const totalAllocatedRooms = roomAllocations.length;
    const totalAllocatedBeds = bedAllocations.length;
    const totalHeadcountCapacity = headcountAllocations.reduce(
      (sum, a) => sum + (a.quantity || 0),
      0
    );

    // Get occupied rooms / beds from actual tenant assignments
    const occupiedRoomIds = await Tenant.distinct("room_id", {
      client_id: clId,
      room_id: { $in: assignedRoomIds },
      allocation_status: true,
      deleted_at: null,
    });
    const occupiedRooms = occupiedRoomIds.length;
    const currentTenants = occupants;

    return {
      contract_id: contractId,
      total_allocated_rooms: totalAllocatedRooms,
      total_allocated_beds: totalAllocatedBeds,
      total_headcount_capacity: totalHeadcountCapacity,
      occupied_rooms: occupiedRooms,
      occupied_beds: currentTenants, // beds = tenant count when bed-type contract
      current_tenants: currentTenants,
      available_rooms: Math.max(0, totalAllocatedRooms - occupiedRooms),
      available_beds: Math.max(0, totalAllocatedBeds - currentTenants),
      available_headcount: Math.max(0, totalHeadcountCapacity - currentTenants),
    };
  }

  // ── Renew ──────────────────────────────────────────────────
  async renew(
    originalId: string,
    clientId: string,
    data: RenewContractRequest,
    copyAllocations: boolean,
    userId?: string
  ): Promise<ContractResponse> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const origObjId = new mongoose.Types.ObjectId(originalId);
      const clObjId = new mongoose.Types.ObjectId(clientId);

      // 1. Load original
      const original = await Contract.findOne({
        _id: origObjId,
        client_id: clObjId,
        deleted_at: null,
      }).session(session);

      if (!original) {
        throw new AppError("Original contract not found", 404);
      }

      // 2. Guard: already renewed
      if (original.renewedToContractId) {
        throw new AppError("Contract has already been renewed", 400);
      }

      // 3. Guard: Contract belongs to active company
      const Company = mongoose.model("companies");
      const company = await Company.findOne({
        _id: original.company_id,
        deleted_at: null,
      }).session(session);
      
      if (!company || company.get("status") != "Active") {
        throw new AppError("Contract belongs to an inactive or deleted company", 400);
      }

      // 4. Guard: Within renewal window OR expired (based on latest end_date)
      const now = new Date();
      const endDate = new Date(original.end_date);
      const windowDays = original.notice_period_days || 60;
      const windowMs = windowDays * 24 * 60 * 60 * 1000;
      const renewalStartDate = new Date(endDate.getTime() - windowMs);
      if (now < renewalStartDate) {
        throw new AppError(`Contract is not yet within its renewal window (notice period: ${windowDays} days)`, 400);
      }

      // 5. Guard: Valid dates
      const newStart = new Date(data.start_date);
      const newEnd = new Date(data.end_date);
      if (newStart >= newEnd) {
        throw new AppError("New contract end date must be after start date", 400);
      }

      // 6. Check for duplicate contract number
      const dup = await Contract.findOne({
        contract_number: data.contract_number,
        client_id: clObjId,
        deleted_at: null,
      }).session(session);
      if (dup) {
        throw new AppError(
          `Contract number "${data.contract_number}" already exists for this client`,
          409
        );
      }

      // Determine initial status of the new contract: Scheduled if start date is in the future
      const newStatus = newStart > now ? "Scheduled" : "Draft";

      // 7. Create new contract (copy all commercial fields + apply overrides)
      const newContractPayload: any = {
        client_id: clObjId,
        company_id: original.company_id,
        contract_number: data.contract_number,
        contract_name: data.contract_name,
        billing_model: data.billing_model || original.billing_model,
        currency: data.currency || original.currency,
        start_date: newStart,
        end_date: newEnd,
        status: newStatus,
        notes: data.notes ?? original.notes,
        auto_renew: data.auto_renew ?? original.auto_renew,
        max_head_count: data.max_head_count ?? original.max_head_count,
        room_count: data.room_count ?? original.room_count,
        agreed_rate: data.agreed_rate ?? original.agreed_rate,
        grace_period_days: data.grace_period_days ?? original.grace_period_days,
        notice_period_days: data.notice_period_days ?? original.notice_period_days,
        renewal_terms: data.renewal_terms ?? original.renewal_terms,
        contract_value: data.contract_value ?? original.contract_value,
        tax_mode: data.tax_mode ?? original.tax_mode,
        compliance_required: data.compliance_required ?? original.compliance_required,
        document_checklist: original.document_checklist,
        // Renewal chain
        renewedFromContractId: origObjId,
        renewedToContractId: null,
        isRenewal: true,
        renewalVersion: (original.renewalVersion ?? 1) + 1,
        created_by: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      };

      const createdContracts = await Contract.create([newContractPayload], { session });
      const newContract = createdContracts[0];
      if (!newContract) {
        throw new AppError("Failed to create renewal contract", 500);
      }

      // 8. Update original: set renewedToContractId
      await Contract.findByIdAndUpdate(
        origObjId,
        { $set: { renewedToContractId: newContract._id } },
        { session }
      );

      // 9. Copy active allocations if requested
      if (copyAllocations) {
        let activeAllocations = await ContractAllocation.find({
          contract_id: origObjId,
          client_id: clObjId,
          status: "Active",
          deleted_at: null,
        }).session(session).lean();

        // If no allocations exist in the new model, fall back to legacy CompanyAssignedRoom
        if (activeAllocations.length === 0) {
          const legacyAssignedRooms = await CompanyAssignedRoom.find({
            contract_id: origObjId,
            client_id: clObjId,
            deleted_at: null,
          }).session(session).lean();

          activeAllocations = legacyAssignedRooms.map((ar: any) => ({
            _id: ar._id,
            client_id: ar.client_id,
            contract_id: ar.contract_id || origObjId,
            company_id: ar.company_id,
            allocation_type: "ROOM",
            site_id: ar.camp_id,
            building_id: ar.zone_id,
            room_id: ar.room_id,
            quantity: 1,
            rate: 0,
            start_date: original.start_date,
            end_date: original.end_date,
            status: "Active",
          })) as any[];
        }

        if (activeAllocations.length > 0) {
          // Excluded allocations validation: check occupancy for excluded rooms
          if (data.selected_allocation_ids && data.selected_allocation_ids.length > 0) {
            const selectedIds = new Set(data.selected_allocation_ids.map((id: string) => id.toString()));
            const excludedAllocations = activeAllocations.filter(a => !selectedIds.has(a._id.toString()));

            const RoomModel = mongoose.model("building_rooms");
            for (const alloc of excludedAllocations) {
              if (alloc.allocation_type === "ROOM" && alloc.room_id) {
                const hasTenants = await Tenant.exists({
                  room_id: alloc.room_id,
                  allocation_status: true,
                  deleted_at: null,
                }).session(session);

                if (hasTenants) {
                  const roomDoc = await RoomModel.findById(alloc.room_id).session(session).lean();
                  const roomName = roomDoc ? (roomDoc as any).room_number : alloc.room_id.toString();
                  throw new AppError(
                    `Room ${roomName} has active tenants and cannot be removed during renewal.`,
                    400
                  );
                }
              }
            }
          }

          // Filter out allocations that are not selected (if selective copying is used)
          const allocationsToCopy = data.selected_allocation_ids && data.selected_allocation_ids.length > 0
            ? activeAllocations.filter((a) => data.selected_allocation_ids!.includes(a._id.toString()))
            : activeAllocations;

          if (allocationsToCopy.length > activeAllocations.length) {
            throw new AppError("Renewal allocations count cannot exceed original active allocations", 400);
          }

          // Date overlap validation: check that rooms being renewed do not have other active allocations overlapping the new period
          for (const a of allocationsToCopy) {
            if (a.allocation_type === "ROOM" && a.room_id) {
              const conflict = await ContractAllocation.findOne({
                room_id: a.room_id,
                status: "Active",
                allocation_type: "ROOM",
                contract_id: { $ne: origObjId },
                start_date: { $lte: newEnd },
                end_date: { $gte: newStart },
              }).session(session);

              if (conflict) {
                const RoomModel = mongoose.model("building_rooms");
                const roomDoc = await RoomModel.findById(a.room_id).session(session).lean();
                const roomName = roomDoc ? (roomDoc as any).room_number : a.room_id.toString();
                throw new AppError(
                  `Room ${roomName} is already allocated under another contract during the renewal period.`,
                  400
                );
              }
            }
          }

          // Insert new selective allocation rows
          const newAllocations = allocationsToCopy.map((a) => ({
            client_id: a.client_id,
            contract_id: newContract._id,
            company_id: a.company_id,
            allocation_type: a.allocation_type,
            site_id: a.site_id,
            building_id: a.building_id,
            floor_id: a.floor_id,
            room_id: a.room_id,
            bed_id: a.bed_id,
            quantity: a.quantity,
            rate: a.rate,
            start_date: newStart,
            end_date: newEnd,
            remarks: a.remarks,
            status: "Active",
            created_by: userId,
          }));

          await ContractAllocation.insertMany(newAllocations, { session });
        }
      }

      // 10. Audit log for renewal
      try {
        const UserActivityLogModel = (await import("./models/user-activity-log.model.js")).default;
        await UserActivityLogModel.create([{
          performed_by: userId ? userId.toString() : "System",
          action: "Contract Renewed",
          module: "Contract",
          timestamp: new Date(),
          previous_state: { contract_id: originalId, contract_number: original.contract_number },
          new_state: { contract_id: newContract._id.toString(), contract_number: newContract.contract_number },
        }], { session });
      } catch (logErr) {
        console.error("Failed to write activity log for contract renewal:", logErr);
      }

      await session.commitTransaction();

      // 11. Return the full new contract (fetched outside session for full populate)
      const result = await this.findById(newContract._id.toString(), clientId);
      return result!;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // ── Extend ──────────────────────────────────────────────────
  async extend(
    id: string,
    clientId: string,
    data: {
      new_end_date: string | Date;
      extension_reason?: string;
      document_id?: string | null;
    },
    userId: string,
    userRole: string
  ): Promise<ContractResponse> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const contractObjId = new mongoose.Types.ObjectId(id);
      const clObjId = new mongoose.Types.ObjectId(clientId);

      // 1. Fetch contract
      const contract = await Contract.findOne({
        _id: contractObjId,
        client_id: clObjId,
        deleted_at: null,
      }).session(session);

      if (!contract) {
        throw new AppError("Contract not found", 404);
      }

      // 2. Block if already renewed
      if (contract.renewedToContractId) {
        throw new AppError("Contract has already been renewed and cannot be extended", 400);
      }

      // 3. Validate status allows extension (must be running or expiring, not draft/terminated/renewed)
      const resolvedStatus = this.resolveStatus(contract);
      if (!["Active", "Expiring Soon", "Approved", "Scheduled"].includes(resolvedStatus)) {
        throw new AppError(`Cannot extend a contract with status '${resolvedStatus}'. Only Active, Expiring Soon, Approved, or Scheduled contracts can be extended.`, 400);
      }

      // 4. Validate new end date > current end date
      const currentEndDate = new Date(contract.end_date);
      const newEndDate = new Date(data.new_end_date);
      if (newEndDate <= currentEndDate) {
        throw new AppError("New end date must be after current contract end date", 400);
      }

      const previousEndDate = contract.end_date;

      // 5. Update end_date directly
      contract.end_date = newEndDate;

      // 6. Push to embedded extensions array
      contract.extensions.push({
        previous_end_date: previousEndDate,
        new_end_date: newEndDate,
        extension_reason: data.extension_reason || "",
        document_id: data.document_id ? new mongoose.Types.ObjectId(data.document_id) : null,
        extended_by: new mongoose.Types.ObjectId(userId),
        extended_by_role: userRole,
        extended_at: new Date(),
      });

      await contract.save({ session });

      // 7. Write UserActivityLog
      try {
        const UserActivityLogModel = (await import("./models/user-activity-log.model.js")).default;
        await UserActivityLogModel.create([{
          performed_by: userId,
          action: "Contract Extended",
          module: "Contract",
          timestamp: new Date(),
          previous_state: { contract_id: id, end_date: previousEndDate },
          new_state: {
            contract_id: id,
            end_date: newEndDate,
            extension_reason: data.extension_reason,
            document_id: data.document_id,
          },
        }], { session });
      } catch (logErr) {
        console.error("Failed to write activity log for contract extension:", logErr);
      }

      await session.commitTransaction();

      const result = await this.findById(id, clientId);
      return result!;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async getExtensions(contractId: string): Promise<any[]> {
    const UserActivityLogModel = (await import("./models/user-activity-log.model.js")).default;
    const logs = await UserActivityLogModel.find({
      module: "Contract",
      action: "Contract Extended",
      "new_state.contract_id": contractId,
    })
      .sort({ timestamp: -1 })
      .lean();
    return logs;
  }
}

