import { useState } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  Calendar,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { downloadExcelTemplate } from '../../services/merchantDataParser.ts';

interface MerchantHeaderProps {
  onOpenUploadModal: () => void;
  onResetToSample: () => void;
  onOpenSyncModal: () => void;
  totalMerchantsCount: number;
  lastSyncDate: string;
  sourceLabel: string;
}

export function MerchantHeader({
  onOpenUploadModal,
  onResetToSample,
  onOpenSyncModal,
  totalMerchantsCount,
  lastSyncDate,
  sourceLabel
}: MerchantHeaderProps) {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadTemplate = () => {
    downloadExcelTemplate();
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 lg:px-6 py-4">
      <div className="max-w-[1600px] mx-auto flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        {/* Brand & Context */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-emerald-400 p-[1.5px] shadow-lg shadow-sky-950/40 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Layers className="w-5 h-5 text-sky-400" />
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                Активність нових мерчантів на маркетплейсі
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 text-[11px] font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Оновлення: 1 раз на добу
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Онбординг, швидкість перших дій (Time-to-Action), створення та публікація товарів, перші замовлення й відтік
            </p>
          </div>
        </div>

        {/* Sync Status Badge & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Daily Sync Indicator */}
          <button
            onClick={onOpenSyncModal}
            title="Налаштувати щоденне оновлення"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white text-xs transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <div className="flex flex-col text-left font-mono text-[11px]">
              <span className="text-[10px] text-slate-400">Зріз: {sourceLabel}</span>
              <span className="text-slate-200 font-semibold">{lastSyncDate}</span>
            </div>
          </button>

          {/* Download Template Button */}
          <button
            onClick={handleDownloadTemplate}
            title="Завантажити зразок Excel файлу з правильними стовпчиками для Power BI"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition-colors"
          >
            {downloadSuccess ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{downloadSuccess ? 'Завантажено!' : 'Шаблон для Power BI'}</span>
          </button>

          {/* Reset to Sample Button */}
          <button
            onClick={onResetToSample}
            title="Завантажити реалістичний тестовий набір даних"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80 transition-colors"
          >
            <RefreshCw className="w-3 h-3 text-slate-400" />
            <span>Демо-дані</span>
          </button>

          {/* Upload Excel Button (Primary) */}
          <button
            onClick={onOpenUploadModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-950/40 transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Завантажити Excel з Power BI</span>
          </button>
        </div>
      </div>
    </header>
  );
}
