import { UserController } from "../../presentation/controllers/user.controller.js";
import { UserUseCase } from "../../application/use-cases/user.usecase.js";
import { MongoUserRepository } from "../../infrastructure/persistence/mongo-user.repository.js";

export function createUserController() {
    const userRepository = new MongoUserRepository();
    const userUseCase = new UserUseCase(userRepository);
    const userController = new UserController(userUseCase);
    return userController;
}
