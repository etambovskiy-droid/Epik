/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lock, ShieldAlert, Sparkles, ArrowRight, X, CheckCircle2 } from 'lucide-react';

interface DemoRestrictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  onRegisterClick?: () => void;
}

export const DemoRestrictionModal: React.FC<DemoRestrictionModalProps> = ({
  isOpen,
  onClose,
  featureName,
  onRegisterClick
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 md:p-8 shadow-2xl text-slate-100 space-y-5">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon & Badge */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              <ShieldAlert className="w-3 h-3" /> Демо-пісочниця (Default Deny)
            </div>
            <h2 className="text-base font-bold text-slate-100 mt-1">
              Дія обмежена у демо-режимі
            </h2>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2 text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
          <p>
            {featureName ? (
              <>
                Функція <strong className="text-amber-300">«{featureName}»</strong> недоступна в демо-версії.
              </>
            ) : (
              'Ця дія заблокована у демо-версії.'
            )}
          </p>
          <p className="text-slate-400 text-[11px]">
            У демонстраційному режимі дозволено <strong>виключно перегляд 3 зразкових карток товарів</strong> для ознайомлення з логікою платформи.
          </p>
        </div>

        {/* Capabilities list */}
        <div className="space-y-1.5 text-[11px] text-slate-300">
          <div className="font-semibold text-slate-200 text-xs">Доступно після швидкої реєстрації мерчанта:</div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Завантаження власних прайс-листів Excel, фото та XML</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Підключення власного безкоштовного Google AI Studio API Key</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>ШІ-генерація фото, консультант та Google Search Grounding</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Експорт готових файлів для модерації Епіцентр Маркетплейс</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          {onRegisterClick && (
            <button
              type="button"
              onClick={onRegisterClick}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Створити власний кабінет мерчанта</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Продовжити ознайомлення з 3 зразками
          </button>
        </div>
      </div>
    </div>
  );
};
