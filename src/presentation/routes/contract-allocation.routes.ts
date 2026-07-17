import { Router } from "express";
import { contractAllocationController } from "../../main/container/contract-allocation.container.js";
import { authorize } from "../../shared/middleware/authorize.js";

const router = Router();

router.get("/", authorize("view_contract"), contractAllocationController.getAllocations);
router.get("/:id", authorize("view_contract"), contractAllocationController.getAllocationById);
router.post("/", authorize("manage_contract_allocations"), contractAllocationController.createAllocation);
router.put("/:id", authorize("manage_contract_allocations"), contractAllocationController.updateAllocation);
router.delete("/:id", authorize("manage_contract_allocations"), contractAllocationController.deleteAllocation);

export default router;
