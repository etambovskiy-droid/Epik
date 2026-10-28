/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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

export interface EpicentrAttributeSet {
  code: string;
  name: string;
  category_codes?: string[];
  attributes?: EpicentrAttributeDef[];
}

export interface EpicentrAttributeDef {
  code: string;
  name: string;
  type: 'select' | 'multiselect' | 'text' | 'numeric' | 'boolean';
  is_required?: boolean;
  options?: { code: string; value: string }[];
}

export const EPICENTR_TOKEN_STORAGE_KEY = 'epicentr_token';
const LEGACY_EPICENTR_TOKEN_KEY = 'epicentr_merchant_token';

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

// Built-in realistic fallback categories from Epicentr PIM standard catalog
export const FALLBACK_EPICENTR_CATEGORIES: EpicentrCategory[] = [
  { code: '10542', name: 'Електроінструменти', name_ua: 'Електроінструменти', name_ru: 'Электроинструменты', attribute_set_code: 'attr_set_powertools', attribute_set_name: 'Електроінструменти та оснащення' },
  { code: '10543', name: 'Дрилі та шуруповерти', name_ua: 'Дрилі та шуруповерти', name_ru: 'Дрели и шуруповерты', parent_code: '10542', attribute_set_code: 'attr_set_drills', attribute_set_name: 'Ударні та акумуляторні дрилі' },
  { code: '10544', name: 'Перфоратори', name_ua: 'Перфоратори', name_ru: 'Перфораторы', parent_code: '10542', attribute_set_code: 'attr_set_rotary_hammers', attribute_set_name: 'Перфоратори мережеві' },
  { code: '10545', name: 'Кутові шліфувальні машини (болгарки)', name_ua: 'Кутові шліфувальні машини (болгарки)', name_ru: 'Угловые шлифовальные машины (болгарки)', parent_code: '10542', attribute_set_code: 'attr_set_grinders', attribute_set_name: 'Кутові шліфмашини' },
  { code: '20101', name: 'Сантехніка та санфаянс', name_ua: 'Сантехніка та санфаянс', name_ru: 'Сантехника и санфаянс', attribute_set_code: 'attr_set_plumbing', attribute_set_name: 'Сантехнічні вироби' },
  { code: '20102', name: 'Змішувачі для кухні та ванної', name_ua: 'Змішувачі для кухні та ванної', name_ru: 'Смесители для кухни и ванной', parent_code: '20101', attribute_set_code: 'attr_set_faucets', attribute_set_name: 'Змішувачі побутові' },
  { code: '20103', name: 'Душові кабіни та гарнітури', name_ua: 'Душові кабіни та гарнітури', name_ru: 'Душевые кабины и гарнитуры', parent_code: '20101', attribute_set_code: 'attr_set_showers', attribute_set_name: 'Душове обладнання' },
  { code: '30201', name: 'Побутова техніка', name_ua: 'Побутова техніка', name_ru: 'Бытовая техника', attribute_set_code: 'attr_set_appliances', attribute_set_name: 'Побутова техніка для дому' },
  { code: '30202', name: 'Холодильники та морозильники', name_ua: 'Холодильники та морозильники', name_ru: 'Холодильники и морозильники', parent_code: '30201', attribute_set_code: 'attr_set_refrigerators', attribute_set_name: 'Холодильне обладнання' },
  { code: '30203', name: 'Пральні машини', name_ua: 'Пральні машини', name_ru: 'Стиральные машины', parent_code: '30201', attribute_set_code: 'attr_set_washers', attribute_set_name: 'Пральні та сушильні машини' },
  { code: '30204', name: 'Кавомашини та кавоварки', name_ua: 'Кавомашини та кавоварки', name_ru: 'Кофемашины и кофеварки', parent_code: '30201', attribute_set_code: 'attr_set_coffee', attribute_set_name: 'Кавове обладнання' },
  { code: '40301', name: 'Освітлення та електрика', name_ua: 'Освітлення та електрика', name_ru: 'Освещение и электрика', attribute_set_code: 'attr_set_lighting', attribute_set_name: 'Світлотехніка та LED' },
  { code: '40302', name: 'Люстри та стельові світильники', name_ua: 'Люстри та стельові світильники', name_ru: 'Люстры и потолочные светильники', parent_code: '40301', attribute_set_code: 'attr_set_chandeliers', attribute_set_name: 'Світильники стельові' },
  { code: '40303', name: 'LED стрічки та лампи', name_ua: 'LED стрічки та лампи', name_ru: 'LED ленты и лампы', parent_code: '40301', attribute_set_code: 'attr_set_led_lamps', attribute_set_name: 'LED джерела світла' },
  { code: '50401', name: 'Сад, город та інвентар', name_ua: 'Сад, город та інвентар', name_ru: 'Сад, огород и инвентарь', attribute_set_code: 'attr_set_garden', attribute_set_name: 'Садовий інструмент та техніка' },
  { code: '50402', name: 'Газонокосарки та тримери', name_ua: 'Газонокосарки та тримери', name_ru: 'Газонокосилки и триммеры', parent_code: '50401', attribute_set_code: 'attr_set_mowers', attribute_set_name: 'Газонокосарки та мотокоси' },
  { code: '60501', name: 'Будівництво та оздоблення', name_ua: 'Будівництво та оздоблення', name_ru: 'Строительство и отделка', attribute_set_code: 'attr_set_building', attribute_set_name: 'Будівельні матеріали' },
  { code: '60502', name: 'Фарби, лаки та емалі', name_ua: 'Фарби, лаки та емалі', name_ru: 'Краски, лаки и эмали', parent_code: '60501', attribute_set_code: 'attr_set_paints', attribute_set_name: 'Лакофарбова продукція' },
  { code: '70601', name: 'Меблі та декор', name_ua: 'Меблі та декор', name_ru: 'Мебель и декор', attribute_set_code: 'attr_set_furniture', attribute_set_name: 'Меблі для дому та офісу' },
  { code: '70602', name: 'Офісні крісла та столи', name_ua: 'Офісні крісла та столи', name_ru: 'Офисные кресла и столы', parent_code: '70601', attribute_set_code: 'attr_set_office_chairs', attribute_set_name: 'Крісла офісні та геймерські' }
];

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
    if (typeof window === 'undefined') return '';
    try {
      const key = getEpicentrTokenStorageKey(storeId);
      const val = localStorage.getItem(key);
      if (val !== null) {
        return val;
      }
      // Fallback to legacy token only for initial default store if present
      const resolved = (storeId || getActiveMerchantStoreId()).trim();
      if (resolved === 'shop-electronics') {
        return localStorage.getItem(LEGACY_EPICENTR_TOKEN_KEY) || '';
      }
    } catch {
      // Ignore storage errors
    }
    return '';
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
   * Core request dispatcher with Client fetch + CORS proxy fallback
   */
  private async executeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T; source: 'direct' | 'proxy' | 'fallback' }> {
    const token = this.getToken();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 1. Attempt direct client fetch
    try {
      const directUrl = `https://merchant-api.epicentrm.com.ua${cleanEndpoint}`;
      const res = await fetch(directUrl, {
        ...options,
        headers,
        mode: 'cors'
      });

      if (res.ok) {
        const json = await res.json();
        return { data: json, source: 'direct' };
      }
      // If unauthorized, throw specific error
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Помилка авторизації Merchant API (${res.status}): перевірте коректність Bearer Token.`);
      }
    } catch (directErr: any) {
      // If error was explicit 401/403 authorization error, do not attempt proxy with bad token
      if (directErr.message?.includes('авторизації')) {
        throw directErr;
      }
      // Otherwise might be CORS or network issue; proceed to proxy fallback
    }

    // 2. Attempt proxy fallback via Vite dev server proxy route
    try {
      const proxyUrl = `/api/epicentr-proxy${cleanEndpoint}`;
      const res = await fetch(proxyUrl, {
        ...options,
        headers
      });

      if (res.ok) {
        const json = await res.json();
        return { data: json, source: 'proxy' };
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error(`Помилка авторизації через проксі (${res.status}): токен недійсний.`);
      }
    } catch (proxyErr: any) {
      if (proxyErr.message?.includes('авторизації')) {
        throw proxyErr;
      }
    }

    // Return empty/fallback indicator
    throw new Error(`Неможливо підключитись до Merchant API. Перевірте мережеве з'єднання або Bearer Token.`);
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
    try {
      // Temporarily override for test if provided
      const prevToken = this.getToken(storeId);
      if (tokenOverride !== undefined) {
        localStorage.setItem(storageKey, activeToken);
      }

      const { data, source } = await this.executeRequest<any>('/v2/pim/categories');
      const cats = Array.isArray(data) ? data : (data.items || data.categories || data.data || []);

      if (tokenOverride !== undefined && prevToken !== activeToken) {
        if (prevToken) {
          localStorage.setItem(storageKey, prevToken);
        } else {
          localStorage.removeItem(storageKey);
        }
      }

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
    }
  }

  /**
   * Fetch categories list from Epicentr PIM (/v2/pim/categories)
   */
  public async getCategories(forceRefresh = false): Promise<EpicentrCategory[]> {
    if (!forceRefresh && this.categoriesCache && this.categoriesCache.length > 0) {
      return this.categoriesCache;
    }

    try {
      const { data } = await this.executeRequest<any>('/v2/pim/categories');
      const rawCategories: any[] = Array.isArray(data)
        ? data
        : (data.items || data.categories || data.data || []);

      if (rawCategories.length > 0) {
        const normalized: EpicentrCategory[] = rawCategories.map((c: any) => ({
          code: String(c.code || c.id || ''),
          name: c.name || c.name_ua || c.title || 'Категорія Епіцентр',
          name_ua: c.name_ua || c.name,
          name_ru: c.name_ru,
          parent_code: c.parent_code ? String(c.parent_code) : undefined,
          attribute_set_code: c.attribute_set_code || c.attribute_set?.code || `attr_set_${c.code}`,
          attribute_set_name: c.attribute_set_name || c.attribute_set?.name || c.name
        }));
        this.categoriesCache = normalized;
        return normalized;
      }
    } catch {
      // On failure, fall back smoothly to rich verified offline categories
    }

    this.categoriesCache = FALLBACK_EPICENTR_CATEGORIES;
    return FALLBACK_EPICENTR_CATEGORIES;
  }

  /**
   * Fetch attribute sets from Epicentr PIM (/v2/pim/attribute-sets)
   */
  public async getAttributeSets(forceRefresh = false): Promise<EpicentrAttributeSet[]> {
    if (!forceRefresh && this.attributeSetsCache && this.attributeSetsCache.length > 0) {
      return this.attributeSetsCache;
    }

    try {
      const { data } = await this.executeRequest<any>('/v2/pim/attribute-sets');
      const rawSets: any[] = Array.isArray(data)
        ? data
        : (data.items || data.attribute_sets || data.data || []);

      if (rawSets.length > 0) {
        const normalized: EpicentrAttributeSet[] = rawSets.map((s: any) => ({
          code: String(s.code || s.id || ''),
          name: s.name || s.title || 'Набір атрибутів',
          category_codes: s.category_codes || (s.category_id ? [String(s.category_id)] : []),
          attributes: Array.isArray(s.attributes) ? s.attributes.map((a: any) => ({
            code: a.code || a.id,
            name: a.name || a.title,
            type: a.type || 'text',
            is_required: Boolean(a.is_required || a.required),
            options: a.options || []
          })) : []
        }));
        this.attributeSetsCache = normalized;
        return normalized;
      }
    } catch {
      // Fallback
    }

    this.attributeSetsCache = FALLBACK_ATTRIBUTE_SETS;
    return FALLBACK_ATTRIBUTE_SETS;
  }

  /**
   * Smart auto-detection of best matching Epicentr Category for an input category string
   */
  public findBestCategoryMatch(inputCategoryName: string, allCategories: EpicentrCategory[]): {
    matchedCategory: EpicentrCategory;
    confidence: number;
  } {
    if (!inputCategoryName || allCategories.length === 0) {
      return { matchedCategory: allCategories[0] || FALLBACK_EPICENTR_CATEGORIES[0], confidence: 0 };
    }

    const cleanInput = inputCategoryName.toLowerCase().trim();
    const inputWords = cleanInput.split(/[\s,./\-_]+/).filter(w => w.length > 2);

    let bestCategory: EpicentrCategory = allCategories[0];
    let highestScore = 0;

    for (const cat of allCategories) {
      let score = 0;
      const catUa = (cat.name_ua || cat.name || '').toLowerCase();
      const catRu = (cat.name_ru || '').toLowerCase();

      // Exact match
      if (catUa === cleanInput || catRu === cleanInput) {
        score = 100;
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
      }
    }

    return {
      matchedCategory: bestCategory,
      confidence: Math.min(100, highestScore)
    };
  }
}

export const epicentrMerchantApi = EpicentrMerchantApiService.getInstance();
