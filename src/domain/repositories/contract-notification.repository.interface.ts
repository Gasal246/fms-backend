import type {
  ContractNotificationInput,
  ContractNotificationResponse,
  ContractNotificationFilter,
} from "../types/contract-notification.types.js";

export interface ContractNotificationRepository {
  findById(id: string, clientId: string): Promise<ContractNotificationResponse | null>;
  findAll(
    page: number,
    limit: number,
    filters: ContractNotificationFilter
  ): Promise<{ items: ContractNotificationResponse[]; total: number }>;
  create(data: ContractNotificationInput): Promise<ContractNotificationResponse>;
  markAsRead(id: string, clientId: string): Promise<boolean>;
  markAllAsRead(receiverId: string, clientId: string): Promise<number>;
}
