export type AllocationTypeDomain = "ROOM" | "BED" | "BUILDING" | "FLOOR" | "HEADCOUNT";
export type AllocationStatusDomain = "Active" | "Expired" | "Suspended" | "Cancelled";

// ── Request / Response ─────────────────────────────────────────────

export interface ContractAllocationRequest {
  client_id: string;
  contract_id: string;
  company_id: string;
  allocation_type: AllocationTypeDomain;

  site_id?: string;
  building_id?: string;
  floor_id?: string;
  room_id?: string;
  bed_id?: string;

  quantity?: number;
  rate?: number;
  start_date: string | Date;
  end_date: string | Date;
  remarks?: string;
  status?: AllocationStatusDomain;

  created_by?: string;
  updated_by?: string;
}

export interface ContractAllocationResponse {
  id: string;
  client_id: string;
  contract_id: string;
  company_id: string;
  allocation_type: AllocationTypeDomain;

  site_id?: string;
  building_id?: string;
  floor_id?: string;
  room_id?: any;
  bed_id?: string;

  quantity?: number;
  rate?: number;
  start_date: Date;
  end_date: Date;
  remarks?: string;
  status: AllocationStatusDomain;

  created_by?: string;
  updated_by?: string;

  createdAt: Date;
  updatedAt: Date;
}

// ── Filter ─────────────────────────────────────────────────────────

export interface ContractAllocationFilter {
  client_id?: string;
  contract_id?: string;
  company_id?: string;
  allocation_type?: AllocationTypeDomain;
  status?: AllocationStatusDomain;
}

// ── Pagination ─────────────────────────────────────────────────────

export interface PaginatedContractAllocationResponse {
  items: ContractAllocationResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Availability ───────────────────────────────────────────────────

export interface AvailabilityCheckRequest {
  room_id?: string;
  bed_id?: string;
  start_date: string | Date;
  end_date: string | Date;
  exclude_allocation_id?: string;
}

export interface AvailabilityCheckResult {
  available: boolean;
  conflict_allocation_id?: string;
  message?: string;
}
