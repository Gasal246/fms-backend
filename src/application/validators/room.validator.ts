import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

export class RoomValidator {
  static validateCreateRoom(data: any) {
    const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
      "string.pattern.base": "{#label} must be a valid MongoDB ObjectId",
    });

    const schema = Joi.object({
      client_id: objectIdSchema.required(),
      camp_id: objectIdSchema.required(),
      zone_id: objectIdSchema.required(),
      building_id: objectIdSchema.required(),
      floor: Joi.number().required().messages({
        "number.base": "Floor must be a number",
        "any.required": "Floor is required",
      }),
      room_number: Joi.string().required().messages({
        "string.empty": "Room number is required",
        "any.required": "Room number is required",
      }),
      space: Joi.number().min(0).messages({
        "number.base": "Space must be a number",
        "number.min": "Space cannot be negative",
      }),
      occupancy: Joi.number().min(0).messages({
        "number.base": "Occupancy must be a number",
        "number.min": "Occupancy cannot be negative",
      }),
      status: Joi.number().valid(0, 1, 2).default(1).messages({
        "any.only": "Status must be either 0 (inactive) or 1 (active)",
      }),
      company_id: objectIdSchema.allow(null),
      contract_id: objectIdSchema.allow(null),
      company_assigned_room_id: objectIdSchema.allow(null),

    });

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }
}
