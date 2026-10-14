/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  HelpCircle,
  CheckCircle,
  XCircle,
  Sparkles,
  Languages,
  Eye,
  Search,
  Tag,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { ProcessSettings } from '../../types/epicentr';

interface StepZeroClarificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProcessSettings;
  onUpdateSettings: (settings: ProcessSettings) => void;
  onConfirmAndRun: () => void;
  productsCount: number;
}

export const StepZeroClarificationModal: React.FC<StepZeroClarificationModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onConfirmAndRun,
  productsCount
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0b1b36] border border-blue-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl shadow-blue-950/60 overflow-hidden relative">
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-start gap-4 mb-5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-amber-400">
                Крок 0 — Обов'язкове уточнення перед формуванням файлу
              </span>
            </div>
            <h3 className="text-xl font-bold text-white mt-1">
              Чи потрібно переформатувати назви товарів відповідно до вимог контенту Епіцентру (UA + RU)?
            </h3>
            <p className="text-sm text-slate-300 mt-1">
              Офіційна формула Епіцентру: <span className="text-blue-300 font-mono text-xs">Тип товару + Особливість + Бренд + Модель + Характеристики + Колір + (Артикул)</span> (до 150 символів, колір за 1-м фото, без капслоку).
            </p>
          </div>
        </div>

        {/* Binary Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, reformatTitles: true })}
            className={`p-4 rounded-xl border text-left transition-all ${
              settings.reformatTitles
                ? 'bg-blue-600/20 border-blue-400 shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                : 'bg-slate-900/40 border-slate-700/60 hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white flex items-center gap-2">
                <CheckCircle className={`w-4 h-4 ${settings.reformatTitles ? 'text-blue-400' : 'text-slate-500'}`} />
                Так, переформатувати
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Рекомендовано
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Генерувати ідеальні назви [ua] та [ru] за 7-компонентною формулою, фільтрувати заборонені слова (Акція, Original) та приводити розміри до формату 60х60 см.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, reformatTitles: false })}
            className={`p-4 rounded-xl border text-left transition-all ${
              !settings.reformatTitles
                ? 'bg-blue-600/20 border-blue-400 shadow-md shadow-blue-500/20 ring-1 ring-blue-400'
                : 'bg-slate-900/40 border-slate-700/60 hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white flex items-center gap-2">
                <XCircle className={`w-4 h-4 ${!settings.reformatTitles ? 'text-amber-400' : 'text-slate-500'}`} />
                Ні, залишити оригінальні
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Зберегти оригінальні назви товарів як є в шаблоні, перевіряючи лише обов'язкові колонки характеристик (*).
            </p>
          </button>
        </div>

        {/* Additional Quality Assurance Settings */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 mb-6 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Додаткові правила обробки шаблону
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Lang auto fix */}
            <label className="flex items-start gap-2.5 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={settings.autoFixLanguages}
                onChange={(e) => onUpdateSettings({ ...settings, autoFixLanguages: e.target.checked })}
                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
              />
              <div>
                <span className="font-medium text-white flex items-center gap-1">
                  <Languages className="w-3 h-3 text-blue-400" />
                  Мовна відповідність [ua] / [ru]
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Авто-виправлення, якщо в [ru] стовпчику український текст і навпаки
                </span>
              </div>
            </label>

            {/* Photo priority */}
            <label className="flex items-start gap-2.5 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={settings.photoFirstPriority}
                onChange={(e) => onUpdateSettings({ ...settings, photoFirstPriority: e.target.checked })}
                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
              />
              <div>
                <span className="font-medium text-white flex items-center gap-1">
                  <Eye className="w-3 h-3 text-amber-400" />
                  Пріоритет 1-го фото товару
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Колір та візерунок визначати виключно з першого посилання фото
                </span>
              </div>
            </label>

            {/* Brand other fallback */}
            <label className="flex items-start gap-2.5 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={settings.brandFallbackOther}
                onChange={(e) => onUpdateSettings({ ...settings, brandFallbackOther: e.target.checked })}
                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
              />
              <div>
                <span className="font-medium text-white flex items-center gap-1">
                  <Tag className="w-3 h-3 text-purple-400" />
                  Бренд "Інше" при відсутності
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Якщо бренд не знайдено у довіднику — призначати "Інше" зі звітом
                </span>
              </div>
            </label>

            {/* Web search */}
            <label className="flex items-start gap-2.5 cursor-pointer text-slate-200">
              <input
                type="checkbox"
                checked={settings.enableWebSearch}
                onChange={(e) => onUpdateSettings({ ...settings, enableWebSearch: e.target.checked })}
                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-blue-500 focus:ring-0"
              />
              <div>
                <span className="font-medium text-white flex items-center gap-1">
                  <Search className="w-3 h-3 text-emerald-400" />
                  Пошук в інтернет-каталогах
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Шукати артикул на Rozetka/Prom/сайті виробника для обов'язкових полів
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Protection Notice */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs mb-6">
          <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Гарантія безпеки імпорту:</strong> Колонку ID не буде змінено. Заповнені поля не чіпатимуться. Коментарі заголовків та кодування HTML (<code>&#039;</code>) буде повністю збережено!
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
          >
            Назад до файлів
          </button>
          <button
            type="button"
            onClick={onConfirmAndRun}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all transform hover:scale-[1.02]"
          >
            <span>Запустити заповнення ({productsCount} товарів)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
