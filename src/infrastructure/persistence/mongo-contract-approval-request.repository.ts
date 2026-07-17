import mongoose from "mongoose";
import type { ContractApprovalRequestRepository } from "../../domain/repositories/contract-approval-request.repository.interface.js";
import type {
  ContractApprovalRequestInput,
  ContractApprovalRequestResponse,
  ContractApprovalRequestFilter,
} from "../../domain/types/contract-approval-request.types.js";
import ContractApprovalRequest from "./models/contract-approval-request.model.js";

export class MongoContractApprovalRequestRepository
  implements ContractApprovalRequestRepository {
  private mapToResponse(doc: any): ContractApprovalRequestResponse {
    return {
      ...doc,
      id: doc._id?.toString() ?? doc.id,
      client_id: doc.client_id?.toString(),
      document_id: doc.document_id,
      version_id: doc.version_id,
      requested_by: doc.requested_by?.toString(),
      approved_by: doc.approved_by?.toString(),
    } as ContractApprovalRequestResponse;
  }

  async findById(
    id: string,
    clientId: string
  ): Promise<ContractApprovalRequestResponse | null> {
    const doc = await ContractApprovalRequest.findOne({
      _id: new mongoose.Types.ObjectId(id),
      client_id: new mongoose.Types.ObjectId(clientId),
    })
      .populate("document_id")
      .populate("version_id")
      .lean();
    if (!doc) return null;
    return this.mapToResponse(doc);
  }

  async findAll(
    page: number,
    limit: number,
    filters: ContractApprovalRequestFilter
  ): Promise<{ items: ContractApprovalRequestResponse[]; total: number }> {
    const query: any = {};
    if (filters.client_id)
      query.client_id = new mongoose.Types.ObjectId(filters.client_id);
    if (filters.document_id)
      query.document_id = new mongoose.Types.ObjectId(filters.document_id);
    if (filters.approval_status)
      query.approval_status = filters.approval_status;
    if (filters.request_type)
      query.request_type = filters.request_type;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      ContractApprovalRequest.find(query)
        .populate("document_id")
        .populate("version_id")
        .skip(skip)
        .limit(limit)
        .sort({ requested_at: -1 })
        .lean(),
      ContractApprovalRequest.countDocuments(query),
    ]);

    return {
      items: data.map((d: any) => this.mapToResponse(d)),
      total,
    };
  }

  async create(
    data: ContractApprovalRequestInput
  ): Promise<ContractApprovalRequestResponse> {
    const payload: any = {
      client_id: new mongoose.Types.ObjectId(data.client_id),
      document_id: new mongoose.Types.ObjectId(data.document_id),
      request_type: data.request_type,
      requested_by: new mongoose.Types.ObjectId(data.requested_by),
      requested_by_role: data.requested_by_role,
      requested_at: new Date(),
    };
    if (data.version_id) payload.version_id = new mongoose.Types.ObjectId(data.version_id);
    if (data.remarks) payload.remarks = data.remarks;
    if (data.old_data) payload.old_data = data.old_data;
    if (data.new_data) payload.new_data = data.new_data;

    const created = await ContractApprovalRequest.create(payload);
    const populated = await ContractApprovalRequest.findById(created._id)
      .populate("document_id")
      .populate("version_id")
      .lean();
    return this.mapToResponse(populated!);
  }

  async update(
    id: string,
    clientId: string,
    data: Partial<ContractApprovalRequestResponse>
  ): Promise<ContractApprovalRequestResponse | null> {
    const payload: any = { ...data };
    if (data.approved_by)
      payload.approved_by = new mongoose.Types.ObjectId(data.approved_by);

    const updated = await ContractApprovalRequest.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        client_id: new mongoose.Types.ObjectId(clientId),
      },
      { $set: payload },
      { returnDocument: 'after' }
    )
      .populate("document_id")
      .populate("version_id")
      .lean();

    if (!updated) return null;
    return this.mapToResponse(updated);
  }
}
