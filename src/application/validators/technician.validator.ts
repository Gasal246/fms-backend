import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

export class TechnicianValidator {
  static validateCreateTechnician(data: any) {
    const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
      "string.pattern.base": "{#label} must be a valid MongoDB ObjectId",
    });

    const schema = Joi.object({
      name: Joi.string().optional().messages({
        "string.empty": "Name is required",
        "any.required": "Name is required",
      }),
      email: Joi.string().email().optional().messages({
        "string.email": "Please provide a valid email address",
        "string.empty": "Email is required",
        "any.required": "Email is required",
      }),
      phone: Joi.string().optional().messages({
        "string.empty": "Phone number is required",
        "any.required": "Phone number is required",
      }),
      password: Joi.string().optional().min(6).messages({
        "string.min": "Password must be at least 6 characters",
        "string.empty": "Password is required",
        "any.required": "Password is required",
      }),
      client_id: objectIdSchema.optional().messages({
        "any.required": "Client ID is required",
      }),
      status: Joi.number().optional().messages({
        "any.required": "Status is required",
      }),
      profile_picture: Joi.string().optional().allow(null, ""),

    });

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }
}
