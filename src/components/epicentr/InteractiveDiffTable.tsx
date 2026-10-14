/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  EpicentrColumn,
  EpicentrProductRow
} from '../../types/epicentr';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Languages,
  Eye,
  Camera,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Tag,
  Maximize2
} from 'lucide-react';

interface InteractiveDiffTableProps {
  columns: EpicentrColumn[];
  rows: EpicentrProductRow[];
  onUpdateCellValue?: (rowIdx: number, columnName: string, newValue: string) => void;
}

export const InteractiveDiffTable: React.FC<InteractiveDiffTableProps> = ({
  columns,
  rows,
  onUpdateCellValue
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'unfilled' | 'lang_fixes' | 'brand_other'>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [expandedRowIdx, setExpandedRowIdx] = useState<number | null>(null);

  // Mandatory columns only for high-density display
  const mandatoryCols = columns.filter(c => c.isRequired);

  // Filter rows
  const filteredRows = rows.filter(r => {
    // Search query
    const matchSearch =
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.titleOriginal.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.vendorCode && r.vendorCode.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchSearch) return false;

    // Filter mode
    if (filterMode === 'unfilled') {
      return r.unfilledRequiredFields.length > 0;
    }
    if (filterMode === 'lang_fixes') {
      return r.languageCorrections.length > 0;
    }
    if (filterMode === 'brand_other') {
      return r.isBrandOther;
    }
    return true;
  });

  return (
    <div className="bg-[#0b1b36] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Top Filter & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Пошук за назвою, ID або артикулом..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <span className="text-xs text-slate-400 whitespace-nowrap">
            Показано {filteredRows.length} з {rows.length}
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterMode === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Всі товари ({rows.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('unfilled')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterMode === 'unfilled'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Порожні обов'язкові ({rows.filter(r => r.unfilledRequiredFields.length > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('lang_fixes')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterMode === 'lang_fixes'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Мовні виправлення ({rows.filter(r => r.languageCorrections.length > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('brand_other')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
              filterMode === 'brand_other'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            Бренд "Інше" ({rows.filter(r => r.isBrandOther).length})
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/80">
        <span className="font-semibold text-slate-300">Легенда значень:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          Заповнено агентом (з довідника)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
          Вже заповнено у шаблоні (не змінювалось)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          Визначено за 1-м фото товару
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
          Мовне виправлення [ua]/[ru]
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          Порожнє (недостатньо даних)
        </span>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-[600px] relative">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#0e2142] sticky top-0 z-20 text-slate-300 font-semibold border-b border-slate-700">
            <tr>
              <th className="py-3 px-3 w-12 text-center">#</th>
              <th className="py-3 px-3 w-16 text-center">1-е Фото</th>
              <th className="py-3 px-3 min-w-[120px]">
                <div className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>ID (Захищено)</span>
                </div>
              </th>
              <th className="py-3 px-3 min-w-[240px]">Назва товару [ua]*</th>
              <th className="py-3 px-3 min-w-[110px]">Артикул*</th>
              
              {/* Dynamic Mandatory Columns */}
              {mandatoryCols
                .filter(c => !c.cleanName.toLowerCase().includes('назва') && !c.cleanName.toLowerCase().includes('артикул') && !c.cleanName.toLowerCase().includes('id') && !c.cleanName.toLowerCase().includes('фото') && !c.cleanName.toLowerCase().includes('опис'))
                .map(col => (
                  <th key={col.originalName} className="py-3 px-3 min-w-[150px] whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span className="text-white">{col.cleanName}</span>
                      <span className="text-amber-400 font-bold">*</span>
                      <span className="text-[10px] text-slate-400 font-mono">({col.type})</span>
                    </div>
                  </th>
                ))}
              <th className="py-3 px-3 w-20 text-center">Деталі</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
            {filteredRows.map((pRow, idx) => {
              const isExpanded = expandedRowIdx === pRow.rowIdx;
              return (
                <React.Fragment key={pRow.id}>
                  <tr className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>

                    {/* 1st Photo preview */}
                    <td className="py-2.5 px-3 text-center">
                      {pRow.firstPhotoUrl ? (
                        <div
                          className="relative group cursor-pointer w-10 h-10 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 mx-auto"
                          onClick={() => setSelectedPhoto(pRow.firstPhotoUrl || null)}
                          title="Клікніть для збільшення першого фото"
                        >
                          <img
                            src={pRow.firstPhotoUrl}
                            alt={pRow.id}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                          <Camera className="w-4 h-4" />
                        </div>
                      )}
                    </td>

                    {/* ID */}
                    <td className="py-2.5 px-3 font-mono font-medium text-emerald-300 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>{pRow.id}</span>
                      </div>
                    </td>

                    {/* Title */}
                    <td className="py-2.5 px-3">
                      <div className="max-w-[280px]">
                        <div className="font-medium text-slate-200 line-clamp-2">
                          {pRow.updatedRow['Назва товару [ua]*'] || pRow.titleOriginal}
                        </div>
                        {pRow.titleFormattedUa && pRow.titleFormattedUa !== pRow.titleOriginal && (
                          <div className="text-[10px] text-amber-300 mt-0.5 flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" />
                            <span>Формула Епіцентру застосована</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* SKU */}
                    <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                      {pRow.vendorCode || pRow.updatedRow['Артикул*'] || '—'}
                    </td>

                    {/* Mandatory Attributes */}
                    {mandatoryCols
                      .filter(c => !c.cleanName.toLowerCase().includes('назва') && !c.cleanName.toLowerCase().includes('артикул') && !c.cleanName.toLowerCase().includes('id') && !c.cleanName.toLowerCase().includes('фото') && !c.cleanName.toLowerCase().includes('опис'))
                      .map(col => {
                        const val = pRow.updatedRow[col.originalName];
                        const diff = pRow.diffs[col.originalName];
                        const isFilled = val !== undefined && val !== null && String(val).trim() !== '';

                        let badgeColor = 'bg-slate-900 text-slate-400';
                        let badgeBorder = 'border-slate-800';

                        if (!isFilled) {
                          badgeColor = 'bg-rose-950/40 text-rose-300';
                          badgeBorder = 'border-rose-800/40';
                        } else if (diff?.source === 'already_filled') {
                          badgeColor = 'bg-blue-950/40 text-blue-300';
                          badgeBorder = 'border-blue-800/40';
                        } else if (diff?.source === 'photo') {
                          badgeColor = 'bg-amber-950/40 text-amber-300';
                          badgeBorder = 'border-amber-800/40';
                        } else if (pRow.isBrandOther && col.cleanName.toLowerCase().includes('бренд')) {
                          badgeColor = 'bg-purple-950/40 text-purple-300';
                          badgeBorder = 'border-purple-800/40';
                        } else {
                          badgeColor = 'bg-emerald-950/40 text-emerald-300';
                          badgeBorder = 'border-emerald-800/40';
                        }

                        return (
                          <td key={col.originalName} className="py-2.5 px-3">
                            <div className={`px-2 py-1 rounded-md border text-xs font-medium inline-block max-w-[200px] truncate ${badgeColor} ${badgeBorder}`} title={diff?.note || String(val)}>
                              {isFilled ? String(val) : 'Порожнє'}
                            </div>
                          </td>
                        );
                      })}

                    {/* Details toggle */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setExpandedRowIdx(isExpanded ? null : pRow.rowIdx)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Переглянути деталі аналізу"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row Detail */}
                  {isExpanded && (
                    <tr className="bg-slate-900/80 border-b border-slate-700/80">
                      <td colSpan={mandatoryCols.length + 5} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                          {/* Visuals Analysis */}
                          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
                            <h5 className="font-bold text-amber-400 flex items-center gap-1.5">
                              <Eye className="w-3.5 h-3.5" />
                              Аналіз першого фото товару
                            </h5>
                            <div className="space-y-1 text-slate-300">
                              <div>Базовий колір: <strong className="text-white">{pRow.photoAnalysis?.primaryColor || '—'}</strong></div>
                              <div>Колір виробника: <strong className="text-white">{pRow.photoAnalysis?.manufacturerColor || '—'}</strong></div>
                              <div>Візерунок: <strong className="text-white">{pRow.photoAnalysis?.patternType || '—'}</strong></div>
                            </div>
                          </div>

                          {/* Language Corrections */}
                          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
                            <h5 className="font-bold text-indigo-400 flex items-center gap-1.5">
                              <Languages className="w-3.5 h-3.5" />
                              Мовна відповідність [ua] / [ru]
                            </h5>
                            {pRow.languageCorrections.length > 0 ? (
                              <div className="space-y-1.5 text-slate-300">
                                {pRow.languageCorrections.map((lc, i) => (
                                  <div key={i} className="border-l-2 border-indigo-500 pl-2">
                                    <div className="text-[10px] text-slate-400">{lc.columnName}</div>
                                    <div className="text-emerald-300">Виправлено мову на: {lc.toLang.toUpperCase()}</div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-slate-400">Мовних конфліктів не виявлено.</div>
                            )}
                          </div>

                          {/* Titles Diff */}
                          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
                            <h5 className="font-bold text-blue-400 flex items-center gap-1.5">
                              <Tag className="w-3.5 h-3.5" />
                              Назви [UA] та [RU]
                            </h5>
                            <div className="space-y-1 text-slate-300">
                              <div><span className="text-slate-400">[UA]:</span> {pRow.titleFormattedUa || pRow.titleOriginal}</div>
                              <div><span className="text-slate-400">[RU]:</span> {pRow.titleFormattedRu || pRow.updatedRow['Назва товару [ru]*']}</div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-3 relative">
            <img
              src={selectedPhoto}
              alt="Перше фото товару"
              className="w-full max-h-[75vh] object-contain rounded-xl mx-auto"
            />
            <div className="p-3 text-center text-xs text-slate-300">
              Перше фото товару — джерело кольору, візерунка, матеріалу та конструкції за регламентом Епіцентру
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
