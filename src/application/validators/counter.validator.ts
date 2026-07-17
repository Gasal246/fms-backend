import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

export class CounterValidator {
  static validateCreate(data: any) {
    const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
      "string.pattern.base": "{#label} must be a valid MongoDB ObjectId",
    });

    const schema = Joi.object({
      client_id: objectIdSchema.required(),
      camp_id: objectIdSchema.required(),
      zone_id: objectIdSchema.required(),
      counter_name: Joi.string().trim().required().messages({
        "string.empty": "Counter name is required",
        "any.required": "Counter name is required"
      }),
      description: Joi.string().trim().allow("").optional(),
      status: Joi.string().valid("Active", "Inactive").optional(),
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
      counter_name: Joi.string().trim().optional(),
      description: Joi.string().trim().allow("").optional(),
      status: Joi.string().valid("Active", "Inactive").optional(),
      updated_by: objectIdSchema.required()
    });

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }
}
