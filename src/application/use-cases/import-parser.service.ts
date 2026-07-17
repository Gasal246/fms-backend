import ExcelJS from "exceljs";
import type { NormalizedImportRow } from "../../domain/types/tenant-import.types.js";

// ── Column Mapping ─────────────────────────────────────────────────
// Maps Excel/CSV header variants → normalized field names
const COLUMN_MAP: Record<string, string> = {
  // Identity
  employee_id: "employee_id",
  employeeid: "employee_id",
  "employee id": "employee_id",
  emp_id: "employee_id",
  empid: "employee_id",

  first_name: "first_name",
  firstname: "first_name",
  "first name": "first_name",

  last_name: "last_name",
  lastname: "last_name",
  "last name": "last_name",

  full_name: "full_name",
  fullname: "full_name",
  name: "full_name",
  "full name": "full_name",

  gender: "gender",
  sex: "gender",

  dob: "dob",
  "date of birth": "dob",
  birth_date: "dob",
  birthdate: "dob",

  phone: "phone",
  mobile: "phone",
  "phone number": "phone",
  "mobile number": "phone",

  email: "email",
  "email address": "email",

  nationality: "nationality",

  passport: "passport_number",
  passport_no: "passport_number",
  passport_number: "passport_number",
  "passport number": "passport_number",

  national_id: "national_id",
  nationalid: "national_id",
  "national id": "national_id",
  id_number: "national_id",

  // Company / Contract
  company_code: "company_code",
  "company code": "company_code",
  company: "company_code",

  contract_number: "contract_number",
  "contract number": "contract_number",
  contract_no: "contract_number",

  // ── Location columns: accepted for backward-compat but IGNORED ──
  // Room and bed assignment is handled by the Room Allocation module after
  // tenant registration. Columns present in old templates are silently dropped.
  site: "_ignored_site",
  site_code: "_ignored_site",
  "site code": "_ignored_site",
  camp: "_ignored_site",

  building: "_ignored_building",
  building_code: "_ignored_building",
  "building code": "_ignored_building",

  room: "_ignored_room",
  room_no: "_ignored_room",
  room_number: "_ignored_room",
  "room number": "_ignored_room",

  bed: "_ignored_bed",
  bed_no: "_ignored_bed",
  bed_number: "_ignored_bed",
  "bed number": "_ignored_bed",

  // Dates: ignored during bulk import (gate check-in/out records are used instead)
  check_in: "_ignored_check_in",
  check_in_date: "_ignored_check_in",
  "check in": "_ignored_check_in",
  "check-in": "_ignored_check_in",
  "check in date": "_ignored_check_in",

  check_out: "_ignored_check_out",
  check_out_date: "_ignored_check_out",
  "check out": "_ignored_check_out",
  "check-out": "_ignored_check_out",
  "check out date": "_ignored_check_out",

  status: "status",
};

function normalizeKey(raw: string): string {
  return raw.toLowerCase().trim().replace(/_/g, " ").replace(/\s+/g, " ");
}

function mapHeader(raw: string): string {
  const key = normalizeKey(raw);
  return COLUMN_MAP[key] ?? raw.toLowerCase().trim().replace(/\s+/g, "_");
}

function cellValue(cell: ExcelJS.Cell): any {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in (v as any)) {
    return (v as any).richText.map((rt: any) => rt.text).join("");
  }
  if (typeof v === "object" && "text" in (v as any)) return (v as any).text;
  if (typeof v === "object" && "result" in (v as any)) return (v as any).result;
  return v;
}

// ── Parser ─────────────────────────────────────────────────────────

export class ImportParserService {
  /**
   * Parse an Excel (.xlsx) buffer into normalized row objects.
   * The first non-empty row is treated as the header.
   */
  static async parseExcel(buffer: Buffer): Promise<NormalizedImportRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error("No worksheet found in the uploaded file");

    const rows: NormalizedImportRow[] = [];
    let headers: string[] = [];
    let headerRowNum = 0;

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values = (row.values as any[]).slice(1); // ExcelJS rows are 1-indexed

      if (headers.length === 0) {
        // First non-empty row = headers
        headers = values.map((v: any) => (v !== null && v !== undefined ? String(v) : ""));
        headerRowNum = rowNumber;
        return;
      }

      const rawData: Record<string, any> = {};
      headers.forEach((h, i) => {
        rawData[h] = values[i] !== undefined && values[i] !== null ? values[i] : "";
      });

      const normalized = ImportParserService.normalizeRow(rawData, rowNumber - headerRowNum);
      rows.push(normalized);
    });

    return rows;
  }

  /**
   * Parse a CSV string into normalized row objects.
   */
  static parseCsv(csvContent: string): NormalizedImportRow[] {
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    if (!firstLine) return [];

    const headers = firstLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const rows: NormalizedImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const rawData: Record<string, any> = {};
      headers.forEach((h, idx) => {
        rawData[h] = values[idx] ?? "";
      });
      rows.push(ImportParserService.normalizeRow(rawData, i));
    }

    return rows;
  }

  /**
   * Normalize a single raw row using the column mapping.
   * Columns mapped to "_ignored_*" (e.g. room_number, bed_number) are
   * silently dropped — they belong to the Room Allocation module.
   */
  static normalizeRow(rawData: Record<string, any>, rowNumber: number): NormalizedImportRow {
    const normalized: Record<string, any> = { row_number: rowNumber, raw_data: rawData };

    for (const [rawKey, rawValue] of Object.entries(rawData)) {
      const mappedKey = mapHeader(rawKey);

      // Drop columns that no longer belong to tenant registration
      if (mappedKey.startsWith("_ignored_")) continue;

      // Custom fields
      if (mappedKey.startsWith("cf_") || mappedKey.startsWith("custom_")) {
        if (!normalized.custom_fields) normalized.custom_fields = {};
        const cfKey = mappedKey.replace(/^cf_|^custom_/, "");
        normalized.custom_fields[cfKey] = rawValue;
      } else {
        const strValue = rawValue !== null && rawValue !== undefined ? String(rawValue).trim() : "";
        normalized[mappedKey] = strValue || undefined;
      }
    }

    return normalized as NormalizedImportRow;
  }

  /**
   * Generate an Excel template buffer for download.
   * Template contains ONLY tenant profile fields.
   * Room and bed assignment is handled by the Room Allocation module
   * after tenants are registered.
   */
  static async generateTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Tenant Import Template");

    // ── Columns: tenant profile fields only (no room, no bed) ─────────────
    const headers = [
      { header: "employee_id",     key: "employee_id",     width: 18 },
      { header: "first_name",      key: "first_name",      width: 18 },
      { header: "last_name",       key: "last_name",       width: 18 },
      { header: "gender",          key: "gender",          width: 12 },
      { header: "dob",             key: "dob",             width: 14 },
      { header: "phone",           key: "phone",           width: 20 },
      { header: "email",           key: "email",           width: 28 },
      { header: "nationality",     key: "nationality",     width: 16 },
      { header: "passport_number", key: "passport_number", width: 20 },
      { header: "national_id",     key: "national_id",     width: 20 },
      { header: "company_code",    key: "company_code",    width: 18 },
      { header: "contract_number", key: "contract_number", width: 20 },
    ];

    ws.columns = headers;

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1A56DB" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 22;

    // Example row
    ws.addRow({
      employee_id:     "EMP001",
      first_name:      "John",
      last_name:       "Doe",
      gender:          "Male",
      dob:             "1990-01-15",
      phone:           "+966500000001",
      email:           "john.doe@example.com",
      nationality:     "Saudi",
      passport_number: "A12345678",
      national_id:     "1234567890",
      company_code:    "ARAMCO",
      contract_number: "CNT-2024-001",
    });

    // Add a note row explaining room allocation is separate
    const noteRow = ws.addRow({
      employee_id: "NOTE: Room and bed assignment is handled separately via the Room Allocation module after import.",
    });
    noteRow.getCell(1).font = { italic: true, color: { argb: "FF6B7280" } };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
