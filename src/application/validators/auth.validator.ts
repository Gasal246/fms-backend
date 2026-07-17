import Joi from "joi";
import { logger } from "../../shared/logger/logger.js";
export class AuthValidator {

    static validateLogin(data: { email: string; password: string; role_slug: string }) {

        const schema = Joi.object({
            email: Joi.string()
                .email()
                .required()
                .messages({
                    "string.empty": "Email is required",
                    "string.email": "Invalid email format"
                }),

            password: Joi.string()
                .min(6)
                .required()
                .messages({
                    "string.empty": "Password is required",
                    "string.min": "Password must be at least 6 characters"
                }),
                
            role_slug: Joi.string()
                .required()
                .messages({
                    "string.empty": "Role slug is required"
                })
        });

        const { error } = schema.validate(data);

        if (error) {
            logger.error(`Validation error is ${error.details?.[0]?.message || "Validation error"}`);
            throw new Error(error.details?.[0]?.message || "Validation error");
        }
    }
}