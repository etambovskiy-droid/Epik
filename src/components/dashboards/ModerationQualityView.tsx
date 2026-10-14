import { MerchantRecord } from '../../types/merchant.ts';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileCode,
  XCircle,
  HelpCircle
} from 'lucide-react';

interface ModerationQualityViewProps {
  merchants: MerchantRecord[];
}

export function ModerationQualityView({ merchants }: ModerationQualityViewProps) {
  const underModeration = merchants.filter(m => m.status === 'under_moderation').length;
  const published = merchants.filter(m => m.firstItemPublishedDate).length;
  const totalSubmitted = merchants.filter(m => m.firstItemSubmittedDate).length;
  const firstPassApprovalRate = 78.4; // %
  const avgSlaHours = 14.2;

  const topErrors = [
    { name: 'Невідповідність фото вимогам Епіцентру (розмір, білий фон)', count: 48, pct: 36.5 },
    { name: 'Помилка валідації XML/YML фіду (некоректні теги категорій)', count: 32, pct: 24.3 },
    { name: 'Відсутні обов’язкові технічні характеристики та атрибути', count: 26, pct: 19.8 },
    { name: 'Відсутність або невалідний штрихкод EAN / артикул виробника', count: 15, pct: 11.4 },
    { name: 'Опис товару містить контакти продавця чи сторонні лінки', count: 11, pct: 8.0 }
  ];

  return (
    <div className="space-y-6">
      {/* Moderation KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Queue */}
        <div className="bg-[#0b1b3d]/90 border border-blue-900/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-blue-300 mb-2">
            <span className="font-semibold">Черга модерації (Зараз)</span>
            <Clock className="w-4 h-4 text-[#FF7A00]" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {underModeration * 8 + 14}
              <span className="text-xs font-normal text-slate-400 ml-1">карток</span>
            </div>
            <span className="text-xs font-mono text-amber-400">
              {underModeration} мерчантів
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Очікують перевірки контент-менеджером
          </div>
        </div>

        {/* SLA Duration */}
        <div className="bg-[#0b1b3d]/90 border border-blue-900/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-blue-300 mb-2">
            <span className="font-semibold">Сер. час модерації (SLA)</span>
            <ShieldCheck className="w-4 h-4 text-[#004BB7]" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {avgSlaHours}
              <span className="text-xs font-normal text-slate-400 ml-1">год</span>
            </div>
            <span className="text-xs font-mono text-emerald-400">
              Норматив: &lt; 24 год
            </span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-400 font-mono">
            ✓ 94.2% перевіряються вчасно
          </div>
        </div>

        {/* First-pass Approval Rate */}
        <div className="bg-[#0b1b3d]/90 border border-blue-900/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-blue-300 mb-2">
            <span className="font-semibold">Схвалено з 1-ї спроби</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {firstPassApprovalRate}%
            </div>
            <span className="text-xs font-mono text-slate-400">
              {totalSubmitted} перевірено
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            21.6% повертаються на виправлення
          </div>
        </div>

        {/* Total Published Items */}
        <div className="bg-[#0b1b3d]/90 border border-blue-900/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-blue-300 mb-2">
            <span className="font-semibold">Опубліковано на вітрині</span>
            <FileCode className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {published * 28 + 320}
              <span className="text-xs font-normal text-slate-400 ml-1">товарів</span>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-bold">
              100% активні
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Доступні для замовлення покупцями
          </div>
        </div>
      </div>

      {/* Top Reasons of Rejection / Moderation Errors */}
      <div className="bg-[#0b1b3d]/80 border border-blue-900/60 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-blue-900/40">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FF7A00]" />
              <span>Типові помилки мерчантів при відправці товарів на модерацію</span>
            </h3>
            <p className="text-xs text-blue-300 mt-0.5">Причини повернення товарних карток на доопрацювання продавцю</p>
          </div>
          <span className="text-xs font-mono text-slate-400">Аналіз 132 повернень</span>
        </div>

        <div className="space-y-3">
          {topErrors.map((err) => (
            <div key={err.name} className="space-y-1.5 p-3 rounded-xl bg-[#08142c]/70 border border-blue-900/40">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-200">{err.name}</span>
                <span className="text-[#FF7A00] font-bold">
                  {err.count} карток ({err.pct}%)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500"
                  style={{ width: `${err.pct * 2}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
