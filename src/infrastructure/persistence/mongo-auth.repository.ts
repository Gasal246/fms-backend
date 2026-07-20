import mongoose from "mongoose";
import type { AuthRepository } from "../../domain/repositories/auth.repository.interface.js";
import { logger } from "../../shared/logger/logger.js";
import Client from "./models/user.model.js";
import Coordinator from "./models/coordinator.model.js";
import Technician from "./models/technician.model.js";
import Company from "./models/company.model.js";
import Role, { type IRole } from "./models/role.model.js";
import "./models/role.model.js";
import GlobalCompanyAccount from "./models/global-company-account.model.js";
import KitchenManager from "./models/kitchen-manager.model.js";

// Models to check for user authentication. Add new models here in the future.
// Promise.any is used below — it resolves with the FIRST collection that finds
// the user, so we don't wait for all queries when the user is found early.
const authModels: any[] = [Client, Coordinator, Technician, Company];

const authModelsMap: Record<string, any> = {
  client: Client,
  coordinator: Coordinator,
  technician: Technician,
  company: Company,
};

// Helper: wraps a findOne so that null results become rejections,
// making them invisible to Promise.any (which only cares about fulfillments).
const findFirst = (model: any, query: any, projection?: string) => {
  const q = model.findOne(query);
  if (projection) q.select(projection);
  return q.lean().then((result: any) => {
    if (!result) throw new Error("not found");
    return result;
  });
};

export class MongoAuthRepository implements AuthRepository {
  async findByEmail(email: string): Promise<any> {
    try {
      return await Promise.any(
        [
          ...authModels.map((model) =>
            findFirst(model, { email, deleted_at: null }, "client_id email password role_id status camp_id zone_id")
          ),
          findFirst(KitchenManager, { email: email.trim().toLowerCase(), deleted_at: null }, "+password client_id email role_id status kitchen_ids name phone"),
        ]
      );
    } catch {
      // AggregateError — no collection had this email
      return null;
    }
  }

  async findById(id: string): Promise<any> {
    try {
      return await Promise.any(
        [
          ...authModels.map((model) =>
            findFirst(model, { _id: id, deleted_at: null, }, "client_id email password role_id status camp_id zone_id")
          ),
          findFirst(KitchenManager, { _id: id, deleted_at: null }, "+password client_id email role_id status kitchen_ids name phone"),
        ]
      );
    } catch {
      return null;
    }
  }

  async findByEmailAndRoleSlug(email: string, roleSlug: string): Promise<any> {
    const slug = roleSlug.toLowerCase();
    let model = null;

    if (slug.includes("kitchen_manager")) {
      model = KitchenManager;
    } else if (slug.includes("client")) {
      model = Client;
    } else if (slug.includes("coordinator")) {
      model = Coordinator;
    } else if (slug.includes("technician")) {
      model = Technician;
    } else if (slug.includes("company")) {
      model = Company;
    }

    if (!model) {
      // Fallback: search across all models if the slug doesn't contain a clear identifier
      return this.findByEmail(email);
    }

    try {
      const normalizedEmail = model === KitchenManager ? email.trim().toLowerCase() : email;
      const projection = model === KitchenManager
        ? "+password client_id email role_id status kitchen_ids name phone"
        : "client_id email password role_id status camp_id zone_id";
      return await findFirst(model, { email: normalizedEmail, deleted_at: null}, projection);
    } catch {
      return null;
    }
  }

  async getUserRoles(email: string): Promise<any[]> {
    try {
      // 1. Fetch user role_ids from all collections in parallel
      const users = await Promise.all([
        ...authModels.map((model: any) =>
          model.findOne({ email, deleted_at: null }).select("role_id").lean()
        ),
        KitchenManager.findOne({ email: email.trim().toLowerCase(), deleted_at: null }).select("role_id").lean(),
      ]);

      // 2. Extract unique role ObjectIds and slugs
      const objectIds: mongoose.Types.ObjectId[] = [];
      const slugs: string[] = [];

      for (const user of users) {
        if (user && user.role_id) {
          const ids = Array.isArray(user.role_id) ? user.role_id : [user.role_id];
          for (const id of ids) {
            if (id) {
              const strId = id.toString();
              if (mongoose.Types.ObjectId.isValid(strId)) {
                objectIds.push(new mongoose.Types.ObjectId(strId));
              } else {
                slugs.push(strId);
              }
            }
          }

        }
      }

      const globalCompany = await GlobalCompanyAccount.exists({ login_email: email.trim().toLowerCase(), deleted_at: null });
      if (globalCompany) slugs.push("ROLE_COMPANY");
      if (objectIds.length === 0 && slugs.length === 0) return [];

      // 3. Batch query the Role model
      const query: any = { deleted_at: null };
      if (objectIds.length > 0 && slugs.length > 0) {
        query.$or = [
          { _id: { $in: objectIds } },
          { slug: { $in: slugs } }
        ];
      } else if (objectIds.length > 0) {
        query._id = { $in: objectIds };
      } else {
        query.slug = { $in: slugs };
      }

      const roleDocs = await Role.find(query).lean();
      return roleDocs;
    } catch (error) {
      logger.error(`Error fetching roles: ${error}`);
      return [];
    }
  }

  async getroleByid(roleId: string): Promise<IRole | null> {
    const role: IRole | null = await Role.findOne({ _id: roleId });
    return role;
  }

  async getRolesBySlugs(slugs: string[]): Promise<any[]> {
    return Role.find({ slug: { $in: slugs } }).lean();
  }
}
