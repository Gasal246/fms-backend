export interface ContractNotificationInput {
  client_id: string;
  document_id?: string | null;
  receiver_type: "company" | "tenant" | "client_admin";
  receiver_id: string;
  title: string;
  message: string;
  notification_type: "expiry" | "renewal" | "compliance" | "general";
  sent_by?: string | null;
  sent_by_role: string;
}

export interface ContractNotificationResponse {
  id: string;
  client_id: string;
  document_id?: any;
  receiver_type: "company" | "tenant" | "client_admin";
  receiver_id: any;
  title: string;
  message: string;
  notification_type: "expiry" | "renewal" | "compliance" | "general";
  sent_by?: string | null;
  sent_by_role: string;
  is_read: boolean;
  sent_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractNotificationFilter {
  client_id?: string;
  receiver_type?: string;
  receiver_id?: string;
  is_read?: boolean;
}
