import { MerchantRecord } from '../../types/merchant.ts';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Percent,
  Award,
  ArrowUpRight,
  PackageCheck
} from 'lucide-react';

interface SalesGmvViewProps {
  merchants: MerchantRecord[];
}

export function SalesGmvView({ merchants }: SalesGmvViewProps) {
  const orderedMerchants = merchants.filter(m => m.firstOrderDate);
  const totalOrdersEst = orderedMerchants.length * 14 + 180;
  const avgOrderCheck = 1840; // грн
  const totalGmv = totalOrdersEst * avgOrderCheck;
  const commissionRate = 14.5; // %
  const marketplaceRevenue = Math.round(totalGmv * (commissionRate / 100));

  // Category sales breakdown
  const categorySales = [
    { name: 'Електроніка та гаджети', gmv: Math.round(totalGmv * 0.38), share: 38, count: 18 },
    { name: 'Товари для дому та ремонт', gmv: Math.round(totalGmv * 0.26), share: 26, count: 14 },
    { name: 'Одяг та взуття', gmv: Math.round(totalGmv * 0.16), share: 16, count: 11 },
    { name: 'Автотовари', gmv: Math.round(totalGmv * 0.12), share: 12, count: 7 },
    { name: 'Дитячі товари', gmv: Math.round(totalGmv * 0.08), share: 8, count: 5 }
  ];

  return (
    <div className="space-y-6">
      {/* Top Financial KPI Cards in Epicentr style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total GMV */}
        <div className="bg-[#0b1b3d]/90 border border-blue-900/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-blue-300 mb-2">
            <span className="font-semibold">Товарообіг (GMV) нових мерчантів</span>
            <DollarSign className="w-4 h-4 text-[#FF7A00]" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {(totalGmv / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })}
              <span className="text-sm font-normal text-blue-300 ml-1">тис. грн</span>
            </div>
            <span className="text-xs font-mono text-emerald-400 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" /> +24.8%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Середній чек:</span>
            <span className="text-white font-semibold">{avgOrderCheck.toLocaleString()} грн</span>
          </div>
        </div>

        {/* First Orders Count */}
        <div className="bg-[#0b1b3d]/90 border border-blue-900/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-blue-300 mb-2">
            <span className="font-semibold">Виконані замовлення</span>
            <ShoppingBag className="w-4 h-4 text-[#004BB7]" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {totalOrdersEst.toLocaleString()}
            </div>
            <span className="text-xs font-mono text-sky-400">
              {orderedMerchants.length} активних мерчантів
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Конверсія в замовлення:</span>
            <span className="text-emerald-400 font-semibold">{((orderedMerchants.length / (merchants.length || 1)) * 100).toFixed(1)}%</span>
          </div>
        </div>

        {/* Marketplace Commission Revenue */}
        <div className="bg-[#0b1b3d]/90 border border-blue-900/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-blue-300 mb-2">
            <span className="font-semibold">Дохід маркетплейсу (Комісія)</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {(marketplaceRevenue / 1000).toLocaleString('uk-UA', { maximumFractionDigits: 1 })}
              <span className="text-sm font-normal text-blue-300 ml-1">тис. грн</span>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-semibold">
              Take rate: {commissionRate}%
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Виплачено продавцям:</span>
            <span className="text-white font-semibold">{((totalGmv - marketplaceRevenue) / 1000).toFixed(1)} тис.</span>
          </div>
        </div>

        {/* Top Active Sellers */}
        <div className="bg-[#0b1b3d]/90 border border-blue-900/60 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-blue-300 mb-2">
            <span className="font-semibold">Продавці з продажами</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-white">
              {orderedMerchants.length}
              <span className="text-xs font-normal text-slate-400 ml-1">з {merchants.length}</span>
            </div>
            <span className="text-xs font-mono text-amber-400 font-semibold">
              Успішний старт
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between">
            <span>Сер. час до продажу:</span>
            <span className="text-white font-semibold">4.8 дні</span>
          </div>
        </div>
      </div>

      {/* Category Sales Breakdown */}
      <div className="bg-[#0b1b3d]/80 border border-blue-900/60 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-blue-900/40">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-[#004BB7]" />
              <span>Розподіл продажів за категоріями Епіцентр Маркетплейс</span>
            </h3>
            <p className="text-xs text-blue-300 mt-0.5">Частка GMV та кількість активних постачальників</p>
          </div>
          <span className="text-xs font-mono text-slate-400">Всього: 5 ключових категорій</span>
        </div>

        <div className="space-y-3">
          {categorySales.map((cat) => (
            <div key={cat.name} className="space-y-1.5 p-3 rounded-xl bg-[#08142c]/70 border border-blue-900/40">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white font-semibold">{cat.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">{cat.count} мерчантів</span>
                  <span className="text-[#FF7A00] font-bold">
                    {(cat.gmv / 1000).toLocaleString()} тис. грн ({cat.share}%)
                  </span>
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#004BB7] to-[#FF7A00]"
                  style={{ width: `${cat.share * 2}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
