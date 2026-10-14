import { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileCheck,
  Download,
  Sparkles,
  Layers,
  BarChart2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MerchantRecord } from '../../types/merchant.ts';
import { DynamicDashboard } from '../../types/dynamicDashboard.ts';
import { parseExcelOrCsvFile, downloadExcelTemplate } from '../../services/merchantDataParser.ts';
import { analyzeDataset } from '../../services/schemaAnalyzer.ts';

interface ExcelUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (merchants: MerchantRecord[], fileName: string) => void;
  onDynamicDashboardCreated: (dashboard: DynamicDashboard) => void;
}

export function ExcelUploadModal({
  isOpen,
  onClose,
  onDataLoaded,
  onDynamicDashboardCreated
}: ExcelUploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzedDash, setAnalyzedDash] = useState<DynamicDashboard | null>(null);
  const [merchantRecords, setMerchantRecords] = useState<MerchantRecord[] | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = async (file: File) => {
    setError(null);
    setIsLoading(true);
    setFileName(file.name);
    setAnalyzedDash(null);
    setMerchantRecords(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

      if (!jsonRows || jsonRows.length === 0) {
        throw new Error('Файл не містить рядків або таблиця порожня.');
      }

      // Analyze dataset dynamically
      const dynamicResult = analyzeDataset(jsonRows, file.name);
      setAnalyzedDash(dynamicResult);

      // Check if it can also parse into MerchantRecords
      try {
        const records = await parseExcelOrCsvFile(file);
        if (records && records.length > 0) {
          setMerchantRecords(records);
        }
      } catch {
        // Not a merchant record file, which is fine - it's a generic Power BI dataset!
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Не вдалося розпізнати файл Excel/CSV. Перевірте формат або завантажте шаблон.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleConfirm = () => {
    if (analyzedDash) {
      // Create new dynamic dashboard
      onDynamicDashboardCreated(analyzedDash);

      // If merchant records exist, update them too
      if (merchantRecords && merchantRecords.length > 0) {
        onDataLoaded(merchantRecords, fileName);
      }

      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#0b1b3d] border border-blue-900/70 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900/60 bg-[#08142c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#004BB7] flex items-center justify-center text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Імпорт експорту з Power BI</h3>
              <p className="text-xs text-blue-300">
                Автоматичне створення нового дашборду на основі будь-якого звіту Power BI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-blue-950 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-[#FF7A00] bg-orange-950/20 ring-2 ring-orange-500/30'
                : 'border-blue-900/80 hover:border-blue-700 bg-[#08142c]/70 hover:bg-[#08142c]'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files?.[0]) handleProcessFile(e.target.files[0]);
              }}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#004BB7]/30 border border-blue-600/40 flex items-center justify-center text-[#FF7A00]">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  Перетягніть сюди експорт з Power BI (.xlsx, .xls або .csv)
                </p>
                <p className="text-xs text-blue-300 mt-1">
                  Система автоматично визначить структуру колонок і створить новий дашборд
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Підтримуються будь-які таблиці: онбординг, продажі, замовлення, залишки, логістика тощо
              </span>
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="p-4 rounded-xl bg-[#08142c] border border-blue-900/60 text-center text-xs text-blue-300 font-mono flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-[#FF7A00] border-t-transparent animate-spin" />
              <span>Аналізуємо структуру стовпчиків та генеруємо аналітичну панель...</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold">Помилка розпізнавання файлу</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Analyzed Dashboard Preview */}
          {analyzedDash && (
            <div className="space-y-4 p-4 rounded-2xl bg-[#08142c] border border-blue-900/70">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-blue-900/40">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Розпізнано: {analyzedDash.recordCount} рядків &bull; {analyzedDash.columns.length} колонок</span>
                </div>
                <span className="text-[11px] font-mono text-[#FF7A00] bg-orange-950/50 border border-orange-800/40 px-2 py-0.5 rounded">
                  {analyzedDash.detectedType === 'merchant_funnel'
                    ? 'Тип: Активність та онбординг мерчантів'
                    : analyzedDash.detectedType === 'sales_orders'
                    ? 'Тип: Продажі та замовлення маркетплейсу'
                    : 'Тип: Користувацький звіт Power BI'}
                </span>
              </div>

              {/* Detected Columns Grid */}
              <div>
                <div className="text-[11px] font-semibold text-blue-300 mb-2">
                  Розпізнані колонки та типи даних:
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {analyzedDash.columns.map((c) => (
                    <span
                      key={c.key}
                      className="px-2 py-1 rounded-lg text-[10px] font-mono bg-[#0b1b3d] border border-blue-900/80 text-slate-200 flex items-center gap-1.5"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        c.type === 'number' ? 'bg-emerald-400' :
                        c.type === 'date' ? 'bg-amber-400' :
                        c.type === 'category' ? 'bg-[#FF7A00]' : 'bg-blue-400'
                      }`} />
                      <strong className="text-white">{c.label}</strong>
                      <span className="text-slate-400">({c.type})</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Sample Data Table Preview */}
              <div className="overflow-x-auto rounded-xl border border-blue-900/60 max-h-44 bg-[#050e20]">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-blue-900/60 text-blue-300 text-[11px] bg-[#071329]">
                      {analyzedDash.columns.slice(0, 7).map((col) => (
                        <th key={col.key} className="p-2.5 font-semibold whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-950/60">
                    {analyzedDash.data.slice(0, 3).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-blue-950/20">
                        {analyzedDash.columns.slice(0, 7).map((col) => (
                          <td key={col.key} className="p-2.5 text-slate-300 whitespace-nowrap">
                            {String(row[col.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quick Help: Column Names for Merchant Funnel */}
          <div className="p-3.5 rounded-xl bg-[#08142c]/50 border border-blue-900/40 text-xs space-y-2">
            <div className="flex items-center justify-between text-blue-200 font-semibold">
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-[#FF7A00]" />
                Підказка для користувачів Power BI:
              </span>
              <button
                onClick={downloadExcelTemplate}
                className="text-[#FF7A00] hover:underline text-[11px] flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Завантажити готовий шаблон (.xlsx)
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Ви можете завантажити як звіт активності мерчантів, так і <strong>будь-який інший звіт з Power BI</strong> (продажі, залишки, трафік, фінанси). SaaS платформа автоматично згенерує окрему вкладку з графіками та аналітикою під кожен завантажений файл!
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-blue-900/60 bg-[#08142c]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Скасувати
          </button>
          <button
            disabled={!analyzedDash}
            onClick={handleConfirm}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              analyzedDash
                ? 'bg-[#FF7A00] hover:bg-[#ff8a1a] text-white cursor-pointer shadow-lg shadow-orange-950/50'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Автоматично створити дашборд ({analyzedDash?.recordCount || 0} рядків)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
