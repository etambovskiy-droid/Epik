/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  X,
  Sparkles,
  ArrowRight,
  Copy,
  Check
} from 'lucide-react';
import { formatEpicentrTitle } from '../../services/epicentrEngine';

interface TitleFormulaValidatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TitleFormulaValidatorModal: React.FC<TitleFormulaValidatorModalProps> = ({
  isOpen,
  onClose
}) => {
  const [testTitle, setTestTitle] = useState(
    'Навушники ігрові бездротові АКЦІЯ MChose V9 Pro 2.4G/Bluetooth Чорно-червоний (657)'
  );
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Analysis of title
  const length = testTitle.length;
  const isLengthValid = length <= 150;
  const prohibitedWordsRegex = /\b(акція|акция|знижка|скидка|original|оригінал|оригинал|розпродаж|распродажа|уцінка|уценка|новинка|топ|хіт|хит)\b/gi;
  const foundProhibited = testTitle.match(prohibitedWordsRegex) || [];
  const hasProhibited = foundProhibited.length > 0;
  const isCapslock = testTitle === testTitle.toUpperCase() && testTitle.length > 10;
  const hasSkuInBrackets = /\(([^)]+)\)$/.test(testTitle.trim());

  // Quick fix with engine
  const handleAutoFix = () => {
    const fixed = formatEpicentrTitle({
      rawTitle: testTitle,
      lang: 'ua'
    });
    setTestTitle(fixed);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(testTitle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0b1b36] border border-blue-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl shadow-blue-950/60 relative">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Валідатор назв за офіційною формулою Епіцентру
              </h3>
              <p className="text-xs text-slate-400">
                Тип товару + Особливість + Бренд + Модель + Інші характеристики + Колір + (Артикул)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Введіть або вставте назву товару:
            </label>
            <textarea
              rows={3}
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="Наприклад: Навушники ігрові бездротові MChose V9 Pro 2.4G/Bluetooth Чорно-червоний (657)"
            />
          </div>

          {/* Validation Checklist */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Length */}
            <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
              isLengthValid ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
            }`}>
              {isLengthValid ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
              <span>Довжина: {length} / 150 символів</span>
            </div>

            {/* Prohibited words */}
            <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
              !hasProhibited ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
            }`}>
              {!hasProhibited ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
              <span>{hasProhibited ? `Заборонені слова: ${foundProhibited.join(', ')}` : 'Без слів Акція, Знижка тощо'}</span>
            </div>

            {/* Capslock */}
            <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
              !isCapslock ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-rose-950/20 border-rose-800/40 text-rose-300'
            }`}>
              {!isCapslock ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
              <span>{isCapslock ? 'Заборонено CAPSLOCK для назви' : 'Регістр коректний'}</span>
            </div>

            {/* SKU */}
            <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
              hasSkuInBrackets ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
            }`}>
              {hasSkuInBrackets ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
              <span>{hasSkuInBrackets ? 'Артикул вказано у дужках (123)' : 'Бажано артикул у дужках в кінці'}</span>
            </div>
          </div>

          {/* Example Formula Box */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5 text-slate-300">
            <span className="font-semibold text-slate-200">Офіційні правила оформлення:</span>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
              <li><strong>Колір:</strong> визначається за 1-м фото, з великої літери (Чорний, Чорно-червоний, Black/Red).</li>
              <li><strong>Розміри:</strong> мала українська `х` з пробілом перед одиницею (`60х60х5 см`).</li>
              <li><strong>Бренд:</strong> мовою оригіналу з великої літери (без CapsLock, крім зареєстрованих ZARA).</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={handleAutoFix}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Авто-виправлення за формулою</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопійовано!' : 'Копіювати'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
            >
              Закрити
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
