import mongoose from "mongoose";
import TenantImportJob from "../../infrastructure/persistence/models/tenant-import-job.model.js";
import { logger } from "../../shared/logger/logger.js";

/**
 * Stale Job TTL configuration.
 *
 * A job is considered stale if it has been in a transient "in-flight"
 * status for longer than the allowed TTL without moving forward.
 * This happens when the server crashes mid-processing or a worker
 * throws an uncaught error that bypasses the finally block.
 */
const STALE_TTL: Record<string, number> = {
  /**
   * "Uploaded" → picked up by validation worker within ~3s normally.
   * Allow 20 minutes before declaring stale (covers slow startup, cold DB).
   */
  "Uploaded":   20 * 60 * 1000,

  /**
   * "Validating" → validation worker processes ~500 rows/tick.
   * At worst-case 25 000 rows / 500 per batch = 50 ticks × ~2s = ~100s.
   * Allow 20 minutes as a very generous ceiling.
   */
  "Validating": 20 * 60 * 1000,

  /**
   * "Queued For Import" → picked up by registration worker within ~3s.
   * Allow 20 minutes (same reasoning as Uploaded).
   */
  "Queued For Import": 20 * 60 * 1000,

  /**
   * "Importing" → registration worker processes in batches of 25.
   * 25 000 rows / 25 per batch = 1 000 ticks × ~2s = ~33 min worst case.
   * Allow 60 minutes for extremely large imports before declaring stale.
   */
  "Importing": 60 * 60 * 1000,
};

/**
 * Runs once per scheduler tick (every 10 minutes).
 * Finds jobs stuck in transient states, marks them Failed,
 * and records a descriptive last_error for operator visibility.
 *
 * Uses findOneAndUpdate + $set instead of updateMany so each
 * document gets individual updatedAt timestamps and individual
 * logging for traceability.
 */
export async function runStaleJobDetector(): Promise<void> {
  const now = new Date();

  for (const [status, ttlMs] of Object.entries(STALE_TTL)) {
    const cutoff = new Date(now.getTime() - ttlMs);

    // Find all stale jobs for this status in one query (projection only — no lock needed)
    const staleJobs = await TenantImportJob.find(
      {
        status,
        updatedAt: { $lt: cutoff },
      },
      { _id: 1, file_name: 1, client_id: 1, updatedAt: 1 }
    ).lean();

    if (staleJobs.length === 0) continue;

    logger.warn(
      `[StaleJobDetector] Found ${staleJobs.length} stale job(s) in status "${status}" (TTL: ${ttlMs / 60_000}min)`
    );

    for (const job of staleJobs) {
      const stuckForMs = now.getTime() - new Date(job.updatedAt as Date).getTime();
      const stuckForMin = Math.round(stuckForMs / 60_000);

      await TenantImportJob.findByIdAndUpdate(
        job._id,
        {
          $set: {
            status: "Failed",
            last_error: `[Auto] Job was stuck in "${status}" for ${stuckForMin} minutes and was marked as failed by the stale-job detector. This usually means the server was restarted mid-processing. Re-upload the file or retry from the import dashboard.`,
            completed_at: now,
          },
        },
        { returnDocument: 'before' }
      );

      logger.error(
        `[StaleJobDetector] Job ${(job._id as mongoose.Types.ObjectId).toString()} ("${job.file_name}") marked Failed — was stuck in "${status}" for ${stuckForMin} min`
      );
    }
  }
}
