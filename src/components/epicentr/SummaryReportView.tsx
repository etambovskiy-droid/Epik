/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Tag,
  Languages,
  ShieldCheck,
  HelpCircle,
  ArrowRight,
  Sparkles,
  BarChart3,
  Percent,
  Bug,
  Copy,
  Check,
  Globe
} from 'lucide-react';
import {
  ProcessingReportSummary,
  EpicentrProductRow,
  EpicentrColumn,
  EpicentrDictionaryAttribute
} from '../../types/epicentr';
import { generateEpicentrExportWorkbook } from '../../services/epicentrEngine';

interface SummaryReportViewProps {
  report: ProcessingReportSummary;
  processedRows: EpicentrProductRow[];
  columns: EpicentrColumn[];
  rawWorkbook: XLSX.WorkBook | null;
  originalFileName: string | null;
  dictionaryIndex?: Record<string, EpicentrDictionaryAttribute>;
  onViewTable: () => void;
  onViewErrors?: () => void;
}

export const SummaryReportView: React.FC<SummaryReportViewProps> = ({
  report,
  processedRows,
  columns,
  rawWorkbook,
  originalFileName,
  dictionaryIndex,
  onViewTable,
  onViewErrors
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Download filled Excel workbook
  const handleDownload = () => {
    try {
      const exportWb = generateEpicentrExportWorkbook(rawWorkbook, processedRows, columns, dictionaryIndex);
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

  // Copy quick summary to clipboard
  const handleCopySummary = () => {
    const text = `Звіт заповнення характеристик Епіцентр:
- Товарів: ${report.totalProducts}
- Заповненість обов'язкових полів: ${report.fillRatePercentage}%
- Додано нових значень: +${report.newlyFilledCount}
- Порожніх обов'язкових полів: ${report.unfilledMandatoryCount}
- Бренди "Інше": ${report.brandsMarkedOther.length}
- Мовні нормалізації: ${report.languageFixes.length}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Download & Quick Export Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#004BB7] via-[#10B981] to-[#FF7A00]" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold mb-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Шаблон успішно заповнено за стандартами маркетплейсу Епіцентр
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Заповнений Excel готовий до експорту
            </h2>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Оригінальні службові коментарі (JSON-метадані) повністю збережено в рядку заголовків. Колонку ID не змінювали. Поля з зірочкою (<span className="text-[#FF7A00] font-bold">*</span>) заповнено виключно згідно з довідником та аналізом 1-го фото.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#004BB7] to-[#003d99] hover:from-[#0055cf] hover:to-[#004bb7] text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01] cursor-pointer"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Файл збережено!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Завантажити Excel (.xlsx)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onViewTable}
              className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm border border-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#004BB7]" />
              <span>Таблиця результатів</span>
            </button>

            {onViewErrors && (
              <button
                type="button"
                onClick={onViewErrors}
                className="px-3.5 py-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium text-sm border border-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Переглянути технічні деталі збоїв"
              >
                <Bug className="w-4 h-4 text-[#FF7A00]" />
                <span>Збої ({report.errors?.length || 0})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopySummary}
              className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-300 transition-colors cursor-pointer"
              title="Скопіювати короткий звіт"
            >
              {copiedSuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Products */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">Оброблено товарів</span>
            <FileSpreadsheet className="w-4 h-4 text-[#004BB7]" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {report.totalProducts}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {report.mandatoryColumnsCount} обов'язкових колонок (*)
          </div>
        </div>

        {/* Newly Filled */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">Заповнено полів (*)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">
            +{report.newlyFilledCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            {report.alreadyFilledCount} вже було в шаблоні
          </div>
        </div>

        {/* Fill Rate */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">Загальна заповненість</span>
            <Percent className="w-4 h-4 text-[#FF7A00]" />
          </div>
          <div className="text-2xl font-black text-[#d96500]">
            {report.fillRatePercentage}%
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#FF7A00] to-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, report.fillRatePercentage))}%` }}
            />
          </div>
        </div>

        {/* Brands set to Other */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span className="font-semibold">Бренд "Інше"</span>
            <Tag className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700">
            {report.brandsMarkedOther.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 font-mono">
            За правилами Епіцентру
          </div>
        </div>
      </div>

      {/* Breakdown Section: Unfilled Mandatory Fields & Why */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-[#FF7A00]">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Обов'язкові поля, які залишились порожніми ({report.unfilledMandatoryCount})
              </h3>
              <p className="text-xs text-slate-500">
                Суворий регламент контенту Епіцентру: «Немає впевненості → поле порожнє. Не заповнювати приблизними значеннями»
              </p>
            </div>
          </div>
        </div>

        {report.unfilledFieldsBreakdown.length > 0 ? (
          <div className="space-y-3">
            {/* Google Search Grounding research recommendation banner */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50/70 to-sky-50 border border-blue-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#004BB7] text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    Пошуковий розшук характеристик (Google Search Grounding)
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">Gemini 3.8 Flash</span>
                  </div>
                  <p className="text-slate-600 mt-1">
                    Інформація про розміри упаковки, вагу, вік, стать чи кількість гравців відсутня у вашому файлі? Запустіть розшук у Google: модель знайде технічні специфікації в інтернеті та зіставить їх із довідником Епіцентру.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onViewTable}
                className="px-4 py-2 bg-[#004BB7] hover:bg-[#003d99] text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Розшукати у таблиці</span>
              </button>
            </div>

            {report.unfilledFieldsBreakdown.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {item.columnName}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[#d96500] text-[10px] font-bold">
                      {item.unfilledCount} товарів
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1">
                    {item.reason}
                  </p>
                </div>

                <div className="text-slate-500 text-[11px] font-mono shrink-0">
                  ID: {item.affectedProductIds.slice(0, 3).join(', ')}
                  {item.affectedProductIds.length > 3 && ` +${item.affectedProductIds.length - 3}`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">Всі обов'язкові поля для всіх товарів успішно заповнені згідно з довідником!</span>
          </div>
        )}
      </div>

      {/* Brands Marked as "Інше" Report */}
      {report.brandsMarkedOther.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Повідомлення про бренди, встановлені як "Інше" ({report.brandsMarkedOther.length})
              </h3>
              <p className="text-xs text-slate-500">
                За регламентом Епіцентру: якщо точний бренд відсутній у довіднику значень категорії, призначається "Інше"
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {report.brandsMarkedOther.map((b, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-800">{b.title}</div>
                  <div className="text-[10px] font-mono text-purple-700">ID: {b.productId}</div>
                </div>
                <span className="px-2.5 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 font-bold text-[11px]">
                  Інше
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Language Corrections Report */}
      {report.languageFixes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-[#004BB7]">
              <Languages className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Виправлення мовної відповідності колонок [ua] / [ru] ({report.languageFixes.length})
              </h3>
              <p className="text-xs text-slate-500">
                Текст перевірено та синхронізовано згідно з мовним маркером стовпчика
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {report.languageFixes.map((lf, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[#004BB7] font-bold">{lf.columnName}</span>
                  <span className="text-slate-500 ml-2 font-mono">(ID: {lf.productId})</span>
                  <div className="text-slate-600 mt-0.5">
                    Було: <span className="line-through text-slate-400">{lf.oldText}</span> → Стало: <span className="text-emerald-700 font-bold">{lf.newText}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-blue-100 border border-blue-200 text-[#004BB7] text-[10px] font-bold shrink-0">
                  {lf.direction}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
