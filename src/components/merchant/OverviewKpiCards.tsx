import { MerchantKpis } from '../../types/merchant.ts';
import {
  Users,
  PlusCircle,
  FileCheck,
  CheckCircle2,
  ShoppingBag,
  UserX,
  Package,
  Clock,
  ArrowRight,
  TrendingUp,
  Percent
} from 'lucide-react';

interface OverviewKpiCardsProps {
  kpis: MerchantKpis;
}

export function OverviewKpiCards({ kpis }: OverviewKpiCardsProps) {
  return (
    <div className="space-y-4">
      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* 1. Всього нових мерчантів */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Нові договори</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {kpis.totalMerchants}
            </div>
            <span className="text-xs font-mono text-sky-400 font-semibold">100% база</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>В онбордингу</span>
            <span>Активні когорти</span>
          </div>
        </div>

        {/* 2. Перше додавання товару */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Додали 1-й товар</span>
            <PlusCircle className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {kpis.draftedFirstItemCount}
            </div>
            <span className="text-xs font-mono text-indigo-400 font-semibold">
              {kpis.draftedFirstItemPct}%
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Сер. час:</span>
            <span className="text-slate-200 font-semibold">{kpis.avgTimeToDraftHours} год</span>
          </div>
        </div>

        {/* 3. Перша відправка на модерацію */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Подали на модерацію</span>
            <FileCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {kpis.submittedFirstItemCount}
            </div>
            <span className="text-xs font-mono text-purple-400 font-semibold">
              {kpis.submittedFirstItemPct}%
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Сер. час:</span>
            <span className="text-slate-200 font-semibold">{kpis.avgTimeToSubmitHours} год</span>
          </div>
        </div>

        {/* 4. Перша публікація товару */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Опублікували 1-й товар</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {kpis.publishedFirstItemCount}
            </div>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              {kpis.publishedFirstItemPct}%
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Сер. час:</span>
            <span className="text-slate-200 font-semibold">{kpis.avgTimeToPublishHours} год</span>
          </div>
        </div>

        {/* 5. Мерчанти з першим замовленням */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Отримали 1-ше замовлення</span>
            <ShoppingBag className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {kpis.firstOrderCount}
            </div>
            <span className="text-xs font-mono text-amber-400 font-semibold">
              {kpis.firstOrderPct}%
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Сер. до продажу:</span>
            <span className="text-amber-300 font-semibold">{kpis.avgTimeToFirstOrderDays} дн.</span>
          </div>
        </div>

        {/* 6. Припинені договори */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-3.5 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Припинені договори</span>
            <UserX className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {kpis.terminatedCount}
            </div>
            <span className="text-xs font-mono text-rose-400 font-semibold">
              {kpis.terminatedPct}% відтік
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Конверсія в успіх:</span>
            <span className="text-emerald-400 font-semibold">{(100 - kpis.terminatedPct).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar: Volumes & Speed Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Обсяг створених та опублікованих товарів */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-950 border border-sky-800/60 flex items-center justify-center text-sky-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Створено нових товарів</div>
              <div className="text-xl font-bold font-mono text-white">
                {kpis.totalCreatedItems.toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1.5 font-mono">
                  (сер. {kpis.avgCreatedItemsPerMerchant} на мерчанта)
                </span>
              </div>
            </div>
          </div>
          <div className="text-right font-mono text-xs">
            <div className="text-emerald-400 font-bold">{kpis.totalPublishedItems.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400">опубліковано</div>
          </div>
        </div>

        {/* Швидкість додавання та модерації */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Швидкість старту (1-й товар)</div>
              <div className="text-xl font-bold font-mono text-white">
                {kpis.avgTimeToDraftHours}
                <span className="text-xs font-normal text-slate-400 ml-1">год.</span>
                <span className="text-xs font-normal text-indigo-300 ml-1.5 font-mono">
                  (медіана {kpis.medianTimeToDraftHours} год.)
                </span>
              </div>
            </div>
          </div>
          <div className="text-right font-mono text-xs">
            <div className="text-indigo-400 font-bold">{kpis.avgTimeToSubmitHours} год.</div>
            <div className="text-[10px] text-slate-400">до модерації</div>
          </div>
        </div>

        {/* Швидкість виходу на продаж (Time-to-Live) */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Час до першої публікації</div>
              <div className="text-xl font-bold font-mono text-white">
                {(kpis.avgTimeToPublishHours / 24).toFixed(1)}
                <span className="text-xs font-normal text-slate-400 ml-1">дні</span>
                <span className="text-xs font-normal text-emerald-400 ml-1.5 font-mono">
                  ({kpis.avgTimeToPublishHours} год.)
                </span>
              </div>
            </div>
          </div>
          <div className="text-right font-mono text-xs">
            <div className="text-amber-400 font-bold">{kpis.avgTimeToFirstOrderDays} дн.</div>
            <div className="text-[10px] text-slate-400">до 1-го замовлення</div>
          </div>
        </div>
      </div>
    </div>
  );
}
