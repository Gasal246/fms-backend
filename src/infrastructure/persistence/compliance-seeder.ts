import mongoose from 'mongoose';
import Permission from './models/permissions.model.js';
import Role from './models/role.model.js';
import RoleAssignedPermission from './models/role-assigned-permission.model.js';
import DocumentModel from './models/document.model.js';
import DocumentFileModel from './models/document-file.model.js';
import UserActivityLogModel from './models/user-activity-log.model.js';
import TenantCompliance from './models/compliance.model.js';
import UserRegister from './models/tenant.model.js';
import Company from './models/company.model.js';
import { logger } from '../../shared/logger/logger.js';

export async function seedPermissions() {
  try {
    await Role.findOneAndUpdate(
      { slug: 'ROLE_KITCHEN_MANAGER' },
      { $set: { name: 'Kitchen Manager', slug: 'ROLE_KITCHEN_MANAGER', deleted_at: null } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    const documentPermissions = [
      { name: 'View Documents', slug: 'DOCUMENT_VIEW', module: 'Compliance' },
      { name: 'Edit Documents', slug: 'DOCUMENT_EDIT', module: 'Compliance' },
      { name: 'Verify Documents', slug: 'DOCUMENT_VERIFY', module: 'Compliance' },
      { name: 'Delete Documents', slug: 'DOCUMENT_DELETE', module: 'Compliance' },
      { name: 'Download Documents', slug: 'DOCUMENT_DOWNLOAD', module: 'Compliance' },
      { name: 'View Contracts', slug: 'view_contract', module: 'Contracts' },
      { name: 'Create Contracts', slug: 'create_contract', module: 'Contracts' },
      { name: 'Edit Contracts', slug: 'edit_contract', module: 'Contracts' },
      { name: 'Delete / Archive Contracts', slug: 'delete_contract', module: 'Contracts' },
      { name: 'Manage Contract Allocations', slug: 'manage_contract_allocations', module: 'Contracts' },
      { name: 'Manage Contract Documents', slug: 'manage_contract_documents', module: 'Contracts' },
      { name: 'Link / Unlink Tenants to Contracts', slug: 'link_tenant_contract', module: 'Contracts' },
      { name: 'View Contract-linked Tenants', slug: 'view_contract_tenants', module: 'Contracts' },
      { name: 'View Kitchen Dashboard', slug: 'view_kitchen_dashboard', module: 'Catering' },
      { name: 'Manage Kitchen Orders', slug: 'manage_kitchen_orders', module: 'Catering' },
      { name: 'Manage Kitchen Dispatches', slug: 'manage_kitchen_dispatches', module: 'Catering' },
      { name: 'View Kitchen Reports', slug: 'view_kitchen_reports', module: 'Catering' }
    ];

    logger.info('Seeding compliance and contract permissions...');
    for (const p of documentPermissions) {
      await Permission.updateOne(
        { slug: p.slug },
        { $setOnInsert: { name: p.name, module: p.module, deleted_at: null } },
        { upsert: true }
      );
    }

    const roles = await Role.find({ deleted_at: null }).lean();
    const dbPermissions = await Permission.find({ slug: { $in: documentPermissions.map(p => p.slug) } }).lean();
    
    const permMap = new Map<string, any>();
    dbPermissions.forEach(p => permMap.set(p.slug, p));

    for (const role of roles) {
      let targetSlugs: string[] = [];
      if (role.slug === 'ROLE_CLIENT_ADMIN') {
        targetSlugs = [
          'DOCUMENT_VIEW', 'DOCUMENT_EDIT', 'DOCUMENT_VERIFY', 'DOCUMENT_DELETE', 'DOCUMENT_DOWNLOAD',
          'view_contract', 'create_contract', 'edit_contract', 'delete_contract',
          'manage_contract_allocations', 'manage_contract_documents',
          'link_tenant_contract', 'view_contract_tenants'
        ];
      } else if (role.slug === 'ROLE_COORDINATOR' || role.slug === 'ROLE_ZONE_COORDINATOR') {
        targetSlugs = ['DOCUMENT_VIEW', 'DOCUMENT_VERIFY', 'DOCUMENT_DOWNLOAD', 'view_contract', 'view_contract_tenants'];
      } else if (role.slug === 'ROLE_STAFF' || role.slug === 'ROLE_TECHNICIAN') {
        targetSlugs = ['DOCUMENT_VIEW', 'DOCUMENT_DOWNLOAD'];
      } else if (role.slug === 'ROLE_TENANT') {
        targetSlugs = ['DOCUMENT_VIEW', 'DOCUMENT_EDIT'];
      } else if (role.slug === 'ROLE_KITCHEN_MANAGER') {
        targetSlugs = ['view_kitchen_dashboard', 'manage_kitchen_orders', 'manage_kitchen_dispatches', 'view_kitchen_reports'];
      }

      for (const slug of targetSlugs) {
        const perm = permMap.get(slug);
        if (perm) {
          await RoleAssignedPermission.updateOne(
            { role_id: role._id, permission_id: perm._id },
            { $setOnInsert: { role_id: role._id, permission_id: perm._id } },
            { upsert: true }
          );
        }
      }
    }
    logger.info('Compliance and contract permissions seeded successfully.');
  } catch (error) {
    logger.error(`Failed to seed compliance permissions: ${error}`);
  }
}

export async function migrateComplianceData() {
  try {
    logger.info('Checking for compliance records migration...');
    const complianceRecords = await TenantCompliance.find().lean();
    if (complianceRecords.length === 0) {
      logger.info('No legacy compliance records to migrate.');
      return;
    }

    let migratedCount = 0;

    for (const tc of complianceRecords) {
      // Check if already migrated
      const existingDocs = await DocumentModel.findOne({ tenant_id: tc.tenant_id }).lean();
      if (existingDocs) {
        continue;
      }

      // Fetch tenant to get camp_id
      const tenantUser = await UserRegister.findById(tc.tenant_id).lean();
      if (!tenantUser) {
        continue;
      }

      // Sync onboarding text fields to user_register
      await UserRegister.updateOne(
        { _id: tc.tenant_id },
        {
          $set: {
            nationality: tc.nationality || '',
            emergency_contact_name: tc.emergency_contact_name || '',
            emergency_contact_phone: tc.emergency_contact_phone || ''
          }
        }
      );
      
      const campId = tenantUser.camp_id || tenantUser.client_id || tc.tenant_id;

      // 1. Passport
      if (tc.passport_no || tc.passport_image) {
        const doc = await DocumentModel.create({
          tenant_id: tc.tenant_id,
          camp_id: campId,
          document_type: 'Passport',
          document_number: tc.passport_no || '',
          issue_date: tc.passport_issue_date ?? null,
          expiry_date: tc.passport_expiry_date ?? null,
          verification_status: tc.passport_verification_status === 'Replaced' ? 'Pending' : (tc.passport_verification_status || 'Pending'),
          rejection_reason: tc.passport_rejection_reason || '',
          metadata: {
            passport_country: tc.passport_country || ''
          }
        });

        if (tc.passport_image) {
          await DocumentFileModel.create({
            document_id: doc._id,
            original_file_name: tc.passport_image.split('/').pop()?.split('?')[0] || 'passport.jpg',
            stored_file_name: tc.passport_image.split('/').pop()?.split('?')[0] || 'passport.jpg',
            mime_type: 'image/jpeg',
            file_size: 0,
            storage_path: tc.passport_image,
            uploaded_by: 'Migration',
            uploaded_at: tc.createdAt || new Date(),
            status: 'Active'
          });
        }
      }

      // 2. Government IDs
      if (tc.government_ids && tc.government_ids.length > 0) {
        for (const gid of tc.government_ids) {
          const doc = await DocumentModel.create({
            tenant_id: tc.tenant_id,
            camp_id: campId,
            document_type: 'Government ID',
            document_number: gid.document_number || '',
            issue_date: gid.issue_date ?? null,
            expiry_date: gid.expiry_date ?? null,
            verification_status: gid.verification_status === 'Replaced' ? 'Pending' : (gid.verification_status || 'Pending'),
            rejection_reason: gid.rejection_reason || '',
            metadata: {
              document_type: gid.document_type || 'Emirates ID'
            }
          });

          if (gid.front_file) {
            await DocumentFileModel.create({
              document_id: doc._id,
              original_file_name: gid.front_file.split('/').pop()?.split('?')[0] || 'front_id.jpg',
              stored_file_name: gid.front_file.split('/').pop()?.split('?')[0] || 'front_id.jpg',
              mime_type: 'image/jpeg',
              file_size: 0,
              storage_path: gid.front_file,
              uploaded_by: 'Migration',
              uploaded_at: tc.createdAt || new Date(),
              status: 'Active',
              metadata: { side: 'front' }
            });
          }

          if (gid.back_file) {
            await DocumentFileModel.create({
              document_id: doc._id,
              original_file_name: gid.back_file.split('/').pop()?.split('?')[0] || 'back_id.jpg',
              stored_file_name: gid.back_file.split('/').pop()?.split('?')[0] || 'back_id.jpg',
              mime_type: 'image/jpeg',
              file_size: 0,
              storage_path: gid.back_file,
              uploaded_by: 'Migration',
              uploaded_at: tc.createdAt || new Date(),
              status: 'Active',
              metadata: { side: 'back' }
            });
          }
        }
      }

      // 3. Visa / Residency
      if (tc.visa_residency && tc.visa_residency.length > 0) {
        for (const visa of tc.visa_residency) {
          const doc = await DocumentModel.create({
            tenant_id: tc.tenant_id,
            camp_id: campId,
            document_type: 'Visa/Residency',
            document_number: visa.visa_number || '',
            issue_date: visa.issue_date ?? null,
            expiry_date: visa.expiry_date ?? null,
            verification_status: visa.verification_status === 'Replaced' ? 'Pending' : (visa.verification_status || 'Pending'),
            rejection_reason: visa.rejection_reason || '',
            metadata: {
              visa_type: visa.visa_type || 'Employment Visa'
            }
          });

          if (visa.supporting_document) {
            await DocumentFileModel.create({
              document_id: doc._id,
              original_file_name: visa.supporting_document.split('/').pop()?.split('?')[0] || 'visa.jpg',
              stored_file_name: visa.supporting_document.split('/').pop()?.split('?')[0] || 'visa.jpg',
              mime_type: 'image/jpeg',
              file_size: 0,
              storage_path: visa.supporting_document,
              uploaded_by: 'Migration',
              uploaded_at: tc.createdAt || new Date(),
              status: 'Active'
            });
          }
        }
      }

      // 4. Other/Generic Documents
      if (tc.documents && tc.documents.length > 0) {
        for (const gdoc of tc.documents) {
          const doc = await DocumentModel.create({
            tenant_id: tc.tenant_id,
            camp_id: campId,
            document_type: 'Other',
            document_number: '',
            issue_date: null,
            expiry_date: gdoc.expiry_date ?? null,
            verification_status: gdoc.verification_status === 'Replaced' ? 'Pending' : (gdoc.verification_status || 'Pending'),
            rejection_reason: gdoc.rejection_reason || '',
            metadata: {
              label: gdoc.file_name || 'Document'
            }
          });

          if (gdoc.file_url) {
            await DocumentFileModel.create({
              document_id: doc._id,
              original_file_name: gdoc.file_name || 'file.jpg',
              stored_file_name: gdoc.file_url.split('/').pop()?.split('?')[0] || 'file.jpg',
              mime_type: 'image/jpeg',
              file_size: 0,
              storage_path: gdoc.file_url,
              uploaded_by: gdoc.uploaded_by || 'Migration',
              uploaded_at: gdoc.upload_date || tc.createdAt || new Date(),
              status: 'Active'
            });
          }
        }
      }

      // 5. Activity Log
      if (tc.activity_log && tc.activity_log.length > 0) {
        for (const log of tc.activity_log) {
          // Fetch an admin or default to tenantUser's ID as performer
          const performerId = tenantUser.client_id || tenantUser._id;
          await UserActivityLogModel.create({
            user_id: performerId,
            performed_by: log.performed_by || 'System',
            tenant_id: tc.tenant_id,
            action: log.action || 'Compliance log migrated',
            module: 'Compliance',
            timestamp: log.date || new Date(),
            previous_state: null,
            new_state: { note: `Migrated from performed_by: ${log.performed_by || 'System'}` }
          });
        }
      }

      migratedCount++;
    }

    if (migratedCount > 0) {
      logger.info(`Successfully migrated ${migratedCount} compliance records to the new document collections.`);
    } else {
      logger.info('All legacy compliance records already migrated.');
    }
  } catch (error) {
    logger.error(`Failed to migrate compliance data: ${error}`);
  }
}

export async function migrateMissingEmployeeIds() {
  try {
    logger.info('Starting migration for missing tenant Employee IDs...');

    // Find all active/non-deleted tenants that have no employee_id (null, undefined, or empty string)
    const tenants = await UserRegister.find({
      deleted_at: null,
      $or: [
        { employee_id: null },
        { employee_id: '' },
        { employee_id: { $exists: false } }
      ]
    }).sort({ createdAt: 1 }); // Process chronologically

    if (tenants.length === 0) {
      logger.info('No tenants with missing Employee IDs found.');
      return;
    }

    logger.info(`Found ${tenants.length} tenants with missing Employee IDs. Processing...`);

    let migratedCount = 0;
    const prefixMaxSeqMap = new Map<string, number>();

    for (const tenant of tenants) {
      let companyCode = "EMP";
      if (tenant.company_id) {
        const company = await Company.findOne({ _id: tenant.company_id, deleted_at: null }).lean();
        if (company) {
          companyCode = company.company_code || company.alias || "EMP";
        }
      }

      const prefix = `${companyCode}-`;

      if (!prefixMaxSeqMap.has(prefix)) {
        const escapedPrefix = prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`^${escapedPrefix}(\\d+)$`);

        // Find siblings globally (no client_id scoping)
        const siblings = await UserRegister.find({
          employee_id: { $regex: regex }
        }, { employee_id: 1 }).lean();

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
        prefixMaxSeqMap.set(prefix, maxSeq);
      }

      let currentMax = prefixMaxSeqMap.get(prefix) || 0;
      currentMax += 1;
      prefixMaxSeqMap.set(prefix, currentMax);

      const employeeId = `${prefix}${String(currentMax).padStart(4, '0')}`;

      // Update in database
      tenant.employee_id = employeeId;
      await tenant.save();

      migratedCount++;
    }

    logger.info(`Successfully migrated ${migratedCount} tenant Employee IDs.`);
  } catch (error) {
    logger.error(`Failed to migrate tenant Employee IDs: ${error}`);
  }
}
