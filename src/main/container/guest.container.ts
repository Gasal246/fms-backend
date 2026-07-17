import { GuestUseCase } from "../../application/use-cases/guest.usecase.js";
import { MongoGuestRepository } from "../../infrastructure/persistence/mongo-guest.repository.js";
import { GuestController } from "../../presentation/controllers/guest.controller.js";

export const createGuestController = () => {
  const repository = new MongoGuestRepository();
  const useCase = new GuestUseCase(repository);
  return new GuestController(useCase);
};
