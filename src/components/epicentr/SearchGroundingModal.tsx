/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Search,
  Globe,
  ExternalLink,
  Sparkles,
  Package,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';
import { callGeminiDirect } from '../../services/geminiClientDirect';

interface SearchGroundingModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawRows: Record<string, any>[];
}

interface GroundingSource {
  uri: string;
  title: string;
}

export const SearchGroundingModal: React.FC<SearchGroundingModalProps> = ({
  isOpen,
  onClose,
  rawRows
}) => {
  const [query, setQuery] = useState('');
  const [selectedRowIdx, setSelectedRowIdx] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [sources, setSources] = useState<GroundingSource[]>([]);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const getProductLabel = (row: Record<string, any>, idx: number) => {
    const title =
      row['Назва товару*\n[ua]'] ||
      row['Назва товару [ua]*'] ||
      row['Назва товару\n[ua]'] ||
      row['Назва товару'] ||
      row['Артикул*'] ||
      row['Артикул'] ||
      `Товар #${idx + 1}`;
    return `${idx + 1}. ${String(title).slice(0, 65)}`;
  };

  const handleSelectProduct = (idx: number) => {
    setSelectedRowIdx(idx);
    if (idx >= 0 && rawRows[idx]) {
      const row = rawRows[idx];
      const title =
        row['Назва товару*\n[ua]'] ||
        row['Назва товару [ua]*'] ||
        row['Назва товару\n[ua]'] ||
        row['Назва товару'] ||
        '';
      const brand = row['Бренд*\n(select)'] || row['Бренд'] || '';
      const sku = row['Артикул*'] || row['Артикул'] || '';
      setQuery(
        `Знайди точні офіційні технічні характеристики, країну реєстрації бренду та комплектацію для товару: ${title} ${brand} ${sku}`.trim()
      );
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setErrorMsg(null);

    try {
      const productContext = selectedRowIdx >= 0 ? rawRows[selectedRowIdx] : undefined;
      const fullPrompt = `Ти — експерт каталогу та PIM-спеціаліст маркетплейсу Епіцентр.
Знайди актуальну та перевірену інформацію в Google Search за запитом користувача і сформуй структуровану відповідь українською мовою.
Якщо запит стосується конкретного товару, бренду, моделі чи артикулу — наведи точні характеристики (матеріал, країна бренду/виробництва, розміри, комплектація, технічні параметри), придатні для заповнення картки товару Епіцентру.

Запит: ${query.trim()}
${productContext ? `\nКонтекст товару з таблиці:\n${JSON.stringify(productContext, null, 2)}` : ''}`;

      const aiRes = await callGeminiDirect(fullPrompt, {
        tools: [{ googleSearch: {} }],
        maxOutputTokens: 350
      });

      if (aiRes.error) {
        setErrorMsg(aiRes.error);
        return;
      }

      setResultText(aiRes.text || 'Не знайдено результатів');
      setSources(Array.isArray(aiRes.sources) ? aiRes.sources : []);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Помилка виконання пошуку через Google');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopy = () => {
    if (!resultText) return;
    navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-4xl max-h-[88vh] bg-white dark:bg-[#0F1422] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#004BB7] to-blue-600 flex items-center justify-center text-white shadow-sm">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Google Search Grounding — Пошук характеристик товарів
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                  gemini-3.8-flash + Google Search
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Перевірка актуальних специфікацій виробника, країни бренду, габаритів та штрихкодів у реальному часі
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Product Selector & Search Input */}
          <form onSubmit={handleSearch} className="space-y-3">
            {rawRows.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Обрати товар із відкритого шаблону для автозапиту (необов’язково):</span>
                </label>
                <select
                  value={selectedRowIdx}
                  onChange={(e) => handleSelectProduct(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  <option value={-1}>— Вільний пошуковий запит без прив’язки до рядка —</option>
                  {rawRows.slice(0, 50).map((row, idx) => (
                    <option key={idx} value={idx}>
                      {getProductLabel(row, idx)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                Пошуковий запит до Google Search:
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Напр.: Sony WH-1000XM5 точні характеристики вага імпеданс країна виробництва..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#004BB7]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-5 py-2.5 rounded-xl bg-[#004BB7] hover:bg-blue-600 text-white font-bold text-xs shadow-sm transition-colors flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${isSearching ? 'animate-spin' : ''}`} />
                  <span>{isSearching ? 'Пошук у Google...' : 'Знайти дані'}</span>
                </button>
              </div>
            </div>
          </form>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Grounded Result Display */}
          {resultText && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#FF7A00]" />
                    <span>Знайдені специфікації та дані для картки Епіцентру</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Скопійовано' : 'Копіювати'}</span>
                  </button>
                </div>

                <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {resultText}
                </div>
              </div>

              {/* Grounding Sources Citations */}
              {sources.length > 0 && (
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 space-y-2.5">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#004BB7]" />
                    <span>Перевірені веб-джерела Google Search ({sources.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-[#004BB7] dark:text-blue-400 transition-colors"
                      >
                        <span className="truncate max-w-[260px]">{src.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
