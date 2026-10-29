/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EpicentrDictionaryAttribute } from '../types/epicentr';

const DB_NAME = 'epicentr_pim_cache_v2';
const STORE_NAME = 'dictionaries';
const DB_VERSION = 2;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn('IndexedDB open error, falling back to memory only');
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB not supported or blocked in this environment', e);
      resolve(null);
    }
  });
}

export function generateDictionaryCacheKey(file: { name: string; size: number; lastModified?: number }): string {
  const lm = file.lastModified || 0;
  return `dict_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}_${file.size}_${lm}`;
}

export async function getCachedDictionary(
  cacheKey: string
): Promise<{
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>;
  meta: { fileName: string; rowCount: number; attrCount: number; timestamp: number };
} | null> {
  try {
    const db = await openDb();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(cacheKey);

        req.onsuccess = () => {
          if (req.result && req.result.dictionaryIndex) {
            resolve({
              dictionaryIndex: req.result.dictionaryIndex,
              meta: req.result.meta || {
                fileName: req.result.fileName || '',
                rowCount: req.result.rowCount || 0,
                attrCount: Object.keys(req.result.dictionaryIndex).length,
                timestamp: req.result.timestamp || Date.now()
              }
            });
          } else {
            resolve(null);
          }
        };

        req.onerror = () => resolve(null);
      } catch (err) {
        console.warn('Error reading from IndexedDB:', err);
        resolve(null);
      }
    });
  } catch {
    return null;
  }
}

export async function saveCachedDictionary(
  cacheKey: string,
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  meta: { fileName: string; rowCount: number; attrCount: number }
): Promise<boolean> {
  try {
    const db = await openDb();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);

        store.put({
          key: cacheKey,
          dictionaryIndex,
          meta: {
            ...meta,
            timestamp: Date.now()
          }
        });

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (err) {
        console.warn('Error saving to IndexedDB:', err);
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

export async function clearAllCachedDictionaries(): Promise<boolean> {
  try {
    const db = await openDb();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}
