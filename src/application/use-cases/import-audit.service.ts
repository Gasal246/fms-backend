import mongoose from 'mongoose';
import UserActivityLogModel from '../../infrastructure/persistence/models/user-activity-log.model.js';
import { logger } from '../../shared/logger/logger.js';

export class ImportAuditService {
  /**
   * Logs activity for a batch of created tenants during bulk import.
   * Uses bulkWrite for optimal performance.
   * 
   * @param tenantIds Array of tenant ObjectIds created
   * @param uploaderId The ID of the user who initiated the import
   */
  static async logBulkTenantCreation(tenantIds: mongoose.Types.ObjectId[], uploaderId: string): Promise<void> {
    if (tenantIds.length === 0) return;

    try {
      const logs = tenantIds.map(id => ({
        insertOne: {
          document: {
            user_id: new mongoose.Types.ObjectId(uploaderId), // The admin/user who did this
            performed_by: 'Bulk Import Worker',
            tenant_id: id,
            action: 'Bulk Import Created',
            module: 'Tenant' as const,
            timestamp: new Date()
          }
        }
      }));

      await UserActivityLogModel.bulkWrite(logs, { ordered: false });
    } catch (error: any) {
      logger.error(`[ImportAuditService] Failed to log bulk creation: ${error.message}`);
    }
  }

  /**
   * Logs activity for a batch of updated tenants during bulk import (Duplicate handling).
   * 
   * @param tenantIds Array of tenant ObjectIds updated
   * @param uploaderId The ID of the user who initiated the import
   */
  static async logBulkTenantUpdate(tenantIds: mongoose.Types.ObjectId[], uploaderId: string): Promise<void> {
    if (tenantIds.length === 0) return;

    try {
      const logs = tenantIds.map(id => ({
        insertOne: {
          document: {
            user_id: new mongoose.Types.ObjectId(uploaderId),
            performed_by: 'Bulk Import Worker',
            tenant_id: id,
            action: 'Bulk Import Updated',
            module: 'Tenant' as const,
            timestamp: new Date()
          }
        }
      }));

      await UserActivityLogModel.bulkWrite(logs, { ordered: false });
    } catch (error: any) {
      logger.error(`[ImportAuditService] Failed to log bulk update: ${error.message}`);
    }
  }
}
