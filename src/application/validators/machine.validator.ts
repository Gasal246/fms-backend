import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

export class MachineValidator {
  static validateCreate(data: any) {
    const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
      "string.pattern.base": "{#label} must be a valid MongoDB ObjectId",
    });

    const schema = Joi.object({
      client_id: objectIdSchema.required(),
      machine_name: Joi.string().trim().required().messages({
        "string.empty": "Machine name is required",
        "any.required": "Machine name is required"
      }),
      machine_type: Joi.string().trim().required().messages({
        "string.empty": "Machine type is required",
        "any.required": "Machine type is required"
      }),
      manufacturer: Joi.string().trim().allow("").optional(),
      model: Joi.string().trim().allow("").optional(),
      serial_number: Joi.string().trim().allow("").optional(),
      description: Joi.string().trim().allow("").optional(),
      mac_id: Joi.string().trim().allow(null, "").optional(),
      binding_status: Joi.string().valid("pending", "bound", "unbound").optional(),
      assigned_status: Joi.string().valid("unallocated", "allocated").optional(),
      camp_id: objectIdSchema.required(),
      zone_id: objectIdSchema.required(),
      counter_id: objectIdSchema.required(),
      counter_point_id: objectIdSchema.required(),
      assigned_action: Joi.string().trim().allow(null, "").optional(),
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
      machine_name: Joi.string().trim().optional(),
      machine_type: Joi.string().trim().optional(),
      manufacturer: Joi.string().trim().allow("").optional(),
      model: Joi.string().trim().allow("").optional(),
      serial_number: Joi.string().trim().allow("").optional(),
      description: Joi.string().trim().allow("").optional(),
      mac_id: Joi.string().trim().allow(null, "").optional(),
      binding_status: Joi.string().valid("pending", "bound", "unbound").optional(),
      assigned_status: Joi.string().valid("unallocated", "allocated").optional(),
      camp_id: objectIdSchema.optional(),
      zone_id: objectIdSchema.optional(),
      counter_id: objectIdSchema.optional(),
      counter_point_id: objectIdSchema.optional(),
      assigned_action: Joi.string().trim().allow(null, "").optional(),
      status: Joi.string().valid("active", "inactive").optional(),
      updated_by: objectIdSchema.required()
    });

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }
}
