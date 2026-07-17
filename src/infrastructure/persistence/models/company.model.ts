import mongoose, { Document } from "mongoose";

export interface ICompany extends Document {
  _id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;
  global_company_account_id?: mongoose.Types.ObjectId;

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
  assigned_sites?: mongoose.Types.ObjectId[];
  account_manager?: string;
  onboarded_date: Date;
  status: string;

  // ── Section 8: Compliance Info ───────────────────────────────
  compliance_required: boolean;
  last_review_date?: Date;

  // ── Legacy / system fields ───────────────────────────────────
  alias?: string;
  role_id?: mongoose.Types.ObjectId;
  password?: string;
  email?: string;
  phone?: string;
  contact_person?: string;
  address?: string;
  country_id?: mongoose.Types.ObjectId;
  logo?: string;
  description?: string;
  employee_count?: number;

  deleted_at?: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // ── Dynamic custom fields ────────────────────────────────────
  custom_data?: Record<string, any>;
}

const schema = new mongoose.Schema(
  {
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "client",
      required: true,
    },
    global_company_account_id: { type: mongoose.Schema.Types.ObjectId, ref: "global_company_accounts", default: null, index: true },

    // ── Section 1: Company Info ──────────────────────────────────
    company_name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },
    company_code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9_-]+$/,
    },
    company_type: {
      type: String,
      required: true,
      enum: ["Direct Client", "Government Entity", "Private Sector"],
      trim: true,
    },

    // ── Section 2: Primary Contact ───────────────────────────────
    primary_contact_name: {
      type: String,
      required: true,
      trim: true,
    },
    primary_contact_designation: {
      type: String,
      trim: true,
    },
    primary_contact_phone: {
      type: String,
      required: true,
      trim: true,
    },
    primary_contact_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    // ── Section 3: Secondary Contact ─────────────────────────────
    secondary_contact_name: {
      type: String,
      trim: true,
    },
    secondary_contact_phone: {
      type: String,
      trim: true,
    },

    // ── Section 4: Address Details ───────────────────────────────
    registered_address: {
      type: String,
      required: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },

    // ── Section 5: Tax / Legal ───────────────────────────────────
    cr_number: {
      type: String,
      trim: true,
    },
    cr_expiry_date: {
      type: Date,
    },
    vat_number: {
      type: String,
      trim: true,
    },

    // ── Section 6: Billing Details ───────────────────────────────
    billing_contact_name: {
      type: String,
      required: true,
      trim: true,
    },
    billing_email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    payment_terms: {
      type: String,
      required: true,
      trim: true,
    },
    billing_model: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
    },
    credit_limit: {
      type: Number,
      min: 0,
    },

    // ── Section 7: Operational Details ──────────────────────────
    declared_headcount: {
      type: Number,
      required: true,
      min: 1,
    },
    assigned_sites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "camps",
      },
    ],
    account_manager: {
      type: String,
      trim: true,
    },
    onboarded_date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      required: true,
      default: "Active",
    },

    // ── Section 8: Compliance Info ───────────────────────────────
    compliance_required: {
      type: Boolean,
      default: false,
    },
    last_review_date: {
      type: Date,
    },

    // ── Legacy / system fields ───────────────────────────────────
    alias: {
      type: String,
      uppercase: true,
      trim: true,
    },
    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },
    password: {
      type: String,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    contact_person: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    country_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "countries",
    },
    logo: {
      type: String,
      default: null,
    },
    description: {
      type: String,
      trim: true,
    },
    employee_count: {
      type: Number,
      default: 0,
    },
    deleted_at: {
      type: Date,
      default: null,
    },

    // ── Dynamic custom fields ────────────────────────────────────
    custom_data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

schema.index(
  { client_id: 1, company_code: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } }
);

schema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const Company = mongoose.model<ICompany>("companies", schema);
export default Company;
