import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

export class MachineBindingValidator {
  static validateBind(data: any) {
    const schema = Joi.object({
      machine_id: Joi.string().trim().required().messages({
        "string.empty": "Machine ID is required",
        "any.required": "Machine ID is required"
      }),
      mac_id: Joi.string().trim().required().messages({
        "string.empty": "MAC Address is required",
        "any.required": "MAC Address is required"
      })
    });

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }
}
