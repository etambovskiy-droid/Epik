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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#0b1b36] border border-blue-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#071329]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Швидкий старт для нових користувачів</h3>
              <p className="text-xs text-slate-400">
                Як автоматично підготувати товарний шаблон для імпорту в Епіцентр за 3 кроки
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Step Cards */}
        <div className="p-6 space-y-4 text-xs">
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 text-sm">
              1
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                Завантажте шаблон або виберіть демо
              </h4>
              <p className="text-slate-300 leading-relaxed">
                Експортуйте файл потрібної категорії з кабінету селера Епіцентру або натисніть будь-яку з готових категорій («Навушники», «Крісла», «Люстри»). Також завантажте офіційний довідник значень.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0 text-sm">
              2
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                Підтвердіть налаштування та запустіть ШІ-агента
              </h4>
              <p className="text-slate-300 leading-relaxed">
                Агент запитає, чи потрібно привести назви до офіційної формули Епіцентру. Далі він проаналізує перше фото товару (колір, візерунок), опис та довідник значень, заповнюючи виключно обов'язкові поля з зірочкою (<span className="text-amber-400 font-bold">*</span>).
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-sm">
              3
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                Перевірте результат у таблиці Diff та скачайте Excel
              </h4>
              <p className="text-slate-300 leading-relaxed">
                Ви отримаєте детальний звіт заповнення. Натисніть «Завантажити заповнений Excel»: файл формується як клон оригіналу із 100% збереженням системних коментарів заголовків. Імпортуйте його назад у кабінет Епіцентру!
              </p>
            </div>
          </div>

          {/* Security Guarantee */}
          <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-800/40 flex items-center gap-3 text-emerald-300 text-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>
              <strong>Гарантія безпеки:</strong> Колонка ID суворо захищена від змін. Вже заповнені характеристики не змінюються.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#071329]">
          <span className="text-xs text-slate-400">
            Готові спробувати?
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Почати роботу
          </button>
        </div>
      </div>
    </div>
  );
};
