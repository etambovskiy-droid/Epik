/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EpicentrColumn, EpicentrDictionaryAttribute } from '../types/epicentr';
import { EPICENTR_SYSTEM_PROMPT } from '../constants/epicentrPrompt';
import {
  extractAgeFromText,
  extractDimensionsFromText,
  extractPlayersFromText,
  extractWeightGramsFromText,
  findDictionaryAttr,
  formatEpicentrTitle,
  matchDictionaryValue,
  stripHtmlToCleanText
} from './epicentrEngine';

export const MISSING_API_KEY_EVENT = 'epic_ai_missing_key_warning';

/**
 * Normalizes column/attribute name by removing Epicentr technical suffixes
 * (e.g. "* (multiselect)", "\n[ua]", "(float) (мм)")
 */
export function getCleanAttributeName(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .replace(/\*|\(select\)|\(multiselect\)|\(text\)|\(float\)|\(array\)|\(string\)|\(мм\)|\(см\)|\(м\)|\(г\)|\(кг\)|\(л\)|\(мл\)|\[ua\]|\[ru\]/gi, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Triggers soft notification event across the app if needed.
 */
export function notifyMissingApiKey(contextAction?: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(MISSING_API_KEY_EVENT, {
        detail: {
          action: contextAction || 'обробка Excel-шаблону',
          timestamp: Date.now()
        }
      })
    );
  }
}

const AI_SYNONYM_MAP: Record<string, string> = {
  'котон': 'бавовна',
  'коттон': 'бавовна',
  'кот': 'бавовна',
  'cotton': 'бавовна',
  'стрейч': 'стретч',
  'stretch': 'стретч',
  'спандекс': 'еластан',
  'лайкра': 'еластан',
  'джеггінси': 'jeggings fit',
  'джегінси': 'jeggings fit',
  'джеггинсы': 'jeggings fit',
  'jeggings': 'jeggings fit',
  'демі-літо': 'демісезон',
  'демі': 'демісезон',
  'осінь-весна': 'демісезон',
  'весна-осінь': 'демісезон',
  'екошкіра': 'штучна шкіра',
  'шкіра pu': 'штучна шкіра',
  'кожзам': 'штучна шкіра'
};

/**
 * Local deterministic PIM heuristic extractor.
 * Guarantees attribute matching directly from dictionary and synonyms for both mandatory and optional fields.
 */
function applyLocalPimExtraction(
  productRow: Record<string, any>,
  emptyCols: EpicentrColumn[],
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  existingSuggested: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = { ...existingSuggested };

  const titleUa = stripHtmlToCleanText(
    String(
      productRow['Назва товару*\n[ua]'] ||
      productRow['Назва товару [ua]*'] ||
      productRow['Назва товару\n[ua]'] ||
      productRow['Назва товару'] ||
      ''
    )
  ).toLowerCase();
  const titleRu = stripHtmlToCleanText(
    String(
      productRow['Назва товару\n[ru]'] ||
      productRow['Назва товару [ru]*'] ||
      productRow['Назва товару*\n[ru]'] ||
      ''
    )
  ).toLowerCase();
  const descUa = stripHtmlToCleanText(
    String(
      productRow['Опис (text)\n[ua]'] ||
      productRow['Опис [ua]*'] ||
      productRow['Опис*\n[ua]'] ||
      productRow['Опис'] ||
      ''
    )
  ).toLowerCase();
  const descRu = stripHtmlToCleanText(
    String(
      productRow['Опис (text)\n[ru]'] ||
      productRow['Опис [ru]*'] ||
      productRow['Опис*\n[ru]'] ||
      ''
    )
  ).toLowerCase();

  const extraText = Object.entries(productRow)
    .filter(([k, v]) => {
      if (v === undefined || v === null || String(v).trim() === '') return false;
      const kl = k.toLowerCase();
      return !kl.includes('фото') && kl !== 'id' && !kl.includes('ціна');
    })
    .map(([, v]) => stripHtmlToCleanText(String(v || '')).toLowerCase())
    .join(' \n ');

  const fullText = `${titleUa} \n ${titleRu} \n ${descUa} \n ${descRu} \n ${extraText}`.toLowerCase();
  const parsedDimensions = extractDimensionsFromText(fullText);
  const parsedWeightGrams = extractWeightGramsFromText(fullText);
  const parsedAge = extractAgeFromText(fullText);
  const parsedPlayers = extractPlayersFromText(fullText);

  for (const col of emptyCols) {
    const origKey = col.originalName;
    const cleanKey = col.cleanName || getCleanAttributeName(origKey);
    const normKey = getCleanAttributeName(cleanKey).toLowerCase();

    if (result[origKey] || result[cleanKey]) continue;

    const dict = findDictionaryAttr(dictionaryIndex, cleanKey);

    // 1. Одиниця виміру та кількість
    if (normKey.includes('одиниця виміру')) {
      result[origKey] = 'шт.';
      result[cleanKey] = 'шт.';
    }

    // 2. Вік дитини / Вік
    else if (normKey === 'вік дитини' || normKey === 'вік' || normKey.includes('рекомендований вік')) {
      if (dict && dict.allowedValues.length > 0 && parsedAge.minAge !== undefined) {
        const m =
          matchDictionaryValue(dict, `від ${parsedAge.minAge} років`) ||
          matchDictionaryValue(dict, `${parsedAge.minAge} років`) ||
          matchDictionaryValue(dict, `${parsedAge.minAge}+`) ||
          dict.allowedValues.find(v => new RegExp(`\\b${parsedAge.minAge}\\b`).test(v));
        if (m) {
          result[origKey] = m;
          result[cleanKey] = m;
        }
      } else if (parsedAge.formattedUa) {
        result[origKey] = parsedAge.formattedUa;
        result[cleanKey] = parsedAge.formattedUa;
      }
    }

    // 3. Стать / Стать дитини
    else if (normKey === 'стать' || normKey.includes('стать дитини')) {
      const hasGirl = fullText.includes('дівчат') || fullText.includes('дівчин') || fullText.includes('девоч');
      const hasBoy = fullText.includes('хлопч') || fullText.includes('хлопц') || fullText.includes('мальчик');
      let sexVal = 'унісекс';
      if (hasGirl && !hasBoy) sexVal = 'для дівчаток';
      else if (hasBoy && !hasGirl) sexVal = 'для хлопчиків';
      else if (fullText.includes('для чоловіків') || fullText.includes('чоловіч')) sexVal = 'для чоловіків';
      else if (fullText.includes('для жінок') || fullText.includes('жіноч')) sexVal = 'для жінок';
      else if (normKey.includes('дитини') && col.type === 'multiselect') sexVal = 'для хлопчиків; для дівчаток';

      if (dict && dict.allowedValues.length > 0) {
        const m = matchDictionaryValue(dict, sexVal) || matchDictionaryValue(dict, 'унісекс');
        if (m) sexVal = m;
      }

      result[origKey] = sexVal;
      result[cleanKey] = sexVal;
    }

    // 4. Габарити упаковки (Висота / Ширина / Глибина / Довжина упаковки (мм))
    else if (
      normKey.includes('висота упаковки') ||
      normKey.includes('ширина упаковки') ||
      normKey.includes('глибина упаковки') ||
      normKey.includes('довжина упаковки') ||
      normKey === 'висота' ||
      normKey === 'ширина' ||
      normKey === 'глибина' ||
      normKey === 'довжина'
    ) {
      const isCm = col.unit === 'см' || origKey.toLowerCase().includes('(см)');
      const toStr = (mm?: number) => (mm && mm > 0 ? String(isCm ? Number((mm / 10).toFixed(1)) : Math.round(mm)) : '');
      let dimVal = '';
      if (normKey.includes('висота')) dimVal = toStr(parsedDimensions.heightMm);
      else if (normKey.includes('ширина')) dimVal = toStr(parsedDimensions.widthMm);
      else if (normKey.includes('глибина')) dimVal = toStr(parsedDimensions.depthMm);
      else if (normKey.includes('довжина')) dimVal = toStr(parsedDimensions.lengthMm || parsedDimensions.heightMm);
      if (dimVal) {
        result[origKey] = dimVal;
        result[cleanKey] = dimVal;
      }
    }

    // 5. Вага упаковки (г) / Вага
    else if (normKey.includes('вага')) {
      if (parsedWeightGrams && parsedWeightGrams > 0) {
        const isKg = col.unit === 'кг' || origKey.toLowerCase().includes('(кг)');
        const wStr = isKg ? String(Number((parsedWeightGrams / 1000).toFixed(3))) : String(Math.round(parsedWeightGrams));
        result[origKey] = wStr;
        result[cleanKey] = wStr;
      }
    }

    // 6. Кількість гравців
    else if (normKey.includes('кількість гравців') || normKey.includes('гравців')) {
      if (parsedPlayers.formatted) {
        const m = dict ? matchDictionaryValue(dict, parsedPlayers.formatted) || parsedPlayers.formatted : parsedPlayers.formatted;
        result[origKey] = m;
        result[cleanKey] = m;
      }
    }

    // 7. Бренд
    else if (normKey === 'бренд') {
      if (dict && dict.allowedValues) {
        for (const brand of dict.allowedValues) {
          if (brand.length > 2 && (titleUa.includes(brand.toLowerCase()) || titleRu.includes(brand.toLowerCase()) || fullText.includes(brand.toLowerCase()))) {
            result[origKey] = brand;
            result[cleanKey] = brand;
            break;
          }
        }
      }
    }

    // 8. Розмір (наприклад '25, 26' -> '25; 26')
    else if (normKey.includes('розмір')) {
      if (dict && dict.allowedValues && dict.allowedValues.length > 0) {
        const matchedSizes = dict.allowedValues.filter(sz => {
          const escaped = sz.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const reg = new RegExp(`(?<![0-9а-яіїєґa-z])${escaped}(?![0-9а-яіїєґa-z])`, 'i');
          return reg.test(fullText);
        });
        if (matchedSizes.length > 0) {
          const val = col.type === 'multiselect' || col.type === 'array' ? matchedSizes.join('; ') : matchedSizes[0];
          result[origKey] = val;
          result[cleanKey] = val;
        }
      } else {
        const sizeMatch = fullText.match(/розмір[иа]?[:\s-]+([0-9,\s;-]+)/i) || titleUa.match(/\b(\d{2}(?:\s*,\s*\d{2})+)\b/);
        if (sizeMatch && sizeMatch[1]) {
          const normalizedSizes = sizeMatch[1]
            .split(/[,;]/)
            .map(s => s.trim())
            .filter(Boolean)
            .join('; ');
          if (normalizedSizes) {
            result[origKey] = normalizedSizes;
            result[cleanKey] = normalizedSizes;
          }
        }
      }
    }

    // 9. Тематика та Жанр
    else if (normKey === 'тематика' || normKey === 'жанр') {
      const genreRules: Array<{ kw: string[]; val: string }> = [
        { kw: ['розважальн', 'весел', 'компані', 'вечірк'], val: 'розважальні' },
        { kw: ['розвиваюч', 'навчальн', 'пізнавальн', 'пам\'ят', 'моторик'], val: 'розвиваючі' },
        { kw: ['логічн', 'головоломк', 'шах', 'шашк'], val: 'логічні' },
        { kw: ['стратегічн', 'стратегія'], val: 'стратегічні' },
        { kw: ['економічн', 'монополі', 'бізнес'], val: 'економічні' },
        { kw: ['картков', 'карти', 'уно', 'uno', 'мемо', 'доміно', 'лото'], val: 'карткові' },
        { kw: ['сімейн', 'родинн'], val: 'сімейні' },
        { kw: ['пригодницьк', 'бродилк', 'квест'], val: 'пригодницькі' },
        { kw: ['творч', 'малюван', 'картина за номерами', 'алмазна мозаїка', 'ліплен'], val: 'творчість' }
      ];
      const matched: string[] = [];
      if (dict && dict.allowedValues) {
        for (const opt of dict.allowedValues) {
          if (opt.length > 2 && fullText.includes(opt.toLowerCase())) {
            matched.push(opt);
          }
        }
      }
      for (const r of genreRules) {
        if (r.kw.some(k => fullText.includes(k))) {
          const valToAdd = dict ? matchDictionaryValue(dict, r.val) || r.val : r.val;
          if (!matched.includes(valToAdd)) matched.push(valToAdd);
        }
      }
      if (matched.length === 0 && (fullText.includes('настільн') || fullText.includes('гра'))) {
        matched.push(dict ? matchDictionaryValue(dict, 'розважальні') || 'розважальні' : 'розважальні');
      }
      if (matched.length > 0) {
        const val = col.type === 'multiselect' ? matched.slice(0, 3).join('; ') : matched[0];
        result[origKey] = val;
        result[cleanKey] = val;
      }
    }

    // 10. Вікова група
    else if (normKey === 'вікова група') {
      const val = fullText.includes('для дорослих') || fullText.includes('жіноч') || fullText.includes('чоловіч') ? 'для дорослих' : 'для дітей';
      result[origKey] = val;
      result[cleanKey] = val;
    }

    // 11. Країна-виробник
    else if (normKey.includes('країна')) {
      if (dict && dict.allowedValues) {
        const foundCountry = dict.allowedValues.find(c => fullText.includes(c.toLowerCase()));
        if (foundCountry) {
          result[origKey] = foundCountry;
          result[cleanKey] = foundCountry;
        }
      } else if (fullText.includes('україна') || fullText.includes('українськ') || fullText.includes('strateg')) {
        result[origKey] = 'Україна';
        result[cleanKey] = 'Україна';
      }
    }

    // 12. Універсальний підбір за довідником та синонімами (для будь-яких інших обов'язкових та додаткових колонок)
    if (!result[origKey] && dict && dict.allowedValues && dict.allowedValues.length > 0) {
      const matchedItems: string[] = [];

      for (const allowedVal of dict.allowedValues) {
        const cleanAllowed = allowedVal.toLowerCase().trim();
        if (cleanAllowed.length >= 3 && fullText.includes(cleanAllowed)) {
          if (!matchedItems.includes(allowedVal)) {
            matchedItems.push(allowedVal);
          }
        }
      }

      for (const [synKey, synTarget] of Object.entries(AI_SYNONYM_MAP)) {
        if (fullText.includes(synKey)) {
          const foundInDict = dict.allowedValues.find(
            a => a.toLowerCase().trim() === synTarget.toLowerCase()
          );
          if (foundInDict && !matchedItems.includes(foundInDict)) {
            matchedItems.push(foundInDict);
          }
        }
      }

      if (matchedItems.length > 0) {
        const finalVal = col.type === 'multiselect' ? matchedItems.join('; ') : matchedItems[0];
        result[origKey] = finalVal;
        result[cleanKey] = finalVal;
      }
    }
  }

  return result;
}

/**
 * AI Title Generation according to Epicentr Official Formula via server-side Gemini endpoint
 */
export async function generateAiEpicentrTitle(
  productRow: Record<string, any>,
  _columns: EpicentrColumn[]
): Promise<{ title: string | null; error?: string; isFallback?: boolean }> {
  const rawTitle = String(
    productRow['Назва товару*\n[ua]'] ||
    productRow['Назва товару [ua]*'] ||
    productRow['Назва товару\n[ua]'] ||
    productRow['Назва товару'] ||
    productRow['Назва товару [ru]*'] ||
    ''
  ).trim();

  const sku = String(
    productRow['Артикул*'] ||
    productRow['Артикул'] ||
    productRow['Код товару'] ||
    productRow['Модель'] ||
    ''
  ).trim();

  const brand = String(
    productRow['Бренд*\n(select)'] ||
    productRow['Бренд (select)*'] ||
    productRow['Бренд'] ||
    ''
  ).trim();

  try {
    const prompt = `Ти — експерт контенту маркетплейсу Епіцентр.
Твоє завдання: сформувати ідеальну назву товару українською мовою згідно з регламентом Епіцентру.
Формула назви Епіцентру:
<Тип товару> <Особливість> <Бренд> <Модель> <Ключова характеристика/Розмір> <Колір> (<Артикул>)

Правила:
1. Заборонені маркетингові слова (Топ, Акція, Хіт, Дешево, Супер, Новинка, 100%, Якісний тощо).
2. Назва товару українською мовою. Бренд і модель латиницею (як в оригіналі).
3. Довжина до 150 символів. Наприкінці обов'язково артикул у круглих дужках: (АРТИКУЛ).
4. Поверни ТІЛЬКИ фінальну сформовану назву одним рядком без лапок і коментарів.

Поточна назва: ${rawTitle}
Дані товару:
${JSON.stringify(productRow, null, 2)}`;

    const response = await fetch('/api/gemini/title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3.1-flash-lite',
        prompt,
        systemInstruction: EPICENTR_SYSTEM_PROMPT,
        rawTitle,
        sku,
        brand
      })
    });

    if (response.ok) {
      const data = await response.json();
      const text = data?.text?.trim();
      if (text) {
        const cleanTitle = text.replace(/^["']|["']$/g, '').trim();
        return {
          title: cleanTitle,
          isFallback: data.isFallback || false
        };
      }
    }
  } catch (err: any) {
    console.warn('Gemini AI title generation notice, switching to rule-based fallback:', err);
  }

  // Guaranteed deterministic fallback according to Epicentr Official Formula
  const fallbackTitle = formatEpicentrTitle({
    rawTitle,
    sku,
    brand,
    lang: 'ua'
  });

  return {
    title: fallbackTitle,
    isFallback: true
  };
}

/**
 * Matches a token against allowed dictionary values using exact match, synonyms and partial match.
 */
export function resolveTokenAgainstAllowed(
  token: string,
  allowed: string[],
  allowedLower?: string[]
): string | null {
  if (!token || !allowed || allowed.length === 0) return null;
  const lowerToken = token.toLowerCase().trim();
  const lowerList = allowedLower || allowed.map(a => a.toLowerCase().trim());
  const mappedSynonym = AI_SYNONYM_MAP[lowerToken]?.toLowerCase();

  const exactIdx = lowerList.indexOf(lowerToken);
  if (exactIdx >= 0) return allowed[exactIdx];

  if (mappedSynonym) {
    const synIdx = lowerList.indexOf(mappedSynonym);
    if (synIdx >= 0) return allowed[synIdx];
  }

  const partialMatch = allowed.find(a => {
    const al = a.toLowerCase().trim();
    return (
      al.includes(lowerToken) ||
      lowerToken.includes(al) ||
      (mappedSynonym ? al.includes(mappedSynonym) || mappedSynonym.includes(al) : false)
    );
  });
  return partialMatch || null;
}

export interface GroundedResearchResult {
  suggestedValues: Record<string, string>;
  explanations?: Record<string, string>;
  sources?: { uri: string; title: string }[];
  searchEntryPoint?: string | null;
  searchQuery?: string;
  fromCache?: boolean;
  cacheKey?: string;
  error?: string;
}

const SEARCH_CACHE_INDEX_KEY = 'epicentr_google_search_cache_v1';

export const OFFICIAL_CATALOG_SYSTEM_INSTRUCTION = `Ти — експертний PIM-аналітик маркетплейсу Епіцентр. Шукай інформацію пріоритетно на офіційних сайтах виробників, офіційних дистриб'юторів та авторитетних каталогах товарів. Повертай виключно валідний JSON без markdown-обгорток.`;

/**
 * Cleans product title from noise: strips HTML tags, size lists, parenthetical SKUs, and marketing buzzwords.
 */
export function cleanProductTitleNoise(rawTitle: string, brand?: string, vendorCode?: string): string {
  if (!rawTitle) return '';
  const marketingRegex =
    /(?:^|[^\p{L}\p{N}])(акція|акция|знижка|скидка|original|оригінал|оригинал|розпродаж|распродажа|уцінка|уценка|новинка|топ|хіт|хит|супер|super|дешево|дешевий|розпродаж|ексклюзив)(?:[^\p{L}\p{N}]|$)/giu;

  let cleaned = stripHtmlToCleanText(rawTitle)
    .replace(marketingRegex, ' ')
    .replace(marketingRegex, ' ')
    // Remove explicit size lists like "розмір 25, 26, 27", "р. 42-48", "розміри: S, M, L, XL"
    .replace(/(?:розмір[иа]?|размер[ыа]?|р\.|size)\s*[:\-]?\s*[0-9a-zA-Zа-яіїєґА-ЯІЇЄҐ]+(?:\s*[,\/;-]\s*[0-9a-zA-Zа-яіїєґА-ЯІЇЄҐ]+)*/gi, ' ')
    .replace(/\b(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL)(?:\s*[,\/;-]\s*(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL))+\b/gi, ' ')
    .replace(/\b\d{2}\s*[,;-]\s*\d{2}(?:\s*[,;-]\s*\d{2})*\b/g, ' ')
    .replace(/\([^)]*\)/g, ' ');

  const cleanBrand = (brand || '').replace(/^інше$/i, '').trim();
  if (cleanBrand) {
    const escapedBrand = cleanBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`\\b${escapedBrand}\\b`, 'gi'), ' ');
  }

  const cleanSku = (vendorCode || '').trim();
  if (cleanSku) {
    const escapedSku = cleanSku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`\\b${escapedSku}\\b`, 'gi'), ' ');
  }

  return cleaned
    .replace(/[!,.;:+"/\\|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes a SKU or Model into a base series identifier by stripping trailing size/color modification suffixes
 * (e.g., "DJ-102-XL" -> "DJ-102", "STR-3055-42" -> "STR-3055", "MOD-77/BLK" -> "MOD-77").
 */
export function extractBaseSeriesModelOrSku(
  vendorCode: string,
  productTitle: string,
  brand?: string
): string {
  const rawSku = (vendorCode || '').trim();
  if (rawSku.length >= 3) {
    const strippedSku = rawSku
      .replace(/[-_\/](?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL|\d{2}(?:-\d{2})?|BLK|WHT|RED|BLU|GRN|PNK|GRY|BLACK|WHITE|PINK|BLUE|GREEN|GREY)$/i, '')
      .trim();
    return strippedSku.length >= 3 ? strippedSku : rawSku;
  }

  // Fallback to cleaned model name from title without color/size words
  const colorWordsRegex =
    /\b(чорний|чорна|чорне|білий|біла|біле|сірий|сіра|червоний|червона|синій|синя|зелений|зелена|рожевий|рожева|жовтий|жовта|коричневий|бежевий|фіолетовий|блакитний|темно-синій|різнокольоровий|black|white|grey|gray|red|blue|green|pink|yellow|brown|beige)\b/gi;

  const cleanedTitle = cleanProductTitleNoise(productTitle, brand, vendorCode)
    .replace(colorWordsRegex, ' ')
    .replace(/\b(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanedTitle
    .split(' ')
    .filter(Boolean)
    .slice(0, 5)
    .join(' ')
    .slice(0, 50)
    .trim();
}

/**
 * Builds the localStorage cache key in the format "[Бренд]_[Артикул/Модель]"
 */
export function buildSearchCacheKey(
  brand: string,
  vendorCode: string,
  productTitle: string
): string {
  const cleanBrand = (brand || '')
    .replace(/^інше$/i, '')
    .trim()
    .replace(/\s+/g, '_');
  const baseModelOrSku = extractBaseSeriesModelOrSku(vendorCode, productTitle, brand)
    .trim()
    .replace(/\s+/g, '_');

  const key = `${cleanBrand || 'Brand'}_${baseModelOrSku || 'Model'}`;
  return key.replace(/[^a-zA-Z0-9а-яіїєґА-ЯІЇЄҐ_\-.]/g, '');
}

interface CachedGroundingData {
  attributes: Record<string, string>;
  explanations: Record<string, string>;
  sources: { uri: string; title: string }[];
  timestamp: number;
}

function getCachedSearchResult(cacheKey: string): CachedGroundingData | null {
  if (typeof window === 'undefined' || !cacheKey) return null;
  try {
    // Check direct key "[Бренд]_[Артикул/Модель]" first, then master index
    const directRaw = localStorage.getItem(cacheKey);
    if (directRaw) {
      const parsed = JSON.parse(directRaw);
      if (parsed && typeof parsed.attributes === 'object' && Object.keys(parsed.attributes).length > 0) {
        return parsed as CachedGroundingData;
      }
    }
    const indexRaw = localStorage.getItem(SEARCH_CACHE_INDEX_KEY);
    if (indexRaw) {
      const indexObj = JSON.parse(indexRaw);
      if (indexObj && indexObj[cacheKey] && Object.keys(indexObj[cacheKey].attributes || {}).length > 0) {
        return indexObj[cacheKey] as CachedGroundingData;
      }
    }
  } catch {
    // Ignore localStorage read errors
  }
  return null;
}

function saveCachedSearchResult(cacheKey: string, data: CachedGroundingData): void {
  if (typeof window === 'undefined' || !cacheKey || !data.attributes || Object.keys(data.attributes).length === 0) {
    return;
  }
  try {
    // Merge with any existing cached attributes for this [Бренд]_[Артикул/Модель]
    const existing = getCachedSearchResult(cacheKey);
    const merged: CachedGroundingData = {
      attributes: { ...(existing?.attributes || {}), ...data.attributes },
      explanations: { ...(existing?.explanations || {}), ...data.explanations },
      sources: data.sources?.length ? data.sources : existing?.sources || [],
      timestamp: Date.now()
    };

    // Store directly under "[Бренд]_[Артикул/Модель]" as requested
    localStorage.setItem(cacheKey, JSON.stringify(merged));

    // Also keep bounded index for easy management
    const indexRaw = localStorage.getItem(SEARCH_CACHE_INDEX_KEY);
    const indexObj = indexRaw ? JSON.parse(indexRaw) : {};
    indexObj[cacheKey] = merged;
    localStorage.setItem(SEARCH_CACHE_INDEX_KEY, JSON.stringify(indexObj));
  } catch {
    // Ignore quota errors
  }
}

/**
 * Builds a focused, noise-free Google Search query using the formula:
 * "${brand} ${vendorCode || model} характеристики специфікація"
 */
export function buildConciseSearchQuery(
  brand: string,
  vendorCode: string,
  productTitle: string
): string {
  const cleanBrand = (brand || '').replace(/^інше$/i, '').trim();
  const cleanSku = (vendorCode || '').trim();
  const cleanedTitle = cleanProductTitleNoise(productTitle, cleanBrand, cleanSku);

  const modelSnippet = cleanedTitle
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(' ')
    .slice(0, 55)
    .trim();

  const codeOrModel =
    cleanSku && modelSnippet
      ? `${cleanSku} ${modelSnippet}`.slice(0, 65).trim()
      : cleanSku || modelSnippet;

  return `${cleanBrand} ${codeOrModel} характеристики специфікація`
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Helper to extract basic product identity fields from a row
 */
export function extractProductIdentity(productRow: Record<string, any>): {
  productTitle: string;
  brand: string;
  vendorCode: string;
  cacheKey: string;
  searchQuery: string;
} {
  const productTitle = String(
    productRow['Назва товару*\n[ua]'] ||
    productRow['Назва товару [ua]*'] ||
    productRow['Назва товару\n[ua]'] ||
    productRow['Назва товару'] ||
    productRow['Назва товару*\n[ru]'] ||
    productRow['Назва товару [ru]*'] ||
    productRow['Назва товару\n[ru]'] ||
    ''
  ).trim();

  const brand = String(
    productRow['Бренд*\n(select)'] ||
    productRow['Бренд (select)*'] ||
    productRow['Бренд'] ||
    ''
  ).trim();

  const vendorCode = String(
    productRow['Артикул*'] ||
    productRow['Артикул'] ||
    productRow['Код товару'] ||
    productRow['Модель'] ||
    ''
  ).trim();

  const cacheKey = buildSearchCacheKey(brand, vendorCode, productTitle);
  const searchQuery = buildConciseSearchQuery(brand, vendorCode, productTitle);

  return { productTitle, brand, vendorCode, cacheKey, searchQuery };
}

/**
 * Maps raw attribute key-value pairs against target columns and Epicentr dictionary allowed values.
 */
function mapAttributesToColumns(
  rawAttributes: Record<string, string>,
  targetCols: EpicentrColumn[],
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>
): Record<string, string> {
  const mapped: Record<string, string> = {};

  for (const [colName, rawVal] of Object.entries(rawAttributes)) {
    if (!rawVal || typeof rawVal !== 'string' || !rawVal.trim()) continue;
    const cleanVal = rawVal.trim();

    const matchedCol = targetCols.find(
      c =>
        c.cleanName.toLowerCase() === colName.toLowerCase() ||
        c.originalName === colName ||
        getCleanAttributeName(c.cleanName || c.originalName).toLowerCase() ===
          getCleanAttributeName(colName).toLowerCase()
    );

    if (matchedCol) {
      const origKey = matchedCol.originalName;
      const cleanKey = matchedCol.cleanName || getCleanAttributeName(origKey);
      const normKey = getCleanAttributeName(cleanKey).toLowerCase();

      const dict =
        dictionaryIndex[normKey] ||
        Object.values(dictionaryIndex).find(
          d => getCleanAttributeName(d.cleanAttributeName).toLowerCase() === normKey
        );

      if (dict && dict.allowedValues && dict.allowedValues.length > 0) {
        const allowed = dict.allowedValues;
        const allowedLower = allowed.map(a => a.toLowerCase().trim());

        if (matchedCol.type === 'multiselect' || matchedCol.type === 'array') {
          const items = cleanVal.split(/[,;]/).map(s => s.trim()).filter(Boolean);
          const validItems: string[] = [];
          for (const it of items) {
            const resolved = resolveTokenAgainstAllowed(it, allowed, allowedLower);
            if (resolved && !validItems.includes(resolved)) {
              validItems.push(resolved);
            }
          }
          if (validItems.length > 0) {
            const valStr = validItems.join('; ');
            mapped[origKey] = valStr;
            mapped[cleanKey] = valStr;
          }
        } else {
          const resolved = resolveTokenAgainstAllowed(cleanVal, allowed, allowedLower);
          if (resolved) {
            mapped[origKey] = resolved;
            mapped[cleanKey] = resolved;
          }
        }
      } else {
        const formattedVal =
          matchedCol.type === 'multiselect' || matchedCol.type === 'array'
            ? cleanVal.split(/[,;]/).map(s => s.trim()).filter(Boolean).join('; ')
            : cleanVal;
        mapped[origKey] = formattedVal;
        mapped[cleanKey] = formattedVal;
      }
    }
  }

  return mapped;
}

/**
 * Researches missing product characteristics using Google Search Grounding (gemini-3.8-flash).
 * Implements:
 * 1. Step 1 local heuristic pre-fill (skips network if all fields resolved locally).
 * 2. LocalStorage cache lookup by "[Бренд]_[Артикул/Модель]" (skips network if cached).
 * 3. Noise-free query "${brand} ${vendorCode || model} характеристики специфікація".
 * 4. Strict maxOutputTokens: 350, responseMimeType: "application/json", and official manufacturer catalog systemInstruction.
 */
export async function researchProductAttributesWithWebGrounding(
  productRow: Record<string, any>,
  columns: EpicentrColumn[],
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  targetColumnNames?: string[]
): Promise<GroundedResearchResult> {
  const result: GroundedResearchResult = {
    suggestedValues: {},
    explanations: {},
    sources: [],
    searchEntryPoint: null
  };

  // Identify empty columns to research
  const emptyCols = columns.filter(c => {
    if (targetColumnNames && targetColumnNames.length > 0) {
      const match =
        targetColumnNames.includes(c.originalName) ||
        targetColumnNames.includes(c.cleanName) ||
        targetColumnNames.includes(getCleanAttributeName(c.cleanName));
      if (!match) return false;
    }

    const cleanLower = (c.cleanName || c.originalName).toLowerCase().trim();
    const origLower = c.originalName.toLowerCase().trim();

    const isPhoto =
      cleanLower.includes('фото') ||
      origLower.includes('фото') ||
      cleanLower.includes('зображення') ||
      cleanLower.includes('photo') ||
      cleanLower.includes('image');
    if (isPhoto) return false;

    if (
      cleanLower === 'id' ||
      cleanLower === 'артикул' ||
      cleanLower.startsWith('назва товару') ||
      cleanLower.startsWith('опис') ||
      cleanLower === 'ціна'
    ) {
      return false;
    }

    const valOrig = productRow[c.originalName];
    const valClean = productRow[c.cleanName];
    const isEmptyOrig =
      valOrig === undefined || valOrig === null || String(valOrig).trim() === '' || String(valOrig).toLowerCase() === 'nan';
    const isEmptyClean =
      valClean === undefined || valClean === null || String(valClean).trim() === '' || String(valClean).toLowerCase() === 'nan';

    return isEmptyOrig && isEmptyClean;
  });

  if (emptyCols.length === 0) {
    return result;
  }

  // Step 1: Pre-check with local deterministic PIM heuristics before triggering network search
  const localExtracted = applyLocalPimExtraction(productRow, emptyCols, dictionaryIndex, {});
  for (const [colKey, val] of Object.entries(localExtracted)) {
    if (val && String(val).trim()) {
      result.suggestedValues[colKey] = val;
      if (result.explanations) {
        result.explanations[colKey] = 'Етап 1 (Локально): витягнуто з опису/назви товару та довідника';
      }
    }
  }

  // Filter columns that are still unresolved after Step 1 local heuristics
  let remainingEmptyCols = emptyCols.filter(c => {
    const origKey = c.originalName;
    const cleanKey = c.cleanName || getCleanAttributeName(origKey);
    return !result.suggestedValues[origKey] && !result.suggestedValues[cleanKey];
  });

  // If all fields were found locally — skip Google Search network request
  if (remainingEmptyCols.length === 0) {
    return result;
  }

  const { productTitle, brand, vendorCode, cacheKey, searchQuery } = extractProductIdentity(productRow);
  result.searchQuery = searchQuery;
  result.cacheKey = cacheKey;

  // Step 1.5: Check localStorage search cache by key "[Бренд]_[Артикул/Модель]"
  const cachedData = getCachedSearchResult(cacheKey);
  if (cachedData && cachedData.attributes) {
    const mappedFromCache = mapAttributesToColumns(cachedData.attributes, remainingEmptyCols, dictionaryIndex);
    if (Object.keys(mappedFromCache).length > 0) {
      result.suggestedValues = { ...result.suggestedValues, ...mappedFromCache };
      result.explanations = {
        ...(result.explanations || {}),
        ...(cachedData.explanations || {})
      };
      result.sources = cachedData.sources || [];
      result.fromCache = true;
    }

    remainingEmptyCols = remainingEmptyCols.filter(c => {
      const origKey = c.originalName;
      const cleanKey = c.cleanName || getCleanAttributeName(origKey);
      return !result.suggestedValues[origKey] && !result.suggestedValues[cleanKey];
    });

    // If all remaining fields were satisfied from localStorage cache, skip paid Google API call
    if (remainingEmptyCols.length === 0) {
      return result;
    }
  }

  const missingAttributesPayload = remainingEmptyCols.map(c => {
    const cleanCol = getCleanAttributeName(c.cleanName || c.originalName).toLowerCase();
    const dict =
      dictionaryIndex[cleanCol] ||
      Object.values(dictionaryIndex).find(
        d => getCleanAttributeName(d.cleanAttributeName).toLowerCase() === cleanCol
      );
    return {
      originalName: c.originalName,
      cleanName: c.cleanName,
      type: c.type,
      isRequired: c.isRequired,
      allowedValues:
        dict?.allowedValues && dict.allowedValues.length > 0 ? dict.allowedValues.slice(0, 80) : undefined
    };
  });

  try {
    const response = await fetch('/api/gemini/grounded-attribute-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchQuery,
        productTitle: cleanProductTitleNoise(productTitle, brand, vendorCode),
        brand,
        vendorCode,
        missingAttributes: missingAttributesPayload,
        systemInstruction: OFFICIAL_CATALOG_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        maxOutputTokens: 350
      })
    });

    if (response.ok) {
      const data = await response.json();
      result.sources = Array.isArray(data.sources) ? data.sources : result.sources;
      result.searchEntryPoint = data.searchEntryPoint || null;
      result.explanations = {
        ...(result.explanations || {}),
        ...(data.explanations || {})
      };

      if (data.attributes && typeof data.attributes === 'object') {
        const mappedFromWeb = mapAttributesToColumns(data.attributes, remainingEmptyCols, dictionaryIndex);
        result.suggestedValues = {
          ...result.suggestedValues,
          ...mappedFromWeb
        };

        // Save found characteristics to localStorage under "[Бренд]_[Артикул/Модель]"
        if (Object.keys(mappedFromWeb).length > 0) {
          saveCachedSearchResult(cacheKey, {
            attributes: mappedFromWeb,
            explanations: data.explanations || {},
            sources: result.sources || [],
            timestamp: Date.now()
          });
        }
      }
    } else {
      const errData = await response.json().catch(() => ({}));
      result.error = errData.error || 'Помилка виконання пошукового розшуку';
    }
  } catch (err: any) {
    console.warn('Failed to execute Google Search grounded attribute research:', err);
    result.error = err?.message || 'Помилка звернення до сервісу Google Search Grounding';
  }

  return result;
}

/**
 * AI-powered missing attributes enrichment (both mandatory '*' and optional fields) for a single product.
 * Step 1: Local heuristic & text AI extraction from description/title/dictionaries.
 * Step 2: Optional Google Search Grounding ONLY if fields remain unfilled after Step 1.
 */
export async function enrichProductMandatoryWithAI(
  productRow: Record<string, any>,
  columns: EpicentrColumn[],
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  options?: {
    useWebGrounding?: boolean;
    skipTextAiCall?: boolean;
  }
): Promise<{
  suggestedValues: Record<string, string>;
  explanations?: Record<string, string>;
  sources?: { uri: string; title: string }[];
  fromCache?: boolean;
  error?: string;
}> {
  // Find all empty attribute columns in the row (both mandatory '*' and optional fields; фото не є обов'язковим)
  const emptyCols = columns.filter(c => {
    const cleanLower = (c.cleanName || c.originalName).toLowerCase().trim();
    const origLower = c.originalName.toLowerCase().trim();

    const isPhoto =
      cleanLower.includes('фото') ||
      origLower.includes('фото') ||
      cleanLower.includes('зображення') ||
      cleanLower.includes('photo') ||
      cleanLower.includes('image');
    if (isPhoto) return false;

    if (
      cleanLower === 'id' ||
      cleanLower === 'артикул' ||
      cleanLower.startsWith('назва товару') ||
      cleanLower.startsWith('опис') ||
      cleanLower === 'ціна'
    ) {
      return false;
    }

    const valOrig = productRow[c.originalName];
    const valClean = productRow[c.cleanName];

    const isEmptyOrig = valOrig === undefined || valOrig === null || String(valOrig).trim() === '' || String(valOrig).toLowerCase() === 'nan';
    const isEmptyClean = valClean === undefined || valClean === null || String(valClean).trim() === '' || String(valClean).toLowerCase() === 'nan';

    return isEmptyOrig && isEmptyClean;
  });

  if (emptyCols.length === 0) {
    return { suggestedValues: {} };
  }

  // Step 1: Run local heuristic extraction first to see what can be resolved without network calls
  let finalSuggested = applyLocalPimExtraction(productRow, emptyCols, dictionaryIndex, {});

  const colsForAi = emptyCols.filter(c => {
    const origKey = c.originalName;
    const cleanKey = c.cleanName || getCleanAttributeName(origKey);
    return !finalSuggested[origKey] && !finalSuggested[cleanKey];
  });

  // If all empty columns were resolved by local heuristics, skip network AI & Web Grounding completely
  if (colsForAi.length === 0) {
    return { suggestedValues: finalSuggested };
  }

  if (!options?.skipTextAiCall) {
    const dictContext: Record<string, { type: string; allowedValues: string[] }> = {};

    for (const col of colsForAi) {
      const rawColName = col.cleanName || col.originalName;
      const cleanCol = getCleanAttributeName(rawColName).toLowerCase();

      const dict =
        dictionaryIndex[cleanCol] ||
        Object.values(dictionaryIndex).find(
          d => getCleanAttributeName(d.cleanAttributeName).toLowerCase() === cleanCol
        );

      if (dict && dict.allowedValues && dict.allowedValues.length > 0) {
        const contextData = {
          type: col.type === 'multiselect' ? 'multiselect' : 'select',
          allowedValues: dict.allowedValues.slice(0, 120)
        };
        dictContext[col.originalName] = contextData;
        dictContext[col.cleanName] = contextData;
        dictContext[cleanCol] = contextData;
      }
    }

    try {
      const prompt = `Ти — експертний AI-агент з інтелектуального мапінгу товарів для маркетплейсу "Епіцентр".
Твоє завдання: проаналізувати дані товару (назву, артикул, опис) та заповнити порожні характеристики, якщо інформація про них наявна або випливає з контексту назви чи опису.

ПРАВИЛА ПІДБОРУ ХАРАКТЕРИСТИК:
1. АНАЛІЗ ТЕКСТУ КРІЗЬ HTML-РОЗМІТКУ ТА КОНТЕКСТ:
   - Уважно аналізуй назву та опис товару для виявлення явних і контекстних характеристик.
2. ГНУЧКЕ РОЗПІЗНАВАННЯ СИНОНІМІВ ТА СКОРОЧЕНЬ:
   - Активно зіставляй розмовні назви та синоніми зі значеннями з довідника (allowedValues).
3. ФОРМАТ ЗНАЧЕНЬ:
   - Для полів "select" та "multiselect" обирай відповідні опції з наданого довідника (allowedValues).
   - Для полів "multiselect" перераховуй значення через крапку з комою (; ).
   - Залишай поле порожнім ("") лише якщо в назві й описі немає жодної підказки.

Порожні колонки товару для заповнення:
${colsForAi
  .map(c => {
    const clean = getCleanAttributeName(c.cleanName || c.originalName);
    const hasDict = !!dictContext[c.originalName] || !!dictContext[clean.toLowerCase()];
    return `- "${c.originalName}" (${c.type}, ${c.isRequired ? 'обовʼязкове *' : 'додаткове'}${c.lang ? `, мова: ${c.lang}` : ''})${
      hasDict ? ' [Є ДОВІДНИК ЗНАЧЕНЬ]' : ''
    }`;
  })
  .join('\n')}

Довідник дозволених опцій:
${JSON.stringify(dictContext, null, 2)}

Поточні дані товару:
${JSON.stringify(productRow, null, 2)}

Поверни результат строго у форматі JSON:
{
  "suggestedValues": {
    "Точна назва колонки": "Значення з довідника або порожній рядок"
  }
}`;

      const response = await fetch('/api/gemini/enrich-attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.1-flash-lite',
          prompt,
          systemInstruction: EPICENTR_SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          maxOutputTokens: 350
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.text;
        if (text && typeof text === 'string') {
          let rawSuggested: Record<string, string> = {};
          const cleanedText = text
            .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
            .replace(/\s*```[\s\S]*$/, '')
            .trim();
          try {
            const parsed = JSON.parse(cleanedText);
            if (parsed && typeof parsed.suggestedValues === 'object') {
              rawSuggested = parsed.suggestedValues as Record<string, string>;
            }
          } catch {
            const pairRegex = /"((?:[^"\\]|\\.)+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
            let m: RegExpExecArray | null;
            while ((m = pairRegex.exec(cleanedText)) !== null) {
              const k = m[1].replace(/\\"/g, '"').trim();
              const v = m[2].replace(/\\"/g, '"').trim();
              if (k && k !== 'suggestedValues') {
                rawSuggested[k] = v;
              }
            }
          }

          if (Object.keys(rawSuggested).length > 0) {
            const mappedAi = mapAttributesToColumns(rawSuggested, colsForAi, dictionaryIndex);
            finalSuggested = { ...finalSuggested, ...mappedAi };
          }
        }
      }
    } catch (err) {
      console.warn('Gemini AI call failed, using local PIM heuristic extraction:', err);
    }
  }

  let explanations: Record<string, string> = {};
  let sources: { uri: string; title: string }[] = [];
  let fromCache = false;

  // Step 2: Before calling Google Search Grounding, check if any fields are still unfilled after Step 1
  if (options?.useWebGrounding) {
    const stillEmptyCols = emptyCols.filter(c => {
      const origKey = c.originalName;
      const cleanKey = c.cleanName || getCleanAttributeName(origKey);
      return !finalSuggested[origKey] && !finalSuggested[cleanKey];
    });

    // Only invoke Google Search Grounding if there are still unfilled columns
    if (stillEmptyCols.length > 0) {
      try {
        const webRes = await researchProductAttributesWithWebGrounding(
          productRow,
          stillEmptyCols,
          dictionaryIndex
        );

        if (webRes.suggestedValues && Object.keys(webRes.suggestedValues).length > 0) {
          finalSuggested = { ...finalSuggested, ...webRes.suggestedValues };
        }
        if (webRes.explanations) {
          explanations = webRes.explanations;
        }
        if (webRes.sources && webRes.sources.length > 0) {
          sources = webRes.sources;
        }
        if (webRes.fromCache) {
          fromCache = true;
        }
      } catch (webErr) {
        console.warn('Web Grounding research error during enrichProductMandatoryWithAI:', webErr);
      }
    }
  }

  return {
    suggestedValues: finalSuggested,
    explanations: Object.keys(explanations).length > 0 ? explanations : undefined,
    sources: sources.length > 0 ? sources : undefined,
    fromCache
  };
}

/**
 * 2-Step Cascading + Variant-Grouped + Cached + Parallel Batch Processor (3-4 groups concurrently via Promise.all):
 *
 * Step 1: Runs fast local AI/heuristic filling from description, title & dictionaries on all items.
 *         Items with all fields resolved in Step 1 skip Google Search Grounding completely.
 * Step 2: Groups remaining unfilled items by variant series key "[Бренд]_[Артикул/Модель]" (same model/series,
 *         different sizes or colors), checks localStorage cache, and executes parallel batches of 3-4 groups
 *         via Promise.all(), propagating shared attributes across all variant items in each group.
 */
export async function enrichProductsBatchWithAI<T extends { idx: number; updatedRow: Record<string, any> }>(
  items: T[],
  columns: EpicentrColumn[],
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  options?: {
    useWebGrounding?: boolean;
    batchSize?: number;
    onStageUpdate?: (message: string) => void;
    onItemEnriched?: (
      item: T,
      result: {
        suggestedValues: Record<string, string>;
        explanations?: Record<string, string>;
        sources?: { uri: string; title: string }[];
        fromCache?: boolean;
      }
    ) => void;
  }
): Promise<{
  totalProcessed: number;
  resolvedLocallyCount: number;
  resolvedFromCacheCount: number;
  variantGroupsSearchedCount: number;
}> {
  const batchSize = options?.batchSize || 4;
  let resolvedLocallyCount = 0;
  let resolvedFromCacheCount = 0;
  let variantGroupsSearchedCount = 0;

  // Identify fillable characteristic columns
  const isFillableCol = (c: EpicentrColumn) => {
    const cleanLower = (c.cleanName || c.originalName).toLowerCase().trim();
    const origLower = c.originalName.toLowerCase().trim();
    if (
      cleanLower.includes('фото') ||
      origLower.includes('фото') ||
      cleanLower.includes('зображення') ||
      cleanLower.includes('photo') ||
      cleanLower.includes('image') ||
      cleanLower === 'id' ||
      cleanLower === 'артикул' ||
      cleanLower.startsWith('назва товару') ||
      cleanLower.startsWith('опис') ||
      cleanLower === 'ціна'
    ) {
      return false;
    }
    return true;
  };

  const fillableCols = columns.filter(isFillableCol);

  // ============================================================================
  // STEP 1: Fast Local Pre-filling from Description, Title & Dictionaries
  // ============================================================================
  if (options?.onStageUpdate) {
    options.onStageUpdate(`Етап 1/2: Локальне AI-дозаповнення з описів та довідників (${items.length} тов.)...`);
  }

  const itemsNeedingStep2: Array<{
    item: T;
    workingRow: Record<string, any>;
    remainingCols: EpicentrColumn[];
    cacheKey: string;
  }> = [];

  for (const item of items) {
    const emptyColsForItem = fillableCols.filter(c => {
      const vOrig = item.updatedRow[c.originalName];
      const vClean = item.updatedRow[c.cleanName];
      const emptyOrig = vOrig === undefined || vOrig === null || String(vOrig).trim() === '' || String(vOrig).toLowerCase() === 'nan';
      const emptyClean = vClean === undefined || vClean === null || String(vClean).trim() === '' || String(vClean).toLowerCase() === 'nan';
      return emptyOrig && emptyClean;
    });

    if (emptyColsForItem.length === 0) {
      resolvedLocallyCount++;
      continue;
    }

    const localValues = applyLocalPimExtraction(item.updatedRow, emptyColsForItem, dictionaryIndex, {});
    if (Object.keys(localValues).length > 0 && options?.onItemEnriched) {
      options.onItemEnriched(item, {
        suggestedValues: localValues,
        explanations: Object.fromEntries(
          Object.keys(localValues).map(k => [k, 'Етап 1: Заповнено локально з опису/назви та довідника'])
        )
      });
    }

    const workingRow = { ...item.updatedRow, ...localValues };
    const remainingCols = emptyColsForItem.filter(c => {
      const origKey = c.originalName;
      const cleanKey = c.cleanName || getCleanAttributeName(origKey);
      return !localValues[origKey] && !localValues[cleanKey];
    });

    // If all fields were filled in Step 1 -> skip network call completely!
    if (remainingCols.length === 0) {
      resolvedLocallyCount++;
      continue;
    }

    const { cacheKey } = extractProductIdentity(workingRow);
    itemsNeedingStep2.push({
      item,
      workingRow,
      remainingCols,
      cacheKey
    });
  }

  // If all items were completely filled in Step 1, do not make any network requests!
  if (itemsNeedingStep2.length === 0) {
    return {
      totalProcessed: items.length,
      resolvedLocallyCount,
      resolvedFromCacheCount: 0,
      variantGroupsSearchedCount: 0
    };
  }

  // If Web Grounding is NOT enabled, run parallel batches of standard AI text enrichment on remaining items
  if (!options?.useWebGrounding) {
    for (let i = 0; i < itemsNeedingStep2.length; i += batchSize) {
      const batch = itemsNeedingStep2.slice(i, i + batchSize);
      if (options?.onStageUpdate) {
        options.onStageUpdate(
          `Етап 2/2: Gemini AI обробка пакета ${i + 1}–${Math.min(i + batchSize, itemsNeedingStep2.length)} з ${itemsNeedingStep2.length}...`
        );
      }
      const batchRes = await Promise.all(
        batch.map(async entry => {
          const res = await enrichProductMandatoryWithAI(entry.workingRow, entry.remainingCols, dictionaryIndex, {
            useWebGrounding: false
          });
          return { entry, res };
        })
      );
      for (const { entry, res } of batchRes) {
        if (options?.onItemEnriched && Object.keys(res.suggestedValues).length > 0) {
          options.onItemEnriched(entry.item, res);
        }
      }
    }

    return {
      totalProcessed: items.length,
      resolvedLocallyCount,
      resolvedFromCacheCount: 0,
      variantGroupsSearchedCount: 0
    };
  }

  // ============================================================================
  // STEP 2: Group Variants/Modifications by "[Бренд]_[Артикул/Модель]" & Parallel Google Search
  // ============================================================================
  const variantGroupsMap = new Map<
    string,
    Array<{
      item: T;
      workingRow: Record<string, any>;
      remainingCols: EpicentrColumn[];
      cacheKey: string;
    }>
  >();

  for (const entry of itemsNeedingStep2) {
    const existingGroup = variantGroupsMap.get(entry.cacheKey) || [];
    existingGroup.push(entry);
    variantGroupsMap.set(entry.cacheKey, existingGroup);
  }

  const variantGroups = Array.from(variantGroupsMap.entries()).map(([groupKey, members]) => {
    // Union of all missing columns across all variant rows in this group
    const colMap = new Map<string, EpicentrColumn>();
    for (const m of members) {
      for (const col of m.remainingCols) {
        colMap.set(col.originalName, col);
      }
    }
    return {
      groupKey,
      members,
      representativeRow: members[0].workingRow,
      unionMissingCols: Array.from(colMap.values())
    };
  });

  // Process variant groups in parallel batches of 3-4 concurrently using Promise.all
  for (let i = 0; i < variantGroups.length; i += batchSize) {
    const groupBatch = variantGroups.slice(i, i + batchSize);
    const startGroup = i + 1;
    const endGroup = Math.min(i + batchSize, variantGroups.length);

    if (options?.onStageUpdate) {
      options.onStageUpdate(
        `Етап 2/2: Google Search (пакет груп ${startGroup}–${endGroup} з ${variantGroups.length}, залишилось ${itemsNeedingStep2.length} тов.)...`
      );
    }

    const batchGroupResults = await Promise.all(
      groupBatch.map(async group => {
        const res = await researchProductAttributesWithWebGrounding(
          group.representativeRow,
          group.unionMissingCols,
          dictionaryIndex
        );
        return { group, res };
      })
    );

    // Propagate shared discovered attributes to ALL variant items in each group
    for (const { group, res } of batchGroupResults) {
      if (res.fromCache) {
        resolvedFromCacheCount += group.members.length;
      } else {
        variantGroupsSearchedCount++;
      }

      for (const member of group.members) {
        // Filter suggestedValues so we only apply columns that were actually empty on this variant member
        const memberSuggested: Record<string, string> = {};
        for (const col of member.remainingCols) {
          const origKey = col.originalName;
          const cleanKey = col.cleanName || getCleanAttributeName(origKey);
          const val = res.suggestedValues[origKey] || res.suggestedValues[cleanKey];
          if (val && String(val).trim() !== '') {
            memberSuggested[origKey] = val;
          }
        }

        if (options?.onItemEnriched && (Object.keys(memberSuggested).length > 0 || (res.sources && res.sources.length > 0))) {
          options.onItemEnriched(member.item, {
            suggestedValues: memberSuggested,
            explanations: res.explanations,
            sources: res.sources,
            fromCache: res.fromCache
          });
        }
      }
    }
  }

  return {
    totalProcessed: items.length,
    resolvedLocallyCount,
    resolvedFromCacheCount,
    variantGroupsSearchedCount
  };
}