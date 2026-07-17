
export type CreateRoomRequest = {
  client_id: string;
  company_id?: string;
  contract_id?: string | null;
  company_assigned_room_id?: string | null;
  camp_id: string;
  zone_id: string;
  building_id: string;
  floor: number;
  room_number: string;
  space: number;
  occupancy: number;
  status?: number;
};

export type RoomFilter = {
  client_id?: string | undefined;
  company_id?: string | undefined;
  contract_id?: string | undefined | null;
  company_assigned_room_id?: string | undefined | null;
  camp_id?: string | undefined;
  zone_id?: string | undefined;
  building_id?: string | undefined;
  floor?: number | undefined;
  room_number?: string | undefined;
  room_id?: string | undefined;
  status?: number | undefined;
  room_status?: string | undefined;
  assigned_camps?: string[] | undefined;
  assigned_zones?: string[] | undefined;
  nationality?: string | undefined;
  country_state?: string | undefined;
};

export type UpdateRoomRequest = {
  client_id?: string;
  company_id?: string;
  contract_id?: string | null;
  company_assigned_room_id?: string | null;
  camp_id?: string;
  zone_id?: string;
  building_id?: string;
  floor?: number;
  room_number?: string;
  space?: number;
  occupancy?: number;
  status?: number;
  bed_id?: string;
};

export type RoomResponse = {
  id: string;
  client_id: string;
  company_id?: { id: string; company_name: string } | null;
  contract_id?: { id: string; contract_name: string } | string | null;
  company_assigned_room_id?: string | any | null;
  camp_id: string;
  zone_id: string;
  building_id: string;
  floor: number;
  room_number: string;
  space: number;
  occupancy: number;
  status: number;
  nationality_summary?: string[];
  country_state_summary?: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type PaginatedRoomResponse = {
  items: RoomResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
