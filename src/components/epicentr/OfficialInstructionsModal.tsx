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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] flex flex-col relative overflow-hidden text-slate-800">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#004BB7]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Офіційний регламент маркетплейсу Епіцентр (Україна)
              </h3>
              <p className="text-xs text-slate-500">
                База нормативних вимог, субліцензійного договору та правил імпорту Excel
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

        {/* Scrollable Body */}
        <div className="overflow-y-auto py-4 space-y-4 text-xs text-slate-700 pr-1">
          {/* Official 4 Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <a
              href="https://supportm.epicentrk.ua/zagalnivymogydokontentu/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#004BB7] hover:bg-blue-50/40 transition-all group flex items-start justify-between gap-2"
            >
              <div>
                <span className="font-bold text-slate-900 group-hover:text-[#004BB7] transition-colors block text-sm">
                  1. Загальні вимоги до контенту
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Формула назви, артикул, опис, обов'язкові характеристики товарів.
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-[#004BB7] shrink-0 mt-0.5" />
            </a>

            <a
              href="https://supportm.epicentrk.ua/vymogydovizualnogokontentuyakpravylnoobratyzobrazhennyavashogotovaru/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#FF7A00] hover:bg-amber-50/40 transition-all group flex items-start justify-between gap-2"
            >
              <div>
                <span className="font-bold text-slate-900 group-hover:text-[#d96500] transition-colors block text-sm">
                  2. Вимоги до візуального контенту
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Вимоги до 1-го фото, визначення кольору та візерунка, інфографіка.
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-[#FF7A00] shrink-0 mt-0.5" />
            </a>

            <a
              href="https://supportm.epicentrk.ua/eksporttovariv/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all group flex items-start justify-between gap-2"
            >
              <div>
                <span className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors block text-sm">
                  3. Робота з Excel-шаблоном
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Експорт категорій, збереження коментарів заголовків, імпорт Excel.
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            </a>

            <a
              href="https://supportm.epicentrk.ua/xmlfayl/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-purple-500 hover:bg-purple-50/40 transition-all group flex items-start justify-between gap-2"
            >
              <div>
                <span className="font-bold text-slate-900 group-hover:text-purple-700 transition-colors block text-sm">
                  4. Вимоги до XML імпорту
                </span>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Специфікація структури XML-фіду та мапінг атрибутів.
                </span>
              </div>
              <ExternalLink className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            </a>
          </div>

          {/* Strict Prohibitions */}
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
            <h4 className="font-bold text-rose-800 text-sm flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              Суворі заборони регламенту маркетплейсу Епіцентр
            </h4>
            <ul className="space-y-1.5 list-disc list-inside text-slate-700">
              <li><strong>НЕ редагувати колонку ID</strong> — це зруйнує імпорт товарів у кабінет.</li>
              <li><strong>НЕ змінювати назви стовпчиків</strong> та <strong>НЕ видаляти службові коментарі (JSON)</strong> у комірках заголовків.</li>
              <li><strong>НЕ заповнювати необов'язкові поля</strong> (без `*` у назві) — тільки обов'язкові.</li>
              <li><strong>НЕ заповнювати приблизними значеннями</strong> — якщо впевненості немає, поле залишається порожнім.</li>
              <li><strong>НЕ чіпати вже заповнені поля</strong> користувача.</li>
            </ul>
          </div>

          {/* First Photo Rules */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2">
            <h4 className="font-bold text-[#d96500] text-sm flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-[#FF7A00]" />
              Правила аналізу першого фото товару
            </h4>
            <p className="text-slate-700 leading-relaxed">
              Якщо посилань у колонці «Фото товару*» кілька через крапку з комою, береться <strong>виключно перше фото</strong>. Колір товару та візерунок («з візерунком» або «без візерунка (однотонний)») визначаються ТІЛЬКИ з фото, а не з тексту назви. Фото має абсолютний пріоритет над описом.
            </p>
          </div>

          {/* HTML Entities */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 space-y-2">
            <h4 className="font-bold text-[#004BB7] text-sm flex items-center gap-1.5">
              <CodeXml className="w-4 h-4 text-[#004BB7]" />
              HTML-ентіті у довіднику значень
            </h4>
            <p className="text-slate-700 leading-relaxed">
              Значення у довіднику можуть містити символи на зразок <code>&#039;</code> (апостроф: <em>кеш&#039;ю</em>) або <code>&amp;</code>. Для пошуку вони декодуються, але запис у файл здійснюється <strong>дослівно з HTML-ентіті</strong>, щоб уникнути помилок в імпортері Епіцентру.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#004BB7] hover:bg-[#003d99] text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Зрозуміло
          </button>
        </div>
      </div>
    </div>
  );
};
