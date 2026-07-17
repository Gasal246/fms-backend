import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({ "string.pattern.base": "{#label} must be a valid MongoDB ObjectId" });

const ALLOCATION_TYPES = ["ROOM", "BED", "BUILDING", "FLOOR", "HEADCOUNT"] as const;
const ALLOCATION_STATUSES = ["Active", "Expired", "Suspended", "Cancelled"] as const;

export class ContractAllocationValidator {
  static validateCreate(data: any): void {
    const schema = Joi.object({
      contract_id: objectId.required().label("contract_id"),
      company_id: objectId.required().label("company_id"),
      allocation_type: Joi.string()
        .valid(...ALLOCATION_TYPES)
        .required()
        .label("allocation_type"),

      site_id: objectId.optional().label("site_id"),
      building_id: objectId.optional().label("building_id"),
      floor_id: objectId.optional().label("floor_id"),
      room_id: objectId.optional().label("room_id"),
      bed_id: objectId.optional().label("bed_id"),

      quantity: Joi.number().integer().min(1).optional(),
      rate: Joi.number().min(0).optional(),
      start_date: Joi.date().iso().required(),
      end_date: Joi.date().iso().greater(Joi.ref("start_date")).required().messages({
        "date.greater": "end_date must be after start_date",
      }),
      remarks: Joi.string().optional().allow(""),
      status: Joi.string()
        .valid(...ALLOCATION_STATUSES)
        .optional(),
    });

    const { error } = schema.validate(data, { abortEarly: false });
    if (error) {
      const msg = error.details.map((d) => d.message).join("; ");
      throw new AppError(msg, 400);
    }
  }

  static validateUpdate(data: any): void {
    const schema = Joi.object({
      allocation_type: Joi.string()
        .valid(...ALLOCATION_TYPES)
        .optional(),
      site_id: objectId.optional(),
      building_id: objectId.optional(),
      floor_id: objectId.optional(),
      room_id: objectId.optional(),
      bed_id: objectId.optional(),
      quantity: Joi.number().integer().min(1).optional(),
      rate: Joi.number().min(0).optional(),
      start_date: Joi.date().iso().optional(),
      end_date: Joi.date().iso().optional(),
      remarks: Joi.string().optional().allow(""),
      status: Joi.string()
        .valid(...ALLOCATION_STATUSES)
        .optional(),
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
