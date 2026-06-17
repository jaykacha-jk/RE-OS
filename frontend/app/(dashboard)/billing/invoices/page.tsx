'use client';

import { useEffect, useState } from 'react';

import {
  ActionMenu,
  CrudToolbar,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  type DataTableColumn,
} from '../../../../components/ui';
import { useClientPagination } from '../../../../hooks/use-client-pagination';
import { fetchInvoices, formatMoney, isAssistedBillingMode, type Invoice } from '../../../../lib/billing';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const assistedBilling = isAssistedBillingMode();

  async function load() {
    setLoading(true);
    fetchInvoices()
      .then(setInvoices)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load invoices'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredInvoices = invoices.filter((invoice) => {
    const haystack = [invoice.invoice_number, invoice.status, invoice.currency].join(' ').toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  const pager = useClientPagination(filteredInvoices);

  const columns: DataTableColumn<Invoice>[] = [
    { key: 'invoice', header: 'Invoice', render: (invoice) => <span className="font-semibold text-slate-900">{invoice.invoice_number}</span> },
    { key: 'issued', header: 'Issued', render: (invoice) => new Date(invoice.issued_at).toLocaleDateString('en-IN') },
    { key: 'subtotal', header: 'Subtotal', align: 'right', cellClassName: 'tabular-nums text-slate-700', render: (invoice) => formatMoney(invoice.subtotal) },
    { key: 'gst', header: 'GST', align: 'right', cellClassName: 'tabular-nums text-slate-700', render: (invoice) => formatMoney(invoice.tax) },
    { key: 'total', header: 'Total', align: 'right', cellClassName: 'font-semibold tabular-nums text-slate-900', render: (invoice) => formatMoney(invoice.total) },
    { key: 'status', header: 'Status', render: (invoice) => <span className="badge badge-slate capitalize">{invoice.status}</span> },
    { key: 'pdf', header: 'PDF', render: (invoice) => <span className="text-slate-500">{invoice.pdf_url ? 'Ready' : 'Pending'}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Payment history and GST invoice records." />

      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {assistedBilling ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <p className="font-bold">Invoice PDFs are assisted during launch.</p>
          <p className="mt-1">
            The product stores invoice records when payments are processed, but GST PDF generation/upload is handled offline until live billing mode is enabled.
          </p>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
        <CrudToolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search invoices"
          onRefresh={load}
          refreshing={loading}
        />
        <DataTable<Invoice>
          columns={columns}
          rows={pager.pageRows}
          rowKey={(invoice) => invoice.id}
          loading={loading}
          empty={<EmptyState title="No invoices generated yet" description="Invoices appear here when payments are processed." />}
          actions={(invoice) => (
            <ActionMenu
              items={[
                {
                  label: 'Download PDF',
                  href: invoice.pdf_url ?? undefined,
                  disabled: !invoice.pdf_url,
                },
              ]}
            />
          )}
        />

        {!loading && filteredInvoices.length > 0 ? (
          <Pagination
            page={pager.page}
            totalPages={pager.totalPages}
            total={pager.total}
            perPage={pager.perPage}
            onPageChange={pager.setPage}
            onPerPageChange={pager.setPerPage}
          />
        ) : null}
      </section>
    </div>
  );
}
