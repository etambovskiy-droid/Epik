import { FunnelStage, MerchantKpis } from '../../types/merchant.ts';
import {
  ArrowDown,
  Clock,
  UserX,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  Info
} from 'lucide-react';

interface ActivationFunnelProps {
  stages: FunnelStage[];
  kpis: MerchantKpis;
}

export function ActivationFunnel({ stages, kpis }: ActivationFunnelProps) {
  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Воронка онбордингу та активації мерчанта</span>
            <span className="text-xs font-normal text-emerald-400 font-mono">
              (Конверсія в перший продаж: {kpis.firstOrderPct}%)
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Аналіз переходу між підписанням договору, першим товаром, модерацією, публікацією та замовленням
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Втрати до першого товару: <span className="text-rose-400 font-semibold">{kpis.totalMerchants - kpis.draftedFirstItemCount} мерч. ({((1 - kpis.draftedFirstItemCount / (kpis.totalMerchants || 1)) * 100).toFixed(1)}%)</span>
        </div>
      </div>

      {/* Visual Funnel Step Bars */}
      <div className="space-y-3.5">
        {stages.map((stage, index) => {
          const isFirst = index === 0;
          const isLast = index === stages.length - 1;

          return (
            <div key={stage.id} className="relative">
              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-slate-700 transition-all">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  {/* Step Title & Badge */}
                  <div className="flex items-center gap-3 min-w-[260px]">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 text-slate-950"
                      style={{ backgroundColor: stage.color }}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{stage.title}</h3>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{stage.avgDurationLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Visual Conversion Progress Bar */}
                  <div className="flex-1 max-w-xl space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-300 font-medium">
                        {stage.count} з {kpis.totalMerchants} мерчантів
                      </span>
                      <span className="font-bold text-white">
                        {stage.conversionFromTotal}% від загальної бази
                      </span>
                    </div>

                    <div className="w-full h-3 bg-slate-800/90 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out shadow-sm"
                        style={{
                          width: `${stage.conversionFromTotal}%`,
                          backgroundColor: stage.color
                        }}
                      />
                    </div>
                  </div>

                  {/* Step-to-Step Conversion & Dropoff */}
                  <div className="flex items-center justify-end gap-4 min-w-[170px] text-right font-mono text-xs">
                    {!isFirst ? (
                      <div>
                        <div className="text-sky-300 font-semibold">{stage.conversionFromPrev}%</div>
                        <div className="text-[10px] text-slate-400">від попер. кроку</div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-emerald-400 font-semibold">100%</div>
                        <div className="text-[10px] text-slate-400">вихідна точка</div>
                      </div>
                    )}

                    {!isLast && stage.dropoffCount > 0 && (
                      <div className="pl-3 border-l border-slate-800 text-rose-400">
                        <div className="font-semibold">-{stage.dropoffCount}</div>
                        <div className="text-[10px] text-slate-400">відсіялись</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Connecting arrow indicator between steps */}
              {!isLast && (
                <div className="flex justify-center -my-1 py-0.5 relative z-10">
                  <div className="w-6 h-4 flex items-center justify-center text-slate-400">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Churn Callout Box */}
      <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400 shrink-0">
            <UserX className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-rose-300">
              Припинені договори в процесі онбордингу: {kpis.terminatedCount} ({kpis.terminatedPct}%)
            </h4>
            <p className="text-slate-400 mt-0.5">
              Основні причини відтоку: складність вивантаження XML/YML фіду, невідповідність фото вимогам модерації, зміна бізнес-планів мерчанта.
            </p>
          </div>
        </div>

        <div className="shrink-0 font-mono text-xs text-right">
          <div className="text-emerald-400 font-bold">{kpis.totalMerchants - kpis.terminatedCount} збережено</div>
          <div className="text-[10px] text-slate-400">активні або в процесі</div>
        </div>
      </div>
    </div>
  );
}
