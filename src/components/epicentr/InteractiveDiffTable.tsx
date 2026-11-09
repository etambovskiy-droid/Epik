/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  EpicentrColumn,
  EpicentrProductRow
} from '../../types/epicentr';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldCheck,
  Languages,
  Eye,
  Camera,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Tag,
  Maximize2,
  Download,
  FileSpreadsheet,
  Copy,
  Check,
  Sparkles,
  Columns,
  Share2,
  KeyRound,
  RefreshCw,
  Globe,
  Pencil,
  Zap,
  Clock,
  X,
  CheckSquare,
  Square,
  MinusSquare,
  Sliders,
  Wand2,
  Lock
} from 'lucide-react';
import { ContextualFeedbackModal } from '../ContextualFeedbackModal';
import { ContextSnapshot } from '../../types/feedback';
import {
  generateEpicentrExportWorkbook,
  findDictionaryAttr,
  sanitizeValueAgainstDictionary,
  areAllMandatoryCharacteristicsFilled,
  analyzeEpicentrTitleFormula,
  autoFixEpicentrTitle
} from '../../services/epicentrEngine';
import { EpicentrDictionaryAttribute } from '../../types/epicentr';
import {
  notifyMissingApiKey,
  enrichProductMandatoryWithAI,
  enrichProductsBatchWithAI,
  researchProductAttributesWithWebGrounding,
  GroundedResearchResult,
  BatchEnrichmentProgressMetrics
} from '../../services/geminiFillingService';
import { getStoredApiKey, hasUserApiKey } from '../../services/aiApiKeyService';
import { authService } from '../../services/authService';
import { canAccessFeature, getDemoRestrictionMessage } from '../../services/permissionService';

interface InteractiveDiffTableProps {
  columns: EpicentrColumn[];
  rows: EpicentrProductRow[];
  rawWorkbook?: XLSX.WorkBook | null;
  originalFileName?: string | null;
  dictionaryIndex?: Record<string, EpicentrDictionaryAttribute>;
  onOpenApiKeySettings?: () => void;
  onUpdateCellValue?: (rowIdx: number, columnName: string, newValue: string) => void;
  onUpdateRowValues?: (
    rowIdx: number,
    updates: Record<string, string>,
    sources?: { uri: string; title: string }[],
    explanations?: Record<string, string>
  ) => void;
  onDemoRestricted?: (featureName: string) => void;
}

export const InteractiveDiffTable: React.FC<InteractiveDiffTableProps> = ({
  columns,
  rows,
  rawWorkbook = null,
  originalFileName = null,
  dictionaryIndex,
  onOpenApiKeySettings,
  onUpdateCellValue,
  onUpdateRowValues,
  onDemoRestricted
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<
    'all' | 'mandatory' | 'unfilled' | 'agent_filled' | 'photo_filled' | 'lang_fixes' | 'brand_other' | 'invalid_titles'
  >('all');
  const [showOnlyMandatoryCols, setShowOnlyMandatoryCols] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [expandedRowIdx, setExpandedRowIdx] = useState<number | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiProgressMessage, setAiProgressMessage] = useState<string | null>(null);
  const [progressMetrics, setProgressMetrics] = useState<BatchEnrichmentProgressMetrics | null>(null);
  const [googleSheetExportOpen, setGoogleSheetExportOpen] = useState(false);

  // Multi-select & Bulk Toolbar state
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const [lastSelectedRowIdx, setLastSelectedRowIdx] = useState<number | null>(null);

  // Bulk assignment modal state
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkAssignCol, setBulkAssignCol] = useState<string>('');
  const [bulkAssignVal, setBulkAssignVal] = useState<string>('');

  // Title Formula Inspector state
  const [activeTitlePopoverRowIdx, setActiveTitlePopoverRowIdx] = useState<number | null>(null);
  const [isBulkFixingTitles, setIsBulkFixingTitles] = useState(false);

  // Domain/Merchant Website Search state
  const [merchantDomain, setMerchantDomain] = useState('');
  const [restrictToDomain, setRestrictToDomain] = useState(false);
  const curUser = authService.getCurrentUser();
  const isDemoUser = curUser?.isDemo === true;

  // Manual Cell Editing and "Apply to All" state
  const [editingCell, setEditingCell] = useState<{
    rowIdx: number;
    colName: string;
    value: string;
  } | null>(null);

  // Track columns where values were manually entered or edited
  const [manuallyEditedCols, setManuallyEditedCols] = useState<
    Record<string, { lastValue: string; lastRowIdx: number }>
  >({});

  // Prompt banner for quick 1-click propagation to all empty rows
  const [applyToAllPrompt, setApplyToAllPrompt] = useState<{
    colName: string;
    cleanColName: string;
    value: string;
    emptyCount: number;
  } | null>(null);

  // Success / info toast notification
  const [notificationToast, setNotificationToast] = useState<{
    message: string;
    type: 'success' | 'info';
  } | null>(null);

  // Contextual feedback modal state
  const [feedbackSnapshot, setFeedbackSnapshot] = useState<ContextSnapshot | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const handleOpenFeedback = (
    rowIdx: number,
    colName: string,
    colIndex: number,
    rawValue: any,
    parsedValue: any,
    attributeId?: string,
    allowedValuesSample?: string[],
    errorMessage?: string
  ) => {
    setFeedbackSnapshot({
      categoryId: '10542',
      categoryName: 'Епіцентр Маркетплейс',
      rowIndex: rowIdx,
      columnIndex: colIndex,
      columnName: colName,
      attributeId,
      rawValue,
      parsedValue,
      allowedValuesSample,
      errorMessage
    });
    setIsFeedbackModalOpen(true);
  };

  // Propagates a value to ALL empty cells in the specified column
  const handleApplyToAllEmpty = (colName: string, valueToApply: string) => {
    if (!valueToApply || valueToApply.trim() === '') return;
    const col = columns.find(c => c.originalName === colName || c.cleanName === colName);
    const targetColName = col ? col.originalName : colName;
    const cleanName = col ? col.cleanName : colName;

    // Find all rows where target column is currently empty
    const emptyRows = rows.filter(r => {
      const cur = r.updatedRow ? r.updatedRow[targetColName] : undefined;
      return (
        cur === undefined ||
        cur === null ||
        String(cur).trim() === '' ||
        String(cur).toLowerCase() === 'nan'
      );
    });

    if (emptyRows.length === 0) {
      setNotificationToast({
        message: `Усі клітинки в колонці "${cleanName}" вже заповнені!`,
        type: 'info'
      });
      setTimeout(() => setNotificationToast(null), 3000);
      return;
    }

    if (onUpdateCellValue) {
      emptyRows.forEach(r => {
        onUpdateCellValue(r.rowIdx, targetColName, valueToApply);
      });
    }

    // Record as manually applied column
    setManuallyEditedCols(prev => ({
      ...prev,
      [targetColName]: { lastValue: valueToApply, lastRowIdx: emptyRows[0].rowIdx }
    }));

    setApplyToAllPrompt(null);
    setNotificationToast({
      message: `Значення "${valueToApply}" успішно застосовано до ${emptyRows.length} порожніх товарів у колонці "${cleanName}"!`,
      type: 'success'
    });
    setTimeout(() => setNotificationToast(null), 4500);
  };

  // Saves a manually edited cell and offers the "Apply to All" action
  const handleSaveCell = (rowIdx: number, colName: string, newValue: string) => {
    let trimmed = newValue.trim();
    const col = columns.find(c => c.originalName === colName || c.cleanName === colName);
    const cleanName = col ? col.cleanName : colName;

    // Strict dictionary validation & normalization for select/multiselect columns
    if (trimmed && col && dictionaryIndex && (col.type === 'select' || col.type === 'multiselect')) {
      const dictAttr = findDictionaryAttr(dictionaryIndex, col.cleanName || col.originalName);
      if (dictAttr && dictAttr.allowedValues && dictAttr.allowedValues.length > 0) {
        trimmed = sanitizeValueAgainstDictionary(trimmed, dictAttr.allowedValues, col.type === 'multiselect');
      }
    }

    if (onUpdateCellValue) {
      onUpdateCellValue(rowIdx, colName, trimmed);
    }

    if (trimmed) {
      setManuallyEditedCols(prev => ({
        ...prev,
        [colName]: { lastValue: trimmed, lastRowIdx: rowIdx }
      }));

      // Count remaining empty rows in this column
      const emptyCount = rows.filter(r => {
        if (r.rowIdx === rowIdx) return false;
        const cur = r.updatedRow ? r.updatedRow[colName] : undefined;
        return (
          cur === undefined ||
          cur === null ||
          String(cur).trim() === '' ||
          String(cur).toLowerCase() === 'nan'
        );
      }).length;

      if (emptyCount > 0) {
        setApplyToAllPrompt({
          colName,
          cleanColName: cleanName,
          value: trimmed,
          emptyCount
        });
      }
    }

    setEditingCell(null);
  };

  // Mandatory columns only for high-density display
  const mandatoryCols = columns.filter(c => c.isRequired);
  const displayCols = showOnlyMandatoryCols ? mandatoryCols : columns;

  // Dynamic lookup for Ukrainian and Russian title columns and SKU column
  const titleUaCol =
    columns.find(c => c.lang === 'ua' && c.cleanName.toLowerCase().includes('назва')) ||
    columns.find(c => !c.lang && c.cleanName.toLowerCase().includes('назва'));
  const titleRuCol = columns.find(c => c.lang === 'ru' && c.cleanName.toLowerCase().includes('назва'));
  const skuCol = columns.find(
    c => c.cleanName.toLowerCase().includes('артикул') || c.cleanName.toLowerCase() === 'sku'
  );

  // Filter rows based on search and selected pill
  const filteredRows = rows.filter(r => {
    if (!r) return false;
    // Search query
    const sQuery = (searchQuery || '').toLowerCase().trim();
    const matchSearch =
      !sQuery ||
      String(r.id || '').toLowerCase().includes(sQuery) ||
      String(r.titleOriginal || '').toLowerCase().includes(sQuery) ||
      String(r.vendorCode || '').toLowerCase().includes(sQuery) ||
      String(r.brand || '').toLowerCase().includes(sQuery);

    if (!matchSearch) return false;

    // Filter mode
    if (filterMode === 'mandatory') {
      return true;
    }
    if (filterMode === 'unfilled') {
      return Array.isArray(r.unfilledRequiredFields) && r.unfilledRequiredFields.length > 0;
    }
    if (filterMode === 'agent_filled') {
      return Object.values(r.diffs || {}).some(d => d && d.source !== 'already_filled' && d.newValue);
    }
    if (filterMode === 'photo_filled') {
      return Object.values(r.diffs || {}).some(d => d && d.source === 'photo');
    }
    if (filterMode === 'lang_fixes') {
      return Array.isArray(r.languageCorrections) && r.languageCorrections.length > 0;
    }
    if (filterMode === 'brand_other') {
      return Boolean(r.isBrandOther);
    }
    if (filterMode === 'invalid_titles') {
      const curTitle = (titleUaCol ? r.updatedRow[titleUaCol.originalName] : undefined) || r.titleOriginal || '';
      return !analyzeEpicentrTitleFormula(curTitle, r.brand, r.vendorCode).isValid;
    }
    return true;
  });

  // Multi-selection helpers
  const allFilteredSelected =
    filteredRows.length > 0 && filteredRows.every(r => selectedRowIndices.has(r.rowIdx));
  const someFilteredSelected =
    filteredRows.some(r => selectedRowIndices.has(r.rowIdx)) && !allFilteredSelected;

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedRowIndices);
      filteredRows.forEach(r => next.delete(r.rowIdx));
      setSelectedRowIndices(next);
    } else {
      const next = new Set(selectedRowIndices);
      filteredRows.forEach(r => next.add(r.rowIdx));
      setSelectedRowIndices(next);
    }
  };

  const handleSelectRow = (rowIdx: number, shiftKey: boolean) => {
    const next = new Set(selectedRowIndices);
    if (shiftKey && lastSelectedRowIdx !== null) {
      const idxA = filteredRows.findIndex(r => r.rowIdx === lastSelectedRowIdx);
      const idxB = filteredRows.findIndex(r => r.rowIdx === rowIdx);
      if (idxA !== -1 && idxB !== -1) {
        const start = Math.min(idxA, idxB);
        const end = Math.max(idxA, idxB);
        for (let i = start; i <= end; i++) {
          next.add(filteredRows[i].rowIdx);
        }
        setSelectedRowIndices(next);
        setLastSelectedRowIdx(rowIdx);
        return;
      }
    }

    if (next.has(rowIdx)) {
      next.delete(rowIdx);
    } else {
      next.add(rowIdx);
    }
    setSelectedRowIndices(next);
    setLastSelectedRowIdx(rowIdx);
  };

  const handleClearSelection = () => {
    setSelectedRowIndices(new Set());
    setLastSelectedRowIdx(null);
  };

  const handleSelectInvalidTitles = () => {
    const next = new Set(selectedRowIndices);
    filteredRows.forEach(r => {
      const curTitle = (titleUaCol ? r.updatedRow[titleUaCol.originalName] : undefined) || r.titleOriginal || '';
      const analysis = analyzeEpicentrTitleFormula(curTitle, r.brand, r.vendorCode);
      if (!analysis.isValid) {
        next.add(r.rowIdx);
      }
    });
    setSelectedRowIndices(next);
  };

  const handleSelectUnfilledMandatory = () => {
    const next = new Set(selectedRowIndices);
    filteredRows.forEach(r => {
      if (!areAllMandatoryCharacteristicsFilled(r.updatedRow, columns)) {
        next.add(r.rowIdx);
      }
    });
    setSelectedRowIndices(next);
  };

  // 1-Click Single Title Fix
  const handleFixSingleTitle = (pRow: EpicentrProductRow) => {
    const targetCol = titleUaCol || columns.find(c => c.cleanName.toLowerCase().includes('назва'));
    if (!targetCol) return;
    const currentTitle = String(pRow.updatedRow[targetCol.originalName] || pRow.titleOriginal || '');
    const fixed = autoFixEpicentrTitle(currentTitle, pRow.brand, pRow.vendorCode);
    if (fixed && onUpdateCellValue) {
      onUpdateCellValue(pRow.rowIdx, targetCol.originalName, fixed);
      setNotificationToast({
        message: `Назву товару "${pRow.id}" нормалізовано за формулою Епіцентру!`,
        type: 'success'
      });
      setTimeout(() => setNotificationToast(null), 3000);
    }
    setActiveTitlePopoverRowIdx(null);
  };

  // Batch Title Fix for Selected Rows
  const handleBatchFixTitlesForSelected = () => {
    if (selectedRowIndices.size === 0) return;
    setIsBulkFixingTitles(true);
    let count = 0;
    try {
      const targetCol = titleUaCol || columns.find(c => c.cleanName.toLowerCase().includes('назва'));
      if (!targetCol) return;

      rows.forEach(r => {
        if (selectedRowIndices.has(r.rowIdx)) {
          const currentTitle = String(r.updatedRow[targetCol.originalName] || r.titleOriginal || '');
          const fixed = autoFixEpicentrTitle(currentTitle, r.brand, r.vendorCode);
          if (fixed && fixed !== currentTitle) {
            if (onUpdateCellValue) {
              onUpdateCellValue(r.rowIdx, targetCol.originalName, fixed);
            }
            count++;
          }
        }
      });

      setNotificationToast({
        message: `Успішно нормалізовано за формулою Епіцентру: ${count} назв товарів!`,
        type: 'success'
      });
      setTimeout(() => setNotificationToast(null), 4000);
    } finally {
      setIsBulkFixingTitles(false);
    }
  };

  // Export Selected Rows to Excel
  const handleExportSelectedExcel = () => {
    const curUser = authService.getCurrentUser();
    if (!canAccessFeature('EXPORT_CATALOG_FILE', curUser)) {
      if (onDemoRestricted) {
        onDemoRestricted('Експорт вибраних рядків Excel');
      } else {
        setNotificationToast({
          message: getDemoRestrictionMessage('Експорт заповненого Excel'),
          type: 'info'
        });
        setTimeout(() => setNotificationToast(null), 5000);
      }
      return;
    }
    try {
      const selectedRows = rows.filter(r => selectedRowIndices.has(r.rowIdx));
      if (selectedRows.length === 0) return;
      const exportWb = generateEpicentrExportWorkbook(rawWorkbook, selectedRows, columns, dictionaryIndex);
      const outName = originalFileName
        ? `Вибрані_${selectedRows.length}_${originalFileName.replace(/\.(xlsx|xls|csv)$/i, '')}.xlsx`
        : `Епіцентр_Вибрані_${selectedRows.length}_товарів.xlsx`;
      XLSX.writeFile(exportWb, outName);
      setNotificationToast({
        message: `Експортовано ${selectedRows.length} вибраних товарів у файл ${outName}`,
        type: 'success'
      });
      setTimeout(() => setNotificationToast(null), 3500);
    } catch (err) {
      console.error('Failed to export selected rows:', err);
    }
  };

  // Bulk Assign Value to Selected Rows
  const handleApplyBulkAssignment = () => {
    if (!bulkAssignCol || !bulkAssignVal.trim() || selectedRowIndices.size === 0) return;
    const col = columns.find(c => c.originalName === bulkAssignCol || c.cleanName === bulkAssignCol);
    if (!col) return;

    let sanitizedVal = bulkAssignVal.trim();
    const dictAttr = dictionaryIndex ? findDictionaryAttr(dictionaryIndex, col.cleanName || col.originalName) : undefined;
    if (dictAttr && dictAttr.allowedValues && dictAttr.allowedValues.length > 0) {
      sanitizedVal = sanitizeValueAgainstDictionary(sanitizedVal, dictAttr.allowedValues, col.type === 'multiselect');
      if (!sanitizedVal) {
        setNotificationToast({
          message: `Значення не відповідає довіднику Епіцентру для колонки "${col.cleanName}"`,
          type: 'info'
        });
        setTimeout(() => setNotificationToast(null), 4000);
        return;
      }
    }

    let updatedCount = 0;
    rows.forEach(r => {
      if (selectedRowIndices.has(r.rowIdx)) {
        if (onUpdateCellValue) {
          onUpdateCellValue(r.rowIdx, col.originalName, sanitizedVal);
          updatedCount++;
        }
      }
    });

    setIsBulkAssignOpen(false);
    setBulkAssignVal('');
    setNotificationToast({
      message: `Призначено "${sanitizedVal}" для ${updatedCount} вибраних товарів у колонці "${col.cleanName}"`,
      type: 'success'
    });
    setTimeout(() => setNotificationToast(null), 4000);
  };

  // Quick Export to Excel .xlsx
  const handleExportExcel = () => {
    const curUser = authService.getCurrentUser();
    if (!canAccessFeature('EXPORT_CATALOG_FILE', curUser)) {
      if (onDemoRestricted) {
        onDemoRestricted('Експорт заповненого Excel-файлу');
      } else {
        setNotificationToast({
          message: getDemoRestrictionMessage('Експорт заповненого Excel'),
          type: 'info'
        });
        setTimeout(() => setNotificationToast(null), 5000);
      }
      return;
    }
    try {
      const exportWb = generateEpicentrExportWorkbook(rawWorkbook, rows, columns, dictionaryIndex);
      const outName = originalFileName
        ? `Заповнено_${originalFileName.replace(/\.(xlsx|xls|csv)$/i, '')}.xlsx`
        : 'Епіцентр_Шаблон_Заповнено.xlsx';

      XLSX.writeFile(exportWb, outName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to export Excel file:', err);
    }
  };

  // Quick Export to CSV
  const handleExportCsv = () => {
    const curUser = authService.getCurrentUser();
    if (!canAccessFeature('EXPORT_CATALOG_FILE', curUser)) {
      if (onDemoRestricted) {
        onDemoRestricted('Експорт у форматі CSV');
      } else {
        setNotificationToast({
          message: getDemoRestrictionMessage('Експорт у форматі CSV'),
          type: 'info'
        });
        setTimeout(() => setNotificationToast(null), 5000);
      }
      return;
    }
    try {
      const dataToExport = filteredRows.map(r => {
        const rowCopy = { ...r.updatedRow };
        if (titleUaCol) {
          rowCopy[titleUaCol.originalName] =
            r.updatedRow[titleUaCol.originalName] ||
            r.titleFormattedUa ||
            (r.originalRow ? r.originalRow[titleUaCol.originalName] : '') ||
            r.titleOriginal ||
            '';
        }
        if (titleRuCol) {
          rowCopy[titleRuCol.originalName] =
            r.updatedRow[titleRuCol.originalName] ||
            r.titleFormattedRu ||
            (r.originalRow ? r.originalRow[titleRuCol.originalName] : '') ||
            '';
        }
        return rowCopy;
      });
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const csvStr = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Епіцентр_Експорт_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    }
  };

  // Quick Copy to Clipboard (TSV format compatible with Excel copy-paste)
  const handleCopyToClipboard = () => {
    try {
      if (filteredRows.length === 0) return;
      const headers = [
        'ID',
        titleUaCol?.originalName || 'Назва товару [ua]*',
        ...(titleRuCol ? [titleRuCol.originalName] : []),
        skuCol?.originalName || 'Артикул*',
        ...displayCols
          .filter(
            c =>
              !c.cleanName.toLowerCase().includes('назва') &&
              !c.cleanName.toLowerCase().includes('артикул') &&
              !c.cleanName.toLowerCase().includes('id')
          )
          .map(c => c.cleanName)
      ];

      const rowsData = filteredRows.map(r => {
        const uaTitle =
          (titleUaCol ? r.updatedRow[titleUaCol.originalName] : '') ||
          r.titleFormattedUa ||
          (titleUaCol && r.originalRow ? r.originalRow[titleUaCol.originalName] : '') ||
          r.titleOriginal;
        const ruTitle =
          (titleRuCol ? r.updatedRow[titleRuCol.originalName] : '') ||
          r.titleFormattedRu ||
          (titleRuCol && r.originalRow ? r.originalRow[titleRuCol.originalName] : '') ||
          '';
        const skuVal =
          r.vendorCode || (skuCol ? r.updatedRow[skuCol.originalName] : '') || '';
        const rowVals = [
          r.id,
          uaTitle,
          ...(titleRuCol ? [ruTitle] : []),
          skuVal
        ];
        displayCols
          .filter(
            c =>
              !c.cleanName.toLowerCase().includes('назва') &&
              !c.cleanName.toLowerCase().includes('артикул') &&
              !c.cleanName.toLowerCase().includes('id')
          )
          .forEach(col => {
            rowVals.push(String(r.updatedRow[col.originalName] || ''));
          });
        return rowVals.join('\t');
      });

      const tsvContent = [headers.join('\t'), ...rowsData].join('\n');
      navigator.clipboard.writeText(tsvContent).then(() => {
        setCopiedSuccess(true);
        setTimeout(() => setCopiedSuccess(false), 2500);
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const [enableWebGrounding, setEnableWebGrounding] = useState(true);
  const [researchingRowIdx, setResearchingRowIdx] = useState<number | null>(null);
  const [webGroundingSourcesMap, setWebGroundingSourcesMap] = useState<
    Record<number, { sources: { uri: string; title: string }[]; explanations: Record<string, string> }>
  >({});
  const [researchModalProduct, setResearchModalProduct] = useState<{
    row: EpicentrProductRow;
    result: GroundedResearchResult;
    selectedKeys: Record<string, boolean>;
  } | null>(null);

  // 2-Step Cascading AI & Google Search Grounding filling with Concurrency Pool (12), Batching (5), Series Cache & Zero-AI Cutoff
  const handleTriggerAiFilling = async (opts?: {
    forceWebGrounding?: boolean;
    onlyMandatory?: boolean;
    targetRowIndices?: Set<number>;
  }) => {
    const user = authService.getCurrentUser();
    if (!canAccessFeature('AI_FILL_CHARACTERISTICS', user)) {
      if (onDemoRestricted) {
        onDemoRestricted('ШІ-заповнення характеристик');
      } else {
        setNotificationToast({
          message: getDemoRestrictionMessage('ШІ-заповнення характеристик'),
          type: 'info'
        });
        setTimeout(() => setNotificationToast(null), 5000);
      }
      return;
    }

    if (!hasUserApiKey()) {
      if (onOpenApiKeySettings) {
        onOpenApiKeySettings();
      }
      setNotificationToast({
        message: 'Для ШІ-заповнення характеристик потрібен власний Google AI Studio API Key. Будь ласка, вкажіть ваш ключ.',
        type: 'info'
      });
      setTimeout(() => setNotificationToast(null), 5000);
      return;
    }

    const useGrounding = opts?.forceWebGrounding !== undefined ? opts.forceWebGrounding : enableWebGrounding;
    const onlyMandatory = Boolean(opts?.onlyMandatory);

    // Identify rows with empty mandatory or optional characteristic columns
    const fillableCols = columns.filter(c => {
      const cleanLower = (c.cleanName || c.originalName).toLowerCase();
      if (
        cleanLower === 'id' ||
        cleanLower === 'артикул' ||
        cleanLower.startsWith('назва товару') ||
        cleanLower.startsWith('опис') ||
        cleanLower === 'ціна' ||
        cleanLower.includes('фото') ||
        cleanLower.includes('зображення') ||
        cleanLower.includes('photo') ||
        cleanLower.includes('image')
      ) {
        return false;
      }
      return true;
    });

    let unfilledRows = rows
      .map((r, idx) => ({ r, idx, updatedRow: r.updatedRow }))
      .filter(({ r }) => {
        if (opts?.targetRowIndices && !opts.targetRowIndices.has(r.rowIdx)) {
          return false;
        }
        return fillableCols.some(c => {
          const val = r.updatedRow[c.originalName];
          return val === undefined || val === null || String(val).trim() === '';
        });
      });

    if (onlyMandatory) {
      unfilledRows = unfilledRows.filter(({ updatedRow }) => !areAllMandatoryCharacteristicsFilled(updatedRow, columns));
    }

    if (unfilledRows.length === 0) {
      setAiProgressMessage(
        onlyMandatory
          ? 'Усі обовʼязкові поля зі зірочкою (*) для показаних товарів вже заповнено!'
          : 'Усі характеристики для показаних товарів вже заповнено!'
      );
      setTimeout(() => setAiProgressMessage(null), 3500);
      return;
    }

    setIsAiProcessing(true);
    setProgressMetrics({
      processed: 0,
      total: unfilledRows.length,
      speed: 0,
      etaSeconds: 0,
      savedApiCalls: 0,
      zeroAiCount: 0,
      seriesCacheHits: 0,
      stage: useGrounding
        ? `Підготовка до точкового Grounding (${unfilledRows.length} тов.)...`
        : `Підготовка до експрес AI-обробки (${unfilledRows.length} тов.)...`
    });

    try {
      const stats = await enrichProductsBatchWithAI(unfilledRows, columns, dictionaryIndex || {}, {
        useWebGrounding: useGrounding,
        merchantDomain,
        restrictToDomain,
        concurrency: 12,
        itemsPerPrompt: 5,
        onlyMandatoryUnfilledGrounding: onlyMandatory,
        onProgressMetrics: (metrics) => {
          setProgressMetrics(metrics);
        },
        onStageUpdate: (msg) => {
          setAiProgressMessage(msg);
        },
        onItemEnriched: (item, result) => {
          if (onUpdateRowValues && result.suggestedValues && Object.keys(result.suggestedValues).length > 0) {
            onUpdateRowValues(item.idx, result.suggestedValues, result.sources, result.explanations);
          } else if (result.suggestedValues && Object.keys(result.suggestedValues).length > 0) {
            for (const [colName, val] of Object.entries(result.suggestedValues)) {
              if (val && onUpdateCellValue) {
                onUpdateCellValue(item.idx, colName, String(val));
              }
            }
          }

          if (result.sources && result.sources.length > 0) {
            setWebGroundingSourcesMap(prev => ({
              ...prev,
              [item.idx]: {
                sources: result.sources || [],
                explanations: result.explanations || {}
              }
            }));
          }
        }
      });

      if (useGrounding) {
        setAiProgressMessage(
          `Готово! Оброблено: ${stats.totalProcessed}, збережено API: ${stats.savedApiCallsCount} (Zero-AI: ${stats.zeroAiCount}, Кеш серій: ${stats.seriesCacheHits})`
        );
      } else {
        setAiProgressMessage(
          `Експрес AI завершено! Оброблено: ${stats.totalProcessed}, Зекономлено запитів API: ${stats.savedApiCallsCount} (Zero-AI: ${stats.zeroAiCount}, Кеш серій: ${stats.seriesCacheHits})`
        );
      }
      setTimeout(() => setAiProgressMessage(null), 5000);
    } catch (e: any) {
      console.warn('AI filling notice:', e);
      setAiProgressMessage('Оброблено за допомогою локального PIM-рушія Епіцентру');
    } finally {
      setIsAiProcessing(false);
    }
  };

  // Deep research for a single product using Google Search Grounding
  const handleResearchSingleProduct = async (pRow: EpicentrProductRow) => {
    const user = authService.getCurrentUser();
    if (!canAccessFeature('SEARCH_GROUNDING', user)) {
      if (onDemoRestricted) {
        onDemoRestricted('Google Search Grounding (Розшук характеристик)');
      } else {
        setNotificationToast({
          message: getDemoRestrictionMessage('Google Search Grounding'),
          type: 'info'
        });
        setTimeout(() => setNotificationToast(null), 5000);
      }
      return;
    }

    if (!hasUserApiKey()) {
      if (onOpenApiKeySettings) {
        onOpenApiKeySettings();
      }
      setNotificationToast({
        message: 'Для розшуку характеристик потрібен власний Google AI Studio API Key.',
        type: 'info'
      });
      setTimeout(() => setNotificationToast(null), 5000);
      return;
    }

    setResearchingRowIdx(pRow.rowIdx);
    try {
      const result = await researchProductAttributesWithWebGrounding(
        pRow.updatedRow,
        columns,
        dictionaryIndex || {},
        undefined,
        { merchantDomain, restrictToDomain }
      );

      const keys = Object.keys(result.suggestedValues);
      const selected: Record<string, boolean> = {};
      keys.forEach(k => {
        selected[k] = true;
      });

      setResearchModalProduct({
        row: pRow,
        result,
        selectedKeys: selected
      });
    } catch (err) {
      console.warn('Single product web research notice:', err);
    } finally {
      setResearchingRowIdx(null);
    }
  };

  // Apply researched attributes from modal
  const handleApplyResearchedAttributes = () => {
    if (!researchModalProduct) return;
    const { row, result, selectedKeys } = researchModalProduct;
    const rowIdx = row.rowIdx;

    if (onUpdateCellValue) {
      for (const [colName, isSelected] of Object.entries(selectedKeys)) {
        if (isSelected && result.suggestedValues[colName]) {
          onUpdateCellValue(rowIdx, colName, result.suggestedValues[colName]);
        }
      }
    }

    if (result.sources && result.sources.length > 0) {
      setWebGroundingSourcesMap(prev => ({
        ...prev,
        [rowIdx]: {
          sources: result.sources || [],
          explanations: result.explanations || {}
        }
      }));
    }

    setResearchModalProduct(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
      {/* Merchant Domain & Site-Scoped Search Panel */}
      <div className="bg-gradient-to-r from-blue-50/90 via-slate-50 to-indigo-50/90 border border-blue-200/80 rounded-2xl p-4 shadow-xs space-y-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Масове заповнення характеристик за доменним джерелом</h4>
              <p className="text-[11px] text-slate-600">
                Вкажіть сайт мерчанта для пошуку специфікацій та суворої валідації за PIM-довідником Епіцентру.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:w-72">
              <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="🌐 Домен/Сайт мерчанта (напр. my-store.com.ua)"
                value={merchantDomain}
                onChange={(e) => setMerchantDomain(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#004BB7] transition-all"
              />
            </div>

            <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-700 cursor-pointer select-none hover:border-slate-400 transition-all">
              <input
                type="checkbox"
                checked={restrictToDomain}
                onChange={(e) => setRestrictToDomain(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-[#004BB7] focus:ring-0 cursor-pointer"
              />
              <span>Шукати специфікації тільки на цьому ресурсі</span>
            </label>
          </div>
        </div>
      </div>

      {/* Real-time Progress, Speed, ETA & Saved API Requests Card */}
      {progressMetrics && (isAiProcessing || progressMetrics.processed > 0) && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 border border-blue-500/30 rounded-2xl p-4 text-white shadow-md space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 shrink-0">
                {isAiProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <span>{progressMetrics.stage || 'Обробка товарів...'}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/25 text-blue-300 border border-blue-400/30">
                    12 потоків • 5 тов./запит
                  </span>
                </h4>
                <p className="text-[11px] text-slate-300">
                  Оброблено <strong>{progressMetrics.processed}</strong> з {progressMetrics.total} товарів ({Math.min(100, Math.round((progressMetrics.processed / Math.max(1, progressMetrics.total)) * 100))}%)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 text-xs">
              <div className="bg-white/10 px-2.5 py-1 rounded-lg backdrop-blur-xs border border-white/10 flex items-center gap-1.5" title="Поточна швидкість обробки">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-white">{progressMetrics.speed} тов./сек</span>
              </div>
              {isAiProcessing && progressMetrics.etaSeconds > 0 && (
                <div className="bg-white/10 px-2.5 py-1 rounded-lg backdrop-blur-xs border border-white/10 flex items-center gap-1.5" title="Орієнтовний час до завершення">
                  <Clock className="w-3.5 h-3.5 text-blue-300" />
                  <span className="font-semibold text-white">
                    ETA: {Math.floor(progressMetrics.etaSeconds / 60) > 0 ? `${Math.floor(progressMetrics.etaSeconds / 60)} хв ` : ''}{progressMetrics.etaSeconds % 60} с
                  </span>
                </div>
              )}
              <div className="bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-400/30 flex items-center gap-1.5 text-emerald-300" title="Зекономлено викликів Gemini API завдяки Zero-AI cutoff, пакетуванню по 5 та кешу серій">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Зекономлено API: <strong className="text-white">{progressMetrics.savedApiCalls}</strong> (Zero-AI: {progressMetrics.zeroAiCount}, Кеш: {progressMetrics.seriesCacheHits})</span>
              </div>
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="space-y-1">
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-400 via-[#FF7A00] to-emerald-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round((progressMetrics.processed / Math.max(1, progressMetrics.total)) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{aiProgressMessage || 'Високопродуктивна паралельна обробка...'}</span>
              <span>{isAiProcessing ? 'Обробка триває...' : 'Завершено'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar: Search, Filters, and Quick Export Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        
        {/* Left: Search input */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Пошук: назва, ID, артикул, бренд..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#004BB7] focus:bg-white transition-all"
            />
          </div>

          <span className="text-xs text-slate-500 whitespace-nowrap font-medium">
            Показано <strong className="text-slate-800">{filteredRows.length}</strong> з {rows.length} товарів
          </span>
        </div>

        {/* Right: Quick Export Buttons & AI Fill */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Express AI (Without Grounding, 5-product batching, 12 concurrency) */}
          <button
            type="button"
            onClick={() => handleTriggerAiFilling({ forceWebGrounding: false })}
            disabled={isAiProcessing}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 ${
              isDemoUser
                ? 'bg-slate-200 text-slate-600 border border-slate-300 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800'
                : 'bg-gradient-to-r from-amber-500 via-[#FF7A00] to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white'
            }`}
            title={isDemoUser ? 'ШІ-заповнення заблоковано в Демо' : '⚡ Експрес AI: 12 паралельних потоків, 5 товарів на запит, Zero-AI локальне відсікання та кеш серій'}
          >
            {isDemoUser ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Zap className={`w-3.5 h-3.5 ${isAiProcessing && !enableWebGrounding ? 'animate-spin' : ''}`} />}
            <span>{isDemoUser ? '🔒 ШІ-Експрес (Демо)' : isAiProcessing && !enableWebGrounding ? 'Експрес AI...' : '⚡ Експрес AI (Без Grounding)'}</span>
          </button>

          {/* Secondary Point Grounding: Exclusively for products with unfilled mandatory fields (*) */}
          <button
            type="button"
            onClick={() => handleTriggerAiFilling({ forceWebGrounding: true, onlyMandatory: true })}
            disabled={isAiProcessing}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 ${
              isDemoUser
                ? 'bg-slate-200 text-slate-600 border border-slate-300 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-[#004BB7] hover:from-blue-700 hover:to-[#003d99] text-white'
            }`}
            title={isDemoUser ? 'Точковий розшук заблоковано в Демо' : "🌐 Розшукати тільки порожні обов'язкові поля (*): запускає Google Search Grounding ВИКЛЮЧНО для товарів із незаповненими обов'язковими полями"}
          >
            {isDemoUser ? <Lock className="w-3.5 h-3.5 text-amber-600" /> : <Globe className={`w-3.5 h-3.5 ${isAiProcessing && enableWebGrounding ? 'animate-spin' : ''}`} />}
            <span>{isDemoUser ? '🔒 Точковий розшук (Демо)' : isAiProcessing && enableWebGrounding ? 'Точковий розшук...' : '🌐 Розшукати тільки порожні (*)'}</span>
          </button>

          {/* Export to Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#004BB7] hover:bg-[#003d99] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Завантажити готовий Excel із збереженням усіх оригінальних коментарів JSON"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Завантажено!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Експорт в Excel (.xlsx)</span>
              </>
            )}
          </button>

          {/* Export to Google Sheets */}
          <button
            type="button"
            onClick={() => setGoogleSheetExportOpen(!googleSheetExportOpen)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer"
            title="Експортувати або відкрити в Google Таблицях"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Google Таблиці</span>
          </button>

          {/* Copy Table to Clipboard */}
          <button
            type="button"
            onClick={handleCopyToClipboard}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            title="Скопіювати таблицю для вставки в Excel"
          >
            {copiedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Скопійовано!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Скопіювати</span>
              </>
            )}
          </button>

          {/* CSV Export */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-600 hover:text-slate-900 transition-colors"
            title="Завантажити у форматі CSV"
          >
            <span className="text-[11px] font-mono font-bold">CSV</span>
          </button>
        </div>
      </div>

      {/* Google Sheets Modal/Popover Banner */}
      {googleSheetExportOpen && (
        <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3.5 text-xs text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold">Інтеграція з Google Таблицями (Google Sheets):</span>
              <p className="text-emerald-800 text-[11px] mt-0.5">
                Ви можете завантажити CSV або скопіювати дані в буфер і вставити в Google Таблицю без втрати структури колонок Епіцентру.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyToClipboard}
              className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 font-semibold hover:bg-emerald-100 transition-colors"
            >
              Скопіювати для Google Таблиць
            </button>
            <button
              type="button"
              onClick={() => setGoogleSheetExportOpen(false)}
              className="px-2 py-1 text-slate-400 hover:text-slate-600"
            >
              Закрити
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {notificationToast && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-md animate-fadeIn ${
          notificationToast.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-blue-50 border-blue-300 text-blue-900'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{notificationToast.message}</span>
          </div>
          <button type="button" onClick={() => setNotificationToast(null)} className="p-1 text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Apply to All Prompt Banner */}
      {applyToAllPrompt && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-[#FF7A00] text-white rounded-xl p-3.5 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-extrabold text-sm">Застосувати значення до всіх порожніх?</span>
              <p className="text-white/90 text-[11px] mt-0.5">
                Ви ввели <strong className="underline">"{applyToAllPrompt.value}"</strong> у колонці <strong className="underline">"{applyToAllPrompt.cleanColName}"</strong>. Бажаєте автоматично поширити його на всі <strong className="underline">{applyToAllPrompt.emptyCount}</strong> порожніх товарів?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleApplyToAllEmpty(applyToAllPrompt.colName, applyToAllPrompt.value)}
              className="px-4 py-2 rounded-lg bg-white text-orange-700 font-bold hover:bg-orange-50 transition-colors shadow-sm cursor-pointer"
            >
              Застосувати до всіх ({applyToAllPrompt.emptyCount})
            </button>
            <button
              type="button"
              onClick={() => setApplyToAllPrompt(null)}
              className="px-2.5 py-1.5 text-white/80 hover:text-white font-medium cursor-pointer"
            >
              Пропустити
            </button>
          </div>
        </div>
      )}

      {/* Filter Pills Bar: Filtered fields for filling */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'all'
                ? 'bg-[#004BB7] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Всі товари ({rows.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('unfilled')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'unfilled'
                ? 'bg-[#FF7A00] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Порожні обов'язкові ({rows.filter(r => r.unfilledRequiredFields && r.unfilledRequiredFields.length > 0).length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('agent_filled')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'agent_filled'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Заповнені агентом ({rows.filter(r => Object.values(r.diffs || {}).some(d => d && d.source !== 'already_filled' && d.newValue)).length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('photo_filled')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'photo_filled'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Визначені за фото ({rows.filter(r => Object.values(r.diffs || {}).some(d => d && d.source === 'photo')).length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('lang_fixes')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'lang_fixes'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Мовні виправлення ({rows.filter(r => r.languageCorrections && r.languageCorrections.length > 0).length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('brand_other')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'brand_other'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Бренд "Інше" ({rows.filter(r => r.isBrandOther).length})
          </button>

          <button
            type="button"
            onClick={() => setFilterMode('invalid_titles')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              filterMode === 'invalid_titles'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-rose-700 hover:bg-rose-50 border border-rose-200'
            }`}
            title="Товари, чиї назви не відповідають офіційному регламенту маркетплейсу Епіцентр"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>
              Помилки формули назви (
              {
                rows.filter(r => {
                  const curTitle =
                    (titleUaCol ? r.updatedRow[titleUaCol.originalName] : undefined) ||
                    r.titleOriginal ||
                    '';
                  return !analyzeEpicentrTitleFormula(curTitle, r.brand, r.vendorCode).isValid;
                }).length
              }
              )
            </span>
          </button>
        </div>

        {/* Toggle Column View */}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowOnlyMandatoryCols(!showOnlyMandatoryCols)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
              showOnlyMandatoryCols
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-slate-100 border-slate-300 text-slate-700'
            }`}
          >
            <Columns className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span>
              {showOnlyMandatoryCols
                ? `Тільки обов'язкові поля (${mandatoryCols.length})`
                : `Всі колонки файлу (${columns.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
        <span className="font-bold text-slate-800">Позначення:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          Заповнено агентом з довідника
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF7A00]" />
          Визначено за 1-м фото
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          Знайдено через Google Grounding
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          Оригінальне значення
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
          Мовна нормалізація [ua]
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          Порожнє обов'язкове поле
        </span>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[620px] relative shadow-2xs">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-20 text-slate-700 font-bold border-b border-slate-300 shadow-2xs">
            <tr>
              <th className="py-3 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={el => {
                    if (el) el.indeterminate = someFilteredSelected;
                  }}
                  onChange={handleToggleSelectAll}
                  className="w-4 h-4 rounded text-[#004BB7] focus:ring-0 cursor-pointer"
                  title={allFilteredSelected ? 'Зняти виділення з усіх' : 'Вибрати всі показані товари'}
                />
              </th>
              <th className="py-3 px-3 w-12 text-center text-slate-500 font-mono">#</th>
              <th className="py-3 px-3 w-16 text-center">1-е Фото</th>
              <th className="py-3 px-3 min-w-[120px]">
                <div className="flex items-center gap-1 text-[#004BB7]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#004BB7]" />
                  <span>ID (Захищено)</span>
                </div>
              </th>
              <th className="py-3 px-3 min-w-[280px]">Назва товару [ua]*</th>
              <th className="py-3 px-3 min-w-[120px]">Артикул*</th>
              
              {/* Dynamic Columns */}
              {displayCols
                .filter(c => !c.cleanName.toLowerCase().includes('назва') && !c.cleanName.toLowerCase().includes('артикул') && !c.cleanName.toLowerCase().includes('id') && !c.cleanName.toLowerCase().includes('фото') && !c.cleanName.toLowerCase().includes('опис'))
                .map(col => {
                  const dictAttr = dictionaryIndex ? findDictionaryAttr(dictionaryIndex, col.cleanName || col.originalName) : undefined;
                  const hasManualValue = manuallyEditedCols[col.originalName];
                  const emptyCountForCol = rows.filter(r => {
                    const cur = r.updatedRow ? r.updatedRow[col.originalName] : undefined;
                    return cur === undefined || cur === null || String(cur).trim() === '' || String(cur).toLowerCase() === 'nan';
                  }).length;

                  return (
                    <th key={col.originalName} className="py-3 px-3 min-w-[180px] whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-800 font-bold">{col.cleanName}</span>
                            {col.isRequired && <span className="text-[#FF7A00] font-black">*</span>}
                            <span className="text-[10px] text-slate-500 font-mono">({col.type})</span>
                          </div>
                        </div>
                        {hasManualValue && emptyCountForCol > 0 && (
                          <button
                            type="button"
                            onClick={() => handleApplyToAllEmpty(col.originalName, hasManualValue.lastValue)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shadow-2xs transition-colors cursor-pointer w-full justify-center"
                            title={`Поширити значення "${hasManualValue.lastValue}" на всі ${emptyCountForCol} порожніх комірок`}
                          >
                            <span>Застосувати до всіх ({emptyCountForCol})</span>
                          </button>
                        )}
                      </div>
                    </th>
                  );
                })}
              <th className="py-3 px-3 w-20 text-center">Дії</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredRows.map((pRow, idx) => {
              const isExpanded = expandedRowIdx === pRow.rowIdx;
              const isSelected = selectedRowIndices.has(pRow.rowIdx);

              return (
                <React.Fragment key={pRow.id}>
                  <tr className={`transition-colors ${isSelected ? 'bg-blue-50/80 border-l-4 border-l-[#004BB7]' : 'hover:bg-blue-50/40'}`}>
                    {/* Row Checkbox */}
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={e => handleSelectRow(pRow.rowIdx, (e.nativeEvent as MouseEvent).shiftKey)}
                        className="w-4 h-4 rounded text-[#004BB7] focus:ring-0 cursor-pointer"
                        title={`Вибрати товар #${idx + 1}`}
                      />
                    </td>

                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                      {idx + 1}
                    </td>

                    {/* 1st Photo preview */}
                    <td className="py-2.5 px-3 text-center">
                      {pRow.firstPhotoUrl ? (
                        <div
                          className="relative group cursor-pointer w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-300 mx-auto shadow-2xs"
                          onClick={() => setSelectedPhoto(pRow.firstPhotoUrl || null)}
                          title="Клікніть для збільшення 1-го фото"
                        >
                          <img
                            src={pRow.firstPhotoUrl}
                            alt={pRow.id}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center mx-auto text-slate-400">
                          <Camera className="w-4 h-4" />
                        </div>
                      )}
                    </td>

                    {/* Protected ID */}
                    <td className="py-2.5 px-3 font-mono font-bold text-[#004BB7] whitespace-nowrap">
                      {pRow.id}
                    </td>

                    {/* Title UA with Interactive Formula Inspector */}
                    <td className="py-2.5 px-3 min-w-[280px]">
                      <div className="font-semibold text-slate-900 leading-snug">
                        {(titleUaCol ? pRow.updatedRow[titleUaCol.originalName] : undefined) ||
                          pRow.titleFormattedUa ||
                          (titleUaCol && pRow.originalRow ? pRow.originalRow[titleUaCol.originalName] : undefined) ||
                          pRow.titleOriginal}
                      </div>
                      {pRow.titleFormattedUa && pRow.titleFormattedUa !== pRow.titleOriginal && (
                        <div className="text-[11px] text-slate-500 mt-0.5 line-through decoration-slate-400">
                          {pRow.titleOriginal}
                        </div>
                      )}

                      {/* Formula Inspector Badge & 1-Click Fix */}
                      {(() => {
                        const curTitle = String(
                          (titleUaCol ? pRow.updatedRow[titleUaCol.originalName] : undefined) ||
                          pRow.titleFormattedUa ||
                          pRow.titleOriginal ||
                          ''
                        );
                        const formula = analyzeEpicentrTitleFormula(curTitle, pRow.brand, pRow.vendorCode);
                        const isPopoverOpen = activeTitlePopoverRowIdx === pRow.rowIdx;

                        return (
                          <div className="mt-1.5 relative">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {formula.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Формула ОК ({formula.score}%)</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActiveTitlePopoverRowIdx(isPopoverOpen ? null : pRow.rowIdx)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition-colors cursor-pointer shadow-2xs"
                                  title="Натисніть для перегляду деталей формули та швидкого виправлення"
                                >
                                  <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span className="truncate max-w-[170px]">{formula.issues[0]}</span>
                                  <span className="font-bold text-amber-700 font-mono">({formula.score}%)</span>
                                </button>
                              )}

                              {!formula.isValid && (
                                <button
                                  type="button"
                                  onClick={() => handleFixSingleTitle(pRow)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[10px] font-bold shadow-2xs transition-all cursor-pointer"
                                  title="✨ 1-Click Fix: нормалізувати назву за формулою Епіцентру"
                                >
                                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                                  <span>1-Click Fix</span>
                                </button>
                              )}
                            </div>

                            {/* Detailed Formula Popover */}
                            {isPopoverOpen && (
                              <div className="absolute left-0 top-full mt-1.5 z-40 w-80 p-3.5 bg-white border border-slate-300 rounded-xl shadow-2xl text-xs space-y-2.5 animate-fadeIn">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                                  <div className="flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-[#004BB7]" />
                                    <span className="font-bold text-slate-800">Формула назви Епіцентру</span>
                                  </div>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      formula.score >= 80
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : formula.score >= 50
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {formula.score}/100 балів
                                  </span>
                                </div>

                                <div className="space-y-1 text-[11px] text-slate-600">
                                  <div className="flex items-center justify-between">
                                    <span>Довжина ({formula.length}/150 симв.):</span>
                                    <span className={formula.isLengthValid ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                      {formula.isLengthValid ? '✓ В нормі' : '✗ Порушено'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>Артикул у дужках (SKU):</span>
                                    <span className={formula.hasSkuInBrackets ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                      {formula.hasSkuInBrackets ? `✓ ${formula.skuFound}` : '✗ Відсутній'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>Маркетингові стоп-слова:</span>
                                    <span className={!formula.hasProhibitedWords ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                      {!formula.hasProhibitedWords ? '✓ Відсутні' : `✗ ${formula.prohibitedWords.join(', ')}`}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>Бренд у назві:</span>
                                    <span className={formula.hasBrand ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                                      {formula.hasBrand ? '✓ Присутній' : '⚠ Не вказано'}
                                    </span>
                                  </div>
                                </div>

                                {formula.issues.length > 0 && (
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-900 space-y-0.5">
                                    <div className="font-bold">Виявлені зауваження:</div>
                                    <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                                      {formula.issues.map((iss, i) => (
                                        <li key={i}>{iss}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                <div className="pt-1 flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleFixSingleTitle(pRow)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#004BB7] hover:bg-[#003d99] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                    <span>Нормалізувати зараз</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveTitlePopoverRowIdx(null)}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* SKU / Article */}
                    <td className="py-2.5 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {pRow.vendorCode || (skuCol ? pRow.updatedRow[skuCol.originalName] : undefined) || '-'}
                    </td>

                    {/* Dynamic Columns values with inline editing */}
                    {displayCols
                      .filter(c => !c.cleanName.toLowerCase().includes('назва') && !c.cleanName.toLowerCase().includes('артикул') && !c.cleanName.toLowerCase().includes('id') && !c.cleanName.toLowerCase().includes('фото') && !c.cleanName.toLowerCase().includes('опис'))
                      .map((col, colIdx) => {
                        const val = pRow.updatedRow ? pRow.updatedRow[col.originalName] : undefined;
                        const diff = pRow.diffs ? pRow.diffs[col.originalName] : undefined;
                        const isMandatory = col.isRequired;
                        const isEmpty = val === undefined || val === null || String(val).trim() === '';
                        const isEditing = editingCell?.rowIdx === pRow.rowIdx && editingCell?.colName === col.originalName;
                        const dictAttr = dictionaryIndex ? findDictionaryAttr(dictionaryIndex, col.cleanName || col.originalName) : undefined;
                        const groundingExplanation =
                          webGroundingSourcesMap?.[pRow.rowIdx]?.explanations?.[col.originalName] ||
                          webGroundingSourcesMap?.[pRow.rowIdx]?.explanations?.[col.cleanName];

                        return (
                          <td key={col.originalName} className="py-2.5 px-3 relative group">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                {dictAttr && dictAttr.allowedValues.length > 0 ? (
                                  <select
                                    autoFocus
                                    className="w-full px-2 py-1 text-xs border border-blue-500 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-200"
                                    value={editingCell.value}
                                    onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                    onBlur={() => handleSaveCell(pRow.rowIdx, col.originalName, editingCell.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        handleSaveCell(pRow.rowIdx, col.originalName, editingCell.value);
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                  >
                                    <option value="">-- Виберіть з довідника --</option>
                                    {dictAttr.allowedValues.map(opt => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    autoFocus
                                    type="text"
                                    className="w-full px-2 py-1 text-xs border border-blue-500 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-200"
                                    value={editingCell.value}
                                    onChange={e => setEditingCell({ ...editingCell, value: e.target.value })}
                                    onBlur={() => handleSaveCell(pRow.rowIdx, col.originalName, editingCell.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        handleSaveCell(pRow.rowIdx, col.originalName, editingCell.value);
                                      } else if (e.key === 'Escape') {
                                        setEditingCell(null);
                                      }
                                    }}
                                  />
                                )}
                              </div>
                            ) : (
                              <div
                                onClick={() => setEditingCell({ rowIdx: pRow.rowIdx, colName: col.originalName, value: val ? String(val) : '' })}
                                className="flex items-center justify-between gap-1 cursor-pointer py-1 px-1.5 rounded hover:bg-slate-100 transition-colors group/cell"
                                title="Клікніть для редагування значення"
                              >
                                <div className="truncate">
                                  {isEmpty && isMandatory ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 border border-rose-200 text-rose-700">
                                      <AlertTriangle className="w-3 h-3 text-rose-500" />
                                      Порожнє (*)
                                    </span>
                                  ) : groundingExplanation && val ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 border border-blue-200 text-blue-900"
                                      title={`Google Grounding: ${groundingExplanation}`}
                                    >
                                      <Globe className="w-3 h-3 text-[#004BB7]" />
                                      <span>{String(val)}</span>
                                    </span>
                                  ) : diff && diff.source === 'photo' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 border border-amber-200 text-amber-900">
                                      <Camera className="w-3 h-3 text-[#FF7A00]" />
                                      <span>{String(val)}</span>
                                    </span>
                                  ) : diff && diff.source !== 'already_filled' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>{String(val)}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-700">
                                      {val ? String(val) : <span className="text-slate-300">-</span>}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover/cell:opacity-100 shrink-0 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenFeedback(
                                        pRow.rowIdx,
                                        col.cleanName || col.originalName,
                                        colIdx,
                                        pRow.originalRow ? pRow.originalRow[col.originalName] : undefined,
                                        val,
                                        dictAttr?.attributeName,
                                        dictAttr?.allowedValues?.slice(0, 10),
                                        isEmpty && isMandatory ? 'Обов’язкове поле порожнє' : undefined
                                      );
                                    }}
                                    className="p-0.5 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                    title="Повідомити про помилку / відкрити фідбек для цієї комірки"
                                  >
                                    <AlertCircle className="w-3 h-3 text-amber-500" />
                                  </button>
                                  <Pencil className="w-3 h-3 text-slate-400" />
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}

                    {/* Details action & Google Search Grounding action */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {pRow.unfilledRequiredFields && pRow.unfilledRequiredFields.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handleResearchSingleProduct(pRow)}
                            disabled={researchingRowIdx === pRow.rowIdx}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isDemoUser
                                ? 'bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                            }`}
                            title={isDemoUser ? 'Google Search Grounding (Заблоковано в Демо)' : 'Розшукати характеристики товару в Google (Web Grounding)'}
                          >
                            {isDemoUser ? (
                              <Lock className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <Globe className={`w-3.5 h-3.5 ${researchingRowIdx === pRow.rowIdx ? 'animate-spin text-blue-600' : ''}`} />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedRowIdx(isExpanded ? null : pRow.rowIdx)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          title="Переглянути всі параметри товару"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Row Details */}
                  {isExpanded && (
                    <tr className="bg-slate-50/80 border-y border-slate-200">
                      <td colSpan={displayCols.length + 5} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                              <Tag className="w-3.5 h-3.5 text-[#004BB7]" />
                              Формула назви Епіцентру
                            </span>
                            <div className="space-y-1 text-slate-600">
                              <div>
                                <strong>[UA]:</strong>{' '}
                                {(titleUaCol ? pRow.updatedRow[titleUaCol.originalName] : undefined) ||
                                  pRow.titleFormattedUa ||
                                  (titleUaCol && pRow.originalRow ? pRow.originalRow[titleUaCol.originalName] : undefined) ||
                                  pRow.titleOriginal ||
                                  '-'}
                              </div>
                              <div>
                                <strong>[RU]:</strong>{' '}
                                {(titleRuCol ? pRow.updatedRow[titleRuCol.originalName] : undefined) ||
                                  pRow.titleFormattedRu ||
                                  (titleRuCol && pRow.originalRow ? pRow.originalRow[titleRuCol.originalName] : undefined) ||
                                  '-'}
                              </div>
                              <div><strong>Бренд:</strong> {pRow.brand || '-'} {pRow.isBrandOther && <span className="text-purple-600 font-bold">(Інше)</span>}</div>
                            </div>
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                              <Camera className="w-3.5 h-3.5 text-[#FF7A00]" />
                              Аналіз першого фото
                            </span>
                            <div className="space-y-1 text-slate-600">
                              <div><strong>Основний колір:</strong> {pRow.photoAnalysis?.primaryColor || 'Визначено за зображенням'}</div>
                              <div><strong>Колір виробника:</strong> {pRow.photoAnalysis?.manufacturerColor || '-'}</div>
                              <div><strong>Візерунок:</strong> {pRow.photoAnalysis?.patternType || 'без візерунка (однотонний)'}</div>
                            </div>
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                            <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Статус відповідності
                            </span>
                            <div className="space-y-1 text-slate-600">
                              <div><strong>Обов'язкових полів:</strong> {mandatoryCols.length}</div>
                              <div><strong>Порожніх полів:</strong> {pRow.unfilledRequiredFields.length > 0 ? <span className="text-rose-600 font-bold">{pRow.unfilledRequiredFields.length}</span> : <span className="text-emerald-600 font-bold">0 (Все заповнено)</span>}</div>
                              <div><strong>Мовних правок:</strong> {pRow.languageCorrections.length}</div>
                            </div>

                            {pRow.unfilledRequiredFields.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleResearchSingleProduct(pRow)}
                                disabled={researchingRowIdx === pRow.rowIdx}
                                className="mt-3 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-[#004BB7] hover:from-blue-700 hover:to-[#003d99] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                              >
                                <Globe className={`w-3.5 h-3.5 ${researchingRowIdx === pRow.rowIdx ? 'animate-spin' : ''}`} />
                                <span>{researchingRowIdx === pRow.rowIdx ? 'Розшук в інтернеті...' : 'Розшукати в Google (Web Grounding)'}</span>
                              </button>
                            )}

                            {webGroundingSourcesMap[pRow.rowIdx]?.sources && webGroundingSourcesMap[pRow.rowIdx].sources.length > 0 && (
                              <div className="mt-3 pt-2.5 border-t border-slate-100">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Знайдені веб-джерела (Google Grounding):
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {webGroundingSourcesMap[pRow.rowIdx].sources
                                    .filter(src => src && src.uri)
                                    .slice(0, 3)
                                    .map((src, sIdx) => (
                                      <a
                                        key={sIdx}
                                        href={src.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:text-blue-900 text-[10px] font-medium"
                                      >
                                        <ExternalLink className="w-2.5 h-2.5" />
                                        <span className="max-w-[140px] truncate">{src.title || src.uri}</span>
                                      </a>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Google Search Grounding Product Research Modal */}
      {researchModalProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setResearchModalProduct(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 p-6 max-w-2xl w-full shadow-2xl relative max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <span>Google Search Grounding — Знайдені характеристики</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      gemini-3.8-flash
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 truncate max-w-md">
                    {researchModalProduct.row.titleFormattedUa || researchModalProduct.row.titleOriginal}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResearchModalProduct(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {Object.keys(researchModalProduct.result.suggestedValues).length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      Знайдені та верифіковані характеристики з довідника Епіцентру:
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Позначте галочками поля для запису
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                    {Object.entries(researchModalProduct.result.suggestedValues).map(([key, val]) => (
                      <label
                        key={key}
                        className="p-3 flex items-start gap-3 hover:bg-white transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={!!researchModalProduct.selectedKeys[key]}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setResearchModalProduct(prev => prev ? ({
                              ...prev,
                              selectedKeys: { ...prev.selectedKeys, [key]: checked }
                            }) : null);
                          }}
                          className="mt-0.5 rounded text-[#004BB7] focus:ring-0 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">{key}</span>
                            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {val}
                            </span>
                          </div>
                          {researchModalProduct.result.explanations?.[key] && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {researchModalProduct.result.explanations[key]}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
                  <p className="font-semibold">Характеристик у Google Пошуку не знайдено.</p>
                  <p className="mt-1 text-slate-600">
                    Модель не змогла підтвердити офіційні дані з достатньою точністю або знайдена інформація відсутня у довіднику Епіцентру.
                  </p>
                </div>
              )}

              {researchModalProduct.result.sources && researchModalProduct.result.sources.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    Джерела інформації з Google Пошуку:
                  </span>
                  <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {researchModalProduct.result.sources.map((src, sIdx) => (
                      <a
                        key={sIdx}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{src.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono truncate">({src.uri})</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setResearchModalProduct(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
              >
                Скасувати
              </button>
              {Object.keys(researchModalProduct.result.suggestedValues).length > 0 && (
                <button
                  type="button"
                  onClick={handleApplyResearchedAttributes}
                  className="px-4 py-2 rounded-xl bg-[#004BB7] hover:bg-[#003d99] text-white font-bold cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Застосувати обрані характеристики</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Photo preview */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="bg-white rounded-2xl p-4 max-w-lg w-full shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <img
              src={selectedPhoto}
              alt="Збільшене фото товару"
              className="w-full h-auto rounded-xl object-contain max-h-[70vh]"
            />
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold text-slate-800">1-е фото товару (Аналіз кольору та візерунка)</span>
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Batch Action Bar */}
      {selectedRowIndices.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-4xl w-[94%] bg-slate-900/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl p-4 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 animate-slideUp">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#004BB7] to-indigo-600 flex items-center justify-center text-white shadow-md font-bold text-sm">
              {selectedRowIndices.size}
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Вибрано: <strong>{selectedRowIndices.size}</strong> з {rows.length} товарів</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                  Пакетні операції
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <button
                  type="button"
                  onClick={handleSelectInvalidTitles}
                  className="hover:text-amber-300 underline cursor-pointer"
                >
                  Вибрати з помилками формули
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleSelectUnfilledMandatory}
                  className="hover:text-amber-300 underline cursor-pointer"
                >
                  Вибрати з порожніми (*)
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Batch Title Formula Fix */}
            <button
              type="button"
              onClick={handleBatchFixTitlesForSelected}
              disabled={isBulkFixingTitles}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Автоматично виправити назви за формулою Епіцентру для всіх вибраних товарів"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{isBulkFixingTitles ? 'Виправлення...' : `Виправити назви (${selectedRowIndices.size})`}</span>
            </button>

            {/* Batch AI Enrichment */}
            <button
              type="button"
              onClick={() => handleTriggerAiFilling({ forceWebGrounding: false, targetRowIndices: selectedRowIndices })}
              disabled={isAiProcessing}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 ${
                isDemoUser
                  ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-amber-500 hover:text-amber-400'
                  : 'bg-gradient-to-r from-amber-500 to-[#FF7A00] hover:from-amber-600 hover:to-orange-600 text-white'
              }`}
              title={isDemoUser ? 'AI-обробка заблокована в Демо' : 'Запустити AI-дозаповнення тільки для вибраних товарів'}
            >
              {isDemoUser ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Zap className="w-3.5 h-3.5" />}
              <span>{isDemoUser ? '🔒 AI для вибраних (Демо)' : isAiProcessing ? 'AI обробка...' : `AI для вибраних (${selectedRowIndices.size})`}</span>
            </button>

            {/* Bulk Assign Value */}
            <button
              type="button"
              onClick={() => setIsBulkAssignOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Призначити однакове значення характеристики для всіх вибраних товарів"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Призначити значення</span>
            </button>

            {/* Export Selected to Excel */}
            <button
              type="button"
              onClick={handleExportSelectedExcel}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="Вивантажити Excel-файл тільки з вибраними товарами"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Експорт ({selectedRowIndices.size})</span>
            </button>

            {/* Clear Selection */}
            <button
              type="button"
              onClick={handleClearSelection}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Зняти виділення"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal: Bulk Assign Value to Selected Rows */}
      {isBulkAssignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#004BB7]" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Призначити значення для {selectedRowIndices.size} товарів
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkAssignOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Оберіть колонку для заповнення:</label>
                <select
                  value={bulkAssignCol}
                  onChange={e => {
                    setBulkAssignCol(e.target.value);
                    setBulkAssignVal('');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#004BB7]"
                >
                  <option value="">-- Оберіть колонку --</option>
                  {columns
                    .filter(c => !c.cleanName.toLowerCase().includes('id') && !c.cleanName.toLowerCase().includes('фото'))
                    .map(col => (
                      <option key={col.originalName} value={col.originalName}>
                        {col.cleanName} {col.isRequired ? '(*)' : ''} ({col.type})
                      </option>
                    ))}
                </select>
              </div>

              {bulkAssignCol && (() => {
                const col = columns.find(c => c.originalName === bulkAssignCol);
                const dictAttr = dictionaryIndex && col ? findDictionaryAttr(dictionaryIndex, col.cleanName || col.originalName) : undefined;

                return (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Значення {dictAttr && dictAttr.allowedValues.length > 0 ? '(Суворий PIM-довідник Епіцентру)' : ''}:
                    </label>
                    {dictAttr && dictAttr.allowedValues.length > 0 ? (
                      <select
                        value={bulkAssignVal}
                        onChange={e => setBulkAssignVal(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#004BB7]"
                      >
                        <option value="">-- Оберіть значення з довідника --</option>
                        {dictAttr.allowedValues.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Введіть значення..."
                        value={bulkAssignVal}
                        onChange={e => setBulkAssignVal(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#004BB7]"
                      />
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBulkAssignOpen(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium text-xs rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={!bulkAssignCol || !bulkAssignVal.trim()}
                onClick={handleApplyBulkAssignment}
                className="px-4 py-2 bg-[#004BB7] hover:bg-[#003d99] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Застосувати до {selectedRowIndices.size} товарів
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notificationToast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 text-xs animate-slideDown ${notificationToast.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-blue-50 border-blue-300 text-blue-900'}`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{notificationToast.message}</span>
        </div>
      )}

      {/* Contextual Cell Feedback Modal */}
      <ContextualFeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        context={feedbackSnapshot}
        onSubmitted={() => {
          setNotificationToast({
            message: 'Фідбек по комірці успішно надіслано розробникам!',
            type: 'success'
          });
          setTimeout(() => setNotificationToast(null), 3500);
        }}
      />
    </div>
  );
};
