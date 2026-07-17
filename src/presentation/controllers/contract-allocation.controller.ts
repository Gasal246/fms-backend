import type { Response } from "express";
import { ContractAllocationUseCase } from "../../application/use-cases/contract-allocation.use-case.js";
import { successResponse } from "../../shared/utils/responseHandler.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";

export class ContractAllocationController {
  constructor(private readonly allocationUseCase: ContractAllocationUseCase) {}

  getAllocations = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const client_id = req.user.client_id.toString();

      const filters: any = {
        client_id,
        contract_id: req.query.contract_id as string,
        company_id: req.query.company_id as string,
        allocation_type: req.query.allocation_type as string,
        site_id: req.query.site_id as string,
        building_id: req.query.building_id as string,
        floor_id: req.query.floor_id as string,
        room_id: req.query.room_id as string,
        bed_id: req.query.bed_id as string,
        status: req.query.status as string,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
      };

      const result = await this.allocationUseCase.getAllAllocations(page, limit, filters);
      return successResponse(res, result, "Contract allocations retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching contract allocations: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve allocations" });
    }
  };

  getAllocationById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id.toString();
      logger.info(`Fetching contract allocation: ${id}`);
      const allocation = await this.allocationUseCase.getAllocationById(id, client_id);
      return successResponse(res, allocation, "Contract allocation retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching allocation ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve allocation" });
    }
  };

  createAllocation = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const client_id = req.user.client_id.toString();
      const contract_id = (req.params.contractId as string) || req.body.contract_id;
      logger.info(`Creating allocation for contract: ${contract_id}`);
      const allocation = await this.allocationUseCase.createAllocation(
        { ...req.body, contract_id },
        client_id
      );
      return successResponse(res, allocation, "Contract allocation created successfully", 201);
    } catch (error: any) {
      logger.error(`Error creating contract allocation: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to create allocation" });
    }
  };

  updateAllocation = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id.toString();
      logger.info(`Updating contract allocation: ${id}`);
      const allocation = await this.allocationUseCase.updateAllocation(id, client_id, req.body);
      return successResponse(res, allocation, "Contract allocation updated successfully", 200);
    } catch (error: any) {
      logger.error(`Error updating allocation ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to update allocation" });
    }
  };

  deleteAllocation = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id.toString();
      logger.info(`Deleting contract allocation: ${id}`);
      await this.allocationUseCase.deleteAllocation(id, client_id);
      return successResponse(res, null, "Contract allocation deleted successfully", 200);
    } catch (error: any) {
      logger.error(`Error deleting allocation ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to delete allocation" });
    }
  };
}
