import express from "express";

import tryCatch from "../../shared/middleware/asyncHandler.js";
import { createCountryStateController } from "../../main/container/country-state.container.js";

const router = express.Router();
const controller = createCountryStateController();

router.post("/", tryCatch(controller.createCountryState));
router.get("/", tryCatch(controller.getCountryStates));
router.get("/:id", tryCatch(controller.getCountryState));
router.put("/:id", tryCatch(controller.updateCountryState));
router.delete("/:id", tryCatch(controller.deleteCountryState));

export default router;
