export type CreateCounterPointRequest = {
  client_id: string;
  camp_id: string;
  zone_id: string;
  counter_id: string;
  name: string;
  direction_label: "entry" | "exit" | "both";
  description?: string | undefined;
  status?: "active" | "inactive" | undefined;
  created_by: string;
};

export type UpdateCounterPointRequest = {
  camp_id?: string | undefined;
  zone_id?: string | undefined;
  counter_id?: string | undefined;
  name?: string | undefined;
  direction_label?: "entry" | "exit" | "both" | undefined;
  description?: string | undefined;
  status?: "active" | "inactive" | undefined;
  updated_by: string;
};

export type CounterPointResponse = {
  id: string;
  client_id: string;
  camp_id: { id: string; camp_name: string } | string | null;
  zone_id: { id: string; zone_name: string } | string | null;
  counter_id: { id: string; counter_name: string } | string | null;
  point_no: string;
  name: string;
  direction_label: "entry" | "exit" | "both";
  description?: string | undefined;
  status: "active" | "inactive" | "deleted";
  created_by: string;
  updated_by?: string | null;
  machineCount: number;
  machine_count?: number | undefined;
  attached_machines?: Array<{
    machine_id: string;
    machine_name: string;
    machine_type: string;
    binding_status: string;
    status: string;
  }> | undefined;
  createdAt: Date;
  updatedAt: Date;
};

export type PaginatedCounterPointResponse = {
  items: CounterPointResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CounterPointFilter = {
  camp_id?: string | undefined;
  zone_id?: string | undefined;
  counter_id?: string | undefined;
  status?: string | undefined;
  search?: string | undefined;
  sortField?: string | undefined;
  sortOrder?: "asc" | "desc" | 1 | -1 | undefined;
  assigned_camps?: string[] | undefined;
  assigned_zones?: string[] | undefined;
};
