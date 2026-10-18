/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  FileSpreadsheet,
  Camera,
  BookOpen,
  CheckCircle2,
  Clock,
  ShieldCheck,
  SlidersHorizontal,
  AlertCircle,
  Save,
  Check,
  RefreshCw,
  FolderArchive,
  KeyRound,
  Sparkles
} from 'lucide-react';
import { EpicentrColumn } from '../../types/epicentr';

interface ProcessingStatusBarProps {
  templateFileName: string | null;
  dictionaryFileName: string | null;
  xmlFileName: string | null;
  photoCount?: number;
  rowCount: number;
  columns: EpicentrColumn[];
  isAutoSaving?: boolean;
  hasPendingChanges?: boolean;
  lastSavedTimestamp?: number | null;
  hasCustomApiKey?: boolean;
  onOpenApiKeySettings?: () => void;
  onManualSave?: () => void;
  onOpenValidator: () => void;
  onOpenInstructions: () => void;
}

export const ProcessingStatusBar: React.FC<ProcessingStatusBarProps> = ({
  templateFileName,
  dictionaryFileName,
  xmlFileName,
  photoCount = 0,
  rowCount,
  columns,
  isAutoSaving,
  hasPendingChanges,
  lastSavedTimestamp,
  hasCustomApiKey,
  onOpenApiKeySettings,
  onManualSave,
  onOpenValidator,
  onOpenInstructions
}) => {
  const mandatoryColsCount = columns.filter(c => c.isRequired).length;
  const isTemplateLoaded = !!templateFileName && rowCount > 0;
  const isDictLoaded = !!dictionaryFileName;

  return (
    <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs px-4 py-3 mb-6 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        
        {/* Left: Auto-save status */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
            title={
              isAutoSaving
                ? 'Синхронізація з localStorage...'
                : hasPendingChanges
                ? 'Зміни виявлено: автозбереження через 3 секунди (debounce). Клікніть іконку дискети для збереження зараз.'
                : lastSavedTimestamp
                ? `Збережено в localStorage о ${new Date(lastSavedTimestamp).toLocaleTimeString('uk-UA')} (debounce 3с)`
                : 'Автозбереження через debounce 3с активне'
            }
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isAutoSaving ? 'bg-[#FF7A00]' : hasPendingChanges ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isAutoSaving ? 'bg-[#FF7A00]' : hasPendingChanges ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">Автозбереження:</span>
              <span className="text-slate-600 font-mono text-[11px]">
                {isAutoSaving ? (
                  <span className="text-[#FF7A00] font-semibold">Синхронізація...</span>
                ) : hasPendingChanges ? (
                  <span className="text-amber-700 font-medium">Очікування (3с)...</span>
                ) : lastSavedTimestamp ? (
                  <span className="text-emerald-700 font-medium">
                    {new Date(lastSavedTimestamp).toLocaleTimeString('uk-UA')}
                  </span>
                ) : (
                  <span className="text-emerald-700 font-medium">активне (3с)</span>
                )}
              </span>
            </div>
            {onManualSave && (
              <button
                type="button"
                onClick={onManualSave}
                className="ml-1 p-1 hover:bg-slate-200/60 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                title="Зберегти стан вручну зараз (в localStorage, не чекаючи 3с)"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 border-l border-slate-200 pl-3">
            <ShieldCheck className="w-4 h-4 text-[#004BB7]" />
            <span className="font-medium text-slate-700">Кабінет мерчанта:</span>
            <span className="text-slate-500">Захист ID та JSON</span>
          </div>
        </div>

        {/* Center: File Loading Indicators */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Excel Template Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
              isTemplateLoaded
                ? 'bg-blue-50/70 border-blue-200 text-[#004BB7]'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <FileSpreadsheet className={`w-3.5 h-3.5 ${isTemplateLoaded ? 'text-[#004BB7]' : 'text-slate-400'}`} />
            <span className="font-medium">
              {isTemplateLoaded ? (
                <>
                  <span className="max-w-[130px] truncate inline-block align-bottom">{templateFileName}</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded bg-white text-[10px] font-bold text-blue-700 border border-blue-100">
                    {rowCount} тов.
                  </span>
                </>
              ) : (
                'Шаблон Excel'
              )}
            </span>
            {isTemplateLoaded && <Check className="w-3 h-3 text-emerald-600 ml-0.5" />}
          </div>

          {/* Photos Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
              photoCount > 0 || isTemplateLoaded
                ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <Camera className={`w-3.5 h-3.5 ${photoCount > 0 || isTemplateLoaded ? 'text-[#FF7A00]' : 'text-slate-400'}`} />
            <span className="font-medium">
              {photoCount > 0 ? (
                `Фото: ${photoCount} шт.`
              ) : isTemplateLoaded ? (
                '1-е фото: аналіз кольору'
              ) : (
                'Фото товарів'
              )}
            </span>
            {(photoCount > 0 || isTemplateLoaded) && <Check className="w-3 h-3 text-emerald-600 ml-0.5" />}
          </div>

          {/* Dictionary Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
              isDictLoaded
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
          >
            <BookOpen className={`w-3.5 h-3.5 ${isDictLoaded ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className="font-medium">
              {isDictLoaded ? (
                <span className="max-w-[110px] truncate inline-block align-bottom">Довідник</span>
              ) : (
                'Довідник значень'
              )}
            </span>
            {isDictLoaded && <Check className="w-3 h-3 text-emerald-600 ml-0.5" />}
          </div>

          {/* XML feed indicator if loaded */}
          {xmlFileName && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-50/70 border border-purple-200 text-purple-900">
              <span className="font-medium max-w-[110px] truncate">{xmlFileName}</span>
              <Check className="w-3 h-3 text-purple-700" />
            </div>
          )}

          {/* Google AI Studio Status Chip */}
          {onOpenApiKeySettings && (
            <button
              type="button"
              onClick={onOpenApiKeySettings}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                hasCustomApiKey
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                  : 'bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100'
              }`}
              title={
                hasCustomApiKey
                  ? 'Google AI Studio: ключ встановлено в localStorage ("epic_ai_key"). Клікніть для редагування.'
                  : 'Google AI Studio: ключ не встановлено. Клікніть для додавання.'
              }
            >
              <Sparkles className={`w-3.5 h-3.5 ${hasCustomApiKey ? 'text-emerald-600' : 'text-[#FF7A00]'}`} />
              <span className="font-medium">
                {hasCustomApiKey ? 'AI: Активно' : 'AI: Потрібен ключ'}
              </span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasCustomApiKey ? 'bg-emerald-500' : 'bg-[#FF7A00]'
                }`}
              />
            </button>
          )}
        </div>

        {/* Right: Validator Actions & Rules */}
        <div className="flex items-center gap-2 shrink-0">
          {mandatoryColsCount > 0 && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-amber-50 text-[#d96500] border border-amber-200">
              {mandatoryColsCount} обов'язкових (*)
            </span>
          )}

          <button
            type="button"
            onClick={onOpenValidator}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 hover:text-slate-900 text-xs font-semibold transition-colors shadow-2xs"
            title="Перевірити формулу назв товарів за регламентом контенту Епіцентру"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span>Валідатор</span>
          </button>

          <button
            type="button"
            onClick={onOpenInstructions}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-[#004BB7] hover:bg-blue-50/60 text-xs font-medium transition-colors"
            title="Офіційний регламент маркетплейсу Епіцентр"
          >
            <span>Регламент</span>
          </button>
        </div>

      </div>
    </div>
  );
};
