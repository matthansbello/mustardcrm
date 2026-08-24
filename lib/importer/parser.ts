import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ParsedRow {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  title?: string;
  phone?: string;
  tags?: string;
  customFields: Record<string, any>;
  isValid: boolean;
  error?: string;
}

export interface ParseResult {
  headers: string[];
  autoMapping: Record<string, string>;
  rawRows: Record<string, any>[];
  rows: ParsedRow[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
}

const COMMON_HEADER_MAP: Record<string, string> = {
  email: 'email',
  'email address': 'email',
  email_address: 'email',
  'e-mail': 'email',
  'e-mail address': 'email',
  mail: 'email',

  'first name': 'firstName',
  firstname: 'firstName',
  first_name: 'firstName',
  'given name': 'firstName',
  given_name: 'firstName',
  fname: 'firstName',

  'last name': 'lastName',
  lastname: 'lastName',
  last_name: 'lastName',
  surname: 'lastName',
  family_name: 'lastName',
  'family name': 'lastName',
  lname: 'lastName',

  company: 'companyName',
  'company name': 'companyName',
  company_name: 'companyName',
  organization: 'companyName',
  org: 'companyName',
  business: 'companyName',

  title: 'title',
  'job title': 'title',
  job_title: 'title',
  position: 'title',
  role: 'title',

  phone: 'phone',
  'phone number': 'phone',
  phone_number: 'phone',
  mobile: 'phone',
  cell: 'phone',
  telephone: 'phone',

  tags: 'tags',
  tag: 'tags',
  labels: 'tags',
};

/**
 * Auto-detect column headers against known schema keys
 */
export function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  headers.forEach((h) => {
    const cleanHeader = h.replace(/^\uFEFF/, '').trim();
    const normalized = cleanHeader.toLowerCase();
    const normalizedNoUnderscores = normalized.replace(/_/g, ' ');

    if (COMMON_HEADER_MAP[normalized]) {
      mapping[cleanHeader] = COMMON_HEADER_MAP[normalized];
    } else if (COMMON_HEADER_MAP[normalizedNoUnderscores]) {
      mapping[cleanHeader] = COMMON_HEADER_MAP[normalizedNoUnderscores];
    } else {
      mapping[cleanHeader] = `custom_${normalized.replace(/[^a-z0-9]/g, '_')}`;
    }
  });
  return mapping;
}

/**
 * Re-map raw parsed rows using a custom column mapping dictionary
 */
export function mapAndValidateRows(
  rawRows: Record<string, any>[],
  columnMapping: Record<string, string>
): { rows: ParsedRow[]; validCount: number; errorCount: number; duplicateCount: number } {
  const seenEmails = new Set<string>();
  let validCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;

  const rows: ParsedRow[] = rawRows.map((row) => {
    const mapped: Record<string, any> = {};
    const customFields: Record<string, any> = {};

    Object.entries(row).forEach(([colHeader, value]) => {
      const cleanHeader = colHeader.replace(/^\uFEFF/, '').trim();
      const targetKey = columnMapping[cleanHeader] || columnMapping[colHeader];
      const valStr = String(value ?? '').trim();

      if (!targetKey || targetKey === 'ignore') {
        return;
      }

      if (!targetKey.startsWith('custom_')) {
        mapped[targetKey] = valStr;
      } else {
        const fieldKey = targetKey.replace(/^custom_/, '');
        customFields[fieldKey] = value;
      }
    });

    const email = (mapped.email || '').toLowerCase().trim();

    let isValid = true;
    let error: string | undefined;

    if (!email || !email.includes('@')) {
      isValid = false;
      error = 'Invalid or missing email address';
      errorCount++;
    } else if (seenEmails.has(email)) {
      isValid = false;
      error = 'Duplicate email within file';
      duplicateCount++;
    } else {
      seenEmails.add(email);
      validCount++;
    }

    return {
      email,
      firstName: mapped.firstName || (email.includes('@') ? email.split('@')[0] : ''),
      lastName: mapped.lastName || '',
      companyName: mapped.companyName || '',
      title: mapped.title || '',
      phone: mapped.phone || '',
      tags: mapped.tags || 'imported',
      customFields,
      isValid,
      error,
    };
  });

  return { rows, validCount, errorCount, duplicateCount };
}

/**
 * Parse CSV or XLSX File client-side
 */
export async function parseImportFile(file: File): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  let rawRows: Record<string, any>[] = [];
  let headers: string[] = [];

  if (extension === 'csv') {
    const text = await file.text();
    const result = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
    });
    rawRows = result.data;
    headers = result.meta.fields || (rawRows[0] ? Object.keys(rawRows[0]) : []);
  } else if (['xlsx', 'xls'].includes(extension || '')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
    if (rawRows.length > 0) {
      headers = Object.keys(rawRows[0]).map((h) => h.replace(/^\uFEFF/, '').trim());
    }
  } else {
    throw new Error('Unsupported file type. Please upload a .csv, .xlsx, or .xls file.');
  }

  const autoMapping = autoDetectMapping(headers);
  const { rows, validCount, errorCount, duplicateCount } = mapAndValidateRows(rawRows, autoMapping);

  return {
    headers,
    autoMapping,
    rawRows,
    rows,
    totalRows: rows.length,
    validCount,
    errorCount,
    duplicateCount,
  };
}
