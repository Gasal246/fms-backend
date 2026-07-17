import mongoose, { Document, Schema } from "mongoose";

export type FieldType =
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

export interface IFieldValidation {
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

export interface IShowWhen {
  field_key: string;
  operator: "equals" | "not_equals" | "contains" | "exists";
  value?: any;
}

export interface IFileConfig {
  allowed_types: string[];
  max_size_bytes: number;
  multiple: boolean;
}

export interface IDateConfig {
  min_date?: string;
  max_date?: string;
  format?: string;
}

export interface INumberConfig {
  min?: number;
  max?: number;
  step?: number;
  decimal_places?: number;
}

export interface IFieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  default_value?: any;
  options?: Array<{ label: string; value: string }>;
  validation?: IFieldValidation;
  section?: string;
  order: number;
  help_text?: string;
  is_active: boolean;
  show_when?: IShowWhen;
  width?: "full" | "half" | "third";
  allow_multiple?: boolean;
  file_config?: IFileConfig;
  date_config?: IDateConfig;
  number_config?: INumberConfig;
}

export interface ICustomFieldDefinition extends Document {
  _id: mongoose.Types.ObjectId;
  client_id: mongoose.Types.ObjectId;
  module: string;
  entity_type?: string;
  fields: IFieldDefinition[];
  created_by?: string;
  updated_by?: string;
  createdAt: Date;
  updatedAt: Date;
}

const fieldDefinitionSchema = new Schema<IFieldDefinition>(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: [
        "text",
        "textarea",
        "number",
        "email",
        "phone",
        "date",
        "select",
        "multi_select",
        "radio",
        "checkbox",
        "boolean",
        "file",
      ],
    },
    required: { type: Boolean, default: false },
    placeholder: { type: String, trim: true },
    default_value: { type: Schema.Types.Mixed },
    options: [
      {
        label: { type: String },
        value: { type: String },
      },
    ],
    validation: { type: Schema.Types.Mixed },
    section: { type: String, trim: true },
    order: { type: Number, required: true, default: 0 },
    help_text: { type: String, trim: true },
    is_active: { type: Boolean, default: true },
    show_when: { type: Schema.Types.Mixed },
    width: { type: String, enum: ["full", "half", "third"], default: "full" },
    allow_multiple: { type: Boolean, default: false },
    file_config: { type: Schema.Types.Mixed },
    date_config: { type: Schema.Types.Mixed },
    number_config: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const customFieldDefinitionSchema = new Schema<ICustomFieldDefinition>(
  {
    client_id: {
      type: Schema.Types.ObjectId,
      ref: "client",
      required: true,
    },
    module: {
      type: String,
      required: true,
      trim: true,
    },
    entity_type: {
      type: String,
      trim: true,
    },
    fields: [fieldDefinitionSchema],
    created_by: { type: String, trim: true },
    updated_by: { type: String, trim: true },
  },
  { timestamps: true }
);

// ── Indexes ─────────────────────────────────────────────────────────
customFieldDefinitionSchema.index(
  { client_id: 1, module: 1 },
  { unique: true }
);

customFieldDefinitionSchema.method("toJSON", function () {
  const { __v, _id, ...object } = this.toObject() as any;
  object.id = _id;
  return object;
});

const CustomFieldDefinition = mongoose.model<ICustomFieldDefinition>(
  "custom_field_definitions",
  customFieldDefinitionSchema
);
export default CustomFieldDefinition;
