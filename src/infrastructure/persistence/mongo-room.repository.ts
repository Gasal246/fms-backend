import mongoose from "mongoose";
import type { RoomRepository } from "../../domain/repositories/room.repository.interface.js";
import type { CreateRoomRequest, UpdateRoomRequest, RoomResponse, PaginatedRoomResponse, RoomFilter } from "../../domain/types/room.types.js";
import Room, { type IBuildingRooms } from "./models/room.model.js";
import Bed from "./models/bed.model.js";
import UserRegister from "./models/tenant.model.js";
import CompanyAssignedRoom from "./models/company-assigned-room.model.js";
import { logger } from "../../shared/logger/logger.js";
import { syncRoomSummary, deleteRoomSummary } from "./helpers/room-summary.helper.js";

export class MongoRoomRepository implements RoomRepository {
  async create(data: CreateRoomRequest): Promise<IBuildingRooms> {
    const payload: any = { ...data };
    // Sync numeric status with available space
    const available = payload.available_space ?? payload.occupancy;
    payload.status = available === 0 ? 2 : 1;
    const room = new Room(payload);
    const savedRoom = await room.save();
    const populated = await Room.findById(savedRoom._id)
      .populate("camp_id")
      .populate("zone_id")
      .populate("building_id");
    await syncRoomSummary(populated || savedRoom);
    return savedRoom;
  }

  async findById(id: string): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid room ID");
    }
    const room = await Room.findById(id)
      .populate("building_id")
      .populate("zone_id")
      .populate("camp_id")
      .populate("room_status")
      .lean();

    if (!room) return null;

    const { default: ContractAllocation } = await import("./models/contract-allocation.model.js");
    const activeAllocation = await ContractAllocation.findOne({
      room_id: room._id,
      status: "Active",
      allocation_type: "ROOM",
    }).populate("company_id").populate("contract_id").lean();

    const CompanyAssignedRoomModel = mongoose.model("company_assigned_rooms");
    const assigned = (room as any).company_assigned_room_id
      ? await CompanyAssignedRoomModel.findOne({
          _id: (room as any).company_assigned_room_id,
          deleted_at: null,
        }).populate("company_id").populate("contract_id").lean() as any
      : null;

    let legacyContractActive = false;
    if (assigned?.contract_id) {
      const ContractModel = mongoose.model("contracts");
      const contractObj = await ContractModel.findOne({
        _id: assigned.contract_id._id || assigned.contract_id,
        status: { $in: ["Active", "Approved", "Expiring Soon", "Suspended"] },
        deleted_at: null,
      }).lean();
      if (contractObj) {
        legacyContractActive = true;
      }
    }

    const mappedRoom = {
      ...room,
      company_id: activeAllocation?.company_id || (assigned && (!assigned.contract_id || legacyContractActive) ? assigned.company_id : null) || null,
      contract_id: activeAllocation?.contract_id || (assigned && (!assigned.contract_id || legacyContractActive) ? assigned.contract_id : null) || null,
    };
    const bedQuery: any = {
      room_id: new mongoose.Types.ObjectId(id),
      deleted_at: null,
      status: "occupied"
    };
    const beds = await Bed.find(bedQuery).populate({
      path: "tenant_id",
      match: { deleted_at: null },
      select: "nationality country_state"
    }).lean();

    const nationalityCounts: Record<string, number> = {};
    const stateCounts: Record<string, number> = {};
    const originalNationalityNames: Record<string, string> = {};
    const originalStateNames: Record<string, string> = {};

    for (const bed of beds) {
      const tenant: any = bed.tenant_id;
      if (tenant) {
        if (tenant.nationality) {
          const nat = tenant.nationality.trim();
          if (nat) {
            const lowerNat = nat.toLowerCase();
            nationalityCounts[lowerNat] = (nationalityCounts[lowerNat] || 0) + 1;
            if (!originalNationalityNames[lowerNat]) {
              originalNationalityNames[lowerNat] = nat;
            }
          }
        }
        if (tenant.country_state) {
          const state = tenant.country_state.trim();
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

    return {
      ...mappedRoom,
      id: room._id.toString(),
      nationality_summary: nationality_summary.length > 0 ? nationality_summary : undefined,
      country_state_summary: country_state_summary.length > 0 ? country_state_summary : undefined,
    };
  }

  async findByRoomNumber(room_number: string): Promise<IBuildingRooms | null> {
    return Room.findOne({ room_number });
  }

  async findAll(
    page: number,
    limit: number,
    filters?: RoomFilter,
    client_id?: string
  ): Promise<PaginatedRoomResponse> {
    const skip = (page - 1) * limit;
    const matchQuery: any = {
      client_id: new mongoose.Types.ObjectId(client_id),
    };

    if (filters) {

      if (filters.company_id) {
        if (filters.company_id === 'unassigned') {
          const allocatedRoomIds = await CompanyAssignedRoom.distinct("room_id", {
            deleted_at: null,
            client_id: new mongoose.Types.ObjectId(client_id)
          });
          matchQuery._id = { $nin: allocatedRoomIds };
        } else if (filters.company_id !== 'all' && mongoose.Types.ObjectId.isValid(filters.company_id)) {
          const allocatedRoomIds = await CompanyAssignedRoom.distinct("room_id", {
            company_id: new mongoose.Types.ObjectId(filters.company_id),
            deleted_at: null,
            client_id: new mongoose.Types.ObjectId(client_id)
          });
          matchQuery._id = { $in: allocatedRoomIds };
        }
      }

      if (filters.contract_id) {
        if (filters.contract_id === 'unassigned') {
          const allocatedRoomIds = await CompanyAssignedRoom.distinct("room_id", {
            deleted_at: null,
            client_id: new mongoose.Types.ObjectId(client_id)
          });
          matchQuery._id = { $nin: allocatedRoomIds };
        } else if (filters.contract_id !== 'all' && mongoose.Types.ObjectId.isValid(filters.contract_id)) {
          const allocatedRoomIds = await CompanyAssignedRoom.distinct("room_id", {
            contract_id: new mongoose.Types.ObjectId(filters.contract_id),
            deleted_at: null,
            client_id: new mongoose.Types.ObjectId(client_id)
          });
          matchQuery._id = { $in: allocatedRoomIds };
        }
      }

      if (filters.camp_id)
        matchQuery.camp_id = new mongoose.Types.ObjectId(filters.camp_id);

      if (filters.zone_id)
        matchQuery.zone_id = new mongoose.Types.ObjectId(filters.zone_id);

      if (filters.building_id)
        matchQuery.building_id = new mongoose.Types.ObjectId(filters.building_id);

      if (filters.room_id && mongoose.Types.ObjectId.isValid(filters.room_id)) {
        matchQuery._id = new mongoose.Types.ObjectId(filters.room_id);
      }

      if (filters.room_number) {
        matchQuery.room_number = {
          $regex: `^${filters.room_number}`,
          $options: "i",
        };
      }

      if (filters.floor !== undefined)
        matchQuery.floor = filters.floor;

      if (filters.status !== undefined)
        matchQuery.status = Number(filters.status);

      // ✅ NEW: room_status filter
      if (filters.room_status) {
        matchQuery.room_status = new mongoose.Types.ObjectId(
          filters.room_status
        );
      }

      if ((filters.assigned_camps && filters.assigned_camps.length > 0) || (filters.assigned_zones && filters.assigned_zones.length > 0)) {
        const orConditions: any[] = [];
        if (filters.assigned_camps && filters.assigned_camps.length > 0) {
          orConditions.push({ camp_id: { $in: filters.assigned_camps.map(id => new mongoose.Types.ObjectId(id)) } });
        }
        if (filters.assigned_zones && filters.assigned_zones.length > 0) {
          orConditions.push({ zone_id: { $in: filters.assigned_zones.map(id => new mongoose.Types.ObjectId(id)) } });
        }
        matchQuery.$or = orConditions;
      }

      // Nationality and Country State filtering
      if (filters.nationality || filters.country_state) {
        const tenantQuery: any = {
          client_id: new mongoose.Types.ObjectId(client_id),
          deleted_at: null,
        };
        if (filters.nationality) {
          tenantQuery.nationality = { $regex: filters.nationality, $options: "i" };
        }
        if (filters.country_state) {
          tenantQuery.country_state = { $regex: filters.country_state, $options: "i" };
        }

        const matchingTenants = await UserRegister.find(tenantQuery).select("_id").lean();
        const tenantIds = matchingTenants.map(t => t._id);

        if (tenantIds.length === 0) {
          matchQuery._id = { $in: [] };
        } else {
          const bedQuery: any = {
            client_id: new mongoose.Types.ObjectId(client_id),
            tenant_id: { $in: tenantIds },
            status: "occupied",
            deleted_at: null
          };
          const beds = await Bed.find(bedQuery).select("room_id").lean();

          const roomIds = beds.map(b => b.room_id).filter(Boolean);
          matchQuery._id = { $in: roomIds.map(id => new mongoose.Types.ObjectId(id as any)) };
        }
      }
    }

    const aggregatePipeline: any[] = [
      { $match: matchQuery }
    ];

    if (filters?.nationality) {
      aggregatePipeline.push(
        {
          $lookup: {
            from: "beds",
            localField: "_id",
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
                    { $project: { _id: 0, nationality: 1 } }
                  ],
                  as: "tenant"
                }
              },
              { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  _id: 0,
                  nationality: "$tenant.nationality"
                }
              }
            ],
            as: "occupied_beds_info"
          }
        },
        {
          $addFields: {
            is_only_filtered_nationality: {
              $cond: {
                if: { $eq: [{ $size: "$occupied_beds_info" }, 0] },
                then: 0,
                else: {
                  $cond: {
                    if: {
                      $allElementsTrue: {
                        $map: {
                          input: "$occupied_beds_info",
                          as: "bed",
                          in: {
                            $eq: [
                              { $toLower: { $trim: { input: { $ifNull: ["$$bed.nationality", ""] } } } },
                              filters.nationality.trim().toLowerCase()
                            ]
                          }
                        }
                      }
                    },
                    then: 1,
                    else: 0
                  }
                }
              }
            }
          }
        },
        {
          $sort: {
            is_only_filtered_nationality: -1,
            available_space: -1
          }
        }
      );
    }

    aggregatePipeline.push(
      {
        $lookup: {
          from: "statuses",
          let: { statusId: "$room_status" },
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
      },      {
        $lookup: {
          from: "contract_allocations",
          let: { roomId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$room_id", "$$roomId"] },
                    { $eq: ["$allocation_type", "ROOM"] },
                    { $eq: ["$status", "Active"] }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "active_allocation"
        }
      },
      {
        $unwind: {
          path: "$active_allocation",
          preserveNullAndEmptyArrays: true,
        }
      },
      {
        $lookup: {
          from: "company_assigned_rooms",
          let: { id: "$company_assigned_room_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$id"] },
                    { $eq: ["$deleted_at", null] }
                  ]
                }
              }
            }
          ],
          as: "assigned_data"
        }
      },
      {
        $unwind: {
          path: "$assigned_data",
          preserveNullAndEmptyArrays: true,
        }
      },
      {
        $lookup: {
          from: "company_assigned_rooms",
          localField: "company_assigned_room_id",
          foreignField: "_id",
          as: "assigned_data"
        }
      },
      {
        $unwind: {
          path: "$assigned_data",
          preserveNullAndEmptyArrays: true,
        }
      },
      {
        $addFields: {
          effective_company_id: "$assigned_data.company_id",
          effective_contract_id: "$assigned_data.contract_id",
          effective_assigned_room_id: "$assigned_data._id"
        }
      },
      {
        $lookup: {
          from: "companies",
          localField: "effective_company_id",
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
          let: { contract_id: "$effective_contract_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$contract_id"] },
                    {
                      $or: [
                        { $eq: ["$status", "Active"] },
                        { $eq: ["$status", "Expiring Soon"] }
                      ]
                    },
                    { $eq: ["$deleted_at", null] },
                  ]
                }
              }
            }
          ],
          as: "contract_data"
        }
      },
      {
        $unwind: {
          path: "$contract_data",
          preserveNullAndEmptyArrays: true,
        }
      },
      {
        $facet: {
          totalCount: [{ $count: "count" }],
          items: [
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: "beds",
                localField: "_id",
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
                _id: 0,
                id: { $toString: "$_id" },
                client_id: { $toString: "$client_id" },
                company_assigned_room_id: { $toString: "$effective_assigned_room_id" },
                company_id: {
                  $cond: {
                    if: {
                      $and: [
                        { $gt: ["$company_data._id", null] },
                        {
                          $or: [
                            { $eq: ["$effective_contract_id", null] },
                            { $gt: ["$contract_data._id", null] }
                          ]
                        }
                      ]
                    },
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
                      contract_name: "$contract_data.contract_name"
                    },
                    else: null
                  }
                },
                camp_id: { $toString: "$camp_id" },
                zone_id: { $toString: "$zone_id" },
                building_id: { $toString: "$building_id" },
                floor: 1,
                room_number: 1,
                space: 1,
                available_space: 1,
                occupancy: 1,
                status: {
                  $cond: {
                    if: { $eq: ["$status", 0] },
                    then: 0,
                    else: {
                      $cond: {
                        if: { $lte: ["$available_space", 0] },
                        then: 2,
                        else: 1
                      }
                    }
                  }
                },
                createdAt: 1,
                updatedAt: 1,
                room_status: {
                  id: { $toString: "$room_status_data._id" },
                  name: "$room_status_data.name",
                  slug: "$room_status_data.slug",
                },
                beds_data: 1,
              },
            },
          ],
        },
      }
    );

    const [results] = await Room.aggregate(aggregatePipeline);
    console.log("result", results);

    const rawItems = results?.items || [];
    const total = results?.totalCount?.[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    const items = rawItems.map((item: any) => {
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

      return {
        ...rest,
        nationality_summary: nationality_summary.length > 0 ? nationality_summary : undefined,
        country_state_summary: country_state_summary.length > 0 ? country_state_summary : undefined,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async update(id: string, data: UpdateRoomRequest): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid room ID");
    }

    const { occupancy, bed_id, ...otherData } = data;
    const payload: any = { ...otherData };

    if (payload.contract_id && mongoose.Types.ObjectId.isValid(payload.contract_id)) {
      const { default: Contract } = await import("./models/contract.model.js");
      await Contract.findByIdAndUpdate(payload.contract_id, { $set: { status: "Active" } });
    } else if (payload.company_id && mongoose.Types.ObjectId.isValid(payload.company_id)) {
      const { default: Contract } = await import("./models/contract.model.js");
      const approvedContract = await Contract.findOne({
        company_id: new mongoose.Types.ObjectId(payload.company_id),
        status: "Approved",
        deleted_at: null,
      }).select("_id").lean();
      if (approvedContract) {
        payload.contract_id = approvedContract._id;
        await Contract.findByIdAndUpdate(approvedContract._id, { $set: { status: "Active" } });
      }
    }

    const existingRoom = await Room.findById(id);

    if (!existingRoom) {
      return null;
    }

    // Handle company/contract update or unassignment via company_assigned_room_id
    if (payload.company_id === null || payload.contract_id === null) {
      if (existingRoom.company_assigned_room_id) {
        await CompanyAssignedRoom.findByIdAndUpdate(existingRoom.company_assigned_room_id, { $set: { deleted_at: new Date() } });
      }
      payload.company_assigned_room_id = null;
    } else if (payload.company_id || payload.contract_id) {
      const existingAssignment = existingRoom.company_assigned_room_id
        ? await CompanyAssignedRoom.findOne({ _id: existingRoom.company_assigned_room_id, deleted_at: null })
        : null;

      const companyId = payload.company_id || existingAssignment?.company_id;
      const contractId = payload.contract_id || existingAssignment?.contract_id;

      if (companyId) {
        if (existingRoom.company_assigned_room_id) {
          await CompanyAssignedRoom.findByIdAndUpdate(existingRoom.company_assigned_room_id, { $set: { deleted_at: new Date() } });
        }

        let assignedDoc;
        try {
          assignedDoc = await CompanyAssignedRoom.findOneAndUpdate(
            {
              company_id: new mongoose.Types.ObjectId(companyId),
              contract_id: contractId ? new mongoose.Types.ObjectId(contractId) : null,
              room_id: existingRoom._id,
              deleted_at: null,
            },
            {
              $set: {
                client_id: existingRoom.client_id,
                camp_id: existingRoom.camp_id,
                zone_id: existingRoom.zone_id,
              },
            },
            { upsert: true, new: true }
          );
        } catch (error: any) {
          if (error.code === 11000 || error.message.includes("E11000")) {
            // Document was created concurrently, update the existing one without upserting
            assignedDoc = await CompanyAssignedRoom.findOneAndUpdate(
              {
                company_id: new mongoose.Types.ObjectId(companyId),
                contract_id: contractId ? new mongoose.Types.ObjectId(contractId) : null,
                room_id: existingRoom._id,
                deleted_at: null,
              },
              {
                $set: {
                  client_id: existingRoom.client_id,
                  camp_id: existingRoom.camp_id,
                  zone_id: existingRoom.zone_id,
                },
              },
              { new: true }
            );
          } else {
            throw error;
          }
        }
        if (assignedDoc) {
          payload.company_assigned_room_id = assignedDoc._id;
        }
      }
    }

    // Clean payload of legacy fields
    delete payload.company_id;
    delete payload.contract_id;

    const newStatus =
      payload.status !== undefined ? payload.status : existingRoom.status;

    // ---------------------------
    // Occupancy update logic
    // ---------------------------
    if (occupancy !== undefined) {
      if (occupancy === -1) {
        const updatedRoom = await Room.findByIdAndUpdate(
          id,
          {
            $set: payload,
            $inc: { occupancy: -1, available_space: -1 }
          },
          { returnDocument: "after" }
        )
          .populate("camp_id")
          .populate("zone_id")
          .populate("building_id");

        if (!updatedRoom) return null;

        // Apply new status logic after decrement
        if (updatedRoom.status !== 0) {
          if (updatedRoom.available_space === 0) {
            updatedRoom.status = 2; // Occupied
          } else {
            updatedRoom.status = 1; // Available
          }
        }

        await updatedRoom.save();
        await syncRoomSummary(updatedRoom);
        return updatedRoom;
      } else {
        const delta = occupancy - existingRoom.occupancy;

        payload.occupancy = occupancy;
        payload.available_space =
          (existingRoom.available_space || 0) + delta;
      }
    }

    // ---------------------------
    // Final values
    // ---------------------------
    const finalAvailable =
      payload.available_space !== undefined
        ? payload.available_space
        : existingRoom.available_space;

    // ---------------------------
    // Your current logic
    // if status = 1 and available_space = 0 => status = 2
    // else if status != 0 => status = 1
    // ---------------------------
    if (newStatus !== 0) {
      if (Number(finalAvailable) === 0) {
        payload.status = 2;
      } else {
        payload.status = 1;
      }
    }

    // ---------------------------
    // Update associated beds if room number changes
    // ---------------------------
    if (payload.room_number && existingRoom.room_number && payload.room_number !== existingRoom.room_number) {
      const oldRoomNumber = existingRoom.room_number;
      const newRoomNumber = payload.room_number;

      const beds = await Bed.find({ room_id: id as any });
      const bulkOps = beds.map(bed => {
        if (bed.bed_number && bed.bed_number.startsWith(oldRoomNumber)) {
          // Only replace the first occurrence (which is the prefix since it startsWith oldRoomNumber)
          const newBedNumber = bed.bed_number.replace(oldRoomNumber, newRoomNumber);
          return {
            updateOne: {
              filter: { _id: bed._id },
              update: { $set: { bed_number: newBedNumber } }
            }
          };
        }
        return null;
      }).filter(Boolean);

      if (bulkOps.length > 0) {
        await Bed.bulkWrite(bulkOps as any);
      }
    }

    const updated = await Room.findByIdAndUpdate(id, payload, {
      returnDocument: "after"
    })
      .populate("camp_id")
      .populate("zone_id")
      .populate("building_id")
      .populate({
        path: "company_assigned_room_id",
        populate: [
          { path: "company_id" },
          { path: "contract_id" }
        ]
      })
      .lean();
    if (updated) {
      await syncRoomSummary(updated as any);
      const assigned = updated.company_assigned_room_id as any;
      return {
        ...updated,
        company_id: assigned?.company_id || null,
        contract_id: assigned?.contract_id || null,
      };
    }
    return null;
  }

  async delete(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid room ID");
    }
    await Room.findByIdAndDelete(id);
    await deleteRoomSummary(id);
  }

  async incrementAvailableSpace(id: string): Promise<void> {
    const room = await Room.findByIdAndUpdate(id, { $inc: { available_space: 1 } }, { returnDocument: 'after' })
      .populate("camp_id")
      .populate("zone_id")
      .populate("building_id");
    let finalRoom = room;
    if (room && room.status !== 0) {
      const newStatus = 1; // Always at least 1 available if we just incremented
      const updatePayload: any = { status: newStatus };
      finalRoom = await Room.findByIdAndUpdate(id, updatePayload, { returnDocument: 'after' })
        .populate("camp_id")
        .populate("zone_id")
        .populate("building_id");
    }
    if (finalRoom) {
      await syncRoomSummary(finalRoom);
    }
  }

  async decrementAvailableSpace(id: string): Promise<void> {
    const room = await Room.findByIdAndUpdate(id, { $inc: { available_space: -1 } }, { returnDocument: 'after' })
      .populate("camp_id")
      .populate("zone_id")
      .populate("building_id");
    let finalRoom = room;
    if (room && room.status !== 0 && room.available_space === 0) {
      finalRoom = await Room.findByIdAndUpdate(id, { status: 2 }, { returnDocument: 'after' })
        .populate("camp_id")
        .populate("zone_id")
        .populate("building_id");
    }
    if (finalRoom) {
      await syncRoomSummary(finalRoom);
    }
  }
}
