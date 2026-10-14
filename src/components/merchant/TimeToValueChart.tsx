import { MerchantRecord, MerchantKpis } from '../../types/merchant.ts';
import { Clock, Zap, ShieldCheck, ShoppingCart } from 'lucide-react';

interface TimeToValueChartProps {
  merchants: MerchantRecord[];
  kpis: MerchantKpis;
}

export function TimeToValueChart({ merchants, kpis }: TimeToValueChartProps) {
  // 1. Bucket: Time to First Draft (Hours)
  const draftedMerchants = merchants.filter(m => m.timeToFirstDraftHours !== null);
  const draftBuckets = [
    { label: '< 24 годин', count: draftedMerchants.filter(m => m.timeToFirstDraftHours! <= 24).length, color: '#34d399' },
    { label: '24–48 годин', count: draftedMerchants.filter(m => m.timeToFirstDraftHours! > 24 && m.timeToFirstDraftHours! <= 48).length, color: '#38bdf8' },
    { label: '3–7 днів', count: draftedMerchants.filter(m => m.timeToFirstDraftHours! > 48 && m.timeToFirstDraftHours! <= 168).length, color: '#fbbf24' },
    { label: '> 7 днів', count: draftedMerchants.filter(m => m.timeToFirstDraftHours! > 168).length, color: '#f87171' },
  ];

  // 2. Bucket: Moderation Duration (Hours between submit and publish)
  const publishedMerchants = merchants.filter(m => m.moderationDurationHours !== null);
  const modBuckets = [
    { label: '< 12 годин', count: publishedMerchants.filter(m => m.moderationDurationHours! <= 12).length, color: '#34d399' },
    { label: '12–24 годин', count: publishedMerchants.filter(m => m.moderationDurationHours! > 12 && m.moderationDurationHours! <= 24).length, color: '#38bdf8' },
    { label: '24–48 годин', count: publishedMerchants.filter(m => m.moderationDurationHours! > 24 && m.moderationDurationHours! <= 48).length, color: '#fbbf24' },
    { label: '> 48 годин', count: publishedMerchants.filter(m => m.moderationDurationHours! > 48).length, color: '#f87171' },
  ];

  // 3. Bucket: Time to First Order (Days)
  const orderedMerchants = merchants.filter(m => m.timeToFirstOrderDays !== null);
  const orderBuckets = [
    { label: '1–3 дні', count: orderedMerchants.filter(m => m.timeToFirstOrderDays! <= 3).length, color: '#34d399' },
    { label: '4–7 днів', count: orderedMerchants.filter(m => m.timeToFirstOrderDays! > 3 && m.timeToFirstOrderDays! <= 7).length, color: '#38bdf8' },
    { label: '8–14 днів', count: orderedMerchants.filter(m => m.timeToFirstOrderDays! > 7 && m.timeToFirstOrderDays! <= 14).length, color: '#fbbf24' },
    { label: '> 14 днів', count: orderedMerchants.filter(m => m.timeToFirstOrderDays! > 14).length, color: '#818cf8' },
  ];

  const renderDistribution = (title: string, subtitle: string, buckets: typeof draftBuckets, totalCount: number, icon: React.ReactNode) => (
    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h4 className="text-xs font-semibold text-white">{title}</h4>
            <p className="text-[11px] text-slate-400">{subtitle}</p>
          </div>
        </div>
        <span className="text-xs font-mono text-slate-400">{totalCount} мерчантів</span>
      </div>

      <div className="space-y-2.5">
        {buckets.map((b) => {
          const pct = totalCount > 0 ? ((b.count / totalCount) * 100).toFixed(1) : '0';
          return (
            <div key={b.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">{b.label}</span>
                <span className="text-slate-200">
                  {b.count} <span className="text-slate-400">({pct}%)</span>
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: b.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            <span>Аналітика швидкості дій (Time-to-Action)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Розподіл часу між ключовими подіями онбордингу
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Медіана до публікації: <span className="text-emerald-400 font-bold">{kpis.medianTimeToPublishHours} год</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderDistribution(
          'Час додавання 1-го товару',
          `Сер: ${kpis.avgTimeToDraftHours} год | Мед: ${kpis.medianTimeToDraftHours} год`,
          draftBuckets,
          draftedMerchants.length,
          <Zap className="w-4 h-4 text-indigo-400" />
        )}

        {renderDistribution(
          'Тривалість модерації товару',
          'Від відправки до перевірки модератором',
          modBuckets,
          publishedMerchants.length,
          <ShieldCheck className="w-4 h-4 text-purple-400" />
        )}

        {renderDistribution(
          'Час до першого замовлення',
          `Сер: ${kpis.avgTimeToFirstOrderDays} дні від моменту публікації`,
          orderBuckets,
          orderedMerchants.length,
          <ShoppingCart className="w-4 h-4 text-amber-400" />
        )}
      </div>
    </div>
  );
}
