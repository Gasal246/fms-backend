import type { Response } from "express";
import { ContractUseCase } from "../../application/use-cases/contract.use-case.js";
import { successResponse } from "../../shared/utils/responseHandler.js";
import type { AuthenticatedRequest } from "../../shared/types/index.js";
import { logger } from "../../shared/logger/logger.js";
import { BulkTerminationService } from "../../application/services/bulk-termination.service.js";

export class ContractController {
  constructor(private readonly contractUseCase: ContractUseCase) { }

  getContracts = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const client_id = req.user.client_id.toString();
      const isCompany = (req.user.roleId || req.user.role_slug) === "ROLE_COMPANY";

      const filters: any = {
        client_id,
        company_id: isCompany ? String(req.user.id) : req.query.company_id as string,
        status: req.query.status as string,
        billing_frequency: req.query.billing_frequency as string,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        search: req.query.search as string,
        include_renewed: req.query.include_renewed as string,
        user_role: req.user.roleId || req.user.role_slug || req.user.role,
        assigned_camps: req.user.assigned_camps?.map((c: any) => c.camp_id),
        assigned_zones: req.user.assigned_zones?.map((z: any) => z.zone_id),
      };

      const result = await this.contractUseCase.getAllContracts(page, limit, filters);
      return successResponse(res, result, "Contracts retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching contracts: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve contracts" });
    }
  };

  getContractById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id.toString();
      logger.info(`Fetching contract: ${id}`);
      const contract = await this.contractUseCase.getContractById(id, client_id);
      return successResponse(res, contract, "Contract retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching contract ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve contract" });
    }
  };

  createContract = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const client_id = req.user.client_id.toString();
      const created_by = req.user.id?.toString();
      logger.info("Creating new contract");
      const contract = await this.contractUseCase.createContract({ ...req.body, created_by }, client_id);
      return successResponse(res, contract, "Contract created successfully", 201);
    } catch (error: any) {
      logger.error(`Error creating contract: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to create contract" });
    }
  };

  updateContract = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id.toString();
      logger.info(`Updating contract: ${id}`);
      const contract = await this.contractUseCase.updateContract(id, client_id, {
        ...req.body,
        updated_by: req.user.id?.toString(),
        updated_by_role: req.user.roleId,
      });
      return successResponse(res, contract, "Contract updated successfully", 200);
    } catch (error: any) {
      logger.error(`Error updating contract ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to update contract" });
    }
  };

  deleteContract = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id.toString();
      logger.info(`Deleting contract: ${id}`);
      await this.contractUseCase.deleteContract(id, client_id, req.user.id?.toString(), req.user.roleId);
      return successResponse(res, null, "Contract deleted successfully", 200);
    } catch (error: any) {
      logger.error(`Error deleting contract ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to delete contract" });
    }
  };

  getContractTerminationDetails = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      logger.info(`Fetching termination details for contract: ${id}`);
      const details = await this.contractUseCase.getContractTerminationDetails(id);
      return successResponse(res, details, "Termination details retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching termination details for contract ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve termination details" });
    }
  };

  getOccupancySummary = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id.toString();
      logger.info(`Fetching contract occupancy summary: ${id}`);
      const summary = await this.contractUseCase.getOccupancySummary(id, client_id);
      return successResponse(res, summary, "Contract occupancy summary retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching occupancy summary for contract ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve occupancy summary" });
    }
  };

  getContractAllocations = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id.toString();
      logger.info(`Fetching allocations for contract: ${id}`);
      const allocations = await this.contractUseCase.getContractAllocations(id, client_id);
      return successResponse(res, allocations, "Contract allocations retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching allocations for contract ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve contract allocations" });
    }
  };

  amendContract = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id.toString();
      logger.info(`Amending contract: ${id}`);
      const result = await this.contractUseCase.amendContract(id, client_id, req.body);
      return successResponse(res, result, "Contract amended successfully", 200);
    } catch (error: any) {
      logger.error(`Error amending contract ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to amend contract" });
    }
  };

  renewContract = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id.toString();
      const userId = req.user.id?.toString();
      const { copy_allocations, ...renewalData } = req.body;
      const copyAllocations = copy_allocations !== false; // default true
      logger.info(`Renewing contract: ${id}`);
      const newContract = await this.contractUseCase.renewContract(
        id,
        client_id,
        renewalData,
        copyAllocations,
        userId
      );
      return successResponse(res, newContract, "Contract renewed successfully. A new contract has been created.", 201);
    } catch (error: any) {
      logger.error(`Error renewing contract ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to renew contract" });
    }
  };

  extendContract = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id.toString();
      const userId = req.user.id?.toString() || "System";
      const userRole = req.user.role_slug || req.user.roleId || "coordinator";
      logger.info(`Extending contract: ${id}`);
      const updatedContract = await this.contractUseCase.extendContract(
        id,
        client_id,
        req.body,
        userId,
        userRole
      );
      return successResponse(res, updatedContract, "Contract extended successfully", 200);
    } catch (error: any) {
      logger.error(`Error extending contract ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to extend contract" });
    }
  };

  getContractExtensions = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      logger.info(`Fetching contract extensions: ${id}`);
      const extensions = await this.contractUseCase.getContractExtensions(id);
      return successResponse(res, extensions, "Contract extensions retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching contract extensions ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to retrieve extensions" });
    }
  };

  bulkTerminate = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id as string;
      const client_id = req.user.client_id.toString();
      const userId = req.user.id?.toString() || "System";
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ success: false, message: "Reason is required for termination" });
      }

      logger.info(`Starting bulk termination for contract: ${id}`);
      const jobId = await BulkTerminationService.startBulkTermination(id, client_id, reason, userId, req.user.role);

      return successResponse(res, { jobId }, "Bulk termination initiated successfully in background", 202);
    } catch (error: any) {
      logger.error(`Error initiating bulk termination for contract ${req.params.id}: ${error.message}`);
      return res
        .status(error.statusCode || 500)
        .json({ success: false, message: error.message || "Failed to initiate bulk termination" });
    }
  };

  getJobStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const client_id = req.user.client_id.toString();

      const BackgroundJob = (await import("../../infrastructure/persistence/models/background-job.model.js")).default;
      const job = await BackgroundJob.findOne({ _id: jobId, client_id } as any).lean();

      if (!job) {
        return res.status(404).json({ success: false, message: "Job not found" });
      }

      return successResponse(res, job, "Job status retrieved successfully", 200);
    } catch (error: any) {
      logger.error(`Error fetching job status ${req.params.jobId}: ${error.message}`);
      return res
        .status(500)
        .json({ success: false, message: "Failed to retrieve job status" });
    }
  };
}
