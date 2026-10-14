/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Book,
  CodeXml,
  Sparkles,
  CheckCircle,
  FileText,
  AlertCircle,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  Check,
  Share2,
  Users
} from 'lucide-react';
import { SAMPLE_CATEGORIES } from '../../data/sampleEpicentrCategories';
import { EpicentrColumn } from '../../types/epicentr';
import { analyzeEpicentrColumns, buildDictionaryIndex } from '../../services/epicentrEngine';

interface FileUploadSectionProps {
  onLoadTemplate: (
    data: Record<string, any>[],
    columns: EpicentrColumn[],
    rawWorkbook: XLSX.WorkBook | null,
    filename: string
  ) => void;
  onLoadDictionary: (rawDict: Record<string, string[]>, filename: string) => void;
  onLoadXml?: (xmlString: string, filename: string) => void;
  templateFileName: string | null;
  dictionaryFileName: string | null;
  xmlFileName: string | null;
  columns: EpicentrColumn[];
  rowCount: number;
  onProceedToClarification: () => void;
  onOpenShare?: () => void;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  onLoadTemplate,
  onLoadDictionary,
  onLoadXml,
  templateFileName,
  dictionaryFileName,
  xmlFileName,
  columns,
  rowCount,
  onProceedToClarification,
  onOpenShare
}) => {
  const [dragActiveTemplate, setDragActiveTemplate] = useState(false);
  const [dragActiveDict, setDragActiveDict] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('headphones');

  const templateInputRef = useRef<HTMLInputElement>(null);
  const dictInputRef = useRef<HTMLInputElement>(null);
  const xmlInputRef = useRef<HTMLInputElement>(null);

  // Handle template file upload
  const handleTemplateFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const wb = XLSX.read(buffer, { type: 'binary' } as any);
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

        if (jsonData.length > 0) {
          const rawHeaders = Object.keys(jsonData[0]);
          const analyzedCols = analyzeEpicentrColumns(rawHeaders);
          onLoadTemplate(jsonData, analyzedCols, wb, file.name);
        }
      } catch (err) {
        console.error('Error reading template Excel:', err);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Handle dictionary file upload
  const handleDictFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const wb = XLSX.read(buffer, { type: 'binary' });
        const dict: Record<string, string[]> = {};

        // In Epicentr dictionary files, sheets or columns represent attributes
        wb.SheetNames.forEach(sName => {
          const ws = wb.Sheets[sName];
          const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { header: 1 });
          if (rows.length > 0) {
            const firstRow = rows[0] as string[];
            if (Array.isArray(firstRow)) {
              firstRow.forEach((colHeader, cIdx) => {
                if (colHeader && typeof colHeader === 'string') {
                  const values: string[] = [];
                  for (let r = 1; r < rows.length; r++) {
                    const row = rows[r] as any[];
                    if (row && row[cIdx] !== undefined && row[cIdx] !== null && String(row[cIdx]).trim() !== '') {
                      values.push(String(row[cIdx]).trim());
                    }
                  }
                  if (values.length > 0) {
                    dict[colHeader] = values;
                  }
                }
              });
            }
          }
        });

        if (Object.keys(dict).length > 0) {
          onLoadDictionary(dict, file.name);
        }
      } catch (err) {
        console.error('Error reading dictionary Excel:', err);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Load sample category with 1 click
  const handleSelectSampleCategory = (catId: string) => {
    setSelectedSampleId(catId);
    const cat = SAMPLE_CATEGORIES.find(c => c.id === catId);
    if (!cat) return;

    const headers = Object.keys(cat.defaultData[0]);
    const analyzedCols = analyzeEpicentrColumns(headers);

    // Create a mock original workbook with comments
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(cat.defaultData);

    // Add Epicentr metadata comments to row 1
    analyzedCols.forEach((col, idx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
      if (ws[cellRef]) {
        ws[cellRef].c = [
          {
            a: 'EpicentrMarketplace',
            t: JSON.stringify({
              attributeCode: `ATTR_${idx + 100}`,
              attributeType: col.type,
              isRequired: col.isRequired
            })
          }
        ];
      }
    });
    XLSX.utils.book_append_sheet(wb, ws, cat.title.substring(0, 25));

    onLoadTemplate(cat.defaultData, analyzedCols, wb, `Шаблон_${cat.id}_Епіцентр.xlsx`);
    onLoadDictionary(cat.dictionaryData, `Довідник_${cat.id}_Офіційний.xlsx`);
  };

  const mandatoryCount = columns.filter(c => c.isRequired).length;
  const isReadyToProceed = rowCount > 0 && columns.length > 0;

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 via-[#0d2347] to-slate-900 border border-blue-500/30 p-6 md:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Офіційний алгоритм заповнення за стандартами Епіцентру
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Автоматизоване заповнення обов'язкових характеристик Excel
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Завантажте шаблон категорії та довідник значень. Агент проаналізує структуру, збереже оригінальні службові коментарі, визначить колір і візерунок за 1-м фото, заповнить виключно поля з зірочкою (<span className="text-amber-400 font-bold">*</span>) за довідником та сформує назви за регламентом контенту.
          </p>
        </div>

        {onOpenShare && (
          <div className="shrink-0 flex flex-col gap-2">
            <button
              type="button"
              onClick={onOpenShare}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all transform hover:scale-[1.02]"
            >
              <Share2 className="w-4 h-4" />
              <span>Надати доступ команді / клієнтам</span>
            </button>
            <span className="text-[11px] text-slate-400 text-center font-mono">
              Публічний онлайн-доступ 24/7
            </span>
          </div>
        )}
      </div>

      {/* 1-Click Sample Categories */}
      <div className="bg-[#0b1b36] border border-slate-800 rounded-2xl p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-400" />
              Швидкий запуск на офіційних категоріях Епіцентру
            </h3>
            <p className="text-xs text-slate-400">
              Виберіть готову категорію для тестування з вбудованим шаблоном і довідником
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SAMPLE_CATEGORIES.map(cat => {
            const isSelected = selectedSampleId === cat.id && templateFileName?.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleSelectSampleCategory(cat.id)}
                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-400 shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    {cat.badge}
                  </span>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                      <Check className="w-3.5 h-3.5" /> Завантажено
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-white text-sm group-hover:text-blue-300 transition-colors">
                  {cat.title}
                </h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {cat.description}
                </p>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-300 font-mono">
                  <span>{cat.productsCount} тестових товарів</span>
                  <span>•</span>
                  <span>З коментарями JSON</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload Dropzones (Custom Files) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Category Template */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActiveTemplate(true); }}
          onDragLeave={() => setDragActiveTemplate(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActiveTemplate(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleTemplateFile(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => templateInputRef.current?.click()}
          className={`p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center min-h-[190px] ${
            templateFileName
              ? 'bg-blue-950/30 border-blue-500/60 text-blue-200'
              : dragActiveTemplate
              ? 'bg-blue-600/20 border-blue-400 scale-[1.01]'
              : 'bg-[#0b1b36] border-slate-800 hover:border-slate-700'
          }`}
        >
          <input
            ref={templateInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleTemplateFile(e.target.files[0])}
          />
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <span className="font-bold text-white text-sm">1. Excel-шаблон категорії *</span>
          <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
            {templateFileName ? (
              <span className="text-emerald-400 font-medium flex items-center justify-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> {templateFileName}
              </span>
            ) : (
              'Перетягніть XLSX файл або виберіть на комп\'ютері'
            )}
          </p>
          <span className="mt-2 text-[10px] text-slate-500 uppercase font-mono tracking-wider">
            Обов'язковий файл
          </span>
        </div>

        {/* 2. Values Dictionary */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragActiveDict(true); }}
          onDragLeave={() => setDragActiveDict(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActiveDict(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleDictFile(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => dictInputRef.current?.click()}
          className={`p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center min-h-[190px] ${
            dictionaryFileName
              ? 'bg-blue-950/30 border-blue-500/60 text-blue-200'
              : dragActiveDict
              ? 'bg-blue-600/20 border-blue-400 scale-[1.01]'
              : 'bg-[#0b1b36] border-slate-800 hover:border-slate-700'
          }`}
        >
          <input
            ref={dictInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleDictFile(e.target.files[0])}
          />
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
            <Book className="w-6 h-6" />
          </div>
          <span className="font-bold text-white text-sm">2. Довідник значень *</span>
          <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
            {dictionaryFileName ? (
              <span className="text-emerald-400 font-medium flex items-center justify-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> {dictionaryFileName}
              </span>
            ) : (
              'Допустимі значення для атрибутів категорії'
            )}
          </p>
          <span className="mt-2 text-[10px] text-slate-500 uppercase font-mono tracking-wider">
            Обов'язковий файл
          </span>
        </div>

        {/* 3. XML Feed (Optional) */}
        <div
          onClick={() => xmlInputRef.current?.click()}
          className={`p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center min-h-[190px] ${
            xmlFileName
              ? 'bg-blue-950/30 border-blue-500/60 text-blue-200'
              : 'bg-[#0b1b36] border-slate-800 hover:border-slate-700'
          }`}
        >
          <input
            ref={xmlInputRef}
            type="file"
            accept=".xml"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                const file = e.target.files[0];
                const reader = new FileReader();
                reader.onload = (ev) => {
                  if (onLoadXml && ev.target?.result) {
                    onLoadXml(String(ev.target.result), file.name);
                  }
                };
                reader.readAsText(file);
              }
            }}
          />
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-3">
            <CodeXml className="w-6 h-6" />
          </div>
          <span className="font-bold text-white text-sm">3. XML фід товарів</span>
          <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
            {xmlFileName ? (
              <span className="text-emerald-400 font-medium flex items-center justify-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> {xmlFileName}
              </span>
            ) : (
              'Hotline, Price.ua або Prom XML (додаткове джерело даних)'
            )}
          </p>
          <span className="mt-2 text-[10px] text-slate-500 uppercase font-mono tracking-wider">
            Опціонально
          </span>
        </div>
      </div>

      {/* Template Inspection & Readiness Banner */}
      {isReadyToProceed && (
        <div className="bg-[#0e2142] border border-blue-500/40 rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-base">
                Шаблон готовий до аналізу та заповнення
              </h4>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-300">
                <span className="px-2 py-0.5 rounded bg-blue-900/60 border border-blue-700/50">
                  {rowCount} товарів
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-900/60 border border-blue-700/50">
                  {columns.length} колонок
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-900/40 border border-amber-600/40 text-amber-300 font-semibold">
                  {mandatoryCount} обов'язкових (*)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-900/40 border border-emerald-600/40 text-emerald-300 font-semibold">
                  ID та службові коментарі захищено
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-600/40 text-blue-300 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Автозбереження: активне
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onProceedToClarification}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] shrink-0"
          >
            <span>Перейти до Кроку 0 (Уточнення та Запуск)</span>
            <ArrowRight className="w-4 h-4 text-slate-950" />
          </button>
        </div>
      )}
    </div>
  );
};
