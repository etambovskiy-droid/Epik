/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BookOpen,
  FileSpreadsheet,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  SlidersHorizontal,
  RefreshCw,
  Share2,
  History,
  HelpCircle,
  Store,
  ChevronDown,
  Cpu,
  GitBranch
} from 'lucide-react';
import { ShopWorkspace } from '../../services/workspaceStorage';

interface EpicentrNavbarProps {
  onOpenInstructions: () => void;
  onOpenValidator: () => void;
  onOpenShare: () => void;
  onOpenHistory: () => void;
  onOpenGuide: () => void;
  onOpenUserStories: () => void;
  onReset: () => void;
  activeStep: number;
  historyCount: number;
  currentShop: ShopWorkspace;
  allShops: ShopWorkspace[];
  onSelectShop: (shop: ShopWorkspace) => void;
  appVersion: string;
  lastSavedTimestamp?: number | null;
  isAutoSaving?: boolean;
  onManualSave?: () => void;
}

export const EpicentrNavbar: React.FC<EpicentrNavbarProps> = ({
  onOpenInstructions,
  onOpenValidator,
  onOpenShare,
  onOpenHistory,
  onOpenGuide,
  onOpenUserStories,
  onReset,
  activeStep,
  historyCount,
  currentShop,
  allShops,
  onSelectShop,
  appVersion,
  lastSavedTimestamp,
  isAutoSaving,
  onManualSave
}) => {
  const [shopMenuOpen, setShopMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-[#071329]/95 backdrop-blur-md border-b border-blue-900/40 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Brand & Shop Switcher */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-amber-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-xl tracking-tight shrink-0">
            Е
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-lg tracking-tight">Епіцентр Агент</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300">
                SaaS для маркетплейсу
              </span>
            </div>

            {/* Shop switcher */}
            <div className="relative mt-0.5">
              <button
                type="button"
                onClick={() => setShopMenuOpen(!shopMenuOpen)}
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors py-0.5 rounded hover:bg-slate-800/40 px-1"
              >
                <Store className="w-3 h-3 text-amber-400" />
                <span className="font-medium truncate max-w-[200px]">{currentShop.name}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {shopMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[#0b1b36] border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50 text-xs">
                  <div className="px-2 py-1 text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Робочі кабінети магазинів
                  </div>
                  {allShops.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        onSelectShop(s);
                        setShopMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors ${
                        s.id === currentShop.id
                          ? 'bg-blue-600/20 text-blue-300 font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="text-[10px] font-mono text-slate-500">{s.sellerCode}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Auto-Save Status Badge */}
          <button
            type="button"
            onClick={onManualSave}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-[11px] text-slate-300 font-mono transition-all group"
            title={lastSavedTimestamp ? `Автозбережено в localStorage о ${new Date(lastSavedTimestamp).toLocaleTimeString('uk-UA')}. Клікніть для ручного збереження.` : 'Автозбереження в localStorage активне'}
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isAutoSaving ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isAutoSaving ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="text-slate-400 font-sans hidden sm:inline">
              {isAutoSaving ? 'Збереження...' : 'Автозбережено:'}
            </span>
            <span className="text-emerald-400 font-mono font-semibold">
              {lastSavedTimestamp ? new Date(lastSavedTimestamp).toLocaleTimeString('uk-UA') : 'активно'}
            </span>
          </button>

          {/* Share / Public access button */}
          <button
            onClick={onOpenShare}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all transform hover:scale-[1.02]"
            title="Отримати публічне посилання для надання доступу іншим користувачам"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Надати в користування</span>
          </button>

          {/* Quick Guide */}
          <button
            onClick={onOpenGuide}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
            title="Інструкція швидкого старту для нових користувачів"
          >
            <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Швидкий старт</span>
          </button>

          {/* History */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
            title="Історія оброблених Excel файлів"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Історія</span>
            {historyCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-blue-600 text-[10px] text-white font-mono">
                {historyCount}
              </span>
            )}
          </button>

          {/* User Stories & Release Lab */}
          <button
            onClick={onOpenUserStories}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700/60 text-xs font-medium text-indigo-300 transition-colors"
            title="Запропонувати покращення або скомпілювати реліз"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Лабораторія змін</span>
            <span className="px-1.5 py-0.2 rounded bg-indigo-800/80 text-[10px] text-white font-mono font-bold">
              {appVersion}
            </span>
          </button>

          {/* Validator */}
          <button
            onClick={onOpenValidator}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">Валідатор назв</span>
          </button>

          {/* Official Instructions */}
          <button
            onClick={onOpenInstructions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-xs font-medium text-blue-300 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden md:inline">Регламент</span>
          </button>

          {activeStep > 0 && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors"
              title="Почати з нового файлу"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
