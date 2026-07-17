export type BuildingFilter = {
  client_id?: string | undefined;
  camp_id?: string | undefined;
  zone_id?: string | undefined;
  status?: number | undefined;
};

export type BuildingResponse = {
  id: string;
  client_id: string | null;
  camp_id: string | null;
  zone_id: string | null;
  building_name: string | null;
  floors: number | null;
  status: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RoomSummary = {
  id: string;
  room_number: string;
  status: {
    id: string;
    name: string;
    slug: string;
  };
  totalBeds: number;
  occupiedBeds: number;
};

export type FloorSummary = {
  floorNumber: number;
  rooms: RoomSummary[];
};

export type BuildingOccupancySummary = {
  id: string;
  building_name: string;
  totalRooms: number;
  floors: FloorSummary[];
};

export type PaginatedBuildingOccupancySummary = {
  data: BuildingOccupancySummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
