import type { StatusRepository } from "../../domain/repositories/status.repository.interface.js";
import type { StatusResponse } from "../../domain/types/status.types.js";
import Status from "./models/status.model.js";

export class MongoStatusRepository implements StatusRepository {
  async findAll(): Promise<StatusResponse[]> {
    // Only fetch statuses that are not logically deleted
    const results = await Status.find({ deleted_at: null }).sort({ createdAt: -1 });
    
    return results.map(status => {
      const doc = status.toJSON();
      return {
        id: (doc as any)._id?.toString() || (doc as any).id,
        name: doc.name,
        slug: doc.slug,
        code: doc.code,
        deleted_at: doc.deleted_at,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      } as StatusResponse;
    });
  }
}
