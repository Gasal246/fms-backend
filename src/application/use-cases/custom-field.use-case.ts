import type { CustomFieldRepository } from "../../domain/repositories/custom-field.repository.interface.js";
import type {
  CustomFieldDefinitionRequest,
  CustomFieldDefinitionResponse,
  CustomFieldValidationResult,
  FieldDefinitionRequest,
} from "../../domain/types/custom-field.types.js";
import { AppError } from "../../shared/utils/AppError.js";

export class CustomFieldUseCase {
  constructor(private readonly repo: CustomFieldRepository) {}

  async getDefinition(
    clientId: string,
    module: string
  ): Promise<CustomFieldDefinitionResponse | null> {
    return this.repo.findByClientAndModule(clientId, module);
  }

  async upsertDefinition(
    data: Omit<CustomFieldDefinitionRequest, "client_id">,
    clientId: string
  ): Promise<CustomFieldDefinitionResponse> {
    // Validate field keys are unique within the definition
    const keys = data.fields.map((f) => f.key);
    const uniqueKeys = new Set(keys);
    if (uniqueKeys.size !== keys.length) {
      throw new AppError("Custom field keys must be unique within a module", 400);
    }

    // Validate each field
    for (const field of data.fields) {
      if (!field.key || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.key)) {
        throw new AppError(
          `Invalid field key "${field.key}". Keys must start with a letter or underscore and contain only alphanumeric characters and underscores.`,
          400
        );
      }
      if (!field.label) {
        throw new AppError(`Field "${field.key}" must have a label`, 400);
      }
      if (["select", "multi_select", "radio"].includes(field.type)) {
        if (!field.options || field.options.length === 0) {
          throw new AppError(
            `Field "${field.key}" of type "${field.type}" must have options`,
            400
          );
        }
      }
    }

    return this.repo.upsert({ ...data, client_id: clientId });
  }

  /**
   * Validate a custom data payload against the stored field definitions.
   * Returns { valid, errors[] }.
   */
  async validateCustomDataPayload(
    clientId: string,
    module: string,
    payload: Record<string, any>
  ): Promise<CustomFieldValidationResult> {
    const definition = await this.repo.findByClientAndModule(clientId, module);
    if (!definition) {
      return { valid: true, errors: [] }; // No definition = no constraints
    }

    const errors: Array<{ key: string; message: string }> = [];
    const activeFields = definition.fields.filter((f) => f.is_active !== false);

    for (const field of activeFields) {
      const value = payload[field.key];
      const isEmpty = value === undefined || value === null || value === "";

      // Required check
      if (field.required && isEmpty) {
        errors.push({ key: field.key, message: `${field.label} is required` });
        continue;
      }

      if (isEmpty) continue;

      // Type-specific validation
      switch (field.type) {
        case "email":
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push({ key: field.key, message: `${field.label} must be a valid email` });
          }
          break;
        case "number":
          if (isNaN(Number(value))) {
            errors.push({ key: field.key, message: `${field.label} must be a number` });
          } else {
            const num = Number(value);
            if (field.number_config?.min !== undefined && num < field.number_config.min) {
              errors.push({
                key: field.key,
                message: `${field.label} must be at least ${field.number_config.min}`,
              });
            }
            if (field.number_config?.max !== undefined && num > field.number_config.max) {
              errors.push({
                key: field.key,
                message: `${field.label} must be at most ${field.number_config.max}`,
              });
            }
          }
          break;
        case "date":
          {
            const d = new Date(value);
            if (isNaN(d.getTime())) {
              errors.push({ key: field.key, message: `${field.label} must be a valid date` });
            } else {
              if (
                field.date_config?.min_date &&
                d < new Date(field.date_config.min_date)
              ) {
                errors.push({
                  key: field.key,
                  message: `${field.label} must be on or after ${field.date_config.min_date}`,
                });
              }
              if (
                field.date_config?.max_date &&
                d > new Date(field.date_config.max_date)
              ) {
                errors.push({
                  key: field.key,
                  message: `${field.label} must be on or before ${field.date_config.max_date}`,
                });
              }
            }
          }
          break;
        case "select":
        case "radio": {
          const allowedValues = (field.options ?? []).map((o) => o.value);
          if (!allowedValues.includes(value)) {
            errors.push({
              key: field.key,
              message: `${field.label} must be one of: ${allowedValues.join(", ")}`,
            });
          }
          break;
        }
        case "multi_select": {
          const vals = Array.isArray(value) ? value : [value];
          const allowedValues = (field.options ?? []).map((o) => o.value);
          for (const v of vals) {
            if (!allowedValues.includes(v)) {
              errors.push({
                key: field.key,
                message: `${field.label}: value "${v}" is not allowed`,
              });
            }
          }
          break;
        }
        case "text":
        case "textarea": {
          const strVal = String(value);
          if (
            field.validation?.min_length &&
            strVal.length < field.validation.min_length
          ) {
            errors.push({
              key: field.key,
              message: `${field.label} must be at least ${field.validation.min_length} characters`,
            });
          }
          if (
            field.validation?.max_length &&
            strVal.length > field.validation.max_length
          ) {
            errors.push({
              key: field.key,
              message: `${field.label} must not exceed ${field.validation.max_length} characters`,
            });
          }
          if (field.validation?.regex) {
            const re = new RegExp(field.validation.regex);
            if (!re.test(strVal)) {
              errors.push({
                key: field.key,
                message: `${field.label} format is invalid`,
              });
            }
          }
          break;
        }
        default:
          break;
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
