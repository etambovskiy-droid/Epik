import { MerchantRecord } from '../../types/merchant.ts';
import { UserX, AlertTriangle, Layers, Calendar } from 'lucide-react';

interface CohortChurnViewProps {
  merchants: MerchantRecord[];
}

export function CohortChurnView({ merchants }: CohortChurnViewProps) {
  const terminated = merchants.filter(m => m.isTerminated);

  // Group termination reasons
  const reasonCounts: Record<string, number> = {};
  terminated.forEach(m => {
    const r = m.terminationReason || 'Інша причина';
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  });

  const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);

  // Group by cohort (Week of contract)
  const cohortMap: Record<string, { total: number; drafted: number; published: number; ordered: number; terminated: number }> = {};
  
  merchants.forEach(m => {
    const date = new Date(m.contractDate);
    // Simple 7-day bucket or bi-weekly
    const weekKey = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)} (${date.toLocaleString('uk-UA', { month: 'short' })})`;
    if (!cohortMap[weekKey]) {
      cohortMap[weekKey] = { total: 0, drafted: 0, published: 0, ordered: 0, terminated: 0 };
    }
    cohortMap[weekKey].total++;
    if (m.firstItemDraftDate) cohortMap[weekKey].drafted++;
    if (m.firstItemPublishedDate) cohortMap[weekKey].published++;
    if (m.firstOrderDate) cohortMap[weekKey].ordered++;
    if (m.isTerminated) cohortMap[weekKey].terminated++;
  });

  const cohorts = Object.entries(cohortMap).slice(0, 6);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Termination Reasons Breakdown */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <UserX className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-white">Причини припинення договорів</h3>
          </div>
          <span className="text-xs font-mono text-rose-400 font-semibold">
            {terminated.length} розірваних договорів
          </span>
        </div>

        <div className="space-y-3">
          {sortedReasons.map(([reason, count]) => {
            const pct = terminated.length > 0 ? ((count / terminated.length) * 100).toFixed(1) : '0';
            return (
              <div key={reason} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 truncate max-w-[280px]">{reason}</span>
                  <span className="text-rose-300 font-semibold">
                    {count} <span className="text-slate-400 text-[11px]">({pct}%)</span>
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cohorts Progress */}
      <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Когортна динаміка активації</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">По тижнях підписання</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="pb-2 font-medium">Когорта</th>
                <th className="pb-2 font-medium text-right">Договори</th>
                <th className="pb-2 font-medium text-right">1-й товар</th>
                <th className="pb-2 font-medium text-right">Опубліковано</th>
                <th className="pb-2 font-medium text-right">1-й продаж</th>
                <th className="pb-2 font-medium text-right text-rose-400">Відтік</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {cohorts.map(([cohortName, data]) => {
                const draftPct = ((data.drafted / data.total) * 100).toFixed(0);
                const pubPct = ((data.published / data.total) * 100).toFixed(0);
                const orderPct = ((data.ordered / data.total) * 100).toFixed(0);

                return (
                  <tr key={cohortName} className="hover:bg-slate-800/30">
                    <td className="py-2.5 font-semibold text-slate-200">{cohortName}</td>
                    <td className="py-2.5 text-right text-sky-400 font-bold">{data.total}</td>
                    <td className="py-2.5 text-right text-indigo-300">{data.drafted} ({draftPct}%)</td>
                    <td className="py-2.5 text-right text-emerald-300">{data.published} ({pubPct}%)</td>
                    <td className="py-2.5 text-right text-amber-300 font-bold">{data.ordered} ({orderPct}%)</td>
                    <td className="py-2.5 text-right text-rose-400 font-semibold">{data.terminated}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
