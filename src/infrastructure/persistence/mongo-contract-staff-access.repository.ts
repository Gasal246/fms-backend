import mongoose from "mongoose";
import type { ContractStaffAccessRepository } from "../../domain/repositories/contract-staff-access.repository.interface.js";
import type {
  ContractStaffAccessInput,
  ContractStaffAccessResponse,
} from "../../domain/types/contract-staff-access.types.js";
import ContractStaffAccess from "./models/contract-staff-access.model.js";

export class MongoContractStaffAccessRepository
  implements ContractStaffAccessRepository {
  private mapToResponse(doc: any): ContractStaffAccessResponse {
    return {
      ...doc,
      id: doc._id?.toString() ?? doc.id,
      document_id: doc.document_id?.toString(),
      staff_id: doc.staff_id,
      assigned_by: doc.assigned_by?.toString(),
    } as ContractStaffAccessResponse;
  }

  async findByStaffAndDocument(
    staffId: string,
    documentId: string
  ): Promise<ContractStaffAccessResponse | null> {
    const doc = await ContractStaffAccess.findOne({
      staff_id: new mongoose.Types.ObjectId(staffId),
      document_id: new mongoose.Types.ObjectId(documentId),
    })
      .populate("staff_id")
      .lean();
    if (!doc) return null;
    return this.mapToResponse(doc);
  }

  async findByDocument(
    documentId: string
  ): Promise<ContractStaffAccessResponse[]> {
    const docs = await ContractStaffAccess.find({
      document_id: new mongoose.Types.ObjectId(documentId),
    })
      .populate("staff_id")
      .lean();
    return docs.map((d) => this.mapToResponse(d));
  }

  async createOrUpdate(
    data: ContractStaffAccessInput
  ): Promise<ContractStaffAccessResponse> {
    const query = {
      document_id: new mongoose.Types.ObjectId(data.document_id),
      staff_id: new mongoose.Types.ObjectId(data.staff_id),
    };
    const update = {
      $set: {
        role: data.role ?? "ROLE_COORDINATOR",
        can_view: data.can_view,
        can_edit: data.can_edit,
        assigned_by: new mongoose.Types.ObjectId(data.assigned_by),
      },
    };
    const options = { upsert: true, returnDocument: 'after' as const, setDefaultsOnInsert: true };
    const doc = await ContractStaffAccess.findOneAndUpdate(
      query,
      update,
      options
    )
      .populate("staff_id")
      .lean();

    return this.mapToResponse(doc);
  }

  async delete(staffId: string, documentId: string): Promise<boolean> {
    const result = await ContractStaffAccess.findOneAndDelete({
      staff_id: new mongoose.Types.ObjectId(staffId),
      document_id: new mongoose.Types.ObjectId(documentId),
    });
    return !!result;
  }
}
