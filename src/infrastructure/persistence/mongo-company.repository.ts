import mongoose from "mongoose";
import type { CompanyRepository } from "../../domain/repositories/company.repository.interface.js";
import type {
  CompanyFilter,
  CompanyRequest,
  CompanyResponse,
  PaginatedCompanyResponse,
  CompanySummary,
} from "../../domain/types/company.types.js";
import Company from "./models/company.model.js";
import Tenant from "./models/tenant.model.js";
import Room from "./models/room.model.js";
import Contract from "./models/contract.model.js";
import CompanyAssignedRoom from "./models/company-assigned-room.model.js";
import ContractAllocation from "./models/contract-allocation.model.js";
import { AppError } from "../../shared/utils/AppError.js";
import { syncRoomSummary } from "./helpers/room-summary.helper.js";

export class MongoCompanyRepository implements CompanyRepository {
  // ── Helpers ─────────────────────────────────────────────────
  private mapToResponse(doc: any): CompanyResponse {
    return {
      ...doc,
      id: doc._id?.toString() ?? doc.id,
      client_id: doc.client_id?.toString(),
      role_id: doc.role_id ? doc.role_id.toString() : undefined,
      country_id: doc.country_id ? doc.country_id.toString() : undefined,
      assigned_sites: Array.isArray(doc.assigned_sites)
        ? doc.assigned_sites.map((s: any) => s.toString())
        : [],
    } as CompanyResponse;
  }

  // ── Read ─────────────────────────────────────────────────────
  async findAll(
    page: number,
    limit: number,
    filters: CompanyFilter
  ): Promise<PaginatedCompanyResponse> {
    const query: any = { deleted_at: null };

    if (filters.client_id) query.client_id = new mongoose.Types.ObjectId(filters.client_id);
    if (filters.status !== undefined) query.status = filters.status;
    if (filters.company_type) query.company_type = filters.company_type;
    if (filters.assigned_site) {
      query.assigned_sites = new mongoose.Types.ObjectId(filters.assigned_site);
    }
    if (filters.date_from || filters.date_to) {
      query.onboarded_date = {};
      if (filters.date_from) query.onboarded_date.$gte = new Date(filters.date_from);
      if (filters.date_to) query.onboarded_date.$lte = new Date(filters.date_to);
    }
    if (filters.search) {
      query.$or = [
        { company_name: { $regex: filters.search, $options: "i" } },
        { company_code: { $regex: filters.search, $options: "i" } },
        { primary_contact_email: { $regex: filters.search, $options: "i" } },
        { primary_contact_phone: { $regex: filters.search, $options: "i" } },
        { email: { $regex: filters.search, $options: "i" } },
        { phone: { $regex: filters.search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      Company.find(query)
        .select("-__v -password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      Company.countDocuments(query),
    ]);

    return {
      items: data.map((d: any) => this.mapToResponse(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<CompanyResponse | null> {
    const company = await Company.findOne({ _id: id, deleted_at: null })
      .select("-__v -password")
      .lean();
    if (!company) return null;
    return this.mapToResponse(company);
  }

  async findByCode(
    company_code: string,
    excludeId?: string
  ): Promise<CompanyResponse | null> {
    const query: any = {
      company_code: company_code.toUpperCase(),
      deleted_at: null,
    };
    if (excludeId) query._id = { $ne: new mongoose.Types.ObjectId(excludeId) };

    const company = await Company.findOne(query).lean();
    if (!company) return null;
    return this.mapToResponse(company);
  }

  // ── Create ───────────────────────────────────────────────────
  async create(data: CompanyRequest): Promise<CompanyResponse> {
    // Duplicate company_code guard
    const duplicate = await Company.findOne({
      company_code: data.company_code.toUpperCase(),
      client_id: new mongoose.Types.ObjectId(data.client_id),
      deleted_at: null,
    });
    if (duplicate) {
      throw new AppError(
        `Company code "${data.company_code}" is already in use`,
        409
      );
    }

    const payload: any = {
      ...data,
      client_id: new mongoose.Types.ObjectId(data.client_id),
      company_code: data.company_code.toUpperCase(),
      assigned_sites: data.assigned_sites
        ? data.assigned_sites.map((s) => new mongoose.Types.ObjectId(s))
        : [],
    };

    // Coerce optional ObjectId/Date fields
    if (data.country_id) payload.country_id = new mongoose.Types.ObjectId(data.country_id);
    if (data.role_id) payload.role_id = new mongoose.Types.ObjectId(data.role_id);
    if (data.cr_expiry_date) payload.cr_expiry_date = new Date(data.cr_expiry_date);
    if (data.onboarded_date) payload.onboarded_date = new Date(data.onboarded_date);
    if (data.last_review_date) payload.last_review_date = new Date(data.last_review_date);

    const company = await Company.create(payload);
    const result = await this.findById((company as any)._id.toString());
    return result!;
  }

  // ── Update ───────────────────────────────────────────────────
  async update(
    id: string,
    data: Partial<CompanyRequest>
  ): Promise<CompanyResponse | null> {
    // Duplicate company_code guard (exclude self)
    if (data.company_code) {
      const current = await Company.findById(id).select("client_id").lean();
      const scopedClientId = data.client_id
        ? new mongoose.Types.ObjectId(data.client_id)
        : current?.client_id;
      if (!scopedClientId) {
        throw new AppError("Company Client Admin scope was not found", 422);
      }
      const duplicate = await Company.findOne({
        company_code: data.company_code.toUpperCase(),
        client_id: scopedClientId,
        _id: { $ne: new mongoose.Types.ObjectId(id) },
        deleted_at: null,
      });
      if (duplicate) {
        throw new AppError(
          `Company code "${data.company_code}" is already in use`,
          409
        );
      }
    }

    const updatePayload: any = { ...data };

    // Coerce typed fields
    if (data.client_id) updatePayload.client_id = new mongoose.Types.ObjectId(data.client_id);
    if (data.country_id) updatePayload.country_id = new mongoose.Types.ObjectId(data.country_id);
    if (data.role_id) updatePayload.role_id = new mongoose.Types.ObjectId(data.role_id);
    if (data.company_code) updatePayload.company_code = data.company_code.toUpperCase();
    if (data.cr_expiry_date) updatePayload.cr_expiry_date = new Date(data.cr_expiry_date);
    if (data.onboarded_date) updatePayload.onboarded_date = new Date(data.onboarded_date);
    if (data.last_review_date) updatePayload.last_review_date = new Date(data.last_review_date);
    if (data.assigned_sites) {
      updatePayload.assigned_sites = data.assigned_sites.map(
        (s) => new mongoose.Types.ObjectId(s)
      );
    }

    await Company.findByIdAndUpdate(id, { $set: updatePayload }, { returnDocument: 'after' });
    return this.findById(id);
  }

  // ── Soft Delete ──────────────────────────────────────────────
  async delete(id: string): Promise<boolean> {
    const result = await Company.findByIdAndUpdate(id, {
      $set: { deleted_at: new Date() },
    });
    return !!result;
  }

  // ── Entity Assignment (legacy) ───────────────────────────────
  async assignEntities(
    companyId: string,
    tenantIds: string[],
    roomIds: string[],
    contractId?: string
  ): Promise<void> {
    const compId = new mongoose.Types.ObjectId(companyId);
    
    // 1. Assign Tenants to Company (if any)
    if (tenantIds && tenantIds.length > 0) {
      await Tenant.updateMany(
        { _id: { $in: tenantIds.map(id => new mongoose.Types.ObjectId(id)) } },
        { $set: { company_id: compId, type: "client" } }
      );
    }
    // 2. Assign Rooms to Company & Contract
    let cId: mongoose.Types.ObjectId | undefined;
    if (contractId && mongoose.Types.ObjectId.isValid(contractId)) {
      cId = new mongoose.Types.ObjectId(contractId);
    } else {
      const approvedContract = await Contract.findOne({
        company_id: compId,
        status: "Approved",
        deleted_at: null,
      }).select("_id").lean();
      if (approvedContract) {
        cId = approvedContract._id;
      }
    }

    let contract: any = null;
    if (cId) {
      contract = await Contract.findById(cId);
    }

    let currentRoomIds: string[] = [];
    if (cId) {
      const currentAllocations = await ContractAllocation.find({
        contract_id: cId,
        allocation_type: "ROOM",
        status: "Active",
      }).lean();
      currentRoomIds = currentAllocations.map(a => a.room_id!.toString());
    } else {
      const currentAssignments = await CompanyAssignedRoom.find({
        company_id: compId,
        deleted_at: null,
      }).lean();
      currentRoomIds = currentAssignments.map(a => a.room_id.toString());
    }

    const newRoomIds = roomIds || [];
    const roomsToAssign = newRoomIds.filter((id) => !currentRoomIds.includes(id));
    const roomsToUnassign = currentRoomIds.filter((id) => !newRoomIds.includes(id));

    // Unassign removed rooms
    if (roomsToUnassign.length > 0) {
      const unassignRoomObjectIds = roomsToUnassign.map((id) => new mongoose.Types.ObjectId(id));
      
      // Soft-delete CompanyAssignedRoom records
      await CompanyAssignedRoom.updateMany(
        {
          company_id: compId,
          room_id: { $in: unassignRoomObjectIds },
          deleted_at: null,
        },
        { $set: { deleted_at: new Date() } }
      );

      // Clear company_assigned_room_id on Room collection
      await Room.updateMany(
        { _id: { $in: unassignRoomObjectIds } },
        { $set: { company_assigned_room_id: null } }
      );

      // Delete ContractAllocation records
      const allocationDeleteQuery: any = {
        room_id: { $in: unassignRoomObjectIds }
      };
      if (cId) {
        allocationDeleteQuery.contract_id = cId;
      } else {
        allocationDeleteQuery.company_id = compId;
      }
      await ContractAllocation.deleteMany(allocationDeleteQuery);
    }

    // Assign new rooms
    if (newRoomIds.length > 0) {
      const roomObjectIds = newRoomIds.map((id) => new mongoose.Types.ObjectId(id));
      const roomsDetails = await Room.find({ _id: { $in: roomObjectIds } });

      const assignedRoomDocIds: Record<string, mongoose.Types.ObjectId> = {};

      for (const room of roomsDetails) {
        let assignedDoc;
        try {
          assignedDoc = await CompanyAssignedRoom.findOneAndUpdate(
            {
              company_id: compId,
              contract_id: cId || null,
              room_id: room._id,
              deleted_at: null,
            },
            {
              $set: {
                client_id: room.client_id,
                camp_id: room.camp_id,
                zone_id: room.zone_id,
              },
            },
            { upsert: true, new: true }
          );
        } catch (error: any) {
          if (error.code === 11000 || error.message.includes("E11000")) {
            // Document was created concurrently, update the existing one without upserting
            assignedDoc = await CompanyAssignedRoom.findOneAndUpdate(
              {
                company_id: compId,
                contract_id: cId || null,
                room_id: room._id,
                deleted_at: null,
              },
              {
                $set: {
                  client_id: room.client_id,
                  camp_id: room.camp_id,
                  zone_id: room.zone_id,
                },
              },
              { new: true }
            );
          } else {
            throw error;
          }
        }
        if (assignedDoc) {
          assignedRoomDocIds[room._id.toString()] = assignedDoc._id;
        }
      }

      // Update rooms to point to company_assigned_room_id
      const roomBulkOps = roomsDetails.map((room) => {
        const assignedId = assignedRoomDocIds[room._id.toString()];
        return {
          updateOne: {
            filter: { _id: room._id },
            update: {
              $set: {
                company_assigned_room_id: assignedId || null,
              },
            },
          },
        };
      });

      if (roomBulkOps.length > 0) {
        await Room.bulkWrite(roomBulkOps);
      }

      // Also insert new ContractAllocation records for newly assigned rooms if a contract exists
      if (cId && contract && roomsToAssign.length > 0) {
        const newAllocations = roomsToAssign.map(roomId => ({
          client_id: contract.client_id,
          contract_id: cId,
          company_id: compId,
          allocation_type: "ROOM",
          room_id: new mongoose.Types.ObjectId(roomId),
          quantity: 1,
          rate: contract.agreed_rate ?? 0,
          start_date: contract.start_date,
          end_date: contract.end_date,
          status: "Active",
        }));
        await ContractAllocation.insertMany(newAllocations);
      }
    }

    // Activate the contract if it starts now or in the past and is in Draft/Approved status
    if (cId && contract) {
      if (contract.status === "Approved" || contract.status === "Draft") {
        const now = new Date();
        const start = new Date(contract.start_date);
        const resolvedStatus = start > now ? "Scheduled" : "Active";
        await Contract.findByIdAndUpdate(cId, { $set: { status: resolvedStatus } });
      }
    }

    // Sync room summaries for all affected rooms
    const affectedRooms = [...newRoomIds, ...roomsToUnassign];
    if (affectedRooms.length > 0) {
      const updatedRooms = await Room.find({
        _id: { $in: affectedRooms.map(id => new mongoose.Types.ObjectId(id)) }
      }).populate("camp_id").populate("zone_id").populate("building_id");
      for (const room of updatedRooms) {
        await syncRoomSummary(room);
      }
    }

    // Immutable activity log entry
    try {
      const UserActivityLogModel = (await import("./models/user-activity-log.model.js")).default;
      await UserActivityLogModel.create({
        performed_by: "System",
        action: "Room Allocation Updated",
        module: "Contract",
        timestamp: new Date(),
        previous_state: { contract_id: contractId || cId?.toString(), rooms: currentRoomIds },
        new_state: { contract_id: contractId || cId?.toString(), rooms: newRoomIds },
      });
    } catch (logErr) {
      console.error("Failed to write activity log for room allocation:", logErr);
    }
  }

  async unassignEntities(
    companyId: string,
    tenantIds: string[],
    roomIds: string[],
    contractId?: string
  ): Promise<void> {
    if (tenantIds && tenantIds.length > 0) {
      await Tenant.updateMany(
        { _id: { $in: tenantIds.map(id => new mongoose.Types.ObjectId(id)) } },
        { $set: { company_id: null, type: "individual", company_name: "" } }
      );
    }
    if (roomIds && roomIds.length > 0) {
      const compId = new mongoose.Types.ObjectId(companyId);
      const roomObjectIds = roomIds.map(id => new mongoose.Types.ObjectId(id));

      if (contractId) {
        const cId = new mongoose.Types.ObjectId(contractId);
        await ContractAllocation.deleteMany({
          contract_id: cId,
          room_id: { $in: roomObjectIds }
        });
        await CompanyAssignedRoom.updateMany(
          { contract_id: cId, room_id: { $in: roomObjectIds } },
          { $set: { deleted_at: new Date() } }
        );
      } else {
        const assignedRooms = await CompanyAssignedRoom.find({
          company_id: compId,
          room_id: { $in: roomObjectIds },
          deleted_at: null,
        }).lean();

        for (const ar of assignedRooms) {
          if (ar.contract_id) {
            await ContractAllocation.deleteMany({
              contract_id: ar.contract_id,
              room_id: ar.room_id
            });
          }
        }
      }

      // Soft-delete assigned rooms from the company_assigned_rooms collection
      await CompanyAssignedRoom.updateMany(
        {
          company_id: compId,
          room_id: { $in: roomObjectIds },
          deleted_at: null,
        },
        { $set: { deleted_at: new Date() } }
      );

      // Clear company_assigned_room_id on rooms
      await Room.updateMany(
        { _id: { $in: roomObjectIds } },
        { $set: { company_assigned_room_id: null } }
      );

      // Sync room summaries
      const updatedRooms = await Room.find({ _id: { $in: roomObjectIds } })
        .populate("camp_id").populate("zone_id").populate("building_id");
      for (const room of updatedRooms) {
        await syncRoomSummary(room);
      }
    }
  }

  // ── Company Summary ────────────────────────────────────────────────
  async getCompanySummary(
    companyId: string,
    clientId: string
  ): Promise<CompanySummary> {
    const cId = new mongoose.Types.ObjectId(companyId);
    const clId = new mongoose.Types.ObjectId(clientId);

    const [company, activeTenants, activeContracts, roomAllocs, bedAllocs] = await Promise.all([
      Company.findOne({ _id: cId, client_id: clId, deleted_at: null }).lean(),
      Tenant.countDocuments({ company_id: cId, client_id: clId, allocation_status: true, deleted_at: null }),
      Contract.countDocuments({ company_id: cId, client_id: clId, status: { $in: ["Active", "Expiring Soon"] }, deleted_at: null }),
      ContractAllocation.countDocuments({ company_id: cId, client_id: clId, allocation_type: "ROOM", status: "Active" }),
      ContractAllocation.countDocuments({ company_id: cId, client_id: clId, allocation_type: "BED", status: "Active" }),
    ]);

    if (!company) throw new AppError("Company not found", 404);

    const complianceStatus =
      (company as any).compliance_required && !(company as any).last_review_date
        ? "Review Required"
        : (company as any).compliance_required
          ? "Compliant"
          : "Non-Compliant";

    return {
      company_id: companyId,
      company_name: (company as any).company_name,
      active_tenants: activeTenants,
      active_contracts: activeContracts,
      active_room_allocations: roomAllocs,
      active_bed_allocations: bedAllocs,
      compliance_status: complianceStatus as any,
    };
  }

  async getCompanyAssignedRooms(
    companyId: string,
    clientId: string,
    filters: { contract_id?: string | undefined }
  ): Promise<any[]> {
    const cOid = new mongoose.Types.ObjectId(companyId);
    const clOid = new mongoose.Types.ObjectId(clientId);
    const hasContractFilter = !!(filters.contract_id && mongoose.Types.ObjectId.isValid(filters.contract_id));
    const filterContractOid = hasContractFilter ? new mongoose.Types.ObjectId(filters.contract_id!) : null;

    // --- Primary source: ContractAllocation (Active ROOM entries) ---
    const matchQuery: any = {
      company_id: cOid,
      allocation_type: "ROOM",
      status: "Active",
      client_id: clOid,
    };
    if (filterContractOid) {
      matchQuery.contract_id = filterContractOid;
    }

    // --- Legacy source: company_assigned_rooms (not deleted) ---
    const legacyMatchQuery: any = {
      company_id: cOid,
      client_id: clOid,
      deleted_at: null,
    };
    if (filterContractOid) {
      legacyMatchQuery.contract_id = filterContractOid;
    }

    const assignments = await ContractAllocation.aggregate([
      { $match: matchQuery },
      {
        $project: {
          _id: 1,
          client_id: 1,
          company_id: 1,
          contract_id: 1,
          room_id: 1,
          camp_id: 1,
          zone_id: 1,
          is_legacy: { $literal: false }
        }
      },
      {
        $unionWith: {
          coll: "company_assigned_rooms",
          pipeline: [
            { $match: legacyMatchQuery },
            {
              $project: {
                _id: 1,
                client_id: 1,
                company_id: 1,
                contract_id: 1,
                room_id: 1,
                camp_id: 1,
                zone_id: 1,
                is_legacy: { $literal: true }
              }
            }
          ]
        }
      },
      // Deduplicate by room_id inside MongoDB — prefer non-legacy (ContractAllocation) over legacy
      {
        $sort: { is_legacy: 1 }
      },
      {
        $group: {
          _id: "$room_id",
          doc: { $first: "$$ROOT" }
        }
      },
      { $replaceRoot: { newRoot: "$doc" } },
      {
        $lookup: {
          from: "building_rooms",
          localField: "room_id",
          foreignField: "_id",
          as: "room"
        }
      },
      { $unwind: "$room" },
      {
        $lookup: {
          from: "statuses",
          let: { statusId: "$room.room_status" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$statusId"] },
                    { $eq: ["$deleted_at", null] },
                  ],
                },
              },
            },
          ],
          as: "room_status_data",
        },
      },
      {
        $unwind: {
          path: "$room_status_data",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "companies",
          localField: "company_id",
          foreignField: "_id",
          as: "company_data"
        }
      },
      {
        $unwind: {
          path: "$company_data",
          preserveNullAndEmptyArrays: true,
        }
      },
      {
        $lookup: {
          from: "contracts",
          localField: "contract_id",
          foreignField: "_id",
          as: "contract_data"
        }
      },
      {
        $unwind: {
          path: "$contract_data",
          preserveNullAndEmptyArrays: true,
        }
      },
      // ── Filter: when contract_id is given only show rows for that contract;
      //    otherwise only show rows whose contract is still active/approved
      {
        $match: hasContractFilter
          ? {
              "contract_data._id": filterContractOid,
              "contract_data.deleted_at": null,
            }
          : {
              $or: [
                { contract_id: null },
                {
                  $and: [
                    { "contract_data.deleted_at": null },
                    {
                      $or: [
                        { "contract_data.status": { $in: ["Active", "Approved", "Expiring Soon", "Suspended"] } },
                        {
                          $and: [
                            { "contract_data.status": "Scheduled" },
                            { "contract_data.start_date": { $lte: new Date() } },
                            { "contract_data.end_date": { $gte: new Date() } },
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
      },
      {
        $lookup: {
          from: "beds",
          localField: "room_id",
          foreignField: "room_id",
          pipeline: [
            { $match: { deleted_at: null, status: "occupied" } },
            {
              $lookup: {
                from: "user_registers",
                localField: "tenant_id",
                foreignField: "_id",
                pipeline: [
                  { $match: { deleted_at: null } },
                  { $project: { _id: 1, nationality: 1, country_state: 1 } }
                ],
                as: "tenant"
              }
            },
            { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 0,
                nationality: "$tenant.nationality",
                country_state: "$tenant.country_state"
              }
            }
          ],
          as: "beds_data"
        }
      },
      {
        $project: {
          _id: "$room._id",
          id: { $toString: "$room._id" },
          client_id: { $toString: "$room.client_id" },
          company_assigned_room_id: { $toString: "$_id" },
          company_id: {
            $cond: {
              if: { $gt: ["$company_data._id", null] },
              then: {
                id: { $toString: "$company_data._id" },
                company_name: "$company_data.company_name"
              },
              else: null
            }
          },
          contract_id: {
            $cond: {
              if: { $gt: ["$contract_data._id", null] },
              then: {
                id: { $toString: "$contract_data._id" },
                contract_name: "$contract_data.contract_name",
                status: "$contract_data.status"
              },
              else: null
            }
          },
          camp_id: { $toString: "$room.camp_id" },
          zone_id: { $toString: "$room.zone_id" },
          building_id: { $toString: "$room.building_id" },
          floor: "$room.floor",
          room_number: "$room.room_number",
          space: "$room.space",
          available_space: "$room.available_space",
          occupancy: "$room.occupancy",
          status: {
            $cond: {
              if: { $eq: ["$room.status", 0] },
              then: 0,
              else: {
                $cond: {
                  if: { $lte: ["$room.available_space", 0] },
                  then: 2,
                  else: 1
                }
              }
            }
          },
          createdAt: "$room.createdAt",
          updatedAt: "$room.updatedAt",
          room_status: {
            id: { $toString: "$room_status_data._id" },
            name: "$room_status_data.name",
            slug: "$room_status_data.slug",
          },
          beds_data: 1,
        }
      }
    ]);

    const seenRoomIds = new Set<string>();
    const uniqueItems: any[] = [];

    for (const item of assignments) {
      const roomIdStr = item.id || (item._id ? item._id.toString() : "");
      if (!roomIdStr || seenRoomIds.has(roomIdStr)) {
        continue;
      }
      seenRoomIds.add(roomIdStr);

      const nationalityCounts: Record<string, number> = {};
      const stateCounts: Record<string, number> = {};
      const originalNationalityNames: Record<string, string> = {};
      const originalStateNames: Record<string, string> = {};

      if (item.beds_data && Array.isArray(item.beds_data)) {
        for (const bed of item.beds_data) {
          if (bed.nationality) {
            const nat = bed.nationality.trim();
            if (nat) {
              const lowerNat = nat.toLowerCase();
              nationalityCounts[lowerNat] = (nationalityCounts[lowerNat] || 0) + 1;
              if (!originalNationalityNames[lowerNat]) {
                originalNationalityNames[lowerNat] = nat;
              }
            }
          }
          if (bed.country_state) {
            const state = bed.country_state.trim();
            if (state) {
              const lowerState = state.toLowerCase();
              stateCounts[lowerState] = (stateCounts[lowerState] || 0) + 1;
              if (!originalStateNames[lowerState]) {
                originalStateNames[lowerState] = state;
              }
            }
          }
        }
      }

      const nationality_summary = Object.entries(nationalityCounts)
        .map(([lowerNat, count]) => `${originalNationalityNames[lowerNat]}:${count}`);

      const country_state_summary = Object.entries(stateCounts)
        .map(([lowerState, count]) => `${originalStateNames[lowerState]}:${count}`);

      const { beds_data, ...rest } = item;

      uniqueItems.push({
        ...rest,
        nationality_summary: nationality_summary.length > 0 ? nationality_summary : undefined,
        country_state_summary: country_state_summary.length > 0 ? country_state_summary : undefined,
      });
    }

    return uniqueItems;
  }
}
