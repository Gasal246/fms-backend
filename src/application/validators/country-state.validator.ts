import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

export class CountryStateValidator {
  static validateCreateCountryState(data: any) {
    const schema = Joi.object({
      nationality_name: Joi.string().required().trim().messages({
        "string.empty": "Nationality name is required",
        "any.required": "Nationality name is required",
      }),
      country_state_name: Joi.string().required().trim().messages({
        "string.empty": "Country State name is required",
        "any.required": "Country State name is required",
      }),
    });

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }

  static validateUpdateCountryState(data: any) {
    const schema = Joi.object({
      nationality_name: Joi.string().optional().trim(),
      country_state_name: Joi.string().optional().trim(),
    });

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }
}
