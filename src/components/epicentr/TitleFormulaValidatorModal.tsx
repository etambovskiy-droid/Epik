/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Copy,
  Check,
  X,
  HelpCircle,
  KeyRound
} from 'lucide-react';
import { formatEpicentrTitle } from '../../services/epicentrEngine';
import { EPICENTR_SYSTEM_PROMPT } from '../../constants/epicentrPrompt';

interface TitleFormulaValidatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TitleFormulaValidatorModal: React.FC<TitleFormulaValidatorModalProps> = ({
  isOpen,
  onClose
}) => {
  const [testTitle, setTestTitle] = useState(
    'Навушники ігрові бездротові MChose V9 Pro 2.4G/Bluetooth Чорно-червоний (657)'
  );
  const [copied, setCopied] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  if (!isOpen) return null;

  // Analysis of title
  const length = testTitle.length;
  const isLengthValid = length <= 150;
  const prohibitedWordsRegex = /\b(акція|акция|знижка|скидка|original|оригінал|оригинал|розпродаж|распродажа|уцінка|уценка|новинка|топ|хіт|хит)\b/gi;
  const foundProhibited = testTitle.match(prohibitedWordsRegex) || [];
  const hasProhibited = foundProhibited.length > 0;
  const isCapslock = testTitle === testTitle.toUpperCase() && testTitle.length > 10;
  const hasSkuInBrackets = /\(([^)]+)\)$/.test(testTitle.trim());

  // Quick fix with heuristic engine
  const handleAutoFix = () => {
    const fixed = formatEpicentrTitle({
      rawTitle: testTitle,
      lang: 'ua'
    });
    setTestTitle(fixed);
  };

  // AI Generation with Gemini via server endpoint with deterministic auto-fix fallback
  const handleAiGenerateTitle = async () => {
    setIsAiGenerating(true);
    try {
      const response = await fetch('/api/gemini/title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.1-flash-lite',
          systemInstruction: EPICENTR_SYSTEM_PROMPT,
          rawTitle: testTitle,
          prompt: `Ти — головний редактор контенту маркетплейсу Епіцентр.
Перетвори та нормалізуй наступну назву товару за офіційною формулою Епіцентру:
<Тип товару> <Особливість> <Бренд> <Модель> <Ключова характеристика/Розмір> <Колір> (<Артикул>)
Правила:
- Без маркетингових слів (акція, супер, оригінал, новинка).
- Тип товару українською мовою. Бренд і модель мовою оригіналу.
- Колір з великої літери (Чорний, Чорно-червоний).
- Довжина до 150 символів. Артикул у дужках наприкінці.
- Відповідай ТІЛЬКИ фінальною назвою без коментарів.

Поточна назва: ${testTitle}`
        })
      });
      if (response.ok) {
        const data = await response.json();
        const generated = data?.text?.trim().replace(/^["']|["']$/g, '');
        if (generated) {
          setTestTitle(generated);
          return;
        }
      }
      handleAutoFix();
    } catch (e: any) {
      console.warn('AI title generation notice, applying rule-based auto-fix:', e);
      handleAutoFix();
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(testTitle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative text-slate-800">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#FF7A00]">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Валідатор назв за регламентом Епіцентру
              </h3>
              <p className="text-xs text-slate-500">
                Тип товару + Особливість + Бренд + Модель + Інші характеристики + Колір + (Артикул)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Введіть або вставте назву товару для перевірки:
            </label>
            <textarea
              rows={3}
              value={testTitle}
              onChange={(e) => setTestTitle(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#004BB7]"
              placeholder="Наприклад: Навушники ігрові бездротові MChose V9 Pro 2.4G/Bluetooth Чорно-червоний (657)"
            />
          </div>

          {/* Validation Checklist */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Length */}
            <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
              isLengthValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              {isLengthValid ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>Довжина: {length} / 150 символів</span>
            </div>

            {/* Prohibited words */}
            <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
              !hasProhibited ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              {!hasProhibited ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>{hasProhibited ? `Заборонено: ${foundProhibited.join(', ')}` : 'Без слів Акція, Знижка'}</span>
            </div>

            {/* Capslock */}
            <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
              !isCapslock ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              {!isCapslock ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>{isCapslock ? 'Заборонено CAPSLOCK' : 'Регістр назви коректний'}</span>
            </div>

            {/* SKU */}
            <div className={`p-2.5 rounded-lg border flex items-center gap-2 ${
              hasSkuInBrackets ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}>
              {hasSkuInBrackets ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-[#FF7A00]" />}
              <span>{hasSkuInBrackets ? 'Артикул у дужках (123)' : 'Бажано артикул у дужках в кінці'}</span>
            </div>
          </div>

          {/* Example Formula Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1.5 text-slate-700">
            <span className="font-bold text-slate-900">Офіційні правила контенту маркетплейсу:</span>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
              <li><strong>Колір:</strong> визначається за 1-м фото, з великої літери (Чорний, Чорно-червоний).</li>
              <li><strong>Розміри:</strong> мала українська `х` з пробілом перед одиницею (`60х60х5 см`).</li>
              <li><strong>Бренд:</strong> мовою оригіналу з великої літери (без CapsLock, крім брендів на зразок ZARA).</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAiGenerateTitle}
              disabled={isAiGenerating}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-[#FF7A00] hover:from-amber-600 hover:to-[#ea6c00] text-white text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="Нормалізувати назву за допомогою Gemini 3.8 Flash згідно з регламентом"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin' : ''}`} />
              <span>{isAiGenerating ? 'Gemini генерує...' : 'AI Gemini назва'}</span>
            </button>

            <button
              type="button"
              onClick={handleAutoFix}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#d96500] border border-amber-200 text-xs font-semibold transition-colors cursor-pointer"
              title="Швидке базове форматування за шаблоном"
            >
              <span>Базове виправлення</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors border border-slate-300 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Скопійовано!' : 'Копіювати'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#004BB7] hover:bg-[#003d99] text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Закрити
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
