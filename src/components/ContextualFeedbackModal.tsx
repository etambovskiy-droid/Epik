/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertCircle,
  X,
  Send,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Layers,
  Code2,
  FileSpreadsheet,
  HelpCircle,
  Sparkles,
  Info
} from 'lucide-react';
import {
  ContextSnapshot,
  FeedbackPayload,
  FeedbackType
} from '../types/feedback';

interface ContextualFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: ContextSnapshot | null;
  currentUserId?: string;
  defaultRole?: 'merchant' | 'category_manager';
  onSubmitted?: (payload: FeedbackPayload) => void;
}

const FEEDBACK_TYPES: Array<{
  value: FeedbackType;
  label: string;
  description: string;
  badgeColor: string;
}> = [
  {
    value: 'mapping_error',
    label: 'Помилка мапінгу',
    description: 'Неправильно зіставлена характеристика або невірний код опції',
    badgeColor: 'border-amber-500/40 text-amber-300 bg-amber-500/10'
  },
  {
    value: 'validation_bug',
    label: 'Помилка валідації',
    description: 'Невідповідність формату, типу даних (float/int) чи обов’язковості',
    badgeColor: 'border-rose-500/40 text-rose-300 bg-rose-500/10'
  },
  {
    value: 'missing_value',
    label: 'Відсутнє значення',
    description: 'У довіднику маркетплейсу немає потрібного варіанту зі списку',
    badgeColor: 'border-sky-500/40 text-sky-300 bg-sky-500/10'
  },
  {
    value: 'ui_issue',
    label: 'Зручність / Інтерфейс',
    description: 'Складнощі при перегляді, кліку або редагуванні даних у таблиці',
    badgeColor: 'border-purple-500/40 text-purple-300 bg-purple-500/10'
  },
  {
    value: 'feature_request',
    label: 'Ідея / Покращення',
    description: 'Пропозиція для оптимізації роботи з каталогом чи автозаповненням',
    badgeColor: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
  }
];

export const ContextualFeedbackModal: React.FC<ContextualFeedbackModalProps> = ({
  isOpen,
  onClose,
  context,
  currentUserId = 'user_merchant_default',
  defaultRole = 'merchant',
  onSubmitted
}) => {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('mapping_error');
  const [comment, setComment] = useState('');
  const [userRole, setUserRole] = useState<'merchant' | 'category_manager'>(defaultRole);
  const [isAccordionOpen, setIsAccordionOpen] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [successPayload, setSuccessPayload] = useState<FeedbackPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !context) {
    return null;
  }

  const handleReset = () => {
    setComment('');
    setFeedbackType('mapping_error');
    setSuccessPayload(null);
    setErrorMessage(null);
    setIsLoading(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || comment.trim().length < 3) {
      setErrorMessage('Будь ласка, опишіть проблему (мінімум 3 символи)');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const payload: FeedbackPayload = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: currentUserId,
      userRole,
      type: feedbackType,
      comment: comment.trim(),
      context: {
        ...context,
        allowedValuesSample: context.allowedValuesSample
          ? context.allowedValuesSample.slice(0, 10)
          : []
      },
      status: 'new',
      createdAt: new Date().toISOString()
    };

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Помилка сервера HTTP ${response.status}`);
      }

      setSuccessPayload(payload);
      if (onSubmitted) {
        onSubmitted(payload);
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Не вдалося надіслати фідбек. Перевірте з’єднання із сервером.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="feedback-modal-title"
                className="text-lg font-semibold text-slate-100 leading-tight"
              >
                Контекстний звіт про помилку
              </h2>
              <p className="text-xs text-slate-400">
                Авто-захоплення координат комірки та метаданих довідника
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Закрити"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {successPayload ? (
            <div className="py-8 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-100">Фідбек успішно зареєстровано!</h3>
                <p className="text-sm text-slate-400 max-w-md">
                  Знімок комірки збережено під номером{' '}
                  <span className="font-mono text-amber-400 text-xs px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {successPayload.id}
                  </span>
                  . Команда аналізу PIM перегляне його для покращення довідника та правил ШІ.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-all"
                >
                  Повернутися до таблиці
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm transition-all shadow-md shadow-amber-500/20"
                >
                  Надіслати ще один звіт
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Role Toggle */}
              <div className="flex items-center justify-between pb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Ваша роль у системі:
                </label>
                <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setUserRole('merchant')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      userRole === 'merchant'
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Мерчант (Продавець)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserRole('category_manager')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      userRole === 'category_manager'
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Категорійний менеджер (КМ)
                  </button>
                </div>
              </div>

              {/* Problem Type Selector */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Тип проблеми:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FEEDBACK_TYPES.map((item) => {
                    const isSelected = feedbackType === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setFeedbackType(item.value)}
                        className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-slate-800/90 border-amber-400 ring-1 ring-amber-400/50 shadow-md shadow-amber-500/5'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-slate-200">
                            {item.label}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${item.badgeColor}`}
                          >
                            {item.value}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {item.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accordion: Captured Cell Context */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-950 hover:bg-slate-900/80 transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Авто-захоплений контекст комірки
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                      {context.columnName} [Рядок #{context.rowIndex + 1}]
                    </span>
                  </div>
                  {isAccordionOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {isAccordionOpen && (
                  <div className="p-4 border-t border-slate-800/80 space-y-3.5 text-xs">
                    {/* Category & Location row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300">
                      <div className="flex items-start gap-2 bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                        <Layers className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[11px] text-slate-400">Категорія Епіцентру:</div>
                          <div className="font-medium text-slate-200">
                            {context.categoryName || 'Не вказано'}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">
                            Код ID: {context.categoryId}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 bg-slate-900/70 p-2.5 rounded-lg border border-slate-800">
                        <FileSpreadsheet className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[11px] text-slate-400">Локація в таблиці:</div>
                          <div className="font-medium text-slate-200">
                            Колонка: «{context.columnName}»
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">
                            Рядок: #{context.rowIndex + 1} | Стовпчик: #{context.columnIndex + 1}
                            {context.attributeId && ` | Атрибут: ${context.attributeId}`}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Raw vs Parsed Comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                          <Code2 className="w-3.5 h-3.5 text-slate-400" />
                          Вхідне значення (RAW):
                        </span>
                        <div className="font-mono text-xs text-rose-300 bg-slate-950 p-2 rounded border border-rose-950/50 break-words min-h-[36px]">
                          {context.rawValue !== null && context.rawValue !== undefined && context.rawValue !== '' ? (
                            String(context.rawValue)
                          ) : (
                            <span className="text-slate-600 italic">&lt;Порожня комірка&gt;</span>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          ШІ / Нормалізоване значення:
                        </span>
                        <div className="font-mono text-xs text-emerald-300 bg-slate-950 p-2 rounded border border-emerald-950/50 break-words min-h-[36px]">
                          {context.parsedValue !== null && context.parsedValue !== undefined && context.parsedValue !== '' ? (
                            String(context.parsedValue)
                          ) : (
                            <span className="text-slate-600 italic">&lt;Не визначено&gt;</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Allowed Values Sample */}
                    {context.allowedValuesSample && context.allowedValuesSample.length > 0 && (
                      <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-sky-400" />
                          Фрагмент списку допустимих значень (allowedValues):
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {context.allowedValuesSample.map((val, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px] border border-slate-700/60"
                            >
                              {val}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Error message or API logs if available */}
                    {context.errorMessage && (
                      <div className="bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-lg text-rose-300 text-xs">
                        <span className="font-semibold block mb-0.5">Помилка валідації:</span>
                        {context.errorMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Description Textarea */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="feedback-comment"
                    className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5"
                  >
                    Опис проблеми / Що очікувалося:
                    <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500">{comment.length}/2500</span>
                </div>
                <textarea
                  id="feedback-comment"
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Опишіть, чому це значення невірне або яке значення мало б бути підтягнуто з довідника Епіцентру..."
                  maxLength={2500}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 transition-colors resize-y"
                  required
                />
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <HelpCircle className="w-4 h-4" />
                  <span>Звіт допоможе покращити точність мапінгу</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isLoading}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-colors disabled:opacity-50"
                  >
                    Скасувати
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading || !comment.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>Надсилання...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Надіслати звіт</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
