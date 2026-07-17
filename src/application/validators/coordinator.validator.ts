import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

export class CoordinatorValidator {
  static validateCreateCoordinator(data: any) {
    const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
      "string.pattern.base": "{#label} must be a valid MongoDB ObjectId",
    });

    const schema = Joi.object({
      full_name: Joi.string().optional().allow("").messages({
        "string.empty": "Full name is required",
        "any.required": "Full name is required",
      }),
      email: Joi.string().email().optional().allow("").messages({
        "string.email": "Please provide a valid email address",
        "string.empty": "Email is required",
        "any.required": "Email is required",
      }),
      camp_id: Joi.string().optional().allow("").messages({
        "string.empty": "Camp ID is required",
        "any.required": "Camp ID is required",
      }),
      phone: Joi.string().optional().allow(""),
      password: Joi.string().optional().allow("").min(6).messages({
        "string.min": "Password must be at least 6 characters",
        "string.empty": "Password is required",
        "any.required": "Password is required",
      }),
      status: Joi.number().optional().allow(null),
      profile_picture: Joi.string().optional().allow(null, ""),
      client_id: objectIdSchema.optional().allow(null).messages({
        "any.required": "Client ID is required",
      }),
      role_id: Joi.string().optional().allow("", null),
      slug: Joi.string().optional().allow("", null),
      zone_id: Joi.string().optional().allow("", null),
    }).unknown(true); 

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }
}
