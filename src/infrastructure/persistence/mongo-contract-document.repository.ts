import mongoose from "mongoose";
import type { ContractDocumentRepository } from "../../domain/repositories/contract-document.repository.interface.js";
import type {
  ContractDocumentFilter,
  ContractDocumentRequest,
  ContractDocumentResponse,
  PaginatedContractDocumentResponse,
} from "../../domain/types/contract-document.types.js";
import ContractDocument from "./models/contract-document.model.js";

export class MongoContractDocumentRepository implements ContractDocumentRepository {
  private mapToResponse(doc: any): ContractDocumentResponse {
    return {
      ...doc,
      id: doc._id?.toString() ?? doc.id,
      client_id: doc.client_id?.toString(),
      owner_id: doc.owner_id?.toString(),
      contract_id: doc.contract_id?.toString() || null,
      company_id: doc.company_id?.toString() || null,
      tenant_id: doc.tenant_id?.toString() || null,
      current_version_id: doc.current_version_id?.toString() || null,
      uploaded_by: doc.uploaded_by?.toString(),
      verified_by: doc.verified_by?.toString() || null,
    } as ContractDocumentResponse;
  }

  async findAll(
    page: number,
    limit: number,
    filters: ContractDocumentFilter
  ): Promise<PaginatedContractDocumentResponse> {
    const query: any = { deleted_at: null };
    if (filters.client_id) query.client_id = new mongoose.Types.ObjectId(filters.client_id);
    if (filters.owner_type) query.owner_type = filters.owner_type;
    if (filters.owner_id) query.owner_id = new mongoose.Types.ObjectId(filters.owner_id);
    if (filters.contract_id) query.contract_id = new mongoose.Types.ObjectId(filters.contract_id);
    if (filters.company_id) query.company_id = new mongoose.Types.ObjectId(filters.company_id);
    if (filters.tenant_id) query.tenant_id = new mongoose.Types.ObjectId(filters.tenant_id);
    if (filters.document_scope) query.document_scope = filters.document_scope;
    if (filters.document_type) query.document_type = filters.document_type;
    if (filters.status) query.status = filters.status;
    if (filters.is_restricted !== undefined) query.is_restricted = filters.is_restricted;

    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: "i" } },
        { document_number: { $regex: filters.search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      ContractDocument.find(query)
        .select("-__v")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean(),
      ContractDocument.countDocuments(query),
    ]);

    return {
      items: data.map((d: any) => this.mapToResponse(d)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string, clientId: string): Promise<ContractDocumentResponse | null> {
    const doc = await ContractDocument.findOne({
      _id: new mongoose.Types.ObjectId(id),
      client_id: new mongoose.Types.ObjectId(clientId),
      deleted_at: null,
    })
      .select("-__v")
      .lean();
    if (!doc) return null;
    return this.mapToResponse(doc);
  }

  async findByContract(
    contractId: string,
    clientId: string
  ): Promise<ContractDocumentResponse[]> {
    const docs = await ContractDocument.find({
      contract_id: new mongoose.Types.ObjectId(contractId),
      client_id: new mongoose.Types.ObjectId(clientId),
      deleted_at: null,
    })
      .select("-__v")
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((d: any) => this.mapToResponse(d));
  }

  async create(data: ContractDocumentRequest): Promise<ContractDocumentResponse> {
    const payload: any = {
      ...data,
      client_id: new mongoose.Types.ObjectId(data.client_id),
      owner_id: new mongoose.Types.ObjectId(data.owner_id),
      contract_id: data.contract_id ? new mongoose.Types.ObjectId(data.contract_id) : null,
      company_id: data.company_id ? new mongoose.Types.ObjectId(data.company_id) : null,
      tenant_id: data.tenant_id ? new mongoose.Types.ObjectId(data.tenant_id) : null,
      current_version_id: data.current_version_id ? new mongoose.Types.ObjectId(data.current_version_id) : null,
      uploaded_by: new mongoose.Types.ObjectId(data.uploaded_by),
      start_date: new Date(data.start_date),
      end_date: new Date(data.end_date),
    };

    const created = await ContractDocument.create(payload);
    const result = await this.findById(
      (created as any)._id.toString(),
      data.client_id
    );
    return result!;
  }

  async update(
    id: string,
    clientId: string,
    data: Partial<ContractDocumentRequest>
  ): Promise<ContractDocumentResponse | null> {
    const payload: any = { ...data };
    if (data.owner_id) payload.owner_id = new mongoose.Types.ObjectId(data.owner_id);
    if (data.contract_id !== undefined) payload.contract_id = data.contract_id ? new mongoose.Types.ObjectId(data.contract_id) : null;
    if (data.company_id !== undefined) payload.company_id = data.company_id ? new mongoose.Types.ObjectId(data.company_id) : null;
    if (data.tenant_id !== undefined) payload.tenant_id = data.tenant_id ? new mongoose.Types.ObjectId(data.tenant_id) : null;
    if (data.current_version_id !== undefined) payload.current_version_id = data.current_version_id ? new mongoose.Types.ObjectId(data.current_version_id) : null;
    if (data.start_date) payload.start_date = new Date(data.start_date);
    if (data.end_date) payload.end_date = new Date(data.end_date);

    const updated = await ContractDocument.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        client_id: new mongoose.Types.ObjectId(clientId),
      },
      { $set: payload },
      { returnDocument: 'after' }
    ).lean();

    if (!updated) return null;
    return this.mapToResponse(updated);
  }

  async delete(id: string, clientId: string): Promise<boolean> {
    // Soft delete
    const result = await ContractDocument.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        client_id: new mongoose.Types.ObjectId(clientId),
        deleted_at: null,
      },
      { $set: { deleted_at: new Date(), status: "deleted" } }
    );
    return !!result;
  }
}
