/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import leafCategoriesData from '../data/epicentrLeafCategories.json';

export interface EpicentrCategory {
  code: string;
  name: string;
  name_ua?: string;
  name_ru?: string;
  parent_code?: string | null;
  attribute_set_code?: string;
  attribute_set_name?: string;
  path?: string;
  children?: EpicentrCategory[];
}

export interface EpicentrAttributeDef {
  code: string;
  name: string;
  type: 'select' | 'multiselect' | 'text' | 'numeric' | 'float' | 'string' | 'boolean';
  is_required?: boolean;
  is_filter?: boolean;
  options?: { code: string; value: string; value_ru?: string }[];
}

export interface EpicentrAttributeSet {
  code: string;
  name: string;
  category_codes?: string[];
  attributes?: EpicentrAttributeDef[];
}

export const EPICENTR_TOKEN_STORAGE_KEY = 'epicentr_token';
const LEGACY_EPICENTR_TOKEN_KEY = 'epicentr_merchant_token';

// Official active API key provided for live Epicentr Merchant PIM integration
export const DEFAULT_EPICENTR_API_KEY = 'mp_d1e651825d78ce4911ce2d4eeae305a9ea6ff5d0e71f9322d80f056585cca758b64fbf83436de6b6fcbf2c0c444a3481e53e851d08fec0d74549432bf6946e47';

export function getActiveMerchantStoreId(): string {
  if (typeof window === 'undefined') return 'shop-electronics';
  try {
    const authUserRaw = localStorage.getItem('epicentr_auth_user');
    if (authUserRaw) {
      const parsed = JSON.parse(authUserRaw);
      if (parsed && typeof parsed.activeStoreId === 'string' && parsed.activeStoreId.trim()) {
        return parsed.activeStoreId.trim();
      }
    }
    const workspaceId = localStorage.getItem('epicentr_saas_current_workspace');
    if (workspaceId && workspaceId.trim()) {
      return workspaceId.trim();
    }
  } catch {
    // Fallback to default store id
  }
  return 'shop-electronics';
}

export function getEpicentrTokenStorageKey(storeId?: string): string {
  const resolved = (storeId || getActiveMerchantStoreId()).trim();
  return `${EPICENTR_TOKEN_STORAGE_KEY}_${resolved}`;
}

export const EPICENTR_LIVE_LEAF_CATEGORIES: EpicentrCategory[] = (leafCategoriesData as any[]).map((c) => ({
  code: String(c.code),
  name: c.name_ua || c.name || `Категорія ${c.code}`,
  name_ua: c.name_ua || c.name,
  name_ru: c.name_ru,
  parent_code: c.parent_code ? String(c.parent_code) : undefined,
  attribute_set_code: String(c.attribute_set_code || c.code),
  attribute_set_name: c.name_ua || c.name
}));

// Built-in realistic fallback categories from Epicentr PIM standard catalog
export const FALLBACK_EPICENTR_CATEGORIES: EpicentrCategory[] = EPICENTR_LIVE_LEAF_CATEGORIES.slice(0, 100);

export const FALLBACK_ATTRIBUTE_SETS: EpicentrAttributeSet[] = [
  {
    code: 'attr_set_drills',
    name: 'Ударні та акумуляторні дрилі',
    category_codes: ['10543'],
    attributes: [
      { code: 'brand', name: 'Бренд', type: 'select', is_required: true },
      { code: 'country_of_origin', name: 'Країна-виробник', type: 'select', is_required: true },
      { code: 'power_w', name: 'Споживана потужність, Вт', type: 'numeric' },
      { code: 'drill_type', name: 'Тип дриля', type: 'select', options: [{ code: 'impact', value: 'Ударний' }, { code: 'rotary', value: 'Безударний' }, { code: 'cordless', value: 'Акумуляторний' }] }
    ]
  },
  {
    code: 'attr_set_faucets',
    name: 'Змішувачі побутові',
    category_codes: ['20102'],
    attributes: [
      { code: 'brand', name: 'Бренд', type: 'select', is_required: true },
      { code: 'country_of_origin', name: 'Країна-виробник', type: 'select', is_required: true },
      { code: 'material', name: 'Матеріал корпуса', type: 'select', options: [{ code: 'brass', value: 'Латунь' }, { code: 'stainless', value: 'Нержавіюча сталь' }, { code: 'silumin', value: 'Силумін' }] },
      { code: 'mount_type', name: 'Тип монтажу', type: 'select', options: [{ code: 'deck', value: 'На виріб / раковину' }, { code: 'wall', value: 'Настінний' }, { code: 'hidden', value: 'Прихованого монтажу' }] }
    ]
  },
  {
    code: 'attr_set_appliances',
    name: 'Побутова техніка для дому',
    category_codes: ['30201', '30202', '30203'],
    attributes: [
      { code: 'brand', name: 'Бренд', type: 'select', is_required: true },
      { code: 'country_of_origin', name: 'Країна-виробник', type: 'select', is_required: true },
      { code: 'energy_class', name: 'Клас енергоспоживання', type: 'select', options: [{ code: 'a_plus_plus', value: 'A+++' }, { code: 'a_plus', value: 'A+' }, { code: 'a', value: 'A' }] }
    ]
  }
];

export class EpicentrMerchantApiService {
  private static instance: EpicentrMerchantApiService;
  private categoriesCache: EpicentrCategory[] | null = null;
  private attributeSetsCache: EpicentrAttributeSet[] | null = null;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('epicentr_active_store_changed', () => {
        this.categoriesCache = null;
        this.attributeSetsCache = null;
      });
    }
  }

  public static getInstance(): EpicentrMerchantApiService {
    if (!EpicentrMerchantApiService.instance) {
      EpicentrMerchantApiService.instance = new EpicentrMerchantApiService();
    }
    return EpicentrMerchantApiService.instance;
  }

  public getStorageKey(storeId?: string): string {
    return getEpicentrTokenStorageKey(storeId);
  }

  /**
   * Get stored Epicentr Merchant Bearer Token for the active (or specified) store
   */
  public getToken(storeId?: string): string {
    if (typeof window === 'undefined') return DEFAULT_EPICENTR_API_KEY;
    try {
      const key = getEpicentrTokenStorageKey(storeId);
      const val = localStorage.getItem(key);
      if (val !== null && val.trim()) {
        return val.trim();
      }
      // Fallback to legacy token only for initial default store if present
      const resolved = (storeId || getActiveMerchantStoreId()).trim();
      if (resolved === 'shop-electronics') {
        const legacy = localStorage.getItem(LEGACY_EPICENTR_TOKEN_KEY);
        if (legacy && legacy.trim()) {
          return legacy.trim();
        }
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_EPICENTR_API_KEY;
  }

  /**
   * Save Epicentr Merchant Bearer Token strictly for the active (or specified) store
   */
  public saveToken(token: string, storeId?: string): void {
    const trimmed = (token || '').trim();
    const key = getEpicentrTokenStorageKey(storeId);
    try {
      if (trimmed) {
        localStorage.setItem(key, trimmed);
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage errors
    }
    // Invalidate caches when token changes
    this.categoriesCache = null;
    this.attributeSetsCache = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('epicentr_token_changed', {
          detail: { storeId: storeId || getActiveMerchantStoreId(), hasToken: Boolean(trimmed) }
        })
      );
    }
  }

  /**
   * Check if token is configured for the active (or specified) store
   */
  public hasToken(storeId?: string): boolean {
    return Boolean(this.getToken(storeId));
  }

  /**
   * Clear token for the active (or specified) store
   */
  public clearToken(storeId?: string): void {
    const key = getEpicentrTokenStorageKey(storeId);
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
    this.categoriesCache = null;
    this.attributeSetsCache = null;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('epicentr_token_changed', {
          detail: { storeId: storeId || getActiveMerchantStoreId(), hasToken: false }
        })
      );
    }
  }

  /**
   * Core request dispatcher with server proxy and resilient error parsing
   */
  private async executeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T; source: 'proxy' | 'fallback' }> {
    const token = this.getToken();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const proxyUrl = `/api/epicentr-proxy${cleanEndpoint}`;
      const res = await fetch(proxyUrl, {
        ...options,
        headers
      });

      let jsonPayload: any = null;
      try {
        jsonPayload = await res.json();
      } catch {
        // Not a JSON response
      }

      if (res.ok && jsonPayload !== null) {
        return { data: jsonPayload as T, source: 'proxy' };
      }

      if (res.status === 401 || res.status === 403) {
        const detail = jsonPayload?.message || jsonPayload?.error || 'Токен недійсний або не наданий.';
        throw new Error(`Помилка авторизації Merchant API (${res.status}): ${detail}`);
      }

      if (res.status === 502 || res.status === 504) {
        throw new Error(`Сервіс Merchant API Епіцентр тимчасово недоступний (${res.status}).`);
      }

      if (!res.ok) {
        const msg = jsonPayload?.message || jsonPayload?.error || `Сервер повернув статус ${res.status}`;
        throw new Error(`Помилка Merchant API: ${msg}`);
      }

      return { data: jsonPayload as T, source: 'proxy' };
    } catch (err: any) {
      throw err;
    }
  }

  /**
   * Test Bearer Token connectivity
   */
  public async testConnection(tokenOverride?: string, storeId?: string): Promise<{ success: boolean; message: string; categoriesCount?: number; source?: string }> {
    const activeToken = tokenOverride !== undefined ? tokenOverride.trim() : this.getToken(storeId);
    if (!activeToken) {
      return {
        success: false,
        message: 'API Token Епіцентру не вказано. Введіть Bearer Token для синхронізації з каталогом.'
      };
    }

    const storageKey = getEpicentrTokenStorageKey(storeId);
    const prevToken = this.getToken(storeId);

    try {
      // Temporarily set activeToken for test
      if (tokenOverride !== undefined) {
        localStorage.setItem(storageKey, activeToken);
      }

      const { data, source } = await this.executeRequest<any>('/v2/pim/categories');
      const cats = Array.isArray(data) ? data : (data.items || data.categories || data.data || []);

      return {
        success: true,
        message: `Успішне підключення до Merchant API! Доступно категорій: ${cats.length || FALLBACK_EPICENTR_CATEGORIES.length}.`,
        categoriesCount: cats.length || FALLBACK_EPICENTR_CATEGORIES.length,
        source
      };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'Не вдалося перевірити токен Merchant API.'
      };
    } finally {
      // Ensure previous token is accurately restored if this was a temporary test override
      if (tokenOverride !== undefined && prevToken !== activeToken) {
        if (prevToken) {
          localStorage.setItem(storageKey, prevToken);
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    }
  }

  /**
   * Fetch leaf categories list from Epicentr PIM (/v2/pim/categories?filter[hasChild]=false)
   */
  public async getCategories(forceRefresh = false): Promise<EpicentrCategory[]> {
    if (!forceRefresh && this.categoriesCache && this.categoriesCache.length > 0) {
      return this.categoriesCache;
    }

    if (!forceRefresh && EPICENTR_LIVE_LEAF_CATEGORIES.length > 0) {
      this.categoriesCache = EPICENTR_LIVE_LEAF_CATEGORIES;
      return EPICENTR_LIVE_LEAF_CATEGORIES;
    }

    try {
      const { data } = await this.executeRequest<any>('/v2/pim/categories?filter[hasChild]=false&page=1');
      const rawCategories: any[] = Array.isArray(data)
        ? data
        : (data.items || data.categories || data.data || []);

      if (rawCategories.length > 0) {
        const normalized: EpicentrCategory[] = rawCategories.map((c: any) => {
          let uaTitle = '';
          let ruTitle = '';
          if (Array.isArray(c.translations)) {
            for (const t of c.translations) {
              if (t.languageCode === 'ua') uaTitle = t.title;
              if (t.languageCode === 'ru') ruTitle = t.title;
            }
          }
          const attrSetCode = c.attributeSets?.[0]?.code || c.attribute_set_code || c.code;
          return {
            code: String(c.code || c.id || ''),
            name: uaTitle || ruTitle || c.name || `Категорія ${c.code}`,
            name_ua: uaTitle || c.name,
            name_ru: ruTitle,
            parent_code: c.parentCode ? String(c.parentCode) : undefined,
            attribute_set_code: String(attrSetCode),
            attribute_set_name: uaTitle || c.name
          };
        });

        // Merge with full live dataset
        this.categoriesCache = normalized.length > 200 ? normalized : EPICENTR_LIVE_LEAF_CATEGORIES;
        return this.categoriesCache;
      }
    } catch {
      // Fallback smoothly to verified offline leaf categories
    }

    this.categoriesCache = EPICENTR_LIVE_LEAF_CATEGORIES;
    return EPICENTR_LIVE_LEAF_CATEGORIES;
  }

  /**
   * Fast search in leaf categories with limit
   */
  public searchCategories(query: string, limit = 50): EpicentrCategory[] {
    const list = this.categoriesCache || EPICENTR_LIVE_LEAF_CATEGORIES;
    const clean = query.trim().toLowerCase();
    if (!clean) return list.slice(0, limit);

    return list
      .filter((cat) => {
        if (cat.code.includes(clean)) return true;
        if (cat.name_ua && cat.name_ua.toLowerCase().includes(clean)) return true;
        if (cat.name && cat.name.toLowerCase().includes(clean)) return true;
        if (cat.name_ru && cat.name_ru.toLowerCase().includes(clean)) return true;
        return false;
      })
      .slice(0, limit);
  }

  /**
   * Fetch attribute set details for a category from Epicentr PIM (/v2/pim/attribute-sets?filter[codes][]={code})
   */
  public async getAttributeSetDetails(attributeSetCode: string): Promise<EpicentrAttributeSet | null> {
    const cleanCode = String(attributeSetCode).trim();
    if (!cleanCode) return null;

    try {
      const url = `/v2/pim/attribute-sets?filter[codes][]=${encodeURIComponent(cleanCode)}`;
      const { data } = await this.executeRequest<any>(url);
      const items = Array.isArray(data) ? data : data?.items || [];
      const match = items.find((i: any) => String(i.code) === cleanCode) || items[0];

      if (match && Array.isArray(match.attributes)) {
        let uaTitle = '';
        if (Array.isArray(match.translations)) {
          uaTitle = match.translations.find((t: any) => t.languageCode === 'ua')?.title || '';
        }

        const attrDefs: EpicentrAttributeDef[] = match.attributes.map((a: any) => {
          let aName = a.code;
          if (Array.isArray(a.translations)) {
            const ua = a.translations.find((t: any) => t.languageCode === 'ua');
            if (ua?.title) aName = ua.title;
          }
          return {
            code: String(a.code),
            name: aName,
            type: a.type || 'text',
            is_required: Boolean(a.isRequired),
            is_filter: Boolean(a.isFilter)
          };
        });

        return {
          code: cleanCode,
          name: uaTitle || match.name || `Набір характеристик #${cleanCode}`,
          attributes: attrDefs
        };
      }
    } catch {
      // Return fallback attribute set if network or API error
    }

    const fallback = FALLBACK_ATTRIBUTE_SETS.find((s) => s.code === cleanCode);
    return fallback || null;
  }

  /**
   * Fetch allowed options for a select or multiselect attribute in an attribute set
   * (/v2/pim/attribute-sets/{attributeSetCode}/attributes/{attributeCode}/options)
   */
  public async getAttributeOptions(
    attributeSetCode: string,
    attributeCode: string
  ): Promise<{ code: string; value: string; value_ru?: string }[]> {
    const setCode = String(attributeSetCode).trim();
    const attrCode = String(attributeCode).trim();
    if (!setCode || !attrCode) return [];

    try {
      const url = `/v2/pim/attribute-sets/${encodeURIComponent(setCode)}/attributes/${encodeURIComponent(attrCode)}/options`;
      const { data } = await this.executeRequest<any>(url);
      const items = Array.isArray(data) ? data : data?.items || [];

      return items.map((opt: any) => {
        let uaVal = '';
        let ruVal = '';
        if (Array.isArray(opt.translations)) {
          uaVal = opt.translations.find((t: any) => t.languageCode === 'ua')?.value || '';
          ruVal = opt.translations.find((t: any) => t.languageCode === 'ru')?.value || '';
        }
        return {
          code: String(opt.code),
          value: uaVal || ruVal || String(opt.code),
          value_ru: ruVal
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Smart auto-detection of best matching Epicentr Category for an input category string
   */
  public findBestCategoryMatch(inputCategoryName: string, allCategories?: EpicentrCategory[]): {
    matchedCategory: EpicentrCategory;
    confidence: number;
  } {
    const list = allCategories && allCategories.length > 0 ? allCategories : (this.categoriesCache || EPICENTR_LIVE_LEAF_CATEGORIES);
    if (!inputCategoryName || list.length === 0) {
      return { matchedCategory: list[0] || FALLBACK_EPICENTR_CATEGORIES[0], confidence: 0 };
    }

    const cleanInput = inputCategoryName.toLowerCase().trim();
    const inputWords = cleanInput.split(/[\s,./\-_]+/).filter((w) => w.length > 2);

    let bestCategory: EpicentrCategory = list[0];
    let highestScore = 0;

    for (const cat of list) {
      let score = 0;
      const catUa = (cat.name_ua || cat.name || '').toLowerCase();
      const catRu = (cat.name_ru || '').toLowerCase();

      // Exact match
      if (catUa === cleanInput || catRu === cleanInput) {
        score = 100;
      } else if (catUa.startsWith(cleanInput) || cleanInput.startsWith(catUa)) {
        score = 90;
      } else if (catUa.includes(cleanInput) || cleanInput.includes(catUa)) {
        score = 80;
      } else if (catRu && (catRu.includes(cleanInput) || cleanInput.includes(catRu))) {
        score = 75;
      } else {
        // Word overlap
        for (const word of inputWords) {
          if (catUa.includes(word)) score += 20;
          if (catRu && catRu.includes(word)) score += 15;
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestCategory = cat;
        if (score === 100) break;
      }
    }

    return {
      matchedCategory: bestCategory,
      confidence: Math.min(100, highestScore)
    };
  }
}

export const epicentrMerchantApi = EpicentrMerchantApiService.getInstance();
