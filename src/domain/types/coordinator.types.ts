import type { IRole } from "../../infrastructure/persistence/models/role.model.js";

export type CoordinatorFilter = {
  client_id?: string | undefined;
  status?: number | undefined;
  full_name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  search?: string | undefined;
  camp_id?: string | undefined;
  assigned_camps?: string[] | undefined;
  assigned_zones?: string[] | undefined;
};

export type CoordinatorRequest = {
  client_id: string;
  full_name: string;
  email: string;
  phone?: string;
  password?: string;
  status: number;
  is_mess_management: number;
  is_water_management: number;
  is_internet_management: number;
  role_id: string; // Used for assigning role
  profile_picture?: string;
  camp_id?: string;
  zone_id?: string;
  uuid?: string;
};

export type CoordinatorResponse = {
  id: string;
  client_id: any;
  camp_id?: string | null;
  zone_id?: string | null;
  roles?: any[];
  full_name: string;
  email: string;
  phone?: string;
  uuid?: string;
  status: number;
  is_mess_management: number;
  is_water_management: number;
  is_internet_management: number;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  site_name?: string;
  assigned_site?: any;
  site?: any;
  profile_picture?: string;
  assigned_sites?: any[];
  assigned_zones?: any[];
};

export type PaginatedCoordinatorResponse = {
  items: CoordinatorResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
