import type { ContractDocumentRepository } from "../../domain/repositories/contract-document.repository.interface.js";
import type { ContractVersionRepository } from "../../domain/repositories/contract-version.repository.interface.js";
import type { ContractApprovalRequestRepository } from "../../domain/repositories/contract-approval-request.repository.interface.js";
import type { ContractStaffAccessRepository } from "../../domain/repositories/contract-staff-access.repository.interface.js";
import type { ContractNotificationRepository } from "../../domain/repositories/contract-notification.repository.interface.js";
import type {
  ContractDocumentFilter,
  ContractDocumentRequest,
  ContractDocumentResponse,
  PaginatedContractDocumentResponse,
} from "../../domain/types/contract-document.types.js";
import { AppError } from "../../shared/utils/AppError.js";
import { logger } from "../../shared/logger/logger.js";
import mongoose from "mongoose";

// Direct mongoose models if needed for cross-links lookup
import Contract from "../../infrastructure/persistence/models/contract.model.js";
import Tenant from "../../infrastructure/persistence/models/tenant.model.js";

// Helper to remove undefined properties for strict TS configurations
function clean<T extends object>(obj: any): T {
  const newObj = { ...obj };
  Object.keys(newObj).forEach((key) => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj as T;
}

export class ContractDocumentUseCase {
  constructor(
    private readonly documentRepo: ContractDocumentRepository,
    private readonly versionRepo: ContractVersionRepository,
    private readonly approvalRepo: ContractApprovalRequestRepository,
    private readonly staffAccessRepo: ContractStaffAccessRepository,
    private readonly notificationRepo: ContractNotificationRepository
  ) {}

  async listDocuments(
    clientId: string,
    page: number,
    limit: number,
    filters: ContractDocumentFilter,
    userRole: string,
    userId: string
  ): Promise<PaginatedContractDocumentResponse> {
    const activeFilters: ContractDocumentFilter = { ...filters, client_id: clientId };

    // 1. Role-based scoping checks
    if (userRole === "ROLE_COMPANY") {
      // Company Admin can only see their own company's documents
      activeFilters.company_id = userId; 
    } else if (userRole === "ROLE_TENANT") {
      // Tenant can only see their own documents
      activeFilters.tenant_id = userId;
    } else if (userRole === "ROLE_COORDINATOR") {
      // Coordinators can view unrestricted documents
      activeFilters.is_restricted = false; 
    }

    const result = await this.documentRepo.findAll(page, limit, clean<ContractDocumentFilter>(activeFilters));
    return result;
  }

  async getDocumentById(
    id: string,
    clientId: string,
    userRole: string,
    userId: string
  ): Promise<ContractDocumentResponse & { versions?: any[] }> {
    const doc = await this.documentRepo.findById(id, clientId);
    if (!doc) throw new AppError("Document not found", 404);

    // Enforce role-based access boundaries
    if (userRole === "ROLE_COMPANY" && doc.company_id !== userId) {
      throw new AppError("Access denied: You do not own this document.", 403);
    }
    if (userRole === "ROLE_TENANT" && doc.tenant_id !== userId) {
      throw new AppError("Access denied: You do not own this document.", 403);
    }
    if (userRole === "ROLE_COORDINATOR" && doc.is_restricted) {
      const access = await this.staffAccessRepo.findByStaffAndDocument(userId, id);
      if (!access || !access.can_view) {
        throw new AppError("Access denied: Restricted document.", 403);
      }
    }

    const versions = await this.versionRepo.findByDocument(id);
    return {
      ...doc,
      versions,
    };
  }

  async uploadDocument(
    data: Omit<ContractDocumentRequest, "client_id"> & {
      file_name: string;
      file_url: string;
      mime_type: string;
      file_size: number;
      notes?: string;
    },
    clientId: string,
    userId: string,
    userRole: string
  ): Promise<ContractDocumentResponse> {
    // 1. Validate mandatory fields
    if (!data.owner_type || !data.owner_id) {
      throw new AppError("owner_type and owner_id are required", 400);
    }
    if (!data.title || !data.document_number) {
      throw new AppError("title and document_number are required", 400);
    }

    // 2. Set cross-links depending on owner_type
    let company_id: string | null = null;
    let tenant_id: string | null = null;
    let contract_id: string | null = null;

    if (data.owner_type === "contract") {
      contract_id = data.owner_id;
      const c = await Contract.findById(contract_id).lean();
      if (c) company_id = c.company_id?.toString() || null;
    } else if (data.owner_type === "company") {
      company_id = data.owner_id;
    } else if (data.owner_type === "tenant") {
      tenant_id = data.owner_id;
      const t = await Tenant.findById(tenant_id).lean();
      if (t) {
        company_id = t.company_id?.toString() || null;
        contract_id = t.contract_id?.toString() || null;
      }
    }

    // 3. Determine status based on role
    const isClientAdmin = userRole === "ROLE_CLIENT_ADMIN";
    const status = isClientAdmin ? "active" : "pending_verification";

    // 4. Create document record
    const docData = clean<ContractDocumentRequest>({
      client_id: clientId,
      owner_type: data.owner_type,
      owner_id: data.owner_id,
      contract_id,
      company_id,
      tenant_id,
      document_scope: data.document_scope,
      document_type: data.document_type,
      title: data.title,
      document_number: data.document_number,
      start_date: data.start_date,
      end_date: data.end_date,
      renewal_reminder_days: data.renewal_reminder_days,
      is_restricted: data.is_restricted ?? false,
      status,
      uploaded_by: userId,
      uploaded_by_role: userRole,
      remarks: data.remarks,
    } as any);

    const doc = await this.documentRepo.create(docData);

    // 5. Create immutable version 1
    const ver = await this.versionRepo.create(clean({
      document_id: doc.id,
      version_no: 1,
      file_name: data.file_name,
      file_url: data.file_url,
      mime_type: data.mime_type,
      file_size: data.file_size,
      start_date: data.start_date,
      end_date: data.end_date,
      uploaded_by: userId,
      uploaded_by_role: userRole,
      status: isClientAdmin ? "active" : "pending",
      notes: data.notes,
    } as any));

    // 6. Update document's current version link
    await this.documentRepo.update(doc.id, clientId, clean({
      current_version_id: ver.id,
      status,
    } as any));

    // 7. Create approval request
    const appRequest = await this.approvalRepo.create(clean({
      client_id: clientId,
      document_id: doc.id,
      version_id: ver.id,
      request_type: "upload",
      requested_by: userId,
      requested_by_role: userRole,
      remarks: data.remarks,
      new_data: { ...docData, file_url: data.file_url },
    } as any));

    if (isClientAdmin) {
      await this.approvalRepo.update(appRequest.id, clientId, clean({
        approval_status: "approved",
        approved_by: userId,
        approved_at: new Date(),
      } as any));
    } else {
      // Notify Client Admin
      await this.notificationRepo.create(clean({
        client_id: clientId,
        document_id: doc.id,
        receiver_type: "client_admin",
        receiver_id: new mongoose.Types.ObjectId(clientId) as any, // client owner ID
        title: "New Document Upload Pending Verification",
        message: `A new document "${data.title}" has been uploaded by ${userRole} and requires verification.`,
        notification_type: "general",
        sent_by: userId,
        sent_by_role: userRole,
      } as any));
    }

    return (await this.documentRepo.findById(doc.id, clientId))!;
  }

  async requestUpdate(
    id: string,
    data: {
      title?: string;
      document_number?: string;
      start_date?: string | Date;
      end_date?: string | Date;
      renewal_reminder_days?: number;
      file_name?: string;
      file_url?: string;
      mime_type?: string;
      file_size?: number;
      remarks?: string;
      notes?: string;
    },
    clientId: string,
    userId: string,
    userRole: string
  ): Promise<any> {
    const doc = await this.documentRepo.findById(id, clientId);
    if (!doc) throw new AppError("Document not found", 404);

    const isClientAdmin = userRole === "ROLE_CLIENT_ADMIN";

    // Client Admin can update directly without approval
    if (isClientAdmin) {
      let current_version_id = doc.current_version_id;

      if (data.file_url) {
        // Upload new version
        const latest = await this.versionRepo.findLatestVersion(id);
        const nextVerNo = (latest?.version_no ?? 0) + 1;
        const ver = await this.versionRepo.create(clean({
          document_id: id,
          version_no: nextVerNo,
          file_name: data.file_name || "updated_file",
          file_url: data.file_url,
          mime_type: data.mime_type || "application/pdf",
          file_size: data.file_size || 0,
          start_date: data.start_date || doc.start_date,
          end_date: data.end_date || doc.end_date,
          uploaded_by: userId,
          uploaded_by_role: userRole,
          status: "active",
          notes: data.notes,
        } as any));
        current_version_id = ver.id;
      }

      await this.documentRepo.update(id, clientId, clean({
        title: data.title ?? doc.title,
        document_number: data.document_number ?? doc.document_number,
        start_date: data.start_date ?? doc.start_date,
        end_date: data.end_date ?? doc.end_date,
        renewal_reminder_days: data.renewal_reminder_days ?? doc.renewal_reminder_days,
        current_version_id,
        status: "active",
      } as any));

      return { message: "Document updated successfully" };
    }

    // Coordinator/Company Admin/Tenant goes to approval request
    let nextVerId: string | null = null;
    let nextVerNo = 1;

    if (data.file_url) {
      const latest = await this.versionRepo.findLatestVersion(id);
      nextVerNo = (latest?.version_no ?? 0) + 1;
      const ver = await this.versionRepo.create(clean({
        document_id: id,
        version_no: nextVerNo,
        file_name: data.file_name!,
        file_url: data.file_url,
        mime_type: data.mime_type!,
        file_size: data.file_size!,
        start_date: data.start_date || doc.start_date,
        end_date: data.end_date || doc.end_date,
        uploaded_by: userId,
        uploaded_by_role: userRole,
        status: "pending",
        notes: data.notes,
      } as any));
      nextVerId = ver.id;
    }

    await this.documentRepo.update(id, clientId, clean({ status: "pending_update_approval" } as any));

    await this.approvalRepo.create(clean({
      client_id: clientId,
      document_id: id,
      version_id: nextVerId,
      request_type: "update",
      requested_by: userId,
      requested_by_role: userRole,
      remarks: data.remarks,
      old_data: { ...doc },
      new_data: { ...data },
    } as any));

    return { message: "Update request submitted successfully. Pending Client Admin approval." };
  }

  async requestRenewal(
    id: string,
    data: {
      document_number: string;
      start_date: string | Date;
      end_date: string | Date;
      renewal_reminder_days: number;
      file_name: string;
      file_url: string;
      mime_type: string;
      file_size: number;
      remarks?: string;
      notes?: string;
    },
    clientId: string,
    userId: string,
    userRole: string
  ): Promise<any> {
    const doc = await this.documentRepo.findById(id, clientId);
    if (!doc) throw new AppError("Document not found", 404);

    const isClientAdmin = userRole === "ROLE_CLIENT_ADMIN";
    const latest = await this.versionRepo.findLatestVersion(id);
    const nextVerNo = (latest?.version_no ?? 0) + 1;

    // Create the version record
    const ver = await this.versionRepo.create(clean({
      document_id: id,
      version_no: nextVerNo,
      file_name: data.file_name,
      file_url: data.file_url,
      mime_type: data.mime_type,
      file_size: data.file_size,
      start_date: data.start_date,
      end_date: data.end_date,
      uploaded_by: userId,
      uploaded_by_role: userRole,
      status: isClientAdmin ? "active" : "pending",
      notes: data.notes,
    } as any));

    if (isClientAdmin) {
      // Archive old version
      if (doc.current_version_id) {
        await this.versionRepo.update(doc.current_version_id, clean({ status: "renewed" } as any));
      }

      await this.documentRepo.update(id, clientId, clean({
        document_number: data.document_number,
        start_date: data.start_date,
        end_date: data.end_date,
        renewal_reminder_days: data.renewal_reminder_days,
        current_version_id: ver.id,
        status: "active",
      } as any));

      return { message: "Document renewed successfully." };
    }

    // Submit request for review
    await this.documentRepo.update(id, clientId, clean({ status: "pending_renewal_approval" } as any));

    await this.approvalRepo.create(clean({
      client_id: clientId,
      document_id: id,
      version_id: ver.id,
      request_type: "renew",
      requested_by: userId,
      requested_by_role: userRole,
      remarks: data.remarks,
      old_data: { ...doc },
      new_data: { ...data },
    } as any));

    return { message: "Renewal request submitted successfully. Pending Client Admin approval." };
  }

  async requestDelete(
    id: string,
    clientId: string,
    userId: string,
    userRole: string,
    remarks?: string
  ): Promise<any> {
    const doc = await this.documentRepo.findById(id, clientId);
    if (!doc) throw new AppError("Document not found", 404);

    const isClientAdmin = userRole === "ROLE_CLIENT_ADMIN";

    if (isClientAdmin) {
      await this.documentRepo.delete(id, clientId);
      return { message: "Document deleted successfully." };
    }

    await this.documentRepo.update(id, clientId, clean({ status: "pending_delete_approval" } as any));

    await this.approvalRepo.create(clean({
      client_id: clientId,
      document_id: id,
      request_type: "delete",
      requested_by: userId,
      requested_by_role: userRole,
      remarks,
    } as any));

    return { message: "Delete request submitted successfully. Pending Client Admin approval." };
  }

  async handleApproval(
    requestId: string,
    clientId: string,
    clientAdminId: string,
    action: "approve" | "reject",
    remarks?: string
  ): Promise<any> {
    const request = await this.approvalRepo.findById(requestId, clientId);
    if (!request) throw new AppError("Approval request not found", 404);
    if (request.approval_status !== "pending") {
      throw new AppError("This request has already been processed.", 400);
    }

    const documentId = request.document_id._id.toString();

    if (action === "reject") {
      // 1. Update request status
      await this.approvalRepo.update(requestId, clientId, clean({
        approval_status: "rejected",
        approved_by: clientAdminId,
        approved_at: new Date(),
        remarks: remarks || "Rejected by administrator",
      } as any));

      // 2. Reject version if linked
      if (request.version_id) {
        await this.versionRepo.update(request.version_id._id.toString(), clean({ status: "rejected" } as any));
      }

      // 3. Revert document status
      const isNewUpload = request.request_type === "upload";
      await this.documentRepo.update(documentId, clientId, clean({
        status: isNewUpload ? "rejected" : "active",
      } as any));

      // Notify requester
      await this.notificationRepo.create(clean({
        client_id: clientId,
        document_id: documentId as any,
        receiver_type: request.requested_by_role === "ROLE_COMPANY" ? "company" : "tenant",
        receiver_id: request.requested_by,
        title: `Document ${request.request_type} Request Rejected`,
        message: `Your request for document "${request.document_id.title}" has been rejected. Remarks: ${remarks || "None"}`,
        notification_type: "general",
        sent_by: clientAdminId,
        sent_by_role: "ROLE_CLIENT_ADMIN",
      } as any));

      return { message: "Request rejected successfully." };
    }

    // --- Action: APPROVE ---

    // 1. Update request status
    await this.approvalRepo.update(requestId, clientId, clean({
      approval_status: "approved",
      approved_by: clientAdminId,
      approved_at: new Date(),
      remarks,
    } as any));

    // 2. Lifecycle transitions
    if (request.request_type === "upload") {
      await this.versionRepo.update(request.version_id._id.toString(), clean({ status: "active" } as any));
      await this.documentRepo.update(documentId, clientId, clean({
        status: "active",
        current_version_id: request.version_id._id,
        verified_by: clientAdminId,
        verified_at: new Date(),
      } as any));
    } else if (request.request_type === "update") {
      const updates = request.new_data || {};
      const payload: any = {
        title: updates.title ?? request.document_id.title,
        document_number: updates.document_number ?? request.document_id.document_number,
        start_date: updates.start_date ?? request.document_id.start_date,
        end_date: updates.end_date ?? request.document_id.end_date,
        renewal_reminder_days: updates.renewal_reminder_days ?? request.document_id.renewal_reminder_days,
        status: "active",
      };

      if (request.version_id) {
        await this.versionRepo.update(request.version_id._id.toString(), clean({ status: "active" } as any));
        payload.current_version_id = request.version_id._id;
      }

      await this.documentRepo.update(documentId, clientId, clean(payload));
    } else if (request.request_type === "renew") {
      // Archive the old version
      const doc = await this.documentRepo.findById(documentId, clientId);
      if (doc && doc.current_version_id) {
        await this.versionRepo.update(doc.current_version_id, clean({ status: "renewed" } as any));
      }

      // Activate new version
      await this.versionRepo.update(request.version_id._id.toString(), clean({ status: "active" } as any));

      const updates = request.new_data || {};
      await this.documentRepo.update(documentId, clientId, clean({
        document_number: updates.document_number,
        start_date: updates.start_date,
        end_date: updates.end_date,
        renewal_reminder_days: updates.renewal_reminder_days,
        current_version_id: request.version_id._id,
        status: "active",
      } as any));
    } else if (request.request_type === "delete") {
      await this.documentRepo.delete(documentId, clientId);
    }

    // Notify requester
    await this.notificationRepo.create(clean({
      client_id: clientId,
      document_id: documentId as any,
      receiver_type: request.requested_by_role === "ROLE_COMPANY" ? "company" : "tenant",
      receiver_id: request.requested_by,
      title: `Document ${request.request_type} Request Approved`,
      message: `Your request for document "${request.document_id.title}" has been approved.`,
      notification_type: "general",
      sent_by: clientAdminId,
      sent_by_role: "ROLE_CLIENT_ADMIN",
    } as any));

    return { message: "Request approved successfully." };
  }

  async listPendingApprovals(
    clientId: string,
    page: number,
    limit: number,
    requestType?: string
  ): Promise<any> {
    return this.approvalRepo.findAll(page, limit, clean<any>({
      client_id: clientId,
      approval_status: "pending",
      request_type: requestType,
    } as any));
  }

  async updateStaffAccess(
    documentId: string,
    clientId: string,
    staffId: string,
    canView: boolean,
    canEdit: boolean,
    adminId: string
  ): Promise<any> {
    const doc = await this.documentRepo.findById(documentId, clientId);
    if (!doc) throw new AppError("Document not found", 404);

    return this.staffAccessRepo.createOrUpdate(clean({
      document_id: documentId,
      staff_id: staffId,
      can_view: canView,
      can_edit: canEdit,
      assigned_by: adminId,
    } as any));
  }

  async getStaffAccessList(
    documentId: string,
    clientId: string
  ): Promise<any[]> {
    const doc = await this.documentRepo.findById(documentId, clientId);
    if (!doc) throw new AppError("Document not found", 404);

    return this.staffAccessRepo.findByDocument(documentId);
  }
}
