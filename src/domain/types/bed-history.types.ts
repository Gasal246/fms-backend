export type BedHistoryResponse = {
  id: string;
  tenant_id: any;
  bed_id: any;
  room_id: any;
  building_id: any;
  zone_id: any;
  camp_id: any;
  assigned_at: Date;
  unassigned_at?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type BedHistoryFilter = {
  assigned_at?: string;
  unassigned_at?: string;
  tenant_id?: string;
  bed_id?: string;
  room_id?: string;
  building_id?: string;
  zone_id?: string;
  camp_id?: string;
  assigned_camps?: string[];
  assigned_zones?: string[];
};

export type PaginatedBedHistoryResponse = {
  items: BedHistoryResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
