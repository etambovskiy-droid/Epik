/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
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
  Maximize2,
  Download,
  FileSpreadsheet,
  Copy,
  Check,
  Sparkles,
  Columns,
  Share2,
  KeyRound,
  RefreshCw
} from 'lucide-react';
import { generateEpicentrExportWorkbook } from '../../services/epicentrEngine';
import { EpicentrDictionaryAttribute } from '../../types/epicentr';
import { notifyMissingApiKey, enrichProductMandatoryWithAI } from '../../services/geminiFillingService';
import { getStoredApiKey } from '../../services/aiApiKeyService';

interface InteractiveDiffTableProps {
  columns: EpicentrColumn[];
  rows: EpicentrProductRow[];
  rawWorkbook?: XLSX.WorkBook | null;
  originalFileName?: string | null;
  dictionaryIndex?: Record<string, EpicentrDictionaryAttribute>;
  onOpenApiKeySettings?: () => void;
  onUpdateCellValue?: (rowIdx: number, columnName: string, newValue: string) => void;
}

export const InteractiveDiffTable: React.FC<InteractiveDiffTableProps> = ({
  columns,
  rows,
  rawWorkbook = null,
  originalFileName = null,
  dictionaryIndex,
  onOpenApiKeySettings,
  onUpdateCellValue
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<
    'all' | 'mandatory' | 'unfilled' | 'agent_filled' | 'photo_filled' | 'lang_fixes' | 'brand_other'
  >('all');
  const [showOnlyMandatoryCols, setShowOnlyMandatoryCols] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [expandedRowIdx, setExpandedRowIdx] = useState<number | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProgressMessage, setAiProgressMessage] = useState<string | null>(null);
  const [googleSheetExportOpen, setGoogleSheetExportOpen] = useState(false);

  // Mandatory columns only for high-density display
  const mandatoryCols = columns.filter(c => c.isRequired);
  const displayCols = showOnlyMandatoryCols ? mandatoryCols : columns;

  // Filter rows based on search and selected pill
  const filteredRows = rows.filter(r => {
    // Search query
    const matchSearch =
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.titleOriginal.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.vendorCode && r.vendorCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.brand && r.brand.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchSearch) return false;

    // Filter mode
    if (filterMode === 'mandatory') {
      return true;
    }
    if (filterMode === 'unfilled') {
      return r.unfilledRequiredFields && r.unfilledRequiredFields.length > 0;
    }
    if (filterMode === 'agent_filled') {
      return Object.values(r.diffs).some(d => d.source !== 'already_filled' && d.newValue);
    }
    if (filterMode === 'photo_filled') {
      return Object.values(r.diffs).some(d => d.source === 'photo');
    }
    if (filterMode === 'lang_fixes') {
      return r.languageCorrections && r.languageCorrections.length > 0;
    }
    if (filterMode === 'brand_other') {
      return r.isBrandOther;
    }
    return true;
  });

  // Quick Export to Excel .xlsx
  const handleExportExcel = () => {
    try {
      const exportWb = generateEpicentrExportWorkbook(rawWorkbook, rows, columns);
      const outName = originalFileName
        ? `Заповнено_${originalFileName.replace(/\.(xlsx|xls|csv)$/i, '')}.xlsx`
        : 'Епіцентр_Шаблон_Заповнено.xlsx';

      XLSX.writeFile(exportWb, outName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to export Excel file:', err);
    }
  };

  // Quick Export to CSV
  const handleExportCsv = () => {
    try {
      const dataToExport = filteredRows.map(r => r.updatedRow);
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const csvStr = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Епіцентр_Експорт_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    }
  };

  // Quick Copy to Clipboard (TSV format compatible with Excel copy-paste)
  const handleCopyToClipboard = () => {
    try {
      if (filteredRows.length === 0) return;
      const headers = ['ID', 'Назва товару [ua]*', 'Артикул*', ...displayCols.filter(c => !c.cleanName.toLowerCase().includes('назва') && !c.cleanName.toLowerCase().includes('артикул') && !c.cleanName.toLowerCase().includes('id')).map(c => c.cleanName)];
      
      const rowsData = filteredRows.map(r => {
        const rowVals = [r.id, r.updatedRow['Назва товару [ua]*'] || r.titleFormattedUa || r.titleOriginal, r.vendorCode || ''];
        displayCols.filter(c => !c.cleanName.toLowerCase().includes('назва') && !c.cleanName.toLowerCase().includes('артикул') && !c.cleanName.toLowerCase().includes('id')).forEach(col => {
          rowVals.push(String(r.updatedRow[col.originalName] || ''));
        });
        return rowVals.join('\t');
      });

      const tsvContent = [headers.join('\t'), ...rowsData].join('\n');
      navigator.clipboard.writeText(tsvContent).then(() => {
        setCopiedSuccess(true);
        setTimeout(() => setCopiedSuccess(false), 2500);
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  // AI-powered mandatory attributes filling using Gemini
  const handleTriggerAiFilling = async () => {
    const key = getStoredApiKey();
    if (!key) {
      notifyMissingApiKey('AI-дозаповнення обовʼязкових характеристик через Gemini');
      onOpenApiKeySettings?.();
      return;
    }

    // Identify rows with empty mandatory columns
    const mandatoryCols = columns.filter(c => c.isMandatory || c.isRequired);
    const unfilledRows = rows.map((r, idx) => ({ r, idx })).filter(({ r }) => {
      return mandatoryCols.some(c => {
        const val = r.updatedRow[c.originalName];
        return val === undefined || val === null || String(val).trim() === '';
      });
    });

    if (unfilledRows.length === 0) {
      alert('Усі обовʼязкові характеристики для показаних товарів вже заповнено!');
      return;
    }

    setIsAiProcessing(true);
    setAiProgressMessage(`Gemini: запуск обробки (${unfilledRows.length} товарів)...`);
    try {
      let count = 0;
      for (const item of unfilledRows) {
        setAiProgressMessage(`Gemini: обробка товару ${count + 1} з ${unfilledRows.length}...`);
        const result = await enrichProductMandatoryWithAI(
          item.r.updatedRow,
          columns,
          dictionaryIndex || {}
        );
        if (result.suggestedValues && Object.keys(result.suggestedValues).length > 0) {
          for (const [colName, val] of Object.entries(result.suggestedValues)) {
            if (val && onUpdateCellValue) {
              onUpdateCellValue(item.idx, colName, String(val));
            }
          }
        }
        count++;
      }
      setAiProgressMessage('Успішно дозаповнено через Gemini!');
      setTimeout(() => setAiProgressMessage(null), 3000);
    } catch (e: any) {
      console.error('AI filling failed:', e);
      setAiProgressMessage('Помилка під час виклику Gemini');
      setTimeout(() => setAiProgressMessage(null), 3000);
    } finally {
      setIsAiProcessing(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
      {/* Top Bar: Search, Filters, and Quick Export Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        
        {/* Left: Search input */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Пошук: назва, ID, артикул, бренд..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#004BB7] focus:bg-white transition-all"
            />
          </div>

          <span className="text-xs text-slate-500 whitespace-nowrap font-medium">
            Показано <strong className="text-slate-800">{filteredRows.length}</strong> з {rows.length} товарів
          </span>
        </div>

        {/* Right: Quick Export Buttons & AI Fill */}
        <div className="flex flex-wrap items-center gap-2">
          {/* AI Fill with Gemini */}
          <button
            type="button"
            onClick={handleTriggerAiFilling}
            disabled={isAiProcessing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-[#FF7A00] to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Заповнити пропущені обов'язкові поля за допомогою Google AI Studio (Gemini)"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isAiProcessing ? 'animate-spin' : ''}`} />
            <span>{isAiProcessing ? (aiProgressMessage || 'AI обробка...') : 'AI-дозаповнення (Gemini)'}</span>
          </button>

          {/* Export to Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#004BB7] hover:bg-[#003d99] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Завантажити готовий Excel із збереженням усіх оригінальних коментарів JSON"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Завантажено!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Експорт в Excel (.xlsx)</span>
              </>
            )}
          </button>

          {/* Export to Google Sheets */}
          <button
            type="button"
            onClick={() => setGoogleSheetExportOpen(!googleSheetExportOpen)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer"
            title="Експортувати або відкрити в Google Таблицях"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Google Таблиці</span>
          </button>

          {/* Copy Table to Clipboard */}
          <button
            type="button"
            onClick={handleCopyToClipboard}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            title="Скопіювати таблицю для вставки в Excel"
          >
            {copiedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Скопійовано!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Скопіювати</span>
              </>
            )}
          </button>

          {/* CSV Export */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-600 hover:text-slate-900 transition-colors"
            title="Завантажити у форматі CSV"
          >
            <span className="text-[11px] font-mono font-bold">CSV</span>
          </button>
        </div>
      </div>

      {/* Google Sheets Modal/Popover Banner */}
      {googleSheetExportOpen && (
        <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3.5 text-xs text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Інтеграція з Google Таблицями (Google Sheets):</span>
              <p className="text-emerald-800 text-[11px] mt-0.5">
                Ви можете завантажити CSV або скопіювати дані в буфер і вставити в Google Таблицю без втрати структури колонок Епіцентру.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyToClipboard}
              className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-semibold hover:bg-emerald-100 transition-colors"
            >
              Скопіювати для Google Таблиць
            </button>
            <button
              type="button"
              onClick={() => setGoogleSheetExportOpen(false)}
              className="px-2 py-1 text-slate-400 hover:text-slate-600"
            >
              Закрити
            </button>
          </div>
        </div>
      )}

      {/* Filter Pills Bar: Filtered fields for filling */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'all'
                ? 'bg-[#004BB7] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Всі товари ({rows.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('unfilled')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'unfilled'
                ? 'bg-[#FF7A00] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Порожні обов'язкові ({rows.filter(r => r.unfilledRequiredFields && r.unfilledRequiredFields.length > 0).length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('agent_filled')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'agent_filled'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Заповнені агентом ({rows.filter(r => Object.values(r.diffs).some(d => d.source !== 'already_filled' && d.newValue)).length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('photo_filled')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'photo_filled'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Визначені за фото ({rows.filter(r => Object.values(r.diffs).some(d => d.source === 'photo')).length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('lang_fixes')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'lang_fixes'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Мовні виправлення ({rows.filter(r => r.languageCorrections && r.languageCorrections.length > 0).length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('brand_other')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'brand_other'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Бренд "Інше" ({rows.filter(r => r.isBrandOther).length})
          </button>
        </div>

        {/* Toggle Column View */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowOnlyMandatoryCols(!showOnlyMandatoryCols)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
              showOnlyMandatoryCols
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-slate-100 border-slate-300 text-slate-700'
            }`}
          >
            <Columns className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span>
              {showOnlyMandatoryCols
                ? `Тільки обов'язкові поля (${mandatoryCols.length})`
                : `Всі колонки файлу (${columns.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
        <span className="font-bold text-slate-800">Позначення:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          Заповнено агентом з довідника
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF7A00]" />
          Визначено за 1-м фото
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          Оригінальне значення
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          Мовна нормалізація [ua]
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          Порожнє обов'язкове поле
        </span>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[620px] relative shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-20 text-slate-700 font-bold border-b border-slate-300 shadow-2xs">
            <tr>
              <th className="py-3 px-3 w-12 text-center text-slate-500 font-mono">#</th>
              <th className="py-3 px-3 w-16 text-center">1-е Фото</th>
              <th className="py-3 px-3 min-w-[120px]">
                <div className="flex items-center gap-1 text-[#004BB7]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#004BB7]" />
                  <span>ID (Захищено)</span>
                </div>
              </th>
              <th className="py-3 px-3 min-w-[260px]">Назва товару [ua]*</th>
              <th className="py-3 px-3 min-w-[120px]">Артикул*</th>
              
              {/* Dynamic Columns */}
              {displayCols
                .filter(c => !c.cleanName.toLowerCase().includes('назва') && !c.cleanName.toLowerCase().includes('артикул') && !c.cleanName.toLowerCase().includes('id') && !c.cleanName.toLowerCase().includes('фото') && !c.cleanName.toLowerCase().includes('опис'))
                .map(col => (
                  <th key={col.originalName} className="py-3 px-3 min-w-[160px] whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-800">{col.cleanName}</span>
                      {col.isRequired && <span className="text-[#FF7A00] font-black">*</span>}
                      <span className="text-[10px] text-slate-500 font-mono">({col.type})</span>
                    </div>
                  </th>
                ))}
              <th className="py-3 px-3 w-20 text-center">Дії</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredRows.map((pRow, idx) => {
              const isExpanded = expandedRowIdx === pRow.rowIdx;
              return (
                <React.Fragment key={pRow.id}>
                  <tr className="hover:bg-blue-50/40 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>

                    {/* 1st Photo preview */}
                    <td className="py-2.5 px-3 text-center">
                      {pRow.firstPhotoUrl ? (
                        <div
                          className="relative group cursor-pointer w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-300 mx-auto shadow-2xs"
                          onClick={() => setSelectedPhoto(pRow.firstPhotoUrl || null)}
                          title="Клікніть для збільшення 1-го фото"
                        >
                          <img
                            src={pRow.firstPhotoUrl}
                            alt={pRow.id}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center mx-auto text-slate-400">
                          <Camera className="w-4 h-4" />
                        </div>
                      )}
                    </td>

                    {/* Protected ID */}
                    <td className="py-2.5 px-3 font-mono font-bold text-[#004BB7] whitespace-nowrap">
                      {pRow.id}
                    </td>

                    {/* Title UA */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900 leading-snug">
                        {pRow.updatedRow['Назва товару [ua]*'] || pRow.titleFormattedUa || pRow.titleOriginal}
                      </div>
                      {pRow.titleFormattedUa && pRow.titleFormattedUa !== pRow.titleOriginal && (
                        <div className="text-[11px] text-slate-500 mt-0.5 line-through decoration-slate-400">
                          {pRow.titleOriginal}
                        </div>
                      )}
                    </td>

                    {/* SKU / Article */}
                    <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {pRow.vendorCode || pRow.updatedRow['Артикул*'] || '-'}
                    </td>

                    {/* Dynamic Columns values */}
                    {displayCols
                      .filter(c => !c.cleanName.toLowerCase().includes('назва') && !c.cleanName.toLowerCase().includes('артикул') && !c.cleanName.toLowerCase().includes('id') && !c.cleanName.toLowerCase().includes('фото') && !c.cleanName.toLowerCase().includes('опис'))
                      .map(col => {
                        const val = pRow.updatedRow[col.originalName];
                        const diff = pRow.diffs[col.originalName];
                        const isMandatory = col.isRequired;
                        const isEmpty = !val || String(val).trim() === '';

                        return (
                          <td key={col.originalName} className="py-2.5 px-3">
                            {isEmpty && isMandatory ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 border border-rose-200 text-rose-700">
                                <AlertTriangle className="w-3 h-3 text-rose-500" />
                                Порожнє (*)
                              </span>
                            ) : diff && diff.source === 'photo' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-900">
                                <Camera className="w-3 h-3 text-[#FF7A00]" />
                                <span>{String(val)}</span>
                              </span>
                            ) : diff && diff.source !== 'already_filled' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{String(val)}</span>
                              </span>
                            ) : (
                              <span className="text-slate-700">
                                {val ? String(val) : <span className="text-slate-300">-</span>}
                              </span>
                            )}
                          </td>
                        );
                      })}

                    {/* Details action */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => setExpandedRowIdx(isExpanded ? null : pRow.rowIdx)}
                        className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                        title="Переглянути всі параметри товару"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Row Details */}
                  {isExpanded && (
                    <tr className="bg-slate-50/80 border-y border-slate-200">
                      <td colSpan={displayCols.length + 5} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                              <Tag className="w-3.5 h-3.5 text-[#004BB7]" />
                              Формула назви Епіцентру
                            </span>
                            <div className="space-y-1 text-slate-600">
                              <div><strong>[UA]:</strong> {pRow.titleFormattedUa || pRow.updatedRow['Назва товару [ua]*']}</div>
                              <div><strong>[RU]:</strong> {pRow.titleFormattedRu || pRow.updatedRow['Назва товару [ru]*'] || '-'}</div>
                              <div><strong>Бренд:</strong> {pRow.brand || '-'} {pRow.isBrandOther && <span className="text-purple-600 font-bold">(Інше)</span>}</div>
                            </div>
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                              <Camera className="w-3.5 h-3.5 text-[#FF7A00]" />
                              Аналіз першого фото
                            </span>
                            <div className="space-y-1 text-slate-600">
                              <div><strong>Основний колір:</strong> {pRow.photoAnalysis?.primaryColor || 'Визначено за зображенням'}</div>
                              <div><strong>Колір виробника:</strong> {pRow.photoAnalysis?.manufacturerColor || '-'}</div>
                              <div><strong>Візерунок:</strong> {pRow.photoAnalysis?.patternType || 'без візерунка (однотонний)'}</div>
                            </div>
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Статус відповідності
                            </span>
                            <div className="space-y-1 text-slate-600">
                              <div><strong>Обов'язкових полів:</strong> {mandatoryCols.length}</div>
                              <div><strong>Порожніх полів:</strong> {pRow.unfilledRequiredFields.length > 0 ? <span className="text-rose-600 font-bold">{pRow.unfilledRequiredFields.length}</span> : <span className="text-emerald-600 font-bold">0 (Все заповнено)</span>}</div>
                              <div><strong>Мовних правок:</strong> {pRow.languageCorrections.length}</div>
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

      {/* Lightbox Modal for Photo preview */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="bg-white rounded-2xl p-4 max-w-lg w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <img
              src={selectedPhoto}
              alt="Збільшене фото товару"
              className="w-full h-auto rounded-xl object-contain max-h-[70vh]"
            />
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold text-slate-800">1-е фото товару (Аналіз кольору та візерунка)</span>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
