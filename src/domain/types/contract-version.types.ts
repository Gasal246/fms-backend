export interface ContractVersionRequest {
  document_id: string;
  version_no: number;
  file_name: string;
  file_url: string;
  mime_type: string;
  file_size: number;
  start_date: string | Date;
  end_date: string | Date;
  uploaded_by: string;
  uploaded_by_role: string;
  status: "active" | "renewed" | "rejected" | "pending";
  notes?: string;
}

export interface ContractVersionResponse {
  id: string;
  document_id: string;
  version_no: number;
  file_name: string;
  file_url: string;
  mime_type: string;
  file_size: number;
  start_date: Date;
  end_date: Date;
  uploaded_by: string;
  uploaded_by_role: string;
  upload_date: Date;
  status: "active" | "renewed" | "rejected" | "pending";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
