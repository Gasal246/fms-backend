export type ContractBillingModel = "Per Room" | "Per Bed" | "Per Head" | "Flat Fee";
export type ContractStatus =
  | "Draft"
  | "Pending Approval"
  | "Approved"
  | "Active"
  | "Expiring Soon"
  | "Expired"
  | "Suspended"
  | "Terminated"
  | "Renewed";

// ── Request / Response ─────────────────────────────────────────────

export interface ContractRequest {
  client_id: string;
  company_id: string;
  contract_number: string;
  contract_name: string;
  billing_model: ContractBillingModel;
  currency: string;
  start_date: string | Date;
  end_date: string | Date;
  status?: ContractStatus;
  notes?: string;
  auto_renew?: boolean;
  max_head_count?: number;
  room_count?: number;
  expire_alert_days?: number;

  // Commercial
  agreed_rate?: number;
  grace_period_days?: number;
  notice_period_days?: number;
  renewal_terms?: string;
  contract_value?: number;
  tax_mode?: string;

  // Compliance
  compliance_required?: boolean;
  document_checklist?: string[];

  // Audit
  created_by?: string;
  updated_by?: string;
  updated_by_role?: string;
  termination_reason?: string;

  // Renewal
  renewed_from_contract_id?: string | null;
  renewed_to_contract_id?: string | null;
  is_renewal?: boolean;
  renewal_version?: number;
  copy_allocations?: boolean;
  selected_allocation_ids?: string[];
}

export interface ContractResponse {
  id: string;
  client_id: string;
  company_id: any;
  contract_number: string;
  contract_name: string;
  billing_model: ContractBillingModel;
  currency: string;
  start_date: Date;
  end_date: Date;
  status: ContractStatus;
  notes?: string;
  auto_renew: boolean;
  max_head_count?: number;
  room_count?: number;
  expire_alert_days?: number;

  agreed_rate?: number;
  grace_period_days?: number;
  notice_period_days?: number;
  renewal_terms?: string;
  contract_value?: number;
  tax_mode?: string;

  compliance_required: boolean;
  document_checklist?: string[];

  created_by?: any;
  updated_by?: any;

  // Renewal chain
  renewed_from_contract_id?: string | null;
  renewed_to_contract_id?: string | null;
  is_renewal: boolean;
  renewal_version: number;

  createdAt: Date;
  updatedAt: Date;

  allocationCount?: number;
  linkedTenantsCount?: number;
}

// ── Filter ─────────────────────────────────────────────────────────

export interface ContractFilter {
  client_id?: string;
  company_id?: string;
  status?: ContractStatus | string;
  billing_model?: ContractBillingModel;
  search?: string;
  date_from?: string;
  date_to?: string;
  created_by?: string;
  is_renewal?: boolean;
  include_renewed?: boolean | string;
  user_role?: string;
  assigned_camps?: string[];
  assigned_zones?: string[];
}

// ── Pagination ─────────────────────────────────────────────────────

export interface PaginatedContractResponse {
  items: ContractResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Summary / Occupancy ────────────────────────────────────────────

export interface ContractOccupancySummary {
  contract_id: string;
  total_allocated_rooms: number;
  total_allocated_beds: number;
  total_headcount_capacity: number;
  occupied_rooms: number;
  occupied_beds: number;
  current_tenants: number;
  available_rooms: number;
  available_beds: number;
  available_headcount: number;
}
