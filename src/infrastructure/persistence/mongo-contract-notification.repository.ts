import mongoose from "mongoose";
import type { ContractNotificationRepository } from "../../domain/repositories/contract-notification.repository.interface.js";
import type {
  ContractNotificationInput,
  ContractNotificationResponse,
  ContractNotificationFilter,
} from "../../domain/types/contract-notification.types.js";
import ContractNotification from "./models/contract-notification.model.js";

export class MongoContractNotificationRepository
  implements ContractNotificationRepository {
  private mapToResponse(doc: any): ContractNotificationResponse {
    return {
      ...doc,
      id: doc._id?.toString() ?? doc.id,
      client_id: doc.client_id?.toString(),
      document_id: doc.document_id?.toString(),
      receiver_id: doc.receiver_id,
      sent_by: doc.sent_by?.toString(),
    } as ContractNotificationResponse;
  }

  async findById(
    id: string,
    clientId: string
  ): Promise<ContractNotificationResponse | null> {
    const doc = await ContractNotification.findOne({
      _id: new mongoose.Types.ObjectId(id),
      client_id: new mongoose.Types.ObjectId(clientId),
    })
      .populate("document_id")
      .lean();
    if (!doc) return null;
    return this.mapToResponse(doc);
  }

  async findAll(
    page: number,
    limit: number,
    filters: ContractNotificationFilter
  ): Promise<{ items: ContractNotificationResponse[]; total: number }> {
    const query: any = {};
    if (filters.client_id)
      query.client_id = new mongoose.Types.ObjectId(filters.client_id);
    if (filters.receiver_type) query.receiver_type = filters.receiver_type;
    if (filters.receiver_id)
      query.receiver_id = new mongoose.Types.ObjectId(filters.receiver_id);
    if (filters.is_read !== undefined) query.is_read = filters.is_read;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      ContractNotification.find(query)
        .populate("document_id")
        .skip(skip)
        .limit(limit)
        .sort({ sent_at: -1 })
        .lean(),
      ContractNotification.countDocuments(query),
    ]);

    return {
      items: data.map((d: any) => this.mapToResponse(d)),
      total,
    };
  }

  async create(
    data: ContractNotificationInput
  ): Promise<ContractNotificationResponse> {
    const payload: any = {
      client_id: new mongoose.Types.ObjectId(data.client_id),
      receiver_type: data.receiver_type,
      receiver_id: new mongoose.Types.ObjectId(data.receiver_id),
      title: data.title,
      message: data.message,
      notification_type: data.notification_type,
      sent_by_role: data.sent_by_role,
      sent_at: new Date(),
    };
    if (data.document_id) payload.document_id = new mongoose.Types.ObjectId(data.document_id);
    if (data.sent_by) payload.sent_by = new mongoose.Types.ObjectId(data.sent_by);

    const created = await ContractNotification.create(payload);
    return this.mapToResponse(created.toObject());
  }

  async markAsRead(id: string, clientId: string): Promise<boolean> {
    const result = await ContractNotification.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        client_id: new mongoose.Types.ObjectId(clientId),
      },
      { $set: { is_read: true } }
    );
    return !!result;
  }

  async markAllAsRead(receiverId: string, clientId: string): Promise<number> {
    const result = await ContractNotification.updateMany(
      {
        receiver_id: new mongoose.Types.ObjectId(receiverId),
        client_id: new mongoose.Types.ObjectId(clientId),
        is_read: false,
      },
      { $set: { is_read: true } }
    );
    return result.modifiedCount;
  }
}
