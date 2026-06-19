import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreatePropertyDto } from './dto/create-property.dto';
import {
  PROPERTY_CATEGORIES,
  PROPERTY_CSV_MAX_ROWS,
  PROPERTY_CSV_REQUIRED_HEADERS,
  PROPERTY_REQUIREMENT_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
} from './properties.constants';

export type PropertyCsvRowResult = {
  row: number;
  success: boolean;
  property_id?: string;
  property_code?: string;
  errors: string[];
};

export type PropertyCsvImportResult = {
  total: number;
  succeeded: number;
  failed: number;
  results: PropertyCsvRowResult[];
};

type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
};

/** Minimal RFC 4180-style CSV parser (quoted fields, commas, CRLF). */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };

  const pushRow = () => {
    if (row.length > 0 || field.length > 0) {
      pushField();
      rows.push(row);
      row = [];
    }
  };

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      pushField();
    } else if (char === '\n') {
      pushRow();
    } else if (char === '\r') {
      // handled with \n
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

function splitList(value: string | undefined): string[] | undefined {
  if (!value?.trim()) return undefined;
  return value
    .split(/[|;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value == null || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseOptionalInt(value: string | undefined): number | undefined {
  const n = parseOptionalNumber(value);
  return n == null ? undefined : Math.trunc(n);
}

export function parsePropertyCsv(content: string): ParsedCsv {
  const errors: string[] = [];
  const matrix = parseCsv(content.trim());
  if (matrix.length === 0) {
    return { headers: [], rows: [], errors: ['CSV is empty'] };
  }

  const headers = matrix[0]!.map(normalizeHeader);
  const missing = PROPERTY_CSV_REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    errors.push(`Missing required columns: ${missing.join(', ')}`);
    return { headers, rows: [], errors };
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length > PROPERTY_CSV_MAX_ROWS) {
    errors.push(`CSV exceeds the ${PROPERTY_CSV_MAX_ROWS} row limit (BR-P05)`);
    return { headers, rows: [], errors };
  }

  const rows = dataRows.map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? '').trim();
    });
    return record;
  });

  return { headers, rows, errors };
}

export async function mapCsvRecordToCreateDto(
  record: Record<string, string>,
): Promise<{ dto?: CreatePropertyDto; errors: string[] }> {
  const errors: string[] = [];

  for (const header of PROPERTY_CSV_REQUIRED_HEADERS) {
    if (!record[header]?.trim()) {
      errors.push(`Missing required field: ${header}`);
    }
  }

  const type = record.type?.toLowerCase();
  const category = record.category?.toLowerCase();
  const requirementType = record.requirement_type?.toLowerCase();
  const status = record.status?.toLowerCase() || 'draft';

  if (type && !(PROPERTY_TYPES as readonly string[]).includes(type)) {
    errors.push(`Invalid type "${record.type}"`);
  }
  if (category && !(PROPERTY_CATEGORIES as readonly string[]).includes(category)) {
    errors.push(`Invalid category "${record.category}"`);
  }
  if (
    requirementType &&
    !(PROPERTY_REQUIREMENT_TYPES as readonly string[]).includes(requirementType)
  ) {
    errors.push(`Invalid requirement_type "${record.requirement_type}"`);
  }
  if (status && !(PROPERTY_STATUSES as readonly string[]).includes(status)) {
    errors.push(`Invalid status "${record.status}"`);
  }

  if (errors.length > 0) return { errors };

  const dto = plainToInstance(CreatePropertyDto, {
    title: record.title,
    description: record.description || undefined,
    type,
    category,
    requirement_type: requirementType,
    city: record.city,
    state: record.state || undefined,
    country: record.country || 'India',
    pincode: record.pincode || undefined,
    address: record.address || undefined,
    price: parseOptionalNumber(record.price),
    maintenance: parseOptionalNumber(record.maintenance),
    token_amount: parseOptionalNumber(record.token_amount),
    latitude: parseOptionalNumber(record.latitude),
    longitude: parseOptionalNumber(record.longitude),
    bedrooms: parseOptionalInt(record.bedrooms),
    bathrooms: parseOptionalInt(record.bathrooms),
    balconies: parseOptionalInt(record.balconies),
    floor: parseOptionalInt(record.floor),
    total_floors: parseOptionalInt(record.total_floors),
    super_builtup_area: parseOptionalNumber(record.super_builtup_area),
    carpet_area: parseOptionalNumber(record.carpet_area),
    status,
    is_public: ['true', '1', 'yes'].includes((record.is_public ?? '').toLowerCase()),
    amenities: splitList(record.amenities),
    tags: splitList(record.tags),
  });

  const validationErrors = await validate(dto);
  if (validationErrors.length > 0) {
    for (const err of validationErrors) {
      const messages = err.constraints ? Object.values(err.constraints) : [];
      errors.push(...messages);
    }
  }

  return errors.length > 0 ? { errors } : { dto, errors: [] };
}
