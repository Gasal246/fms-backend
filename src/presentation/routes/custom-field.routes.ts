import { Router } from "express";
import { customFieldController } from "../../main/container/custom-field.container.js";

const router = Router();

router.get("/", customFieldController.getDefinition);
router.post("/", customFieldController.upsertDefinition);
router.post("/validate", customFieldController.validatePayload);

export default router;
