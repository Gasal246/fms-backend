import { MongoCustomFieldRepository } from "../../infrastructure/persistence/mongo-custom-field.repository.js";
import { CustomFieldUseCase } from "../../application/use-cases/custom-field.use-case.js";
import { CustomFieldController } from "../../presentation/controllers/custom-field.controller.js";

const customFieldRepository = new MongoCustomFieldRepository();
const customFieldUseCase = new CustomFieldUseCase(customFieldRepository);
export const customFieldController = new CustomFieldController(customFieldUseCase);
