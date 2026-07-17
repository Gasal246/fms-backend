import { Router } from "express";
import { contractController } from "../../main/container/contract.container.js";
import { authorize } from "../../shared/middleware/authorize.js";

const router = Router();

router.get("/", authorize("view_contract"), contractController.getContracts);
router.get("/:id", authorize("view_contract"), contractController.getContractById);
router.post("/", authorize("create_contract"), contractController.createContract);
router.put("/:id", authorize("edit_contract"), contractController.updateContract);
router.delete("/:id", authorize("delete_contract"), contractController.deleteContract);
router.get("/:id/termination", authorize("view_contract"), contractController.getContractTerminationDetails);
router.get("/:id/occupancy-summary", authorize("view_contract"), contractController.getOccupancySummary);
router.get("/:id/occupancy", authorize("view_contract"), contractController.getOccupancySummary);
router.get("/:id/allocations", authorize("manage_contract_allocations"), contractController.getContractAllocations);
router.post("/:id/amend", authorize("edit_contract"), contractController.amendContract);
router.post("/:id/renew", authorize("edit_contract"), contractController.renewContract);
router.post("/:id/extend", authorize("edit_contract"), contractController.extendContract);
router.get("/:id/extensions", authorize("view_contract"), contractController.getContractExtensions);
router.post("/:id/bulk-terminate", authorize("edit_contract"), contractController.bulkTerminate);
router.get("/jobs/:jobId", authorize("view_contract"), contractController.getJobStatus);

export default router;
