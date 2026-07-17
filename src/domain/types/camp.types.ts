export type CampFilter = {
  client_id?: string | undefined;
  camp_name?: string | undefined;
  camp_city?: string | undefined;
  status?: number | undefined;
};

export type CampResponse = {
  id: string;
  client_id: string;
  camp_name: string;
  camp_address: string;
  camp_city: string;
  router_primary_ip: string;
  no_of_allowed_user: number;
  no_of_allowed_kiosk: number;
  no_of_allowed_account: number;
  no_of_allowed_coordinators: number;
  is_allowed_package_meal: number;
  is_allowed_package_water: number;
  is_allowed_package_internet: number;
  status: number;
  deleted_at?: Date | undefined;
  router_mac_address: string;
  router_ssid?: string | undefined;
  router_secondary_ip?: string | undefined;
  router_pass?: string | undefined;
  router_secret?: string | undefined;
  router_alias?: string | undefined;
  router_hostname?: string | undefined;
  washing_router_ssid?: string | undefined;
  washing_router_pass?: string | undefined;
  selected_camps?: string[] | undefined;
  camp_uuid?: string | undefined;
  site: string;
  site_type: string;
  mobile_numbers?: string[] | undefined;
  createdAt: Date;
  updatedAt: Date;
};

export type CampOccupancySummary = {
  id: string;
  camp_name: string;
  camp_address: string;
  camp_city: string;
  totalZones: number;
  totalBuildings: number;
  totalRooms: number;
  totalOccupancy: number;
  totalOccupiedBeds: number;
  totalAvailableBeds: number;
  occupancyPercentage: number;
  status: any;
};

export type PaginatedCampOccupancySummary = {
  data: CampOccupancySummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

