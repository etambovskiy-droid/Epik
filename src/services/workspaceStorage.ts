/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ProcessingReportSummary,
  EpicentrProductRow,
  EpicentrColumn,
  ProcessSettings,
  EngineErrorEvent
} from '../types/epicentr';

export interface ShopWorkspace {
  id: string;
  name: string;
  sellerCode: string;
  defaultCategory: string;
  createdAt: string;
}

export interface SavedBatchHistoryItem {
  id: string;
  workspaceId: string;
  filename: string;
  categoryTitle: string;
  productsCount: number;
  mandatoryColumnsCount: number;
  newlyFilledCount: number;
  fillRatePercentage: number;
  unfilledMandatoryCount: number;
  timestamp: string;
  report?: ProcessingReportSummary;
  processedRows?: EpicentrProductRow[];
  columns?: EpicentrColumn[];
  rawRows?: Record<string, any>[];
  engineErrors?: EngineErrorEvent[];
  dictionaryFileName?: string | null;
  xmlFileName?: string | null;
  settings?: ProcessSettings;
}

const SHOPS_STORAGE_KEY = 'epicentr_saas_workspaces';
const CURRENT_SHOP_KEY = 'epicentr_saas_current_workspace';
const BATCH_HISTORY_KEY = 'epicentr_saas_batch_history';
const ONBOARDING_SEEN_KEY = 'epicentr_saas_onboarding_seen';
const AUTOSAVE_STORAGE_KEY = 'epicentr_saas_autosave_session';

// In-memory cache to preserve full-fidelity batch snapshots & auto-save sessions
// even when browser localStorage (5MB limit) is full
const inMemoryBatchSnapshots = new Map<string, SavedBatchHistoryItem>();
let inMemoryHistoryList: SavedBatchHistoryItem[] | null = null;
let inMemoryAutoSaveSession: AutoSaveSession | null = null;

/**
 * Strips heavy row payloads from a batch item for compact localStorage persistence
 */
function createLightweightBatchItem(
  item: SavedBatchHistoryItem,
  keepLatestRows = false
): SavedBatchHistoryItem {
  const MAX_PERSISTED_ROWS = 35;
  const MAX_PERSISTED_ERRORS = 25;

  const compactReport = item.report
    ? {
        ...item.report,
        errors: (item.report.errors || []).slice(0, MAX_PERSISTED_ERRORS)
      }
    : undefined;

  if (!keepLatestRows) {
    return {
      id: item.id,
      workspaceId: item.workspaceId,
      filename: item.filename,
      categoryTitle: item.categoryTitle,
      productsCount: item.productsCount,
      mandatoryColumnsCount: item.mandatoryColumnsCount,
      newlyFilledCount: item.newlyFilledCount,
      fillRatePercentage: item.fillRatePercentage,
      unfilledMandatoryCount: item.unfilledMandatoryCount,
      timestamp: item.timestamp,
      dictionaryFileName: item.dictionaryFileName,
      xmlFileName: item.xmlFileName,
      settings: item.settings,
      columns: item.columns,
      report: compactReport,
      engineErrors: (item.engineErrors || []).slice(0, MAX_PERSISTED_ERRORS)
    };
  }

  // For the latest batch item, keep a bounded number of rows and avoid duplicating originalRow
  const boundedProcessedRows = item.processedRows
    ? item.processedRows.slice(0, MAX_PERSISTED_ROWS).map(row => ({
        ...row,
        originalRow: row.updatedRow
      }))
    : undefined;

  const boundedRawRows = item.rawRows
    ? item.rawRows.slice(0, MAX_PERSISTED_ROWS)
    : undefined;

  return {
    ...item,
    report: compactReport,
    processedRows: boundedProcessedRows,
    rawRows: boundedRawRows,
    engineErrors: (item.engineErrors || []).slice(0, MAX_PERSISTED_ERRORS)
  };
}

export const DEFAULT_SHOPS: ShopWorkspace[] = [
  {
    id: 'shop-electronics',
    name: 'Магазин «TechSmart» (Електроніка)',
    sellerCode: 'SELLER-EP-1082',
    defaultCategory: 'headphones',
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop-furniture',
    name: 'Меблевий салон «ComfortHome»',
    sellerCode: 'SELLER-EP-4421',
    defaultCategory: 'chairs',
    createdAt: new Date().toISOString()
  },
  {
    id: 'shop-lighting',
    name: 'Студія світла «Lumina»',
    sellerCode: 'SELLER-EP-9930',
    defaultCategory: 'chandeliers',
    createdAt: new Date().toISOString()
  }
];

export function getWorkspaces(): ShopWorkspace[] {
  try {
    const raw = localStorage.getItem(SHOPS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Fallback to default shops
  }
  return DEFAULT_SHOPS;
}

export function saveWorkspaces(shops: ShopWorkspace[]) {
  try {
    localStorage.setItem(SHOPS_STORAGE_KEY, JSON.stringify(shops));
  } catch {
    // Ignore storage quota errors for workspaces
  }
}

export function getCurrentWorkspace(): ShopWorkspace {
  const shops = getWorkspaces();
  try {
    const curId = localStorage.getItem(CURRENT_SHOP_KEY);
    const found = shops.find(s => s.id === curId);
    if (found) return found;
  } catch {
    // Fallback to first shop
  }
  return shops[0] || DEFAULT_SHOPS[0];
}

export function setCurrentWorkspaceId(id: string) {
  try {
    localStorage.setItem(CURRENT_SHOP_KEY, id);
  } catch {
    // Ignore quota errors
  }
}

export function getBatchHistory(): SavedBatchHistoryItem[] {
  try {
    const raw = localStorage.getItem(BATCH_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item: SavedBatchHistoryItem) => {
          const cached = inMemoryBatchSnapshots.get(item.id);
          return cached ? { ...item, ...cached } : item;
        });
      }
    }
  } catch {
    if (inMemoryHistoryList) {
      return inMemoryHistoryList;
    }
  }
  if (inMemoryHistoryList && inMemoryHistoryList.length > 0) {
    return inMemoryHistoryList;
  }
  return [
    {
      id: 'batch-init-1',
      workspaceId: 'shop-electronics',
      filename: 'Шаблон_headphones_Епіцентр.xlsx',
      categoryTitle: 'Електроніка: Бездротові навушники та гарнітури',
      productsCount: 4,
      mandatoryColumnsCount: 8,
      newlyFilledCount: 19,
      fillRatePercentage: 92,
      unfilledMandatoryCount: 2,
      timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
    }
  ];
}

export function saveBatchToHistory(batch: Omit<SavedBatchHistoryItem, 'id' | 'timestamp'>) {
  const history = getBatchHistory();
  const newItem: SavedBatchHistoryItem = {
    ...batch,
    id: `batch-${Date.now()}`,
    timestamp: new Date().toISOString()
  };

  // Always retain full snapshot in memory for the active session
  inMemoryBatchSnapshots.set(newItem.id, newItem);
  const fullUpdated = [newItem, ...history].slice(0, 20);
  inMemoryHistoryList = fullUpdated;

  // Tier 1: Save bounded rows for the newest item and lightweight metadata for older items
  try {
    const compactList = fullUpdated.slice(0, 15).map((item, idx) =>
      createLightweightBatchItem(item, idx === 0)
    );
    localStorage.setItem(BATCH_HISTORY_KEY, JSON.stringify(compactList));
    return newItem;
  } catch {
    // Tier 2: Strip all heavy row arrays and keep up to 10 lightweight summary items
    try {
      const ultraCompactList = fullUpdated
        .slice(0, 10)
        .map(item => createLightweightBatchItem(item, false));
      localStorage.setItem(BATCH_HISTORY_KEY, JSON.stringify(ultraCompactList));
      return newItem;
    } catch {
      // Tier 3: Free up space from autosave session and store only the 5 most recent summary items
      try {
        localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
        const minimalList = fullUpdated
          .slice(0, 5)
          .map(item => createLightweightBatchItem(item, false));
        localStorage.setItem(BATCH_HISTORY_KEY, JSON.stringify(minimalList));
      } catch {
        // In-memory fallback is already populated via inMemoryHistoryList
      }
      return newItem;
    }
  }
}

export function isOnboardingSeen(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOnboardingSeen(val: boolean) {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, val ? 'true' : 'false');
  } catch {
    // Ignore storage quota errors
  }
}

export interface AutoSaveSession {
  rawRows: Record<string, any>[];
  settings: any; // ProcessSettings
  columns?: any[]; // EpicentrColumn[]
  templateFileName?: string | null;
  dictionaryFileName?: string | null;
  xmlFileName?: string | null;
  timestamp: number;
}

export function saveAutoSaveSession(session: AutoSaveSession): boolean {
  inMemoryAutoSaveSession = session;
  try {
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch {
    // If quota exceeded, compact batch history first and store bounded rows
    try {
      const existingHistory = getBatchHistory()
        .slice(0, 8)
        .map(item => createLightweightBatchItem(item, false));
      localStorage.setItem(BATCH_HISTORY_KEY, JSON.stringify(existingHistory));

      const compactSession: AutoSaveSession = {
        ...session,
        rawRows: session.rawRows.slice(0, 75)
      };
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(compactSession));
      return true;
    } catch {
      // Still return true because inMemoryAutoSaveSession holds the session
      return true;
    }
  }
}

export function getAutoSaveSession(): AutoSaveSession | null {
  if (inMemoryAutoSaveSession && inMemoryAutoSaveSession.rawRows.length > 0) {
    return inMemoryAutoSaveSession;
  }
  try {
    const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.rawRows) && parsed.rawRows.length > 0 && parsed.settings) {
        return parsed as AutoSaveSession;
      }
    }
  } catch {
    // Ignore parse/storage errors
  }
  return null;
}

export function clearAutoSaveSession(): void {
  inMemoryAutoSaveSession = null;
  try {
    localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}


