export type TechnicianFilter = {
  client_id?: string | undefined;
  status?: number | undefined;
  name?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  search?: string | undefined;
  assigned_camps?: string[] | undefined;
  assigned_zones?: string[] | undefined;
};

export type TechnicianRequest = {
  name: string;
  email: string;
  password?: string;
  phone: string;
  role_id: string;
  client_id: string;
  status: number;
  skills?: string[];
  isAdmin?: boolean;
  profile_picture?: string;
};

export type TechnicianResponse = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role_id?: any;
  client_id: any;
  isAdmin: boolean;
  status: number;
  skills: any[];
  createdAt: Date;
  updatedAt: Date;
  site_name?: string;
  assigned_site?: any;
  site?: any;
  profile_picture?: string;
};

export type PaginatedTechnicianResponse = {
  items: TechnicianResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
