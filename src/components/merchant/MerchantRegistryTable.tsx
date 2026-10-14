import { useState } from 'react';
import { MerchantRecord, MerchantStatus } from '../../types/merchant.ts';
import {
  Search,
  Filter,
  Download,
  ArrowUpDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Package,
  UserX
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface MerchantRegistryTableProps {
  merchants: MerchantRecord[];
}

export function MerchantRegistryTable({ merchants }: MerchantRegistryTableProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<keyof MerchantRecord>('contractTimestamp');
  const [sortAsc, setSortAsc] = useState(false);

  // Extract unique categories
  const categories = Array.from(new Set(merchants.map(m => m.category))).sort();

  const filtered = merchants
    .filter((m) => {
      const matchSearch =
        m.merchantName.toLowerCase().includes(search.toLowerCase()) ||
        m.id.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'all' || m.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || m.status === statusFilter;
      return matchSearch && matchCat && matchStatus;
    })
    .sort((a, b) => {
      const valA = a[sortBy] ?? -Infinity;
      const valB = b[sortBy] ?? -Infinity;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

  const handleExportFiltered = () => {
    const exportRows = filtered.map(m => ({
      'ID Мерчанта': m.id,
      'Назва мерчанта': m.merchantName,
      'Категорія': m.category,
      'Дата договору': new Date(m.contractDate).toLocaleDateString('uk-UA'),
      'Час до 1-го товару (год)': m.timeToFirstDraftHours ?? '—',
      'Час до модерації (год)': m.timeToFirstSubmittedHours ?? '—',
      'Час до публікації (год)': m.timeToFirstPublishedHours ?? '—',
      'Час до 1-го замовлення (дні)': m.timeToFirstOrderDays ?? '—',
      'Створено товарів': m.totalCreatedItems,
      'Опубліковано товарів': m.totalPublishedItems,
      'Статус': m.status,
      'Причина припинення': m.terminationReason || '—',
      'Менеджер': m.manager
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Merchants_Report');
    XLSX.writeFile(wb, `marketplace_merchants_export_${Date.now()}.xlsx`);
  };

  const statusLabels: Record<MerchantStatus, { label: string; class: string }> = {
    contract_signed: { label: 'Договір підписано', class: 'bg-slate-800 text-slate-300 border-slate-700' },
    item_drafted: { label: 'Товар створено', class: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/50' },
    under_moderation: { label: 'На модерації', class: 'bg-purple-950/60 text-purple-300 border-purple-800/50' },
    published: { label: 'Опубліковано', class: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50' },
    first_order_received: { label: 'Перше замовлення', class: 'bg-amber-950/60 text-amber-300 border-amber-800/50' },
    contract_terminated: { label: 'Договір розірвано', class: 'bg-rose-950/60 text-rose-300 border-rose-800/50' }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-5 shadow-sm space-y-4">
      {/* Table Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Пошук за назвою або ID мерчанта..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">Усі категорії</option>
              {categories.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900">Усі статуси</option>
              <option value="contract_signed" className="bg-slate-900">Договір підписано</option>
              <option value="item_drafted" className="bg-slate-900">Товар створено</option>
              <option value="under_moderation" className="bg-slate-900">На модерації</option>
              <option value="published" className="bg-slate-900">Опубліковано</option>
              <option value="first_order_received" className="bg-slate-900">Перше замовлення</option>
              <option value="contract_terminated" className="bg-slate-900">Договір розірвано</option>
            </select>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportFiltered}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Експорт в Excel ({filtered.length})</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto rounded-lg border border-slate-800/80">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-[11px] bg-slate-950/70">
              <th className="p-3 font-medium">Мерчант</th>
              <th className="p-3 font-medium">Категорія</th>
              <th className="p-3 font-medium">Договір</th>
              <th className="p-3 font-medium text-right">Час до 1-го товару</th>
              <th className="p-3 font-medium text-right">Час до модерації</th>
              <th className="p-3 font-medium text-right">Час до публікації</th>
              <th className="p-3 font-medium text-right">Час до 1-го замовл.</th>
              <th className="p-3 font-medium text-right">Створено</th>
              <th className="p-3 font-medium text-right">Опубліковано</th>
              <th className="p-3 font-medium">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-500 font-mono">
                  Не знайдено мерчантів за вибраними фільтрами
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const statusMeta = statusLabels[m.status] || { label: m.status, class: 'bg-slate-800 text-slate-300' };

                return (
                  <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-semibold text-slate-200">
                      <div>{m.merchantName}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{m.id} &bull; {m.manager}</div>
                    </td>
                    <td className="p-3 text-slate-400">{m.category}</td>
                    <td className="p-3 text-slate-300">
                      {new Date(m.contractDate).toLocaleDateString('uk-UA')}
                    </td>
                    <td className="p-3 text-right">
                      {m.timeToFirstDraftHours !== null ? (
                        <span className="text-indigo-400 font-semibold">{m.timeToFirstDraftHours} год</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {m.timeToFirstSubmittedHours !== null ? (
                        <span className="text-purple-400 font-semibold">{m.timeToFirstSubmittedHours} год</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {m.timeToFirstPublishedHours !== null ? (
                        <span className="text-emerald-400 font-semibold">{m.timeToFirstPublishedHours} год</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {m.timeToFirstOrderDays !== null ? (
                        <span className="text-amber-400 font-semibold">{m.timeToFirstOrderDays} дн.</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right text-slate-200 font-bold">{m.totalCreatedItems}</td>
                    <td className="p-3 text-right text-emerald-400 font-bold">{m.totalPublishedItems}</td>
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${statusMeta.class}`}>
                          {statusMeta.label}
                        </span>
                        {m.terminationReason && (
                          <span className="text-[10px] text-rose-400/80 truncate max-w-[140px]" title={m.terminationReason}>
                            {m.terminationReason}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
