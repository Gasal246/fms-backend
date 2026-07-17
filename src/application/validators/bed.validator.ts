import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

export class BedValidator {
  static validateCreateBed(data: any) {
    const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
      "string.pattern.base": "{#label} must be a valid MongoDB ObjectId",
    });

    const schema = Joi.object({
      room_id: objectIdSchema.required().messages({
        "any.required": "Room ID is required",
      }),
      bed_number: Joi.string().required().messages({
        "string.empty": "Bed number is required",
        "any.required": "Bed number is required",
      }),
      status: Joi.string().valid("available", "occupied", "reserved").default("available"),
      type: Joi.string().valid("SINGLE_BED", "BUNK_UPPER", "BUNK_LOWER").default("SINGLE_BED"),
      tenant_id: objectIdSchema.allow(null).optional(),
    });

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }

  static validateUpdateBed(data: any) {
    const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
      "string.pattern.base": "{#label} must be a valid MongoDB ObjectId",
    });

    const schema = Joi.object({
      room_id: objectIdSchema.optional(),
      bed_number: Joi.string().optional(),
      status: Joi.string().valid("available", "occupied", "reserved").optional(),
      type: Joi.string().valid("SINGLE_BED", "BUNK_UPPER", "BUNK_LOWER").optional(),
      tenant_id: objectIdSchema.allow(null).optional(),
      assignment_date: Joi.date().iso().optional(),
    });

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }
}
