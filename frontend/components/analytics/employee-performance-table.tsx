import type { EmployeePerformance } from '../../lib/analytics';
import { formatNumber, formatPercent } from '../../lib/analytics';
import { EmptyState } from './chart-card';

/**
 * Team performance leaderboard. Sorted by the backend (won desc).
 */
export function EmployeePerformanceTable({
  rows,
}: {
  rows: EmployeePerformance[];
}) {
  if (!rows.length) {
    return (
      <EmptyState
        title="No team activity yet"
        message="Performance appears once leads are assigned to team members and worked through the pipeline."
      />
    );
  }

  const topWon = Math.max(1, ...rows.map((r) => r.won));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Employee</th>
            <th className="px-3 py-2 text-right font-medium">Leads</th>
            <th className="px-3 py-2 text-right font-medium">Site visits</th>
            <th className="px-3 py-2 text-right font-medium">Won</th>
            <th className="px-3 py-2 text-right font-medium">Lost</th>
            <th className="px-3 py-2 text-right font-medium">Conv. %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.employee_id} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-2 text-slate-400">{i + 1}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-800">{r.name}</div>
                <div className="mt-1 h-1.5 w-28 overflow-hidden rounded bg-slate-100">
                  <div
                    className="h-full rounded bg-teal-500"
                    style={{ width: `${(r.won / topWon) * 100}%` }}
                  />
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                {formatNumber(r.leads)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                {formatNumber(r.site_visits)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">
                {formatNumber(r.won)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-rose-600">
                {formatNumber(r.lost)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                {formatPercent(r.conversion_rate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
