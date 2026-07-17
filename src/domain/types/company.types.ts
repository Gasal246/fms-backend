export interface CompanyFilter {
  client_id?: string;
  search?: string;
  status?: string;
  company_type?: string;
  assigned_site?: string;
  date_from?: string;
  date_to?: string;
}

export interface CompanyRequest {
  // ── System ───────────────────────────────────────────────────
  client_id: string;

  // ── Section 1: Company Info ──────────────────────────────────
  company_name: string;
  company_code: string;
  company_type: string;

  // ── Section 2: Primary Contact ───────────────────────────────
  primary_contact_name: string;
  primary_contact_designation?: string;
  primary_contact_phone: string;
  primary_contact_email: string;

  // ── Section 3: Secondary Contact ─────────────────────────────
  secondary_contact_name?: string;
  secondary_contact_phone?: string;

  // ── Section 4: Address Details ───────────────────────────────
  registered_address: string;
  city: string;
  country: string;

  // ── Section 5: Tax / Legal ───────────────────────────────────
  cr_number?: string;
  cr_expiry_date?: string | Date;
  vat_number?: string;

  // ── Section 6: Billing Details ───────────────────────────────
  billing_contact_name: string;
  billing_email: string;
  payment_terms: string;
  billing_model: string;
  currency: string;
  credit_limit?: number;

  // ── Section 7: Operational Details ──────────────────────────
  declared_headcount: number;
  assigned_sites?: string[];
  account_manager?: string;
  onboarded_date: string | Date;
  status: string;

  // ── Section 8: Compliance Info ───────────────────────────────
  compliance_required?: boolean;
  last_review_date?: string | Date;

  // ── Legacy fields ────────────────────────────────────────────
  alias?: string;
  role_id?: string;
  password?: string;
  email?: string;
  phone?: string;
  contact_person?: string;
  address?: string;
  country_id?: string;
  logo?: string;
  description?: string;
  employee_count?: number;

  // ── Dynamic custom fields ────────────────────────────────────
  custom_data?: Record<string, any>;
}

export interface CompanyResponse {
  id: string;
  client_id: string;

  // ── Section 1: Company Info ──────────────────────────────────
  company_name: string;
  company_code: string;
  company_type: string;

  // ── Section 2: Primary Contact ───────────────────────────────
  primary_contact_name: string;
  primary_contact_designation?: string;
  primary_contact_phone: string;
  primary_contact_email: string;

  // ── Section 3: Secondary Contact ─────────────────────────────
  secondary_contact_name?: string;
  secondary_contact_phone?: string;

  // ── Section 4: Address Details ───────────────────────────────
  registered_address: string;
  city: string;
  country: string;

  // ── Section 5: Tax / Legal ───────────────────────────────────
  cr_number?: string;
  cr_expiry_date?: Date;
  vat_number?: string;

  // ── Section 6: Billing Details ───────────────────────────────
  billing_contact_name: string;
  billing_email: string;
  payment_terms: string;
  billing_model: string;
  currency: string;
  credit_limit?: number;

  // ── Section 7: Operational Details ──────────────────────────
  declared_headcount: number;
  assigned_sites?: string[];
  account_manager?: string;
  onboarded_date: Date;
  status: string;

  // ── Section 8: Compliance Info ───────────────────────────────
  compliance_required: boolean;
  last_review_date?: Date;

  // ── Legacy fields ────────────────────────────────────────────
  alias?: string;
  role_id?: string;
  email?: string;
  phone?: string;
  contact_person?: string;
  address?: string;
  country_id?: string;
  logo?: string;
  description?: string;
  employee_count?: number;

  // ── Dynamic custom fields ────────────────────────────────────
  custom_data?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedCompanyResponse {
  items: CompanyResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Summary ──────────────────────────────────────────────────────────

export interface CompanySummary {
  company_id: string;
  company_name: string;
  active_tenants: number;
  active_contracts: number;
  active_room_allocations: number;
  active_bed_allocations: number;
  compliance_status: 'Compliant' | 'Non-Compliant' | 'Review Required';
}
