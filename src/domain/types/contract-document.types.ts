export interface ContractDocumentRequest {
  client_id: string;
  owner_type: "contract" | "company" | "tenant";
  owner_id: string;
  contract_id?: string | null;
  company_id?: string | null;
  tenant_id?: string | null;
  document_scope: "company_contract" | "tenant_contract" | "company_compliance" | "tenant_compliance";
  document_type: string;
  title: string;
  document_number: string;
  start_date: string | Date;
  end_date: string | Date;
  renewal_reminder_days: number;
  is_restricted?: boolean;
  status?: string;
  current_version_id?: string | null;
  uploaded_by: string;
  uploaded_by_role: string;
  remarks?: string;
  verified_by?: string | null;
  verified_at?: string | Date | null;
}

export interface ContractDocumentResponse {
  id: string;
  client_id: string;
  owner_type: "contract" | "company" | "tenant";
  owner_id: string;
  contract_id?: string | null;
  company_id?: string | null;
  tenant_id?: string | null;
  document_scope: "company_contract" | "tenant_contract" | "company_compliance" | "tenant_compliance";
  document_type: string;
  title: string;
  document_number: string;
  start_date: Date;
  end_date: Date;
  renewal_reminder_days: number;
  is_restricted: boolean;
  status: string;
  current_version_id?: string | null;
  uploaded_by: string;
  uploaded_by_role: string;
  verified_by?: string | null;
  verified_at?: Date | null;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractDocumentFilter {
  client_id?: string;
  owner_type?: string;
  owner_id?: string;
  contract_id?: string;
  company_id?: string;
  tenant_id?: string;
  document_scope?: string;
  document_type?: string;
  status?: string;
  is_restricted?: boolean;
  search?: string;
}

export interface PaginatedContractDocumentResponse {
  items: ContractDocumentResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
