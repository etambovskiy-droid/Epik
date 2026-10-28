/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  clearAutoSaveSession,
  AutoSaveSession
} from './services/workspaceStorage';

// Components
import { EpicentrNavbar } from './components/epicentr/EpicentrNavbar';
import { FileUploadSection, UploadedPhotoItem } from './components/epicentr/FileUploadSection';
import { ProcessingStatusBar } from './components/epicentr/ProcessingStatusBar';
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
import { AdminApprovalModal } from './components/epicentr/AdminApprovalModal';
import { ErrorTrackingMonitor } from './components/epicentr/ErrorTrackingMonitor';
import { ApiKeySettingsModal } from './components/epicentr/ApiKeySettingsModal';
import { EpicentrXmlConverterView } from './components/epicentr/EpicentrXmlConverterView';
import { EpicentrTokenModal } from './components/epicentr/EpicentrTokenModal';
import { AuthModal } from './components/epicentr/AuthModal';
import { UserProfileDrawer } from './components/epicentr/UserProfileDrawer';
import { ImageStudioModal } from './components/epicentr/ImageStudioModal';
import { SearchGroundingModal } from './components/epicentr/SearchGroundingModal';
import { GeminiChatbotDrawer } from './components/epicentr/GeminiChatbotDrawer';
import { authService, UserProfile } from './services/authService';
import {
  auth,
  saveCatalogSessionToFirestore,
  subscribeUserSessions
} from './firebase';
import { getCurrentAppVersion } from './services/userStoryEngine';
import { EngineErrorEvent } from './types/epicentr';
import { getStoredApiKey } from './services/aiApiKeyService';
import { MISSING_API_KEY_EVENT } from './services/geminiFillingService';

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
  Bug,
  KeyRound,
  Sparkles,
  FileCode,
  MessageSquare,
  X as CloseIcon
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
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhotoItem[]>([
    {
      id: 'sample-p1',
      name: 'photo_1_sony_headphones.jpg',
      url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80',
      size: 245000
    },
    {
      id: 'sample-p2',
      name: 'photo_2_cat_ear_pink.jpg',
      url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
      size: 198000
    },
    {
      id: 'sample-p3',
      name: 'photo_3_akg_studio.jpg',
      url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80',
      size: 310000
    },
    {
      id: 'sample-p4',
      name: 'photo_4_wireless_dark.jpg',
      url: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&auto=format&fit=crop&q=80',
      size: 220000
    }
  ]);

  // Workflow steps: 0: Upload/Ready, 1: Clarification, 2: Processing, 3: Completed (Report/Diff)
  const [workflowState, setWorkflowState] = useState<'upload' | 'processing' | 'completed'>('upload');
  const [activeTab, setActiveTab] = useState<'report' | 'table' | 'monitor' | 'upload' | 'converter'>('report');
  const [isEpicentrTokenModalOpen, setIsEpicentrTokenModalOpen] = useState(false);
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

  // User Authentication & Profile Drawer
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => authService.getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [isImageStudioOpen, setIsImageStudioOpen] = useState(false);
  const [isSearchGroundingOpen, setIsSearchGroundingOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  useEffect(() => {
    const unsub = authService.subscribe((u) => {
      setCurrentUser(u);
    });
    return () => unsub();
  }, []);

  // Subscribe to Firestore catalog sessions when authenticated via Firebase
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !currentUser?.isFirebaseUser) return;
    const unsub = subscribeUserSessions(uid, (firestoreSessions) => {
      if (firestoreSessions.length > 0) {
        setHistory((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const fs of firestoreSessions) {
            if (!existingIds.has(fs.id)) {
              merged.push({
                id: fs.id,
                workspaceId: fs.workspaceId,
                filename: fs.filename,
                categoryTitle: fs.categoryTitle,
                productsCount: fs.productsCount,
                mandatoryColumnsCount: fs.mandatoryColumnsCount,
                newlyFilledCount: fs.newlyFilledCount,
                fillRatePercentage: fs.fillRatePercentage,
                unfilledMandatoryCount: fs.unfilledMandatoryCount,
                timestamp: fs.createdAt
              });
            }
          }
          return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        });
      }
    });
    return () => unsub();
  }, [currentUser?.id, currentUser?.isFirebaseUser]);

  // Admin Approval via URL query (?approval_token=...) or modal trigger
  const [approvalToken, setApprovalToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('approval_token');
    }
    return null;
  });
  const [isAdminApprovalOpen, setIsAdminApprovalOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return !!params.get('approval_token');
    }
    return false;
  });

  // Google AI Studio API Key State (localStorage: "epic_ai_key")
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [hasCustomApiKey, setHasCustomApiKey] = useState<boolean>(() => !!getStoredApiKey());
  const [missingKeyWarning, setMissingKeyWarning] = useState<string | null>(null);
  const [isAiWarningBannerDismissed, setIsAiWarningBannerDismissed] = useState(false);

  // Auto-Save State & Debounced serialization (3 seconds after last change)
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [restoredFromAutoSave, setRestoredFromAutoSave] = useState(false);
  const [restoredBatchNotice, setRestoredBatchNotice] = useState<{
    filename: string;
    timestamp: string;
    productsCount: number;
    fillRate: number;
    errorsCount: number;
  } | null>(null);

  // Listen for API key changes and missing key warnings
  useEffect(() => {
    const handleKeyChange = () => {
      setHasCustomApiKey(!!getStoredApiKey());
    };
    const handleMissingKey = (e: any) => {
      const action = e.detail?.action || 'обробка Excel-шаблонів';
      setMissingKeyWarning(
        `Для дії "${action}" потрібен власний Google AI Studio API Key. Будь ласка, вкажіть ваш ключ для інтелектуальної роботи з шаблонами.`
      );
      setIsApiKeyModalOpen(true);
    };

    window.addEventListener('epic_ai_key_changed', handleKeyChange);
    window.addEventListener(MISSING_API_KEY_EVENT, handleMissingKey);
    return () => {
      window.removeEventListener('epic_ai_key_changed', handleKeyChange);
      window.removeEventListener(MISSING_API_KEY_EVENT, handleMissingKey);
    };
  }, []);

  // Debounce timer & latest state refs to prevent UI micro-stutters
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstDataRender = useRef(true);
  const latestSessionRef = useRef<AutoSaveSession>({
    rawRows: [],
    settings,
    columns: [],
    templateFileName: null,
    dictionaryFileName: null,
    xmlFileName: null,
    timestamp: Date.now()
  });

  // Keep latest session ref continuously synchronized for beforeunload flush
  latestSessionRef.current = {
    rawRows,
    settings,
    columns,
    templateFileName,
    dictionaryFileName,
    xmlFileName,
    timestamp: lastSavedTimestamp || Date.now()
  };

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
        const rawHeaders = autoSaved.columns.map(c => c.originalName);
        setColumns(analyzeEpicentrColumns(rawHeaders));
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
              }),
              hidden: true,
              visible: false
            } as any
          ];
          (ws[cellRef].c as any).hidden = true;
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

  // Optimized Auto-Save mechanism: saves to localStorage 3 seconds after the LAST data change
  // Eliminates periodic intervals to avoid micro-stutters and main thread blocking
  useEffect(() => {
    // Avoid triggering auto-save on initial mount hydration
    if (isFirstDataRender.current) {
      if (rawRows.length > 0) {
        isFirstDataRender.current = false;
      }
      return;
    }

    if (rawRows.length === 0) return;

    // Instantly notify UI of pending change (showing draft status and countdown)
    setHasPendingChanges(true);

    // Cancel any previous debounce timer if user made another change within the 3-second window
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce timer: wait exactly 3000ms (3 seconds) after the last change
    debounceTimerRef.current = setTimeout(() => {
      setIsAutoSaving(true);

      const performSave = () => {
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
          setHasPendingChanges(false);
        }

        setTimeout(() => {
          setIsAutoSaving(false);
        }, 350);
      };

      // Wrap in requestIdleCallback if available to guarantee zero micro-lags during user interaction
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(performSave, { timeout: 1000 });
      } else {
        performSave();
      }
    }, 3000);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [rawRows, settings, columns, templateFileName, dictionaryFileName, xmlFileName]);

  // Flush serialization immediately before browser unload or refresh to guarantee zero data loss
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      const session = latestSessionRef.current;
      if (session && session.rawRows && session.rawRows.length > 0) {
        saveAutoSaveSession({
          ...session,
          timestamp: Date.now()
        });
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Manual save trigger: immediately saves to localStorage and cancels pending debounce
  const handleManualSave = () => {
    if (rawRows.length === 0) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
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
    setHasPendingChanges(false);
    setTimeout(() => setIsAutoSaving(false), 350);
  };

  // Discard auto-saved draft and restore default template
  const handleDiscardAutoSave = () => {
    clearAutoSaveSession();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setHasPendingChanges(false);
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
            }),
            hidden: true,
            visible: false
          } as any
        ];
        (ws[cellRef].c as any).hidden = true;
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

    // Save batch to history for persistence with complete snapshot data
    const saved = saveBatchToHistory({
      workspaceId: currentShop.id,
      filename: templateFileName || 'Епіцентр_Шаблон.xlsx',
      categoryTitle: currentShop.name,
      productsCount: result.report.totalProducts,
      mandatoryColumnsCount: result.report.mandatoryColumnsCount,
      newlyFilledCount: result.report.newlyFilledCount,
      fillRatePercentage: result.report.fillRatePercentage,
      unfilledMandatoryCount: result.report.unfilledMandatoryCount,
      report: result.report,
      processedRows: result.processedRows,
      columns: columns,
      rawRows: rawRows,
      engineErrors: result.report.errors || [],
      dictionaryFileName: dictionaryFileName,
      xmlFileName: xmlFileName,
      settings: settings
    });

    if (saved) {
      setHistory(getBatchHistory());
      if (auth.currentUser) {
        saveCatalogSessionToFirestore({
          id: saved.id,
          workspaceId: saved.workspaceId,
          filename: saved.filename,
          categoryTitle: saved.categoryTitle,
          productsCount: saved.productsCount,
          mandatoryColumnsCount: saved.mandatoryColumnsCount,
          newlyFilledCount: saved.newlyFilledCount,
          fillRatePercentage: saved.fillRatePercentage,
          unfilledMandatoryCount: saved.unfilledMandatoryCount
        }).catch(() => {});
      }
    }
  };

  // Handle clicking on any event in the history drawer:
  // Returns the user to the step/page where the ready template is shown with completeness & error report
  const handleSelectBatch = (batch: SavedBatchHistoryItem) => {
    setIsHistoryOpen(false);

    let targetReport = batch.report;
    let targetProcessedRows = batch.processedRows;
    let targetColumns = batch.columns;
    let targetRawRows = batch.rawRows;
    const cleanStaleErrors = (list: EngineErrorEvent[]) =>
      list.filter(
        err =>
          !err.id?.startsWith('err-col-id-') &&
          !err.message.includes('Відсутня обов\'язкова колонка ID') &&
          (err.phase !== 'photo_parsing' || !err.message.toLowerCase().includes('відсутнє фото'))
      );

    let targetErrors = cleanStaleErrors(batch.engineErrors || (batch.report?.errors || []));

    const availableRawRows =
      targetRawRows && targetRawRows.length > 0
        ? targetRawRows
        : batch.filename === templateFileName && rawRows.length > 0
        ? rawRows
        : null;

    if (availableRawRows && availableRawRows.length > 0) {
      const analyzedCols = analyzeEpicentrColumns(Object.keys(availableRawRows[0]));
      const res = runEpicentrFillingEngine(
        availableRawRows,
        analyzedCols,
        dictionaryIndex,
        batch.settings || settings
      );
      targetReport = res.report;
      targetProcessedRows = res.processedRows;
      targetColumns = analyzedCols;
      targetRawRows = availableRawRows;
      targetErrors = cleanStaleErrors(res.report.errors || []);
    } else if (!targetReport || !targetProcessedRows || targetProcessedRows.length === 0) {
      const matchedCat = SAMPLE_CATEGORIES.find(c =>
        batch.workspaceId.includes(c.id) ||
        batch.categoryTitle.toLowerCase().includes(c.title.toLowerCase()) ||
        batch.filename.toLowerCase().includes(c.id)
      ) || SAMPLE_CATEGORIES[0];

      const catCols = analyzeEpicentrColumns(Object.keys(matchedCat.defaultData[0]));
      const catDictIdx = buildDictionaryIndex(matchedCat.dictionaryData);
      const res = runEpicentrFillingEngine(matchedCat.defaultData, catCols, catDictIdx, batch.settings || settings);

      targetReport = res.report;
      targetProcessedRows = res.processedRows;
      targetColumns = catCols;
      targetRawRows = matchedCat.defaultData;
      targetErrors = cleanStaleErrors(res.report.errors || []);
    }

    if (targetReport) {
      targetReport = { ...targetReport, errors: targetErrors };
    }

    setReport(targetReport);
    setProcessedRows(targetProcessedRows);
    if (targetColumns && targetColumns.length > 0) {
      setColumns(analyzeEpicentrColumns(targetColumns.map(c => c.originalName)));
    }
    if (targetRawRows && targetRawRows.length > 0) setRawRows(targetRawRows);
    setEngineErrors(targetErrors);
    setTemplateFileName(batch.filename);
    if (batch.dictionaryFileName) setDictionaryFileName(batch.dictionaryFileName);
    if (batch.xmlFileName) setXmlFileName(batch.xmlFileName);
    if (batch.settings) setSettings(batch.settings);

    // Create raw workbook if missing so Excel download works
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(
      targetRawRows && targetRawRows.length > 0 ? targetRawRows : targetProcessedRows.map(p => p.updatedRow)
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Шаблон_Епіцентр');
    setRawWorkbook(wb);

    // Sync shop workspace if available
    const matchedShop = allShops.find(s => s.id === batch.workspaceId);
    if (matchedShop) {
      setCurrentShop(matchedShop);
      setCurrentWorkspaceId(matchedShop.id);
    }

    // Return user to Step 5 (completed) on the Report view!
    setWorkflowState('completed');
    setActiveTab('report');

    setRestoredBatchNotice({
      filename: batch.filename,
      timestamp: batch.timestamp,
      productsCount: batch.productsCount,
      fillRate: batch.fillRatePercentage,
      errorsCount: targetErrors.length
    });
  };

  // Clear history
  const handleClearHistory = () => {
    localStorage.removeItem('epicentr_saas_batch_history');
    setHistory([]);
  };

  // Update cell value handler for table edits and AI enrichment
  const handleUpdateCellValue = (rowIdx: number, columnName: string, newValue: string) => {
    setProcessedRows(prev => {
      const updated = [...prev];
      if (updated[rowIdx]) {
        updated[rowIdx] = {
          ...updated[rowIdx],
          updatedRow: {
            ...updated[rowIdx].updatedRow,
            [columnName]: newValue
          }
        };
      }
      return updated;
    });
    setRawRows(prev => {
      const updated = [...prev];
      if (updated[rowIdx]) {
        updated[rowIdx] = {
          ...updated[rowIdx],
          [columnName]: newValue
        };
      }
      return updated;
    });
  };

  // Reset to start over
  const handleReset = () => {
    setWorkflowState('upload');
    setProcessedRows([]);
    setReport(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0D14] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-[#FF6B00] selection:text-white transition-colors">
      {/* Top Navbar */}
      <EpicentrNavbar
        onOpenInstructions={() => setIsInstructionsOpen(true)}
        onOpenValidator={() => setIsValidatorOpen(true)}
        onOpenShare={() => setIsShareOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenGuide={() => setIsOnboardingOpen(true)}
        onOpenUserStories={() => setIsUserStoriesOpen(true)}
        onOpenApiKeySettings={() => {
          setMissingKeyWarning(null);
          setIsApiKeyModalOpen(true);
        }}
        hasCustomApiKey={hasCustomApiKey}
        onReset={handleReset}
        activeStep={workflowState === 'completed' ? 5 : workflowState === 'processing' ? 2 : 0}
        historyCount={history.length}
        currentShop={currentShop}
        allShops={allShops}
        onSelectShop={handleSelectShop}
        appVersion="v1.2.0"
        lastSavedTimestamp={lastSavedTimestamp}
        isAutoSaving={isAutoSaving}
        hasPendingChanges={hasPendingChanges}
        onManualSave={handleManualSave}
        onOpenXmlConverter={() => setActiveTab('converter')}
        isXmlConverterActive={activeTab === 'converter'}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenProfileDrawer={() => setIsProfileDrawerOpen(true)}
        onOpenImageStudio={() => setIsImageStudioOpen(true)}
        onOpenSearchGrounding={() => setIsSearchGroundingOpen(true)}
        onOpenChatbot={() => setIsChatbotOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {/* Processing Status Bar */}
        <ProcessingStatusBar
          templateFileName={templateFileName}
          dictionaryFileName={dictionaryFileName}
          xmlFileName={xmlFileName}
          photoCount={uploadedPhotos.length}
          rowCount={rawRows.length}
          columns={columns}
          isAutoSaving={isAutoSaving}
          hasPendingChanges={hasPendingChanges}
          lastSavedTimestamp={lastSavedTimestamp}
          hasCustomApiKey={hasCustomApiKey}
          onOpenApiKeySettings={() => {
            setMissingKeyWarning(null);
            setIsApiKeyModalOpen(true);
          }}
          onManualSave={handleManualSave}
          onOpenValidator={() => setIsValidatorOpen(true)}
          onOpenInstructions={() => setIsInstructionsOpen(true)}
        />

        {/* Soft Warning Notification Banner for Google AI Studio API Key */}
        {!hasCustomApiKey && !isAiWarningBannerDismissed && (
          <div className="mb-5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center text-[#FF7A00] shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Google AI Studio API Key не налаштовано</span>
                  <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                    Рекомендовано
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  Для активації функцій інтелектуального AI-дозаповнення характеристик та перевірки назв додайте власний ключ. У разі відсутності ключа застосунок використовує вбудовані словники.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setMissingKeyWarning(null);
                  setIsApiKeyModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#004BB7] hover:bg-blue-600 text-white font-bold transition-all shadow-xs cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Ввести ключ</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAiWarningBannerDismissed(true)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Приховати сповіщення"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Auto-Save Restoration Notification Banner */}
        {restoredFromAutoSave && (
          <div className="mb-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-700 dark:text-emerald-200 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-white">Сесію автоматично відновлено:</span>
                <span className="text-slate-600 dark:text-slate-300 ml-1.5">
                  Завантажено стан ({rawRows.length} товарів збережено о {lastSavedTimestamp ? new Date(lastSavedTimestamp).toLocaleTimeString('uk-UA') : 'попередній сесії'}).
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setRestoredFromAutoSave(false)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors cursor-pointer"
              >
                Зрозуміло
              </button>
              <button
                type="button"
                onClick={handleDiscardAutoSave}
                className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-300 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Скинути
              </button>
            </div>
          </div>
        )}

        {/* Restored Batch from History Banner */}
        {restoredBatchNotice && (
          <div className="mb-5 bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-700 dark:text-blue-200 shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-500 dark:text-blue-400 shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white">Відновлено партію з історії:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 border border-blue-500/30 text-blue-600 dark:text-blue-300 font-mono text-[11px] font-bold">
                    {restoredBatchNotice.filename}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                    {restoredBatchNotice.fillRate}% заповнено
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setRestoredBatchNotice(null)}
                className="px-3.5 py-1.5 rounded-xl bg-[#004BB7] hover:bg-blue-600 text-white font-bold transition-colors cursor-pointer"
              >
                Зрозуміло
              </button>
            </div>
          </div>
        )}

        {/* Active View: Converter / Processing / Completed tabs / File upload */}
        {activeTab === 'converter' ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab(workflowState === 'completed' ? 'report' : 'upload')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                ← Повернутися до обробки Excel
              </button>
            </div>
            <EpicentrXmlConverterView onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)} />
          </div>
        ) : workflowState === 'processing' ? (
          <ProcessingProgressView
            onComplete={handleProcessingComplete}
            productsCount={rawRows.length}
          />
        ) : workflowState === 'completed' && report ? (
          <div className="space-y-6">
            {/* View Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('report')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeTab === 'report'
                      ? 'bg-[#FF6B00] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Підсумок та звіт</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('table')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeTab === 'table'
                      ? 'bg-[#FF6B00] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Таблиця змін (Diff: {processedRows.length} товарів)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('monitor')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeTab === 'monitor'
                      ? 'bg-[#FF7A00] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Bug className="w-4 h-4" />
                  <span>Моніторинг помилок</span>
                  {engineErrors.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500/20 text-[10px] text-amber-600 dark:text-amber-300 font-mono font-bold">
                      {engineErrors.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('converter')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer bg-slate-100 dark:bg-slate-800/80 border border-amber-500/30 text-amber-600 dark:text-amber-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <FileCode className="w-4 h-4 text-[#FF7A00]" />
                  <span>Генератор XML-фідів</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    activeTab === 'upload'
                      ? 'bg-[#004BB7] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Завантажити інший файл</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleProcessingComplete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Перезапустити заповнення</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsShareOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF6B00]/15 hover:bg-[#FF6B00]/25 border border-[#FF6B00]/30 text-[#FF7A00] font-semibold transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Надати результат</span>
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
                rawWorkbook={rawWorkbook}
                originalFileName={templateFileName}
                dictionaryIndex={dictionaryIndex}
                onOpenApiKeySettings={() => {
                  setMissingKeyWarning(null);
                  setIsApiKeyModalOpen(true);
                }}
                onUpdateCellValue={handleUpdateCellValue}
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
                onLoadPhotos={(photos) => setUploadedPhotos(photos)}
                templateFileName={templateFileName}
                dictionaryFileName={dictionaryFileName}
                xmlFileName={xmlFileName}
                uploadedPhotos={uploadedPhotos}
                columns={columns}
                rowCount={rawRows.length}
                onProceedToClarification={() => setIsClarificationOpen(true)}
                onOpenShare={() => setIsShareOpen(true)}
                onOpenXmlConverter={() => setActiveTab('converter')}
                onOpenEpicentrTokenModal={() => setIsEpicentrTokenModalOpen(true)}
              />
            )}
          </div>
        ) : (
          <FileUploadSection
            onLoadTemplate={handleLoadTemplate}
            onLoadDictionary={handleLoadDictionary}
            onLoadXml={(xmlStr, fName) => setXmlFileName(fName)}
            onLoadPhotos={(photos) => setUploadedPhotos(photos)}
            templateFileName={templateFileName}
            dictionaryFileName={dictionaryFileName}
            xmlFileName={xmlFileName}
            uploadedPhotos={uploadedPhotos}
            columns={columns}
            rowCount={rawRows.length}
            onProceedToClarification={() => setIsClarificationOpen(true)}
            onOpenShare={() => setIsShareOpen(true)}
            onOpenXmlConverter={() => setActiveTab('converter')}
            onOpenEpicentrTokenModal={() => setIsEpicentrTokenModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-4 px-4 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0A0D14] shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span>
              Маркетплейс Епіцентр © {new Date().getFullYear()} — Автоматизоване заповнення обов'язкових характеристик Excel.
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
            <button
              onClick={() => setIsUserStoriesOpen(true)}
              className="text-[#FF7A00] dark:text-[#FF7A00] hover:text-[#d96500] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Лабораторія змін ({appVersion})</span>
            </button>
            <button
              onClick={() => setIsShareOpen(true)}
              className="text-[#FF7A00] hover:text-[#d96500] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Надати доступ іншим</span>
            </button>
            <button onClick={() => setIsOnboardingOpen(true)} className="hover:text-[#FF7A00] transition-colors cursor-pointer">
              Як це працює
            </button>
            <button onClick={() => setIsInstructionsOpen(true)} className="hover:text-[#FF7A00] transition-colors cursor-pointer">
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
        onSelectBatch={handleSelectBatch}
      />

      {/* User Story & Release Compiler Modal */}
      <UserStoryReleaseModal
        isOpen={isUserStoriesOpen}
        onClose={() => setIsUserStoriesOpen(false)}
        onVersionUpdated={(newVer) => setAppVersion(newVer)}
        onOpenApprovalModal={(token) => {
          setApprovalToken(token);
          setIsAdminApprovalOpen(true);
        }}
        onOpenApiKeySettings={() => setIsApiKeyModalOpen(true)}
      />

      {/* Admin Approval Modal for Moderator (token-based or manual) */}
      <AdminApprovalModal
        token={approvalToken}
        isOpen={isAdminApprovalOpen}
        onClose={() => {
          setIsAdminApprovalOpen(false);
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            const url = new URL(window.location.href);
            url.searchParams.delete('approval_token');
            const searchStr = url.searchParams.toString();
            window.history.replaceState({}, '', url.pathname + (searchStr ? `?${searchStr}` : '') + url.hash);
          }
        }}
        onReleaseDeployed={(release) => {
          setAppVersion(release.version);
        }}
        onOpenApiKeySettings={() => setIsApiKeyModalOpen(true)}
      />

      {/* Google AI Studio API Key Settings Modal */}
      <ApiKeySettingsModal
        isOpen={isApiKeyModalOpen}
        onClose={() => {
          setIsApiKeyModalOpen(false);
          setMissingKeyWarning(null);
        }}
        onKeySaved={(newKey) => {
          setHasCustomApiKey(!!newKey);
        }}
        initialWarningMessage={missingKeyWarning}
      />

      {/* Epicentr Merchant API Token Modal */}
      <EpicentrTokenModal
        isOpen={isEpicentrTokenModalOpen}
        onClose={() => setIsEpicentrTokenModalOpen(false)}
      />

      {/* Seller Authentication Modal (Sign In / Register / Reset Password) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(u) => {
          setCurrentUser(u);
          setIsAuthModalOpen(false);
        }}
      />

      {/* Seller Profile & Settings Slide-over Drawer */}
      <UserProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        onLogout={() => {
          authService.logout();
          setCurrentUser(null);
          setIsProfileDrawerOpen(false);
        }}
      />

      {/* AI Image Studio Modal (gemini-nano-banana-2.1) */}
      <ImageStudioModal
        isOpen={isImageStudioOpen}
        onClose={() => setIsImageStudioOpen(false)}
        uploadedPhotos={uploadedPhotos}
        onAddPhotoToCatalog={(newPhoto) => {
          setUploadedPhotos((prev) => [newPhoto, ...prev]);
        }}
      />

      {/* Google Search Grounding Modal (gemini-3.8-flash) */}
      <SearchGroundingModal
        isOpen={isSearchGroundingOpen}
        onClose={() => setIsSearchGroundingOpen(false)}
        rawRows={rawRows}
      />

      {/* Multi-turn Gemini Chatbot Drawer (gemini-4-argon, gemini-3.8-flash, gemini-3.1-flash-lite) */}
      <GeminiChatbotDrawer
        isOpen={isChatbotOpen}
        onClose={() => setIsChatbotOpen(false)}
        catalogSummary={`Магазин: ${currentShop.name} (${currentShop.sellerCode}). Файл шаблону: ${
          templateFileName || 'не вибрано'
        }. Кількість товарів: ${rawRows.length}. Колонок: ${columns.length} (обов'язкових: ${
          columns.filter((c) => c.isRequired).length
        }).`}
      />

      {/* Floating Quick-Launch Chatbot Button */}
      {!isChatbotOpen && (
        <button
          type="button"
          onClick={() => setIsChatbotOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-[#004BB7] to-[#FF6B00] hover:from-blue-700 hover:to-[#e66000] text-white font-extrabold text-xs shadow-xl border border-white/20 transition-transform hover:scale-105 cursor-pointer"
          title="Відкрити ШІ-Консультанта Епіцентру"
        >
          <MessageSquare className="w-4 h-4" />
          <span>ШІ-Консультант Gemini</span>
        </button>
      )}
    </div>
  );
}

export default App;
