import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

const objectId = Joi.string()
  .regex(/^[0-9a-fA-F]{24}$/)
  .messages({ "string.pattern.base": "{#label} must be a valid MongoDB ObjectId" });

export class ContractExtensionValidator {
  static validate(data: any): void {
    const schema = Joi.object({
      new_end_date: Joi.date().iso().required().messages({
        "any.required": "new_end_date is required",
        "date.base": "new_end_date must be a valid date"
      }),
      extension_reason: Joi.string().optional().allow(""),
      document_id: objectId.optional().allow(null, ""),
    });

    const { error } = schema.validate(data, { abortEarly: false });
    if (error) {
      const msg = error.details.map((d) => d.message).join("; ");
      throw new AppError(msg, 400);
    }
  }
}
