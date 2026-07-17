export interface ContractStaffAccessInput {
  document_id: string;
  staff_id: string;
  role?: string;
  can_view: boolean;
  can_edit: boolean;
  assigned_by: string;
}

export interface ContractStaffAccessResponse {
  id: string;
  document_id: string;
  staff_id: any;
  role: string;
  can_view: boolean;
  can_edit: boolean;
  assigned_by: string;
  createdAt: Date;
  updatedAt: Date;
}
