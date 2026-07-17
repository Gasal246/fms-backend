import type { Response } from "express";
import { CustomFieldUseCase } from "../../application/use-cases/custom-field.use-case.js";
import { successResponse } from "../../shared/utils/responseHandler.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";
import { AppError } from "../../shared/utils/AppError.js";

export class CustomFieldController {
  constructor(private readonly customFieldUseCase: CustomFieldUseCase) {}

  getDefinition = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const module = req.query.module as string;
      if (!module) throw new AppError("module query parameter is required", 400);

      const client_id = req.user.client_id.toString();
      logger.info(`Fetching custom field definition for module: ${module}`);
      const definition = await this.customFieldUseCase.getDefinition(client_id, module);

      return successResponse(res, definition, "Custom field definition retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching custom field definition: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve definition" });
    }
  };

  upsertDefinition = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const client_id = req.user.client_id.toString();
      logger.info(`Upserting custom field definition for module: ${req.body.module}`);
      const definition = await this.customFieldUseCase.upsertDefinition(req.body, client_id);
      return successResponse(res, definition, "Custom field definition upserted successfully", 200);
    } catch (error: any) {
      logger.error(`Error upserting custom field definition: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to upsert definition" });
    }
  };

  validatePayload = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const client_id = req.user.client_id.toString();
      const { module, payload } = req.body;
      if (!module) throw new AppError("module is required", 400);
      if (!payload) throw new AppError("payload is required", 400);

      logger.info(`Validating custom field payload for module: ${module}`);
      const result = await this.customFieldUseCase.validateCustomDataPayload(client_id, module, payload);
      return successResponse(res, result, "Custom field payload validated successfully", 200);
    } catch (error: any) {
      logger.error(`Error validating custom field payload: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to validate payload" });
    }
  };
}
