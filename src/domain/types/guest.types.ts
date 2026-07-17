export type GuestFilter = {
  Camp_id?: string;
  Client_id?: string;
  Zone_id?: string;
  Guest_name?: string;
  Hosted_by?: string;
  Created_by?: string;
  search?: string;
  status?: "Checked-In" | "Checked-Out";
};

export type GuestRequest = {
  Camp_id?: string | null;
  Client_id?: string | null;
  Zone_id?: string | null;
  Guest_name: string;
  Purpose?: string | null;
  Hosted_by: string;
  Hosted_by_model: "user_register" | "coordinator";
  Created_by: string;
  Created_by_model: "coordinator" | "clients";
  Entry_time: string | Date;
  Exit_time?: string | Date | null;
  Expected_exit_time?: string | Date | null;
  status?: "Checked-In" | "Checked-Out";
};

export type GuestResponse = {
  id: string;
  _id: string;
  Camp_id: string | null;
  Camp_name: string | null;
  Client_id: string | null;
  Zone_id: string | null;
  Zone_name: string | null;
  Guest_name: string;
  Purpose: string | null;
  Hosted_by: any;
  Hosted_by_name: string | null;
  Hosted_by_model: string;
  Created_by: any;
  Created_by_name: string | null;
  Created_by_model: string;
  Entry_time: Date;
  Exit_time: Date | null;
  Expected_exit_time: Date | null;
  status: "Checked-In" | "Checked-Out";
  createdAt: Date;
  updatedAt: Date;
};

export type PaginatedGuestResponse = {
  items: GuestResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
