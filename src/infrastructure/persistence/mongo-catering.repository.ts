import mongoose, { type ClientSession } from "mongoose";
import type { CateringRepository, CateringScope } from "../../domain/repositories/catering.repository.interface.js";
import { cateringModel, type CateringEntity } from "./models/catering.model.js";
import { AppError } from "../../shared/utils/AppError.js";

const scopeFilter = (scope: CateringScope) => ({
  client_id: new mongoose.Types.ObjectId(scope.clientId),
  ...(scope.companyId ? { company_id: new mongoose.Types.ObjectId(scope.companyId) } : {}),
  deleted_at: null,
});

const present = (doc: any) => ({ id: doc._id.toString(), ...doc.data, status: doc.data?.status ?? doc.status, version: doc.__v, createdAt: doc.createdAt, updatedAt: doc.updatedAt });

export class MongoCateringRepository implements CateringRepository {
  async list(entity: CateringEntity, scope: CateringScope, query: Record<string, any> = {}) {
    const filter: any = scopeFilter(scope);
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") filter[key === "_id" ? "_id" : `data.${key}`] = value;
    const docs = await cateringModel(entity).find(filter).sort({ updatedAt: -1 }).limit(5000).lean();
    return docs.map(present);
  }

  async create(entity: CateringEntity, scope: CateringScope, data: any, session?: ClientSession) {
    const clean = { ...data };
    delete clean.id; delete clean.version; delete clean.createdAt; delete clean.updatedAt;
    if (scope.companyId) clean.companyId = scope.companyId;
    const [doc] = await cateringModel(entity).create([{
      client_id: scope.clientId, company_id: scope.companyId || data.companyId || null,
      data: clean, status: clean.status || "Active", created_by: scope.userId,
    }], { session });
    return present(doc.toObject());
  }

  async update(entity: CateringEntity, scope: CateringScope, id: string, data: any, version?: number, session?: ClientSession) {
    const clean = { ...data };
    delete clean.id; delete clean.version; delete clean.createdAt; delete clean.updatedAt;
    if (scope.companyId) clean.companyId = scope.companyId;
    const filter: any = { _id: id, ...scopeFilter(scope) };
    if (version !== undefined) filter.__v = version;
    const doc = await cateringModel(entity).findOneAndUpdate(filter, {
      $set: { data: clean, status: clean.status || "Active", updated_by: scope.userId }, $inc: { __v: 1 },
    }, { new: true, ...(session ? { session } : {}), runValidators: true }).lean();
    if (!doc) throw new AppError("Record not found or was changed by another user", version === undefined ? 404 : 409);
    return present(doc);
  }

  async remove(entity: CateringEntity, scope: CateringScope, id: string) {
    const doc = await cateringModel(entity).findOneAndUpdate({ _id: id, ...scopeFilter(scope) }, { deleted_at: new Date(), updated_by: scope.userId });
    if (!doc) throw new AppError("Record not found", 404);
  }
}
