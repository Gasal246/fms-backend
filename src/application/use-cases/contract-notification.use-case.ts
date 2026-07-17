import mongoose from "mongoose";
import type { ContractNotificationRepository } from "../../domain/repositories/contract-notification.repository.interface.js";
import type { ContractDocumentRepository } from "../../domain/repositories/contract-document.repository.interface.js";
import type {
  ContractNotificationFilter,
  ContractNotificationResponse,
} from "../../domain/types/contract-notification.types.js";
import ContractDocument from "../../infrastructure/persistence/models/contract-document.model.js";
import ContractNotification from "../../infrastructure/persistence/models/contract-notification.model.js";
import { logger } from "../../shared/logger/logger.js";

export class ContractNotificationUseCase {
  constructor(
    private readonly notificationRepo: ContractNotificationRepository,
    private readonly documentRepo: ContractDocumentRepository
  ) {}

  async getNotifications(
    clientId: string,
    receiverId: string,
    receiverType: "company" | "tenant" | "client_admin",
    page: number,
    limit: number
  ): Promise<{ items: ContractNotificationResponse[]; total: number }> {
    const filters: ContractNotificationFilter = {
      client_id: clientId,
      receiver_type: receiverType,
      receiver_id: receiverId,
    };
    return this.notificationRepo.findAll(page, limit, filters);
  }

  async markRead(id: string, clientId: string): Promise<void> {
    await this.notificationRepo.markAsRead(id, clientId);
  }

  async markAllRead(receiverId: string, clientId: string): Promise<void> {
    await this.notificationRepo.markAllAsRead(receiverId, clientId);
  }

  /**
   * Run the daily expiry checker to scan documents expiring within reminder_days.
   * Triggered by a scheduler or API endpoint.
   */
  async runDailyExpiryCheck(): Promise<number> {
    logger.info("Starting daily contract/document expiry validation check.");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all active documents
    const activeDocs = await ContractDocument.find({
      status: "active",
      deleted_at: null,
    }).lean();

    let alertsGenerated = 0;

    for (const doc of activeDocs) {
      const expiry = new Date(doc.end_date);
      expiry.setHours(0, 0, 0, 0);

      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // 1. Expired check
      if (diffDays <= 0) {
        await ContractDocument.findByIdAndUpdate(doc._id, { status: "expired" });
        logger.info(`Document "${doc.title}" has expired.`);

        // Notify client admin
        await ContractNotification.create({
          client_id: doc.client_id,
          document_id: doc._id,
          receiver_type: "client_admin",
          receiver_id: doc.client_id,
          title: "Document Expired Alert",
          message: `The document "${doc.title}" (${doc.document_number}) has expired.`,
          notification_type: "expiry",
          sent_by_role: "system",
          is_read: false,
          sent_at: new Date(),
        });
        alertsGenerated++;

        // Notify company admin if company scope
        if (doc.company_id) {
          await ContractNotification.create({
            client_id: doc.client_id,
            document_id: doc._id,
            receiver_type: "company",
            receiver_id: doc.company_id,
            title: "Document Expired Alert",
            message: `Your document "${doc.title}" (${doc.document_number}) has expired.`,
            notification_type: "expiry",
            sent_by_role: "system",
            is_read: false,
            sent_at: new Date(),
          });
          alertsGenerated++;
        }

        // Notify tenant if tenant scope
        if (doc.tenant_id) {
          await ContractNotification.create({
            client_id: doc.client_id,
            document_id: doc._id,
            receiver_type: "tenant",
            receiver_id: doc.tenant_id,
            title: "Document Expired Alert",
            message: `Your document "${doc.title}" (${doc.document_number}) has expired.`,
            notification_type: "expiry",
            sent_by_role: "system",
            is_read: false,
            sent_at: new Date(),
          });
          alertsGenerated++;
        }
      }
      // 2. Expiring soon check
      else if (diffDays <= doc.renewal_reminder_days) {
        // Only notify if we haven't already sent an expiry reminder today/recently
        const alreadyNotified = await ContractNotification.findOne({
          document_id: doc._id,
          notification_type: "expiry",
          sent_at: { $gte: new Date(today.getTime() - 24 * 60 * 60 * 1000) }, // in last 24h
        }).lean();

        if (!alreadyNotified) {
          // Notify client admin
          await ContractNotification.create({
            client_id: doc.client_id,
            document_id: doc._id,
            receiver_type: "client_admin",
            receiver_id: doc.client_id,
            title: "Document Expiring Soon",
            message: `The document "${doc.title}" (${doc.document_number}) is expiring in ${diffDays} days on ${expiry.toLocaleDateString()}.`,
            notification_type: "expiry",
            sent_by_role: "system",
            is_read: false,
            sent_at: new Date(),
          });
          alertsGenerated++;

          // Notify company admin
          if (doc.company_id) {
            await ContractNotification.create({
              client_id: doc.client_id,
              document_id: doc._id,
              receiver_type: "company",
              receiver_id: doc.company_id,
              title: "Document Expiring Soon",
              message: `Your document "${doc.title}" (${doc.document_number}) is expiring in ${diffDays} days on ${expiry.toLocaleDateString()}. Please prepare renewal.`,
              notification_type: "expiry",
              sent_by_role: "system",
              is_read: false,
              sent_at: new Date(),
            });
            alertsGenerated++;
          }

          // Notify tenant
          if (doc.tenant_id) {
            await ContractNotification.create({
              client_id: doc.client_id,
              document_id: doc._id,
              receiver_type: "tenant",
              receiver_id: doc.tenant_id,
              title: "Document Expiring Soon",
              message: `Your document "${doc.title}" (${doc.document_number}) is expiring in ${diffDays} days on ${expiry.toLocaleDateString()}. Please prepare renewal.`,
              notification_type: "expiry",
              sent_by_role: "system",
              is_read: false,
              sent_at: new Date(),
            });
            alertsGenerated++;
          }
        }
      }
    }

    logger.info(`Expiry checker finished. Generated ${alertsGenerated} alert logs.`);
    return alertsGenerated;
  }
}
