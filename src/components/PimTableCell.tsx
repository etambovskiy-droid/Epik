/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AlertCircle, Sparkles, Check, Edit2, ShieldAlert } from 'lucide-react';
import { ContextSnapshot } from '../types/feedback';

export interface PimTableCellProps {
  /**
   * Cell coordinates and identity
   */
  rowIndex: number;
  columnIndex: number;
  columnName: string;
  categoryId: string;
  categoryName: string;
  attributeId?: string;

  /**
   * Cell values and status
   */
  rawValue: string | number | null | undefined;
  parsedValue?: string | number | null | undefined;
  allowedValuesSample?: string[];
  errorMessage?: string;
  apiErrorLog?: string;
  isAiEnriched?: boolean;

  /**
   * Optional callbacks for editing and feedback dispatch
   */
  onValueChange?: (newValue: string) => void;
  onRequestFeedback?: (context: ContextSnapshot) => void;
  className?: string;
}

export const PimTableCell: React.FC<PimTableCellProps> = ({
  rowIndex,
  columnIndex,
  columnName,
  categoryId,
  categoryName,
  attributeId,
  rawValue,
  parsedValue,
  allowedValuesSample = [],
  errorMessage,
  apiErrorLog,
  isAiEnriched = false,
  onValueChange,
  onRequestFeedback,
  className = ''
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const displayVal = parsedValue !== undefined && parsedValue !== null && parsedValue !== '' 
    ? String(parsedValue) 
    : String(rawValue ?? '');
  const [currentValue, setCurrentValue] = useState(displayVal);

  const hasError = Boolean(errorMessage);
  const isChangedFromRaw =
    Boolean(rawValue) &&
    Boolean(parsedValue) &&
    String(rawValue).trim() !== String(parsedValue).trim();

  const handleFeedbackClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRequestFeedback) {
      const snapshot: ContextSnapshot = {
        categoryId,
        categoryName,
        rowIndex,
        columnIndex,
        columnName,
        attributeId,
        rawValue,
        parsedValue: parsedValue ?? currentValue,
        allowedValuesSample,
        errorMessage,
        apiErrorLog
      };
      onRequestFeedback(snapshot);
    }
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    if (onValueChange && currentValue !== displayVal) {
      onValueChange(currentValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setCurrentValue(displayVal);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`group relative flex items-center justify-between min-h-[42px] px-3 py-1.5 rounded-lg border text-xs transition-all duration-150 ${
        hasError
          ? 'bg-rose-950/20 border-rose-500/40 text-rose-200 hover:border-rose-400'
          : isChangedFromRaw
          ? 'bg-emerald-950/15 border-emerald-500/30 text-emerald-200 hover:border-emerald-400/60'
          : 'bg-slate-900/60 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-850'
      } ${className}`}
    >
      {/* Cell Value & Badges */}
      <div className="flex-1 min-w-0 pr-2">
        {isEditing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              autoFocus
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveEdit}
              className="w-full bg-slate-950 text-slate-100 px-2 py-1 rounded border border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono text-xs"
            />
            <button
              type="button"
              onClick={handleSaveEdit}
              className="p-1 rounded bg-amber-500 text-slate-950 hover:bg-amber-400 shrink-0"
              title="Зберегти"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {hasError ? (
              <span title={errorMessage}>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              </span>
            ) : isAiEnriched ? (
              <span title="Згенеровано або нормалізовано ШІ">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              </span>
            ) : null}

            <span
              className={`truncate font-mono ${
                !displayVal ? 'text-slate-600 italic' : ''
              }`}
              title={displayVal || '<Порожньо>'}
            >
              {displayVal || '<порожньо>'}
            </span>

            {isChangedFromRaw && (
              <span
                className="hidden xl:inline-block text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono shrink-0"
                title={`Оригінал: ${String(rawValue)}`}
              >
                raw: {String(rawValue).slice(0, 10)}...
              </span>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Controls on Hover */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
        {!isEditing && onValueChange && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Швидке редагування комірки"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={handleFeedbackClick}
          className={`flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium transition-all ${
            hasError
              ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
              : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 shadow-sm'
          }`}
          title="Повідомити про помилку / відкрити контекстний фідбек"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Фідбек</span>
        </button>
      </div>
    </div>
  );
};
