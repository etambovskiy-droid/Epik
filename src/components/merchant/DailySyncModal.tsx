import { useState } from 'react';
import {
  X,
  Clock,
  Calendar,
  CheckCircle2,
  RefreshCw,
  FileSpreadsheet,
  Zap,
  Info
} from 'lucide-react';
import { DailySyncConfig } from '../../types/merchant.ts';

interface DailySyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: DailySyncConfig;
  onSaveConfig: (cfg: DailySyncConfig) => void;
}

export function DailySyncModal({
  isOpen,
  onClose,
  config,
  onSaveConfig
}: DailySyncModalProps) {
  const [dailyTime, setDailyTime] = useState(config.dailyTime || '06:00');
  const [savedToast, setSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    const updated: DailySyncConfig = {
      ...config,
      dailyTime,
      lastSyncDate: new Date().toLocaleString('uk-UA'),
      nextSyncDate: new Date(Date.now() + 24 * 3600 * 1000).toLocaleDateString('uk-UA') + ` ${dailyTime}`
    };
    onSaveConfig(updated);
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Режим щоденного оновлення</h3>
              <p className="text-xs text-slate-400">Налаштування регулярного зрізу даних (1 раз на добу)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-slate-300">
          {/* Status Box */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">Поточне джерело:</span>
              <span className="text-sky-300 font-semibold">{config.sourceType}</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">Останній зріз:</span>
              <span className="text-slate-200">{config.lastSyncDate}</span>
            </div>
            <div className="flex items-center justify-between font-mono">
              <span className="text-slate-400">Наступне оновлення:</span>
              <span className="text-emerald-400 font-semibold">{config.nextSyncDate}</span>
            </div>
          </div>

          {/* Sync Time Picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-200">
              Бажаний час щоденної фіксації зрізу (за Києвом):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={dailyTime}
                onChange={(e) => setDailyTime(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
              />
              <span className="text-[11px] text-slate-400">
                (Зазвичай після нічного перерахунку ETL у Power BI)
              </span>
            </div>
          </div>

          {/* How Power BI Daily Sync works */}
          <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-800/40 space-y-2 text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-sky-300">
              <Info className="w-4 h-4 text-sky-400" />
              <span>Як налаштувати щоденну передачу з Power BI:</span>
            </div>
            <ul className="space-y-1.5 list-disc pl-5 text-[11px] text-slate-400">
              <li>
                <strong className="text-slate-200">Варіант A (Найпростіший):</strong> Щоранку експортуйте свій звіт з Power BI та перетягуйте в дашборд. Дашборд автоматично зберігає новий зріз.
              </li>
              <li>
                <strong className="text-slate-200">Варіант B (Power BI Paginated Report / Power Automate):</strong> Налаштуйте в Power BI щоденну відправку Excel файлу на пошту або збереження в папку для швидкого імпорту.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800/80 bg-slate-950/70">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Закрити
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer shadow-lg shadow-emerald-950/40 transition-all"
          >
            {savedToast ? <CheckCircle2 className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            <span>{savedToast ? 'Збережено!' : 'Зберегти розклад'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
