import type { ClientSession } from "mongoose";
import type { CateringEntity } from "../../infrastructure/persistence/models/catering.model.js";

export type CateringScope = { clientId: string; companyId?: string; userId: string; role: string; kitchenIds?: string[] };

export interface CateringRepository {
  list(entity: CateringEntity, scope: CateringScope, query?: Record<string, unknown>): Promise<any[]>;
  create(entity: CateringEntity, scope: CateringScope, data: any, session?: ClientSession): Promise<any>;
  update(entity: CateringEntity, scope: CateringScope, id: string, data: any, version?: number, session?: ClientSession): Promise<any>;
  remove(entity: CateringEntity, scope: CateringScope, id: string): Promise<void>;
}

