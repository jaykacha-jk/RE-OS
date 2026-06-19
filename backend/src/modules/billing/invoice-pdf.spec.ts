import { buildInvoicePdf } from './invoice-pdf';

describe('buildInvoicePdf', () => {
  it('returns a valid PDF header and includes the invoice number', () => {
    const buffer = buildInvoicePdf({
      invoiceNumber: 'INV-20260618-ABC123',
      organizationName: 'Acme Realty',
      planName: 'Pro',
      subtotal: 1499900,
      tax: 269982,
      total: 1769882,
      currency: 'INR',
      issuedAt: new Date('2026-06-18T00:00:00.000Z'),
    });

    const text = buffer.toString('utf8');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('INV-20260618-ABC123');
    expect(text).toContain('Acme Realty');
  });
});
