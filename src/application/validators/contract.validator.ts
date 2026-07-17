import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({ "string.pattern.base": "{#label} must be a valid MongoDB ObjectId" });

const BILLING_MODELS = ["Per Room", "Per Bed", "Per Head", "Flat Fee"] as const;
const STATUSES = [
  "Draft",
  "Pending Approval",
  "Approved",
  "Active",
  "Expiring Soon",
  "Expired",
  "Suspended",
  "Terminated",
  "Renewed",
  "Scheduled",
] as const;

export class ContractValidator {
  static validateCreate(data: any): void {
    const schema = Joi.object({
      company_id: objectId.required().label("company_id"),
      contract_number: Joi.string().trim().required().label("contract_number"),
      contract_name: Joi.string().trim().required().label("contract_name"),
      billing_model: Joi.string()
        .valid(...BILLING_MODELS)
        .required()
        .label("billing_model"),
      currency: Joi.string().trim().required().label("currency"),
      start_date: Joi.date().iso().required().label("start_date"),
      end_date: Joi.date().iso().greater(Joi.ref("start_date")).required().messages({
        "date.greater": "end_date must be after start_date",
      }),
      status: Joi.string()
        .valid(...STATUSES)
        .optional(),
      notes: Joi.string().optional().allow(""),
      auto_renew: Joi.boolean().optional(),
      max_head_count: Joi.number().integer().min(0).optional(),
      room_count: Joi.number().integer().min(0).optional(),
      expire_alert_days: Joi.number().integer().min(0).optional(),

      agreed_rate: Joi.number().min(0).optional(),
      grace_period_days: Joi.number().integer().min(0).optional(),
      notice_period_days: Joi.number().integer().min(0).optional(),
      renewal_terms: Joi.string().optional().allow(""),
      contract_value: Joi.number().min(0).optional(),
      tax_mode: Joi.string().optional().allow(""),

      compliance_required: Joi.boolean().optional(),
      document_checklist: Joi.array().items(Joi.string()).optional(),
      created_by: Joi.string().optional().allow(""),
      updated_by: Joi.string().optional().allow(""),
      updated_by_role: Joi.string().optional().allow(""),
      termination_reason: Joi.string().optional().allow(""),
    });

    const { error } = schema.validate(data, { abortEarly: false });
    if (error) {
      const msg = error.details.map((d) => d.message).join("; ");
      throw new AppError(msg, 400);
    }
  }

  static validateUpdate(data: any): void {
    const schema = Joi.object({
      company_id: objectId.optional().label("company_id"),
      contract_number: Joi.string().trim().optional(),
      contract_name: Joi.string().trim().optional(),
      billing_model: Joi.string()
        .valid(...BILLING_MODELS)
        .optional(),
      currency: Joi.string().trim().optional(),
      start_date: Joi.date().iso().optional(),
      end_date: Joi.date().iso().optional(),
      status: Joi.string()
        .valid(...STATUSES)
        .optional(),
      notes: Joi.string().optional().allow(""),
      auto_renew: Joi.boolean().optional(),
      max_head_count: Joi.number().integer().min(0).optional(),
      room_count: Joi.number().integer().min(0).optional(),
      expire_alert_days: Joi.number().integer().min(0).optional(),

      agreed_rate: Joi.number().min(0).optional(),
      grace_period_days: Joi.number().integer().min(0).optional(),
      notice_period_days: Joi.number().integer().min(0).optional(),
      renewal_terms: Joi.string().optional().allow(""),
      contract_value: Joi.number().min(0).optional(),
      tax_mode: Joi.string().optional().allow(""),

      compliance_required: Joi.boolean().optional(),
      document_checklist: Joi.array().items(Joi.string()).optional(),
      created_by: Joi.string().optional().allow(""),
      updated_by: Joi.string().optional().allow(""),
      updated_by_role: Joi.string().optional().allow(""),
      termination_reason: Joi.string().optional().allow(""),
    })
      .min(1)
      .messages({ "object.min": "At least one field must be provided to update" });

    const { error } = schema.validate(data, { abortEarly: false });
    if (error) {
      const msg = error.details.map((d) => d.message).join("; ");
      throw new AppError(msg, 400);
    }
  }
}
