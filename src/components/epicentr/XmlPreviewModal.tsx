/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  FileCode,
  Download,
  Copy,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
  Layers,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';
import {
  EpicentrXmlGeneratorService,
  EpicentrXsdValidationReport
} from '../../services/epicentrXmlGeneratorService';

interface XmlPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  xmlContent: string;
  offersCount: number;
  xsdReport?: EpicentrXsdValidationReport | null;
}

export const XmlPreviewModal: React.FC<XmlPreviewModalProps> = ({
  isOpen,
  onClose,
  xmlContent,
  offersCount,
  xsdReport
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'xml' | 'xsd_report' | 'xsd_schema'>('xml');

  const computedReport = useMemo(() => {
    if (xsdReport) return xsdReport;
    if (!xmlContent) return null;
    return EpicentrXmlGeneratorService.validateXmlAgainstEpicentrXsd(xmlContent);
  }, [xmlContent, xsdReport]);

  if (!isOpen) return null;

  const handleCopy = () => {
    const contentToCopy =
      activeTab === 'xsd_schema' ? EpicentrXmlGeneratorService.EPICENTR_OFFICIAL_XSD : xmlContent;
    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const report = computedReport || EpicentrXmlGeneratorService.validateXmlAgainstEpicentrXsd(xmlContent);
    if (!report.isValid) {
      setActiveTab('xsd_report');
      return;
    }
    const filename = `epicentr_feed_${new Date().toISOString().split('T')[0]}.xml`;
    EpicentrXmlGeneratorService.downloadXmlFile(xmlContent, filename);
  };

  const handleForceDownload = () => {
    const filename = `epicentr_feed_${new Date().toISOString().split('T')[0]}.xml`;
    EpicentrXmlGeneratorService.downloadXmlFile(xmlContent, filename);
  };

  const displayedCode =
    activeTab === 'xsd_schema' ? EpicentrXmlGeneratorService.EPICENTR_OFFICIAL_XSD : xmlContent;
  const lines = displayedCode.split('\n');
  const sizeKb = (new Blob([xmlContent]).size / 1024).toFixed(1);
  const isValidXsd = computedReport ? computedReport.isValid : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="relative w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-100">
                  Попередній перегляд та XSD-валідація XML-фіду
                </h2>
                {isValidXsd ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="w-3.5 h-3.5" /> XSD Validated ({computedReport?.complianceScore ?? 100}%)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" /> Помилок XSD: {computedReport?.errorCount || 0}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                <span>Товарів (offers): <b className="text-slate-200">{offersCount}</b></span>
                <span>•</span>
                <span>Рядків: <b className="text-slate-200">{xmlContent.split('\n').length}</b></span>
                <span>•</span>
                <span>Розмір: <b className="text-slate-200">{sizeKb} KB</b></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Скопійовано!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>{activeTab === 'xsd_schema' ? 'Копіювати XSD' : 'Копіювати XML'}</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-lg ${
                isValidXsd
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
              }`}
            >
              <Download className="w-4 h-4" />
              {isValidXsd ? 'Завантажити валідний XML-фід' : 'Переглянути помилки XSD'}
            </button>

            <button
              onClick={onClose}
              className="p-2 ml-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="px-6 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('xml')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'xml'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Згенерований XML-фід
            </button>
            <button
              onClick={() => setActiveTab('xsd_report')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'xsd_report'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Звіт XSD-валідації ({computedReport?.checkpoints.filter((c) => c.passed).length || 0}/
              {computedReport?.checkpoints.length || 6})
            </button>
            <button
              onClick={() => setActiveTab('xsd_schema')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'xsd_schema'
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              Офіційна XSD-схема Епіцентру
            </button>
          </div>

          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            Стандарт: Epicentr PIM XML Schema (XSD 1.0)
          </span>
        </div>

        {/* Body Content */}
        {activeTab === 'xsd_report' && computedReport ? (
          <div className="flex-1 overflow-auto bg-slate-950 p-6 space-y-5">
            {/* Summary Banner */}
            <div
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                computedReport.isValid
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {computedReport.isValid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="text-sm font-bold">
                    {computedReport.isValid
                      ? 'XML-фід повністю відповідає офіційній XSD-схемі маркетплейсу Епіцентр'
                      : `Виявлено порушення XSD-схеми (${computedReport.errorCount} критичних помилок)`}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Перевірено пропозицій: <b>{computedReport.offersValidated}</b> • Попереджень:{' '}
                    <b>{computedReport.warningCount}</b> • Оцінка відповідності:{' '}
                    <b>{computedReport.complianceScore}%</b>
                  </p>
                </div>
              </div>

              {!computedReport.isValid && (
                <button
                  onClick={handleForceDownload}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 shrink-0"
                >
                  Завантажити попри помилки
                </button>
              )}
            </div>

            {/* Checkpoints Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {computedReport.checkpoints.map((cp) => (
                <div
                  key={cp.id}
                  className={`p-3.5 rounded-xl border ${
                    cp.passed
                      ? 'bg-slate-900/70 border-slate-800'
                      : 'bg-rose-950/20 border-rose-800/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {cp.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-slate-100">{cp.title}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        cp.passed
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {cp.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-amber-300/90 mt-1.5 pl-6">
                    Правило XSD: {cp.xsdRule}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 pl-6">{cp.details}</p>
                </div>
              ))}
            </div>

            {/* Detailed Issues List */}
            {computedReport.issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
                  Деталізація зауважень XSD ({computedReport.issues.length})
                </h4>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {computedReport.issues.map((issue, i) => (
                    <div
                      key={i}
                      className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                        issue.severity === 'error'
                          ? 'bg-rose-950/30 border-rose-800/50 text-rose-200'
                          : 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                          issue.severity === 'error' ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="px-1.5 py-0.2 rounded bg-black/40">{issue.code}</span>
                          <span className="text-slate-400">Вузол: &lt;{issue.element}&gt;</span>
                          {issue.offerId && (
                            <span className="text-amber-300">Offer ID: {issue.offerId}</span>
                          )}
                        </div>
                        <p className="mt-1">{issue.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* XML / XSD Code Viewer Body with Line Numbers */
          <div className="flex-1 overflow-auto bg-slate-950 font-mono text-xs p-4 selection:bg-amber-500/30 selection:text-amber-200">
            <div className="flex gap-4">
              {/* Line numbers column */}
              <div className="select-none text-slate-600 text-right font-mono text-[11px] leading-5 pr-2 border-r border-slate-800">
                {lines.map((_, idx) => (
                  <div key={idx}>{idx + 1}</div>
                ))}
              </div>

              {/* Code content */}
              <pre className="flex-1 text-slate-300 font-mono text-[11px] leading-5 overflow-x-auto">
                <code>
                  {lines.map((line, idx) => {
                    let colorClass = 'text-slate-300';
                    if (line.startsWith('<?xml') || line.startsWith('</') || line.startsWith('<')) {
                      if (line.includes('offer id=')) colorClass = 'text-amber-300 font-medium';
                      else if (line.includes('param paramcode=')) colorClass = 'text-sky-300';
                      else if (line.includes('name lang=')) colorClass = 'text-emerald-300';
                      else if (line.includes('description lang=')) colorClass = 'text-cyan-300';
                      else if (line.includes('price')) colorClass = 'text-violet-300 font-semibold';
                      else if (line.includes('category code=')) colorClass = 'text-orange-300';
                      else if (line.includes('attribute_set code=')) colorClass = 'text-pink-300';
                      else if (line.includes('xs:')) colorClass = 'text-sky-300';
                      else colorClass = 'text-slate-400';
                    }

                    return (
                      <div key={idx} className={`${colorClass} hover:bg-slate-900/60 px-1 rounded`}>
                        {line}
                      </div>
                    );
                  })}
                </code>
              </pre>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Перевірено за XSD-стандартом маркетплейсу Епіцентр (сувора ієрархія yml_catalog → offers → offer).
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="text-amber-400 hover:text-amber-300 font-medium hover:underline flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" /> Зберегти як .xml
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

