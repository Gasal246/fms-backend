import mongoose from "mongoose";
import Company from "../../infrastructure/persistence/models/company.model.js";
import Contract from "../../infrastructure/persistence/models/contract.model.js";
import Tenant from "../../infrastructure/persistence/models/tenant.model.js";
import type {
  NormalizedImportRow,
  RowValidationResult,
} from "../../domain/types/tenant-import.types.js";

// ── Constants ──────────────────────────────────────────────────────────────
// Number of rows processed per DB-lookup chunk.
// Keeps memory bounded regardless of total file size.
const VALIDATION_CHUNK_SIZE = 500;

// ── Lookup Maps (scoped to one chunk) ──────────────────────────────────────
interface ChunkLookupMaps {
  companiesByCode: Map<string, any>;
  contractsByNumber: Map<string, any>;
  tenantsByPhone: Map<string, any>;
  tenantsByEmail: Map<string, any>;
  tenantsByPassport: Map<string, any>;
  tenantsByNationalId: Map<string, any>;
  tenantsByEmployeeId: Map<string, any>;
}

/**
 * Load ONLY the values that appear in the current chunk.
 * This replaces the old full-table preload which caused OOM on large tenants.
 */
async function loadChunkMaps(
  rows: NormalizedImportRow[],
  clientId: string
): Promise<ChunkLookupMaps> {
  const clId = new mongoose.Types.ObjectId(clientId);

  // Collect unique lookup values from this chunk only
  const phones = [...new Set(rows.map((r) => r.phone).filter(Boolean))] as string[];
  const emails = [...new Set(rows.map((r) => r.email?.toLowerCase()).filter(Boolean))] as string[];
  const passports = [...new Set(rows.map((r) => r.passport_number?.toUpperCase()).filter(Boolean))] as string[];
  const nationalIds = [...new Set(rows.map((r) => r.national_id).filter(Boolean))] as string[];
  const employeeIds = [...new Set(rows.map((r) => r.employee_id).filter(Boolean))] as string[];
  const companyCodes = [...new Set(rows.map((r) => r.company_code?.toUpperCase()).filter(Boolean))] as string[];
  const contractNumbers = [...new Set(rows.map((r) => r.contract_number?.toUpperCase()).filter(Boolean))] as string[];

  // Fire all queries in parallel — each query only fetches records matching
  // values that actually appear in this chunk (not the entire collection)
  const [
    tenantsByPhoneArr,
    tenantsByEmailArr,
    tenantsByPassportArr,
    tenantsByNationalIdArr,
    tenantsByEmployeeIdArr,
    companies,
    contracts,
  ] = await Promise.all([
    phones.length > 0
      ? Tenant.find({ client_id: clId, phone: { $in: phones }, deleted_at: null })
          .select("_id phone")
          .lean()
      : [],
    emails.length > 0
      ? Tenant.find({ client_id: clId, email: { $in: emails }, deleted_at: null })
          .select("_id email")
          .lean()
      : [],
    passports.length > 0
      ? Tenant.find({ client_id: clId, passport_no: { $in: passports }, deleted_at: null })
          .select("_id passport_no")
          .lean()
      : [],
    nationalIds.length > 0
      ? Tenant.find({ client_id: clId, national_id: { $in: nationalIds }, deleted_at: null })
          .select("_id national_id")
          .lean()
      : [],
    employeeIds.length > 0
      ? Tenant.find({ client_id: clId, employee_id: { $in: employeeIds }, deleted_at: null })
          .select("_id employee_id")
          .lean()
      : [],
    companyCodes.length > 0
      ? Company.find({ client_id: clId, company_code: { $in: companyCodes }, deleted_at: null })
          .select("_id company_code company_name status")
          .lean()
      : [],
    contractNumbers.length > 0
      ? Contract.find({ client_id: clId, contract_number: { $in: contractNumbers }, deleted_at: null })
          .select("_id contract_number company_id status end_date")
          .lean()
      : [],
  ]);

  return {
    companiesByCode: new Map(
      (companies as any[]).map((c) => [c.company_code?.toUpperCase(), c])
    ),
    contractsByNumber: new Map(
      (contracts as any[]).map((c) => [c.contract_number?.toUpperCase(), c])
    ),
    tenantsByPhone: new Map(
      (tenantsByPhoneArr as any[]).map((t) => [t.phone, t])
    ),
    tenantsByEmail: new Map(
      (tenantsByEmailArr as any[]).map((t) => [t.email?.toLowerCase(), t])
    ),
    tenantsByPassport: new Map(
      (tenantsByPassportArr as any[]).map((t) => [t.passport_no?.toUpperCase(), t])
    ),
    tenantsByNationalId: new Map(
      (tenantsByNationalIdArr as any[]).map((t) => [t.national_id, t])
    ),
    tenantsByEmployeeId: new Map(
      (tenantsByEmployeeIdArr as any[]).map((t) => [t.employee_id, t])
    ),
  };
}

// ── Within-File Duplicate Tracking ────────────────────────────────────────
/**
 * Tracks values already seen within the uploaded file.
 * Catches duplicates that are both new to the DB — e.g. same passport
 * in rows 1 and 5 of the same Excel file.
 */
interface WithinFileTracker {
  phones: Map<string, number>;       // value → first row_number
  emails: Map<string, number>;
  passports: Map<string, number>;
  nationalIds: Map<string, number>;
  employeeIds: Map<string, number>;
}

function makeWithinFileTracker(): WithinFileTracker {
  return {
    phones: new Map(),
    emails: new Map(),
    passports: new Map(),
    nationalIds: new Map(),
    employeeIds: new Map(),
  };
}

// ── Row-Level Validator ────────────────────────────────────────────────────
function validateRow(
  row: NormalizedImportRow,
  maps: ChunkLookupMaps,
  withinFile: WithinFileTracker
): { errors: string[]; warnings: string[]; enriched: NormalizedImportRow; duplicate_of?: string } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const enriched: NormalizedImportRow = { ...row };

  // ── Layer 2: Format & Required Fields ───────────────────────────────────
  if (!row.first_name && !row.full_name) {
    errors.push("first_name (or full_name) is required");
  }

  // Email format
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    errors.push(`email "${row.email}" is not a valid email address`);
  }

  // Phone presence (soft warning — some workers have no email or phone)
  if (!row.phone && !row.email) {
    warnings.push("Neither phone nor email provided; contact information is missing");
  }

  // Gender normalization
  if (row.gender) {
    const g = row.gender.toLowerCase().trim();
    if (["m", "male"].includes(g)) enriched.gender = "Male";
    else if (["f", "female"].includes(g)) enriched.gender = "Female";
    else warnings.push(`gender "${row.gender}" is non-standard; expected Male or Female`);
  }

  // ── Layer 3: Within-File Duplicate Detection ─────────────────────────────
  // (Runs before DB lookup — catches two new rows in same file with same identifiers)

  if (row.employee_id) {
    const firstSeen = withinFile.employeeIds.get(row.employee_id.toUpperCase());
    if (firstSeen !== undefined) {
      warnings.push(`Duplicate within file: employee_id "${row.employee_id}" also appears at row ${firstSeen}`);
    } else {
      withinFile.employeeIds.set(row.employee_id.toUpperCase(), row.row_number);
    }
  }

  if (row.passport_number) {
    const firstSeen = withinFile.passports.get(row.passport_number.toUpperCase());
    if (firstSeen !== undefined) {
      warnings.push(`Duplicate within file: passport_number "${row.passport_number}" also appears at row ${firstSeen}`);
    } else {
      withinFile.passports.set(row.passport_number.toUpperCase(), row.row_number);
    }
  }

  if (row.national_id) {
    const firstSeen = withinFile.nationalIds.get(row.national_id);
    if (firstSeen !== undefined) {
      warnings.push(`Duplicate within file: national_id "${row.national_id}" also appears at row ${firstSeen}`);
    } else {
      withinFile.nationalIds.set(row.national_id, row.row_number);
    }
  }

  if (row.email) {
    const key = row.email.toLowerCase();
    const firstSeen = withinFile.emails.get(key);
    if (firstSeen !== undefined) {
      warnings.push(`Duplicate within file: email "${row.email}" also appears at row ${firstSeen}`);
    } else {
      withinFile.emails.set(key, row.row_number);
    }
  }

  if (row.phone) {
    const firstSeen = withinFile.phones.get(row.phone);
    if (firstSeen !== undefined) {
      warnings.push(`Duplicate within file: phone "${row.phone}" also appears at row ${firstSeen}`);
    } else {
      withinFile.phones.set(row.phone, row.row_number);
    }
  }

  // ── Layer 4: DB Duplicate Detection ─────────────────────────────────────
  // Priority: employee_id → passport → national_id → phone → email
  // (hard identifiers first, soft identifiers last)
  let duplicate_of: string | undefined;

  if (row.employee_id && maps.tenantsByEmployeeId.has(row.employee_id)) {
    const dup = maps.tenantsByEmployeeId.get(row.employee_id)!;
    duplicate_of = dup._id.toString();
    warnings.push(`Duplicate employee_id: "${row.employee_id}" matches existing tenant`);
  } else if (
    row.passport_number &&
    maps.tenantsByPassport.has(row.passport_number.toUpperCase())
  ) {
    const dup = maps.tenantsByPassport.get(row.passport_number.toUpperCase())!;
    duplicate_of = dup._id.toString();
    warnings.push(`Duplicate passport_number: "${row.passport_number}" matches existing tenant`);
  } else if (row.national_id && maps.tenantsByNationalId.has(row.national_id)) {
    const dup = maps.tenantsByNationalId.get(row.national_id)!;
    duplicate_of = dup._id.toString();
    warnings.push(`Duplicate national_id: "${row.national_id}" matches existing tenant`);
  } else if (row.phone && maps.tenantsByPhone.has(row.phone)) {
    const dup = maps.tenantsByPhone.get(row.phone)!;
    duplicate_of = dup._id.toString();
    warnings.push(`Duplicate phone: "${row.phone}" matches existing tenant (soft duplicate — review before proceeding)`);
  } else if (row.email && maps.tenantsByEmail.has(row.email.toLowerCase())) {
    const dup = maps.tenantsByEmail.get(row.email.toLowerCase())!;
    duplicate_of = dup._id.toString();
    warnings.push(`Duplicate email: "${row.email}" matches existing tenant (soft duplicate — may be a shared company email)`);
  }

  // ── Layer 5: Company Validation ──────────────────────────────────────────
  if (row.company_code) {
    const company = maps.companiesByCode.get(row.company_code.toUpperCase());
    if (!company) {
      errors.push(`company_code "${row.company_code}" not found`);
    } else {
      enriched.company_id = company._id.toString();

      // Company status check
      if (company.status && !["Active", "active"].includes(company.status)) {
        warnings.push(
          `Company "${row.company_code}" has status "${company.status}" and may not be accepting new tenants`
        );
      }
    }
  }

  // ── Layer 5: Contract Validation ─────────────────────────────────────────
  if (row.contract_number) {
    const contract = maps.contractsByNumber.get(row.contract_number.toUpperCase());
    if (!contract) {
      errors.push(`contract_number "${row.contract_number}" not found`);
    } else {
      enriched.contract_id = contract._id.toString();

      // Cross-check: contract must belong to the stated company
      if (
        enriched.company_id &&
        contract.company_id?.toString() !== enriched.company_id
      ) {
        errors.push(
          `contract_number "${row.contract_number}" does not belong to company "${row.company_code}"`
        );
      }

      // Contract status check
      if (!["Active", "Expiring Soon"].includes(contract.status)) {
        warnings.push(
          `Contract "${row.contract_number}" has status "${contract.status}" and may not be accepting new tenants`
        );
      }

      // Contract expiry check
      if (contract.end_date && new Date(contract.end_date) < new Date()) {
        warnings.push(`Contract "${row.contract_number}" has expired`);
      }
    }
  }

  // ── NOTE: Room and Bed validation is intentionally NOT performed here. ───
  // Room/bed assignment is handled by the Room Allocation module after
  // tenant registration. Import only registers tenant profiles.

  const result: {
    errors: string[];
    warnings: string[];
    enriched: NormalizedImportRow;
    duplicate_of?: string;
  } = { errors, warnings, enriched };

  if (duplicate_of) {
    result.duplicate_of = duplicate_of;
  }

  return result;
}

// ── Public API ─────────────────────────────────────────────────────────────
export class ImportValidationEngine {
  /**
   * Validate a batch of normalized rows against the database.
   *
   * Uses chunked DB lookup (VALIDATION_CHUNK_SIZE rows per round-trip)
   * instead of a full-table preload to keep memory usage bounded even
   * for 25,000+ row imports.
   *
   * Also performs within-file duplicate detection across the entire
   * file before the DB lookup phase begins.
   */
  static async validateRows(
    rows: NormalizedImportRow[],
    clientId: string
  ): Promise<RowValidationResult[]> {
    const results: RowValidationResult[] = [];

    // Within-file tracker spans the ENTIRE file (all chunks share one instance)
    const withinFile = makeWithinFileTracker();

    // Process in chunks to bound memory usage
    for (let i = 0; i < rows.length; i += VALIDATION_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + VALIDATION_CHUNK_SIZE);

      // Load only the DB records matching values in this chunk
      const maps = await loadChunkMaps(chunk, clientId);

      for (const row of chunk) {
        const { errors, warnings, enriched, duplicate_of } = validateRow(
          row,
          maps,
          withinFile
        );

        const validation_status =
          errors.length > 0 ? "Error" : warnings.length > 0 ? "Warning" : "Valid";

        const result: RowValidationResult = {
          row_number: row.row_number,
          raw_data: row.raw_data ?? {},
          normalized_data: enriched,
          validation_status,
          warnings,
          errors,
        };

        if (duplicate_of) {
          result.duplicate_of = duplicate_of;
        }

        results.push(result);
      }
    }

    return results;
  }
}
