import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

export class GuestValidator {
  static validateCreateGuest(data: any) {
    const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
      "string.pattern.base": "{#label} must be a valid MongoDB ObjectId",
    });

    const schema = Joi.object({
      Camp_id: objectIdSchema.optional().allow(null, ""),
      Client_id: objectIdSchema.optional().allow(null, ""),
      Zone_id: objectIdSchema.optional().allow(null, ""),
      Guest_name: Joi.string().required().messages({
        "string.empty": "Guest name is required",
        "any.required": "Guest name is required",
      }),
      Purpose: Joi.string().optional().allow(null, ""),
      Hosted_by: objectIdSchema.required().messages({
        "any.required": "Hosted_by ID is required",
      }),
      Hosted_by_model: Joi.string().valid("user_register", "coordinator").optional().messages({
        "any.only": "Hosted_by_model must be 'user_register' or 'coordinator'",
      }),
      Created_by: objectIdSchema.required().messages({
        "any.required": "Created_by ID is required",
      }),
      Created_by_model: Joi.string().valid("coordinator", "clients").optional().messages({
        "any.only": "Created_by_model must be 'coordinator' or 'clients'",
      }),
      Entry_time: Joi.date().required().messages({
        "any.required": "Entry time is required",
      }),
      Exit_time: Joi.date().when("status", {
        is: "Checked-Out",
        then: Joi.date().required().messages({
          "any.required": "Exit time is required when Checked-Out"
        }),
        otherwise: Joi.date().optional().allow(null, "")
      }),
      Expected_exit_time: Joi.date().optional().allow(null, ""),
      status: Joi.string().valid("Checked-In", "Checked-Out").default("Checked-In"),
    }).unknown(true);

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }

  static validateUpdateGuest(data: any) {
    const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
      "string.pattern.base": "{#label} must be a valid MongoDB ObjectId",
    });

    const schema = Joi.object({
      Camp_id: objectIdSchema.optional().allow(null, ""),
      Client_id: objectIdSchema.optional().allow(null, ""),
      Zone_id: objectIdSchema.optional().allow(null, ""),
      Guest_name: Joi.string().optional(),
      Purpose: Joi.string().optional().allow(null, ""),
      Hosted_by: objectIdSchema.optional(),
      Hosted_by_model: Joi.string().valid("user_register", "coordinator").optional(),
      Created_by: objectIdSchema.optional(),
      Created_by_model: Joi.string().valid("coordinator", "clients").optional(),
      Entry_time: Joi.date().optional(),
      Exit_time: Joi.date().when("status", {
        is: "Checked-Out",
        then: Joi.date().required().messages({
          "any.required": "Exit time is required when Checked-Out"
        }),
        otherwise: Joi.date().optional().allow(null, "")
      }),
      Expected_exit_time: Joi.date().optional().allow(null, ""),
      status: Joi.string().valid("Checked-In", "Checked-Out").optional(),
    }).unknown(true);

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }
}
