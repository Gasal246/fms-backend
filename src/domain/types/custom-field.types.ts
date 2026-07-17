export type CustomFieldTypeDomain =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "select"
  | "multi_select"
  | "radio"
  | "checkbox"
  | "boolean"
  | "file";

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldValidationConfig {
  regex?: string;
  min_length?: number;
  max_length?: number;
  min_value?: number;
  max_value?: number;
  allowed_file_types?: string[];
  max_file_size_bytes?: number;
  date_min?: string;
  date_max?: string;
}

export interface ShowWhenConfig {
  field_key: string;
  operator: "equals" | "not_equals" | "contains" | "exists";
  value?: any;
}

export interface FieldDefinitionRequest {
  key: string;
  label: string;
  type: CustomFieldTypeDomain;
  required?: boolean;
  placeholder?: string;
  default_value?: any;
  options?: FieldOption[];
  validation?: FieldValidationConfig;
  section?: string;
  order: number;
  help_text?: string;
  is_active?: boolean;
  show_when?: ShowWhenConfig;
  width?: "full" | "half" | "third";
  allow_multiple?: boolean;
  file_config?: { allowed_types: string[]; max_size_bytes: number; multiple: boolean };
  date_config?: { min_date?: string; max_date?: string; format?: string };
  number_config?: { min?: number; max?: number; step?: number; decimal_places?: number };
}

// ── Request / Response ─────────────────────────────────────────────

export interface CustomFieldDefinitionRequest {
  client_id: string;
  module: string;
  entity_type?: string;
  fields: FieldDefinitionRequest[];
  created_by?: string;
  updated_by?: string;
}

export interface CustomFieldDefinitionResponse {
  id: string;
  client_id: string;
  module: string;
  entity_type?: string;
  fields: FieldDefinitionRequest[];
  created_by?: string;
  updated_by?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Validate Custom Field Payload ──────────────────────────────────

export interface CustomFieldValidationError {
  key: string;
  message: string;
}

export interface CustomFieldValidationResult {
  valid: boolean;
  errors: CustomFieldValidationError[];
}
