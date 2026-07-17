import { MongoDashboardRepository } from '../../infrastructure/persistence/mongo-dashboard.repository.js';
import { DashboardController } from '../../presentation/controllers/dashboard.controller.js';

export function createDashboardController() {
  const repo = new MongoDashboardRepository();
  return new DashboardController(repo);
}
