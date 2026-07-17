export type AttendanceRequest = {
  user_id?: string;
  user_type?: "staff" | "tenant";
  uuid?: string;
  date?: string; // Optional manual date/time
  is_manual?: boolean;
  notes?: string;
};

export type AttendanceFilter = {
  client_id?: string;
  user_id?: string;
  user_type?: "staff" | "tenant";
  date?: string; // YYYY-MM-DD
  status?: "present" | "absent";
  page?: number;
  limit?: number;
  assigned_camps?: string[];
  assigned_zones?: string[];
};

export type AttendanceResponse = {
  id: string;
  user_id: string;
  user_type: string;
  client_id: string;
  date: Date;
  check_in: Date;
  check_out?: Date;
  is_manual: boolean;
  notes?: string;
  total_hours?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PaginatedAttendanceResponse = {
  items: AttendanceResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
