export type CreateBedRequest = {
  room_id: string;
  bed_number: string;
  status?: "available" | "occupied" | "reserved";
  type?: "SINGLE_BED" | "BUNK_UPPER" | "BUNK_LOWER";
  tenant_id?: string | null;
  tenant_assigned_at?: Date | null;
};

export type BedFilter = {
  room_id?: string | undefined;
  bed_number?: string | undefined;
  status?: "available" | "occupied" | "reserved" | undefined;
  type?: "SINGLE_BED" | "BUNK_UPPER" | "BUNK_LOWER" | undefined;
  tenant_id?: string | null | undefined;
  assigned_camps?: string[] | undefined;
  assigned_zones?: string[] | undefined;
};

export type UpdateBedRequest = {
  room_id?: string;
  bed_number?: string;
  status?: "available" | "occupied" | "reserved";
  type?: "SINGLE_BED" | "BUNK_UPPER" | "BUNK_LOWER";
  tenant_id?: string | null;
  assignment_date?: string | Date;
  tenant_assigned_at?: Date | null;
  admin_override?: boolean;
};

export type BedResponse = {
  id: string;
  room_id: any; // Can be string or populated object
  bed_number: string;
  status: "available" | "occupied" | "reserved";
  type: "SINGLE_BED" | "BUNK_UPPER" | "BUNK_LOWER";
  tenant_id?: any; // Can be string, null or populated object
  createdAt: Date;
  updatedAt: Date;
  tenant_assigned_at?: Date | null;
};

export type PaginatedBedResponse = {
  items: BedResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type BulkAssignmentItem = {
  tenantId: string;
  bedId: string;
  roomId: string;
  bedNumber: string;
};

export type BulkAllocateRequest = {
  assignments: BulkAssignmentItem[];
  assignmentDate: string | Date;
  adminOverride?: boolean;
  targetCompanyId?: string;
  client_id?: string;
};
