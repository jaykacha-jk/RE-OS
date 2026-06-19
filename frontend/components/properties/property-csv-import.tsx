'use client';

import { useState } from 'react';

import { ActionGuard } from '../shared/ActionGuard';
import { QuotaNotice, quotaApiNoticeProps } from '../billing/quota-notice';
import { Drawer, Icon } from '../ui';
import { apiFetch } from '../../lib/api';
import { getSession } from '../../lib/auth';
import { parseQuotaApiError, type QuotaErrorDetails } from '../../lib/quota';

export const PROPERTY_CSV_TEMPLATE = `title,type,category,requirement_type,city,price,state,pincode,address,bedrooms,bathrooms,status,amenities,tags
3BHK SG Highway,residential,flat,sell,Ahmedabad,8500000,Gujarat,380015,"SG Highway, Ahmedabad",3,2,draft,gym|parking,premium
2BHK Satellite,residential,flat,rent,Ahmedabad,28000,Gujarat,380015,Satellite Road,2,2,draft,lift,affordable`;

type ImportResult = {
  total: number;
  succeeded: number;
  failed: number;
  results: Array<{
    row: number;
    success: boolean;
    property_id?: string;
    property_code?: string;
    errors: string[];
  }>;
};

export function PropertyCsvImportButton({
  onImported,
  disabled = false,
}: {
  onImported?: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<QuotaErrorDetails | null>(null);
  const [loading, setLoading] = useState(false);

  function downloadTemplate() {
    const blob = new Blob([PROPERTY_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'property-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function readFile(file: File) {
    setError(null);
    setResult(null);
    const text = await file.text();
    setCsvContent(text);
  }

  async function runImport() {
    const session = getSession();
    if (!session?.access_token || !csvContent.trim()) return;

    setLoading(true);
    setError(null);
    setQuotaError(null);
    try {
      const res = await apiFetch<ImportResult>('/api/v1/properties/import', {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({ csv_content: csvContent }),
      });
      setResult(res.data);
      onImported?.();
    } catch (err) {
      const parsed = parseQuotaApiError(err);
      if (parsed) {
        setQuotaError(parsed);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Import failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ActionGuard permission="properties.create">
      <button
        type="button"
        className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? 'Property limit reached for your current plan' : undefined}
      >
        <Icon name="arrowUpRight" className="h-4 w-4" /> Import CSV
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Bulk import properties"
        description="Upload up to 500 rows per file (BR-P05). Required columns: title, type, category, requirement_type, city."
        width="lg"
        footer={
          <>
            <button type="button" className="btn-ghost mr-auto" onClick={downloadTemplate}>
              Download template
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Close
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!csvContent.trim() || loading}
              onClick={() => void runImport()}
            >
              {loading ? 'Importing…' : 'Run import'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-reos-border bg-slate-50 px-4 py-6 text-center text-sm">
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void readFile(file);
                e.target.value = '';
              }}
            />
            <span className="font-semibold text-slate-700">Choose a CSV file</span>
            <span className="mt-1 text-xs text-slate-500">Or paste CSV content below</span>
          </label>

          <textarea
            value={csvContent}
            onChange={(e) => {
              setCsvContent(e.target.value);
              setResult(null);
            }}
            rows={8}
            className="input font-mono text-xs"
            placeholder={PROPERTY_CSV_TEMPLATE}
          />

          {quotaError ? <QuotaNotice {...quotaApiNoticeProps(quotaError)} /> : null}
          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}

          {result ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                Imported <span className="font-semibold text-teal-700">{result.succeeded}</span> of{' '}
                {result.total} rows
                {result.failed > 0 ? (
                  <>
                    {' '}
                    · <span className="font-semibold text-rose-600">{result.failed}</span> failed
                  </>
                ) : null}
              </p>
              <div className="max-h-64 overflow-auto rounded-xl border border-reos-border">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.map((row) => (
                      <tr key={row.row} className="border-t border-slate-100">
                        <td className="px-3 py-2 tabular-nums">{row.row}</td>
                        <td className="px-3 py-2">
                          <span className={row.success ? 'text-teal-700' : 'text-rose-600'}>
                            {row.success ? 'OK' : 'Failed'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {row.success
                            ? row.property_code
                            : row.errors.join('; ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </Drawer>
    </ActionGuard>
  );
}
