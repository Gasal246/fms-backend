import mongoose from "mongoose";
import type { ContractVersionRepository } from "../../domain/repositories/contract-version.repository.interface.js";
import type {
  ContractVersionRequest,
  ContractVersionResponse,
} from "../../domain/types/contract-version.types.js";
import ContractVersion from "./models/contract-version.model.js";

export class MongoContractVersionRepository implements ContractVersionRepository {
  private mapToResponse(doc: any): ContractVersionResponse {
    return {
      ...doc,
      id: doc._id?.toString() ?? doc.id,
      document_id: doc.document_id?.toString(),
      uploaded_by: doc.uploaded_by?.toString(),
    } as ContractVersionResponse;
  }

  async findById(id: string): Promise<ContractVersionResponse | null> {
    const doc = await ContractVersion.findById(id).lean();
    if (!doc) return null;
    return this.mapToResponse(doc);
  }

  async findByDocument(documentId: string): Promise<ContractVersionResponse[]> {
    const docs = await ContractVersion.find({
      document_id: new mongoose.Types.ObjectId(documentId),
    })
      .sort({ version_no: -1 })
      .lean();
    return docs.map((d) => this.mapToResponse(d));
  }

  async findLatestVersion(documentId: string): Promise<ContractVersionResponse | null> {
    const doc = await ContractVersion.findOne({
      document_id: new mongoose.Types.ObjectId(documentId),
    })
      .sort({ version_no: -1 })
      .lean();
    if (!doc) return null;
    return this.mapToResponse(doc);
  }

  async create(data: ContractVersionRequest): Promise<ContractVersionResponse> {
    const payload = {
      ...data,
      document_id: new mongoose.Types.ObjectId(data.document_id),
      uploaded_by: new mongoose.Types.ObjectId(data.uploaded_by),
      upload_date: new Date(),
    };
    const created = await ContractVersion.create(payload);
    return this.mapToResponse(created.toObject());
  }

  async update(id: string, data: Partial<ContractVersionRequest>): Promise<ContractVersionResponse | null> {
    const updated = await ContractVersion.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: 'after' }
    ).lean();
    if (!updated) return null;
    return this.mapToResponse(updated);
  }
}
