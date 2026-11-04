/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EpicentrColumn, EpicentrDictionaryAttribute } from '../types/epicentr';
import { EPICENTR_SYSTEM_PROMPT } from '../constants/epicentrPrompt';
import {
  areAllMandatoryCharacteristicsFilled,
  decodeHtmlEntities,
  encodeHtmlEntities,
  enforceDictionaryValue,
  extractAgeFromText,
  extractDeterministicMandatoryPimAttribute,
  extractDimensionsFromText,
  extractPlayersFromText,
  extractProductSeriesKey,
  extractVolumeMlFromText,
  extractWeightGramsFromText,
  findDictionaryAttr,
  formatEpicentrTitle,
  isAiDisclaimerOrServiceText,
  isInternalHexOrHashId,
  isMandatoryCharacteristicColumn,
  matchDictionaryValue,
  matchSingleOptionAgainstAllowed,
  normalizeApostrophes,
  normalizeAttributeKey,
  normalizeEpicentrHeaderName,
  normalizeForDictionaryComparison,
  resolveMandatoryFallback,
  sanitizeValueAgainstDictionary,
  stripHtmlToCleanText,
  stripServiceAffixes,
  universalStemWord
} from './epicentrEngine';
import { callGeminiDirect } from './geminiClientDirect';
import { getStoredApiKey } from './aiApiKeyService';

export const MISSING_API_KEY_EVENT = 'epic_ai_missing_key_warning';

export const UNIVERSAL_PIM_SYSTEM_PROMPT = `Ти — універсальний PIM-агент маркетплейсу Епіцентр. Обирай значення СУВОРО з наданого масиву allowedValues (з колонки "Назва опції" довідника). Якщо значення відсутнє в allowedValues або інформації немає — повертай порожній рядок ("").
ПРАВИЛА ВАЛІДАЦІЇ:
1. Заборонено повертати внутрішні хеш-коди та ідентифікатори (наприклад: "5b78c0e9...", "cfd9340c...", "a8xqzwivcojproo").
2. Заборонено писати будь-які пояснення, вибачення чи мета-текст (наприклад: "відсутнє в довіднику", "немає у відкритому доступі", "Джерело:", "постановою кабінету міністрів", "allowedValues"). Якщо значення немає в allowedValues або воно невідоме — повертай виключно порожній рядок ("").
3. Для полів типу multiselect розділяй обрані значення через крапку з комою з пробілом ("; "). Кожен окремий елемент повинен бути присутнім в allowedValues.
4. Будь-яке вигадане або недопустиме значення поза довідником суворо заборонено.`;

/**
 * Normalizes column/attribute name by removing Epicentr technical suffixes
 * (e.g. "* (multiselect)", "\n[ua]", "(float) (мм)")
 */
export function getCleanAttributeName(rawName: string): string {
  if (!rawName) return '';
  return normalizeEpicentrHeaderName(rawName)
    .replace(/_x000[dD]_/gi, ' ')
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
 * Universal Category-Agnostic Local PIM Extractor:
 * Extracts and validates attributes for ANY product category strictly enforcing `allowedValues`
 * for `select` and `multiselect` columns.
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

  const fullText = normalizeForDictionaryComparison(
    `${titleUa} \n ${titleRu} \n ${descUa} \n ${descRu} \n ${extraText}`,
    'exact'
  );
  const parsedDimensions = extractDimensionsFromText(fullText);
  const parsedWeightGrams = extractWeightGramsFromText(fullText);
  const parsedVolumeMl = extractVolumeMlFromText(fullText);
  const parsedAge = extractAgeFromText(fullText);
  const parsedPlayers = extractPlayersFromText(fullText);

  for (const col of emptyCols) {
    const origKey = col.originalName;
    const cleanKey = col.cleanName || getCleanAttributeName(origKey);
    const normKey = getCleanAttributeName(cleanKey).toLowerCase();
    const normHeader = normalizeEpicentrHeaderName(origKey);

    // CRITICAL: NEVER overwrite or touch any cell that already has data in productRow
    const valOrig = productRow[origKey];
    const valClean = productRow[cleanKey];
    const valNorm = productRow[normHeader];
    const hasData =
      (valOrig !== undefined && valOrig !== null && String(valOrig).trim() !== '' && String(valOrig).toLowerCase() !== 'nan') ||
      (valClean !== undefined && valClean !== null && String(valClean).trim() !== '' && String(valClean).toLowerCase() !== 'nan') ||
      (valNorm !== undefined && valNorm !== null && String(valNorm).trim() !== '' && String(valNorm).toLowerCase() !== 'nan');
    if (hasData) {
      continue;
    }

    if (result[origKey] || result[cleanKey]) continue;

    const dict = findDictionaryAttr(dictionaryIndex, cleanKey);
    const hasDict = Boolean(dict && Array.isArray(dict.allowedValues) && dict.allowedValues.length > 0);
    let candidateVal: string | null = null;

    // 1. Dictionary-backed columns (ANY category, ANY select / multiselect / dictionary column)
    if (hasDict && dict) {
      const isBrandCol = normKey.includes('бренд') || normKey.includes('brand') || normKey === 'виробник';

      // 0. High-priority deterministic extraction for 'Вид*', 'Стать*', 'Склад набору*', 'Бренд*', 'Призначення*'
      const detVal = extractDeterministicMandatoryPimAttribute(
        origKey,
        col.type,
        dict.allowedValues,
        fullText,
        titleUa,
        titleRu
      );
      if (detVal) {
        candidateVal = detVal;
      }

      const sortedAllowed = [...dict.allowedValues].sort((a, b) => b.length - a.length);
      const matchedItems: string[] = candidateVal ? [candidateVal] : [];

      for (const allowedVal of sortedAllowed) {
        if (isBrandCol && normalizeForDictionaryComparison(allowedVal, 'exact') === 'інше') {
          continue;
        }
        const optNorm = normalizeForDictionaryComparison(allowedVal, 'exact');
        if (!optNorm) continue;

        if (optNorm.length <= 2) {
          const escaped = optNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const reg = new RegExp(`(?<![0-9а-яіїєґёъыэa-z])${escaped}(?![0-9а-яіїєґёъыэa-z])`, 'i');
          if (reg.test(fullText) && !matchedItems.includes(allowedVal)) {
            matchedItems.push(allowedVal);
          }
        } else {
          const stem = optNorm.replace(/(ий|ій|а|я|е|є|і|ї|ої|их|ім|им|ою|ому)$/i, '');
          if (
            fullText.includes(optNorm) ||
            (stem.length >= 4 && fullText.includes(stem))
          ) {
            if (!matchedItems.includes(allowedVal)) {
              matchedItems.push(allowedVal);
            }
          }
        }

        if (col.type !== 'multiselect' && matchedItems.length > 0) {
          break;
        }
      }

      // Check universal synonyms against dictionary
      if (col.type === 'multiselect' || matchedItems.length === 0) {
        for (const [synKey, synTarget] of Object.entries(AI_SYNONYM_MAP)) {
          if (fullText.includes(normalizeForDictionaryComparison(synKey, 'exact'))) {
            const matchedSyn = matchDictionaryValue(dict, synTarget);
            if (matchedSyn && !matchedItems.includes(matchedSyn)) {
              matchedItems.push(matchedSyn);
              if (col.type !== 'multiselect') break;
            }
          }
        }
      }

      // Context-based candidates verified strictly against dict.allowedValues
      if (matchedItems.length === 0) {
        const candidates: string[] = [];

        if (normKey.includes('одиниця виміру')) {
          if (fullText.includes('комплект') || fullText.includes('набір')) candidates.push('компл.');
          else if (fullText.includes('упаковк') || fullText.includes('пачк')) candidates.push('уп.');
          candidates.push('шт.');
        }

        if ((normKey === 'вік' || normKey.includes('вік дитини') || normKey.includes('рекомендований вік')) && parsedAge.minAge !== undefined) {
          candidates.push(
            `від ${parsedAge.minAge} років`,
            `від ${parsedAge.minAge} року`,
            `${parsedAge.minAge} років`,
            `${parsedAge.minAge}+`
          );
        }

        if (normKey.includes('гравців') && parsedPlayers.formatted) {
          candidates.push(parsedPlayers.formatted);
        }

        if (normKey === 'стать' || normKey.includes('стать дитини')) {
          const hasGirl = /дівчат|дівчин|девоч/i.test(fullText);
          const hasBoy = /хлопч|хлопц|мальчик/i.test(fullText);
          const hasWomen = /жіноч|для жінок|женск/i.test(fullText);
          const hasMen = /чоловіч|для чоловіків|мужск/i.test(fullText);
          if (hasGirl && !hasBoy) candidates.push('для дівчаток', 'жіноча');
          else if (hasBoy && !hasGirl) candidates.push('для хлопчиків', 'чоловіча');
          else if (hasWomen && !hasMen) candidates.push('для жінок', 'жіноча');
          else if (hasMen && !hasWomen) candidates.push('для чоловіків', 'чоловіча');
          else candidates.push('для хлопчиків; для дівчаток', 'унісекс');
        }

        for (const cand of candidates) {
          const validCand = enforceDictionaryValue(cand, col.type, dict);
          if (validCand) {
            matchedItems.push(validCand);
            break;
          }
        }
      }

      if (matchedItems.length > 0) {
        candidateVal = col.type === 'multiselect' ? matchedItems.join('; ') : matchedItems[0];
      }

      // Mandatory fallback: If still empty and column is mandatory (*), pull category-aware default from allowedValues
      if (!candidateVal && (col.isRequired || origKey.includes('*'))) {
        const fallback = resolveMandatoryFallback(origKey, col.type, dict.allowedValues, fullText);
        if (fallback) {
          candidateVal = fallback;
        }
      }
    }

    // 2. Non-dictionary numeric & structural extractors (ONLY when column does NOT have fixed select/multiselect dictionary)
    if (!candidateVal && !hasDict && col.type !== 'select' && col.type !== 'multiselect') {
      if (
        normKey.includes('висота') ||
        normKey.includes('ширина') ||
        normKey.includes('глибина') ||
        normKey.includes('довжина')
      ) {
        const isCm = col.unit === 'см' || origKey.toLowerCase().includes('(см)');
        const toStr = (mm?: number) =>
          mm && mm > 0 ? String(isCm ? Number((mm / 10).toFixed(1)) : Math.round(mm)) : '';
        if (normKey.includes('висота')) candidateVal = toStr(parsedDimensions.heightMm);
        else if (normKey.includes('ширина')) candidateVal = toStr(parsedDimensions.widthMm);
        else if (normKey.includes('глибина')) candidateVal = toStr(parsedDimensions.depthMm);
        else if (normKey.includes('довжина')) candidateVal = toStr(parsedDimensions.lengthMm || parsedDimensions.heightMm);
      } else if (normKey.includes('вага') || normKey.includes('маса')) {
        if (parsedWeightGrams && parsedWeightGrams > 0) {
          const isKg = col.unit === 'кг' || origKey.toLowerCase().includes('(кг)');
          candidateVal = isKg
            ? String(Number((parsedWeightGrams / 1000).toFixed(3)))
            : String(Math.round(parsedWeightGrams));
        }
      } else if (
        normKey.includes("об'єм") ||
        normKey.includes("объем") ||
        normKey.includes("об ем") ||
        normKey.includes("volume")
      ) {
        if (parsedVolumeMl && parsedVolumeMl > 0) {
          const isL = col.unit === 'л' || origKey.toLowerCase().includes('(л)');
          candidateVal = isL
            ? String(Number((parsedVolumeMl / 1000).toFixed(2)))
            : String(Math.round(parsedVolumeMl));
        }
      }
    }

    // 3. Enforce strict dictionary validation before recording
    if (candidateVal && String(candidateVal).trim()) {
      if (hasDict && dict && dict.allowedValues && dict.allowedValues.length > 0) {
        const sanitized = sanitizeValueAgainstDictionary(candidateVal, dict.allowedValues, col.type === 'multiselect');
        if (sanitized) {
          result[origKey] = sanitized;
          result[cleanKey] = sanitized;
        }
      } else {
        const enforced = enforceDictionaryValue(candidateVal, col.type, dict);
        if (enforced) {
          result[origKey] = enforced;
          result[cleanKey] = enforced;
        }
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

    const aiRes = await callGeminiDirect(prompt, {
      model: 'gemini-3.5-flash-lite',
      systemInstruction: EPICENTR_SYSTEM_PROMPT,
      maxOutputTokens: 120
    });

    const text = aiRes.text?.trim();
    if (text) {
      const cleanTitle = text.replace(/^["']|["']$/g, '').trim();
      return {
        title: cleanTitle,
        isFallback: false
      };
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
 * Universal token resolver against allowed dictionary values using symmetric HTML-entity/apostrophe
 * normalization, case-insensitive matching, punctuation/bracket normalization, and synonyms.
 * Returns null if token cannot be unambiguously resolved to an option in `allowed`.
 */
export function resolveTokenAgainstAllowed(
  token: string,
  allowed: string[],
  _allowedLower?: string[]
): string | null {
  if (!token || !allowed || allowed.length === 0) return null;
  const cleanedToken = normalizeApostrophes(decodeHtmlEntities(token)).trim();
  if (!cleanedToken) return null;

  const syntheticDict: EpicentrDictionaryAttribute = {
    attributeName: 'temp',
    cleanAttributeName: 'temp',
    allowedValues: allowed,
    decodedValuesMap: {},
    synonymsMap: {}
  };

  for (const rawOpt of allowed) {
    const exactNorm = normalizeForDictionaryComparison(rawOpt, 'exact');
    const relaxedNorm = normalizeForDictionaryComparison(rawOpt, 'relaxed');
    const encodedNorm = encodeHtmlEntities(rawOpt).toLowerCase().trim();
    syntheticDict.decodedValuesMap[rawOpt.toLowerCase().trim()] = rawOpt;
    syntheticDict.decodedValuesMap[exactNorm] = rawOpt;
    if (relaxedNorm) syntheticDict.decodedValuesMap[relaxedNorm] = rawOpt;
    if (encodedNorm) syntheticDict.decodedValuesMap[encodedNorm] = rawOpt;
  }

  return matchDictionaryValue(syntheticDict, cleanedToken);
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

export const OFFICIAL_CATALOG_SYSTEM_INSTRUCTION = `${UNIVERSAL_PIM_SYSTEM_PROMPT} Шукай інформацію пріоритетно на офіційних сайтах виробників, офіційних дистриб'юторів та авторитетних каталогах товарів. Повертай виключно валідний JSON без markdown-обгорток.`;

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

// ============================================================================
// Series Level Caching (Кешування характеристик брендів та серій)
// ============================================================================
export interface SeriesCacheEntry {
  brand: string;
  series: string;
  attributes: Record<string, string>;
  timestamp: number;
}

const SERIES_CACHE_STORAGE_KEY = 'epic_series_cache_v2';

/**
 * Map for storing shared series-level attributes based on the "Brand + Series" (Бренд + Серія) key.
 * Automatically populates Країна, Вид, Стать (and other shared specs) for subsequent items
 * of the same series WITHOUT calls to Gemini API.
 */
export const seriesCacheMap = new Map<string, Record<string, string>>();

function initSeriesCache(): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(SERIES_CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && typeof v === 'object') {
            seriesCacheMap.set(k, v as Record<string, string>);
          }
        }
      }
    }
  } catch {
    // Ignore read errors
  }
}

initSeriesCache();

/**
 * Builds the canonical series cache key on the basis of "Brand + Series" (Бренд + Серія).
 * E.g. Brand: "Mades Cosmetics", Title: "Chapter 01 Body Spray" -> "mades_cosmetics__chapter_01"
 */
export function buildBrandSeriesKey(brand?: string, productTitle?: string, vendorCode?: string): string {
  return extractProductSeriesKey(brand, productTitle, vendorCode);
}

/**
 * Normalizes an attribute name for series cache indexing:
 * Strips technical suffixes, asterisks, [ua]/[ru], and units.
 */
export function getSeriesAttrCanonicalKey(rawName: string): string {
  return normalizeAttributeKey(getCleanAttributeName(rawName), true);
}

export function getSeriesCache(seriesKey: string): Record<string, string> | null {
  if (!seriesKey) return null;
  return seriesCacheMap.get(seriesKey) || null;
}

export function saveSeriesCache(seriesKey: string, attributes: Record<string, string>): void {
  if (!seriesKey || !attributes || Object.keys(attributes).length === 0) return;
  const existing = seriesCacheMap.get(seriesKey) || {};
  const merged = { ...existing, ...attributes };
  seriesCacheMap.set(seriesKey, merged);

  if (typeof window !== 'undefined') {
    try {
      const obj: Record<string, Record<string, string>> = {};
      seriesCacheMap.forEach((val, k) => {
        obj[k] = val;
      });
      localStorage.setItem(SERIES_CACHE_STORAGE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore localStorage write quota errors
    }
  }
}

export function clearSeriesCache(): void {
  seriesCacheMap.clear();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(SERIES_CACHE_STORAGE_KEY);
    } catch {}
  }
}

export function getSeriesCacheSize(): number {
  return seriesCacheMap.size;
}

export function getAllSeriesCacheEntries(): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  seriesCacheMap.forEach((val, k) => {
    result[k] = val;
  });
  return result;
}

/**
 * Extracts and saves shared series-level attributes ('Країна', 'Вид', 'Стать', etc.)
 * from a product row or AI result into seriesCacheMap.
 */
export function extractAndSaveSeriesAttributes(
  seriesKey: string,
  data: Record<string, any>,
  columns?: EpicentrColumn[]
): void {
  if (!seriesKey || !data) return;

  const toSave: Record<string, string> = {};

  // Criteria for series-level shared attributes (Країна, Вид, Стать, Форма випуску, Дія, etc.)
  const isSeriesLevelAttr = (name: string): boolean => {
    const l = name.toLowerCase();
    return (
      l.includes('країн') ||
      l.startsWith('вид') ||
      l === 'вид' ||
      l.includes('стать') ||
      l.includes('призначення') ||
      l.includes('клас') ||
      l.includes('одиниц') ||
      l.includes('вік') ||
      l.includes('бренд') ||
      l.includes('форма випуску') ||
      l.includes('форма выпуска') ||
      l === 'дія' ||
      l.startsWith('дія') ||
      l.includes('действие') ||
      l.includes('тип шкіри') ||
      l.includes('тип волосся')
    );
  };

  for (const [key, val] of Object.entries(data)) {
    if (val === undefined || val === null) continue;
    const str = String(val).trim();
    if (!str || str.toLowerCase() === 'nan' || isInternalHexOrHashId(str) || isAiDisclaimerOrServiceText(str)) {
      continue;
    }

    const clean = getCleanAttributeName(key);
    const norm = getSeriesAttrCanonicalKey(key);

    if (isSeriesLevelAttr(key) || isSeriesLevelAttr(clean) || isSeriesLevelAttr(norm)) {
      toSave[key] = str;
      toSave[clean] = str;
      toSave[norm] = str;

      // Canonical aliases for specific key fields:
      // 1. Країна
      if (norm.includes('країн')) {
        toSave['__country__'] = str;
        toSave['країна'] = str;
        toSave['країна-виробник'] = str;
        toSave['країна реєстрації бренду'] = str;
      }
      // 2. Вид
      if (norm === 'вид' || norm.startsWith('вид')) {
        toSave['__type__'] = str;
        toSave['вид'] = str;
        toSave['вид продукту'] = str;
      }
      // 3. Стать
      if (norm.includes('стать')) {
        toSave['__gender__'] = str;
        toSave['стать'] = str;
        toSave['призначення за статтю'] = str;
      }
      // 4. Клас
      if (norm.includes('клас')) {
        toSave['__class__'] = str;
        toSave['клас косметики'] = str;
        toSave['клас'] = str;
      }
      // 5. Одиниця виміру
      if (norm.includes('одиниц')) {
        toSave['__unit__'] = str;
        toSave['одиниця виміру'] = str;
      }
      // 6. Форма випуску
      if (norm.includes('форма випуску') || norm.includes('форма выпуска')) {
        toSave['__packaging__'] = str;
        toSave['форма випуску'] = str;
      }
      // 7. Дія
      if (norm === 'дія' || norm.startsWith('дія') || norm.includes('действие')) {
        toSave['__action__'] = str;
        toSave['дія'] = str;
      }
    }
  }

  if (Object.keys(toSave).length > 0) {
    saveSeriesCache(seriesKey, toSave);
  }
}

/**
 * Applies cached series-level attributes ('Країна', 'Вид', 'Стать', etc.)
 * based on 'Бренд + Серія' to a product row WITHOUT making calls to Gemini API.
 */
export function applySeriesCacheToRow(
  workingRow: Record<string, any>,
  emptyCols: EpicentrColumn[],
  seriesKey: string,
  dictionaryIndex?: Record<string, EpicentrDictionaryAttribute>
): {
  appliedValues: Record<string, string>;
  explanations: Record<string, string>;
} {
  const appliedValues: Record<string, string> = {};
  const explanations: Record<string, string> = {};
  if (!seriesKey) return { appliedValues, explanations };

  const cachedAttrs = getSeriesCache(seriesKey);
  if (!cachedAttrs || Object.keys(cachedAttrs).length === 0) {
    return { appliedValues, explanations };
  }

  for (const col of emptyCols) {
    const origName = col.originalName;
    const cleanName = col.cleanName || getCleanAttributeName(origName);
    const normKey = getSeriesAttrCanonicalKey(origName);

    let matchedVal =
      cachedAttrs[origName] ||
      cachedAttrs[cleanName] ||
      cachedAttrs[normKey];

    // Priority matching for Країна, Вид, Стать, Клас, Одиниця виміру
    if (!matchedVal) {
      if (normKey.includes('країн')) {
        matchedVal =
          cachedAttrs['__country__'] ||
          cachedAttrs['країна-виробник'] ||
          cachedAttrs['країна реєстрації бренду'] ||
          cachedAttrs['країна'];
      } else if (normKey === 'вид' || normKey.startsWith('вид')) {
        matchedVal =
          cachedAttrs['__type__'] ||
          cachedAttrs['вид'] ||
          cachedAttrs['вид продукту'];
      } else if (normKey.includes('стать')) {
        matchedVal =
          cachedAttrs['__gender__'] ||
          cachedAttrs['стать'] ||
          cachedAttrs['призначення за статтю'];
      } else if (normKey.includes('клас')) {
        matchedVal =
          cachedAttrs['__class__'] ||
          cachedAttrs['клас косметики'] ||
          cachedAttrs['клас'];
      } else if (normKey.includes('одиниц')) {
        matchedVal =
          cachedAttrs['__unit__'] ||
          cachedAttrs['одиниця виміру'] ||
          cachedAttrs['одиниці виміру'];
      } else if (normKey.includes('призначення')) {
        matchedVal =
          cachedAttrs['призначення'] ||
          cachedAttrs['призначення*'];
      } else if (normKey.includes('вік')) {
        matchedVal =
          cachedAttrs['вік'] ||
          cachedAttrs['вік*'];
      } else if (normKey.includes('форма випуску') || normKey.includes('форма выпуска')) {
        matchedVal =
          cachedAttrs['__packaging__'] ||
          cachedAttrs['форма випуску'];
      } else if (normKey === 'дія' || normKey.startsWith('дія') || normKey.includes('действие')) {
        matchedVal =
          cachedAttrs['__action__'] ||
          cachedAttrs['дія'];
      }
    }

    if (matchedVal && String(matchedVal).trim()) {
      let finalVal = String(matchedVal).trim();
      // Sanitize against dictionary if available
      if (dictionaryIndex && (col.type === 'select' || col.type === 'multiselect')) {
        const dict = findDictionaryAttr(dictionaryIndex, cleanName || origName);
        if (dict && dict.allowedValues && dict.allowedValues.length > 0) {
          finalVal = sanitizeValueAgainstDictionary(finalVal, dict.allowedValues, col.type === 'multiselect');
        }
      }

      if (finalVal && finalVal.trim()) {
        appliedValues[origName] = finalVal;
        if (cleanName && cleanName !== origName) {
          appliedValues[cleanName] = finalVal;
        }
        explanations[origName] = `Series Level Cache: заповнено на основі зв'язки Бренд + Серія (${seriesKey})`;
      }
    }
  }

  return { appliedValues, explanations };
}

/**
 * Concurrency Pool: executes tasks with bounded concurrency (e.g. CONCURRENCY = 12)
 */
export async function runConcurrentPool<T, R>(
  items: T[],
  concurrency: number,
  taskFn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) break;
      results[currentIndex] = await taskFn(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
  return results;
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

export function extractBarcodeFromText(text: string): string | null {
  if (!text) return null;
  // Match standard EAN-13, EAN-8 or UPC-A barcodes (8, 12, 13, 14 digits)
  const matchParen = text.match(/\((\d{8}|\d{12,14})\)/);
  if (matchParen) return matchParen[1];
  const matchWord = text.match(/\b(\d{12,14})\b/);
  if (matchWord) return matchWord[1];
  return null;
}

/**
 * Builds a focused, noise-free Google Search query using the formula:
 * "${brand} ${barcode || model} характеристики специфікація"
 */
export function buildConciseSearchQuery(
  brand: string,
  vendorCode: string,
  productTitle: string,
  merchantDomain?: string
): string {
  const cleanBrand = (brand || '').replace(/^інше$/i, '').trim();
  const cleanSku = (vendorCode || '').trim();

  // Extract real barcode if present in title or vendorCode (e.g. EAN-13: 8714462091651)
  const barcode =
    extractBarcodeFromText(productTitle) ||
    (/^\d{12,14}$/.test(cleanSku) ? cleanSku : null);

  const cleanedTitle = cleanProductTitleNoise(productTitle, cleanBrand, cleanSku);

  const modelSnippet = cleanedTitle
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(' ')
    .slice(0, 60)
    .trim();

  // If vendorCode is a pure internal merchant number (e.g. 10 digits like 3206024502),
  // it is not recognized by manufacturer sites or Google index, so we do NOT prioritize it over real model/product name.
  const isInternalNumericSku = /^\d{8,11}$/.test(cleanSku) && !barcode;

  let queryCore = '';
  if (barcode) {
    // Barcode query provides 100% exact match in global Google search
    queryCore = `${cleanBrand} ${barcode} ${modelSnippet}`.trim();
  } else if (cleanSku && !isInternalNumericSku) {
    queryCore = `${cleanBrand} ${cleanSku} ${modelSnippet}`.trim();
  } else {
    queryCore = `${cleanBrand} ${modelSnippet}`.trim();
  }

  const baseQuery = `${queryCore} характеристики специфікація`
    .replace(/\s+/g, ' ')
    .trim();

  const cleanDomain = (merchantDomain || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (cleanDomain) {
    return `site:${cleanDomain} ${baseQuery}`;
  }
  return baseQuery;
}

/**
 * Helper to extract basic product identity fields from a row
 */
export function extractProductIdentity(productRow: Record<string, any>, merchantDomain?: string): {
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
  const searchQuery = buildConciseSearchQuery(brand, vendorCode, productTitle, merchantDomain);

  return { productTitle, brand, vendorCode, cacheKey, searchQuery };
}

/**
 * Maps raw attribute key-value pairs against target columns and Epicentr dictionary allowed values.
 * Strictly enforces Category-Agnostic Dictionary Validation:
 * - For `select` / `multiselect`, matches against `allowedValues` (with universal normalization).
 * - For `multiselect`, splits by `;` or `,`, validates EACH element against `allowedValues`, and joins valid ones with `; `.
 * - If a value for a fixed dictionary column is not in `allowedValues` and cannot be normalized to an official option, it is DELETED.
 */
function mapAttributesToColumns(
  rawAttributes: Record<string, string>,
  targetCols: EpicentrColumn[],
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  productRow?: Record<string, any>
): Record<string, string> {
  const mapped: Record<string, string> = {};

  for (const [colName, rawVal] of Object.entries(rawAttributes)) {
    if (!rawVal || typeof rawVal !== 'string') continue;
    const cleanVal = rawVal.replace(/[\u200b\u200c\u200d\ufeff]/g, '').trim();
    if (!cleanVal || isInternalHexOrHashId(cleanVal) || isAiDisclaimerOrServiceText(cleanVal)) continue;

    const matchedCol = targetCols.find(
      c =>
        c.cleanName.toLowerCase() === colName.toLowerCase() ||
        c.originalName === colName ||
        normalizeEpicentrHeaderName(c.originalName) === normalizeEpicentrHeaderName(colName) ||
        getCleanAttributeName(c.cleanName || c.originalName).toLowerCase() ===
          getCleanAttributeName(colName).toLowerCase()
    );

    if (matchedCol) {
      const origKey = matchedCol.originalName;
      const cleanKey = matchedCol.cleanName || getCleanAttributeName(origKey);
      const normKey = normalizeEpicentrHeaderName(origKey);

      // CRITICAL: NEVER overwrite or modify any cell that already had data in productRow
      if (productRow) {
        const valOrig = productRow[origKey];
        const valClean = productRow[cleanKey];
        const valNorm = productRow[normKey];
        const hasExisting =
          (valOrig !== undefined && valOrig !== null && String(valOrig).trim() !== '' && String(valOrig).toLowerCase() !== 'nan') ||
          (valClean !== undefined && valClean !== null && String(valClean).trim() !== '' && String(valClean).toLowerCase() !== 'nan') ||
          (valNorm !== undefined && valNorm !== null && String(valNorm).trim() !== '' && String(valNorm).toLowerCase() !== 'nan');
        if (hasExisting) {
          continue;
        }
      }

      const dict = findDictionaryAttr(dictionaryIndex, cleanKey);
      let enforcedVal: string | null = null;
      if (dict && dict.allowedValues && dict.allowedValues.length > 0) {
        const sanitized = sanitizeValueAgainstDictionary(cleanVal, dict.allowedValues, matchedCol.type === 'multiselect');
        enforcedVal = sanitized || null;
      } else {
        enforcedVal = enforceDictionaryValue(cleanVal, matchedCol.type, dict);
      }

      if (enforcedVal) {
        mapped[origKey] = enforcedVal;
        mapped[cleanKey] = enforcedVal;
      }
    }
  }

  return mapped;
}

/**
 * Direct client-side Google Generative Language REST API call with Google Search Grounding.
 * Uses gemini-3.5-flash-lite and passes apiKey in URL query ?key= and header x-goog-api-key.
 * Extracts grounding sources and metadata directly from candidates[0].groundingMetadata.
 * Completely eliminates backend relative routes (/api/gemini/...) and 404 errors on Vercel/static hosts.
 */
export async function callGeminiSearchRestDirect(
  prompt: string,
  options?: {
    systemInstruction?: string;
    maxOutputTokens?: number;
    storeId?: string;
  }
): Promise<{
  text: string;
  sources: { uri: string; title: string }[];
  searchEntryPoint?: string | null;
  error?: string;
}> {
  const apiKey = getStoredApiKey(options?.storeId);
  if (!apiKey) {
    notifyMissingApiKey('Google Search Grounding розшук специфікацій');
    return {
      text: '',
      sources: [],
      error: 'Google AI Studio API Key не знайдено в localStorage (epic_ai_key). Будь ласка, вкажіть ваш API-ключ у налаштуваннях.'
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body: any = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    tools: [
      {
        googleSearch: {}
      }
    ],
    generationConfig: {
      maxOutputTokens: options?.maxOutputTokens || 350,
      temperature: 0.2
    }
  };

  if (options?.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }]
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      let errDetail = '';
      try {
        const errJson = await response.json();
        errDetail = errJson?.error?.message || JSON.stringify(errJson?.error || errJson);
      } catch {
        errDetail = await response.text();
      }
      return {
        text: '',
        sources: [],
        error: `Помилка Google Generative Language API (${response.status}): ${errDetail}`
      };
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.map((p: any) => p?.text || '').join('') || '';

    // Direct extraction of grounding metadata
    const grounding = candidate?.groundingMetadata;
    const sources: { uri: string; title: string }[] = [];

    if (grounding?.groundingChunks && Array.isArray(grounding.groundingChunks)) {
      for (const chunk of grounding.groundingChunks) {
        if (chunk?.web?.uri) {
          sources.push({
            uri: chunk.web.uri,
            title: chunk.web.title || chunk.web.uri
          });
        }
      }
    }

    let searchEntryPoint: string | null = null;
    if (grounding?.searchEntryPoint?.renderedContent) {
      searchEntryPoint = grounding.searchEntryPoint.renderedContent;
    }

    return {
      text,
      sources,
      searchEntryPoint
    };
  } catch (err: any) {
    return {
      text: '',
      sources: [],
      error: `Помилка клієнтського звернення до Google Generative Language API: ${err?.message || err}`
    };
  }
}

/**
 * Researches missing product characteristics using Google Search Grounding (gemini-3.5-flash-lite).
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
  targetColumnNames?: string[],
  options?: {
    merchantDomain?: string;
    restrictToDomain?: boolean;
  }
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

  const { productTitle, brand, vendorCode, cacheKey, searchQuery } = extractProductIdentity(productRow, options?.merchantDomain);
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
    const cleanTitle = cleanProductTitleNoise(productTitle, brand, vendorCode);
    const cleanDomain = (options?.merchantDomain || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const siteRestrictionInstruction = cleanDomain
      ? `\nУВАГА: Шукай інформацію СУВОРО на сайті (домені): ${cleanDomain}.${options?.restrictToDomain ? ' Використовуй дані виключно з цього ресурсу.' : ''}`
      : '';

    const researchPrompt = `${OFFICIAL_CATALOG_SYSTEM_INSTRUCTION}
${siteRestrictionInstruction}

Знайди характеристики товару через Google Search у перевірених джерелах.
Пошуковий запит: ${searchQuery}
Назва товару: ${cleanTitle}
Бренд: ${brand || 'Не вказано'}
Артикул / Модель: ${vendorCode || 'Не вказано'}

Потрібно заповнити такі характеристики товару:
${missingAttributesPayload
  .map(
    a =>
      `- "${a.originalName}" (${a.type})${
        a.allowedValues ? ` [Дозволені значення: ${a.allowedValues.slice(0, 30).join(', ')}]` : ''
      }`
  )
  .join('\n')}

Поверни результат строго у форматі JSON:
{
  "attributes": {
    "Точна назва колонки": "Знайдене значення"
  },
  "explanations": {
    "Точна назва колонки": "Коротке джерело або обґрунтування"
  }
}`;

    const aiRes = await callGeminiSearchRestDirect(researchPrompt, {
      systemInstruction: OFFICIAL_CATALOG_SYSTEM_INSTRUCTION,
      maxOutputTokens: 350
    });

    if (aiRes.sources && aiRes.sources.length > 0) {
      result.sources = aiRes.sources;
    }
    if (aiRes.searchEntryPoint) {
      result.searchEntryPoint = aiRes.searchEntryPoint;
    }

    if (aiRes.text) {
      let rawData: any = null;
      const cleanedText = aiRes.text
        .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
        .replace(/\s*```[\s\S]*$/, '')
        .trim();
      try {
        rawData = JSON.parse(cleanedText);
      } catch {
        const pairRegex = /"((?:[^"\\]|\\.)+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        let m: RegExpExecArray | null;
        const attrObj: Record<string, string> = {};
        while ((m = pairRegex.exec(cleanedText)) !== null) {
          const k = m[1].replace(/\\"/g, '"').trim();
          const v = m[2].replace(/\\"/g, '"').trim();
          if (k && k !== 'attributes' && k !== 'explanations') {
            attrObj[k] = v;
          }
        }
        if (Object.keys(attrObj).length > 0) {
          rawData = { attributes: attrObj };
        }
      }

      if (rawData && rawData.attributes && typeof rawData.attributes === 'object') {
        const mappedFromWeb = mapAttributesToColumns(rawData.attributes, remainingEmptyCols, dictionaryIndex);
        result.suggestedValues = {
          ...result.suggestedValues,
          ...mappedFromWeb
        };

        if (rawData.explanations && typeof rawData.explanations === 'object') {
          result.explanations = {
            ...(result.explanations || {}),
            ...rawData.explanations
          };
        }

        if (Object.keys(mappedFromWeb).length > 0) {
          saveCachedSearchResult(cacheKey, {
            attributes: mappedFromWeb,
            explanations: result.explanations || {},
            sources: result.sources || [],
            timestamp: Date.now()
          });
        }
      }
    } else if (aiRes.error) {
      result.error = aiRes.error;
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

  // Step 1: Check Series Level Cache ('Бренд + Серія') to populate Країна, Вид, Стать without Gemini API
  const brand = String(productRow['Бренд*'] || productRow['Бренд'] || '');
  const title = String(
    productRow['Назва товару*\n[ua]'] ||
    productRow['Назва товару [ua]*'] ||
    productRow['Назва товару\n[ua]'] ||
    productRow['Назва товару'] ||
    ''
  );
  const sku = String(productRow['Артикул*'] || productRow['Артикул'] || '');
  const seriesKey = buildBrandSeriesKey(brand, title, sku);

  // Pre-seed seriesCacheMap from existing non-empty fields in this row
  extractAndSaveSeriesAttributes(seriesKey, productRow, columns);

  // Apply Series Level Cache
  const { appliedValues: seriesValues, explanations: seriesExplanations } = applySeriesCacheToRow(
    productRow,
    emptyCols,
    seriesKey,
    dictionaryIndex
  );

  let finalSuggested: Record<string, string> = { ...seriesValues };
  let explanations: Record<string, string> = { ...seriesExplanations };
  let fromCache = Object.keys(seriesValues).length > 0;

  // Run local heuristic extraction for remaining empty columns
  const localExtracted = applyLocalPimExtraction(productRow, emptyCols, dictionaryIndex, finalSuggested);
  finalSuggested = { ...finalSuggested, ...localExtracted };

  const colsForAi = emptyCols.filter(c => {
    const origKey = c.originalName;
    const cleanKey = c.cleanName || getCleanAttributeName(origKey);
    return !finalSuggested[origKey] && !finalSuggested[cleanKey];
  });

  // If all empty columns (or all mandatory columns) were resolved by Series Cache + local heuristics,
  // SKIP network AI & Gemini API completely!
  if (colsForAi.length === 0 || areAllMandatoryCharacteristicsFilled({ ...productRow, ...finalSuggested }, columns)) {
    extractAndSaveSeriesAttributes(seriesKey, { ...productRow, ...finalSuggested }, columns);
    return {
      suggestedValues: finalSuggested,
      explanations: Object.keys(explanations).length > 0 ? explanations : undefined,
      fromCache
    };
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
      const prompt = `${UNIVERSAL_PIM_SYSTEM_PROMPT}

Проаналізуй дані товару (назву, артикул, опис) та заповни порожні характеристики.

ПРАВИЛА ВАЛІДАЦІЇ ТА ФОРМАТУВАННЯ:
1. Для БУДЬ-ЯКОЇ колонки типу "select" або "multiselect" обирай значення СУВОРО з наданого масиву allowedValues відповідної колонки.
2. Для полів типу "multiselect" перераховуй обрані з allowedValues значення через крапку з комою з пробілом ("; ").
3. Якщо інформації немає в тексті або значення відсутнє в allowedValues — повертай порожній рядок (""). Вигадувати значення поза довідником суворо заборонено.

Порожні колонки товару для заповнення:
${colsForAi
  .map(c => {
    const clean = getCleanAttributeName(c.cleanName || c.originalName);
    const hasDict = !!dictContext[c.originalName] || !!dictContext[clean.toLowerCase()];
    return `- "${c.originalName}" (${c.type}, ${c.isRequired ? 'обовʼязкове *' : 'додаткове'}${c.lang ? `, мова: ${c.lang}` : ''})${
      hasDict ? ' [СУВОРИЙ ДОВІДНИК allowedValues]' : ''
    }`;
  })
  .join('\n')}

Довідник дозволених опцій (allowedValues):
${JSON.stringify(dictContext, null, 2)}

Поточні дані товару:
${JSON.stringify(productRow, null, 2)}

Поверни результат строго у форматі JSON:
{
  "suggestedValues": {
    "Точна назва колонки": "Значення з allowedValues або порожній рядок"
  }
}`;

      const aiRes = await callGeminiDirect(prompt, {
        model: 'gemini-3.5-flash-lite',
        systemInstruction: UNIVERSAL_PIM_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        maxOutputTokens: 350
      });

      const text = aiRes.text;
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
    } catch (err) {
      console.warn('Gemini AI call failed, using local PIM heuristic extraction:', err);
    }
  }

  let sources: { uri: string; title: string }[] = [];

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

  // Step 3: Final Mandatory Fallback Gate (Mandatory Fallback)
  // Ensure NO mandatory field (*) remains empty if an allowed default exists in the dictionary!
  for (const col of emptyCols) {
    const origKey = col.originalName;
    const cleanKey = col.cleanName || getCleanAttributeName(origKey);
    const isMandatory = col.isRequired || origKey.includes('*') || cleanKey.includes('*');

    if (isMandatory && !finalSuggested[origKey] && !finalSuggested[cleanKey]) {
      const cleanCol = getCleanAttributeName(cleanKey).toLowerCase();
      const dict =
        dictionaryIndex[cleanCol] ||
        Object.values(dictionaryIndex).find(
          d => getCleanAttributeName(d.cleanAttributeName).toLowerCase() === cleanCol
        );

      if (dict && dict.allowedValues && dict.allowedValues.length > 0) {
        const fullContext = `${productRow['Назва товару*\n[ua]'] || productRow['Назва товару [ua]*'] || productRow['Назва товару'] || ''} ${productRow['Опис (text)\n[ua]'] || productRow['Опис'] || ''}`.toLowerCase();
        const fallback = resolveMandatoryFallback(origKey, col.type, dict.allowedValues, fullContext);
        if (fallback) {
          finalSuggested[origKey] = fallback;
          finalSuggested[cleanKey] = fallback;
          if (!explanations[origKey]) {
            explanations[origKey] = 'Базовий дефолтний фолбек для обов\'язкового поля за PIM-довідником категорії';
          }
        }
      }
    }
  }

  if (Object.keys(finalSuggested).length > 0) {
    extractAndSaveSeriesAttributes(seriesKey, { ...productRow, ...finalSuggested }, columns);
  }

  return {
    suggestedValues: finalSuggested,
    explanations: Object.keys(explanations).length > 0 ? explanations : undefined,
    sources: sources.length > 0 ? sources : undefined,
    fromCache
  };
}

/**
 * Groups up to 5 products into a single prompt for gemini-3.5-flash-lite, returning a JSON array of responses
 */
export async function enrichProductBatchWithGemini5(
  entries: Array<{
    id: string;
    productRow: Record<string, any>;
    missingCols: EpicentrColumn[];
  }>,
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>
): Promise<Record<string, Record<string, string>>> {
  const resultsByEntryId: Record<string, Record<string, string>> = {};
  if (entries.length === 0) return resultsByEntryId;

  // Build dictionary context for all columns needed across these products
  const dictContext: Record<string, { type: string; allowedValues: string[] }> = {};
  for (const entry of entries) {
    resultsByEntryId[entry.id] = {};
    for (const col of entry.missingCols) {
      const cleanCol = getCleanAttributeName(col.cleanName || col.originalName).toLowerCase();
      const dict =
        dictionaryIndex[cleanCol] ||
        Object.values(dictionaryIndex).find(
          d => getCleanAttributeName(d.cleanAttributeName).toLowerCase() === cleanCol
        );

      if (dict && dict.allowedValues && dict.allowedValues.length > 0) {
        dictContext[col.originalName] = {
          type: col.type === 'multiselect' ? 'multiselect' : 'select',
          allowedValues: dict.allowedValues.slice(0, 100)
        };
      }
    }
  }

  // Build the multi-item prompt
  const productsSummary = entries
    .map((entry, idx) => {
      const title =
        entry.productRow['Назва товару*\n[ua]'] ||
        entry.productRow['Назва товару [ua]*'] ||
        entry.productRow['Назва товару\n[ua]'] ||
        entry.productRow['Назва товару'] ||
        '';
      const brand = entry.productRow['Бренд*'] || entry.productRow['Бренд'] || '';
      const sku = entry.productRow['Артикул*'] || entry.productRow['Артикул'] || '';
      const desc = stripHtmlToCleanText(
        entry.productRow['Опис (text)\n[ua]'] || entry.productRow['Опис'] || ''
      ).slice(0, 300);

      const colsList = entry.missingCols
        .map(c => `- "${c.originalName}" (${c.type}${c.isRequired ? ', *' : ''})`)
        .join('\n');

      return `--- ТОВАР #${idx + 1} (ID: "${entry.id}") ---
Назва: ${title}
Бренд: ${brand}
Артикул: ${sku}
Опис: ${desc}
Порожні колонки:
${colsList}`;
    })
    .join('\n\n');

  const batchPrompt = `${UNIVERSAL_PIM_SYSTEM_PROMPT}

Проаналізуй дані наданих товарів (назву, артикул, опис) та заповни порожні характеристики для кожного з них СУВОРО з масивів allowedValues.

ПРАВИЛА:
1. Для колонок типів "select" та "multiselect" обирай значення СУВОРО з наданого довідника allowedValues.
2. Для "multiselect" розділяй значення крапкою з комою з пробілом ("; ").
3. Якщо інформації немає або значення відсутнє в allowedValues — став порожній рядок ("").
4. Поверни СУВОРО JSON-масив відповідей з об'єктами для кожного товару:
[
  {
    "id": "ідентифікатор_товару",
    "suggestedValues": {
      "Точна назва колонки": "значення з allowedValues або порожній рядок"
    }
  }
]

СПИСОК ТОВАРІВ У ПАКЕТІ:
${productsSummary}

ДОВІДНИК ДОЗВОЛЕНИХ ОПЦІЙ (allowedValues):
${JSON.stringify(dictContext, null, 2)}`;

  try {
    const aiRes = await callGeminiDirect(batchPrompt, {
      model: 'gemini-3.5-flash-lite',
      systemInstruction: UNIVERSAL_PIM_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      maxOutputTokens: 1200
    });

    const text = aiRes.text;
    if (text) {
      const cleanedText = text
        .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
        .replace(/\s*```[\s\S]*$/, '')
        .trim();

      let parsedArr: any[] = [];
      try {
        const parsed = JSON.parse(cleanedText);
        parsedArr = Array.isArray(parsed) ? parsed : parsed.products || parsed.items || [parsed];
      } catch {
        const match = cleanedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (match) {
          try {
            parsedArr = JSON.parse(match[0]);
          } catch {}
        }
      }

      for (const itemResult of parsedArr) {
        if (!itemResult || typeof itemResult !== 'object') continue;
        const targetId = String(itemResult.id || itemResult.ID || '');
        const entry = entries.find(e => e.id === targetId) || (parsedArr.length === 1 ? entries[0] : null);
        if (!entry) continue;

        const rawSuggested = (itemResult.suggestedValues || itemResult.attributes || itemResult) as Record<string, string>;
        const mapped = mapAttributesToColumns(rawSuggested, entry.missingCols, dictionaryIndex);
        resultsByEntryId[entry.id] = mapped;
      }
    }
  } catch (err) {
    console.warn('Batch AI prompt to gemini-3.5-flash-lite failed, falling back to local extraction:', err);
  }

  // Safety fallback: for any entry where mandatory columns remain empty, apply local extraction & mandatory fallback
  for (const entry of entries) {
    const currentSuggested = resultsByEntryId[entry.id] || {};
    for (const col of entry.missingCols) {
      const origKey = col.originalName;
      const cleanKey = col.cleanName || getCleanAttributeName(origKey);
      if (!currentSuggested[origKey] && !currentSuggested[cleanKey]) {
        if (col.isRequired || origKey.includes('*')) {
          const cleanCol = getCleanAttributeName(cleanKey).toLowerCase();
          const dict =
            dictionaryIndex[cleanCol] ||
            Object.values(dictionaryIndex).find(
              d => getCleanAttributeName(d.cleanAttributeName).toLowerCase() === cleanCol
            );
          if (dict && dict.allowedValues && dict.allowedValues.length > 0) {
            const fullContext = `${entry.productRow['Назва товару*\n[ua]'] || entry.productRow['Назва товару'] || ''} ${entry.productRow['Опис (text)\n[ua]'] || ''}`.toLowerCase();
            const fallback = resolveMandatoryFallback(origKey, col.type, dict.allowedValues, fullContext);
            if (fallback) {
              currentSuggested[origKey] = fallback;
            }
          }
        }
      }
    }
    resultsByEntryId[entry.id] = currentSuggested;
  }

  return resultsByEntryId;
}

export interface BatchEnrichmentProgressMetrics {
  processed: number;
  total: number;
  speed: number; // items / sec
  etaSeconds: number;
  savedApiCalls: number;
  zeroAiCount: number;
  seriesCacheHits: number;
  stage: string;
}

export interface BatchEnrichmentOptions<T> {
  useWebGrounding?: boolean;
  merchantDomain?: string;
  restrictToDomain?: boolean;
  batchSize?: number;
  concurrency?: number; // Default 12
  itemsPerPrompt?: number; // Default 5
  onlyMandatoryUnfilledGrounding?: boolean;
  onStageUpdate?: (message: string) => void;
  onProgressMetrics?: (metrics: BatchEnrichmentProgressMetrics) => void;
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

/**
 * Scalable High-Performance Batch Processor for Large Catalogs (7000+ items):
 * 1. Zero-AI Cutoff: Deterministic Level 1 & 2 analysis + series cache bypasses Gemini completely if mandatory fields are met.
 * 2. 5-product prompt batching for gemini-3.5-flash-lite reduces HTTP request overhead by 80%.
 * 3. Asynchronous Concurrency Pool with CONCURRENCY = 12 executes 60 parallel product evaluations simultaneously.
 * 4. Series Level Caching (seriesCacheMap) shares specs across brand/lines without repeated API calls.
 * 5. Point Grounding: selective stage 2 execution only for products with unfilled mandatory asterisks (*).
 * 6. Real-time ETA, items/sec throughput calculation, and saved API requests metrics.
 */
export async function enrichProductsBatchWithAI<T extends { idx: number; updatedRow: Record<string, any> }>(
  items: T[],
  columns: EpicentrColumn[],
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  options?: BatchEnrichmentOptions<T>
): Promise<{
  totalProcessed: number;
  resolvedLocallyCount: number;
  resolvedFromCacheCount: number;
  variantGroupsSearchedCount: number;
  savedApiCallsCount: number;
  zeroAiCount: number;
  seriesCacheHits: number;
}> {
  const concurrency = options?.concurrency || 12;
  const itemsPerPrompt = options?.itemsPerPrompt || 5;

  let totalProcessed = 0;
  let resolvedLocallyCount = 0;
  let resolvedFromCacheCount = 0;
  let variantGroupsSearchedCount = 0;
  let savedApiCallsCount = 0;
  let zeroAiCount = 0;
  let seriesCacheHits = 0;

  const startTime = performance.now();

  const emitProgress = (stage: string) => {
    const elapsedSec = Math.max(0.1, (performance.now() - startTime) / 1000);
    const speed = Math.round((totalProcessed / elapsedSec) * 10) / 10;
    const remaining = Math.max(0, items.length - totalProcessed);
    const etaSeconds = speed > 0 ? Math.round(remaining / speed) : 0;

    if (options?.onProgressMetrics) {
      options.onProgressMetrics({
        processed: totalProcessed,
        total: items.length,
        speed,
        etaSeconds,
        savedApiCalls: savedApiCallsCount,
        zeroAiCount,
        seriesCacheHits,
        stage
      });
    }

    if (options?.onStageUpdate) {
      const etaMin = Math.floor(etaSeconds / 60);
      const etaSec = etaSeconds % 60;
      const etaStr = etaMin > 0 ? `${etaMin} хв ${etaSec} с` : `${etaSec} с`;
      options.onStageUpdate(
        `${stage} | ${totalProcessed}/${items.length} (${speed} тов./сек, ETA: ${etaStr}, Зекономлено API: ${savedApiCallsCount})`
      );
    }
  };

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

  // If Stage 2 Point Grounding is requested: filter exclusively to products where mandatory fields remain unfilled!
  const targetItems = options?.onlyMandatoryUnfilledGrounding
    ? items.filter(item => !areAllMandatoryCharacteristicsFilled(item.updatedRow, columns))
    : items;

  // Pre-seed seriesCacheMap from any products in targetItems that already have non-empty series attributes (Країна, Вид, Стать)
  for (const it of targetItems) {
    const b = String(it.updatedRow['Бренд*'] || it.updatedRow['Бренд'] || '');
    const t = String(
      it.updatedRow['Назва товару*\n[ua]'] ||
      it.updatedRow['Назва товару [ua]*'] ||
      it.updatedRow['Назва товару'] ||
      ''
    );
    const s = String(it.updatedRow['Артикул*'] || it.updatedRow['Артикул'] || '');
    const sKey = buildBrandSeriesKey(b, t, s);
    extractAndSaveSeriesAttributes(sKey, it.updatedRow, columns);
  }

  // ============================================================================
  // STEP 1: Fast Local Deterministic Pre-filling + Series Cache + Zero-AI Cutoff
  // ============================================================================
  emitProgress('Етап 1/2: Локальне PIM-дозаповнення та перевірка серій');

  const itemsNeedingStep2: Array<{
    item: T;
    workingRow: Record<string, any>;
    remainingCols: EpicentrColumn[];
    cacheKey: string;
    seriesKey: string;
  }> = [];

  for (let i = 0; i < targetItems.length; i++) {
    const item = targetItems[i];
    const emptyColsForItem = fillableCols.filter(c => {
      const vOrig = item.updatedRow[c.originalName];
      const vClean = item.updatedRow[c.cleanName];
      const emptyOrig =
        vOrig === undefined || vOrig === null || String(vOrig).trim() === '' || String(vOrig).toLowerCase() === 'nan';
      const emptyClean =
        vClean === undefined || vClean === null || String(vClean).trim() === '' || String(vClean).toLowerCase() === 'nan';
      return emptyOrig && emptyClean;
    });

    if (emptyColsForItem.length === 0) {
      resolvedLocallyCount++;
      savedApiCallsCount++;
      zeroAiCount++;
      totalProcessed++;
      if (totalProcessed % 50 === 0) emitProgress('Етап 1/2: Локальне PIM-дозаповнення та перевірка серій');
      continue;
    }

    const brand = String(item.updatedRow['Бренд*'] || item.updatedRow['Бренд'] || '');
    const title = String(
      item.updatedRow['Назва товару*\n[ua]'] ||
      item.updatedRow['Назва товару [ua]*'] ||
      item.updatedRow['Назва товару'] ||
      ''
    );
    const sku = String(item.updatedRow['Артикул*'] || item.updatedRow['Артикул'] || '');
    const seriesKey = buildBrandSeriesKey(brand, title, sku);

    // Apply Series Level Cache ('Бренд + Серія') to populate Країна, Вид, Стать and other series attributes
    const { appliedValues: seriesValues, explanations: seriesExplanations } = applySeriesCacheToRow(
      item.updatedRow,
      emptyColsForItem,
      seriesKey,
      dictionaryIndex
    );

    if (Object.keys(seriesValues).length > 0) {
      seriesCacheHits++;
      savedApiCallsCount++;
    }

    // Run local deterministic extractor
    const extracted = applyLocalPimExtraction(item.updatedRow, emptyColsForItem, dictionaryIndex, seriesValues);
    const combinedLocal = { ...seriesValues, ...extracted };

    if (Object.keys(combinedLocal).length > 0 && options?.onItemEnriched) {
      options.onItemEnriched(item, {
        suggestedValues: combinedLocal,
        explanations: {
          ...seriesExplanations,
          ...Object.fromEntries(
            Object.keys(extracted).map(k => [k, 'Заповнено локально (Експрес PIM-аналіз)'])
          )
        },
        fromCache: Object.keys(seriesValues).length > 0
      });
    }

    const workingRow = { ...item.updatedRow, ...combinedLocal };

    // Check Zero-AI Cutoff condition:
    // If all mandatory asterisked fields (*) are satisfied -> BYPASS GEMINI & GROUNDING COMPLETELY!
    const mandatoryComplete = areAllMandatoryCharacteristicsFilled(workingRow, columns);
    if (mandatoryComplete) {
      resolvedLocallyCount++;
      zeroAiCount++;
      savedApiCallsCount++;

      // Save any series-wide attributes discovered for subsequent items
      extractAndSaveSeriesAttributes(seriesKey, workingRow, columns);

      totalProcessed++;
      if (totalProcessed % 50 === 0) emitProgress('Етап 1/2: Локальне PIM-дозаповнення та перевірка серій');
      continue;
    }

    const remainingCols = emptyColsForItem.filter(c => {
      const origKey = c.originalName;
      const cleanKey = c.cleanName || getCleanAttributeName(origKey);
      return !combinedLocal[origKey] && !combinedLocal[cleanKey];
    });

    if (remainingCols.length === 0) {
      resolvedLocallyCount++;
      zeroAiCount++;
      savedApiCallsCount++;
      totalProcessed++;
      if (totalProcessed % 50 === 0) emitProgress('Етап 1/2: Локальне PIM-дозаповнення та перевірка серій');
      continue;
    }

    const { cacheKey } = extractProductIdentity(workingRow);
    itemsNeedingStep2.push({
      item,
      workingRow,
      remainingCols,
      cacheKey,
      seriesKey
    });

    totalProcessed++;
    if (totalProcessed % 50 === 0) emitProgress('Етап 1/2: Локальне PIM-дозаповнення та перевірка серій');
  }

  emitProgress('Етап 1/2 завершено');

  // If all items satisfied the Zero-AI cutoff, complete without network calls!
  if (itemsNeedingStep2.length === 0) {
    emitProgress('Обробку успішно завершено (Zero-AI)');
    return {
      totalProcessed: targetItems.length,
      resolvedLocallyCount,
      resolvedFromCacheCount,
      variantGroupsSearchedCount,
      savedApiCallsCount,
      zeroAiCount,
      seriesCacheHits
    };
  }

  // ============================================================================
  // STEP 2A: Express Mode (Gemini 3.5 Flash Lite + 5-item Batching + 12 Concurrency Pool)
  // ============================================================================
  if (!options?.useWebGrounding) {
    // Group remaining items into 5-product batches
    const promptBatches: Array<typeof itemsNeedingStep2> = [];
    for (let i = 0; i < itemsNeedingStep2.length; i += itemsPerPrompt) {
      promptBatches.push(itemsNeedingStep2.slice(i, i + itemsPerPrompt));
    }

    let completedPromptBatches = 0;

    await runConcurrentPool(promptBatches, concurrency, async (batch, bIdx) => {
      const entriesForBatch = batch.map((entry, idx) => ({
        id: `item_${entry.item.idx}_${idx}`,
        productRow: entry.workingRow,
        missingCols: entry.remainingCols
      }));

      const batchResults = await enrichProductBatchWithGemini5(entriesForBatch, dictionaryIndex);

      for (let j = 0; j < batch.length; j++) {
        const entry = batch[j];
        const entryId = entriesForBatch[j].id;
        const suggested = batchResults[entryId] || {};

        if (Object.keys(suggested).length > 0) {
          // Update series cache with new discovered specs (Країна, Вид, Стать, etc.)
          extractAndSaveSeriesAttributes(entry.seriesKey, { ...entry.workingRow, ...suggested }, columns);

          if (options?.onItemEnriched) {
            options.onItemEnriched(entry.item, {
              suggestedValues: suggested,
              explanations: Object.fromEntries(
                Object.keys(suggested).map(k => [k, 'Етап 2: Заповнено Gemini 3.5 Flash-Lite (Експрес-пакет)'])
              )
            });
          }
        }
      }

      // Batching 5 items into 1 prompt saves 4 API requests per batch
      savedApiCallsCount += Math.max(0, batch.length - 1);
      completedPromptBatches++;

      emitProgress(
        `Етап 2/2: Експрес AI-пакетування (пакет ${completedPromptBatches}/${promptBatches.length}, 12 потоків)`
      );
    });

    emitProgress('Експрес AI-обробку успішно завершено');

    return {
      totalProcessed: targetItems.length,
      resolvedLocallyCount,
      resolvedFromCacheCount,
      variantGroupsSearchedCount,
      savedApiCallsCount,
      zeroAiCount,
      seriesCacheHits
    };
  }

  // ============================================================================
  // STEP 2B: Targeted Point Grounding (Google Search + 12 Concurrency Pool)
  // ============================================================================
  const variantGroupsMap = new Map<
    string,
    Array<{
      item: T;
      workingRow: Record<string, any>;
      remainingCols: EpicentrColumn[];
      cacheKey: string;
      seriesKey: string;
    }>
  >();

  for (const entry of itemsNeedingStep2) {
    const existingGroup = variantGroupsMap.get(entry.cacheKey) || [];
    existingGroup.push(entry);
    variantGroupsMap.set(entry.cacheKey, existingGroup);
  }

  const variantGroups = Array.from(variantGroupsMap.entries()).map(([groupKey, members]) => {
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
      seriesKey: members[0].seriesKey,
      unionMissingCols: Array.from(colMap.values())
    };
  });

  let completedGroups = 0;

  await runConcurrentPool(variantGroups, concurrency, async group => {
    const res = await researchProductAttributesWithWebGrounding(
      group.representativeRow,
      group.unionMissingCols,
      dictionaryIndex,
      undefined,
      {
        merchantDomain: options?.merchantDomain,
        restrictToDomain: options?.restrictToDomain
      }
    );

    if (res.fromCache) {
      resolvedFromCacheCount += group.members.length;
      savedApiCallsCount += group.members.length;
    } else {
      variantGroupsSearchedCount++;
      savedApiCallsCount += Math.max(0, group.members.length - 1);
    }

    // Save discovered specs to series cache (Країна, Вид, Стать, etc.)
    if (res.suggestedValues && Object.keys(res.suggestedValues).length > 0) {
      extractAndSaveSeriesAttributes(group.seriesKey, { ...group.representativeRow, ...res.suggestedValues }, columns);
    }

    // Propagate to each member of variant group
    for (const member of group.members) {
      const memberSuggested: Record<string, string> = {};
      for (const col of member.remainingCols) {
        const origKey = col.originalName;
        const cleanKey = col.cleanName || getCleanAttributeName(origKey);
        let val: string = res.suggestedValues[origKey] || res.suggestedValues[cleanKey] || '';

        // Category-aware fallback for mandatory asterisked fields
        if ((!val || val.trim() === '') && (col.isRequired || origKey.includes('*'))) {
          const cleanCol = getCleanAttributeName(cleanKey).toLowerCase();
          const dict =
            dictionaryIndex[cleanCol] ||
            Object.values(dictionaryIndex).find(
              d => getCleanAttributeName(d.cleanAttributeName).toLowerCase() === cleanCol
            );
          if (dict && dict.allowedValues && dict.allowedValues.length > 0) {
            const fullContext = `${member.workingRow['Назва товару*\n[ua]'] || member.workingRow['Назва товару'] || ''} ${member.workingRow['Опис (text)\n[ua]'] || ''}`.toLowerCase();
            val = resolveMandatoryFallback(origKey, col.type, dict.allowedValues, fullContext) || '';
          }
        }

        if (val && val.trim() !== '') {
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

    completedGroups++;
    emitProgress(
      `Етап 2/2: Точковий Google Grounding (група ${completedGroups}/${variantGroups.length}, 12 потоків)`
    );
  });

  emitProgress('Точковий розшук у Google успішно завершено');

  return {
    totalProcessed: targetItems.length,
    resolvedLocallyCount,
    resolvedFromCacheCount,
    variantGroupsSearchedCount,
    savedApiCallsCount,
    zeroAiCount,
    seriesCacheHits
  };
}