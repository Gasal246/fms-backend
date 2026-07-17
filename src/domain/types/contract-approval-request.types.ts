export interface ContractApprovalRequestInput {
  client_id: string;
  document_id: string;
  version_id?: string | null;
  request_type: "upload" | "update" | "renew" | "delete";
  requested_by: string;
  requested_by_role: string;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  remarks?: string;
}

export interface ContractApprovalRequestResponse {
  id: string;
  client_id: string;
  document_id: any;
  version_id?: any;
  request_type: "upload" | "update" | "renew" | "delete";
  requested_by: string;
  requested_by_role: string;
  requested_at: Date;
  approval_status: "pending" | "approved" | "rejected";
  approved_by?: string | null;
  approved_at?: Date | null;
  remarks?: string;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractApprovalRequestFilter {
  client_id?: string;
  document_id?: string;
  approval_status?: string;
  request_type?: string;
}
