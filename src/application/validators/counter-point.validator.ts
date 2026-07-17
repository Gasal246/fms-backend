import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

export class CounterPointValidator {
  static validateCreate(data: any) {
    const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
      "string.pattern.base": "{#label} must be a valid MongoDB ObjectId",
    });

    const schema = Joi.object({
      client_id: objectIdSchema.required(),
      camp_id: objectIdSchema.required(),
      zone_id: objectIdSchema.required(),
      counter_id: objectIdSchema.required(),
      name: Joi.string().trim().required().messages({
        "string.empty": "Counter Point name is required",
        "any.required": "Counter Point name is required"
      }),
      direction_label: Joi.string().valid("entry", "exit", "both").required().messages({
        "any.only": "Direction must be entry, exit or both",
        "any.required": "Direction is required"
      }),
      description: Joi.string().trim().allow("").optional(),
      status: Joi.string().valid("active", "inactive").optional(),
      created_by: objectIdSchema.required()
    });

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }

  static validateUpdate(data: any) {
    const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
      "string.pattern.base": "{#label} must be a valid MongoDB ObjectId",
    });

    const schema = Joi.object({
      camp_id: objectIdSchema.optional(),
      zone_id: objectIdSchema.optional(),
      counter_id: objectIdSchema.optional(),
      name: Joi.string().trim().optional(),
      direction_label: Joi.string().valid("entry", "exit", "both").optional().messages({
        "any.only": "Direction must be entry, exit or both"
      }),
      description: Joi.string().trim().allow("").optional(),
      status: Joi.string().valid("active", "inactive").optional(),
      updated_by: objectIdSchema.required()
    });

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }
}
