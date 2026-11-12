import React, { useState } from 'react';
import {
  X,
  History,
  FileSpreadsheet,
  FileCode2,
  CheckCircle2,
  Calendar,
  Layers,
  Trash2,
  Percent,
  Clock,
  ArrowRight,
  AlertTriangle,
  Bug,
  Sparkles,
  Download,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { SavedBatchHistoryItem, getCachedXmlFeed } from '../../services/workspaceStorage';
import { EpicentrXmlGeneratorService } from '../../services/epicentrXmlGeneratorService';

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
  const [activeTab, setActiveTab] = useState<'all' | 'excel' | 'xml'>('all');

  if (!isOpen) return null;

  const excelCount = history.filter((b) => b.type !== 'xml').length;
  const xmlCount = history.filter((b) => b.type === 'xml').length;

  const filteredHistory = history.filter((batch) => {
    if (activeTab === 'excel') return batch.type !== 'xml';
    if (activeTab === 'xml') return batch.type === 'xml';
    return true;
  });

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

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const handleDownloadXml = (e: React.MouseEvent, batch: SavedBatchHistoryItem) => {
    e.stopPropagation();
    const cachedXml = getCachedXmlFeed(batch.id);
    if (cachedXml) {
      EpicentrXmlGeneratorService.downloadXmlFile(cachedXml, batch.filename || 'epicentr_feed.xml');
    } else if (batch.xmlDetails?.xmlPreviewSnippet) {
      // Fallback
      EpicentrXmlGeneratorService.downloadXmlFile(batch.xmlDetails.xmlPreviewSnippet, batch.filename || 'epicentr_feed.xml');
    } else {
      onSelectBatch?.(batch);
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
              <h3 className="font-bold text-slate-900 text-sm">Історія операцій PIM</h3>
              <p className="text-[11px] text-slate-500">
                {history.length} збережених записів ({excelCount} Excel, {xmlCount} XML)
              </p>
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

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1 text-xs">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Усі</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-slate-200/80 rounded-full font-mono">{history.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('excel')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'excel'
                ? 'bg-white text-[#004BB7] shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#004BB7]" />
            <span>Excel-шаблони</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 text-[#004BB7] rounded-full font-mono">{excelCount}</span>
          </button>
          <button
            onClick={() => setActiveTab('xml')}
            className={`flex-1 py-1.5 px-2 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'xml'
                ? 'bg-white text-amber-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5 text-amber-600" />
            <span>XML-фіди</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full font-mono">{xmlCount}</span>
          </button>
        </div>

        {/* Informational Guidance Banner */}
        {filteredHistory.length > 0 && (
          <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 text-[11px] text-blue-900 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[#004BB7] shrink-0" />
            <span>
              {activeTab === 'xml'
                ? 'Клікніть на XML-фід, щоб перейти у конвертер або завантажте .xml одразу кнопкою.'
                : 'Клікніть на запис, щоб відкрити його у відповідному модулі PIM.'}
            </span>
          </div>
        )}

        {/* List of Batches */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((batch) => {
              const isXml = batch.type === 'xml';

              if (isXml) {
                const xmlDetails = batch.xmlDetails;
                const isPassed = xmlDetails?.xsdValid ?? (batch.unfilledMandatoryCount === 0);
                const offersCount = xmlDetails?.offersCount || batch.productsCount;
                const score = xmlDetails?.complianceScore ?? batch.fillRatePercentage;
                const sizeStr = formatFileSize(xmlDetails?.fileSizeBytes);

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
                    className="group relative p-3.5 rounded-xl bg-amber-50/20 border border-amber-200/80 hover:border-amber-400 hover:bg-amber-50/50 transition-all duration-200 cursor-pointer space-y-2.5 shadow-2xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            XML ФІД
                          </span>
                          <h4 className="font-bold text-slate-900 text-xs truncate group-hover:text-amber-800 transition-colors">
                            {batch.filename}
                          </h4>
                        </div>
                        <span className="text-[11px] text-slate-600 block mt-1 truncate">
                          {batch.categoryTitle}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                          isPassed
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {isPassed ? 'XSD 100%' : `Помилок: ${xmlDetails?.xsdErrorsCount || batch.unfilledMandatoryCount}`}
                      </span>
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-amber-200/50">
                      <span className="flex items-center gap-1 font-semibold text-slate-700">
                        <Layers className="w-3 h-3 text-slate-400" />
                        {offersCount} товарів
                      </span>

                      {sizeStr && (
                        <span className="text-slate-500 font-mono text-[10px]">
                          {sizeStr}
                        </span>
                      )}

                      {isPassed ? (
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          XSD OK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-rose-600 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          XSD Fix
                        </span>
                      )}

                      <span className="flex items-center gap-1 text-slate-400 ml-auto font-mono text-[10px]">
                        <Clock className="w-3 h-3" />
                        {formatDate(batch.timestamp)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="pt-1 flex items-center justify-between text-[11px] border-t border-amber-200/40">
                      <button
                        type="button"
                        onClick={(e) => handleDownloadXml(e, batch)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] transition-colors cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Завантажити .xml</span>
                      </button>

                      <span className="flex items-center gap-1 font-semibold text-amber-800 group-hover:underline">
                        <span>Відкрити в конвертері</span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                );
              }

              // Standard Excel Batch Card
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
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-[#004BB7] border border-blue-200">
                          EXCEL
                        </span>
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
              <p className="font-semibold text-slate-700">
                {activeTab === 'xml'
                  ? 'Історія XML-конвертацій порожня'
                  : activeTab === 'excel'
                  ? 'Історія Excel-шаблонів порожня'
                  : 'Історія порожня'}
              </p>
              <p className="text-[11px] text-slate-500">
                {activeTab === 'xml'
                  ? 'Згенеруйте XML-фід у розділі "XML-фід", щоб зберегти його результат.'
                  : 'Завантажте та обробіть файл шаблону, щоб він з\'явився у цьому списку.'}
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
