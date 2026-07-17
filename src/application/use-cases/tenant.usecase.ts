import type { TenantRepository, TenantService } from "../../domain/repositories/tenant.repository.interface.js";
import type { PasswordService } from "../../domain/repositories/auth.repository.interface.js";
import type { TenantRegistrationRequest, TenantResponse, PaginatedTenantResponse, TenantFilter } from "../../domain/types/tenant.types.js";
import { AppError } from "../../shared/utils/AppError.js";
import mongoose from "mongoose";
import { getDefaultAvatarUrl } from "../../shared/utils/avatar.js";
import TenantCompliance from "../../infrastructure/persistence/models/compliance.model.js";
import DocumentModel from "../../infrastructure/persistence/models/document.model.js";
import DocumentFileModel from "../../infrastructure/persistence/models/document-file.model.js";
import UserActivityLogModel from "../../infrastructure/persistence/models/user-activity-log.model.js";

async function logActivity(
    tenantId: mongoose.Types.ObjectId | string,
    action: string,
    module: 'Compliance' | 'Allocation' | 'Tenant' | 'Camp',
    performedBy: string,
    previousState: any = null,
    newState: any = null
) {
    try {
        await UserActivityLogModel.create({
            performed_by: performedBy,
            tenant_id: new mongoose.Types.ObjectId(tenantId),
            action,
            module,
            timestamp: new Date(),
            previous_state: previousState,
            new_state: newState
        });
    } catch (err) {
        console.error("Failed to log activity:", err);
    }
}

async function fetchComplianceObject(tenantId: string, tenantUser: any = null, minimal: boolean = false) {
    if (!tenantUser) {
        tenantUser = await mongoose.model('user_register').findById(tenantId).lean();
    }

    // Find all documents for this tenant
    const docs = await DocumentModel.find({ tenant_id: new mongoose.Types.ObjectId(tenantId) }).lean();
    const docIds = docs.map(d => d._id);

    // Find all active files for these documents
    const files = await DocumentFileModel.find({ document_id: { $in: docIds }, status: 'Active' }).lean();
    const fileMap = new Map<string, any[]>();
    files.forEach(f => {
        const dId = f.document_id.toString();
        if (!fileMap.has(dId)) {
            fileMap.set(dId, []);
        }
        fileMap.get(dId)!.push(f);
    });

    // 1. Find Passport document
    const passportDoc = docs.find(d => d.document_type === 'Passport');
    const passportFiles = passportDoc ? (fileMap.get(passportDoc._id.toString()) || []) : [];
    const passportFile = passportFiles[0];

    // 2. Find Government IDs
    const govtDocs = docs.filter(d => d.document_type === 'Government ID');
    const government_ids = govtDocs.map(d => {
        const dFiles = fileMap.get(d._id.toString()) || [];
        const front = dFiles.find(f => f.metadata?.side === 'front') || dFiles[0];
        const back = dFiles.find(f => f.metadata?.side === 'back') || dFiles[1];
        return {
            _id: d._id,
            id: d._id.toString(),
            document_type: d.metadata?.document_type || 'Emirates ID',
            document_number: d.document_number,
            issue_date: d.issue_date,
            expiry_date: d.expiry_date,
            front_file: front?.storage_path || '',
            front_file_id: front?._id?.toString() || '',
            back_file: back?.storage_path || '',
            back_file_id: back?._id?.toString() || '',
            verification_status: d.verification_status,
            rejection_reason: d.rejection_reason || ''
        };
    });

    // 3. Find Visa
    const visaDocs = docs.filter(d => d.document_type === 'Visa/Residency');
    const visa_residency = visaDocs.map(d => {
        const dFiles = fileMap.get(d._id.toString()) || [];
        return {
            _id: d._id,
            id: d._id.toString(),
            visa_type: d.metadata?.visa_type || 'Employment Visa',
            visa_number: d.document_number,
            issue_date: d.issue_date,
            expiry_date: d.expiry_date,
            supporting_document: dFiles[0]?.storage_path || '',
            supporting_document_id: dFiles[0]?._id?.toString() || '',
            verification_status: d.verification_status,
            rejection_reason: d.rejection_reason || ''
        };
    });

    // 4. Find Other generic documents
    const documents = minimal ? [] : docs.filter(d => d.document_type === 'Other').map(d => {
        const dFiles = fileMap.get(d._id.toString()) || [];
        const f = dFiles[0];
        return {
            _id: d._id,
            id: d._id.toString(),
            file_name: d.metadata?.label || f?.original_file_name || 'Document',
            file_url: f?.storage_path || '',
            file_id: f?._id?.toString() || '',
            upload_date: f?.uploaded_at || d.createdAt,
            uploaded_by: f?.uploaded_by || 'System',
            verification_status: d.verification_status,
            expiry_date: d.expiry_date,
            rejection_reason: d.rejection_reason || ''
        };
    });

    // 5. Fetch Activity Logs
    const activity_log = minimal ? [] : (await UserActivityLogModel.find({ tenant_id: new mongoose.Types.ObjectId(tenantId) })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean()).map(l => ({
            _id: l._id,
            action: l.action,
            performed_by: l.performed_by || 'System',
            date: l.timestamp
        }));

    // Split tenant name for first/last name
    const nameParts = (tenantUser?.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
        tenant_id: tenantId,
        first_name: firstName,
        last_name: lastName,
        nationality: tenantUser?.nationality || '',
        emergency_contact_name: tenantUser?.emergency_contact_name || '',
        emergency_contact_phone: tenantUser?.emergency_contact_phone || '',

        // Passport details
        passport_no: passportDoc?.document_number || '',
        passport_country: passportDoc?.metadata?.passport_country || '',
        passport_issue_date: passportDoc?.issue_date || null,
        passport_expiry_date: passportDoc?.expiry_date || null,
        passport_verification_status: passportDoc?.verification_status || 'Pending',
        passport_rejection_reason: passportDoc?.rejection_reason || '',
        passport_image: passportFile?.storage_path || '',
        passport_file_id: passportFile?._id?.toString() || '',

        government_ids,
        visa_residency,
        documents,
        activity_log,
        createdAt: tenantUser?.createdAt || new Date(),
        updatedAt: tenantUser?.updatedAt || new Date()
    };
}

export function computeComplianceDetails(compliance: any, tenant: any) {
    const govtIds = compliance?.government_ids || [];
    const visas = compliance?.visa_residency || [];

    // 1. Calculate compliance score
    let complianceScore = 0;
    const hasOnboarding = !!(compliance?.first_name && compliance?.last_name && tenant?.email &&
        tenant?.phone && tenant?.gender && tenant?.dob &&
        compliance?.nationality && compliance?.emergency_contact_name &&
        compliance?.emergency_contact_phone);

    if (hasOnboarding) complianceScore += 20;

    const hasPassport = !!compliance?.passport_image && compliance?.passport_verification_status === 'Verified';
    if (hasPassport) complianceScore += 25;

    const hasValidGovtId = govtIds.length > 0 && govtIds.some((id: any) => id.document_number && id.front_file && id.back_file);
    if (hasValidGovtId) complianceScore += 30;

    const hasValidVisa = visas.length > 0 && visas.some((v: any) => v.visa_number && v.supporting_document);
    if (hasValidVisa) complianceScore += 25;

    // 2. Calculate missing docs count & names
    let missing_docs_count = 0;
    let missing_docs: string[] = [];
    if (!compliance?.passport_image) {
        missing_docs_count++;
        missing_docs.push("Passport");
    }
    if (govtIds.length === 0) {
        missing_docs_count++;
        missing_docs.push("Government ID");
    }
    if (visas.length === 0) {
        missing_docs_count++;
        missing_docs.push("Visa / Residency");
    }

    // 3. Calculate expiring and expired docs counts
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    let expired_docs_count = 0;
    let expiring_docs_count = 0;

    const checkExpiry = (expiryDateStr: any) => {
        if (!expiryDateStr) return;
        const expiryDate = new Date(expiryDateStr);
        if (isNaN(expiryDate.getTime())) return;
        if (expiryDate < now) {
            expired_docs_count++;
        } else if (expiryDate <= thirtyDaysFromNow) {
            expiring_docs_count++;
        }
    };

    if (compliance?.passport_expiry_date) {
        checkExpiry(compliance.passport_expiry_date);
    }
    govtIds.forEach((id: any) => {
        if (id.expiry_date) checkExpiry(id.expiry_date);
    });
    visas.forEach((v: any) => {
        if (v.expiry_date) checkExpiry(v.expiry_date);
    });

    return {
        compliance_score: complianceScore,
        missing_docs_count,
        missing_docs,
        expiring_docs_count,
        expired_docs_count
    };
}

export class RegisterTenantUseCase implements TenantService {
    constructor(
        private tenantRepository: TenantRepository,
        private passwordService: PasswordService
    ) { }

    async registerTenant(data: TenantRegistrationRequest): Promise<TenantResponse> {
        try {
            if (!data.camp_id) {
                throw new AppError("Camp assignment is mandatory during tenant onboarding.", 400);
            }

            // Normalize email (lowercase + trim)
            const normalizedEmail = data.email.trim().toLowerCase();

            // Check for existing email before creating
            const existingTenant = await this.tenantRepository.findByEmail(normalizedEmail);
            if (existingTenant) {
                throw new AppError("Tenant with this email already exists", 409);
            }

            // Check for existing phone number before creating
            if (data.phone) {
                const existingPhone = await this.tenantRepository.findByPhone(data.phone.trim());
                if (existingPhone) {
                    throw new AppError("Tenant with this phone number already exists", 409);
                }
            }

            const hashedPassword = await this.passwordService.hash(data.password);

            // Generate 16-digit uuid
            const generateUUID = (phone: string) => {
                const timestamp = Date.now().toString(); // 13 digits
                const last3Digits = phone.slice(-3).padStart(3, "0"); // ensure 3 digits
                return timestamp + last3Digits; // total 16 digits
            };

            const firstName = data.first_name?.trim() || "";
            const lastName = data.last_name?.trim() || "";
            const fullName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : (data.name?.trim() || "Tenant");

            const avatarUrl = data.user_image?.trim()
                ? data.user_image.trim()
                : getDefaultAvatarUrl(fullName);

            const {
                first_name,
                last_name,
                nationality,
                emergency_contact_name,
                emergency_contact_phone,
                company_name,
                ...originalData
            } = data;

            const newTenantData: any = {
                ...originalData,
                name: fullName,
                company_name: data.client_name,
                email: normalizedEmail,
                password: hashedPassword,
                status: 5, // Draft / Incomplete Profile (Unverified)
                uuid: generateUUID(data.phone),
                user_image: avatarUrl,
                nationality,
                emergency_contact_name,
                emergency_contact_phone
            };

            // Normalize company_id to avoid Mongoose CastError on empty/invalid strings
            if (newTenantData.company_id) {
                const isCompanyUnassigned =
                    newTenantData.company_id === null ||
                    newTenantData.company_id === '' ||
                    newTenantData.company_id === 'null' ||
                    newTenantData.company_id === 'undefined' ||
                    newTenantData.company_id === 'unassigned';
                newTenantData.company_id = isCompanyUnassigned 
                    ? null 
                    : new mongoose.Types.ObjectId(newTenantData.company_id as string);
            } else {
                newTenantData.company_id = null;
            }

            // Normalize contract_id to avoid Mongoose CastError on empty/invalid strings
            if (newTenantData.contract_id) {
                const isContractUnassigned =
                    newTenantData.contract_id === null ||
                    newTenantData.contract_id === '' ||
                    newTenantData.contract_id === 'null' ||
                    newTenantData.contract_id === 'undefined' ||
                    newTenantData.contract_id === 'unassigned';
                newTenantData.contract_id = isContractUnassigned 
                    ? null 
                    : new mongoose.Types.ObjectId(newTenantData.contract_id as string);
            } else {
                newTenantData.contract_id = null;
            }

            // Auto-generate employee_id if not manually entered
            let employeeId = data.employee_id?.trim();
            if (!employeeId) {
                let companyCode = "EMP";
                if (newTenantData.company_id) {
                    const company = await mongoose.model("companies").findOne({ _id: newTenantData.company_id, deleted_at: null }).lean() as any;
                    if (company) {
                        companyCode = company.company_code || company.alias || "EMP";
                    }
                }
                const prefix = `${companyCode}-`;
                const escapedPrefix = prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const regex = new RegExp(`^${escapedPrefix}(\\d+)$`);

                // Find siblings globally (no client_id scoping)
                const siblings = await mongoose.model("user_register").find({
                    employee_id: { $regex: regex }
                }, { employee_id: 1 }).lean() as any[];

                let maxSeq = 0;
                for (const s of siblings) {
                    if (s.employee_id) {
                        const match = s.employee_id.match(regex);
                        if (match && match[1]) {
                            const num = parseInt(match[1], 10);
                            if (num > maxSeq) {
                                maxSeq = num;
                            }
                        }
                    }
                }
                const nextSeq = maxSeq + 1;
                employeeId = `${prefix}${String(nextSeq).padStart(4, '0')}`;
            }
            newTenantData.employee_id = employeeId;

            const newTenant = await this.tenantRepository.createTenant(newTenantData);

            // Create user activity log in separate collection
            await UserActivityLogModel.create({
                performed_by: "System",
                tenant_id: newTenant._id,
                action: "Profile created (Draft)",
                module: "Tenant",
                timestamp: new Date()
            });

            const complianceObj = await fetchComplianceObject(newTenant._id.toString(), newTenant);

            // Security: Never return password
            return {
                id: newTenant._id.toString(),
                name: newTenant.name,
                email: newTenant.email,
                gender: newTenant.gender,
                country_code: newTenant.country_code,
                phone: newTenant.phone,
                client_name: newTenant.company_name,
                company_id: newTenant.company_id?._id?.toString() || newTenant.company_id?.toString(),
                company_name: newTenant.company_id?.company_name || newTenant.company_name,
                contract_id: newTenant.contract_id?._id?.toString() || newTenant.contract_id?.toString() || null,
                contract_name: newTenant.contract_id?.contract_name || null,
                contract_number: newTenant.contract_id?.contract_number || null,
                camp_id: newTenant.camp_id ? newTenant.camp_id.toString() : undefined,
                country_id: newTenant.country_id?.toString(),
                country_state: newTenant.country_state,
                home_address: newTenant.home_address,
                status: newTenant.status,
                type: newTenant.type,
                allocation_status: newTenant.allocation_status,
                uuid: newTenant.uuid,
                user_image: newTenant.user_image || '',
                employee_id: newTenant.employee_id || '',
                contract_end_date: newTenant.contract_end_date,
                createdAt: newTenant.createdAt,
                updatedAt: newTenant.updatedAt,

                // Onboarding details
                first_name: complianceObj.first_name || '',
                last_name: complianceObj.last_name || '',
                nationality: complianceObj.nationality || '',
                dob: newTenant.dob,
                emergency_contact_name: complianceObj.emergency_contact_name || '',
                emergency_contact_phone: complianceObj.emergency_contact_phone || '',

                // Passport
                passport_no: complianceObj.passport_no || '',
                passport_country: complianceObj.passport_country || '',
                passport_issue_date: complianceObj.passport_issue_date ?? null,
                passport_expiry_date: complianceObj.passport_expiry_date ?? null,
                passport_verification_status: complianceObj.passport_verification_status || 'Pending',
                passport_rejection_reason: complianceObj.passport_rejection_reason ?? null,
                passport_image: complianceObj.passport_image || '',
                passport_file_id: complianceObj.passport_file_id || '',

                // Document arrays
                government_ids: complianceObj.government_ids || [],
                visa_residency: complianceObj.visa_residency || [],
                documents: complianceObj.documents || [],
                activity_log: complianceObj.activity_log || []
            } as TenantResponse;
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            throw new AppError(`${error.message}`, 500);
        }
    }

    async getAllTenants(page: number = 1, limit: number = 10, filters?: TenantFilter, client_id?: string): Promise<PaginatedTenantResponse> {
        try {
            const { data, total } = await this.tenantRepository.findAll(page, limit, filters, client_id);

            const tenantIds = data.map((tenant: any) => tenant._id);

            // Batch fetch documents and files for all tenants in the current page
            const docs = await DocumentModel.find({ tenant_id: { $in: tenantIds } }).lean();
            const docIds = docs.map(d => d._id);
            const files = await DocumentFileModel.find({ document_id: { $in: docIds }, status: 'Active' }).lean();

            const docMap = new Map<string, any[]>();
            docs.forEach(d => {
                const tId = d.tenant_id.toString();
                if (!docMap.has(tId)) docMap.set(tId, []);
                docMap.get(tId)!.push(d);
            });

            const fileMap = new Map<string, any[]>();
            files.forEach(f => {
                const dId = f.document_id.toString();
                if (!fileMap.has(dId)) fileMap.set(dId, []);
                fileMap.get(dId)!.push(f);
            });

            const tenants = data.map((tenant: any) => {
                const tid = tenant._id.toString();
                const tDocs = docMap.get(tid) || [];

                // Name parts
                const nameParts = (tenant.name || '').trim().split(/\s+/);
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';

                // Documents
                const passportDoc = tDocs.find(d => d.document_type === 'Passport');
                const passportFile = passportDoc ? (fileMap.get(passportDoc._id.toString())?.[0]) : null;

                const govtDocs = tDocs.filter(d => d.document_type === 'Government ID');
                const govtIds = govtDocs.map(d => {
                    const dFiles = fileMap.get(d._id.toString()) || [];
                    const front = dFiles.find(f => f.metadata?.side === 'front') || dFiles[0];
                    const back = dFiles.find(f => f.metadata?.side === 'back') || dFiles[1];
                    return { document_number: d.document_number, front_file: front?.storage_path, back_file: back?.storage_path };
                });

                const visaDocs = tDocs.filter(d => d.document_type === 'Visa/Residency');
                const visas = visaDocs.map(d => {
                    const dFiles = fileMap.get(d._id.toString()) || [];
                    return { visa_number: d.document_number, supporting_document: dFiles[0]?.storage_path };
                });

                // Calculate score manually without constructing the entire compliance object
                let complianceScore = 0;
                const hasOnboarding = !!(firstName && lastName && tenant.email &&
                    tenant.phone && tenant.gender && tenant.dob &&
                    tenant.nationality && tenant.emergency_contact_name &&
                    tenant.emergency_contact_phone);
                if (hasOnboarding) complianceScore += 20;

                const hasPassport = !!passportFile?.storage_path && passportDoc?.verification_status === 'Verified';
                if (hasPassport) complianceScore += 25;

                const hasValidGovtId = govtIds.length > 0 && govtIds.some((id: any) => id.document_number && id.front_file && id.back_file);
                if (hasValidGovtId) complianceScore += 30;

                const hasValidVisa = visas.length > 0 && visas.some((v: any) => v.visa_number && v.supporting_document);
                if (hasValidVisa) complianceScore += 25;

                return {
                    id: tenant._id.toString(),
                    name: tenant.name,
                    email: tenant.email,
                    country_code: tenant.country_code,
                    phone: tenant.phone,
                    client_name: tenant.company_name,
                    company_id: tenant.company_id?._id?.toString() || tenant.company_id?.toString(),
                    company_name: tenant.company_id?.company_name || tenant.company_name,
                    contract_id: tenant.contract_id?._id?.toString() || tenant.contract_id?.toString() || null,
                    contract_name: tenant.contract_id?.contract_name || null,
                    contract_number: tenant.contract_id?.contract_number || null,
                    camp_id: tenant.camp_id?.toString() || null,
                    country_id: tenant.country_id?.toString(),
                    country_state: tenant.country_state,
                    home_address: tenant.home_address,
                    status: tenant.status,
                    type: tenant.type,
                    allocation_status: tenant.allocation_status,
                    uuid: tenant.uuid,
                    user_image: tenant.user_image || '',
                    employee_id: tenant.employee_id || '',
                    contract_end_date: tenant.contract_end_date,
                    gender: tenant.gender,
                    createdAt: tenant.createdAt,
                    updatedAt: tenant.updatedAt,

                    // Only send compliance_score and passport_verification_status
                    compliance_score: complianceScore,
                    passport_verification_status: passportDoc?.verification_status || 'Pending'
                };
            });

            return {
                data: tenants,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            throw new AppError(`${error.message}`, 500);
        }
    }

    async editTenant(id: string, data: Partial<TenantRegistrationRequest> = {}, performedBy: string = "System"): Promise<TenantResponse> {
        try {
            const tenant = await this.tenantRepository.findById(id);
            if (!tenant) {
                throw new AppError("Tenant not found", 404);
            }

            // Ensure data is defined
            if (!data) {
                data = {};
            }

            // Camp reallocation restriction
            if (data.camp_id !== undefined && data.camp_id?.toString() !== tenant.camp_id?.toString()) {
                if (tenant.allocation_status === true) {
                    throw new AppError("Tenant is already allocated to a room/bed. Camp reassignment is not permitted until deallocation.", 400);
                }
            }

            const logs: string[] = [];

            // Detect basic changes
            const nameParts = (tenant.name || "").trim().split(/\s+/);
            const currentFirst = nameParts[0] || "";
            const currentLast = nameParts.slice(1).join(" ") || "";
            if (data.first_name !== undefined && data.first_name !== currentFirst) {
                logs.push("First Name updated");
            }
            if (data.last_name !== undefined && data.last_name !== currentLast) {
                logs.push("Last Name updated");
            }
            if (data.phone !== undefined && data.phone !== tenant.phone) {
                logs.push("Phone number updated");
            }
            if (data.email !== undefined && data.email !== tenant.email) {
                logs.push("Email address updated");
            }
            if (data.dob !== undefined && data.dob !== tenant.dob) {
                logs.push("Date of Birth updated");
            }
            if (data.nationality !== undefined && data.nationality !== tenant.nationality) {
                logs.push("Nationality updated");
            }
            if (data.emergency_contact_name !== undefined && data.emergency_contact_name !== tenant.emergency_contact_name) {
                logs.push("Emergency contact name updated");
            }
            if (data.emergency_contact_phone !== undefined && data.emergency_contact_phone !== tenant.emergency_contact_phone) {
                logs.push("Emergency contact phone updated");
            }
            if (data.camp_id !== undefined && data.camp_id?.toString() !== tenant.camp_id?.toString()) {
                logs.push("Camp assignment updated");
            }
            if (data.country_state !== undefined && data.country_state !== tenant.country_state) {
                logs.push("Country State updated");
            }
            console.log("passport updated", data);
            // Passport changes
            const isPassportUpdated =
                data.passport_no !== undefined ||
                data.passport_country !== undefined ||
                data.passport_issue_date !== undefined ||
                data.passport_expiry_date !== undefined ||
                data.passport_verification_status !== undefined ||
                data.passport_rejection_reason !== undefined ||
                data.passport_image !== undefined;


            if (isPassportUpdated) {
                let passportDoc = await DocumentModel.findOne({ tenant_id: tenant._id, document_type: 'Passport' });
                const isNew = !passportDoc;
                if (!passportDoc) {
                    passportDoc = new DocumentModel({
                        tenant_id: tenant._id,
                        camp_id: data.camp_id || tenant.camp_id || new mongoose.Types.ObjectId(id), // fallback if camp not assigned yet
                        document_type: 'Passport',
                        verification_status: 'Pending'
                    });
                }

                let passportChanged = false;
                if (data.passport_no !== undefined && data.passport_no !== passportDoc.document_number) {
                    passportDoc.document_number = data.passport_no;
                    logs.push("Passport number updated");
                    passportChanged = true;
                }
                if (data.passport_issue_date !== undefined) {
                    const newIssueDate = data.passport_issue_date ? new Date(data.passport_issue_date) : null;
                    if (newIssueDate?.getTime() !== passportDoc.issue_date?.getTime()) {
                        passportDoc.issue_date = newIssueDate;
                        passportChanged = true;
                    }
                }
                if (data.passport_expiry_date !== undefined) {
                    const newExpiryDate = data.passport_expiry_date ? new Date(data.passport_expiry_date) : null;
                    if (newExpiryDate?.getTime() !== passportDoc.expiry_date?.getTime()) {
                        passportDoc.expiry_date = newExpiryDate;
                        passportChanged = true;
                    }
                }
                if (data.passport_verification_status !== undefined && data.passport_verification_status !== passportDoc.verification_status) {
                    passportDoc.verification_status = data.passport_verification_status as any;
                    logs.push(`Passport verification status updated to ${data.passport_verification_status}`);
                    passportChanged = true;
                }
                if (data.passport_rejection_reason !== undefined && data.passport_rejection_reason !== passportDoc.rejection_reason) {
                    passportDoc.rejection_reason = data.passport_rejection_reason || '';
                    passportChanged = true;
                }
                if (data.passport_country !== undefined && data.passport_country !== passportDoc.metadata?.passport_country) {
                    passportDoc.metadata = { ...passportDoc.metadata, passport_country: data.passport_country };
                    logs.push("Passport country updated");
                    passportChanged = true;
                }
                if (data.camp_id !== undefined && data.camp_id?.toString() !== passportDoc.camp_id?.toString()) {
                    passportDoc.camp_id = new mongoose.Types.ObjectId(data.camp_id);
                    passportChanged = true;
                }

                if (passportChanged || isNew) {
                    await passportDoc.save();
                }

                if (data.passport_image !== undefined) {
                    const activeFile = await DocumentFileModel.findOne({ document_id: passportDoc._id, status: 'Active' });
                    if (!activeFile || activeFile.storage_path !== data.passport_image) {
                        if (activeFile) {
                            activeFile.status = 'Archived';
                            activeFile.replaced_by = performedBy;
                            activeFile.replaced_at = new Date();
                            await activeFile.save();
                        }
                        if (data.passport_image) {
                            await DocumentFileModel.create({
                                document_id: passportDoc._id,
                                original_file_name: data.passport_image.split('/').pop()?.split('?')[0] || 'passport.jpg',
                                stored_file_name: data.passport_image.split('/').pop()?.split('?')[0] || 'passport.jpg',
                                mime_type: 'image/jpeg',
                                file_size: 0,
                                storage_path: data.passport_image,
                                uploaded_by: performedBy,
                                uploaded_at: new Date(),
                                status: 'Active'
                            });
                            logs.push("Passport file updated");
                        }
                    }
                }
            }

            // Government IDs
            if (data.government_ids !== undefined) {
                const existingGovtDocs = await DocumentModel.find({ tenant_id: tenant._id, document_type: 'Government ID' });
                const activeGovtDocIds = new Set<string>();

                for (const gid of data.government_ids) {
                    let doc;
                    if (gid._id || gid.id) {
                        doc = existingGovtDocs.find(d => d._id.toString() === (gid._id || gid.id).toString());
                    }

                    if (!doc) {
                        doc = new DocumentModel({
                            tenant_id: tenant._id,
                            camp_id: data.camp_id || tenant.camp_id || new mongoose.Types.ObjectId(id),
                            document_type: 'Government ID'
                        });
                    }

                    doc.document_number = gid.document_number || '';
                    doc.issue_date = gid.issue_date ? new Date(gid.issue_date) : null;
                    doc.expiry_date = gid.expiry_date ? new Date(gid.expiry_date) : null;
                    doc.verification_status = gid.verification_status || 'Pending';
                    doc.rejection_reason = gid.rejection_reason || '';
                    doc.metadata = { ...doc.metadata, document_type: gid.document_type || 'Emirates ID' };

                    if (data.camp_id) {
                        doc.camp_id = new mongoose.Types.ObjectId(data.camp_id);
                    }

                    await doc.save();
                    activeGovtDocIds.add(doc._id.toString());

                    const files = await DocumentFileModel.find({ document_id: doc._id, status: 'Active' });

                    if (gid.front_file !== undefined) {
                        const activeFront = files.find(f => f.metadata?.side === 'front');
                        if (!activeFront || activeFront.storage_path !== gid.front_file) {
                            if (activeFront) {
                                activeFront.status = 'Archived';
                                activeFront.replaced_by = performedBy;
                                activeFront.replaced_at = new Date();
                                await activeFront.save();
                            }
                            if (gid.front_file) {
                                await DocumentFileModel.create({
                                    document_id: doc._id,
                                    original_file_name: gid.front_file.split('/').pop()?.split('?')[0] || 'front_id.jpg',
                                    stored_file_name: gid.front_file.split('/').pop()?.split('?')[0] || 'front_id.jpg',
                                    mime_type: 'image/jpeg',
                                    file_size: 0,
                                    storage_path: gid.front_file,
                                    uploaded_by: performedBy,
                                    uploaded_at: new Date(),
                                    status: 'Active',
                                    metadata: { side: 'front' }
                                });
                            }
                        }
                    }

                    if (gid.back_file !== undefined) {
                        const activeBack = files.find(f => f.metadata?.side === 'back');
                        if (!activeBack || activeBack.storage_path !== gid.back_file) {
                            if (activeBack) {
                                activeBack.status = 'Archived';
                                activeBack.replaced_by = performedBy;
                                activeBack.replaced_at = new Date();
                                await activeBack.save();
                            }
                            if (gid.back_file) {
                                await DocumentFileModel.create({
                                    document_id: doc._id,
                                    original_file_name: gid.back_file.split('/').pop()?.split('?')[0] || 'back_id.jpg',
                                    stored_file_name: gid.back_file.split('/').pop()?.split('?')[0] || 'back_id.jpg',
                                    mime_type: 'image/jpeg',
                                    file_size: 0,
                                    storage_path: gid.back_file,
                                    uploaded_by: performedBy,
                                    uploaded_at: new Date(),
                                    status: 'Active',
                                    metadata: { side: 'back' }
                                });
                            }
                        }
                    }
                }

                for (const oldDoc of existingGovtDocs) {
                    if (!activeGovtDocIds.has(oldDoc._id.toString())) {
                        await DocumentFileModel.updateMany(
                            { document_id: oldDoc._id, status: 'Active' },
                            { status: 'Archived', replaced_by: performedBy, replaced_at: new Date() }
                        );
                        await DocumentModel.deleteOne({ _id: oldDoc._id });
                    }
                }
                logs.push("Government IDs updated");
            }

            // Visa Residency
            if (data.visa_residency !== undefined) {
                const existingVisaDocs = await DocumentModel.find({ tenant_id: tenant._id, document_type: 'Visa/Residency' });
                const activeVisaDocIds = new Set<string>();

                for (const visa of data.visa_residency) {
                    let doc;
                    if (visa._id || visa.id) {
                        doc = existingVisaDocs.find(d => d._id.toString() === (visa._id || visa.id).toString());
                    }

                    if (!doc) {
                        doc = new DocumentModel({
                            tenant_id: tenant._id,
                            camp_id: data.camp_id || tenant.camp_id || new mongoose.Types.ObjectId(id),
                            document_type: 'Visa/Residency'
                        });
                    }

                    doc.document_number = visa.visa_number || '';
                    doc.issue_date = visa.issue_date ? new Date(visa.issue_date) : null;
                    doc.expiry_date = visa.expiry_date ? new Date(visa.expiry_date) : null;
                    doc.verification_status = visa.verification_status || 'Pending';
                    doc.rejection_reason = visa.rejection_reason || '';
                    doc.metadata = { ...doc.metadata, visa_type: visa.visa_type || 'Employment Visa' };

                    if (data.camp_id) {
                        doc.camp_id = new mongoose.Types.ObjectId(data.camp_id);
                    }

                    await doc.save();
                    activeVisaDocIds.add(doc._id.toString());

                    if (visa.supporting_document !== undefined) {
                        const activeFile = await DocumentFileModel.findOne({ document_id: doc._id, status: 'Active' });
                        if (!activeFile || activeFile.storage_path !== visa.supporting_document) {
                            if (activeFile) {
                                activeFile.status = 'Archived';
                                activeFile.replaced_by = performedBy;
                                activeFile.replaced_at = new Date();
                                await activeFile.save();
                            }
                            if (visa.supporting_document) {
                                await DocumentFileModel.create({
                                    document_id: doc._id,
                                    original_file_name: visa.supporting_document.split('/').pop()?.split('?')[0] || 'visa.jpg',
                                    stored_file_name: visa.supporting_document.split('/').pop()?.split('?')[0] || 'visa.jpg',
                                    mime_type: 'image/jpeg',
                                    file_size: 0,
                                    storage_path: visa.supporting_document,
                                    uploaded_by: performedBy,
                                    uploaded_at: new Date(),
                                    status: 'Active'
                                });
                            }
                        }
                    }
                }

                for (const oldDoc of existingVisaDocs) {
                    if (!activeVisaDocIds.has(oldDoc._id.toString())) {
                        await DocumentFileModel.updateMany(
                            { document_id: oldDoc._id, status: 'Active' },
                            { status: 'Archived', replaced_by: performedBy, replaced_at: new Date() }
                        );
                        await DocumentModel.deleteOne({ _id: oldDoc._id });
                    }
                }
                logs.push("Visa records updated");
            }

            // Documents / Other
            if (data.documents !== undefined) {
                const existingOtherDocs = await DocumentModel.find({ tenant_id: tenant._id, document_type: 'Other' });
                const activeOtherDocIds = new Set<string>();

                for (const gdoc of data.documents) {
                    let doc;
                    if (gdoc._id || gdoc.id) {
                        doc = existingOtherDocs.find(d => d._id.toString() === (gdoc._id || gdoc.id).toString());
                    }

                    if (!doc) {
                        doc = new DocumentModel({
                            tenant_id: tenant._id,
                            camp_id: data.camp_id || tenant.camp_id || new mongoose.Types.ObjectId(id),
                            document_type: 'Other'
                        });
                    }

                    doc.expiry_date = gdoc.expiry_date ? new Date(gdoc.expiry_date) : null;
                    doc.verification_status = gdoc.verification_status || 'Pending';
                    doc.rejection_reason = gdoc.rejection_reason || '';
                    doc.metadata = { ...doc.metadata, label: gdoc.file_name || 'Document' };

                    if (data.camp_id) {
                        doc.camp_id = new mongoose.Types.ObjectId(data.camp_id);
                    }

                    await doc.save();
                    activeOtherDocIds.add(doc._id.toString());

                    if (gdoc.file_url !== undefined) {
                        const activeFile = await DocumentFileModel.findOne({ document_id: doc._id, status: 'Active' });
                        if (!activeFile || activeFile.storage_path !== gdoc.file_url) {
                            if (activeFile) {
                                activeFile.status = 'Archived';
                                activeFile.replaced_by = performedBy;
                                activeFile.replaced_at = new Date();
                                await activeFile.save();
                            }
                            if (gdoc.file_url) {
                                await DocumentFileModel.create({
                                    document_id: doc._id,
                                    original_file_name: gdoc.file_name || 'file.jpg',
                                    stored_file_name: gdoc.file_url.split('/').pop()?.split('?')[0] || 'file.jpg',
                                    mime_type: 'image/jpeg',
                                    file_size: 0,
                                    storage_path: gdoc.file_url,
                                    uploaded_by: gdoc.uploaded_by || performedBy,
                                    uploaded_at: gdoc.upload_date || new Date(),
                                    status: 'Active'
                                });
                            }
                        }
                    }
                }

                for (const oldDoc of existingOtherDocs) {
                    if (!activeOtherDocIds.has(oldDoc._id.toString())) {
                        await DocumentFileModel.updateMany(
                            { document_id: oldDoc._id, status: 'Active' },
                            { status: 'Archived', replaced_by: performedBy, replaced_at: new Date() }
                        );
                        await DocumentModel.deleteOne({ _id: oldDoc._id });
                    }
                }
                logs.push("Documents updated");
            }

            // Sync User register logs
            if (data.status !== undefined && data.status !== tenant.status) {
                const statusNames: { [key: number]: string } = { 0: 'Deleted', 1: 'Active', 2: 'Pending', 3: 'Blocked', 4: 'Deactivated', 5: 'Unverified/Draft' };
                logs.push(`Status updated to ${statusNames[data.status] || data.status}`);
            }

            if (logs.length > 0) {
                for (const log of logs) {
                    await logActivity(tenant._id.toString(), log, 'Compliance', performedBy);
                }
            }

            // Prepare update data for UserRegister
            const userUpdateData: any = { ...data };
            delete userUpdateData.first_name;
            delete userUpdateData.last_name;
            delete userUpdateData.passport_no;
            delete userUpdateData.passport_country;
            delete userUpdateData.passport_issue_date;
            delete userUpdateData.passport_expiry_date;
            delete userUpdateData.passport_verification_status;
            delete userUpdateData.passport_rejection_reason;
            delete userUpdateData.passport_image;
            delete userUpdateData.government_ids;
            delete userUpdateData.visa_residency;
            delete userUpdateData.documents;
            delete userUpdateData.activity_log;

            // Sync full name if first_name or last_name updated
            const newFirst = data.first_name !== undefined ? data.first_name : currentFirst;
            const newLast = data.last_name !== undefined ? data.last_name : currentLast;
            userUpdateData.name = `${newFirst} ${newLast}`.trim() || tenant.name;

            // Sync Passport / Visa / National ID properties to UserRegister for legacy compatibility
            const passportDoc = await DocumentModel.findOne({ tenant_id: tenant._id, document_type: 'Passport' });
            if (passportDoc && passportDoc.document_number) {
                userUpdateData.passport_no = passportDoc.document_number;
            }
            const passportFile = passportDoc ? await DocumentFileModel.findOne({ document_id: passportDoc._id, status: 'Active' }) : null;
            if (passportFile && passportFile.storage_path) {
                userUpdateData.passport_image = passportFile.storage_path;
            }

            const visaDoc = await DocumentModel.findOne({ tenant_id: tenant._id, document_type: 'Visa/Residency' });
            if (visaDoc && visaDoc.document_number) {
                userUpdateData.visa_number = visaDoc.document_number;
            }

            const govtDoc = await DocumentModel.findOne({ tenant_id: tenant._id, document_type: 'Government ID' });
            if (govtDoc) {
                if (govtDoc.document_number) {
                    userUpdateData.national_id = govtDoc.document_number;
                }
                if (govtDoc.issue_date) {
                    userUpdateData.national_id_issue_at = govtDoc.issue_date;
                }
                if (govtDoc.expiry_date) {
                    userUpdateData.national_id_expiry_at = govtDoc.expiry_date;
                }
            }

            if (userUpdateData.user_image !== undefined && userUpdateData.user_image !== tenant.user_image) {
                if (userUpdateData.user_image === '') {
                    const existingName = userUpdateData.name || tenant.name || 'User';
                    userUpdateData.user_image = getDefaultAvatarUrl(existingName);
                }
            }

            // Normalize email if provided
            if (userUpdateData.email) {
                userUpdateData.email = userUpdateData.email.trim().toLowerCase();
                const existingTenant = await this.tenantRepository.findByEmail(userUpdateData.email);
                if (existingTenant && existingTenant._id.toString() !== id) {
                    throw new AppError("Tenant with this email already exists", 409);
                }
            }

            // Check phone if provided
            if (userUpdateData.phone) {
                userUpdateData.phone = userUpdateData.phone.trim();
                const existingPhone = await this.tenantRepository.findByPhone(userUpdateData.phone);
                if (existingPhone && existingPhone._id.toString() !== id) {
                    throw new AppError("Tenant with this phone number already exists", 409);
                }
            }

            if ('company_id' in userUpdateData) {
                const isCompanyUnassigned =
                    userUpdateData.company_id === null ||
                    userUpdateData.company_id === '' ||
                    userUpdateData.company_id === 'null' ||
                    userUpdateData.company_id === 'undefined' ||
                    userUpdateData.company_id === 'unassigned';

                if (isCompanyUnassigned) {
                    userUpdateData.company_id = null as any;
                    userUpdateData.type = "individual";
                    (userUpdateData as any).company_name = "";
                    userUpdateData.client_name = "";
                    // If company is unassigned, contract is automatically unassigned
                    userUpdateData.contract_id = null;
                } else {
                    userUpdateData.company_id = new mongoose.Types.ObjectId(userUpdateData.company_id as string);
                    userUpdateData.type = "client";
                }
            } else if (userUpdateData.type === 'individual') {
                userUpdateData.company_id = null as any;
                (userUpdateData as any).company_name = "";
                userUpdateData.client_name = "";
                // If company is unassigned, contract is automatically unassigned
                userUpdateData.contract_id = null;
            }

            if ('contract_id' in userUpdateData) {
                const isContractUnassigned =
                    userUpdateData.contract_id === null ||
                    userUpdateData.contract_id === '' ||
                    userUpdateData.contract_id === 'null' ||
                    userUpdateData.contract_id === 'undefined' ||
                    userUpdateData.contract_id === 'unassigned';

                userUpdateData.contract_id = isContractUnassigned 
                    ? null 
                    : new mongoose.Types.ObjectId(userUpdateData.contract_id as string);
            }

            // Hash password if provided
            if (userUpdateData.password) {
                userUpdateData.password = await this.passwordService.hash(userUpdateData.password);
            }

            if (userUpdateData.client_name) {
                (userUpdateData as any).company_name = userUpdateData.client_name;
            }

            const updatedTenant = await this.tenantRepository.updateTenant(id, userUpdateData);

            if (!updatedTenant) {
                throw new AppError("Tenant could not be updated", 500);
            }

            const updatedComplianceObj = await fetchComplianceObject(tenant._id.toString(), updatedTenant);
            const compDetails = computeComplianceDetails(updatedComplianceObj, updatedTenant);

            const currentStatus = data.status !== undefined ? data.status : tenant.status;
            console.log("compDetails", compDetails)
            console.log("currentStatus", currentStatus)

            if (compDetails.compliance_score >= 25 && currentStatus === 5 && updatedComplianceObj.passport_verification_status === 'Verified') {
                await this.tenantRepository.updateTenant(id, { status: 1 });
                updatedTenant.status = 1;
            } else if (updatedComplianceObj.passport_verification_status === 'Pending' && currentStatus === 1) {
                await this.tenantRepository.updateTenant(id, { status: 5 });
                updatedTenant.status = 5;
            }

            return {
                id: updatedTenant._id.toString(),
                name: updatedTenant.name,
                email: updatedTenant.email,
                gender: updatedTenant.gender,
                country_code: updatedTenant.country_code,
                phone: updatedTenant.phone,
                client_name: updatedTenant.company_name,
                company_id: updatedTenant.company_id?._id?.toString() || updatedTenant.company_id?.toString(),
                company_name: updatedTenant.company_id?.company_name || updatedTenant.company_name,
                contract_id: updatedTenant.contract_id?._id?.toString() || updatedTenant.contract_id?.toString() || null,
                contract_name: updatedTenant.contract_id?.contract_name || null,
                contract_number: updatedTenant.contract_id?.contract_number || null,
                camp_id: updatedTenant.camp_id ? updatedTenant.camp_id.toString() : undefined,
                country_id: updatedTenant.country_id?.toString(),
                country_state: updatedTenant.country_state,
                home_address: updatedTenant.home_address,
                status: updatedTenant.status,
                type: updatedTenant.type,
                allocation_status: updatedTenant.allocation_status,
                uuid: updatedTenant.uuid,
                user_image: updatedTenant.user_image || '',
                employee_id: updatedTenant.employee_id || '',
                contract_end_date: updatedTenant.contract_end_date,
                createdAt: updatedTenant.createdAt,
                updatedAt: updatedTenant.updatedAt,

                // Compliance fields
                first_name: updatedComplianceObj.first_name || '',
                last_name: updatedComplianceObj.last_name || '',
                nationality: updatedComplianceObj.nationality || '',
                dob: updatedTenant.dob,
                emergency_contact_name: updatedComplianceObj.emergency_contact_name || '',
                emergency_contact_phone: updatedComplianceObj.emergency_contact_phone || '',

                // Passport
                passport_no: updatedComplianceObj.passport_no || '',
                passport_country: updatedComplianceObj.passport_country || '',
                passport_issue_date: updatedComplianceObj.passport_issue_date ?? null,
                passport_expiry_date: updatedComplianceObj.passport_expiry_date ?? null,
                passport_verification_status: updatedComplianceObj.passport_verification_status || 'Pending',
                passport_rejection_reason: updatedComplianceObj.passport_rejection_reason ?? null,
                passport_image: updatedComplianceObj.passport_image || '',
                passport_file_id: updatedComplianceObj.passport_file_id || '',

                government_ids: updatedComplianceObj.government_ids || [],
                visa_residency: updatedComplianceObj.visa_residency || [],
                documents: updatedComplianceObj.documents || [],
                activity_log: updatedComplianceObj.activity_log || [],

                // Compliance metrics
                ...compDetails
            } as TenantResponse;
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            throw new AppError(`${error.message}`, 500);
        }
    }

    async deleteTenant(id: string): Promise<void> {
        try {
            const tenant = await this.tenantRepository.findById(id);
            if (!tenant) {
                throw new AppError("Tenant not found", 404);
            }

            await this.tenantRepository.deleteTenant(id);
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            throw new AppError(`${error.message}`, 500);
        }
    }

    async getTenantById(id: string): Promise<TenantResponse> {
        try {
            const tenant = await this.tenantRepository.findById(id);
            if (!tenant) {
                throw new AppError("Tenant not found", 404);
            }

            const complianceObj = await fetchComplianceObject(tenant._id.toString(), tenant);
            const compDetails = computeComplianceDetails(complianceObj, tenant);

            return {
                id: tenant._id.toString(),
                name: tenant.name,
                email: tenant.email,
                gender: tenant.gender,
                country_code: tenant.country_code,
                phone: tenant.phone,
                client_name: tenant.company_name,
                company_id: tenant.company_id?._id?.toString() || tenant.company_id?.toString(),
                company_name: tenant.company_id?.company_name || tenant.company_name,
                contract_id: tenant.contract_id?._id?.toString() || tenant.contract_id?.toString() || null,
                contract_name: tenant.contract_id?.contract_name || null,
                contract_number: tenant.contract_id?.contract_number || null,
                camp_id: tenant.camp_id ? tenant.camp_id.toString() : undefined,
                country_id: tenant.country_id?.toString(),
                country_state: tenant.country_state,
                home_address: tenant.home_address,
                status: tenant.status,
                type: tenant.type,
                allocation_status: tenant.allocation_status,
                uuid: tenant.uuid,
                user_image: tenant.user_image || '',
                employee_id: tenant.employee_id || '',
                contract_end_date: tenant.contract_end_date,
                createdAt: tenant.createdAt,
                updatedAt: tenant.updatedAt,

                // Onboarding details
                first_name: complianceObj.first_name || '',
                last_name: complianceObj.last_name || '',
                nationality: complianceObj.nationality || '',
                dob: tenant.dob,
                emergency_contact_name: complianceObj.emergency_contact_name || '',
                emergency_contact_phone: complianceObj.emergency_contact_phone || '',

                // Passport
                passport_no: complianceObj.passport_no || '',
                passport_country: complianceObj.passport_country || '',
                passport_issue_date: complianceObj.passport_issue_date ?? null,
                passport_expiry_date: complianceObj.passport_expiry_date ?? null,
                passport_verification_status: complianceObj.passport_verification_status || 'Pending',
                passport_rejection_reason: complianceObj.passport_rejection_reason ?? null,
                passport_image: complianceObj.passport_image || '',
                passport_file_id: complianceObj.passport_file_id || '',

                government_ids: complianceObj.government_ids || [],
                visa_residency: complianceObj.visa_residency || [],
                documents: complianceObj.documents || [],
                activity_log: complianceObj.activity_log || [],

                // Compliance metrics
                ...compDetails
            } as TenantResponse;
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            throw new AppError(`${error.message}`, 500);
        }
    }

    async getBasicTenantById(id: string): Promise<any> {
        try {
            const tenant = await this.tenantRepository.findBasicById(id);
            if (!tenant) {
                throw new AppError("Tenant not found", 404);
            }

            return {
                id: tenant._id.toString(),
                name: tenant.name,
                email: tenant.email,
                gender: tenant.gender,
                country_code: tenant.country_code,
                phone: tenant.phone,
                client_name: tenant.company_name,
                company_id: tenant.company_id?._id?.toString() || tenant.company_id?.toString(),
                company_name: tenant.company_id?.company_name || tenant.company_name,
                user_image: tenant.user_image || '',
                employee_id: tenant.employee_id || '',
                createdAt: tenant.createdAt,
                dob: tenant.dob,
                status: tenant.status,
                nationality: tenant.nationality,
                country_state: tenant.country_state,
                emergency_contact_name: tenant.emergency_contact_name,
                emergency_contact_phone: tenant.emergency_contact_phone
            };
        } catch (error: any) {
            if (error instanceof AppError) throw error;
            throw new AppError(`${error.message}`, 500);
        }
    }
}
