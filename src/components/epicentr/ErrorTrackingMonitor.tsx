/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Info,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Search,
  Filter,
  Copy,
  Download,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Zap,
  Clock,
  Bug,
  HelpCircle,
  FileCode
} from 'lucide-react';
import { EngineErrorEvent, EngineErrorSeverity, EngineErrorPhase } from '../../types/epicentr';

interface ErrorTrackingMonitorProps {
  errors: EngineErrorEvent[];
  onSimulateError?: (testEvent: EngineErrorEvent) => void;
  onClearErrors?: () => void;
}

export const ErrorTrackingMonitor: React.FC<ErrorTrackingMonitorProps> = ({
  errors,
  onSimulateError,
  onClearErrors
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | EngineErrorSeverity>('all');
  const [phaseFilter, setPhaseFilter] = useState<'all' | EngineErrorPhase>('all');
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [copiedLog, setCopiedLog] = useState(false);

  // Stats
  const criticalCount = errors.filter(e => e.severity === 'critical').length;
  const warningCount = errors.filter(e => e.severity === 'warning').length;
  const infoCount = errors.filter(e => e.severity === 'info').length;

  // Filtered list
  const filteredErrors = errors.filter(err => {
    const matchSearch =
      err.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (err.productId && err.productId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (err.columnName && err.columnName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (err.technicalDetails && err.technicalDetails.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchSearch) return false;

    if (severityFilter !== 'all' && err.severity !== severityFilter) {
      return false;
    }

    if (phaseFilter !== 'all' && err.phase !== phaseFilter) {
      return false;
    }

    return true;
  });

  // Copy diagnostic report
  const handleCopyReport = () => {
    const reportStr = JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalEvents: errors.length,
        critical: criticalCount,
        warnings: warningCount,
        info: infoCount,
        events: errors
      },
      null,
      2
    );
    navigator.clipboard.writeText(reportStr);
    setCopiedLog(true);
    setTimeout(() => setCopiedLog(false), 2500);
  };

  // Download log file
  const handleDownloadLog = () => {
    const logLines = errors.map(e => 
      `[${e.timestamp}] [${e.severity.toUpperCase()}] [${e.phase}] ` +
      (e.productId ? `[ID: ${e.productId}] ` : '') +
      (e.columnName ? `[Col: ${e.columnName}] ` : '') +
      `${e.message}\n` +
      (e.technicalDetails ? `  Details: ${e.technicalDetails}\n` : '') +
      (e.remediation ? `  Remediation: ${e.remediation}\n` : '')
    ).join('\n');

    const blob = new Blob([logLines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Epicentr_Diagnostics_${new Date().toISOString().slice(0, 10)}.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Trigger test simulation event
  const triggerSimulation = () => {
    if (!onSimulateError) return;
    const testEvent: EngineErrorEvent = {
      id: `sim-err-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'warning',
      phase: 'dict_matching',
      productId: 'EP-SIM-99',
      columnName: 'Матеріал оббивки (select)*',
      message: 'Тестова симуляція: значення атрибута містить непідтримуваний синонім',
      technicalDetails: 'Спроба запису "еко-замша преміум" замість затвердженого значення довідника Епіцентру.',
      remediation: 'Замініть на найближчий затверджений синонім "велюр" або залиште поле порожнім для ручної перевірки.'
    };
    onSimulateError(testEvent);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5 text-slate-800">
      {/* Top Banner & Monitor Health Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
            criticalCount > 0
              ? 'bg-rose-100 text-rose-700'
              : warningCount > 0
              ? 'bg-amber-100 text-[#d96500]'
              : 'bg-emerald-100 text-emerald-700'
          }`}>
            <Bug className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Моніторинг технічних помилок та збоїв
              </h3>
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                criticalCount > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : warningCount > 0
                  ? 'bg-amber-50 text-[#d96500] border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {criticalCount > 0 ? 'Виявлено критичні збої' : warningCount > 0 ? 'Є зауваження для виправлення' : 'Справно: 0 збоїв'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Живий журнал виконання алгоритму заповнення характеристик Епіцентру
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onSimulateError && (
            <button
              type="button"
              onClick={triggerSimulation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold text-indigo-900 transition-colors cursor-pointer"
              title="Додати тестовий діагностичний збій для перевірки реакції монітора"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-600" />
              <span>Симулювати збій</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors border border-slate-300 cursor-pointer"
            title="Скопіювати весь технічний звіт у JSON"
          >
            {copiedLog ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copiedLog ? 'Скопійовано JSON' : 'Копіювати JSON'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadLog}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors border border-slate-300 cursor-pointer"
            title="Завантажити діагностичний лог .log"
          >
            <Download className="w-3.5 h-3.5 text-[#004BB7]" />
            <span>Завантажити .log</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-semibold">Всього подій</span>
            <Terminal className="w-4 h-4 text-[#004BB7]" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {errors.length}
          </div>
          <span className="text-[10px] text-slate-500">Зафіксовано в сеансі</span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-semibold">Критичні помилки</span>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-700 mt-1">
            {criticalCount}
          </div>
          <span className="text-[10px] text-slate-500">Блокують імпорт файлу</span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-semibold">Попередження</span>
            <AlertTriangle className="w-4 h-4 text-[#FF7A00]" />
          </div>
          <div className="text-2xl font-black text-[#d96500] mt-1">
            {warningCount}
          </div>
          <span className="text-[10px] text-slate-500">Потребують уваги</span>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-semibold">Діагностика / Info</span>
            <Info className="w-4 h-4 text-[#004BB7]" />
          </div>
          <div className="text-2xl font-black text-[#004BB7] mt-1">
            {infoCount}
          </div>
          <span className="text-[10px] text-slate-500">Захищені операції рушія</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 md:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Пошук: текст помилки, ID, колонка..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#004BB7]"
          />
        </div>

        {/* Severity Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSeverityFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              severityFilter === 'all'
                ? 'bg-[#004BB7] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Всі ({errors.length})
          </button>
          <button
            type="button"
            onClick={() => setSeverityFilter('critical')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              severityFilter === 'critical'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Критичні ({criticalCount})
          </button>
          <button
            type="button"
            onClick={() => setSeverityFilter('warning')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              severityFilter === 'warning'
                ? 'bg-[#FF7A00] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Попередження ({warningCount})
          </button>
          <button
            type="button"
            onClick={() => setSeverityFilter('info')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              severityFilter === 'info'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Інформація ({infoCount})
          </button>
        </div>
      </div>

      {/* Events Feed List */}
      <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
        {filteredErrors.length > 0 ? (
          filteredErrors.map((err) => {
            const isExpanded = expandedErrorId === err.id;

            let badgeBg = 'bg-blue-50/80 border-blue-200 text-blue-900';
            let icon = <Info className="w-4 h-4 text-[#004BB7]" />;

            if (err.severity === 'critical') {
              badgeBg = 'bg-rose-50/80 border-rose-200 text-rose-900';
              icon = <AlertOctagon className="w-4 h-4 text-rose-600" />;
            } else if (err.severity === 'warning') {
              badgeBg = 'bg-amber-50/80 border-amber-200 text-amber-900';
              icon = <AlertTriangle className="w-4 h-4 text-[#FF7A00]" />;
            }

            return (
              <div
                key={err.id}
                className={`p-3.5 rounded-xl border transition-all ${badgeBg}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">{icon}</div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          {err.message}
                        </span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-white text-slate-600 border border-slate-300">
                          Фаза: {err.phase}
                        </span>
                        {err.productId && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white text-emerald-700 border border-emerald-300 font-bold">
                            ID: {err.productId}
                          </span>
                        )}
                        {err.columnName && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white text-amber-900 border border-amber-300 font-bold truncate max-w-[200px]">
                            {err.columnName}
                          </span>
                        )}
                      </div>

                      {err.remediation && (
                        <p className="text-[11px] text-slate-700 leading-relaxed">
                          💡 <strong>Рекомендація:</strong> {err.remediation}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Toggle details */}
                  <button
                    type="button"
                    onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                    className="p-1 rounded hover:bg-black/5 text-slate-500 hover:text-slate-800 transition-colors shrink-0"
                    title="Технічні деталі"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Technical Stack / Traceback Drawer */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 text-xs font-mono">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-300 space-y-1 text-slate-800 text-[11px]">
                      <div className="text-slate-500 font-semibold flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-purple-600" />
                        <span>Технічний контекст (Runtime Diagnostics):</span>
                      </div>
                      <div className="text-slate-700 whitespace-pre-wrap">
                        {err.technicalDetails || 'Додаткових технічних деталей не зафіксовано.'}
                      </div>
                      {err.stackTrace && (
                        <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-[10px] text-rose-700 whitespace-pre-wrap">
                          {err.stackTrace}
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center justify-between">
                      <span>Ідентифікатор: {err.id}</span>
                      <span>Час: {new Date(err.timestamp).toLocaleTimeString('uk-UA')}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-10 text-slate-500 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <div className="font-semibold text-slate-800">Жодних критичних помилок не зафіксовано!</div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Рушій обробив структуру файлу, ідентифікатори та фото без порушення цілісності схеми.
            </p>
          </div>
        )}
      </div>

      {/* Footer Notice */}
      <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>
          Всі помилки автоматично зіставляються з регламентом субліцензійного договору маркетплейсу Епіцентр.
        </span>
        {onClearErrors && errors.length > 0 && (
          <button
            type="button"
            onClick={onClearErrors}
            className="text-rose-600 hover:text-rose-800 transition-colors font-semibold underline cursor-pointer"
          >
            Очистити журнал помилок
          </button>
        )}
      </div>
    </div>
  );
};
