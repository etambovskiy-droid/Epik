/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  EpicentrColumn,
  EpicentrDictionaryAttribute,
  EpicentrProductRow,
  ProcessSettings,
  ProcessingReportSummary
} from './types/epicentr';
import { SAMPLE_CATEGORIES } from './data/sampleEpicentrCategories';
import {
  analyzeEpicentrColumns,
  buildDictionaryIndex,
  runEpicentrFillingEngine
} from './services/epicentrEngine';
import {
  ShopWorkspace,
  SavedBatchHistoryItem,
  getWorkspaces,
  getCurrentWorkspace,
  setCurrentWorkspaceId,
  getBatchHistory,
  saveBatchToHistory,
  isOnboardingSeen,
  setOnboardingSeen,
  saveAutoSaveSession,
  getAutoSaveSession,
  clearAutoSaveSession
} from './services/workspaceStorage';

// Components
import { EpicentrNavbar } from './components/epicentr/EpicentrNavbar';
import { FileUploadSection } from './components/epicentr/FileUploadSection';
import { StepZeroClarificationModal } from './components/epicentr/StepZeroClarificationModal';
import { ProcessingProgressView } from './components/epicentr/ProcessingProgressView';
import { InteractiveDiffTable } from './components/epicentr/InteractiveDiffTable';
import { SummaryReportView } from './components/epicentr/SummaryReportView';
import { OfficialInstructionsModal } from './components/epicentr/OfficialInstructionsModal';
import { TitleFormulaValidatorModal } from './components/epicentr/TitleFormulaValidatorModal';
import { ShareModal } from './components/epicentr/ShareModal';
import { OnboardingGuideModal } from './components/epicentr/OnboardingGuideModal';
import { HistoryDrawer } from './components/epicentr/HistoryDrawer';
import { UserStoryReleaseModal } from './components/epicentr/UserStoryReleaseModal';
import { ErrorTrackingMonitor } from './components/epicentr/ErrorTrackingMonitor';
import { getCurrentAppVersion } from './services/userStoryEngine';
import { EngineErrorEvent } from './types/epicentr';

// Icons
import {
  BarChart3,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  SlidersHorizontal,
  BookOpen,
  Share2,
  History,
  HelpCircle,
  Bug
} from 'lucide-react';

export function App() {
  // Workspaces and history
  const [allShops, setAllShops] = useState<ShopWorkspace[]>(getWorkspaces());
  const [currentShop, setCurrentShop] = useState<ShopWorkspace>(getCurrentWorkspace());
  const [history, setHistory] = useState<SavedBatchHistoryItem[]>(getBatchHistory());

  // App file state
  const [templateFileName, setTemplateFileName] = useState<string | null>(null);
  const [dictionaryFileName, setDictionaryFileName] = useState<string | null>(null);
  const [xmlFileName, setXmlFileName] = useState<string | null>(null);

  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<EpicentrColumn[]>([]);
  const [rawWorkbook, setRawWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [dictionaryIndex, setDictionaryIndex] = useState<Record<string, EpicentrDictionaryAttribute>>({});

  // Workflow steps: 0: Upload/Ready, 1: Clarification, 2: Processing, 3: Completed (Report/Diff)
  const [workflowState, setWorkflowState] = useState<'upload' | 'processing' | 'completed'>('upload');
  const [activeTab, setActiveTab] = useState<'report' | 'table' | 'monitor' | 'upload'>('report');
  const [engineErrors, setEngineErrors] = useState<EngineErrorEvent[]>([]);

  // Process settings (Step 0)
  const [settings, setSettings] = useState<ProcessSettings>({
    reformatTitles: true, // Step 0 question
    autoFixLanguages: true, // [ua] vs [ru]
    photoFirstPriority: true, // 1st photo color & pattern
    enableWebSearch: true,
    brandFallbackOther: true, // "Інше"
    strictDictionaryOnly: true
  });

  // Results
  const [processedRows, setProcessedRows] = useState<EpicentrProductRow[]>([]);
  const [report, setReport] = useState<ProcessingReportSummary | null>(null);

  // Modals
  const [isClarificationOpen, setIsClarificationOpen] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [isValidatorOpen, setIsValidatorOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isUserStoriesOpen, setIsUserStoriesOpen] = useState(false);
  const [appVersion, setAppVersion] = useState<string>(getCurrentAppVersion());

  // Auto-Save State & Periodic serialization
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [restoredFromAutoSave, setRestoredFromAutoSave] = useState(false);

  // Auto-load session from auto-save or fallback to default sample category
  useEffect(() => {
    // Check if an auto-saved session exists in localStorage
    const autoSaved = getAutoSaveSession();
    if (autoSaved && Array.isArray(autoSaved.rawRows) && autoSaved.rawRows.length > 0) {
      setRawRows(autoSaved.rawRows);
      if (autoSaved.settings) {
        setSettings(autoSaved.settings);
      }
      if (autoSaved.columns && autoSaved.columns.length > 0) {
        setColumns(autoSaved.columns);
      } else {
        const headers = Object.keys(autoSaved.rawRows[0]);
        setColumns(analyzeEpicentrColumns(headers));
      }
      if (autoSaved.templateFileName) setTemplateFileName(autoSaved.templateFileName);
      if (autoSaved.dictionaryFileName) setDictionaryFileName(autoSaved.dictionaryFileName);
      if (autoSaved.xmlFileName) setXmlFileName(autoSaved.xmlFileName);
      setLastSavedTimestamp(autoSaved.timestamp);
      setRestoredFromAutoSave(true);
    } else {
      const defaultCat = SAMPLE_CATEGORIES[0];
      const headers = Object.keys(defaultCat.defaultData[0]);
      const analyzedCols = analyzeEpicentrColumns(headers);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(defaultCat.defaultData);

      // Attach comments metadata to row 1
      analyzedCols.forEach((col, idx) => {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
        if (ws[cellRef]) {
          ws[cellRef].c = [
            {
              a: 'EpicentrMarketplace',
              t: JSON.stringify({
                attributeCode: `ATTR_${idx + 100}`,
                attributeType: col.type,
                isRequired: col.isRequired
              })
            }
          ];
        }
      });
      XLSX.utils.book_append_sheet(wb, ws, 'Навушники_Шаблон');

      setRawRows(defaultCat.defaultData);
      setColumns(analyzedCols);
      setRawWorkbook(wb);
      setTemplateFileName(`Шаблон_${defaultCat.id}_Епіцентр.xlsx`);
      setDictionaryFileName(`Довідник_${defaultCat.id}_Офіційний.xlsx`);
      setDictionaryIndex(buildDictionaryIndex(defaultCat.dictionaryData));
    }

    // Show onboarding guide if first time
    if (!isOnboardingSeen()) {
      setIsOnboardingOpen(true);
      setOnboardingSeen(true);
    }
  }, []);

  // Periodic auto-save mechanism: serializes current rawRows and settings state to localStorage every 5 seconds
  useEffect(() => {
    if (rawRows.length === 0) return;

    const performAutoSave = () => {
      setIsAutoSaving(true);
      const now = Date.now();
      const success = saveAutoSaveSession({
        rawRows,
        settings,
        columns,
        templateFileName,
        dictionaryFileName,
        xmlFileName,
        timestamp: now
      });
      if (success) {
        setLastSavedTimestamp(now);
      }
      setTimeout(() => {
        setIsAutoSaving(false);
      }, 350);
    };

    // Periodic timer (every 5000ms)
    const timerId = setInterval(performAutoSave, 5000);

    return () => clearInterval(timerId);
  }, [rawRows, settings, columns, templateFileName, dictionaryFileName, xmlFileName]);

  // Flush serialization immediately before browser unload or refresh to guarantee zero data loss
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (rawRows.length > 0) {
        saveAutoSaveSession({
          rawRows,
          settings,
          columns,
          templateFileName,
          dictionaryFileName,
          xmlFileName,
          timestamp: Date.now()
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [rawRows, settings, columns, templateFileName, dictionaryFileName, xmlFileName]);

  // Manual save trigger
  const handleManualSave = () => {
    if (rawRows.length === 0) return;
    setIsAutoSaving(true);
    const now = Date.now();
    saveAutoSaveSession({
      rawRows,
      settings,
      columns,
      templateFileName,
      dictionaryFileName,
      xmlFileName,
      timestamp: now
    });
    setLastSavedTimestamp(now);
    setTimeout(() => setIsAutoSaving(false), 350);
  };

  // Discard auto-saved draft and restore default template
  const handleDiscardAutoSave = () => {
    clearAutoSaveSession();
    setRestoredFromAutoSave(false);
    const defaultCat = SAMPLE_CATEGORIES[0];
    const headers = Object.keys(defaultCat.defaultData[0]);
    const analyzedCols = analyzeEpicentrColumns(headers);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(defaultCat.defaultData);
    analyzedCols.forEach((col, idx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: idx });
      if (ws[cellRef]) {
        ws[cellRef].c = [
          {
            a: 'EpicentrMarketplace',
            t: JSON.stringify({
              attributeCode: `ATTR_${idx + 100}`,
              attributeType: col.type,
              isRequired: col.isRequired
            })
          }
        ];
      }
    });
    XLSX.utils.book_append_sheet(wb, ws, 'Навушники_Шаблон');

    setRawRows(defaultCat.defaultData);
    setColumns(analyzedCols);
    setRawWorkbook(wb);
    setTemplateFileName(`Шаблон_${defaultCat.id}_Епіцентр.xlsx`);
    setDictionaryFileName(`Довідник_${defaultCat.id}_Офіційний.xlsx`);
    setDictionaryIndex(buildDictionaryIndex(defaultCat.dictionaryData));
    setWorkflowState('upload');
    setProcessedRows([]);
    setReport(null);
  };

  // Handle uploaded template
  const handleLoadTemplate = (
    data: Record<string, any>[],
    analyzedColumns: EpicentrColumn[],
    wb: XLSX.WorkBook | null,
    filename: string
  ) => {
    setRawRows(data);
    setColumns(analyzedColumns);
    setRawWorkbook(wb);
    setTemplateFileName(filename);
    setWorkflowState('upload');
  };

  // Handle uploaded dictionary
  const handleLoadDictionary = (
    rawDict: Record<string, string[]>,
    filename: string
  ) => {
    const idx = buildDictionaryIndex(rawDict);
    setDictionaryIndex(idx);
    setDictionaryFileName(filename);
  };

  // Switch workspace
  const handleSelectShop = (shop: ShopWorkspace) => {
    setCurrentShop(shop);
    setCurrentWorkspaceId(shop.id);
  };

  // Trigger filling process
  const executeFilling = () => {
    setIsClarificationOpen(false);
    setWorkflowState('processing');
  };

  // When animation finishes, run engine
  const handleProcessingComplete = () => {
    const result = runEpicentrFillingEngine(rawRows, columns, dictionaryIndex, settings);
    setProcessedRows(result.processedRows);
    setReport(result.report);
    setEngineErrors(result.report.errors || []);
    setWorkflowState('completed');
    setActiveTab('report');

    // Save batch to history for persistence
    const saved = saveBatchToHistory({
      workspaceId: currentShop.id,
      filename: templateFileName || 'Епіцентр_Шаблон.xlsx',
      categoryTitle: currentShop.name,
      productsCount: result.report.totalProducts,
      mandatoryColumnsCount: result.report.mandatoryColumnsCount,
      newlyFilledCount: result.report.newlyFilledCount,
      fillRatePercentage: result.report.fillRatePercentage,
      unfilledMandatoryCount: result.report.unfilledMandatoryCount
    });

    if (saved) {
      setHistory(getBatchHistory());
    }
  };

  // Clear history
  const handleClearHistory = () => {
    localStorage.removeItem('epicentr_saas_batch_history');
    setHistory([]);
  };

  // Reset to start over
  const handleReset = () => {
    setWorkflowState('upload');
    setProcessedRows([]);
    setReport(null);
  };

  return (
    <div className="min-h-screen bg-[#061226] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <EpicentrNavbar
        onOpenInstructions={() => setIsInstructionsOpen(true)}
        onOpenValidator={() => setIsValidatorOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenGuide={() => setIsOnboardingOpen(true)}
        onOpenUserStories={() => setIsUserStoriesOpen(true)}
        onReset={handleReset}
        activeStep={workflowState === 'completed' ? 5 : workflowState === 'processing' ? 2 : 0}
        historyCount={history.length}
        currentShop={currentShop}
        allShops={allShops}
        onSelectShop={handleSelectShop}
        appVersion={appVersion}
        lastSavedTimestamp={lastSavedTimestamp}
        isAutoSaving={isAutoSaving}
        onManualSave={handleManualSave}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {/* Auto-Save Restoration Notification Banner */}
        {restoredFromAutoSave && (
          <div className="mb-5 bg-gradient-to-r from-blue-950/70 via-[#0d2347] to-slate-900 border border-blue-500/40 rounded-xl p-3.5 px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-200 shadow-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white">Сесію автоматично відновлено:</span>
                <span className="text-slate-300 ml-1.5">
                  Завантажено попередній стан ({rawRows.length} товарів, налаштування та дані збережено о {lastSavedTimestamp ? new Date(lastSavedTimestamp).toLocaleTimeString('uk-UA') : 'попередній сесії'}). Захищено від втрати при оновленні сторінки.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setRestoredFromAutoSave(false)}
                className="px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 font-semibold transition-colors"
              >
                Зрозуміло
              </button>
              <button
                type="button"
                onClick={handleDiscardAutoSave}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-950/50 hover:text-rose-300 text-slate-400 transition-colors"
                title="Очистити автозбережену чернетку та повернутись до початкового шаблону"
              >
                Скинути чернетку
              </button>
            </div>
          </div>
        )}

        {workflowState === 'processing' ? (
          <ProcessingProgressView
            onComplete={handleProcessingComplete}
            productsCount={rawRows.length}
          />
        ) : workflowState === 'completed' && report ? (
          <div className="space-y-6">
            {/* View Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('report')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    activeTab === 'report'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Підсумок та звіт (Крок 5)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('table')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    activeTab === 'table'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Таблиця змін (Diff: {processedRows.length} товарів)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('monitor')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    activeTab === 'monitor'
                      ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                      : 'bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <Bug className="w-4 h-4" />
                  <span>Моніторинг помилок</span>
                  {engineErrors.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-[10px] text-amber-300 font-mono">
                      {engineErrors.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    activeTab === 'upload'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-slate-900/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Завантажити інший файл</span>
                </button>
              </div>

              {/* Status and Share Quick Link */}
              <div className="flex items-center gap-3 text-xs">
                <div className="hidden md:flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Заповнено: {report.fillRatePercentage}% обов'язкових полів</span>
                </div>
                <button
                  onClick={() => setIsShareOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Надати результат колегам</span>
                </button>
              </div>
            </div>

            {/* Tab Views */}
            {activeTab === 'report' && (
              <SummaryReportView
                report={report}
                processedRows={processedRows}
                columns={columns}
                rawWorkbook={rawWorkbook}
                originalFileName={templateFileName}
                onViewTable={() => setActiveTab('table')}
                onViewErrors={() => setActiveTab('monitor')}
              />
            )}

            {activeTab === 'table' && (
              <InteractiveDiffTable
                columns={columns}
                rows={processedRows}
              />
            )}

            {activeTab === 'monitor' && (
              <ErrorTrackingMonitor
                errors={engineErrors}
                onSimulateError={(ev) => setEngineErrors(prev => [ev, ...prev])}
                onClearErrors={() => setEngineErrors([])}
              />
            )}

            {activeTab === 'upload' && (
              <FileUploadSection
                onLoadTemplate={handleLoadTemplate}
                onLoadDictionary={handleLoadDictionary}
                onLoadXml={(xmlStr, fName) => setXmlFileName(fName)}
                templateFileName={templateFileName}
                dictionaryFileName={dictionaryFileName}
                xmlFileName={xmlFileName}
                columns={columns}
                rowCount={rawRows.length}
                onProceedToClarification={() => setIsClarificationOpen(true)}
                onOpenShare={() => setIsShareOpen(true)}
              />
            )}
          </div>
        ) : (
          <FileUploadSection
            onLoadTemplate={handleLoadTemplate}
            onLoadDictionary={handleLoadDictionary}
            onLoadXml={(xmlStr, fName) => setXmlFileName(fName)}
            templateFileName={templateFileName}
            dictionaryFileName={dictionaryFileName}
            xmlFileName={xmlFileName}
            columns={columns}
            rowCount={rawRows.length}
            onProceedToClarification={() => setIsClarificationOpen(true)}
            onOpenShare={() => setIsShareOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-4 text-center text-xs text-slate-500 bg-[#040d1a]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>
              Епіцентр Агент SaaS © {new Date().getFullYear()} — Для публічного використання селерами маркетплейсу.
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setIsUserStoriesOpen(true)}
              className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition-colors"
            >
              <span>Лабораторія змін ({appVersion})</span>
            </button>
            <button
              onClick={() => setIsShareOpen(true)}
              className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Надати доступ іншим</span>
            </button>
            <button onClick={() => setIsOnboardingOpen(true)} className="hover:text-blue-400 transition-colors">
              Як це працює
            </button>
            <button onClick={() => setIsInstructionsOpen(true)} className="hover:text-blue-400 transition-colors">
              Регламент Епіцентру
            </button>
          </div>
        </div>
      </footer>

      {/* Step 0 Clarification Modal */}
      <StepZeroClarificationModal
        isOpen={isClarificationOpen}
        onClose={() => setIsClarificationOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        onConfirmAndRun={executeFilling}
        productsCount={rawRows.length}
      />

      {/* Official Instructions Modal */}
      <OfficialInstructionsModal
        isOpen={isInstructionsOpen}
        onClose={() => setIsInstructionsOpen(false)}
      />

      {/* Title Formula Validator Modal */}
      <TitleFormulaValidatorModal
        isOpen={isValidatorOpen}
        onClose={() => setIsValidatorOpen(false)}
      />

      {/* Public Share / Give to others modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        shopName={currentShop.name}
      />

      {/* Onboarding Guide Modal */}
      <OnboardingGuideModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />

      {/* Batch History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onClearHistory={handleClearHistory}
      />

      {/* User Story & Release Compiler Modal */}
      <UserStoryReleaseModal
        isOpen={isUserStoriesOpen}
        onClose={() => setIsUserStoriesOpen(false)}
        onVersionUpdated={(newVer) => setAppVersion(newVer)}
      />
    </div>
  );
}

export default App;
