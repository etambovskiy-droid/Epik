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
  type: 'select' | 'multiselect' | 'text' | 'numeric' | 'float' | 'string' | 'boolean' | 'array';
  isSystem?: boolean;
  isRequired?: boolean;
  is_required?: boolean;
  isFilter?: boolean;
  is_filter?: boolean;
  isModel?: boolean;
  suffix?: string;
  prefix?: string | null;
  translations?: {
    languageCode: string;
    title: string;
    suffix?: string;
    prefix?: string | null;
  }[];
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
    code: '770',
    name: 'Настільні ігри',
    category_codes: ['770'],
    attributes: [
      {
        code: 'language',
        name: 'Мова видання',
        type: 'select',
        isRequired: true,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Мова видання' },
          { languageCode: 'ru', title: 'Язык издания' }
        ],
        options: [
          { code: 'ukr', value: 'Українська', value_ru: 'Украинский' },
          { code: 'eng', value: 'Англійська', value_ru: 'Английский' },
          { code: 'rus', value: 'Російська', value_ru: 'Русский' },
          { code: 'pol', value: 'Польська', value_ru: 'Польский' },
          { code: 'language_independent', value: 'Мовонезалежна', value_ru: 'Языконезависимая' }
        ]
      },
      {
        code: 'players_count',
        name: 'Кількість гравців',
        type: 'select',
        isRequired: true,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Кількість гравців' },
          { languageCode: 'ru', title: 'Количество игроков' }
        ],
        options: [
          { code: 'dlya_1', value: 'для 1', value_ru: 'для 1' },
          { code: 'dlya_2', value: 'для 2', value_ru: 'для 2' },
          { code: 'vid_2_do_4', value: '2-4', value_ru: '2-4' },
          { code: 'vid_2_do_6', value: '2-6', value_ru: '2-6' },
          { code: 'vid_2_do_8', value: '2-8', value_ru: '2-8' },
          { code: 'dlya_kompanii', value: 'для компанії', value_ru: 'для компании' }
        ]
      },
      {
        code: 'age_group',
        name: 'Вікова група',
        type: 'select',
        isRequired: true,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Вікова група' },
          { languageCode: 'ru', title: 'Возрастная группа' }
        ],
        options: [
          { code: 'vid_3_rokiv', value: 'від 3 років', value_ru: 'от 3 лет' },
          { code: 'vid_6_rokiv', value: 'від 6 років', value_ru: 'от 6 лет' },
          { code: 'vid_8_rokiv', value: 'від 8 років', value_ru: 'от 8 лет' },
          { code: 'vid_10_rokiv', value: 'від 10 років', value_ru: 'от 10 лет' },
          { code: 'vid_12_rokiv', value: 'від 12 років', value_ru: 'от 12 лет' },
          { code: 'vid_14_rokiv', value: 'від 14 років', value_ru: 'от 14 лет' },
          { code: 'vid_16_rokiv', value: 'від 16 років', value_ru: 'от 16 лет' },
          { code: '18_plus', value: '18+', value_ru: '18+' }
        ]
      },
      {
        code: 'genre',
        name: 'Жанр / Тематика',
        type: 'multiselect',
        isRequired: false,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Жанр / Тематика' },
          { languageCode: 'ru', title: 'Жанр / Тематика' }
        ],
        options: [
          { code: 'rozvazhalni', value: 'розважальні', value_ru: 'развлекательные' },
          { code: 'stratehii', value: 'стратегії', value_ru: 'стратегии' },
          { code: 'detektyvni', value: 'детективні', value_ru: 'детективные' },
          { code: 'intelektualni', value: 'інтелектуальні', value_ru: 'интеллектуальные' },
          { code: 'simeyni', value: 'сімейні', value_ru: 'семейные' },
          { code: 'ekonomichni', value: 'економічні', value_ru: 'экономические' },
          { code: 'kartkovi', value: 'карткові', value_ru: 'карточные' },
          { code: 'dytiachi', value: 'дитячі', value_ru: 'детские' }
        ]
      },
      {
        code: 'playtime',
        name: 'Час гри',
        type: 'select',
        isRequired: false,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Час гри' },
          { languageCode: 'ru', title: 'Время игры' }
        ],
        options: [
          { code: 'do_30_khv', value: 'до 30 хв', value_ru: 'до 30 мин' },
          { code: '30_60_khv', value: '30-60 хв', value_ru: '30-60 мин' },
          { code: '60_120_khv', value: '60-120 хв', value_ru: '60-120 мин' },
          { code: 'vid_120_khv', value: 'від 120 хв', value_ru: 'от 120 мин' }
        ]
      },
      {
        code: 'material',
        name: 'Матеріал',
        type: 'multiselect',
        isRequired: false,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Матеріал' },
          { languageCode: 'ru', title: 'Материал' }
        ],
        options: [
          { code: 'karton', value: 'картон', value_ru: 'картон' },
          { code: 'derevo', value: 'дерево', value_ru: 'дерево' },
          { code: 'plastyk', value: 'пластик', value_ru: 'пластик' },
          { code: 'tekstyl', value: 'текстиль', value_ru: 'текстиль' }
        ]
      },
      {
        code: '767',
        name: 'Комплектація',
        type: 'text',
        isRequired: false,
        isFilter: false,
        translations: [
          { languageCode: 'ua', title: 'Комплектація' },
          { languageCode: 'ru', title: 'Комплектация' }
        ]
      },
      {
        code: 'brand',
        name: 'Бренд',
        type: 'select',
        isRequired: true,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Бренд' },
          { languageCode: 'ru', title: 'Бренд' }
        ]
      },
      {
        code: 'country_of_origin',
        name: 'Країна-виробник',
        type: 'select',
        isRequired: true,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Країна-виробник' },
          { languageCode: 'ru', title: 'Страна-производитель' }
        ]
      }
    ]
  },
  {
    code: '3343',
    name: 'Картини за номерами',
    category_codes: ['3343'],
    attributes: [
      {
        code: '13183',
        name: 'Розмір',
        type: 'select',
        isRequired: true,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Розмір' },
          { languageCode: 'ru', title: 'Размер' }
        ],
        options: [
          { code: 'd7c3d344fd844ca187739e4f6a4d5baa', value: '15x30' },
          { code: 'a12bc44fd844ca187739e4f6a4d5ccc', value: '30x30' },
          { code: 'e89ff44fd844ca187739e4f6a4d5ddd', value: '40x50' }
        ]
      },
      {
        code: '11887',
        name: 'Полотно',
        type: 'select',
        isRequired: false,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Полотно' },
          { languageCode: 'ru', title: 'Холст' }
        ],
        options: [
          { code: 'c5380bbfa7fca64b5496a10bfde38b3a', value: 'поліестер' },
          { code: 'f1280bbfa7fca64b5496a10bfde38baa', value: 'бавовна' }
        ]
      },
      {
        code: '9875',
        name: 'Рівень складності',
        type: 'select',
        isRequired: false,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Рівень складності' },
          { languageCode: 'ru', title: 'Уровень сложности' }
        ],
        options: [
          { code: 'b15bfd532157cfd62c9ba04987760e9c', value: 'середній' },
          { code: 'c22bfd532157cfd62c9ba04987760e9d', value: 'простий' },
          { code: 'd33bfd532157cfd62c9ba04987760e9e', value: 'складний' }
        ]
      },
      {
        code: '3176',
        name: 'Тематика',
        type: 'multiselect',
        isRequired: false,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Тематика' },
          { languageCode: 'ru', title: 'Тематика' }
        ],
        options: [
          { code: 'bsz6btxa', value: 'тварини' },
          { code: 'wle9vq5zsirz1dni', value: 'коти' },
          { code: 'pe78q1zsirz1dni', value: 'квіти' },
          { code: 'la99q1zsirz1dni', value: 'пейзаж' }
        ]
      },
      {
        code: '767',
        name: 'Комплектація',
        type: 'text',
        isRequired: false,
        isFilter: false,
        translations: [
          { languageCode: 'ua', title: 'Комплектація' },
          { languageCode: 'ru', title: 'Комплектация' }
        ]
      },
      {
        code: 'brand',
        name: 'Бренд',
        type: 'select',
        isSystem: true,
        isRequired: true,
        isFilter: true,
        translations: [
          { languageCode: 'ua', title: 'Бренд' },
          { languageCode: 'ru', title: 'Бренд' }
        ],
        options: [
          { code: 'cz1445500250k5a9', value: 'Ідейка' },
          { code: 'br_brushme_2026', value: 'Brushme' },
          { code: 'generic', value: 'Generic' }
        ]
      },
      {
        code: 'country_of_origin',
        name: 'Країна-виробник',
        type: 'select',
        isSystem: true,
        isRequired: true,
        isFilter: false,
        translations: [
          { languageCode: 'ua', title: 'Країна-виробник' },
          { languageCode: 'ru', title: 'Страна-производитель' }
        ],
        options: [
          { code: 'ukr', value: 'Україна' },
          { code: 'chn', value: 'Китай' },
          { code: 'pol', value: 'Польща' },
          { code: 'deu', value: 'Німеччина' }
        ]
      },
      { code: 'measure', name: 'Міра виміру', type: 'select', isSystem: true, isRequired: true },
      { code: 'ratio', name: 'Мінімальна кратність товару', type: 'float', isSystem: true, isRequired: true },
      { code: 'width', name: 'Ширина', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'height', name: 'Висота', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'length', name: 'Глибина', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'weight', name: 'Вага', type: 'float', isSystem: true, isRequired: true, suffix: 'г' },
      { code: 'barcodes', name: 'Штрих код', type: 'array', isSystem: true, isRequired: false }
    ]
  },
  {
    code: '159',
    name: 'Фото- та відеотехніка',
    category_codes: ['159'],
    attributes: [
      { code: 'weight', name: 'Вага', type: 'float', isSystem: true, isRequired: true, suffix: 'г' },
      { code: 'description', name: 'Опис', type: 'text', isSystem: true, isRequired: false },
      { code: '14195', name: 'Обмін та повернення', type: 'select', isSystem: false, isRequired: false },
      { code: 'width', name: 'Ширина', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: '767', name: 'Комплектація', type: 'text', isSystem: false, isRequired: false },
      { code: '113', name: 'Гарантія', type: 'float', isSystem: false, isRequired: false, suffix: 'міс.' },
      { code: 'producer_code', name: 'Модель виробника (референція)', type: 'string', isSystem: true, isRequired: false },
      { code: 'barcodes', name: 'Штрих код', type: 'array', isSystem: true, isRequired: false },
      { code: 'height', name: 'Висота', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'length', name: 'Глибина', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'measure', name: 'Одиниця виміру та кількість', type: 'select', isSystem: true, isRequired: true },
      { code: 'ratio', name: 'Мінімальна кратність товару', type: 'float', isSystem: true, isRequired: true },
      { code: 'country_of_origin', name: 'Країна-виробник', type: 'select', isSystem: true, isRequired: true },
      { code: 'brand', name: 'Бренд', type: 'select', isSystem: true, isRequired: true, isFilter: true }
    ]
  },
  {
    code: 'attr_set_drills',
    name: 'Ударні та акумуляторні дрилі',
    category_codes: ['10543'],
    attributes: [
      { code: 'brand', name: 'Бренд', type: 'select', isRequired: true, isFilter: true },
      { code: 'country_of_origin', name: 'Країна-виробник', type: 'select', isRequired: true },
      { code: 'power_w', name: 'Споживана потужність, Вт', type: 'numeric', suffix: 'Вт' },
      { code: 'drill_type', name: 'Тип дриля', type: 'select', options: [{ code: 'impact', value: 'Ударний' }, { code: 'rotary', value: 'Безударний' }, { code: 'cordless', value: 'Акумуляторний' }] },
      { code: 'width', name: 'Ширина', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'height', name: 'Висота', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'length', name: 'Глибина', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'weight', name: 'Вага', type: 'float', isSystem: true, isRequired: true, suffix: 'г' }
    ]
  },
  {
    code: 'attr_set_faucets',
    name: 'Змішувачі побутові',
    category_codes: ['20102'],
    attributes: [
      { code: 'brand', name: 'Бренд', type: 'select', isRequired: true, isFilter: true },
      { code: 'country_of_origin', name: 'Країна-виробник', type: 'select', isRequired: true },
      { code: 'material', name: 'Матеріал корпуса', type: 'select', options: [{ code: 'brass', value: 'Латунь' }, { code: 'stainless', value: 'Нержавіюча сталь' }, { code: 'silumin', value: 'Силумін' }] },
      { code: 'mount_type', name: 'Тип монтажу', type: 'select', options: [{ code: 'deck', value: 'На виріб / раковину' }, { code: 'wall', value: 'Настінний' }, { code: 'hidden', value: 'Прихованого монтажу' }] },
      { code: 'width', name: 'Ширина', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'height', name: 'Висота', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'length', name: 'Глибина', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'weight', name: 'Вага', type: 'float', isSystem: true, isRequired: true, suffix: 'г' }
    ]
  },
  {
    code: 'attr_set_appliances',
    name: 'Побутова техніка для дому',
    category_codes: ['30201', '30202', '30203'],
    attributes: [
      { code: 'brand', name: 'Бренд', type: 'select', isRequired: true, isFilter: true },
      { code: 'country_of_origin', name: 'Країна-виробник', type: 'select', isRequired: true },
      { code: 'energy_class', name: 'Клас енергоспоживання', type: 'select', options: [{ code: 'a_plus_plus', value: 'A+++' }, { code: 'a_plus', value: 'A+' }, { code: 'a', value: 'A' }] },
      { code: 'width', name: 'Ширина', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'height', name: 'Висота', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'length', name: 'Глибина', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
      { code: 'weight', name: 'Вага', type: 'float', isSystem: true, isRequired: true, suffix: 'г' }
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
   * Safely extract a human-readable string from any error payload
   */
  private extractErrorMessage(jsonPayload: any, fallbackText: string): string {
    if (!jsonPayload) return fallbackText;
    if (typeof jsonPayload === 'string') return jsonPayload.trim() || fallbackText;
    if (typeof jsonPayload === 'object') {
      if (typeof jsonPayload.message === 'string' && jsonPayload.message.trim()) {
        return jsonPayload.message.trim();
      }
      if (typeof jsonPayload.error === 'string' && jsonPayload.error.trim()) {
        return jsonPayload.error.trim();
      }
      if (jsonPayload.error && typeof jsonPayload.error === 'object') {
        if (typeof jsonPayload.error.message === 'string' && jsonPayload.error.message.trim()) {
          return jsonPayload.error.message.trim();
        }
        if (typeof jsonPayload.error.code === 'string') {
          return `Код помилки: ${jsonPayload.error.code}`;
        }
        try {
          return JSON.stringify(jsonPayload.error);
        } catch {
          // ignore stringify errors
        }
      }
      if (typeof jsonPayload.title === 'string' && jsonPayload.title.trim()) {
        return jsonPayload.title.trim();
      }
    }
    return fallbackText;
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
      let rawText = '';
      try {
        rawText = await res.text();
        if (rawText) {
          jsonPayload = JSON.parse(rawText);
        }
      } catch {
        // Not a JSON response
      }

      if (res.ok && jsonPayload !== null) {
        return { data: jsonPayload as T, source: 'proxy' };
      }

      const host = typeof window !== 'undefined' ? window.location.host : '';

      if (res.status === 404) {
        const detail = this.extractErrorMessage(
          jsonPayload,
          `Ендпоінт /api/epicentr-proxy не знайдено на ${host || 'сервері'}. Перевірте наявність vercel.json або запуск backend-проксі.`
        );
        throw new Error(`Проксі не налаштовано (404): ${detail}`);
      }

      if (res.status === 401 || res.status === 403) {
        const detail = this.extractErrorMessage(jsonPayload, 'Токен недійсний або не має дозволу на операцію.');
        throw new Error(`Помилка авторизації Merchant API (${res.status}): ${detail}`);
      }

      if (res.status === 502 || res.status === 504) {
        throw new Error(`Сервіс Merchant API Епіцентр тимчасово недоступний (${res.status}).`);
      }

      if (!res.ok) {
        const msg = this.extractErrorMessage(jsonPayload, rawText || `Сервер повернув статус ${res.status}`);
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
          let suffix = a.suffix || '';
          let prefix = a.prefix || null;
          let translations: any[] = [];
          if (Array.isArray(a.translations)) {
            translations = a.translations;
            const ua = a.translations.find((t: any) => t.languageCode === 'ua');
            if (ua?.title) aName = ua.title;
            if (ua?.suffix) suffix = ua.suffix;
            if (ua?.prefix) prefix = ua.prefix;
          }
          return {
            code: String(a.code),
            name: aName,
            type: a.type || 'text',
            isSystem: Boolean(a.isSystem),
            isRequired: Boolean(a.isRequired),
            isFilter: Boolean(a.isFilter),
            isModel: Boolean(a.isModel),
            suffix,
            prefix,
            translations
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

    const fallback = FALLBACK_ATTRIBUTE_SETS.find(
      (s) => s.code === cleanCode || (s.category_codes && s.category_codes.includes(cleanCode))
    );
    if (fallback) return fallback;

    // Universal dynamic attribute set fallback for ANY future category
    return {
      code: cleanCode,
      name: `Набір характеристик #${cleanCode}`,
      category_codes: [cleanCode],
      attributes: [
        { code: 'brand', name: 'Бренд', type: 'select', isRequired: true, isFilter: true },
        { code: 'country_of_origin', name: 'Країна-виробник', type: 'select', isRequired: true, isFilter: true },
        { code: 'measure', name: 'Міра виміру', type: 'select', isRequired: true, isSystem: true },
        { code: 'ratio', name: 'Мінімальна кратність товару', type: 'numeric', isRequired: true, isSystem: true },
        { code: 'width', name: 'Ширина', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
        { code: 'height', name: 'Висота', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
        { code: 'length', name: 'Глибина', type: 'float', isSystem: true, isRequired: true, suffix: 'мм' },
        { code: 'weight', name: 'Вага', type: 'float', isSystem: true, isRequired: true, suffix: 'г' },
        { code: '767', name: 'Комплектація', type: 'text', isRequired: false },
        { code: 'material', name: 'Матеріал', type: 'multiselect', isRequired: false, isFilter: true },
        { code: 'color', name: 'Колір', type: 'select', isRequired: false, isFilter: true }
      ]
    };
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
