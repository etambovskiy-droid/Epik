/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import {
  EpicentrColumn,
  EpicentrColumnType,
  EpicentrDictionaryAttribute,
  EpicentrProductRow,
  EpicentrValueDiff,
  ProcessSettings,
  ProcessingReportSummary,
  EngineErrorEvent
} from '../types/epicentr';

/**
 * Decode HTML entities for matching purposes only.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

/**
 * Common Ukrainian <-> Russian vocabulary and dictionary mappings
 */
const RU_TO_UA_WORDS: Record<string, string> = {
  'наушники': 'навушники',
  'черный': 'чорний',
  'черная': 'чорна',
  'черное': 'чорне',
  'черно-красный': 'чорно-червоний',
  'белый': 'білий',
  'белая': 'біла',
  'белое': 'біле',
  'розовый': 'рожевий',
  'розовая': 'рожева',
  'красный': 'червоний',
  'синий': 'синій',
  'серый': 'сірий',
  'зеленый': 'зелений',
  'офисное': 'офісне',
  'офисный': 'офісний',
  'кресло': 'крісло',
  'съемный': 'знімний',
  'съемная': 'знімна',
  'беспроводные': 'бездротові',
  'беспроводной': 'бездротовий',
  'проводной': 'дротовий',
  'игровые': 'ігрові',
  'игровое': 'ігрове',
  'игровая': 'ігрова',
  'люстра': 'люстра',
  'припотолочная': 'пристельова',
  'подвесная': 'підвісна',
  'хрустальная': 'кришталева',
  'полуоткрытые': 'напіввідкриті',
  'для студии': 'для студії',
  'металл': 'метал',
  'сетка': 'сітка',
  'искусственная кожа': 'штучна шкіра',
  'экокожа': 'штучна шкіра',
  'женские': 'жіночі',
  'женская': 'жіноча',
  'мужские': 'чоловічі',
  'детские': 'дитячі',
  'деми-лето': 'демі-літо',
  'демисезон': 'демісезон',
  'лето': 'літо',
  'зима': 'зима',
  'замеры': 'заміри',
  'размер': 'розмір',
  'размеры': 'розміри',
  'хлопок': 'бавовна',
  'коттон': 'котон',
  'джинсы': 'джинси',
  'джеггинсы': 'джеггінси',
  'высокая': 'висока',
  'средняя': 'середня',
  'низкая': 'низькая'
};

const UA_TO_RU_WORDS: Record<string, string> = {
  'навушники': 'наушники',
  'чорний': 'черный',
  'чорна': 'черная',
  'чорне': 'черное',
  'чорно-червоний': 'черно-красный',
  'білий': 'белый',
  'біла': 'белая',
  'біле': 'белое',
  'рожевий': 'розовый',
  'рожева': 'розовая',
  'червоний': 'красный',
  'синій': 'синий',
  'сірий': 'серый',
  'зелений': 'зеленый',
  'офісне': 'офисное',
  'офісний': 'офисный',
  'крісло': 'кресло',
  'знімний': 'съемный',
  'знімна': 'съемная',
  'бездротові': 'беспроводные',
  'бездротовий': 'беспроводной',
  'дротовий': 'проводной',
  'ігрові': 'игровые',
  'ігрове': 'игровое',
  'ігрова': 'игровая',
  'люстра': 'люстра',
  'пристельова': 'припотолочная',
  'підвісна': 'подвесная',
  'кришталева': 'хрустальная',
  'напіввідкриті': 'полуоткрытые',
  'для студії': 'для студии',
  'метал': 'металл',
  'сітка': 'сетка',
  'штучна шкіра': 'искусственная кожа',
  'екошкіра': 'искусственная кожа',
  'жіночі': 'женские',
  'жіноча': 'женская',
  'жіночий': 'женский',
  'чоловічі': 'мужские',
  'чоловіча': 'мужская',
  'чоловічий': 'мужской',
  'дитячі': 'детские',
  'демі-літо': 'деми-лето',
  'демісезон': 'демисезон',
  'демісезонні': 'демисезонные',
  'літо': 'лето',
  'заміри': 'замеры',
  'розмір': 'размер',
  'розміри': 'размеры',
  'бавовна': 'хлопок',
  'котон': 'коттон',
  'джинси': 'джинсы',
  'джеггінси': 'джеггинсы',
  'джегінси': 'джеггинсы',
  'висока': 'высокая',
  'середня': 'средняя',
  'низька': 'низкая',
  'колір': 'цвет',
  'матеріал': 'материал',
  'склад': 'состав',
  'виробник': 'производитель',
  'країна': 'страна'
};

/**
 * Common synonyms mapping to official Epicentr dictionary values
 */
const COMMON_SYNONYMS: Record<string, string> = {
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
  'демісезонний': 'демісезон',
  'демісезонна': 'демісезон',
  'демісезонні': 'демісезон',
  'осінь-весна': 'демісезон',
  'весна-осінь': 'демісезон',
  'екошкіра': 'штучна шкіра',
  'еко-шкіра': 'штучна шкіра',
  'шкіра pu': 'штучна шкіра',
  'pu шкіра': 'штучна шкіра',
  'pu-шкіра': 'штучна шкіра',
  'кожзам': 'штучна шкіра',
  'шкірзамінник': 'штучна шкіра',
  'memory foam': 'піна з ефектом пам&#039;яті',
  'піна з пам\'яттю': 'піна з ефектом пам&#039;яті',
  'піна пам\'яті': 'піна з ефектом пам&#039;яті',
  'ефект пам\'яті': 'піна з ефектом пам&#039;яті',
  'меш': 'сітка',
  'mesh': 'сітка',
  'тканина': 'текстиль',
  'bluetooth 5.0': 'бездротове',
  'bluetooth 5.3': 'бездротове',
  '2.4g': 'радіоканал (2.4 GHz)',
  '2.4 ghz': 'радіоканал (2.4 GHz)',
  '2.4ghz': 'радіоканал (2.4 GHz)',
  'дротові': 'дротове',
  'проводные': 'дротове',
  'бездротові': 'бездротове',
  'беспроводные': 'бездротове',
  'комбіновані': 'комбіноване',
  'штука': 'шт.',
  'штук': 'шт.',
  'шт': 'шт.',
  'комплект': 'компл.',
  'набір': 'компл.',
  'упаковка': 'уп.',
  'пачка': 'уп.',
  'однотонний': 'без візерунка (однотонний)',
  'без візерунку': 'без візерунка (однотонний)',
  'без візерунка': 'без візерунка (однотонний)',
  'однотон': 'без візерунка (однотонний)',
  'принт': 'з візерунком',
  'малюнок': 'з візерунком',
  'смужки': 'з візерунком',
  'орнамент': 'з візерунком'
};

/**
 * Normalize an attribute/column name by removing service tags, newlines, and units for flexible dictionary lookup.
 */
export function normalizeAttributeKey(rawName: string, stripUnits = false): string {
  if (!rawName) return '';
  let cleaned = rawName
    .replace(/\(select\)/gi, ' ')
    .replace(/\(multiselect\)/gi, ' ')
    .replace(/\(text\)/gi, ' ')
    .replace(/\(float\)/gi, ' ')
    .replace(/\(number\)/gi, ' ')
    .replace(/\(integer\)/gi, ' ')
    .replace(/\(int\)/gi, ' ')
    .replace(/\(array\)/gi, ' ')
    .replace(/\(string\)/gi, ' ')
    .replace(/\[ua\]/gi, ' ')
    .replace(/\[ru\]/gi, ' ')
    .replace(/\*/g, ' ');

  if (stripUnits) {
    cleaned = cleaned.replace(/\((мм|см|м|г|кг|шт|л|мл|вт|v|w)\)/gi, ' ');
  }

  return cleaned
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Strip HTML tags and decode entities into clean searchable text
 */
export function stripHtmlToCleanText(raw: string): string {
  if (!raw) return '';
  return decodeHtmlEntities(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Check if a column header represents an Epicentr product ID column
 */
export function isExplicitIdColumnName(name: string): boolean {
  if (!name) return false;
  const norm = normalizeAttributeKey(name, true);
  return (
    norm === 'id' ||
    norm === 'id товару' ||
    norm === 'id картки' ||
    norm === 'id позиції' ||
    norm === 'id пропозиції' ||
    norm === 'код товару' ||
    norm === 'код картки' ||
    norm === 'код позиції' ||
    norm === 'код епіцентр' ||
    norm === 'product id' ||
    norm === 'offer id' ||
    norm === 'item id' ||
    /^id(\b|\s|\(|_|-)/i.test(norm)
  );
}

/**
 * Find the primary identifier column in an Epicentr template (ID, ID товару, Код товару, or fallback to Артикул/SKU)
 */
export function findIdColumn(columns: EpicentrColumn[]): {
  col: EpicentrColumn | undefined;
  isExplicitId: boolean;
} {
  if (!columns || columns.length === 0) {
    return { col: undefined, isExplicitId: false };
  }

  // 1. Explicit ID column
  const explicitIdCol = columns.find(
    c => isExplicitIdColumnName(c.cleanName) || isExplicitIdColumnName(c.originalName)
  );
  if (explicitIdCol) {
    return { col: explicitIdCol, isExplicitId: true };
  }

  // 2. Fallback to SKU / Article / Code column (used in new product creation templates)
  const skuCol = columns.find(c => {
    const norm = normalizeAttributeKey(c.cleanName || c.originalName, true);
    return (
      norm === 'артикул' ||
      norm.includes('артикул') ||
      norm === 'sku' ||
      norm === 'vendorcode' ||
      norm === 'код постачальника' ||
      norm === 'код'
    );
  });
  if (skuCol) {
    return { col: skuCol, isExplicitId: false };
  }

  return { col: columns[0], isExplicitId: false };
}

/**
 * Parse headers to detect column types, mandatory markers, language tags, and units.
 */
export function analyzeEpicentrColumns(headers: string[]): EpicentrColumn[] {
  return headers.map((rawHeader, colIndex) => {
    const lower = rawHeader.toLowerCase();

    // Check if it is a photo / image column (фото не є обов'язковим)
    const isPhoto =
      lower.includes('фото') ||
      lower.includes('зображення') ||
      lower.includes('photo') ||
      lower.includes('image') ||
      lower.includes('picture');

    // Clean human-friendly name (collapse newlines and extra spaces!)
    const cleanName = rawHeader
      .replace(/\(select\)/gi, '')
      .replace(/\(multiselect\)/gi, '')
      .replace(/\(text\)/gi, '')
      .replace(/\(float\)/gi, '')
      .replace(/\(number\)/gi, '')
      .replace(/\(integer\)/gi, '')
      .replace(/\(int\)/gi, '')
      .replace(/\(array\)/gi, '')
      .replace(/\(string\)/gi, '')
      .replace(/\[ua\]/gi, '')
      .replace(/\[ru\]/gi, '')
      .replace(/\*/g, '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Фото та ID НЕ є обов'язковими для перезапису характеристиками
    const isId = isExplicitIdColumnName(cleanName) || isExplicitIdColumnName(rawHeader);
    const isRequired = isPhoto || isId ? false : rawHeader.includes('*');

    // Type detection from column header like (select), (multiselect), (float), (text), (array), (string)
    let type: EpicentrColumnType = 'string';
    if (lower.includes('(multiselect)')) type = 'multiselect';
    else if (lower.includes('(select)')) type = 'select';
    else if (lower.includes('(float)') || lower.includes('(number)') || lower.includes('(integer)') || lower.includes('(int)')) type = 'float';
    else if (lower.includes('(text)')) type = 'text';
    else if (lower.includes('(array)')) type = 'array';
    else if (lower.includes('(string)')) type = 'string';

    // Language detection
    let lang: 'ua' | 'ru' | undefined;
    if (lower.includes('[ua]')) lang = 'ua';
    else if (lower.includes('[ru]')) lang = 'ru';

    // Unit detection like (м), (г), (кг), (мм)
    let unit: string | undefined;
    const unitMatch = rawHeader.match(/\((мм|см|м|г|кг|шт|л|мл|вт|v|w)\)/i);
    if (unitMatch) {
      unit = unitMatch[1].toLowerCase();
    }

    return {
      colIndex,
      originalName: rawHeader,
      cleanName,
      type,
      isRequired,
      lang,
      unit
    };
  });
}

/**
 * Normalize and build index of dictionary values for fast lookup with HTML entity support
 */
export function buildDictionaryIndex(
  rawDict: Record<string, string[]>
): Record<string, EpicentrDictionaryAttribute> {
  const result: Record<string, EpicentrDictionaryAttribute> = {};

  for (const [attrName, allowedList] of Object.entries(rawDict)) {
    const cleanAttrName = normalizeAttributeKey(attrName, false);
    const strippedUnitAttrName = normalizeAttributeKey(attrName, true);
    const decodedMap: Record<string, string> = {};
    const synonyms: Record<string, string> = {};

    for (const rawVal of allowedList) {
      const decoded = decodeHtmlEntities(rawVal).trim().toLowerCase();
      decodedMap[decoded] = rawVal;
      decodedMap[rawVal.toLowerCase()] = rawVal;

      // also register without punctuation
      const noPunct = decoded.replace(/['’"`]/g, '');
      if (noPunct !== decoded) {
        decodedMap[noPunct] = rawVal;
      }
    }

    const entry: EpicentrDictionaryAttribute = {
      attributeName: attrName,
      cleanAttributeName: cleanAttrName,
      allowedValues: allowedList,
      decodedValuesMap: decodedMap,
      synonymsMap: synonyms
    };

    result[cleanAttrName] = entry;
    if (strippedUnitAttrName && !result[strippedUnitAttrName]) {
      result[strippedUnitAttrName] = entry;
    }
  }

  return result;
}

/**
 * Lookup dictionary attribute by column name (supports multiline headers and unit stripping)
 */
export function findDictionaryAttr(
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  colName: string
): EpicentrDictionaryAttribute | undefined {
  if (!dictionaryIndex || !colName) return undefined;
  const keyWithUnit = normalizeAttributeKey(colName, false);
  const keyWithoutUnit = normalizeAttributeKey(colName, true);
  return (
    dictionaryIndex[keyWithUnit] ||
    dictionaryIndex[keyWithoutUnit] ||
    Object.values(dictionaryIndex).find(
      d =>
        normalizeAttributeKey(d.cleanAttributeName, true) === keyWithoutUnit ||
        normalizeAttributeKey(d.attributeName, true) === keyWithoutUnit
    )
  );
}

/**
 * Check if Ukrainian text has Russian traits or Russian text has Ukrainian traits.
 * Works strictly via the full-word dictionary without destructive character-by-character replacement.
 */
export function detectLanguageMismatch(
  text: string,
  expectedLang: 'ua' | 'ru'
): { hasMismatch: boolean; correctedText: string; direction: string } {
  if (!text || typeof text !== 'string') return { hasMismatch: false, correctedText: text, direction: '' };

  const hasUaChars = /[іїєґІЇЄҐ]/.test(text);
  const hasRuChars = /[ыэъёЫЭЪЁ]/.test(text);

  const replaceWithCase = (sourceText: string, dictionary: Record<string, string>): string => {
    let result = sourceText;
    // Sort keys by length descending so multi-word phrases match before single words
    const entries = Object.entries(dictionary).sort((a, b) => b[0].length - a[0].length);
    for (const [srcWord, targetWord] of entries) {
      const escaped = srcWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`(?<![а-яіїєґёъыэА-ЯІЇЄҐЁЪЫЭa-zA-Z])${escaped}(?![а-яіїєґёъыэА-ЯІЇЄҐЁЪЫЭa-zA-Z])`, 'gi');
      result = result.replace(reg, (match) => {
        if (match[0] && match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
          return targetWord.charAt(0).toUpperCase() + targetWord.slice(1);
        }
        return targetWord;
      });
    }
    return result;
  };

  if (expectedLang === 'ru' && hasUaChars) {
    // Column has [ru] tag, apply only verified dictionary word translations
    const corrected = replaceWithCase(text, UA_TO_RU_WORDS);
    if (corrected !== text) {
      return {
        hasMismatch: true,
        correctedText: corrected,
        direction: 'UA -> RU (колонка [ru])'
      };
    }
  }

  if (expectedLang === 'ua' && hasRuChars) {
    // Column has [ua] tag, apply only verified dictionary word translations
    const corrected = replaceWithCase(text, RU_TO_UA_WORDS);
    if (corrected !== text) {
      return {
        hasMismatch: true,
        correctedText: corrected,
        direction: 'RU -> UA (колонка [ua])'
      };
    }
  }

  return { hasMismatch: false, correctedText: text, direction: '' };
}

/**
 * Match a value against dictionary attribute respecting HTML entities, synonyms & Ukrainian/Russian word stems.
 * Returns the exact RAW string from dictionary with HTML entities intact.
 */
export function matchDictionaryValue(
  dictAttr: EpicentrDictionaryAttribute,
  candidateValue: string
): string | null {
  if (!candidateValue || !dictAttr) return null;

  const candidateDecoded = decodeHtmlEntities(candidateValue).trim().toLowerCase();

  // 1. Direct match on decoded map
  if (dictAttr.decodedValuesMap[candidateDecoded]) {
    return dictAttr.decodedValuesMap[candidateDecoded];
  }

  // 2. Check synonyms
  if (COMMON_SYNONYMS[candidateDecoded]) {
    const synonymTarget = COMMON_SYNONYMS[candidateDecoded];
    const targetDecoded = decodeHtmlEntities(synonymTarget).toLowerCase();
    if (dictAttr.decodedValuesMap[targetDecoded]) {
      return dictAttr.decodedValuesMap[targetDecoded];
    }
  }

  // 3. Substring match for compound values (e.g. "дихаюча сітка" -> "сітка")
  for (const [decodedKey, rawVal] of Object.entries(dictAttr.decodedValuesMap)) {
    if (candidateDecoded.includes(decodedKey) || decodedKey.includes(candidateDecoded)) {
      if (decodedKey.length >= 3) {
        return rawVal;
      }
    }
  }

  // 4. Stem match (e.g. "розважальна" <-> "розважальні", "розвиваюча" <-> "розвиваючі")
  if (candidateDecoded.length >= 5) {
    const stem = candidateDecoded.replace(/(ий|ій|а|я|е|є|і|ї|ої|их|ім|им|ою)$/i, '');
    if (stem.length >= 4) {
      for (const [decodedKey, rawVal] of Object.entries(dictAttr.decodedValuesMap)) {
        if (decodedKey.startsWith(stem)) {
          return rawVal;
        }
      }
    }
  }

  return null;
}

/**
 * Format product title according to Epicentr's official formula:
 * Тип товару + Особливість + Бренд + Модель + Інші характеристики + Колір + (Артикул)
 */
export function formatEpicentrTitle(
  item: {
    productType?: string;
    feature?: string;
    brand?: string;
    model?: string;
    extraSpecs?: string;
    color?: string;
    sku?: string;
    rawTitle?: string;
    lang: 'ua' | 'ru';
  }
): string {
  const prohibitedRegex = /(?:^|[^\p{L}\p{N}])(акція|акция|знижка|скидка|original|оригінал|оригинал|розпродаж|распродажа|уцінка|уценка|новинка|топ|хіт|хит|супер|super|дешево|дешевий)(?:[^\p{L}\p{N}]|$)/giu;

  let productType = (item.productType || '').trim();
  let feature = (item.feature || '').trim();
  let brand = (item.brand || '').trim();
  let model = (item.model || '').trim();
  let extraSpecs = (item.extraSpecs || '').trim();
  let color = (item.color || '').trim();
  let sku = (item.sku || '').trim();

  if (!productType && item.rawTitle) {
    let cleanRaw = item.rawTitle
      .replace(prohibitedRegex, ' ')
      .replace(prohibitedRegex, ' ')
      .replace(/^[!?,.:;\s-]+/, '')
      .replace(/\s+/g, ' ')
      .trim();
    const skuMatch = cleanRaw.match(/\(([^)]+)\)$/);
    if (skuMatch && !sku) {
      sku = skuMatch[1];
      cleanRaw = cleanRaw.replace(/\(([^)]+)\)$/, '').trim();
    }
    if (sku && !cleanRaw.endsWith(`(${sku})`)) {
      const withSku = `${cleanRaw} (${sku})`;
      return withSku.length > 150 ? `${cleanRaw.substring(0, 150 - (sku.length + 3)).trim()} (${sku})` : withSku;
    }
    return cleanRaw.length > 150 ? cleanRaw.substring(0, 147) + '...' : cleanRaw;
  }

  if (color) {
    if (color.includes('/')) {
      color = color
        .split('/')
        .map(c => c.trim().charAt(0).toUpperCase() + c.trim().slice(1))
        .join('/');
    } else if (color.includes('-')) {
      color = color
        .split('-')
        .map(c => c.trim().charAt(0).toUpperCase() + c.trim().slice(1))
        .join('-');
    } else {
      color = color.charAt(0).toUpperCase() + color.slice(1);
    }
  }

  if (extraSpecs) {
    extraSpecs = extraSpecs.replace(/(\d+)\s*[xXхХ*]\s*(\d+)/g, '$1х$2');
  }

  const parts: string[] = [];
  if (productType) parts.push(productType);
  if (feature) parts.push(feature);
  if (brand && brand.toLowerCase() !== 'інше') parts.push(brand);
  if (model) parts.push(model);
  if (extraSpecs) parts.push(extraSpecs);
  if (color) parts.push(color);

  let title = parts.join(' ').replace(/\s+/g, ' ').trim();
  title = title
    .replace(prohibitedRegex, ' ')
    .replace(prohibitedRegex, ' ')
    .replace(/^[!?,.:;\s-]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (sku) {
    title = `${title} (${sku})`;
  }

  if (title.length > 150) {
    if (sku) {
      const maxBase = 150 - (sku.length + 3);
      title = `${title.substring(0, maxBase).trim()} (${sku})`;
    } else {
      title = title.substring(0, 147) + '...';
    }
  }

  return title;
}

/**
 * Analyze first product photo, titles, descriptions, and structured parameters in the row.
 */
function analyzeProductVisualsAndText(
  row: Record<string, any>,
  columns: EpicentrColumn[]
) {
  // Find photo column
  const photoCol = columns.find(c => {
    const l = (c.cleanName || c.originalName).toLowerCase();
    return l.includes('фото товару') || l.includes('фото') || l.includes('зображення') || l.includes('image');
  });
  const rawPhotoStr = photoCol ? String(row[photoCol.originalName] || '').trim() : '';

  const photoUrls = rawPhotoStr
    ? rawPhotoStr.split(';').map(u => u.trim()).filter(Boolean)
    : [];
  const firstPhotoUrl = photoUrls.length > 0 ? photoUrls[0] : undefined;

  // Find Title columns (works for "Назва товару*\n[ua]", "Назва товару [ua]*", "Назва товару", etc.)
  const titleUaCol =
    columns.find(c => c.lang === 'ua' && c.cleanName.toLowerCase().includes('назва')) ||
    columns.find(c => !c.lang && c.cleanName.toLowerCase().includes('назва'));
  const titleRuCol = columns.find(c => c.lang === 'ru' && c.cleanName.toLowerCase().includes('назва'));

  const titleUa = titleUaCol ? String(row[titleUaCol.originalName] || '').trim() : String(row['Назва товару [ua]*'] || row['Назва товару*\n[ua]'] || row['Назва товару'] || '').trim();
  const titleRu = titleRuCol ? String(row[titleRuCol.originalName] || '').trim() : String(row['Назва товару [ru]*'] || row['Назва товару*\n[ru]'] || '').trim();

  // Find Description columns (works with or without [ua]/[ru] or multiline headers)
  const descUaCol =
    columns.find(c => c.lang === 'ua' && c.cleanName.toLowerCase().includes('опис')) ||
    columns.find(c => !c.lang && c.cleanName.toLowerCase().includes('опис'));
  const descRuCol = columns.find(c => c.lang === 'ru' && c.cleanName.toLowerCase().includes('опис'));

  const descUaRaw = descUaCol ? String(row[descUaCol.originalName] || '') : String(row['Опис [ua]*'] || row['Опис (text)\n[ua]'] || row['Опис'] || '');
  const descRuRaw = descRuCol ? String(row[descRuCol.originalName] || '') : String(row['Опис [ru]*'] || row['Опис (text)\n[ru]'] || '');

  const descUa = stripHtmlToCleanText(descUaRaw);
  const descRu = stripHtmlToCleanText(descRuRaw);

  // Also gather any other already-filled text/characteristic values in the row for cross-column inference
  const otherFilledText = Object.entries(row)
    .filter(([k, v]) => {
      if (v === undefined || v === null || String(v).trim() === '') return false;
      const kl = k.toLowerCase();
      if (kl === 'id' || kl.includes('фото') || kl.includes('ціна')) return false;
      return true;
    })
    .map(([, v]) => stripHtmlToCleanText(String(v)))
    .join(' \n ');

  // Combined clean lowercase text from BOTH titles and descriptions!
  const combinedDesc = `${titleUa} \n ${titleRu} \n ${descUa} \n ${descRu} \n ${otherFilledText}`.toLowerCase();

  // Find SKU
  const skuCol = columns.find(c => c.cleanName.toLowerCase().includes('артикул') || c.cleanName.toLowerCase() === 'sku');
  const sku = skuCol ? String(row[skuCol.originalName] || '').trim() : '';

  // Analyze Visual Properties (Color, Pattern, Materials)
  let detectedPrimaryColor = '';
  let detectedManufacturerColor = '';
  let hasPattern = false;
  let patternType = 'без візерунка (однотонний)';

  if (
    combinedDesc.includes('принт') ||
    combinedDesc.includes('смуж') ||
    combinedDesc.includes('клітин') ||
    combinedDesc.includes('візерун') ||
    combinedDesc.includes('орнамент') ||
    combinedDesc.includes('малюнк') ||
    combinedDesc.includes('малюнок')
  ) {
    hasPattern = true;
    patternType = 'з візерунком';
  }

  // Color detection
  const colorMap: Array<{ keywords: string[]; primary: string; manufacturer: string }> = [
    { keywords: ['різнокольоров', 'разноцветн', 'мультиколор', 'multicolor'], primary: 'різнокольоровий', manufacturer: 'Різнокольоровий' },
    { keywords: ['чорно-червон', 'червоно-чорн', 'black/red'], primary: 'чорний', manufacturer: 'Black/Red' },
    { keywords: ['вугільно-чорн', 'carbon black', 'чорний', 'чорна', 'чорне', 'черный', 'черная'], primary: 'чорний', manufacturer: 'Чорний' },
    { keywords: ['рожев', 'розов', 'sakura pink', 'pink'], primary: 'рожевий', manufacturer: 'Рожевий' },
    { keywords: ['білий', 'біла', 'біле', 'белый', 'белая', 'white'], primary: 'білий', manufacturer: 'Білий' },
    { keywords: ['смарагдов', 'зелен', 'emerald', 'green', 'хакі', 'оливков'], primary: 'зелений', manufacturer: 'Зелений' },
    { keywords: ['синій', 'синя', 'синє', 'синий', 'блакитн', 'голуб', 'blue', 'navy', 'індиго'], primary: 'синій', manufacturer: 'Синій' },
    { keywords: ['червон', 'красн', 'бордов', 'red'], primary: 'червоний', manufacturer: 'Червоний' },
    { keywords: ['жовт', 'желт', 'yellow'], primary: 'жовтий', manufacturer: 'Жовтий' },
    { keywords: ['помаранчев', 'оранжев', 'orange'], primary: 'помаранчевий', manufacturer: 'Помаранчевий' },
    { keywords: ['фіолетов', 'фиолетов', 'бузков', 'лавандов', 'purple', 'violet'], primary: 'фіолетовий', manufacturer: 'Фіолетовий' },
    { keywords: ['коричнев', 'бежев', 'пісочн', 'кавов', 'шоколадн', 'brown', 'beige'], primary: 'коричневий', manufacturer: 'Коричневий' },
    { keywords: ['золот', 'gold'], primary: 'золотистий', manufacturer: 'Gold' },
    { keywords: ['срібл', 'срібляст', 'серебр', 'silver'], primary: 'сріблястий', manufacturer: 'Silver' },
    { keywords: ['сірий', 'сіра', 'сіре', 'серый', 'серая', 'графіт', 'антрацит', 'grey', 'gray'], primary: 'сірий', manufacturer: 'Сірий' }
  ];

  for (const cItem of colorMap) {
    if (cItem.keywords.some(kw => combinedDesc.includes(kw))) {
      detectedPrimaryColor = cItem.primary;
      detectedManufacturerColor = cItem.manufacturer;
      break;
    }
  }

  // Packaging unit: 'шт.', 'компл.', 'уп.'
  let unitValue = 'шт.';
  if (combinedDesc.includes('комплект') || combinedDesc.includes('набір') || combinedDesc.includes('set')) {
    unitValue = 'компл.';
  } else if (combinedDesc.includes('упаковк') || combinedDesc.includes('пачк') || combinedDesc.includes('pack')) {
    unitValue = 'уп.';
  }

  // Parse 3D / 2D dimensions & explicit dimensions from text
  const parsedDimensions = extractDimensionsFromText(combinedDesc);
  const parsedWeightGrams = extractWeightGramsFromText(combinedDesc);
  const parsedAge = extractAgeFromText(combinedDesc);
  const parsedPlayers = extractPlayersFromText(combinedDesc);

  return {
    firstPhotoUrl,
    allPhotoUrls: photoUrls,
    titleUaColName: titleUaCol?.originalName || 'Назва товару [ua]*',
    titleRuColName: titleRuCol?.originalName || 'Назва товару [ru]*',
    titleUa,
    titleRu,
    descUa,
    descRu,
    combinedDesc,
    sku,
    detectedPrimaryColor,
    detectedManufacturerColor,
    hasPattern,
    patternType,
    unitValue,
    parsedDimensions,
    parsedWeightGrams,
    parsedAge,
    parsedPlayers
  };
}

/**
 * Extract dimensions in millimeters (heightMm, widthMm, depthMm, lengthMm) from product title & description.
 * Automatically converts cm -> mm and m -> mm.
 */
export function extractDimensionsFromText(text: string): {
  heightMm?: number;
  widthMm?: number;
  depthMm?: number;
  lengthMm?: number;
  rawDimensionTripletMm?: [number, number, number];
} {
  if (!text) return {};
  const result: {
    heightMm?: number;
    widthMm?: number;
    depthMm?: number;
    lengthMm?: number;
    rawDimensionTripletMm?: [number, number, number];
  } = {};

  const toMm = (valStr: string, unitStr?: string): number => {
    const num = parseFloat(valStr.replace(',', '.'));
    if (isNaN(num) || num <= 0) return 0;
    const u = (unitStr || '').toLowerCase().trim();
    if (u === 'м' || u === 'm') return Math.round(num * 1000);
    if (u === 'см' || u === 'cm' || u === 'сантиметрів' || u === 'сантиметра') return Math.round(num * 10);
    if (u === 'мм' || u === 'mm' || u === 'міліметрів') return Math.round(num);
    // If no unit specified: numbers <= 95 in packaging/product specs are almost always cm (e.g. 25x25x5)
    return num <= 95 ? Math.round(num * 10) : Math.round(num);
  };

  // 1. Check 3D triplet: e.g. "25х25х5 см", "30 x 20 x 6 см", "18,5*18,5*4,5 см", "250х200х50 мм", "25-20-5 см"
  const tripletRegex = /(\d+(?:[.,]\d+)?)\s*(?:см|мм|cm|mm)?\s*[xXхХ×*]\s*(\d+(?:[.,]\d+)?)\s*(?:см|мм|cm|mm)?\s*[xXхХ×*]\s*(\d+(?:[.,]\d+)?)\s*(мм|см|м|mm|cm)?/i;
  const tripletMatch = text.match(tripletRegex);
  if (tripletMatch) {
    const unit = tripletMatch[4];
    const d1 = toMm(tripletMatch[1], unit);
    const d2 = toMm(tripletMatch[2], unit);
    const d3 = toMm(tripletMatch[3], unit);
    if (d1 > 0 && d2 > 0 && d3 > 0) {
      result.rawDimensionTripletMm = [d1, d2, d3];
      // Standard convention for boxes/packaging: largest two are Height/Length & Width, smallest is Depth (Глибина)
      result.heightMm = d1;
      result.widthMm = d2;
      result.depthMm = d3;
      result.lengthMm = d1;
    }
  } else {
    // 2. Check 2D pair: e.g. "Розмір: 30х40 см", "25 x 25 см"
    const pairRegex = /(?:розмір[иа]?|габарит[иа]?|коробк[аи]|упаковк[аи]|пакуванн[яі]|формат)?[^0-9]{0,25}(\d+(?:[.,]\d+)?)\s*[xXхХ×*]\s*(\d+(?:[.,]\d+)?)\s*(мм|см|м|mm|cm)\b/i;
    const pairMatch = text.match(pairRegex);
    if (pairMatch) {
      const unit = pairMatch[3];
      const d1 = toMm(pairMatch[1], unit);
      const d2 = toMm(pairMatch[2], unit);
      if (d1 > 0 && d2 > 0) {
        result.heightMm = d1;
        result.widthMm = d2;
        result.lengthMm = d1;
      }
    }
  }

  // 3. Explicit labeled dimensions override if present in text
  const heightMatch = text.match(/(?:висота|высота)(?:\s*упаковки|\s*коробки|\s*товару)?[\s:=-]*(\d+(?:[.,]\d+)?)\s*(мм|см|м|mm|cm)?/i);
  if (heightMatch) {
    const v = toMm(heightMatch[1], heightMatch[2]);
    if (v > 0) result.heightMm = v;
  }

  const widthMatch = text.match(/(?:ширина)(?:\s*упаковки|\s*коробки|\s*товару)?[\s:=-]*(\d+(?:[.,]\d+)?)\s*(мм|см|м|mm|cm)?/i);
  if (widthMatch) {
    const v = toMm(widthMatch[1], widthMatch[2]);
    if (v > 0) result.widthMm = v;
  }

  const depthMatch = text.match(/(?:глибина|глубина|товщина|толщина)(?:\s*упаковки|\s*коробки|\s*товару)?[\s:=-]*(\d+(?:[.,]\d+)?)\s*(мм|см|м|mm|cm)?/i);
  if (depthMatch) {
    const v = toMm(depthMatch[1], depthMatch[2]);
    if (v > 0) result.depthMm = v;
  }

  const lengthMatch = text.match(/(?:довжина|длина)(?:\s*упаковки|\s*коробки|\s*товару)?[\s:=-]*(\d+(?:[.,]\d+)?)\s*(мм|см|м|mm|cm)?/i);
  if (lengthMatch) {
    const v = toMm(lengthMatch[1], lengthMatch[2]);
    if (v > 0) {
      result.lengthMm = v;
      if (!result.depthMm && result.heightMm && result.widthMm) {
        result.depthMm = v;
      }
    }
  }

  return result;
}

/**
 * Extract weight in grams from product title & description.
 * Automatically converts kg -> g.
 */
export function extractWeightGramsFromText(text: string): number | undefined {
  if (!text) return undefined;

  const parseWeight = (numStr: string, unitStr: string): number | undefined => {
    const num = parseFloat(numStr.replace(',', '.'));
    if (isNaN(num) || num <= 0) return undefined;
    const u = unitStr.toLowerCase().trim();
    if (u === 'кг' || u === 'kg' || u.startsWith('кілограм')) {
      return Math.round(num * 1000);
    }
    return Math.round(num);
  };

  // 1. Labeled weight: "Вага: 350 г", "Вага в упаковці: 0,45 кг", "Вес: 280 гр"
  const labeledMatch = text.match(/(?:вага|вес|маса|масса)(?:\s*в\s*упаковці|\s*упаковки|\s*товару|\s*брутто|\s*нетто)?[\s:=-]*(\d+(?:[.,]\d+)?)\s*(кг|г|гр|грам|грами|грамів|kg|g)\b/i);
  if (labeledMatch) {
    const w = parseWeight(labeledMatch[1], labeledMatch[2]);
    if (w && w >= 5 && w <= 200000) return w;
  }

  // 2. Unlabeled weight with explicit unit: "350 г", "420 гр", "0.5 кг"
  const generalMatches = Array.from(text.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(кг|гр|грам|грами|грамів|г|kg)\b/gi));
  for (const m of generalMatches) {
    const w = parseWeight(m[1], m[2]);
    if (w && w >= 10 && w <= 100000) {
      return w;
    }
  }

  return undefined;
}

/**
 * Extract child's recommended minimum age (and optional max age) from product title & description.
 */
export function extractAgeFromText(text: string): {
  minAge?: number;
  maxAge?: number;
  isMonths?: boolean;
  formattedUa?: string;
} {
  if (!text) return {};

  // 1. Months: "від 6 місяців", "від 12 міс"
  const monthsMatch = text.match(/від\s*(\d{1,2})\s*(?:місяців|місяця|міс\.?)\b/i);
  if (monthsMatch) {
    const m = parseInt(monthsMatch[1], 10);
    return {
      minAge: m,
      isMonths: true,
      formattedUa: `від ${m} місяців`
    };
  }

  // 2. "від 3 років", "від 6-ти років", "від 5 до 10 років", "от 4 лет", "для дітей від 6 р."
  const fromYearsMatch = text.match(/(?:від|от|з)\s*(\d{1,2})(?:[-–—]ти)?\s*(?:(?:до|[-–—])\s*(\d{1,2})\s*)?(?:років|року|рік|р\.|лет|год[ао]?в?)\b/i);
  if (fromYearsMatch) {
    const minAge = parseInt(fromYearsMatch[1], 10);
    const maxAge = fromYearsMatch[2] ? parseInt(fromYearsMatch[2], 10) : undefined;
    if (minAge >= 0 && minAge <= 99) {
      return {
        minAge,
        maxAge,
        formattedUa: minAge === 1 ? 'від 1 року' : `від ${minAge} років`
      };
    }
  }

  // 3. Labeled age: "Вік: 6+", "Вік дитини: 8 років", "Возраст: 5+", "Рекомендований вік: 3-6 років", "Вік - від 4"
  const labeledAgeMatch = text.match(/(?:вік(?:\s*дитини)?|возраст|рекомендований\s*вік|дітям|для\s*дітей)[\s:=-]*(?:від\s*|от\s*)?(\d{1,2})\s*(?:[-–—]\s*(\d{1,2}))?\s*(?:\+|років|року|рік|р\.|лет)?/i);
  if (labeledAgeMatch) {
    const minAge = parseInt(labeledAgeMatch[1], 10);
    const maxAge = labeledAgeMatch[2] ? parseInt(labeledAgeMatch[2], 10) : undefined;
    if (minAge >= 0 && minAge <= 21) {
      return {
        minAge,
        maxAge,
        formattedUa: minAge === 1 ? 'від 1 року' : `від ${minAge} років`
      };
    }
  }

  // 4. Range of years: "3-5 років", "6 - 10 років", "4+ років"
  const rangeYearsMatch = text.match(/\b(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*(?:років|року|р\.|лет)\b/i);
  if (rangeYearsMatch) {
    const minAge = parseInt(rangeYearsMatch[1], 10);
    const maxAge = parseInt(rangeYearsMatch[2], 10);
    if (minAge >= 0 && minAge <= 18 && maxAge >= minAge && maxAge <= 99) {
      return {
        minAge,
        maxAge,
        formattedUa: minAge === 1 ? 'від 1 року' : `від ${minAge} років`
      };
    }
  }

  // 5. Plus notation in title or text: "3+", "4+", "5+", "6+", "7+", "8+", "9+", "10+", "12+", "14+", "16+", "18+"
  const plusMatch = text.match(/(?<![0-9.,])(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|18)\s*\+(?![0-9])/);
  if (plusMatch) {
    const minAge = parseInt(plusMatch[1], 10);
    return {
      minAge,
      formattedUa: minAge === 1 ? 'від 1 року' : `від ${minAge} років`
    };
  }

  // 6. Single year mention: "6 років", "5 років"
  const singleYearMatch = text.match(/\b(\d{1,2})\s*(?:років|року|рік|лет)\b/i);
  if (singleYearMatch) {
    const minAge = parseInt(singleYearMatch[1], 10);
    if (minAge >= 1 && minAge <= 18) {
      return {
        minAge,
        formattedUa: minAge === 1 ? 'від 1 року' : `від ${minAge} років`
      };
    }
  }

  return {};
}

/**
 * Extract number of players from board game / toy description & title.
 */
export function extractPlayersFromText(text: string): {
  minPlayers?: number;
  maxPlayers?: number;
  formatted?: string;
} {
  if (!text) return {};

  // 1. "Кількість гравців: 2-4", "Кількість гравців: від 2 до 6", "Количество игроков: 2 - 5"
  const labeledRange = text.match(/(?:кількість\s*гравців|количество\s*игроков|гравців|игроков|кількість\s*учасників)[\s:=-]*(?:від|от)?\s*(\d{1,2})\s*(?:[-–—]|до)\s*(\d{1,2})/i);
  if (labeledRange) {
    const minP = parseInt(labeledRange[1], 10);
    const maxP = parseInt(labeledRange[2], 10);
    if (minP >= 1 && maxP >= minP && maxP <= 30) {
      return { minPlayers: minP, maxPlayers: maxP, formatted: `${minP}-${maxP}` };
    }
  }

  // 2. "від 2 до 4 гравців", "для 2-6 гравців", "2-4 гравці", "2 - 4 игроков"
  const playersRange = text.match(/(?:від\s*|для\s*)?(\d{1,2})\s*(?:[-–—]|до)\s*(\d{1,2})\s*(?:гравців|гравці|гравця|игроков|игрока|учасників|осіб|чол)/i);
  if (playersRange) {
    const minP = parseInt(playersRange[1], 10);
    const maxP = parseInt(playersRange[2], 10);
    if (minP >= 1 && maxP >= minP && maxP <= 30) {
      return { minPlayers: minP, maxPlayers: maxP, formatted: `${minP}-${maxP}` };
    }
  }

  // 3. Single labeled player count: "Кількість гравців: 2", "Кількість гравців: від 2", "від 2 гравців"
  const singleLabeled = text.match(/(?:кількість\s*гравців|количество\s*игроков)[\s:=-]*(?:від\s*|от\s*)?(\d{1,2})\+?/i);
  if (singleLabeled) {
    const p = parseInt(singleLabeled[1], 10);
    if (p >= 1 && p <= 20) {
      return { minPlayers: p, formatted: p === 1 ? '1' : `від ${p}` };
    }
  }

  const fromPlayers = text.match(/від\s*(\d{1,2})\s*(?:гравців|игроков|учасників)/i);
  if (fromPlayers) {
    const p = parseInt(fromPlayers[1], 10);
    if (p >= 1 && p <= 20) {
      return { minPlayers: p, formatted: `від ${p}` };
    }
  }

  return {};
}

/**
 * Execute full Epicentr template filling pipeline according to official rules.
 */
export function runEpicentrFillingEngine(
  rows: Record<string, any>[],
  columns: EpicentrColumn[],
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  settings: ProcessSettings
): {
  processedRows: EpicentrProductRow[];
  report: ProcessingReportSummary;
} {
  const processedRows: EpicentrProductRow[] = [];
  const brandsMarkedOther: ProcessingReportSummary['brandsMarkedOther'] = [];
  const conflictsFound: ProcessingReportSummary['conflictsFound'] = [];
  const languageFixes: ProcessingReportSummary['languageFixes'] = [];
  const errors: EngineErrorEvent[] = [];

  // Phase 1: Column Analysis & ID validation
  const { col: idCol, isExplicitId } = findIdColumn(columns);
  if (idCol) {
    errors.push({
      id: `info-id-prot-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'info',
      phase: 'column_analysis',
      columnName: idCol.originalName,
      message: isExplicitId
        ? 'Колонку ID успішно виявлено та заблоковано від модифікацій'
        : `Ідентифікація товарів за колонкою "${idCol.cleanName || idCol.originalName}" (режим захисту)`,
      technicalDetails: `Позиція: стовпчик #${idCol.colIndex + 1}. Режим захисту: Read-Only (імпорт не порушиться).`
    });
  }

  let totalMandatoryFields = 0;
  let alreadyFilledCount = 0;
  let newlyFilledCount = 0;
  let unfilledMandatoryCount = 0;

  const unfilledCountsMap: Record<string, { count: number; affectedIds: string[]; reason: string }> = {};

  rows.forEach((row, rowIdx) => {
    try {
      // 1. Identify Product ID (Protected)
      const idKey =
        (idCol && row[idCol.originalName] !== undefined && String(row[idCol.originalName]).trim() !== ''
          ? idCol.originalName
          : Object.keys(row).find(
              k =>
                isExplicitIdColumnName(k) ||
                k.trim().toLowerCase().includes('артикул') ||
                k.trim().toLowerCase() === 'sku'
            )) ||
        idCol?.originalName ||
        'ID';
      const productId = String(row[idKey] || `ROW-${rowIdx + 1}`);

      const updatedRow = { ...row };
      const diffs: Record<string, EpicentrValueDiff> = {};
      const conflicts: EpicentrProductRow['conflicts'] = [];
      const languageCorrections: EpicentrProductRow['languageCorrections'] = [];
      const unfilledRequiredFields: string[] = [];

      // Visuals, Titles, and Descriptions analysis
      const visuals = analyzeProductVisualsAndText(row, columns);

      // Diagnostic check: Photo URL validation (Фото не є обов'язковим)
      const photoCol = columns.find(c => {
        const lower = (c.cleanName || c.originalName).toLowerCase();
        return lower.includes('фото') || lower.includes('зображення') || lower.includes('photo') || lower.includes('image');
      });

      if (photoCol && visuals.firstPhotoUrl) {
        if (visuals.firstPhotoUrl.startsWith('http://')) {
          errors.push({
            id: `err-photo-http-${productId}`,
            timestamp: new Date().toISOString(),
            severity: 'warning',
            phase: 'photo_parsing',
            rowIdx,
            productId,
            columnName: photoCol.originalName,
            message: 'Фото використовує незахищений протокол HTTP замість HTTPS',
            technicalDetails: `URL: ${visuals.firstPhotoUrl}. Маркетплейс Епіцентр блокує завантаження HTTP-зображень через mixed content.`,
            remediation: 'Замініть протокол на https:// для коректного імпорту візуального контенту.'
          });
        } else if (visuals.allPhotoUrls.length > 1) {
          errors.push({
            id: `info-photo-first-${productId}`,
            timestamp: new Date().toISOString(),
            severity: 'info',
            phase: 'photo_parsing',
            rowIdx,
            productId,
            columnName: photoCol.originalName,
            message: `Виявлено ${visuals.allPhotoUrls.length} фото. Відповідно до регламенту взято перше фото`,
            technicalDetails: `Перше фото: ${visuals.firstPhotoUrl.substring(0, 60)}... Джерело базового кольору та візерунка.`
          });
        }
      }

      // Track brand
      let detectedBrand = '';
      let isBrandOther = false;

      // First pass: Language checks on text fields with [ua] or [ru] tags
      if (settings.autoFixLanguages) {
        columns.forEach(col => {
          if (col.lang && row[col.originalName]) {
            const valStr = String(row[col.originalName]).trim();
            if (valStr) {
              const check = detectLanguageMismatch(valStr, col.lang);
              if (check.hasMismatch) {
                updatedRow[col.originalName] = check.correctedText;
                languageCorrections.push({
                  columnName: col.originalName,
                  fromLang: col.lang === 'ru' ? 'ua' : 'ru',
                  toLang: col.lang,
                  originalText: valStr,
                  correctedText: check.correctedText
                });
                languageFixes.push({
                  rowIdx,
                  productId,
                  columnName: col.cleanName,
                  oldText: valStr,
                  newText: check.correctedText,
                  direction: check.direction
                });
              }
            }
          }
        });
      }

      // Step 2 & 3: Iterate through columns and fill empty MANDATORY ('*') and OPTIONAL fields when data is available in text
      columns.forEach(col => {
        // ID column is strictly protected
        if (
          (isExplicitId && idCol && col.originalName === idCol.originalName) ||
          isExplicitIdColumnName(col.cleanName) ||
          isExplicitIdColumnName(col.originalName)
        ) {
          return;
        }

        const existingVal = row[col.originalName];
        const hasExistingVal = existingVal !== undefined && existingVal !== null && String(existingVal).trim() !== '';

        // Фото не є обов'язковим для заповнення
        const isPhotoCol =
          col.cleanName.toLowerCase().includes('фото') ||
          col.originalName.toLowerCase().includes('фото') ||
          col.cleanName.toLowerCase().includes('зображення') ||
          col.cleanName.toLowerCase().includes('photo') ||
          col.cleanName.toLowerCase().includes('image');

        if (isPhotoCol) {
          if (hasExistingVal) {
            diffs[col.originalName] = {
              colIndex: col.colIndex,
              columnName: col.originalName,
              isRequired: false,
              type: col.type,
              oldValue: String(existingVal),
              newValue: String(existingVal),
              source: 'already_filled',
              confidence: 1.0,
              note: 'Фото товару (опціональне поле)'
            };
          }
          return;
        }

        if (col.isRequired) {
          totalMandatoryFields++;
        }

        if (hasExistingVal) {
          if (col.isRequired) {
            alreadyFilledCount++;
          }
          diffs[col.originalName] = {
            colIndex: col.colIndex,
            columnName: col.originalName,
            isRequired: col.isRequired,
            type: col.type,
            oldValue: String(existingVal),
            newValue: String(existingVal),
            source: 'already_filled',
            confidence: 1.0,
            note: col.isRequired
              ? 'Вже заповнено у шаблоні — захищено від змін'
              : 'Необов\'язкове поле — заповнено користувачем'
          };
          return;
        }

        const cleanKey = normalizeAttributeKey(col.cleanName || col.originalName, false);
        const normKeyNoUnit = normalizeAttributeKey(col.cleanName || col.originalName, true);
        const dictAttr = findDictionaryAttr(dictionaryIndex, col.cleanName || col.originalName);

        // Skip primary system text/price fields if they are not characteristics
        if (
          normKeyNoUnit === 'артикул' ||
          normKeyNoUnit.startsWith('назва товару') ||
          normKeyNoUnit.startsWith('опис') ||
          normKeyNoUnit === 'ціна' ||
          normKeyNoUnit === 'наявність' ||
          normKeyNoUnit === 'категорія'
        ) {
          if (col.isRequired) {
            unfilledMandatoryCount++;
            unfilledRequiredFields.push(col.originalName);
          }
          return;
        }

        // Field is currently EMPTY (mandatory or optional). Try to fill it from context/synonyms/dictionary!
        let filledValue: string | null = null;
        let source: EpicentrValueDiff['source'] = 'description';
        let confidence = 0.95;
        let note = '';

        // 1. BRAND (select)
        if (normKeyNoUnit.includes('бренд') || normKeyNoUnit.includes('brand') || normKeyNoUnit === 'виробник') {
          const brandDict = dictAttr || dictionaryIndex['бренд'];
          let foundBrand = '';

          if (brandDict) {
            for (const brandVal of brandDict.allowedValues) {
              if (brandVal.toLowerCase() === 'інше') continue;
              const decodedBrand = decodeHtmlEntities(brandVal).toLowerCase();
              if (decodedBrand.length >= 2 && visuals.combinedDesc.includes(decodedBrand)) {
                foundBrand = brandVal;
                break;
              }
            }

            if (!foundBrand && col.isRequired && settings.brandFallbackOther && brandDict.allowedValues.some(v => v.toLowerCase() === 'інше')) {
              foundBrand = 'Інше';
              isBrandOther = true;
              brandsMarkedOther.push({
                rowIdx,
                productId,
                title: visuals.titleUa || `Товар #${rowIdx + 1}`,
                originalBrand: 'Не знайдено у довіднику'
              });
              note = 'Бренд відсутній у довіднику — встановлено "Інше"';
            }
          } else {
            // Try common Ukrainian/international brands in text
            const knownBrands = ['Strateg', 'Vladi Toys', 'Danko Toys', 'Ranok', 'Trefl', 'Ravensburger', 'Hasbro', 'Mattel', 'LEGO', 'Spin Master', 'Piatnik', 'Bombat Game', 'Feelindigo', 'Lord of Boards', 'Geekach', 'Rozum', 'IgroMag', 'Goki', 'Melissa & Doug'];
            const matchedBrand = knownBrands.find(b => visuals.combinedDesc.includes(b.toLowerCase()));
            if (matchedBrand) {
              foundBrand = matchedBrand;
            }
          }

          if (foundBrand) {
            filledValue = foundBrand;
            detectedBrand = foundBrand;
            source = 'description';
          }
        }

        // 2. CHILD AGE ("Вік дитини", "Вік", "Рекомендований вік")
        else if (normKeyNoUnit === 'вік дитини' || normKeyNoUnit === 'вік' || normKeyNoUnit.includes('рекомендований вік')) {
          const minAge = visuals.parsedAge.minAge;
          const maxAge = visuals.parsedAge.maxAge;
          const formattedAge = visuals.parsedAge.formattedUa;

          if (dictAttr && dictAttr.allowedValues.length > 0) {
            if (minAge !== undefined) {
              // Try exact "від X років" or "X років" or "X+" in dictionary
              const candidates = [
                `від ${minAge} років`,
                `від ${minAge} року`,
                `${minAge} років`,
                `${minAge} роки`,
                `${minAge} рік`,
                `${minAge}+`
              ];
              for (const cand of candidates) {
                const matched = matchDictionaryValue(dictAttr, cand);
                if (matched) {
                  filledValue = matched;
                  break;
                }
              }

              // If multiselect and dictionary has range of ages, collect matching ages
              if (!filledValue && col.type === 'multiselect' && maxAge !== undefined) {
                const matchedAges: string[] = [];
                for (let a = minAge; a <= Math.min(maxAge, minAge + 6); a++) {
                  const m =
                    matchDictionaryValue(dictAttr, `${a} років`) ||
                    matchDictionaryValue(dictAttr, `${a} роки`) ||
                    matchDictionaryValue(dictAttr, `від ${a} років`);
                  if (m && !matchedAges.includes(m)) matchedAges.push(m);
                }
                if (matchedAges.length > 0) {
                  filledValue = matchedAges.join('; ');
                }
              }

              // Fallback: check any allowed value containing the number minAge
              if (!filledValue) {
                const regexNum = new RegExp(`\\b${minAge}\\b`);
                const byNumber = dictAttr.allowedValues.find(v => regexNum.test(v));
                if (byNumber) filledValue = byNumber;
              }
            }

            // Also check direct text match against dictionary allowedValues
            if (!filledValue) {
              const matchedList = dictAttr.allowedValues.filter(v => {
                const dv = decodeHtmlEntities(v).toLowerCase();
                return dv.length >= 3 && visuals.combinedDesc.includes(dv);
              });
              if (matchedList.length > 0) {
                filledValue = col.type === 'multiselect' ? matchedList.slice(0, 5).join('; ') : matchedList[0];
              }
            }
          } else if (formattedAge) {
            filledValue = formattedAge;
          }

          if (filledValue) {
            source = 'description';
            note = 'Вік дитини визначено з назви/опису товару';
          }
        }

        // 3. AGE GROUP ("Вікова група", "Вікова категорія")
        else if (normKeyNoUnit.includes('вікова група') || normKeyNoUnit.includes('вікова категорія')) {
          const isAdult =
            (visuals.combinedDesc.includes('для дорослих') ||
              visuals.combinedDesc.includes('18+') ||
              visuals.combinedDesc.includes('жіноч') ||
              visuals.combinedDesc.includes('чоловіч')) &&
            !visuals.combinedDesc.includes('дит');
          const targetGroup = isAdult ? 'для дорослих' : 'для дітей';
          filledValue = dictAttr ? matchDictionaryValue(dictAttr, targetGroup) || targetGroup : targetGroup;
          source = 'description';
          note = 'Вікову групу визначено за контекстом товару';
        }

        // 4. GENDER & CHILD GENDER ("Стать", "Стать дитини")
        else if (normKeyNoUnit === 'стать' || normKeyNoUnit.includes('стать дитини')) {
          const hasGirl =
            visuals.combinedDesc.includes('дівчат') ||
            visuals.combinedDesc.includes('дівчин') ||
            visuals.combinedDesc.includes('девоч') ||
            visuals.combinedDesc.includes('принцес') ||
            visuals.combinedDesc.includes('ляльк');
          const hasBoy =
            visuals.combinedDesc.includes('хлопч') ||
            visuals.combinedDesc.includes('хлопц') ||
            visuals.combinedDesc.includes('мальчик');
          const hasWomen =
            visuals.combinedDesc.includes('жіноч') ||
            visuals.combinedDesc.includes('для жінок') ||
            visuals.combinedDesc.includes('женск');
          const hasMen =
            visuals.combinedDesc.includes('чоловіч') ||
            visuals.combinedDesc.includes('для чоловіків') ||
            visuals.combinedDesc.includes('мужск');

          let candidateGenders: string[] = [];
          if (normKeyNoUnit.includes('дитини')) {
            if (hasGirl && !hasBoy) {
              candidateGenders = ['для дівчаток', 'дівчинка'];
            } else if (hasBoy && !hasGirl) {
              candidateGenders = ['для хлопчиків', 'хлопчик'];
            } else {
              // Both or universal children's product (board games, puzzles, creativity sets)
              candidateGenders =
                col.type === 'multiselect'
                  ? ['для хлопчиків; для дівчаток', 'унісекс']
                  : ['унісекс', 'для хлопчиків та дівчаток', 'для дівчаток; для хлопчиків'];
            }
          } else {
            if (hasGirl && !hasBoy) {
              candidateGenders = ['для дівчаток', 'жіноча'];
            } else if (hasBoy && !hasGirl) {
              candidateGenders = ['для хлопчиків', 'чоловіча'];
            } else if (hasWomen && !hasMen) {
              candidateGenders = ['для жінок', 'жіноча', 'жіночий'];
            } else if (hasMen && !hasWomen) {
              candidateGenders = ['для чоловіків', 'чоловіча', 'чоловічий'];
            } else {
              candidateGenders =
                col.type === 'multiselect'
                  ? ['унісекс', 'для хлопчиків; для дівчаток']
                  : ['унісекс', 'для хлопчиків та дівчаток'];
            }
          }

          if (dictAttr && dictAttr.allowedValues.length > 0) {
            if (col.type === 'multiselect' && ((hasGirl && hasBoy) || (!hasGirl && !hasBoy))) {
              const boyOpt = matchDictionaryValue(dictAttr, 'для хлопчиків');
              const girlOpt = matchDictionaryValue(dictAttr, 'для дівчаток');
              const unisexOpt = matchDictionaryValue(dictAttr, 'унісекс');
              if (boyOpt && girlOpt) {
                filledValue = `${boyOpt}; ${girlOpt}`;
              } else if (unisexOpt) {
                filledValue = unisexOpt;
              }
            }
            if (!filledValue) {
              for (const cand of candidateGenders) {
                const m = matchDictionaryValue(dictAttr, cand);
                if (m) {
                  filledValue = m;
                  break;
                }
              }
            }
          } else {
            filledValue = candidateGenders[0];
          }

          if (filledValue) {
            source = 'description';
            note = 'Стать визначено за контекстом назви та опису';
          }
        }

        // 5. PACKAGING & PRODUCT DIMENSIONS ("Висота упаковки (мм)", "Ширина упаковки (мм)", "Глибина упаковки (мм)", "Довжина упаковки (мм)")
        else if (
          normKeyNoUnit.includes('висота упаковки') ||
          normKeyNoUnit.includes('ширина упаковки') ||
          normKeyNoUnit.includes('глибина упаковки') ||
          normKeyNoUnit.includes('довжина упаковки') ||
          normKeyNoUnit === 'висота' ||
          normKeyNoUnit === 'ширина' ||
          normKeyNoUnit === 'глибина' ||
          normKeyNoUnit === 'довжина' ||
          normKeyNoUnit === 'розмір упаковки' ||
          normKeyNoUnit === 'розміри упаковки'
        ) {
          const dims = visuals.parsedDimensions;
          const isCmTarget = col.unit === 'см' || cleanKey.includes('(см)');
          const formatDim = (mmVal?: number): string | null => {
            if (!mmVal || mmVal <= 0) return null;
            if (isCmTarget) {
              return String(Number((mmVal / 10).toFixed(1)));
            }
            return String(Math.round(mmVal));
          };

          if (normKeyNoUnit.includes('висота')) {
            filledValue = formatDim(dims.heightMm);
          } else if (normKeyNoUnit.includes('ширина')) {
            filledValue = formatDim(dims.widthMm);
          } else if (normKeyNoUnit.includes('глибина')) {
            filledValue = formatDim(dims.depthMm);
          } else if (normKeyNoUnit.includes('довжина')) {
            filledValue = formatDim(dims.lengthMm || dims.heightMm);
          } else if (normKeyNoUnit.includes('розмір упаковки') || normKeyNoUnit.includes('розміри упаковки')) {
            if (dims.heightMm && dims.widthMm && dims.depthMm) {
              filledValue = isCmTarget
                ? `${dims.heightMm / 10}х${dims.widthMm / 10}х${dims.depthMm / 10} см`
                : `${dims.heightMm}х${dims.widthMm}х${dims.depthMm} мм`;
            } else if (dims.heightMm && dims.widthMm) {
              filledValue = isCmTarget
                ? `${dims.heightMm / 10}х${dims.widthMm / 10} см`
                : `${dims.heightMm}х${dims.widthMm} мм`;
            }
          }

          if (filledValue) {
            source = 'description';
            note = 'Габарити витягнуто з тексту опису/назви з автоматичним перерахунком одиниць (см -> мм)';
          }
        }

        // 6. PACKAGING & PRODUCT WEIGHT ("Вага упаковки (г)", "Вага", "Вага в упаковці")
        else if (normKeyNoUnit.includes('вага')) {
          const weightG = visuals.parsedWeightGrams;
          if (weightG !== undefined && weightG > 0) {
            const isKgTarget = col.unit === 'кг' || cleanKey.includes('(кг)');
            filledValue = isKgTarget ? String(Number((weightG / 1000).toFixed(3))) : String(Math.round(weightG));
            source = 'description';
            note = 'Вагу витягнуто з опису/назви товару';
          }
        }

        // 7. NUMBER OF PLAYERS ("Кількість гравців")
        else if (normKeyNoUnit.includes('кількість гравців') || normKeyNoUnit.includes('гравців')) {
          const pInfo = visuals.parsedPlayers;
          if (dictAttr && dictAttr.allowedValues.length > 0 && pInfo.formatted) {
            const matched =
              matchDictionaryValue(dictAttr, pInfo.formatted) ||
              (pInfo.minPlayers && pInfo.maxPlayers
                ? matchDictionaryValue(dictAttr, `від ${pInfo.minPlayers} до ${pInfo.maxPlayers}`) ||
                  matchDictionaryValue(dictAttr, `${pInfo.minPlayers} - ${pInfo.maxPlayers}`)
                : null);
            if (matched) {
              filledValue = matched;
            } else if (col.type === 'multiselect' && pInfo.minPlayers && pInfo.maxPlayers) {
              const items: string[] = [];
              for (let p = pInfo.minPlayers; p <= Math.min(pInfo.maxPlayers, pInfo.minPlayers + 6); p++) {
                const m = matchDictionaryValue(dictAttr, String(p));
                if (m && !items.includes(m)) items.push(m);
              }
              if (items.length > 0) filledValue = items.join('; ');
            }
          }

          if (!filledValue && pInfo.formatted) {
            filledValue = pInfo.formatted;
          }

          if (filledValue) {
            source = 'description';
            note = 'Кількість гравців визначено з опису/назви гри';
          }
        }

        // 8. GENRE & THEME ("Жанр", "Тематика", "Вид", "Призначення")
        else if (normKeyNoUnit === 'жанр' || normKeyNoUnit === 'тематика') {
          const genreRules: Array<{ keywords: string[]; value: string }> = [
            { keywords: ['розважальн', 'весел', 'вечірк', 'компані', 'гумор', 'мем'], value: 'розважальні' },
            { keywords: ['розвиваюч', 'навчальн', 'пізнавальн', 'освітн', 'вивчен', 'абетк', 'рахуван', 'пам\'ят', 'уваг', 'моторик'], value: 'розвиваючі' },
            { keywords: ['логічн', 'головоломк', 'інтелектуальн', 'шах', 'шашк', 'судоку', 'мислен'], value: 'логічні' },
            { keywords: ['стратегічн', 'стратегія', 'тактичн'], value: 'стратегічні' },
            { keywords: ['економічн', 'монополі', 'бізнес', 'фінанс', 'гроші'], value: 'економічні' },
            { keywords: ['картков', 'карти', 'карток', 'уно', 'uno', 'мафія', 'мемо', 'дуплет', 'доміно', 'лото'], value: 'карткові' },
            { keywords: ['сімейн', 'родинн', 'для всієї родини', 'для сім\'ї'], value: 'сімейні' },
            { keywords: ['пригодницьк', 'пригод', 'бродилк', 'квест', 'мандрівк', 'подорож'], value: 'пригодницькі' },
            { keywords: ['детектив', 'розслідуван'], value: 'детективні' },
            { keywords: ['вікторин', 'питання', 'ерудит'], value: 'вікторини' },
            { keywords: ['творч', 'малюван', 'розмальовк', 'картина за номерами', 'алмазна мозаїка', 'ліплен', 'тісто', 'слайм', 'бісер', 'гравюр', 'орігамі', 'аплікац'], value: 'творчість' }
          ];

          const matchedGenres: string[] = [];

          // First check dictionary directly with stem matching
          if (dictAttr && dictAttr.allowedValues.length > 0) {
            for (const allowedVal of dictAttr.allowedValues) {
              const decodedVal = decodeHtmlEntities(allowedVal).toLowerCase();
              const stem = decodedVal.replace(/(ий|ій|а|я|е|є|і|ї|ої|их|ім|им|ою)$/i, '');
              if (
                (decodedVal.length >= 3 && visuals.combinedDesc.includes(decodedVal)) ||
                (stem.length >= 4 && visuals.combinedDesc.includes(stem))
              ) {
                if (!matchedGenres.includes(allowedVal)) {
                  matchedGenres.push(allowedVal);
                }
              }
            }
          }

          // Second check heuristic keyword rules
          for (const rule of genreRules) {
            if (rule.keywords.some(kw => visuals.combinedDesc.includes(kw))) {
              if (dictAttr && dictAttr.allowedValues.length > 0) {
                const m = matchDictionaryValue(dictAttr, rule.value);
                if (m && !matchedGenres.includes(m)) matchedGenres.push(m);
              } else if (!matchedGenres.includes(rule.value)) {
                matchedGenres.push(rule.value);
              }
            }
          }

          // Fallback if it explicitly mentions a board game / puzzle / toy
          if (matchedGenres.length === 0 && (visuals.combinedDesc.includes('настільн') || visuals.combinedDesc.includes('гра ') || visuals.combinedDesc.includes('пазл') || visuals.combinedDesc.includes('іграшк'))) {
            const fallbackGenre = dictAttr
              ? matchDictionaryValue(dictAttr, 'розважальні') || matchDictionaryValue(dictAttr, 'розвиваючі') || dictAttr.allowedValues[0]
              : 'розважальні';
            if (fallbackGenre) matchedGenres.push(fallbackGenre);
          }

          if (matchedGenres.length > 0) {
            filledValue = col.type === 'multiselect' ? matchedGenres.slice(0, 3).join('; ') : matchedGenres[0];
            source = 'description';
            note = 'Жанр/тематику визначено за контекстом назви та опису';
          }
        }

        // 9. PRIMARY COLOR (select)
        else if (normKeyNoUnit === 'колір' || normKeyNoUnit === 'колір плафона' || normKeyNoUnit === 'базовий колір') {
          const colorDict = dictAttr || dictionaryIndex['колір'];
          if (visuals.detectedPrimaryColor) {
            filledValue = colorDict
              ? matchDictionaryValue(colorDict, visuals.detectedPrimaryColor) || visuals.detectedPrimaryColor
              : visuals.detectedPrimaryColor;
            source = 'photo';
            note = 'Визначено за першим фото та описом товару';
          }
        }

        // 10. MANUFACTURER COLOR (string)
        else if (normKeyNoUnit.includes('колір виробника')) {
          if (visuals.detectedManufacturerColor) {
            filledValue = visuals.detectedManufacturerColor;
            source = 'photo';
            note = 'Точний відтінок за фото та назвою';
          }
        }

        // 11. PATTERN (select)
        else if (normKeyNoUnit.includes('візерунок') || normKeyNoUnit.includes('узор') || normKeyNoUnit.includes('принт')) {
          const patternDict = dictAttr || dictionaryIndex['візерунок'];
          if (patternDict && (col.isRequired || visuals.patternType !== 'однотонний' || visuals.combinedDesc.includes('однотон'))) {
            filledValue = matchDictionaryValue(patternDict, visuals.patternType) || (col.isRequired ? visuals.patternType : null);
            source = 'photo';
            note = 'Візерунок визначено за фото/описом: ' + visuals.patternType;
          }
        }

        // 12. UNIT (select)
        else if (normKeyNoUnit.includes('одиниця виміру') || normKeyNoUnit.includes('одиниці виміру')) {
          const unitDict = dictAttr || dictionaryIndex['одиниця виміру'];
          filledValue = unitDict
            ? matchDictionaryValue(unitDict, visuals.unitValue) || (col.isRequired ? 'шт.' : visuals.unitValue)
            : visuals.unitValue;
          source = 'description';
          note = 'Одиниця виміру розрахована за типом упаковки';
        }

        // 13. COUNTRY OF ORIGIN ("Країна-виробник", "Країна реєстрації бренду")
        else if (normKeyNoUnit.includes('країна')) {
          const countryKeywords: Array<{ kw: string[]; val: string }> = [
            { kw: ['україна', 'українськ', 'украина', 'strateg', 'vladi toys', 'danko toys', 'ranok', 'bombat'], val: 'Україна' },
            { kw: ['китай', 'china', 'кнр'], val: 'Китай' },
            { kw: ['польща', 'польськ', 'poland', 'trefl'], val: 'Польща' },
            { kw: ['німеччина', 'германия', 'germany', 'ravensburger', 'goki'], val: 'Німеччина' },
            { kw: ['туреччина', 'турция', 'turkey'], val: 'Туреччина' },
            { kw: ['сша', 'usa', 'hasbro', 'mattel'], val: 'США' }
          ];
          for (const cRule of countryKeywords) {
            if (cRule.kw.some(k => visuals.combinedDesc.includes(k))) {
              filledValue = dictAttr ? matchDictionaryValue(dictAttr, cRule.val) || cRule.val : cRule.val;
              source = 'description';
              note = 'Країну визначено з опису/назви';
              break;
            }
          }
        }

        // 14. LANGUAGE ("Мова")
        else if (normKeyNoUnit === 'мова' || normKeyNoUnit.includes('мова гри') || normKeyNoUnit.includes('мова видання')) {
          let langCandidate = '';
          if (visuals.combinedDesc.includes('українськ') || visuals.combinedDesc.includes('укр.') || visuals.combinedDesc.includes('мова: українська')) {
            langCandidate = 'українська';
          } else if (visuals.combinedDesc.includes('англійськ') || visuals.combinedDesc.includes('english')) {
            langCandidate = 'англійська';
          } else if (visuals.combinedDesc.includes('російськ') || visuals.combinedDesc.includes('русск')) {
            langCandidate = 'російська';
          }
          if (langCandidate) {
            filledValue = dictAttr ? matchDictionaryValue(dictAttr, langCandidate) || langCandidate : langCandidate;
            source = 'description';
            note = 'Мову визначено з опису/назви';
          }
        }

        // 15. GENERAL MULTISELECT / SELECT / STRING / FLOAT ATTRIBUTES (Матеріал, Склад, Сезон, Фасон, Розмір, etc.)
        if (!filledValue) {
          if (dictAttr) {
            if (col.type === 'multiselect') {
              const matchedComponents: string[] = [];
              for (const allowedVal of dictAttr.allowedValues) {
                const decodedVal = decodeHtmlEntities(allowedVal).toLowerCase();
                const stem = decodedVal.replace(/(ий|ій|а|я|е|є|і|ї|ої|их|ім|им|ою)$/i, '');
                if (
                  (decodedVal.length >= 2 && visuals.combinedDesc.includes(decodedVal)) ||
                  (stem.length >= 4 && visuals.combinedDesc.includes(stem))
                ) {
                  matchedComponents.push(allowedVal);
                }
              }

              for (const [syn, targetVal] of Object.entries(COMMON_SYNONYMS)) {
                if (visuals.combinedDesc.includes(syn)) {
                  const m = matchDictionaryValue(dictAttr, targetVal);
                  if (m && !matchedComponents.includes(m)) {
                    matchedComponents.push(m);
                  }
                }
              }

              if (matchedComponents.length > 0) {
                filledValue = matchedComponents.join('; ');
                source = 'description';
                note = 'Мультиселект: значення об\'єднано через ";" за контекстом і синонімами';
              }
            } else if (col.type === 'select' || col.type === 'string') {
              for (const allowedVal of dictAttr.allowedValues) {
                const decodedVal = decodeHtmlEntities(allowedVal).toLowerCase();
                const stem = decodedVal.replace(/(ий|ій|а|я|е|є|і|ї|ої|их|ім|им|ою)$/i, '');
                if (
                  (decodedVal.length >= 2 && visuals.combinedDesc.includes(decodedVal)) ||
                  (stem.length >= 4 && visuals.combinedDesc.includes(stem))
                ) {
                  filledValue = allowedVal;
                  break;
                }
              }

              if (!filledValue) {
                for (const [syn, targetVal] of Object.entries(COMMON_SYNONYMS)) {
                  if (visuals.combinedDesc.includes(syn)) {
                    const m = matchDictionaryValue(dictAttr, targetVal);
                    if (m) {
                      filledValue = m;
                      break;
                    }
                  }
                }
              }

              if (filledValue) {
                source = 'description';
                note = 'Підібрано за описом/назвою та словником синонімів';
              }
            }
          }

          if (!filledValue && (normKeyNoUnit.includes('розмір') || normKeyNoUnit.includes('size'))) {
            const sizeMatch = visuals.combinedDesc.match(/розмір[иа]?\s*[:\-]?\s*([0-9]+(?:\s*,\s*[0-9]+)+)/i);
            if (sizeMatch && sizeMatch[1]) {
              filledValue = sizeMatch[1].replace(/\s*,\s*/g, '; ');
              source = 'description';
              note = 'Розміри нормалізовано через крапку з комою';
            }
          } else if (!filledValue && (normKeyNoUnit.includes('матеріал') || normKeyNoUnit.includes('склад'))) {
            const matKeywords: Array<{ kw: string; label: string }> = [
              { kw: 'картон', label: 'картон' },
              { kw: 'папір', label: 'папір' },
              { kw: 'дерев', label: 'дерево' },
              { kw: 'пластик', label: 'пластик' },
              { kw: 'пластмас', label: 'пластик' },
              { kw: 'полімер', label: 'полімер' },
              { kw: 'бавовн', label: 'бавовна' },
              { kw: 'котон', label: 'бавовна' },
              { kw: 'стрейч', label: 'стретч' },
              { kw: 'еластан', label: 'еластан' },
              { kw: 'поліестер', label: 'поліестер' },
              { kw: 'акрил', label: 'акрил' },
              { kw: 'метал', label: 'метал' },
              { kw: 'текстил', label: 'текстиль' },
              { kw: 'гум', label: 'гума' },
              { kw: 'силікон', label: 'силікон' }
            ];
            const foundMats: string[] = [];
            for (const mItem of matKeywords) {
              if (visuals.combinedDesc.includes(mItem.kw)) {
                const valToAdd = dictAttr ? matchDictionaryValue(dictAttr, mItem.label) || mItem.label : mItem.label;
                if (!foundMats.includes(valToAdd)) foundMats.push(valToAdd);
              }
            }
            if (foundMats.length > 0) {
              filledValue = col.type === 'multiselect' ? foundMats.join('; ') : foundMats[0];
              source = 'description';
              note = 'Матеріал визначено з опису/назви';
            }
          } else if (!filledValue && col.type === 'float') {
            if (normKeyNoUnit.includes('навантаження') && visuals.combinedDesc.match(/(\d+)\s*кг/)) {
              const m = visuals.combinedDesc.match(/(\d+)\s*кг/);
              if (m) filledValue = m[1];
              source = 'description';
            } else if (normKeyNoUnit.includes('кількість елементів') || normKeyNoUnit.includes('кількість деталей') || normKeyNoUnit.includes('кількість предметів')) {
              const m = visuals.combinedDesc.match(/(\d+)\s*(?:дет|елем|ел\.|шт|предм|частин)/i);
              if (m) {
                filledValue = m[1];
                source = 'description';
              }
            }
          }
        }

        // Finalize value check
        if (filledValue) {
          updatedRow[col.originalName] = filledValue;
          newlyFilledCount++;
          diffs[col.originalName] = {
            colIndex: col.colIndex,
            columnName: col.originalName,
            isRequired: col.isRequired,
            type: col.type,
            oldValue: '',
            newValue: filledValue,
            source,
            confidence,
            note: note || (col.isRequired ? 'Обов\'язкова характеристика з опису/назви' : 'Додаткова характеристика з опису/назви')
          };
        } else if (col.isRequired) {
          // Mandatory field could NOT be filled with sufficient confidence
          unfilledMandatoryCount++;
          unfilledRequiredFields.push(col.originalName);

          if (!unfilledCountsMap[col.cleanName]) {
            unfilledCountsMap[col.cleanName] = {
              count: 0,
              affectedIds: [],
              reason: 'Інформація відсутня в описі, на фото та в довіднику (суворе правило: краще порожнє, ніж невірне)'
            };
          }
          unfilledCountsMap[col.cleanName].count++;
          unfilledCountsMap[col.cleanName].affectedIds.push(productId);
        }
      });

      // Step 4: Product Title Reformatting (If confirmed by user settings)
      let titleFormattedUa = visuals.titleUa;
      let titleFormattedRu = visuals.titleRu;

      if (settings.reformatTitles) {
        if (titleFormattedUa) {
          titleFormattedUa = formatEpicentrTitle({
            rawTitle: titleFormattedUa,
            sku: visuals.sku,
            color: visuals.detectedManufacturerColor || visuals.detectedPrimaryColor,
            brand: detectedBrand || undefined,
            lang: 'ua'
          });
          updatedRow[visuals.titleUaColName] = titleFormattedUa;
        }

        if (titleFormattedRu) {
          titleFormattedRu = formatEpicentrTitle({
            rawTitle: titleFormattedRu,
            sku: visuals.sku,
            color: visuals.detectedManufacturerColor || visuals.detectedPrimaryColor,
            brand: detectedBrand || undefined,
            lang: 'ru'
          });
          updatedRow[visuals.titleRuColName] = titleFormattedRu;
        }
      }

    // Determine row status
    const status: EpicentrProductRow['status'] =
      conflicts.length > 0
        ? 'has_conflicts'
        : unfilledRequiredFields.length > 0
        ? 'missing_required'
        : 'valid';

    processedRows.push({
      rowIdx,
      id: productId,
      originalRow: row,
      updatedRow,
      diffs,
      titleOriginal: String(row['Назва товару [ua]*'] || `Товар #${rowIdx + 1}`),
      titleFormattedUa,
      titleFormattedRu,
      vendorCode: visuals.sku,
      brand: detectedBrand,
      isBrandOther,
      firstPhotoUrl: visuals.firstPhotoUrl,
      allPhotoUrls: visuals.allPhotoUrls,
      photoAnalysis: {
        primaryColor: visuals.detectedPrimaryColor,
        manufacturerColor: visuals.detectedManufacturerColor,
        hasPattern: visuals.hasPattern,
        patternType: visuals.patternType
      },
      status,
      unfilledRequiredFields,
      conflicts,
      languageCorrections
    });
  } catch (err: any) {
    errors.push({
      id: `crit-row-${rowIdx}-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'critical',
      phase: 'validation',
      rowIdx,
      productId: String(row['ID'] || `ROW-${rowIdx + 1}`),
      message: `Критична помилка обробки рядка #${rowIdx + 1}: ${err?.message || 'Невідомий збій'}`,
      technicalDetails: `Стек: ${err?.stack || 'N/A'}. Дані рядка: ${JSON.stringify(row).substring(0, 150)}...`,
      remediation: 'Перевірте наявність невалідно закодованих символів або пошкоджених комірок у вихідному Excel.'
    });
  }
  });

  const fillRate = totalMandatoryFields > 0
    ? Math.round(((alreadyFilledCount + newlyFilledCount) / totalMandatoryFields) * 100)
    : 100;

  const unfilledFieldsBreakdown = Object.entries(unfilledCountsMap).map(([colName, info]) => ({
    columnName: colName,
    unfilledCount: info.count,
    reason: info.reason,
    affectedProductIds: info.affectedIds
  }));

  const report: ProcessingReportSummary = {
    totalProducts: rows.length,
    totalColumns: columns.length,
    mandatoryColumnsCount: columns.filter(c => c.isRequired).length,
    totalMandatoryFields,
    alreadyFilledCount,
    newlyFilledCount,
    unfilledMandatoryCount,
    fillRatePercentage: fillRate,
    unfilledFieldsBreakdown,
    brandsMarkedOther,
    conflictsFound,
    languageFixes,
    errors
  };

  return { processedRows, report };
}

/**
 * Export workbook preserving original header comments, styles, and sheet properties.
 * Uses the copy of the original workbook structure as instructed by Epicentr guidelines.
 */
export function generateEpicentrExportWorkbook(
  originalWorkbook: XLSX.WorkBook | null,
  processedRows: EpicentrProductRow[],
  columns: EpicentrColumn[]
): XLSX.WorkBook {
  // If original workbook exists, deep clone it
  let wb: XLSX.WorkBook;

  if (originalWorkbook && originalWorkbook.SheetNames.length > 0) {
    wb = JSON.parse(JSON.stringify(originalWorkbook));
    const firstSheetName = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheetName];

    // Ensure all header comments are hidden so JSON metadata does not pop up in Excel
    columns.forEach((_, cIdx) => {
      const headerCellRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
      if (ws[headerCellRef] && Array.isArray(ws[headerCellRef].c)) {
        (ws[headerCellRef].c as any).hidden = true;
        ws[headerCellRef].c.forEach((comment: any) => {
          comment.hidden = true;
          comment.visible = false;
        });
      }
    });

    // Update cell data only, leaving row 1 (headers with comments and JSON metadata) completely intact!
    processedRows.forEach((pRow, rIdx) => {
      const excelRowNumber = rIdx + 2; // Row 1 is header
      columns.forEach((col, cIdx) => {
        const cellAddress = XLSX.utils.encode_cell({ r: excelRowNumber - 1, c: cIdx });
        const val = pRow.updatedRow[col.originalName] ?? '';
        
        // Preserve existing cell metadata if any
        if (!ws[cellAddress]) {
          ws[cellAddress] = { t: 's', v: String(val) };
        } else {
          ws[cellAddress].v = String(val);
          ws[cellAddress].t = typeof val === 'number' ? 'n' : 's';
        }
      });
    });

    // Update range
    const maxRow = processedRows.length + 1;
    const maxCol = columns.length;
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: maxRow - 1, c: maxCol - 1 }
    });
  } else {
    // Generate new valid workbook if no file was uploaded
    wb = XLSX.utils.book_new();
    const headers = columns.map(c => c.originalName);
    const dataRows = processedRows.map(p => {
      return columns.map(c => p.updatedRow[c.originalName] ?? '');
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    
    // Add header comments to preserve Epicentr metadata format (hidden by default)
    columns.forEach((col, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
      if (ws[cellRef]) {
        const comment: any = {
          a: 'EpicentrMarketplace',
          t: JSON.stringify({
            attributeCode: `ATTR_${col.colIndex}`,
            attributeType: col.type,
            isRequired: col.isRequired
          }),
          hidden: true,
          visible: false
        };
        const commentsList: any = [comment];
        commentsList.hidden = true;
        ws[cellRef].c = commentsList;
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Товари_Епіцентр');
  }

  // Final pass across all sheets to guarantee all cell comments remain hidden
  wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return;
    Object.keys(sheet).forEach(key => {
      if (key.startsWith('!')) return;
      const cell = sheet[key];
      if (cell && Array.isArray(cell.c)) {
        (cell.c as any).hidden = true;
        cell.c.forEach((comment: any) => {
          comment.hidden = true;
          comment.visible = false;
        });
      }
    });
  });

  return wb;
}
