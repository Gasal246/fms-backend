import { runAllAggregations } from '../infrastructure/dashboard/aggregation.service.js';
import { runValidationWorker } from '../application/use-cases/import-validation.worker.js';
import { runRegistrationWorker } from '../application/use-cases/import-registration.worker.js';
import { runStaleJobDetector } from '../application/use-cases/import-stale-job.worker.js';
import { logger } from '../shared/logger/logger.js';

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Starts the background dashboard aggregation scheduler.
 * - Runs immediately on boot so data is available right away.
 * - Then repeats every 15 minutes.
 * Call this once after the DB connection is established.
 */
export function startDashboardScheduler(): void {
  logger.info('[Scheduler] Dashboard aggregation scheduler starting...');

  // Run immediately on startup
  runAllAggregations().catch((err) =>
    logger.error(`[Scheduler] Initial aggregation failed: ${err}`)
  );

  // Then every 15 minutes
  setInterval(() => {
    runAllAggregations().catch((err) =>
      logger.error(`[Scheduler] Scheduled aggregation failed: ${err}`)
    );
  }, INTERVAL_MS);

  logger.info(`[Scheduler] Next aggregation run in ${INTERVAL_MS / 60_000} minutes.`);
}

let isValidationRunning   = false;
let isRegistrationRunning = false;
let isStaleDetectorRunning = false;

const STALE_DETECTOR_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Starts the background Bulk Import queue worker loops.
 *
 * - Validation poller:   every 3s  — picks up "Uploaded" jobs
 * - Registration poller: every 3s  — picks up "Queued For Import" jobs
 * - Stale job detector:  every 10m — marks ghost-locked jobs as Failed
 *
 * Call once after the DB connection is established.
 */
export function startImportScheduler(): void {
  logger.info('[Scheduler] Bulk Import queue scheduler starting...');

  // ── Validation worker (every 3s) ────────────────────────────────
  setInterval(async () => {
    if (isValidationRunning) return;
    isValidationRunning = true;
    try {
      await runValidationWorker();
    } catch (err: any) {
      logger.error(`[Scheduler] Bulk validation worker failed: ${err.message}`);
    } finally {
      isValidationRunning = false;
    }
  }, 3000);

  // ── Registration worker (every 3s) ──────────────────────────────
  setInterval(async () => {
    if (isRegistrationRunning) return;
    isRegistrationRunning = true;
    try {
      await runRegistrationWorker();
    } catch (err: any) {
      logger.error(`[Scheduler] Bulk registration worker failed: ${err.message}`);
    } finally {
      isRegistrationRunning = false;
    }
  }, 3000);

  // ── Stale job detector (every 10 minutes) ───────────────────────
  // Run immediately on boot to clean up any ghost-locked jobs from
  // the previous server process before starting normal polling.
  runStaleJobDetector().catch((err: any) =>
    logger.error(`[Scheduler] Initial stale-job sweep failed: ${err.message}`)
  );

  setInterval(async () => {
    if (isStaleDetectorRunning) return;
    isStaleDetectorRunning = true;
    try {
      await runStaleJobDetector();
    } catch (err: any) {
      logger.error(`[Scheduler] Stale-job detector failed: ${err.message}`);
    } finally {
      isStaleDetectorRunning = false;
    }
  }, STALE_DETECTOR_INTERVAL_MS);

  logger.info('[Scheduler] Import workers started — validation/registration every 3s, stale-job sweep every 10min.');
}
