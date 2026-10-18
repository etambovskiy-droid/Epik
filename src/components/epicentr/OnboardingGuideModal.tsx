/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  FileSpreadsheet,
  Camera,
  CheckCircle2,
  Download,
  ArrowRight,
  ShieldCheck,
  BookOpen,
  Sparkles,
  HelpCircle
} from 'lucide-react';

interface OnboardingGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSampleCategory?: (categoryId: string) => void;
}

export const OnboardingGuideModal: React.FC<OnboardingGuideModalProps> = ({
  isOpen,
  onClose,
  onSelectSampleCategory
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#FF7A00]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Швидкий старт для мерчантів Епіцентру</h3>
              <p className="text-xs text-slate-500">
                Як підготувати товарний шаблон для імпорту в кабінет селера за 3 кроки
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Step Cards */}
        <div className="p-6 space-y-3.5 text-xs">
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#004BB7] font-bold flex items-center justify-center shrink-0 text-sm">
              1
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                Завантажте шаблон та фото або виберіть демо
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Експортуйте файл категорії з кабінету селера Епіцентру або натисніть будь-яку з готових категорій («Бездротові навушники», «Розумні годинники», «Електроінструмент»). Перетягніть Excel-шаблон та фото товарів у зону завантаження.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-[#FF7A00] font-bold flex items-center justify-center shrink-0 text-sm">
              2
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                Уточніть правила контенту та запустіть алгоритм
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Алгоритм проаналізує перше фото товару (колір, візерунок), опис та довідник значень, заповнюючи виключно обов'язкові поля з зірочкою (<span className="text-[#FF7A00] font-bold">*</span>) без приблизних здогадок.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-sm">
              3
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                Перевірте результат у таблиці та експортуйте файл
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Натисніть «Завантажити Excel»: файл формується як клон оригіналу із 100% збереженням системних коментарів заголовків (JSON). Імпортуйте його назад у кабінет маркетплейсу Епіцентр без жодних помилок!
              </p>
            </div>
          </div>

          {/* Security Guarantee */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-900 text-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              <strong>Гарантія безпеки:</strong> Колонка ID суворо захищена від змін. Вже заповнені характеристики не спотворюються.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <span className="text-xs text-slate-500">
            Готові розпочати заповнення?
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-[#004BB7] hover:bg-[#003d99] text-white transition-colors cursor-pointer"
          >
            Почати роботу
          </button>
        </div>
      </div>
    </div>
  );
};
