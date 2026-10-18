/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  History,
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Layers,
  Trash2,
  Percent,
  Clock,
  ArrowRight,
  AlertTriangle,
  Bug,
  Sparkles
} from 'lucide-react';
import { SavedBatchHistoryItem } from '../../services/workspaceStorage';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: SavedBatchHistoryItem[];
  onClearHistory: () => void;
  onSelectBatch?: (batch: SavedBatchHistoryItem) => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
  onSelectBatch
}) => {
  if (!isOpen) return null;

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Щойно';
      if (diffMins < 60) return `${diffMins} хв тому`;
      if (diffHours < 24 && now.getDate() === d.getDate()) {
        return `Сьогодні, ${d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;
      }

      return d.toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-2xs animate-fadeIn">
      <div className="w-full max-w-md bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#004BB7] flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Історія оброблених партій</h3>
              <p className="text-[11px] text-slate-500">{history.length} збережених подій у браузері</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Закрити історію"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Guidance Banner */}
        {history.length > 0 && (
          <div className="px-4 py-2.5 bg-blue-50/70 border-b border-blue-100 text-[11px] text-blue-900 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#004BB7] shrink-0" />
            <span>Клікніть на подію, щоб відкрити готовий шаблон зі звітом та моніторингом помилок.</span>
          </div>
        )}

        {/* List of Batches */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {history.length > 0 ? (
            history.map((batch) => {
              const errorCount = batch.engineErrors ? batch.engineErrors.length : (batch.report?.errors?.length || 0);
              const isHighFill = batch.fillRatePercentage >= 80;
              const isMediumFill = batch.fillRatePercentage >= 50 && batch.fillRatePercentage < 80;

              return (
                <div
                  key={batch.id}
                  onClick={() => onSelectBatch && onSelectBatch(batch)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectBatch && onSelectBatch(batch);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="group relative p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-[#004BB7] hover:bg-blue-50/30 transition-all duration-200 cursor-pointer space-y-2.5 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#004BB7]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#004BB7] shrink-0" />
                        <h4 className="font-bold text-slate-900 text-xs truncate group-hover:text-[#004BB7] transition-colors">
                          {batch.filename}
                        </h4>
                      </div>
                      <span className="text-[11px] text-slate-500 block mt-1 truncate">
                        {batch.categoryTitle}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                        isHighFill
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : isMediumFill
                          ? 'bg-amber-50 text-[#d96500] border-amber-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {batch.fillRatePercentage}%
                    </span>
                  </div>

                  {/* Badges / Metrics */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Layers className="w-3 h-3 text-slate-400" />
                      {batch.productsCount} товарів
                    </span>

                    {errorCount > 0 ? (
                      <span className="flex items-center gap-1 text-[#d96500] font-semibold">
                        <Bug className="w-3 h-3" />
                        {errorCount} збоїв
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Без помилок
                      </span>
                    )}

                    <span className="flex items-center gap-1 text-slate-400 ml-auto font-mono text-[10px]">
                      <Clock className="w-3 h-3" />
                      {formatDate(batch.timestamp)}
                    </span>
                  </div>

                  {/* Return to Ready Report Action Hint */}
                  <div className="pt-1 flex items-center justify-between text-[11px] font-semibold text-[#004BB7] group-hover:text-[#003d99]">
                    <span className="flex items-center gap-1">
                      Відкрити звіт та шаблон
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <span className="text-[10px] text-slate-400 group-hover:text-slate-600 font-normal">
                      Крок 5 (Готово)
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-400" />
              <p className="font-semibold text-slate-700">Історія порожня</p>
              <p className="text-[11px] text-slate-500">
                Завантажте та обробіть файл шаблону, щоб він з'явився у цьому списку.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              onClick={onClearHistory}
              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 transition-colors font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Очистити всю історію</span>
            </button>
            <span className="text-[10px] text-slate-500 font-mono">
              localStorage
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
