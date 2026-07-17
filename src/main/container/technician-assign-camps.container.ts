import { MongoTechnicianAssignCampsRepository } from "../../infrastructure/persistence/mongo-technician-assign-camps.repository.js";
import { TechnicianAssignCampsUseCase } from "../../application/use-cases/technician-assign-camps.usecase.js";
import { TechnicianAssignCampsController } from "../../presentation/controllers/technician-assign-camps.controller.js";

export const createTechnicianAssignCampsController = () => {
  const repository = new MongoTechnicianAssignCampsRepository();
  const useCase = new TechnicianAssignCampsUseCase(repository);
  return new TechnicianAssignCampsController(useCase);
};
