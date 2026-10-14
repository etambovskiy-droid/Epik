/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  BookOpen,
  ExternalLink,
  ShieldAlert,
  Camera,
  FileSpreadsheet,
  CodeXml,
  CheckCircle2,
  X,
  AlertTriangle
} from 'lucide-react';

interface OfficialInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfficialInstructionsModal: React.FC<OfficialInstructionsModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0b1b36] border border-blue-500/30 rounded-2xl max-w-3xl w-full p-6 shadow-2xl shadow-blue-950/60 max-h-[90vh] flex flex-col relative overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                Офіційні інструкції маркетплейсу Епіцентр (Україна)
              </h3>
              <p className="text-xs text-slate-400">
                База нормативних вимог, субліцензійного договору та правил імпорту
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

        {/* Scrollable Body */}
        <div className="overflow-y-auto py-4 space-y-5 text-xs text-slate-300 pr-1">
          {/* Official 4 Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a
              href="https://supportm.epicentrk.ua/zagalnivymogydokontentu/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all group flex items-start justify-between gap-2"
            >
              <div>
                <span className="font-bold text-white group-hover:text-blue-300 transition-colors block text-sm">
                  1. Загальні вимоги до контенту
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Формула назви, артикул, опис, обов'язкові характеристики товарів.
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            </a>

            <a
              href="https://supportm.epicentrk.ua/vymogydovizualnogokontentuyakpravylnoobratyzobrazhennyavashogotovaru/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 transition-all group flex items-start justify-between gap-2"
            >
              <div>
                <span className="font-bold text-white group-hover:text-amber-300 transition-colors block text-sm">
                  2. Вимоги до візуального контенту
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Вимоги до 1-го фото, визначення кольору та візерунка, інфографіка.
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            </a>

            <a
              href="https://supportm.epicentrk.ua/eksporttovariv/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/80 transition-all group flex items-start justify-between gap-2"
            >
              <div>
                <span className="font-bold text-white group-hover:text-emerald-300 transition-colors block text-sm">
                  3. Інструкція по роботі з шаблоном
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Експорт категорій, збереження коментарів заголовків, імпорт Excel.
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            </a>

            <a
              href="https://supportm.epicentrk.ua/xmlfayl/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/80 transition-all group flex items-start justify-between gap-2"
            >
              <div>
                <span className="font-bold text-white group-hover:text-purple-300 transition-colors block text-sm">
                  4. Вимоги до XML імпорту
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Специфікація структури XML-фіду та мапінг атрибутів.
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            </a>
          </div>

          {/* Strict Prohibitions */}
          <div className="bg-rose-950/30 border border-rose-900/50 rounded-xl p-4 space-y-2">
            <h4 className="font-bold text-rose-300 text-sm flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Суворі заборони регламенту Епіцентру
            </h4>
            <ul className="space-y-1.5 list-disc list-inside text-slate-300">
              <li><strong>НЕ редагувати поле ID</strong> — це зруйнує імпорт товарів у кабінет.</li>
              <li><strong>НЕ змінювати назви стовпчиків</strong> та <strong>НЕ видаляти коментарі до комірок заголовків</strong> — вони містять системний JSON з кодами атрибутів.</li>
              <li><strong>НЕ заповнювати необов'язкові поля</strong> (без `*` у назві) — тільки обов'язкові.</li>
              <li><strong>НЕ заповнювати приблизними значеннями</strong> — якщо впевненості немає, поле залишається порожнім.</li>
              <li><strong>НЕ чіпати вже заповнені поля</strong> користувача.</li>
              <li>Працювати виключно з <strong>копією оригінального файлу</strong> для збереження метаданих.</li>
            </ul>
          </div>

          {/* First Photo Rules */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
            <h4 className="font-bold text-amber-300 text-sm flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-amber-400" />
              Правила аналізу першого фото товару
            </h4>
            <p className="text-slate-300 leading-relaxed">
              Якщо посилань у колонці «Фото товару*» кілька через крапку з комою, береться <strong>виключно перше фото</strong>. Колір товару та візерунок («з візерунком» або «без візерунка (однотонний)») визначаються ТІЛЬКИ з фото, а не з тексту назви. Фото має абсолютний пріоритет над описом при конфлікті кольорів.
            </p>
          </div>

          {/* HTML Entities */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
            <h4 className="font-bold text-blue-300 text-sm flex items-center gap-1.5">
              <CodeXml className="w-4 h-4 text-blue-400" />
              HTML-ентіті у довіднику значень
            </h4>
            <p className="text-slate-300 leading-relaxed">
              Значення у довіднику можуть містити символи на зразок <code>&#039;</code> (апостроф: <em>кеш&#039;ю</em>, <em>В&#039;єтнам</em>) або <code>&amp;</code>. Для пошуку вони декодуються, але запис у файл здійснюється <strong>дослівно з HTML-ентіті як є</strong> — декодування руйнує валідацію в імпортері Епіцентру.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
          >
            Зрозуміло
          </button>
        </div>
      </div>
    </div>
  );
};
