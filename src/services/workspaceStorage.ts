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
  } catch (e) {
    console.error('Failed to load workspaces:', e);
  }
  return DEFAULT_SHOPS;
}

export function saveWorkspaces(shops: ShopWorkspace[]) {
  try {
    localStorage.setItem(SHOPS_STORAGE_KEY, JSON.stringify(shops));
  } catch (e) {
    console.error('Failed to save workspaces:', e);
  }
}

export function getCurrentWorkspace(): ShopWorkspace {
  const shops = getWorkspaces();
  try {
    const curId = localStorage.getItem(CURRENT_SHOP_KEY);
    const found = shops.find(s => s.id === curId);
    if (found) return found;
  } catch (e) {
    console.error('Failed to get current workspace:', e);
  }
  return shops[0] || DEFAULT_SHOPS[0];
}

export function setCurrentWorkspaceId(id: string) {
  try {
    localStorage.setItem(CURRENT_SHOP_KEY, id);
  } catch (e) {
    console.error('Failed to set current workspace:', e);
  }
}

export function getBatchHistory(): SavedBatchHistoryItem[] {
  try {
    const raw = localStorage.getItem(BATCH_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Failed to load batch history:', e);
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
  try {
    const history = getBatchHistory();
    const newItem: SavedBatchHistoryItem = {
      ...batch,
      id: `batch-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    const updated = [newItem, ...history].slice(0, 30); // keep last 30
    localStorage.setItem(BATCH_HISTORY_KEY, JSON.stringify(updated));
    return newItem;
  } catch (e) {
    console.error('Failed to save batch to history:', e);
    return null;
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
  } catch (e) {
    console.error('Failed to set onboarding seen:', e);
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

const AUTOSAVE_STORAGE_KEY = 'epicentr_saas_autosave_session';

export function saveAutoSaveSession(session: AutoSaveSession): boolean {
  try {
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch (e) {
    console.warn('Auto-save to localStorage failed (e.g. quota exceeded):', e);
    return false;
  }
}

export function getAutoSaveSession(): AutoSaveSession | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.rawRows) && parsed.rawRows.length > 0 && parsed.settings) {
        return parsed as AutoSaveSession;
      }
    }
  } catch (e) {
    console.error('Failed to retrieve auto-save session:', e);
  }
  return null;
}

export function clearAutoSaveSession(): void {
  try {
    localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear auto-save session:', e);
  }
}

