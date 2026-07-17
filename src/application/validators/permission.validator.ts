import Joi from "joi";
import { AppError } from "../../shared/utils/AppError.js";

export class PermissionValidator {
  static validateAssignPermissions(data: any) {
    const objectIdSchema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).messages({
      "string.pattern.base": "{#label} must be a valid MongoDB ObjectId",
    });

    const schema = Joi.object({
      role_id: objectIdSchema.required().messages({
        "any.required": "role_id is required",
      }),
      permission_ids: Joi.array().items(objectIdSchema).required().messages({
        "array.base": "permission_ids must be an array",
        "any.required": "permission_ids is required",
      }),
    });

    const { error } = schema.validate(data);
    if (error) {
      throw new AppError(error.details?.[0]?.message || "Validation error", 400);
    }
  }
}
