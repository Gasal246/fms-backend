export type CreateMachineRequest = {
  client_id: string;
  machine_name: string;
  machine_type: string;
  manufacturer?: string | undefined;
  model?: string | undefined;
  serial_number?: string | undefined;
  description?: string | undefined;
  mac_id?: string | null | undefined;
  binding_status?: "pending" | "bound" | "unbound" | undefined;
  assigned_status?: "unallocated" | "allocated" | undefined;
  camp_id: string;
  zone_id: string;
  counter_id: string;
  counter_point_id: string;
  assigned_action?: string | null | undefined;
  status?: "active" | "inactive" | undefined;
  created_by: string;
};

export type UpdateMachineRequest = {
  machine_name?: string | undefined;
  machine_type?: string | undefined;
  manufacturer?: string | undefined;
  model?: string | undefined;
  serial_number?: string | undefined;
  description?: string | undefined;
  mac_id?: string | null | undefined;
  binding_status?: "pending" | "bound" | "unbound" | undefined;
  assigned_status?: "unallocated" | "allocated" | undefined;
  camp_id?: string | undefined;
  zone_id?: string | undefined;
  counter_id?: string | undefined;
  counter_point_id?: string | undefined;
  assigned_action?: string | null | undefined;
  status?: "active" | "inactive" | undefined;
  updated_by: string;
};

export type MachineResponse = {
  id: string;
  client_id: string;
  machine_id: string;
  machine_name: string;
  machine_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  description: string;
  mac_id: string | null;
  binding_status: "pending" | "bound" | "unbound";
  assigned_status: "unallocated" | "allocated";
  camp_id: { id: string; camp_name: string } | string | null;
  zone_id: { id: string; zone_name: string } | string | null;
  counter_id: { id: string; counter_name: string } | string | null;
  counter_point_id: { id: string; name: string } | string | null;
  assigned_action: string | null;
  last_ping_at: Date | null;
  status: "active" | "inactive" | "deleted";
  created_by: string;
  updated_by?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PaginatedMachineResponse = {
  items: MachineResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type MachineFilter = {
  camp_id?: string | undefined;
  zone_id?: string | undefined;
  counter_id?: string | undefined;
  counter_point_id?: string | undefined;
  machine_type?: string | undefined;
  binding_status?: string | undefined;
  assigned_status?: string | undefined;
  status?: string | undefined;
  search?: string | undefined;
  sortField?: string | undefined;
  sortOrder?: "asc" | "desc" | 1 | -1 | undefined;
  assigned_camps?: string[] | undefined;
  assigned_zones?: string[] | undefined;
};
