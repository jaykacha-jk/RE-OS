export type InvoicePdfInput = {
  invoiceNumber: string;
  organizationName: string;
  planName: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  issuedAt: Date;
};

function escapePdfString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatMoney(minorUnits: number, currency: string): string {
  if (currency === 'INR') {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
      minorUnits / 100,
    );
  }
  return `${(minorUnits / 100).toFixed(2)} ${currency}`;
}

/** Builds a minimal single-page PDF invoice without external dependencies. */
export function buildInvoicePdf(input: InvoicePdfInput): Buffer {
  const lines = [
    'RE-OS Tax Invoice',
    `Invoice: ${input.invoiceNumber}`,
    `Organization: ${input.organizationName}`,
    `Plan: ${input.planName}`,
    `Issued: ${input.issuedAt.toISOString().slice(0, 10)}`,
    `Subtotal: ${formatMoney(input.subtotal, input.currency)}`,
    `GST (18%): ${formatMoney(input.tax, input.currency)}`,
    `Total: ${formatMoney(input.total, input.currency)}`,
  ];

  let textOps = 'BT /F1 11 Tf 14 TL 50 780 Td';
  for (let i = 0; i < lines.length; i += 1) {
    textOps += i === 0 ? ` (${escapePdfString(lines[i]!)}) Tj` : ` T* (${escapePdfString(lines[i]!)}) Tj`;
  }
  textOps += ' ET';

  const contentLength = Buffer.byteLength(textOps, 'utf8');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${contentLength} >>\nstream\n${textOps}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
