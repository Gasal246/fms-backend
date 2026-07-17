import mongoose from "mongoose";
import UserRegister from "../../infrastructure/persistence/models/tenant.model.js";
import Contract from "../../infrastructure/persistence/models/contract.model.js";
import ContractAllocation from "../../infrastructure/persistence/models/contract-allocation.model.js";
import BedHistory from "../../infrastructure/persistence/models/bed-history.model.js";
import BackgroundJob from "../../infrastructure/persistence/models/background-job.model.js";
import UserActivityLogModel from "../../infrastructure/persistence/models/user-activity-log.model.js";
import Room from "../../infrastructure/persistence/models/room.model.js";
import CompanyAssignedRoom from "../../infrastructure/persistence/models/company-assigned-room.model.js";
import { ContractTerminationModel } from "../../infrastructure/persistence/models/contract-termination.model.js";
import { logger } from "../../shared/logger/logger.js";
import { AppError } from "../../shared/utils/AppError.js";

const BATCH_SIZE = 15;
const COOLDOWN_MS = 50;

export class BulkTerminationService {
  /**
   * Starts a background job for bulk contract termination.
   * Returns the created Job ID immediately.
   */
  static async startBulkTermination(
    contractId: string,
    clientId: string,
    reason: string,
    userId: string,
    userRole?: string
  ): Promise<string> {
    const contractOid = new mongoose.Types.ObjectId(contractId);
    const clientOid = new mongoose.Types.ObjectId(clientId);

    // 1. Verify contract exists
    const contract = await Contract.findOne({ _id: contractOid, client_id: clientOid, deleted_at: null });
    if (!contract) {
      throw new AppError("Contract not found", 404);
    }

    // 2. Count records to process
    const tenantCount = await UserRegister.countDocuments({
      contract_id: contractOid,
      client_id: clientOid,
      allocation_status: true,
      deleted_at: null,
    });

    const allocationCount = await ContractAllocation.countDocuments({
      contract_id: contractOid,
      client_id: clientOid,
      status: "Active",
    });

    const totalRecords = tenantCount + allocationCount;

    // 3. Create job tracker
    const job = await BackgroundJob.create({
      client_id: clientOid,
      job_type: "BULK_CONTRACT_TERMINATION",
      target_id: contractOid,
      status: "Pending",
      total_records: totalRecords,
      processed_records: 0,
      metadata: {
        reason,
        userId,
        userRole,
        tenant_count: tenantCount,
        allocation_count: allocationCount,
      },
    });

    // 4. Run worker loop asynchronously (fire-and-forget, non-blocking)
    setImmediate(async () => {
      try {
        await this.runWorker(job._id.toString(), contractId, clientId, reason, userId, userRole);
      } catch (err: any) {
        logger.error(`Error executing bulk termination job ${job._id}: ${err.message}`);
        await BackgroundJob.updateOne(
          { _id: job._id },
          { $set: { status: "Failed", error_message: err.message || "Unknown error" } }
        );
      }
    });

    return job._id.toString();
  }

  /**
   * Asynchronous batch loop runner
   */
  private static async runWorker(
    jobId: string,
    contractId: string,
    clientId: string,
    reason: string,
    userId: string,
    userRole?: string
  ): Promise<void> {
    logger.info(`Starting background bulk termination job: ${jobId} for contract: ${contractId}`);

    const contractOid = new mongoose.Types.ObjectId(contractId);
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const userOid = userId ? new mongoose.Types.ObjectId(userId) : null;

    // 1. Update job to processing
    await BackgroundJob.updateOne({ _id: jobId }, { $set: { status: "Processing" } });

    let processedCount = 0;
    const now = new Date();
    const processedTenantIds = new Set<string>();

    // ── STEP A: CHECK OUT TENANTS ──
    while (true) {
      // Find a batch of active tenants assigned to this contract
      const tenants = await UserRegister.find({
        contract_id: contractOid,
        client_id: clientOid,
        allocation_status: true,
        _id: { $not: { $in: Array.from(processedTenantIds).map(id => new mongoose.Types.ObjectId(id)) } },
        deleted_at: null,
      })
        .limit(BATCH_SIZE)
        .select("_id name camp_id zone_id building_id room_id bed_id")
        .lean();

      if (tenants.length === 0) {
        break;
      }

      console.log(`[BULK WORKER] STEP A: Found ${tenants.length} tenants to process.`);

      const tenantIds = tenants.map((t) => t._id);
      tenants.forEach(t => processedTenantIds.add(t._id.toString()));

      // Perform updates for this batch
      await Promise.all([
        // Update user allocation fields
        UserRegister.updateMany(
          { _id: { $in: tenantIds } },
          {
            $set: {
              allocation_status: false,
              zone_id: null,
              building_id: null,
              room_id: null,
              contract_id: null,
              contract_end_date: null,
            },
          }
        ),
        // Close active BedHistory records
        BedHistory.updateMany(
          { tenant_id: { $in: tenantIds as any[] }, unassigned_at: null } as any,
          { $set: { unassigned_at: now } }
        ),
      ]);

      // Create activity logs for this batch
      const activityLogs = tenants.map((t) => ({
        performed_by: userId ? userId.toString() : "System",
        tenant_id: t._id,
        action: `Checked out via bulk contract termination: ${reason}`,
        module: "Tenant",
        timestamp: now,
      }));
      await UserActivityLogModel.insertMany(activityLogs);

      processedCount += tenants.length;
      await BackgroundJob.updateOne({ _id: jobId }, { $set: { processed_records: processedCount } });

      // Cooldown to yield to event loop
      await new Promise((resolve) => setTimeout(resolve, COOLDOWN_MS));
    }

    // ── STEP B: UNASSIGN ROOMS & DEACTIVATE ALLOCATIONS ──
    try {
      // 1. Get all room IDs from ContractAllocation records
      const newAllocations = await ContractAllocation.find({
        contract_id: contractOid,
        client_id: clientOid,
      }).select("room_id").lean();
      const newRoomIds = newAllocations.map(a => a.room_id).filter((id): id is mongoose.Types.ObjectId => !!id);

      // 2. Get all room IDs from legacy CompanyAssignedRoom records
      const legacyAllocations = await CompanyAssignedRoom.find({
        contract_id: contractOid,
        client_id: clientOid,
        deleted_at: null,
      }).select("room_id").lean();
      const legacyRoomIds = legacyAllocations.map(a => (a as any).room_id).filter((id): id is mongoose.Types.ObjectId => !!id);

      // Combine all unique room IDs
      const allAssignedRoomIds = Array.from(new Set([
        ...newRoomIds.map(id => id.toString()),
        ...legacyRoomIds.map(id => id.toString())
      ])).map(id => new mongoose.Types.ObjectId(id));

      if (allAssignedRoomIds.length > 0) {
        // Clear company_id, contract_id, and legacy company_assigned_room_id on all affected Room documents
        await Room.updateMany(
          { _id: { $in: allAssignedRoomIds } },
          { $set: { company_id: null, contract_id: null, company_assigned_room_id: null } }
        );

        // Sync room summaries for all affected rooms
        const { syncRoomSummary } = await import("../../infrastructure/persistence/helpers/room-summary.helper.js");
        const updatedRooms = await Room.find({ _id: { $in: allAssignedRoomIds } })
          .populate("camp_id")
          .populate("zone_id")
          .populate("building_id");
        for (const room of updatedRooms) {
          await syncRoomSummary(room);
        }
      }

      // 4. Soft-delete legacy CompanyAssignedRoom records
      await CompanyAssignedRoom.updateMany(
        { contract_id: contractOid, client_id: clientOid },
        { $set: { deleted_at: now } }
      );

      // 5. Update ContractAllocation records to "Expired"
      const allocationCount = await ContractAllocation.countDocuments({
        contract_id: contractOid,
        client_id: clientOid,
        status: "Active",
      });

      console.log(`[BULK WORKER] STEP B: Deactivating ${allocationCount} allocations...`);

      await ContractAllocation.updateMany(
        { contract_id: contractOid, client_id: clientOid },
        { $set: { status: "Expired" } }
      );

      processedCount += allocationCount;
      await BackgroundJob.updateOne({ _id: jobId }, { $set: { processed_records: processedCount } });

      console.log(`[BULK WORKER] STEP B: Deactivation completed.`);
    } catch (roomErr: any) {
      logger.error(`Error unassigning rooms during bulk contract termination: ${roomErr.message}`);
    }

    // ── STEP C: TERMINATE CONTRACT & FINISH ──
    const contractPayload: any = {
      status: "Terminated",
      termination_reason: reason,
    };
    if (userOid) {
      contractPayload.updated_by = userOid;
    }

    const original = await Contract.findById(contractOid).lean();

    await Contract.updateOne(
      { _id: contractOid, client_id: clientOid },
      { $set: contractPayload }
    );

    // Create termination details record
    try {
      await ContractTerminationModel.create({
        contract_id: contractOid,
        client_id: clientOid,
        ...(userOid ? { terminated_by: userOid } : {}),
        ...(userRole ? { terminated_by_model: userRole === 'client_admin' ? 'clients' : 'coordinator' } : {}),
        termination_reason: reason || "Bulk terminated via background job",
      });
    } catch (termErr: any) {
      logger.error(`Failed to create termination details: ${termErr?.message || termErr}`);
    }

    // Audit log for contract termination
    try {
      await UserActivityLogModel.create({
        performed_by: userId ? userId.toString() : "System",
        action: "Contract Terminated",
        module: "Contract",
        timestamp: now,
        previous_state: { contract_id: contractId, status: original?.status },
        new_state: { status: "Terminated", termination_reason: reason },
      });
    } catch (logErr: any) {
      logger.error(`Failed to write activity log for contract termination: ${logErr?.message || logErr}`);
    }

    // Complete Job
    await BackgroundJob.updateOne(
      { _id: jobId },
      { $set: { status: "Completed", processed_records: processedCount } }
    );

    logger.info(`Successfully completed bulk termination job: ${jobId} for contract: ${contractId}`);
  }
}
