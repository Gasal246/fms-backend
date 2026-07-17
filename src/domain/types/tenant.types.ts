import type mongoose from "mongoose";

export type TenantRegistrationRequest = {
  name: string;
  email: string;
  password: string;
  country_code: number;
  phone: string;
  company_name: string;
  client_name: string;
  country_id: string;
  country_state?: string;
  home_address?: string;
  type?: string;
  allocation_status?: string;
  company_id?: mongoose.Types.ObjectId | string;
  camp_id?: string;
  gender?: string;
  contract_end_date?: string | Date | null;
  user_image?: string;

  // New onboarding & compliance fields
  first_name?: string;
  last_name?: string;
  nationality?: string;
  dob?: string | Date;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  status?: number;
  passport_no?: string;
  passport_country?: string;
  passport_issue_date?: string | Date | null;
  passport_expiry_date?: string | Date | null;
  passport_verification_status?: string;
  passport_image?: string;
  passport_rejection_reason?: string;
  government_ids?: any[];
  visa_residency?: any[];
  documents?: any[];
  activity_log?: any[];
  employee_id?: string;
};

export type TenantResponse = {
  id: string;
  name: string;
  email: string;
  country_code: number;
  phone: string;
  client_name: string;
  company_id?: string;
  company_name?: string;
  camp_id?: string;
  country_id: string;
  country_state?: string;
  home_address?: string;
  status: number;
  type?: string;
  allocation_status?: string;
  uuid?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  gender?: string;
  contract_end_date?: string | Date | null;
  user_image?: string;
  employee_id?: string;

  // Compliance details
  compliance_score?: number;
  missing_docs_count?: number;
  expiring_docs_count?: number;
  expired_docs_count?: number;
  missing_docs?: string[];

  // New onboarding & compliance fields
  first_name?: string;
  last_name?: string;
  nationality?: string;
  dob?: string | Date;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  passport_no?: string;
  passport_country?: string;
  passport_issue_date?: string | Date | null;
  passport_expiry_date?: string | Date | null;
  passport_verification_status?: string;
  passport_rejection_reason?: string;
  passport_image?: string;
  passport_file_id?: string;
  government_ids?: any[];
  visa_residency?: any[];
  documents?: any[];
  activity_log?: any[];
};

export type PaginatedTenantResponse = {
  data: TenantResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type TenantFilter = {
  name?: string;
  email?: string;
  status?: number | undefined;
  type?: string;
  client_id?: string;
  country_state?: string;
  /** Case-insensitive partial match against name OR email */
  search?: string;
  /** Filter by Site (Camp) ObjectId — resolves via zone.camp_id lookup */
  site?: string;
  camp_id?: string;
  /** Filter by Zone ObjectId (direct field on tenant) */
  zone?: string;
  /** Filter by Building ObjectId (direct field on tenant) */
  building?: string;
  /** Filter by Room ObjectId (direct field on tenant) */
  room?: string;
  role?: string;
  assigned_camps?: any[];
  contract_id?: string;
};
