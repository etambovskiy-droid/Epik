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
  ShieldAlert,
  X
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden relative text-slate-800">
        
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#FF7A00] shrink-0">
              <HelpCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#d96500]">
                Крок 0 — Обов'язкове уточнення перед формуванням файлу
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                Чи потрібно переформатувати назви товарів відповідно до вимог контенту Епіцентру (UA + RU)?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Офіційна формула Епіцентру: <span className="text-[#004BB7] font-mono text-[11px] font-semibold">Тип товару + Особливість + Бренд + Модель + Характеристики + Колір + (Артикул)</span> (до 150 симв., без капслоку).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Binary Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, reformatTitles: true })}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              settings.reformatTitles
                ? 'bg-blue-50/70 border-[#004BB7] shadow-sm ring-1 ring-[#004BB7]'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                <CheckCircle className={`w-4 h-4 ${settings.reformatTitles ? 'text-[#004BB7]' : 'text-slate-400'}`} />
                Так, переформатувати
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Рекомендовано
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Генерувати назви [ua] та [ru] за офіційною формулою маркетплейсу, фільтрувати заборонені слова (Акція, Original) та приводити розміри до формату 60х60 см.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSettings({ ...settings, reformatTitles: false })}
            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
              !settings.reformatTitles
                ? 'bg-blue-50/70 border-[#004BB7] shadow-sm ring-1 ring-[#004BB7]'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                <XCircle className={`w-4 h-4 ${!settings.reformatTitles ? 'text-[#FF7A00]' : 'text-slate-400'}`} />
                Ні, залишити оригінальні
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Зберегти оригінальні назви як є в шаблоні, заповнюючи лише обов'язкові колонки характеристик (*).
            </p>
          </button>
        </div>

        {/* Additional Rules */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FF7A00]" />
            Додаткові правила заповнення шаблону
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={settings.autoFixLanguages}
                onChange={(e) => onUpdateSettings({ ...settings, autoFixLanguages: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-[#004BB7] focus:ring-0"
              />
              <div>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Languages className="w-3 h-3 text-[#004BB7]" />
                  Мовна відповідність [ua] / [ru]
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Авто-виправлення мовного тегу колонок
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={settings.photoFirstPriority}
                onChange={(e) => onUpdateSettings({ ...settings, photoFirstPriority: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-[#004BB7] focus:ring-0"
              />
              <div>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Eye className="w-3 h-3 text-[#FF7A00]" />
                  Пріоритет 1-го фото товару
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Колір та візерунок визначати з першого фото
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={settings.brandFallbackOther}
                onChange={(e) => onUpdateSettings({ ...settings, brandFallbackOther: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-[#004BB7] focus:ring-0"
              />
              <div>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-purple-600" />
                  Бренд "Інше" при відсутності
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Призначати "Інше" якщо бренд не в довіднику
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={settings.enableWebSearch}
                onChange={(e) => onUpdateSettings({ ...settings, enableWebSearch: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-[#004BB7] focus:ring-0"
              />
              <div>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <Search className="w-3 h-3 text-emerald-600" />
                  Пошук в каталогах
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Звірка обов'язкових полів за артикулом
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Protection Notice */}
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs mb-5">
          <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Гарантія безпеки імпорту:</strong> Колонку ID не буде змінено. Заповнені поля не чіпатимуться. Коментарі заголовків та кодування HTML (<code>&#039;</code>) буде повністю збережено!
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            Назад до файлів
          </button>
          <button
            type="button"
            onClick={onConfirmAndRun}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FF7A00] to-[#ea580c] hover:from-[#ff8a1a] hover:to-[#d94e07] text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all transform hover:scale-[1.01] cursor-pointer"
          >
            <span>Запустити заповнення ({productsCount} товарів)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
