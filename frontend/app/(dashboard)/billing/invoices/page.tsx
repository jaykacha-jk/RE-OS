'use client';

import { useEffect, useState } from 'react';

import { fetchInvoices, formatMoney, type Invoice } from '../../../../lib/billing';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices()
      .then(setInvoices)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load invoices'));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Invoices</h1>
        <p className="text-sm text-slate-500">Payment history and GST invoice records.</p>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="scrollbar-thin overflow-x-auto rounded-lg border bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Issued</th>
              <th className="px-4 py-3">Subtotal</th>
              <th className="px-4 py-3">GST</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{invoice.invoice_number}</td>
                <td className="px-4 py-3">{new Date(invoice.issued_at).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-3">{formatMoney(invoice.subtotal)}</td>
                <td className="px-4 py-3">{formatMoney(invoice.tax)}</td>
                <td className="px-4 py-3">{formatMoney(invoice.total)}</td>
                <td className="px-4 py-3 capitalize">{invoice.status}</td>
                <td className="px-4 py-3">
                  {invoice.pdf_url ? (
                    <a className="text-teal-700 hover:underline" href={invoice.pdf_url}>
                      Download
                    </a>
                  ) : (
                    <span className="text-slate-400">Pending</span>
                  )}
                </td>
              </tr>
            ))}
            {!invoices.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No invoices generated yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
