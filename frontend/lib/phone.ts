/** Default dial code for Indian market (TRAI). Extend `DIAL_CODES` when adding more regions. */
export const DEFAULT_DIAL_CODE = '+91';

export const DIAL_CODES = [{ code: DEFAULT_DIAL_CODE, label: 'India (+91)' }] as const;

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export const PHONE_FORMAT_MESSAGE = 'Please match the requested format.';

/** Strip dial code and non-digits; return up to 10 national digits. */
export function parseNationalDigits(value: string, dialCode = DEFAULT_DIAL_CODE): string {
  const digits = value.replace(/\D/g, '');
  const codeDigits = dialCode.replace(/\D/g, '');
  if (digits.startsWith(codeDigits)) {
    return digits.slice(codeDigits.length, codeDigits.length + 10);
  }
  return digits.slice(0, 10);
}

export function isValidIndianMobile(nationalDigits: string): boolean {
  return INDIAN_MOBILE.test(nationalDigits);
}

/** Build E.164-style value for API storage, e.g. +919876543210 */
export function toE164(nationalDigits: string, dialCode = DEFAULT_DIAL_CODE): string {
  const national = parseNationalDigits(nationalDigits, dialCode);
  if (!national) return '';
  return `${dialCode}${national}`;
}

/** Split stored phone into dial code + national digits for the input UI. */
export function fromE164(value: string | null | undefined): { dialCode: string; national: string } {
  if (!value?.trim()) return { dialCode: DEFAULT_DIAL_CODE, national: '' };
  const trimmed = value.trim();
  for (const { code } of DIAL_CODES) {
    if (trimmed.startsWith(code)) {
      return { dialCode: code, national: parseNationalDigits(trimmed, code) };
    }
  }
  return { dialCode: DEFAULT_DIAL_CODE, national: parseNationalDigits(trimmed) };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
