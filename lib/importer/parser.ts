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
  rows: ParsedRow[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
}

const COMMON_HEADER_MAP: Record<string, string> = {
  email: 'email',
  'email address': 'email',
  'e-mail': 'email',
  'first name': 'firstName',
  firstname: 'firstName',
  'given name': 'firstName',
  name: 'firstName',
  'last name': 'lastName',
  lastname: 'lastName',
  surname: 'lastName',
  company: 'companyName',
  'company name': 'companyName',
  organization: 'companyName',
  title: 'title',
  'job title': 'title',
  position: 'title',
  phone: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  tags: 'tags',
  tag: 'tags',
};

/**
 * Auto-detect column headers against known schema keys
 */
export function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  headers.forEach((h) => {
    const normalized = h.toLowerCase().trim();
    if (COMMON_HEADER_MAP[normalized]) {
      mapping[h] = COMMON_HEADER_MAP[normalized];
    } else {
      mapping[h] = `custom_${normalized.replace(/[^a-z0-9]/g, '_')}`;
    }
  });
  return mapping;
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
    });
    rawRows = result.data;
    headers = result.meta.fields || Object.keys(rawRows[0] || {});
  } else if (['xlsx', 'xls'].includes(extension || '')) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
    if (rawRows.length > 0) {
      headers = Object.keys(rawRows[0]);
    }
  } else {
    throw new Error('Unsupported file type. Please upload a .csv, .xlsx, or .xls file.');
  }

  const autoMapping = autoDetectMapping(headers);

  // Validate rows
  const seenEmails = new Set<string>();
  let validCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;

  const parsedRows: ParsedRow[] = rawRows.map((row) => {
    const mapped: Record<string, any> = {};
    const customFields: Record<string, any> = {};

    Object.entries(row).forEach(([colHeader, value]) => {
      const targetKey = autoMapping[colHeader];
      if (targetKey && !targetKey.startsWith('custom_')) {
        mapped[targetKey] = String(value || '').trim();
      } else if (targetKey) {
        customFields[targetKey.replace('custom_', '')] = value;
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
      firstName: mapped.firstName || '',
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

  return {
    headers,
    autoMapping,
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount,
    errorCount,
    duplicateCount,
  };
}
