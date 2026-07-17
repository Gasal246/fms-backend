export type CreateCounterRequest = {
  client_id: string;
  camp_id: string;
  zone_id: string;
  counter_name: string;
  description?: string;
  status?: "Active" | "Inactive";
  created_by: string;
};

export type UpdateCounterRequest = {
  counter_name?: string;
  description?: string;
  camp_id?: string;
  zone_id?: string;
  status?: "Active" | "Inactive";
  updated_by: string;
};

export type CounterResponse = {
  id: string;
  client_id: string;
  camp_id: { id: string; camp_name: string } | string | null;
  zone_id: { id: string; zone_name: string } | string | null;
  counter_no: string;
  counter_name: string;
  description?: string;
  status: "Active" | "Inactive" | "Deleted";
  created_by: string;
  updated_by?: string | null;
  counter_points: number;
  counterPointsCount: number;
  deletedCounterPointsCount?: number | undefined;
  machines: number;
  machineCount: number;
  total_counter_points?: number | undefined;
  total_machines?: number | undefined;
  active_machines?: number | undefined;
  inactive_machines?: number | undefined;
  machine_count?: number | undefined;
  createdAt: Date;
  updatedAt: Date;
};

export type PaginatedCounterResponse = {
  items: CounterResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CounterFilter = {
  camp_id?: string | undefined;
  zone_id?: string | undefined;
  status?: string | undefined;
  search?: string | undefined;
  sortField?: string | undefined;
  sortOrder?: "asc" | "desc" | 1 | -1 | undefined;
  assigned_camps?: string[] | undefined;
  assigned_zones?: string[] | undefined;
};
