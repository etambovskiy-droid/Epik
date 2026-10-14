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
  ArrowRight
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-[#0b1b36] border-l border-slate-800 h-full flex flex-col shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-[#071329]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Історія оброблених партій</h3>
              <p className="text-[11px] text-slate-400">{history.length} збережених звітів у браузері</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Batches */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {history.length > 0 ? (
            history.map((batch) => (
              <div
                key={batch.id}
                className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-white text-xs line-clamp-1">
                      {batch.filename}
                    </h4>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {batch.categoryTitle}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 shrink-0">
                    {batch.fillRatePercentage}% заповнено
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-500" />
                    {formatDate(batch.timestamp)}
                  </span>
                  <span className="font-semibold text-slate-300">
                    {batch.productsCount} товарів ({batch.newlyFilledCount} заповнено)
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <FileSpreadsheet className="w-8 h-8 text-slate-600 mx-auto" />
              <p>Історія заповнень порожня.</p>
              <p className="text-[11px] text-slate-500">
                Після першої обробки тут з'явиться детальний запис про партію товарів.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-slate-800 bg-[#071329] flex justify-between items-center">
            <button
              onClick={onClearHistory}
              className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Очистити історію</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
            >
              Закрити
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
