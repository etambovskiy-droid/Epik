/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Home,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  ShieldAlert
} from 'lucide-react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Human-readable name of the module or component (e.g. "Таблиця характеристик", "Авторизація")
   */
  name?: string;
  /**
   * Layout level:
   * - 'app': Full viewport fallback (for root/page level)
   * - 'modal': Modal dialog overlay fallback
   * - 'section': Inline bordered container fallback (default)
   * - 'inline': Compact inline banner
   */
  level?: 'app' | 'modal' | 'section' | 'inline';
  /**
   * Custom fallback node or render function
   */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /**
   * Callback fired when user clicks "Перезапустити" / reset
   */
  onReset?: () => void;
  /**
   * Optional close handler for modals
   */
  onClose?: () => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isDetailsExpanded: boolean;
  copied: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    isDetailsExpanded: false,
    copied: false
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary] Caught error in ${this.props.name || 'Component'}:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isDetailsExpanded: false,
      copied: false
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleGoHome = (): void => {
    this.handleReset();
    if (typeof window !== 'undefined') {
      // If at root level, clean URL query and hash, or soft reload
      if (window.location.search || window.location.hash) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      window.dispatchEvent(new CustomEvent('epic_navigate_home'));
    }
  };

  public handleCopyDetails = (): void => {
    const { error, errorInfo } = this.state;
    const text = [
      `Модуль: ${this.props.name || 'Невідомий'}`,
      `Помилка: ${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`,
      `Стек викликів:\n${error?.stack || 'No stack'}`,
      `React Component Stack:\n${errorInfo?.componentStack || 'No component stack'}`
    ].join('\n\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      });
    }
  };

  public render(): ReactNode {
    const { hasError, error, errorInfo, isDetailsExpanded, copied } = this.state;
    const { children, name = 'модулі інтерфейсу', level = 'section', fallback, onClose } = this.props;

    if (!hasError) {
      return children;
    }

    // Custom fallback provided
    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback(error || new Error('Unknown error'), this.handleReset);
      }
      return fallback;
    }

    const errorMessage = error?.message || 'Сталася непередбачена помилка під час виконання.';
    const componentStack = errorInfo?.componentStack;

    // Full Application Level White Screen Prevention
    if (level === 'app') {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 text-slate-100 font-sans">
          <div className="w-full max-w-xl bg-slate-850 rounded-2xl border border-slate-700/80 p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold text-white">
                    Захист від білого екрана спрацював
                  </h1>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                    System Safeguard
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Виявлено збій у додатку ({name}). Інтерфейс успішно збережено від повного краху.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 font-mono break-words leading-relaxed">
              <div className="text-rose-400 font-bold mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{error?.name || 'Помилка виконання'}:</span>
              </div>
              <p className="text-slate-300">{errorMessage}</p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#004BB7] hover:bg-blue-600 text-white font-bold text-xs transition-colors cursor-pointer shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Перезапустити модуль</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-colors cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Повернутися на головну</span>
              </button>

              <button
                type="button"
                onClick={this.handleCopyDetails}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 text-xs transition-colors ml-auto cursor-pointer"
                title="Скопіювати стек помилки"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-semibold">Скопійовано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Скопіювати звіт</span>
                  </>
                )}
              </button>
            </div>

            {/* Technical stack drawer */}
            <div className="border-t border-slate-800/80 pt-3">
              <button
                type="button"
                onClick={() => this.setState({ isDetailsExpanded: !isDetailsExpanded })}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer font-medium"
              >
                {isDetailsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                <span>{isDetailsExpanded ? 'Приховати технічні деталі' : 'Показати технічні деталі для розробника'}</span>
              </button>

              {isDetailsExpanded && (
                <div className="mt-3 p-3 rounded-lg bg-black/60 border border-slate-800/80 max-h-48 overflow-auto text-[10px] font-mono text-slate-400 space-y-2 select-text">
                  {error?.stack && (
                    <div>
                      <div className="text-slate-500 font-bold mb-0.5">Call Stack:</div>
                      <pre className="whitespace-pre-wrap">{error.stack}</pre>
                    </div>
                  )}
                  {componentStack && (
                    <div className="pt-2 border-t border-slate-800">
                      <div className="text-slate-500 font-bold mb-0.5">Component Stack:</div>
                      <pre className="whitespace-pre-wrap">{componentStack}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Modal Level Fallback (keeps outer app running smoothly)
    if (level === 'modal') {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-200 p-6 space-y-4 text-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Збій у вікні «{name}»
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Інші розділи додатку продовжують працювати стабільно
                  </p>
                </div>
              </div>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title="Закрити вікно"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-100 text-xs text-rose-900 font-mono break-words leading-relaxed">
              {errorMessage}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                >
                  Закрити
                </button>
              )}
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#004BB7] hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Перезапустити модуль</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Section Level Fallback (Default for tables, tabs, views)
    return (
      <div className="w-full my-3 p-5 rounded-2xl bg-white border-2 border-rose-200/90 shadow-xs space-y-4 text-slate-800">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-600 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-sm">
                  Помилка рендерингу компонента: {name}
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                  Safe Boundary
                </span>
              </div>
              <p className="text-xs text-slate-600 max-w-xl">
                Сталася помилка всередині цього блоку. Решта панелей маркетплейсу продовжують працювати без перебоїв.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#004BB7] hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Перезапустити модуль</span>
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>На головну</span>
            </button>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100 font-mono text-xs text-rose-800 break-words leading-relaxed">
          {errorMessage}
        </div>

        {/* Collapsible Details */}
        <div className="pt-1 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
          <button
            type="button"
            onClick={() => this.setState({ isDetailsExpanded: !isDetailsExpanded })}
            className="flex items-center gap-1 hover:text-slate-800 transition-colors cursor-pointer font-medium"
          >
            {isDetailsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{isDetailsExpanded ? 'Сховати деталі' : 'Технічні деталі'}</span>
          </button>

          <button
            type="button"
            onClick={this.handleCopyDetails}
            className="flex items-center gap-1 hover:text-slate-800 transition-colors cursor-pointer font-medium"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-600">Скопійовано</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Скопіювати помилку</span>
              </>
            )}
          </button>
        </div>

        {isDetailsExpanded && componentStack && (
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-mono text-slate-600 max-h-36 overflow-auto select-text whitespace-pre-wrap">
            {componentStack}
          </div>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
