/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
  Bug
} from 'lucide-react';
import {
  ProcessingReportSummary,
  EpicentrProductRow,
  EpicentrColumn
} from '../../types/epicentr';
import { generateEpicentrExportWorkbook } from '../../services/epicentrEngine';

interface SummaryReportViewProps {
  report: ProcessingReportSummary;
  processedRows: EpicentrProductRow[];
  columns: EpicentrColumn[];
  rawWorkbook: XLSX.WorkBook | null;
  originalFileName: string | null;
  onViewTable: () => void;
  onViewErrors?: () => void;
}

export const SummaryReportView: React.FC<SummaryReportViewProps> = ({
  report,
  processedRows,
  columns,
  rawWorkbook,
  originalFileName,
  onViewTable,
  onViewErrors
}) => {
  // Download filled Excel workbook
  const handleDownload = () => {
    try {
      const exportWb = generateEpicentrExportWorkbook(rawWorkbook, processedRows, columns);
      const outName = originalFileName
        ? `Заповнено_${originalFileName.replace(/\.(xlsx|xls|csv)$/i, '')}.xlsx`
        : 'Епіцентр_Шаблон_Заповнено.xlsx';

      XLSX.writeFile(exportWb, outName);
    } catch (err) {
      console.error('Failed to export Excel file:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Download Action */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-950 via-[#0d3326] to-slate-900 border border-emerald-500/40 p-6 md:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-3">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Шаблон успішно оброблено за стандартами Епіцентру
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Заповнений Excel готовий до імпорту
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Оригінальні коментарі до комірок заголовків (JSON з кодами атрибутів) повністю збережено. Колонку ID не змінювали. Поля з `*` заповнено відповідно до довідника.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition-all transform hover:scale-[1.02]"
            >
              <Download className="w-5 h-5" />
              <span>Завантажити заповнений Excel</span>
            </button>

            <button
              type="button"
              onClick={onViewTable}
              className="px-5 py-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-white font-medium text-sm border border-slate-700 flex items-center justify-center gap-2 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-400" />
              <span>Переглянути таблицю</span>
            </button>

            {onViewErrors && (
              <button
                type="button"
                onClick={onViewErrors}
                className="px-4 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 text-slate-200 font-medium text-sm border border-slate-700 flex items-center justify-center gap-2 transition-colors"
                title="Переглянути технічні деталі збоїв"
              >
                <Bug className="w-4 h-4 text-amber-400" />
                <span>Моніторинг помилок ({report.errors?.length || 0})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Products */}
        <div className="bg-[#0b1b36] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Оброблено товарів</span>
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {report.totalProducts}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {report.mandatoryColumnsCount} обов'язкових колонок (*)
          </div>
        </div>

        {/* Newly Filled */}
        <div className="bg-[#0b1b36] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Заповнено полів (*)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">
            +{report.newlyFilledCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {report.alreadyFilledCount} вже було заповнено
          </div>
        </div>

        {/* Fill Rate */}
        <div className="bg-[#0b1b36] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Загальна заповненість</span>
            <Percent className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300">
            {report.fillRatePercentage}%
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {report.alreadyFilledCount + report.newlyFilledCount} з {report.totalMandatoryFields} обов'язкових
          </div>
        </div>

        {/* Brands set to Other */}
        <div className="bg-[#0b1b36] border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Бренд "Інше"</span>
            <Tag className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-300">
            {report.brandsMarkedOther.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Відсутні у довіднику бренди
          </div>
        </div>
      </div>

      {/* Breakdown Section: Unfilled Mandatory Fields & Why */}
      <div className="bg-[#0b1b36] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Обов'язкові поля, які залишились порожніми ({report.unfilledMandatoryCount})
              </h3>
              <p className="text-xs text-slate-400">
                Суворий регламент Епіцентру: «Впевненості немає → поле порожнє. Ніколи не заповнюй приблизними значеннями»
              </p>
            </div>
          </div>
        </div>

        {report.unfilledFieldsBreakdown.length > 0 ? (
          <div className="space-y-2.5">
            {report.unfilledFieldsBreakdown.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-300 text-sm">
                      {item.columnName}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-950/50 border border-amber-700/50 text-amber-400 text-[10px] font-mono">
                      {item.unfilledCount} товарів
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1">
                    {item.reason}
                  </p>
                </div>

                <div className="text-slate-400 text-[11px] font-mono shrink-0">
                  ID: {item.affectedProductIds.slice(0, 3).join(', ')}
                  {item.affectedProductIds.length > 3 && ` +${item.affectedProductIds.length - 3}`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Всі обов'язкові поля для всіх товарів успішно заповнені!</span>
          </div>
        )}
      </div>

      {/* Brands Marked as "Інше" Report */}
      {report.brandsMarkedOther.length > 0 && (
        <div className="bg-[#0b1b36] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Повідомлення про бренди, встановлені як "Інше" ({report.brandsMarkedOther.length})
              </h3>
              <p className="text-xs text-slate-400">
                За правилом Епіцентру: якщо точний бренд відсутній у довіднику значень категорії, призначається "Інше"
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {report.brandsMarkedOther.map((b, idx) => (
              <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-200">{b.title}</div>
                  <div className="text-[10px] font-mono text-purple-400">ID: {b.productId}</div>
                </div>
                <span className="px-2.5 py-1 rounded bg-purple-950/60 border border-purple-700/60 text-purple-300 font-bold">
                  Інше
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Language Corrections Report */}
      {report.languageFixes.length > 0 && (
        <div className="bg-[#0b1b36] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Languages className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Виправлення мовної відповідності колонок [ua] / [ru] ({report.languageFixes.length})
              </h3>
              <p className="text-xs text-slate-400">
                Текст перекладено відповідно до мовного тегу в назві стовпчика
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {report.languageFixes.map((lf, idx) => (
              <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-indigo-400 font-semibold">{lf.columnName}</span>
                  <span className="text-slate-400 ml-2 font-mono">(ID: {lf.productId})</span>
                  <div className="text-slate-300 mt-0.5">
                    Було: <span className="line-through text-slate-500">{lf.oldText}</span> → Стало: <span className="text-emerald-300 font-medium">{lf.newText}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-950/50 border border-indigo-700/50 text-indigo-300 text-[10px] shrink-0">
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
