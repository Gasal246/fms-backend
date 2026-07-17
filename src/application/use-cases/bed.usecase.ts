import mongoose from "mongoose";
import type { BedRepository, BedService } from "../../domain/repositories/bed.repository.interface.js";
import type { BedHistoryRepository } from "../../domain/repositories/bed-history.repository.interface.js";
import type { RoomRepository } from "../../domain/repositories/room.repository.interface.js";
import type { TenantRepository } from "../../domain/repositories/tenant.repository.interface.js";
import type { CreateBedRequest, UpdateBedRequest, PaginatedBedResponse, BedFilter, BulkAllocateRequest } from "../../domain/types/bed.types.js";
import { AppError } from "../../shared/utils/AppError.js";
import { logger } from "../../shared/logger/logger.js";
import DocumentModel from "../../infrastructure/persistence/models/document.model.js";
import DocumentFileModel from "../../infrastructure/persistence/models/document-file.model.js";

// Import contract schemas directly for verification
import Contract from "../../infrastructure/persistence/models/contract.model.js";
import CompanyAssignedRoom from "../../infrastructure/persistence/models/company-assigned-room.model.js";
import Tenant from "../../infrastructure/persistence/models/tenant.model.js";
import Room from "../../infrastructure/persistence/models/room.model.js";
import Bed from "../../infrastructure/persistence/models/bed.model.js";
import BedHistory from "../../infrastructure/persistence/models/bed-history.model.js";
import { syncRoomSummary } from "../../infrastructure/persistence/helpers/room-summary.helper.js";

async function validatePassportForAllocation(tenantId: string) {
  const passportDoc = await DocumentModel.findOne({ tenant_id: tenantId, document_type: 'Passport' });
  if (!passportDoc) {
    throw new AppError("Passport document must be uploaded before room allocation.", 400);
  }
  if (passportDoc.verification_status !== 'Verified') {
    throw new AppError("Passport document must be verified before room allocation.", 400);
  }
  const passportFile = await DocumentFileModel.findOne({ document_id: passportDoc._id, status: 'Active' });
  if (!passportFile || !passportFile.storage_path) {
    throw new AppError("Passport document must be uploaded before room allocation.", 400);
  }
}

async function validateContractAndAllocationForBed(
  tenantId: string,
  roomId: string,
  bedId?: string,
  adminOverride?: boolean
) {
  if (adminOverride) {
    logger.info(`Admin override bypassed contract check for tenant ${tenantId}`);
    return;
  }

  const tenant = await Tenant.findById(tenantId).lean();
  if (!tenant) {
    throw new AppError("Tenant not found", 404);
  }

  const room = await Room.findById(roomId).lean();
  if (!room) {
    throw new AppError("Room not found", 404);
  }

  let roomContractId: any = null;
  let roomCompanyId: any = null;

  const activeAllocation = await CompanyAssignedRoom.findOne({
    room_id: room._id,
    status: "Active",
    allocation_type: "ROOM",
  }).lean();

  if (activeAllocation) {
    roomContractId = activeAllocation.contract_id || null;
    roomCompanyId = activeAllocation.company_id || null;
  } else if ((room as any).company_assigned_room_id) {
    const assigned = await CompanyAssignedRoom.findOne({ _id: (room as any).company_assigned_room_id, deleted_at: null }).lean();
    if (assigned) {
      let legacyContractActive = false;
      if (assigned.contract_id) {
        const ContractModel = mongoose.model("contracts");
        const contractObj = await ContractModel.findOne({
          _id: assigned.contract_id,
          status: { $in: ["Active", "Approved", "Expiring Soon", "Suspended"] },
          deleted_at: null,
        }).lean();
        if (contractObj) {
          legacyContractActive = true;
        }
      }
      if (!assigned.contract_id || legacyContractActive) {
        roomContractId = assigned.contract_id || null;
        roomCompanyId = assigned.company_id || null;
      }
    }
  }

  const contractIdToUse = roomContractId || tenant.contract_id;

  // If neither tenant nor room has a contract, check if room is under a company
  if (!contractIdToUse) {
    if (roomCompanyId) {
      throw new AppError("Neither the Tenant nor the Room has a linked contract before bed assignment.", 400);
    } else {
      return; // Room is not under a company, so contract is not mandatory
    }
  }

  const contract = await Contract.findById(contractIdToUse).lean();
  if (!contract) {
    throw new AppError("Linked contract was not found", 400);
  }

  // Check if contract is Active
  const today = new Date();
  if (contract.status !== "Active" && contract.status !== "Expiring Soon") {
    throw new AppError(`Tenant's contract status is '${contract.status}', cannot assign bed.`, 400);
  }
  if (contract.start_date > today || contract.end_date < today) {
    throw new AppError("Tenant's contract is not within validity period.", 400);
  }



  const activeAllocations = await CompanyAssignedRoom.find({
      contract_id: contract._id,
      status: "Active",
    }).lean();

    if (activeAllocations.length > 0) {
      const isScopeMatch = activeAllocations.some((alloc: any) => {
        if (alloc.site_id && room.camp_id) {
          return alloc.site_id.toString() === room.camp_id.toString();
        }
        if (alloc.building_id && room.building_id) {
          return alloc.building_id.toString() === room.building_id.toString();
        }
        return true;
      });
      if (!isScopeMatch) {
        throw new AppError("The room's location is outside the contract's allowed scope.", 400);
      }
    }

    if (contract.max_head_count !== undefined) {
      const activeTenantCount = await Tenant.countDocuments({
        contract_id: contract._id,
        allocation_status: true,
        _id: { $ne: tenant._id },
      });
      if (activeTenantCount >= contract.max_head_count) {
        throw new AppError(`Contract headcount limit reached (Max: ${contract.max_head_count}).`, 400);
      }
    }
  }

export class BedUseCase implements BedService {

  constructor(
    private bedRepository: BedRepository,
    private bedHistoryRepository: BedHistoryRepository,
    private roomRepository: RoomRepository,
    private tenantRepository: TenantRepository
  ) { }


  async createBed(data: CreateBedRequest): Promise<any> {
    try {
      if (data.tenant_id) {
        await validatePassportForAllocation(data.tenant_id);
        await validateContractAndAllocationForBed(data.tenant_id, data.room_id, undefined, false);

        data.status = data.status || "occupied";
        data.tenant_assigned_at = new Date();

        const bed = await this.bedRepository.create(data);
        logger.info("Bed created successfully");
        const roomId = bed.room_id._id?.toString() || bed.room_id.toString();
        const room = await this.roomRepository.findById(roomId);
        if (room) {
          await this.roomRepository.decrementAvailableSpace(roomId);

          await this.bedHistoryRepository.create({
            tenant_id: data.tenant_id,
            bed_id: bed.id || bed._id,
            room_id: room.id || room._id,
            building_id: room.building_id,
            zone_id: room.zone_id,
            camp_id: room.camp_id,
            assigned_at: new Date()
          });

          await this.tenantRepository.updateTenant(data.tenant_id, { 
            allocation_status: true
          });
        }
        return bed;
      }
      const bed = await this.bedRepository.create(data);
      logger.info("Bed created successfully");
      return bed;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new AppError("Bed number already exists", 400);
      }
      throw new AppError(error.message, error.statusCode || 500);
    }
  }

  async getBed(id: string): Promise<any> {
    const bed = await this.bedRepository.findById(id);
    if (!bed) {
      throw new AppError("Bed not found", 404);
    }
    return bed;
  }

  async getAllBeds(page: number, limit: number, filters?: BedFilter, client_id?: string): Promise<PaginatedBedResponse> {
    const pageNum = page > 0 ? page : 1;
    const limitNum = limit > 0 ? limit : 10;
    return this.bedRepository.findAll(pageNum, limitNum, filters, client_id);
  }

  async updateBed(id: string, data: UpdateBedRequest): Promise<any> {
    const oldBed = await this.bedRepository.findById(id);
    let oldTenantId: string | null = null;
    if (oldBed) {
      oldTenantId = oldBed.tenant_id?._id?.toString();
    }

    const newTenantId = data.tenant_id;
    const assignmentDate = data.assignment_date ? new Date(data.assignment_date) : new Date();

    if (data.tenant_id !== undefined && oldTenantId !== newTenantId) {
      if (newTenantId) {
        await validatePassportForAllocation(newTenantId);
        const roomId = data.room_id || (oldBed ? (oldBed.room_id?._id?.toString() || oldBed.room_id?.toString()) : null);
        if (!roomId) {
          throw new AppError("Room ID is required for bed assignment", 400);
        }
        await validateContractAndAllocationForBed(newTenantId, roomId, id, data.admin_override);
        data.status = data.status || "occupied";
        data.tenant_assigned_at = assignmentDate;
      } else {
        data.status = data.status || "available";
        data.tenant_assigned_at = null;
      }
    }

    let bed;
    if (!oldBed) {
      bed = await this.bedRepository.create({ ...data } as any);
    } else {
      bed = await this.bedRepository.update(id, data);
    }

    if (!bed) {
      throw new AppError("Bed could not be updated or created", 500);
    }

    if (data.tenant_id !== undefined && oldTenantId !== newTenantId) {
      const roomId = bed.room_id?._id?.toString() || bed.room_id?.toString();

      // Fetch room ONCE upfront (only if needed for new tenant)
      const roomPromise = newTenantId
        ? this.roomRepository.findById(roomId)
        : Promise.resolve(null);

      // Resolve old tenant ops + room fetch IN PARALLEL
      const [room] = await Promise.all([
        roomPromise,
        oldTenantId
          ? Promise.all([
            this.bedHistoryRepository.closeHistory(oldTenantId, id, assignmentDate),
            this.roomRepository.incrementAvailableSpace(
              oldBed?.room_id?._id?.toString() || oldBed?.room_id?.toString() || roomId
            ),
            this.tenantRepository.updateTenant(oldTenantId, { allocation_status: false }),
          ])
          : Promise.resolve(null),
      ]);

      // New tenant ops — room must be resolved first, then fire all in parallel
      if (newTenantId && room) {
        await Promise.all([
          this.roomRepository.decrementAvailableSpace(roomId),
          this.bedHistoryRepository.create({
            tenant_id: newTenantId,
            bed_id: bed.id || bed._id,
            room_id: room.id || room._id,
            building_id: room.building_id,
            zone_id: room.zone_id,
            camp_id: room.camp_id,
            assigned_at: assignmentDate,
          }),
          this.tenantRepository.updateTenant(newTenantId, { 
            allocation_status: true
          }),
        ]);
      }
    }

    return bed;
  }

  async deleteBed(id: string): Promise<void> {
    const bed = await this.bedRepository.findById(id);
    if (!bed) {
      throw new AppError("Bed not found", 404);
    }
    const roomId = bed.room_id?._id?.toString() || bed.room_id?.toString();

    if (roomId) {
      await this.roomRepository.update(roomId, { occupancy: -1 });
    }

    if (bed.tenant_id) {
      if (roomId) {
        await this.roomRepository.incrementAvailableSpace(roomId);
      }
      const tenantId = bed.tenant_id._id?.toString() || bed.tenant_id.toString();
      await this.bedHistoryRepository.closeHistory(tenantId, id, new Date());

      await this.tenantRepository.updateTenant(tenantId, { allocation_status: false });
    }
    await this.bedRepository.delete(id);
  }

  async bulkAllocate(data: BulkAllocateRequest): Promise<any> {
    const { assignments, assignmentDate, targetCompanyId } = data;
    const parsedDate = assignmentDate ? new Date(assignmentDate) : new Date();

    // 1. Start a database session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const assignment of assignments) {
        const { tenantId, bedId, roomId } = assignment;

        // 1. Validation
        await validatePassportForAllocation(tenantId);
        await validateContractAndAllocationForBed(tenantId, roomId, bedId, true);

        // 2. Fetch old bed status & handle old tenant deallocation
        const oldBed: any = await Bed.findOne({ _id: bedId, deleted_at: null }).session(session);
        if (oldBed) {
          const oldTenantId = oldBed.tenant_id?._id?.toString() || oldBed.tenant_id?.toString();

          if (oldTenantId && oldTenantId !== tenantId) {
            // Close history for the old tenant
            await BedHistory.findOneAndUpdate(
              {
                tenant_id: new mongoose.Types.ObjectId(oldTenantId),
                bed_id: new mongoose.Types.ObjectId(bedId),
                unassigned_at: null,
              } as any,
              { unassigned_at: parsedDate } as any,
              { sort: { assigned_at: -1 }, session } as any
            );

            // Increment space for the old room
            const oldRoomId = oldBed.room_id?._id || oldBed.room_id;
            const roomToInc: any = await Room.findByIdAndUpdate(
              oldRoomId,
              { $inc: { available_space: 1 } },
              { new: true, session }
            ).populate("camp_id").populate("zone_id").populate("building_id");

            if (roomToInc) {
              let finalRoom = roomToInc;
              if (roomToInc.status !== 0) {
                finalRoom = (await Room.findByIdAndUpdate(
                  oldRoomId,
                  { status: 1 },
                  { new: true, session }
                ).populate("camp_id").populate("zone_id").populate("building_id")) as any;
              }
              if (finalRoom) {
                await (syncRoomSummary as any)(finalRoom, session);
              }
            }

            // Mark the old tenant as unallocated
            await Tenant.findOneAndUpdate(
              { _id: new mongoose.Types.ObjectId(oldTenantId) } as any,
              { allocation_status: false } as any,
              { session } as any
            );
          }
        }

        // 3. Update the Bed record
        await Bed.findOneAndUpdate(
          { _id: bedId, deleted_at: null } as any,
          {
            status: "occupied",
            tenant_id: tenantId,
            tenant_assigned_at: parsedDate
          } as any,
          { session } as any
        );

        // 4. Decrement space in Room
        const room: any = await Room.findByIdAndUpdate(
          roomId,
          { $inc: { available_space: -1 } },
          { new: true, session }
        ).populate("camp_id").populate("zone_id").populate("building_id");

        if (!room) {
          throw new AppError(`Room ${roomId} not found`, 404);
        }

        let finalNewRoom = room;
        if (room.status !== 0 && room.available_space === 0) {
          finalNewRoom = (await Room.findByIdAndUpdate(
            roomId,
            { status: 2 },
            { new: true, session }
          ).populate("camp_id").populate("zone_id").populate("building_id")) as any;
        }
        if (finalNewRoom) {
          await (syncRoomSummary as any)(finalNewRoom, session);
        }

        // 5. Create Bed History record
        const campId = room.camp_id?._id || room.camp_id;
        const history = new BedHistory({
          tenant_id: new mongoose.Types.ObjectId(tenantId),
          bed_id: new mongoose.Types.ObjectId(bedId),
          room_id: new mongoose.Types.ObjectId(roomId),
          building_id: room.building_id,
          zone_id: room.zone_id,
          camp_id: campId,
          assigned_at: parsedDate
        });
        await history.save({ session });

        // 6. Update Tenant allocation status & camp ID
        const tenantUpdateData: any = { 
          allocation_status: true,
          camp_id: campId
        };
        if (targetCompanyId) {
          tenantUpdateData.company_id = new mongoose.Types.ObjectId(targetCompanyId);
        }

        await Tenant.findOneAndUpdate(
          { _id: new mongoose.Types.ObjectId(tenantId), deleted_at: null } as any,
          tenantUpdateData as any,
          { session } as any
        );

        // 7. Update Documents
        if (campId) {
          await DocumentModel.updateMany(
            { tenant_id: new mongoose.Types.ObjectId(tenantId) } as any,
            { camp_id: new mongoose.Types.ObjectId(campId.toString()) } as any,
            { session } as any
          );
        }
      }

      await session.commitTransaction();
      logger.info("Bulk allocation completed successfully on backend.");
    } catch (error: any) {
      await session.abortTransaction();
      logger.error(`Bulk allocation failed, rolled back: ${error.message || error}`);
      throw new AppError(error.message, error.statusCode || 500);
    } finally {
      session.endSession();
    }
  }
}
