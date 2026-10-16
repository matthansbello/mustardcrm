import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export const MAX_IMPORT_ROWS = 25_000;

export interface ParsedRow {
  /** 1-based row number in the spreadsheet (header is row 1). */
  rowNumber: number;
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  title: string;
  phone: string;
  tags: string[];
  customFields: Record<string, string>;
  isValid: boolean;
  error?: string;
}

export interface ParseResult {
  headers: string[];
  autoMapping: Record<string, string>;
  rawRows: Record<string, string>[];
  rows: ParsedRow[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
}

type StandardField = 'email' | 'firstName' | 'lastName' | 'companyName' | 'title' | 'phone' | 'tags';

const COMMON_HEADER_MAP: Record<string, StandardField> = {
  email: 'email',
  'email address': 'email',
  'e-mail': 'email',
  'e-mail address': 'email',
  'e-mail 1 - value': 'email', // Google Contacts export
  'email 1': 'email',
  'work email': 'email',
  'business email': 'email',
  'primary email': 'email',
  'e-mail address 1': 'email',
  mail: 'email',

  'first name': 'firstName',
  firstname: 'firstName',
  'given name': 'firstName',
  fname: 'firstName',
  forename: 'firstName',

  'last name': 'lastName',
  lastname: 'lastName',
  surname: 'lastName',
  'family name': 'lastName',
  lname: 'lastName',

  company: 'companyName',
  'company name': 'companyName',
  organization: 'companyName',
  organisation: 'companyName',
  'organization 1 - name': 'companyName',
  'organization name': 'companyName',
  account: 'companyName',
  'account name': 'companyName',
  employer: 'companyName',
  org: 'companyName',
  business: 'companyName',

  title: 'title',
  'job title': 'title',
  'organization 1 - title': 'title',
  position: 'title',
  role: 'title',
  designation: 'title',

  phone: 'phone',
  'phone number': 'phone',
  'phone 1 - value': 'phone',
  'mobile phone': 'phone',
  'business phone': 'phone',
  'primary phone': 'phone',
  mobile: 'phone',
  cell: 'phone',
  telephone: 'phone',
  tel: 'phone',

  tags: 'tags',
  tag: 'tags',
  labels: 'tags',
  label: 'tags',
};

// Fallbacks when no exact header match: first header containing these words.
const FUZZY_RULES: { field: StandardField; test: RegExp }[] = [
  { field: 'email', test: /e-?mail/ },
  { field: 'phone', test: /phone|mobile|cell/ },
  { field: 'companyName', test: /company|organi[sz]ation/ },
  { field: 'firstName', test: /first|given/ },
  { field: 'lastName', test: /last|surname|family/ },
];

const EMAIL_RE = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function cleanHeader(h: string): string {
  return h.replace(/^﻿/, '').trim();
}

function normalizeHeader(h: string): string {
  return cleanHeader(h).toLowerCase().replace(/[_\s]+/g, ' ').trim();
}

/** Firestore-safe custom field key: lowercase letters, digits and underscores. */
export function customFieldKey(header: string): string {
  const key = cleanHeader(header)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `custom_${key || 'field'}`;
}

/** Pull a clean address out of values like "Jane <jane@acme.com>" or "mailto:jane@acme.com". */
export function extractEmail(value: string): string {
  const match = value.match(EMAIL_RE);
  return match ? match[0].toLowerCase().replace(/^[.'-]+|[.'-]+$/g, '') : '';
}

/**
 * Auto-detect column headers against known schema keys. Each standard field
 * is claimed by at most one column so a second "email" column can't blank
 * out the first.
 */
export function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const claimed = new Set<StandardField>();

  headers.forEach((h) => {
    const field = COMMON_HEADER_MAP[normalizeHeader(h)];
    if (field && !claimed.has(field)) {
      mapping[h] = field;
      claimed.add(field);
    }
  });

  FUZZY_RULES.forEach(({ field, test }) => {
    if (claimed.has(field)) return;
    const header = headers.find((h) => !mapping[h] && test.test(normalizeHeader(h)));
    if (header) {
      mapping[header] = field;
      claimed.add(field);
    }
  });

  headers.forEach((h) => {
    if (!mapping[h]) mapping[h] = customFieldKey(h);
  });

  return mapping;
}

function splitTags(value: string): string[] {
  return value
    .split(/[,;|]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Re-map raw parsed rows using a column mapping dictionary and validate them.
 */
export function mapAndValidateRows(
  rawRows: Record<string, string>[],
  columnMapping: Record<string, string>
): { rows: ParsedRow[]; validCount: number; errorCount: number; duplicateCount: number } {
  const seenEmails = new Set<string>();
  let validCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;

  const rows: ParsedRow[] = rawRows.map((row, index) => {
    const mapped: Partial<Record<StandardField, string>> = {};
    const customFields: Record<string, string> = {};

    Object.entries(row).forEach(([header, value]) => {
      const target = columnMapping[header];
      const text = String(value ?? '').trim();
      if (!target || target === 'ignore' || !text) return;

      if (target.startsWith('custom_')) {
        customFields[target.replace(/^custom_/, '') || 'field'] = text;
      } else if (!mapped[target as StandardField]) {
        mapped[target as StandardField] = text;
      }
    });

    const rawEmail = mapped.email || '';
    const email = extractEmail(rawEmail);

    let isValid = true;
    let error: string | undefined;

    if (!rawEmail) {
      isValid = false;
      error = 'Missing email address';
      errorCount++;
    } else if (!email) {
      isValid = false;
      error = `Invalid email "${rawEmail.slice(0, 60)}"`;
      errorCount++;
    } else if (seenEmails.has(email)) {
      isValid = false;
      error = 'Duplicate email within file';
      duplicateCount++;
    } else {
      seenEmails.add(email);
      validCount++;
    }

    const tags = splitTags(mapped.tags || '');

    return {
      rowNumber: index + 2,
      email,
      firstName: mapped.firstName || (email ? email.split('@')[0] : ''),
      lastName: mapped.lastName || '',
      companyName: mapped.companyName || '',
      title: mapped.title || '',
      phone: mapped.phone || '',
      tags: tags.length ? tags : ['imported'],
      customFields,
      isValid,
      error,
    };
  });

  return { rows, validCount, errorCount, duplicateCount };
}

/** Decode CSV bytes as UTF-8, falling back to Windows-1252 (what Excel on Windows often saves). */
async function readCsvText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/**
 * Excel cell → text. Whole numbers keep every digit (phone numbers would
 * otherwise become "4.47701E+11"); dates become YYYY-MM-DD.
 */
function cellToText(value: unknown): string {
  if (value instanceof Date) return isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    return Number.isInteger(value) ? BigInt(value).toString() : String(value);
  }
  return String(value ?? '');
}

/** Give blank / repeated headers unique, readable names so no column is lost. */
function uniqueHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    const base = cleanHeader(String(h ?? '')) || `Column ${i + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? `${base} (${count + 1})` : base;
  });
}

function toRecords(table: string[][]): { headers: string[]; rawRows: Record<string, string>[] } {
  const [headerRow = [], ...body] = table;
  const headers = uniqueHeaders(headerRow);
  const rawRows = body
    .filter((cells) => cells.some((c) => String(c ?? '').trim() !== ''))
    .map((cells) => {
      const record: Record<string, string> = {};
      headers.forEach((h, i) => {
        record[h] = String(cells[i] ?? '');
      });
      return record;
    });
  return { headers, rawRows };
}

/**
 * Parse a CSV / XLSX / XLS file client-side.
 */
export async function parseImportFile(file: File): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  let table: string[][];

  if (extension === 'csv' || extension === 'txt' || extension === 'tsv') {
    const text = await readCsvText(file);
    const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
    if (result.errors.length && !result.data.length) {
      throw new Error(`Could not read this CSV: ${result.errors[0].message}`);
    }
    table = result.data;
  } else if (extension === 'xlsx' || extension === 'xls') {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet) throw new Error('This workbook has no sheets.');
    const cells = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '', raw: true, blankrows: false });
    table = cells.map((row) => row.map(cellToText));
  } else {
    throw new Error('Unsupported file type. Please upload a .csv, .xlsx, or .xls file.');
  }

  const { headers, rawRows } = toRecords(table);

  if (!headers.length || !rawRows.length) {
    throw new Error('No rows found. Make sure the first row contains column headers and there is data below it.');
  }
  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `This file has ${rawRows.length.toLocaleString()} rows. Split it into files of ${MAX_IMPORT_ROWS.toLocaleString()} rows or fewer.`
    );
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
