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
  error?: string;
}

/**
 * Builds a concise Google Search query in the format "<Бренд> <Артикул> <Коротка назва>"
 * to accelerate Google Search Grounding responses.
 */
export function buildConciseSearchQuery(
  brand: string,
  vendorCode: string,
  productTitle: string
): string {
  const cleanBrand = (brand || '').replace(/^інше$/i, '').trim();
  const cleanSku = (vendorCode || '').trim();

  // Strip SKU in brackets and keep only the first 5-6 core words (max 55 chars)
  let shortTitle = (productTitle || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanBrand) {
    const escapedBrand = cleanBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    shortTitle = shortTitle.replace(new RegExp(`\\b${escapedBrand}\\b`, 'gi'), ' ').trim();
  }
  if (cleanSku) {
    const escapedSku = cleanSku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    shortTitle = shortTitle.replace(new RegExp(`\\b${escapedSku}\\b`, 'gi'), ' ').trim();
  }

  shortTitle = shortTitle
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(' ')
    .slice(0, 55)
    .trim();

  return [cleanBrand, cleanSku, shortTitle]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Researches missing product characteristics using Google Search Grounding (gemini-3.8-flash).
 * First checks if missing fields can be extracted via local heuristics; if all fields are found locally,
 * skips the network search completely.
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
        result.explanations[colKey] = 'Знайдено локальною евристикою з опису/назви товару';
      }
    }
  }

  // Filter columns that are still unresolved after local heuristics
  const remainingEmptyCols = emptyCols.filter(c => {
    const origKey = c.originalName;
    const cleanKey = c.cleanName || getCleanAttributeName(origKey);
    return !result.suggestedValues[origKey] && !result.suggestedValues[cleanKey];
  });

  // If all fields were found locally — skip Google Search network request
  if (remainingEmptyCols.length === 0) {
    return result;
  }

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

  // Shortened search query: "<Бренд> <Артикул> <Коротка назва>"
  const searchQuery = buildConciseSearchQuery(brand, vendorCode, productTitle);
  result.searchQuery = searchQuery;

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
        productTitle,
        brand,
        vendorCode,
        missingAttributes: missingAttributesPayload,
        maxOutputTokens: 350
      })
    });

    if (response.ok) {
      const data = await response.json();
      result.sources = Array.isArray(data.sources) ? data.sources : [];
      result.searchEntryPoint = data.searchEntryPoint || null;
      result.explanations = {
        ...(result.explanations || {}),
        ...(data.explanations || {})
      };

      if (data.attributes && typeof data.attributes === 'object') {
        for (const [colName, rawVal] of Object.entries(data.attributes)) {
          if (!rawVal || typeof rawVal !== 'string' || !rawVal.trim()) continue;
          const cleanVal = rawVal.trim();

          const matchedCol = remainingEmptyCols.find(
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
                  result.suggestedValues[origKey] = valStr;
                  result.suggestedValues[cleanKey] = valStr;
                }
              } else {
                const resolved = resolveTokenAgainstAllowed(cleanVal, allowed, allowedLower);
                if (resolved) {
                  result.suggestedValues[origKey] = resolved;
                  result.suggestedValues[cleanKey] = resolved;
                }
              }
            } else {
              const formattedVal =
                matchedCol.type === 'multiselect' || matchedCol.type === 'array'
                  ? cleanVal.split(/[,;]/).map(s => s.trim()).filter(Boolean).join('; ')
                  : cleanVal;
              result.suggestedValues[origKey] = formattedVal;
              result.suggestedValues[cleanKey] = formattedVal;
            }
          }
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
 * Pre-checks local heuristics first; only calls AI and Google Search Grounding for remaining unfilled fields.
 */
export async function enrichProductMandatoryWithAI(
  productRow: Record<string, any>,
  columns: EpicentrColumn[],
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  options?: {
    useWebGrounding?: boolean;
  }
): Promise<{
  suggestedValues: Record<string, string>;
  explanations?: Record<string, string>;
  sources?: { uri: string; title: string }[];
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
   - Активно зіставляй розмовні назви та синоніми зі значеннями з довідника (allowedValues):
     * 'котон', 'коттон', 'cotton' -> 'бавовна'
     * 'стрейч', 'stretch' -> 'стретч' (або 'еластан')
     * 'джеггінси', 'джегінси' -> 'jeggings fit'
     * 'демі-літо', 'демі', 'осінь-весна' -> 'демісезон'
     * розміри '25, 26' -> '25; 26'
     * 'екошкіра', 'шкіра PU' -> 'штучна шкіра'
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
          // Salvage complete "key": "value" pairs if truncated at maxOutputTokens: 350
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
          for (const [colName, rawVal] of Object.entries(rawSuggested)) {
            if (!rawVal || typeof rawVal !== 'string' || !rawVal.trim()) continue;
            const cleanVal = rawVal.trim();

            const matchedCol = colsForAi.find(
              c =>
                c.cleanName.toLowerCase() === colName.toLowerCase() ||
                c.originalName === colName ||
                getCleanAttributeName(c.cleanName || c.originalName).toLowerCase() ===
                  getCleanAttributeName(colName).toLowerCase()
            );

            if (matchedCol) {
              const origKey = matchedCol.originalName;
              const cleanKey = matchedCol.cleanName || getCleanAttributeName(origKey);
              const colDict = dictContext[origKey] || dictContext[cleanKey] || dictContext[cleanKey.toLowerCase()];

              if (colDict && colDict.allowedValues && colDict.allowedValues.length > 0) {
                const allowed = colDict.allowedValues;
                const allowedLower = allowed.map(a => a.toLowerCase().trim());

                if (colDict.type === 'multiselect' || matchedCol.type === 'multiselect') {
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
                    finalSuggested[origKey] = valStr;
                    finalSuggested[cleanKey] = valStr;
                  }
                } else {
                  const resolved = resolveTokenAgainstAllowed(cleanVal, allowed, allowedLower);
                  if (resolved) {
                    finalSuggested[origKey] = resolved;
                    finalSuggested[cleanKey] = resolved;
                  }
                }
              } else {
                const formattedVal =
                  matchedCol.type === 'multiselect' || matchedCol.type === 'array'
                    ? cleanVal.split(/[,;]/).map(s => s.trim()).filter(Boolean).join('; ')
                    : cleanVal;
                finalSuggested[origKey] = formattedVal;
                finalSuggested[cleanKey] = formattedVal;
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Gemini AI call failed, using local PIM heuristic extraction:', err);
  }

  let explanations: Record<string, string> = {};
  let sources: { uri: string; title: string }[] = [];

  // Step 2: Before calling Google Search Grounding, check if any fields are still unfilled after local heuristics + AI
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
      } catch (webErr) {
        console.warn('Web Grounding research error during enrichProductMandatoryWithAI:', webErr);
      }
    }
  }

  return {
    suggestedValues: finalSuggested,
    explanations: Object.keys(explanations).length > 0 ? explanations : undefined,
    sources: sources.length > 0 ? sources : undefined
  };
}

/**
 * Parallel batch processor for AI attribute enrichment (processes 3-4 products concurrently via Promise.all).
 */
export async function enrichProductsBatchWithAI<T extends { updatedRow: Record<string, any> }>(
  items: T[],
  columns: EpicentrColumn[],
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  options?: {
    useWebGrounding?: boolean;
    batchSize?: number;
    onBatchProgress?: (processedCount: number, totalCount: number, batchResults: Array<{ item: T; result: Awaited<ReturnType<typeof enrichProductMandatoryWithAI>> }>) => void;
  }
): Promise<Array<{ item: T; result: Awaited<ReturnType<typeof enrichProductMandatoryWithAI>> }>> {
  const batchSize = options?.batchSize || 4;
  const allResults: Array<{ item: T; result: Awaited<ReturnType<typeof enrichProductMandatoryWithAI>> }> = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(
      chunk.map(async (item) => {
        const result = await enrichProductMandatoryWithAI(
          item.updatedRow,
          columns,
          dictionaryIndex,
          { useWebGrounding: options?.useWebGrounding }
        );
        return { item, result };
      })
    );
    allResults.push(...chunkResults);
    if (options?.onBatchProgress) {
      options.onBatchProgress(allResults.length, items.length, chunkResults);
    }
  }

  return allResults;
}