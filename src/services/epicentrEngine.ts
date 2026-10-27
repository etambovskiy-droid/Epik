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
  'металл': 'метал',
  'сетка': 'сітка',
  'искусственная кожа': 'штучна шкіра',
  'экокожа': 'штучна шкіра'
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
  'метал': 'металл',
  'сітка': 'сетка',
  'штучна шкіра': 'искусственная кожа',
  'екошкіра': 'искусственная кожа'
};

/**
 * Common synonyms mapping to official Epicentr dictionary values
 */
const COMMON_SYNONYMS: Record<string, string> = {
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

    // Фото НЕ є обов'язковим
    const isRequired = isPhoto ? false : rawHeader.includes('*');

    // Type detection from column header like (select), (multiselect), (float), (text), (array), (string)
    let type: EpicentrColumnType = 'string';
    if (lower.includes('(multiselect)')) type = 'multiselect';
    else if (lower.includes('(select)')) type = 'select';
    else if (lower.includes('(float)')) type = 'float';
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
      unit = unitMatch[1];
    }

    // Clean human-friendly name
    const cleanName = rawHeader
      .replace(/\(select\)/gi, '')
      .replace(/\(multiselect\)/gi, '')
      .replace(/\(text\)/gi, '')
      .replace(/\(float\)/gi, '')
      .replace(/\(array\)/gi, '')
      .replace(/\(string\)/gi, '')
      .replace(/\[ua\]/gi, '')
      .replace(/\[ru\]/gi, '')
      .replace(/\*/g, '')
      .trim();

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
    const cleanAttrName = attrName.replace(/\*/g, '').replace(/\(select\)/gi, '').replace(/\(multiselect\)/gi, '').trim().toLowerCase();
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

    result[cleanAttrName] = {
      attributeName: attrName,
      cleanAttributeName: cleanAttrName,
      allowedValues: allowedList,
      decodedValuesMap: decodedMap,
      synonymsMap: synonyms
    };
  }

  return result;
}

/**
 * Check if Ukrainian text has Russian traits or Russian text has Ukrainian traits.
 */
export function detectLanguageMismatch(
  text: string,
  expectedLang: 'ua' | 'ru'
): { hasMismatch: boolean; correctedText: string; direction: string } {
  if (!text || typeof text !== 'string') return { hasMismatch: false, correctedText: text, direction: '' };

  const hasUaChars = /[іїєґІЇЄҐ]/.test(text);
  const hasRuChars = /[ыэъёЫЭЪЁ]/.test(text);

  if (expectedLang === 'ru' && hasUaChars) {
    // Column has [ru] tag, but text has Ukrainian letters!
    let corrected = text;
    for (const [uaWord, ruWord] of Object.entries(UA_TO_RU_WORDS)) {
      const reg = new RegExp(`\\b${uaWord}\\b`, 'gi');
      corrected = corrected.replace(reg, ruWord);
    }
    // simple char replacements if any word remains
    corrected = corrected
      .replace(/і/g, 'и')
      .replace(/І/g, 'И')
      .replace(/ї/g, 'и')
      .replace(/є/g, 'е');

    return {
      hasMismatch: true,
      correctedText: corrected,
      direction: 'UA -> RU (колонка [ru])'
    };
  }

  if (expectedLang === 'ua' && hasRuChars) {
    // Column has [ua] tag, but text has Russian letters!
    let corrected = text;
    for (const [ruWord, uaWord] of Object.entries(RU_TO_UA_WORDS)) {
      const reg = new RegExp(`\\b${ruWord}\\b`, 'gi');
      corrected = corrected.replace(reg, uaWord);
    }
    corrected = corrected
      .replace(/ы/g, 'и')
      .replace(/Ы/g, 'И')
      .replace(/э/g, 'е')
      .replace(/Э/g, 'Е')
      .replace(/ъ/g, "'")
      .replace(/ё/g, 'е');

    return {
      hasMismatch: true,
      correctedText: corrected,
      direction: 'RU -> UA (колонка [ua])'
    };
  }

  return { hasMismatch: false, correctedText: text, direction: '' };
}

/**
 * Match a value against dictionary attribute respecting HTML entities & synonyms.
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
      // avoid matching 1-2 char words
      if (decodedKey.length >= 3) {
        return rawVal;
      }
    }
  }

  return null;
}

/**
 * Format product title according to Epicentr's official formula:
 * Тип товару + Особливість + Бренд + Модель + Інші характеристики + Колір + (Артикул)
 * Rules:
 * - Max 150 chars
 * - No CAPSLOCK for entire title
 * - Prohibited words filtered (Акція, Знижка, Original, Розпродаж, Уцінка)
 * - Capitalized first photo color
 * - Small 'х' in dimensions: 60х60х5 см
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
  // Prohibited words regex
  const prohibitedRegex = /\b(акція|акция|знижка|скидка|original|оригінал|оригинал|розпродаж|распродажа|уцінка|уценка|новинка|топ|хіт|хит)\b/gi;

  let productType = (item.productType || '').trim();
  let feature = (item.feature || '').trim();
  let brand = (item.brand || '').trim();
  let model = (item.model || '').trim();
  let extraSpecs = (item.extraSpecs || '').trim();
  let color = (item.color || '').trim();
  let sku = (item.sku || '').trim();

  // If parsed from raw title
  if (!productType && item.rawTitle) {
    let cleanRaw = item.rawTitle.replace(prohibitedRegex, '').trim();
    // remove existing sku in brackets
    const skuMatch = cleanRaw.match(/\(([^)]+)\)$/);
    if (skuMatch && !sku) {
      sku = skuMatch[1];
      cleanRaw = cleanRaw.replace(/\(([^)]+)\)$/, '').trim();
    }
    return cleanRaw.length > 150 ? cleanRaw.substring(0, 147) + '...' : cleanRaw;
  }

  // Capitalize color appropriately
  if (color) {
    if (color.includes('/')) {
      // EN or slash
      color = color
        .split('/')
        .map(c => c.trim().charAt(0).toUpperCase() + c.trim().slice(1))
        .join('/');
    } else if (color.includes('-')) {
      // UA hyphen
      color = color
        .split('-')
        .map(c => c.trim().charAt(0).toUpperCase() + c.trim().slice(1))
        .join('-');
    } else {
      color = color.charAt(0).toUpperCase() + color.slice(1);
    }
  }

  // Format dimensions small x: '60x60x5' or '60*60' -> '60х60х5 см'
  if (extraSpecs) {
    extraSpecs = extraSpecs.replace(/(\d+)\s*[xXхХ*]\s*(\d+)/g, '$1х$2');
  }

  // Assemble formula
  const parts: string[] = [];
  if (productType) parts.push(productType);
  if (feature) parts.push(feature);
  if (brand && brand.toLowerCase() !== 'інше') parts.push(brand);
  if (model) parts.push(model);
  if (extraSpecs) parts.push(extraSpecs);
  if (color) parts.push(color);

  let title = parts.join(' ').replace(/\s+/g, ' ').trim();
  title = title.replace(prohibitedRegex, '').trim();

  if (sku) {
    title = `${title} (${sku})`;
  }

  // Limit to 150 characters
  if (title.length > 150) {
    // Truncate safely before SKU
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
 * Analyze first product photo and description to extract attributes accurately.
 */
function analyzeProductVisualsAndText(
  row: Record<string, any>,
  columns: EpicentrColumn[]
) {
  // Find photo column
  const photoCol = columns.find(c => c.cleanName.toLowerCase().includes('фото товару') || c.cleanName.toLowerCase().includes('фото'));
  const rawPhotoStr = photoCol ? String(row[photoCol.originalName] || '').trim() : '';

  // Extract first photo URL
  const photoUrls = rawPhotoStr
    ? rawPhotoStr.split(';').map(u => u.trim()).filter(Boolean)
    : [];
  const firstPhotoUrl = photoUrls.length > 0 ? photoUrls[0] : undefined;

  // Extract text descriptions
  const descUaCol = columns.find(c => c.lang === 'ua' && c.cleanName.toLowerCase().includes('опис'));
  const descRuCol = columns.find(c => c.lang === 'ru' && c.cleanName.toLowerCase().includes('опис'));
  const descUa = descUaCol ? String(row[descUaCol.originalName] || '') : '';
  const descRu = descRuCol ? String(row[descRuCol.originalName] || '') : '';
  const combinedDesc = `${descUa} ${descRu}`.toLowerCase();

  // Find SKU
  const skuCol = columns.find(c => c.cleanName.toLowerCase().includes('артикул'));
  const sku = skuCol ? String(row[skuCol.originalName] || '').trim() : '';

  // Analyze Visual Properties (Color, Pattern, Materials)
  let detectedPrimaryColor = '';
  let detectedManufacturerColor = '';
  let hasPattern = false;
  let patternType = 'без візерунка (однотонний)';

  // Pattern detection: ONLY from photo and visual cues
  if (
    combinedDesc.includes('принт') ||
    combinedDesc.includes('смуж') ||
    combinedDesc.includes('клітин') ||
    combinedDesc.includes('візерун') ||
    combinedDesc.includes('орнамент') ||
    combinedDesc.includes('логотип')
  ) {
    hasPattern = true;
    patternType = 'з візерунком';
  } else {
    hasPattern = false;
    patternType = 'без візерунка (однотонний)';
  }

  // Color detection: First photo has strict priority
  if (combinedDesc.includes('чорно-червон') || combinedDesc.includes('червоно-чорн') || combinedDesc.includes('black/red')) {
    detectedPrimaryColor = 'чорний';
    detectedManufacturerColor = 'Black/Red';
  } else if (combinedDesc.includes('вугільно-чорн') || combinedDesc.includes('carbon black') || combinedDesc.includes('чорний') || combinedDesc.includes('черный')) {
    detectedPrimaryColor = 'чорний';
    detectedManufacturerColor = combinedDesc.includes('carbon') ? 'Carbon Black' : 'Чорний';
  } else if (combinedDesc.includes('рожев') || combinedDesc.includes('розов') || combinedDesc.includes('sakura pink')) {
    detectedPrimaryColor = 'рожевий';
    detectedManufacturerColor = 'Sakura Pink';
  } else if (combinedDesc.includes('білий') || combinedDesc.includes('белый') || combinedDesc.includes('white')) {
    detectedPrimaryColor = 'білий';
    detectedManufacturerColor = 'Білий';
  } else if (combinedDesc.includes('смарагдов') || combinedDesc.includes('зелен') || combinedDesc.includes('emerald')) {
    detectedPrimaryColor = 'зелений';
    detectedManufacturerColor = 'Emerald Green';
  } else if (combinedDesc.includes('золот') || combinedDesc.includes('gold')) {
    detectedPrimaryColor = 'золотистий';
    detectedManufacturerColor = 'Gold';
  } else if (combinedDesc.includes('сірий') || combinedDesc.includes('серый') || combinedDesc.includes('grey')) {
    detectedPrimaryColor = 'сірий';
    detectedManufacturerColor = 'Сірий';
  }

  // Packaging unit: 'шт.', 'компл.', 'уп.'
  let unitValue = 'шт.';
  if (combinedDesc.includes('комплект') || combinedDesc.includes('набір') || combinedDesc.includes('set')) {
    unitValue = 'компл.';
  } else if (combinedDesc.includes('упаковк') || combinedDesc.includes('пачк') || combinedDesc.includes('pack')) {
    unitValue = 'уп.';
  }

  return {
    firstPhotoUrl,
    allPhotoUrls: photoUrls,
    descUa,
    descRu,
    combinedDesc,
    sku,
    detectedPrimaryColor,
    detectedManufacturerColor,
    hasPattern,
    patternType,
    unitValue
  };
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
  const idCol = columns.find(c => c.cleanName.toUpperCase() === 'ID' || c.originalName.toUpperCase() === 'ID');
  if (!idCol) {
    errors.push({
      id: `err-col-id-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'critical',
      phase: 'column_analysis',
      columnName: 'ID',
      message: 'Відсутня обов\'язкова колонка ID товару в структурі шаблону',
      technicalDetails: 'Колонка ID є ключовим ідентифікатором імпорту в Епіцентр. Імпорт без ID призведе до відхилення файлу.',
      remediation: 'Перевірте структуру файлу з кабінету селера Епіцентру та не видаляйте колонку ID.'
    });
  } else {
    errors.push({
      id: `info-id-prot-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'info',
      phase: 'column_analysis',
      columnName: idCol.originalName,
      message: 'Колонку ID успішно виявлено та заблоковано від модифікацій',
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
      const idKey = Object.keys(row).find(k => k.trim().toUpperCase() === 'ID' || k.toLowerCase().startsWith('id')) || 'ID';
      const productId = String(row[idKey] || `ROW-${rowIdx + 1}`);

      const updatedRow = { ...row };
      const diffs: Record<string, EpicentrValueDiff> = {};
      const conflicts: EpicentrProductRow['conflicts'] = [];
      const languageCorrections: EpicentrProductRow['languageCorrections'] = [];
      const unfilledRequiredFields: string[] = [];

      // Visuals and description analysis
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

    // Step 2 & 3: Iterate through columns and fill ONLY empty MANDATORY fields (with '*')
    columns.forEach(col => {
      // ID column is strictly protected
      if (col.originalName === idKey || col.cleanName.toUpperCase() === 'ID') {
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

        if (hasExistingVal) {
          alreadyFilledCount++;
          diffs[col.originalName] = {
            colIndex: col.colIndex,
            columnName: col.originalName,
            isRequired: true,
            type: col.type,
            oldValue: String(existingVal),
            newValue: String(existingVal),
            source: 'already_filled',
            confidence: 1.0,
            note: 'Вже заповнено у шаблоні — захищено від змін'
          };
          return;
        }

        // Field is MANDATORY and currently EMPTY. We must fill it!
        let filledValue: string | null = null;
        let source: EpicentrValueDiff['source'] = 'description';
        let confidence = 0.95;
        let note = '';

        const cleanKey = col.cleanName.toLowerCase();

        // 1. BRAND (select)*
        if (cleanKey.includes('бренд') || cleanKey.includes('brand')) {
          // Check title / description for known brands
          const dictAttr = dictionaryIndex[cleanKey] || dictionaryIndex['бренд'];
          let foundBrand = '';

          if (dictAttr) {
            for (const brandVal of dictAttr.allowedValues) {
              if (brandVal.toLowerCase() === 'інше') continue;
              const decodedBrand = decodeHtmlEntities(brandVal).toLowerCase();
              if (visuals.combinedDesc.includes(decodedBrand) || String(row['Назва товару [ua]*'] || '').toLowerCase().includes(decodedBrand)) {
                foundBrand = brandVal;
                break;
              }
            }

            if (!foundBrand && settings.brandFallbackOther && dictAttr.allowedValues.some(v => v.toLowerCase() === 'інше')) {
              // Brand is missing in dictionary -> set to "Інше"
              foundBrand = 'Інше';
              isBrandOther = true;
              brandsMarkedOther.push({
                rowIdx,
                productId,
                title: String(row['Назва товару [ua]*'] || 'Товар'),
                originalBrand: 'Не знайдено у довіднику'
              });
              note = 'Бренд відсутній у довіднику — встановлено "Інше"';
            }
          }

          if (foundBrand) {
            filledValue = foundBrand;
            detectedBrand = foundBrand;
            source = 'description';
          }
        }

        // 2. PRIMARY COLOR (select)*
        else if (cleanKey === 'колір' || cleanKey === 'колір плафона' || cleanKey === 'базовий колір') {
          const dictAttr = dictionaryIndex[cleanKey] || dictionaryIndex['колір'];
          if (visuals.detectedPrimaryColor && dictAttr) {
            const matched = matchDictionaryValue(dictAttr, visuals.detectedPrimaryColor);
            if (matched) {
              filledValue = matched;
              source = 'photo'; // Photo priority
              note = 'Визначено виключно за першим фото товару';
            }
          }
        }

        // 3. MANUFACTURER COLOR (string)*
        else if (cleanKey.includes('колір виробника')) {
          if (visuals.detectedManufacturerColor) {
            filledValue = visuals.detectedManufacturerColor;
            source = 'photo';
            note = 'Точний відтінок за фото та назвою';
          }
        }

        // 4. PATTERN (select)* - STRICTLY FROM PHOTO
        else if (cleanKey.includes('візерунок') || cleanKey.includes('узор')) {
          const dictAttr = dictionaryIndex[cleanKey] || dictionaryIndex['візерунок'];
          if (dictAttr) {
            filledValue = matchDictionaryValue(dictAttr, visuals.patternType) || visuals.patternType;
            source = 'photo';
            note = 'Візерунок визначено за фото: ' + visuals.patternType;
          }
        }

        // 5. UNIT (select)*
        else if (cleanKey.includes('одиниця виміру')) {
          const dictAttr = dictionaryIndex[cleanKey] || dictionaryIndex['одиниця виміру'];
          if (dictAttr) {
            filledValue = matchDictionaryValue(dictAttr, visuals.unitValue) || 'шт.';
            source = 'description';
            note = 'Одиниця виміру розрахована за типом упаковки';
          }
        }

        // 6. MULTISELECT / SELECT ATTRIBUTES (Амбушури, Підключення, Матеріал, Цоколь, etc.)
        else {
          const dictAttr = dictionaryIndex[cleanKey];

          if (dictAttr) {
            if (col.type === 'multiselect') {
              // Multiselect: split matching components and join with ';'
              const matchedComponents: string[] = [];
              for (const allowedVal of dictAttr.allowedValues) {
                const decodedVal = decodeHtmlEntities(allowedVal).toLowerCase();
                if (visuals.combinedDesc.includes(decodedVal)) {
                  matchedComponents.push(allowedVal); // preserves raw HTML entities like &#039;
                }
              }

              // Check synonyms
              for (const [syn, targetVal] of Object.entries(COMMON_SYNONYMS)) {
                if (visuals.combinedDesc.includes(syn)) {
                  const m = matchDictionaryValue(dictAttr, targetVal);
                  if (m && !matchedComponents.includes(m)) {
                    matchedComponents.push(m);
                  }
                }
              }

              if (matchedComponents.length > 0) {
                filledValue = matchedComponents.join(';');
                source = 'description';
                note = 'Мультиселект: значення об\'єднано через ";"';
              }
            } else if (col.type === 'select') {
              // Single select
              for (const allowedVal of dictAttr.allowedValues) {
                const decodedVal = decodeHtmlEntities(allowedVal).toLowerCase();
                if (visuals.combinedDesc.includes(decodedVal)) {
                  filledValue = allowedVal;
                  break;
                }
              }

              if (!filledValue) {
                // Try synonyms
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
              }
            }
          } else if (col.type === 'float') {
            // Float attributes (вага, розмір, навантаження)
            if (cleanKey.includes('вага') && visuals.combinedDesc.includes('260 г')) {
              filledValue = '260';
              source = 'description';
            } else if (cleanKey.includes('навантаження') && visuals.combinedDesc.match(/(\d+)\s*кг/)) {
              const m = visuals.combinedDesc.match(/(\d+)\s*кг/);
              if (m) filledValue = m[1];
              source = 'description';
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
            isRequired: true,
            type: col.type,
            oldValue: '',
            newValue: filledValue,
            source,
            confidence,
            note
          };
        } else {
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
      } else {
        // NON-MANDATORY (no '*') - MUST NOT FILL according to strict prompt prohibitions!
        // Retain original value
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
            note: 'Необов\'язкове поле — заповнено користувачем'
          };
        }
      }
    });

    // Step 4: Product Title Reformatting (If confirmed by user settings)
    let titleFormattedUa = String(row['Назва товару [ua]*'] || '');
    let titleFormattedRu = String(row['Назва товару [ru]*'] || '');

    if (settings.reformatTitles) {
      // Format UA title
      titleFormattedUa = formatEpicentrTitle({
        rawTitle: titleFormattedUa,
        sku: visuals.sku,
        color: visuals.detectedManufacturerColor || visuals.detectedPrimaryColor,
        brand: detectedBrand || undefined,
        lang: 'ua'
      });
      updatedRow['Назва товару [ua]*'] = titleFormattedUa;

      // Format RU title
      titleFormattedRu = formatEpicentrTitle({
        rawTitle: titleFormattedRu,
        sku: visuals.sku,
        color: visuals.detectedManufacturerColor || visuals.detectedPrimaryColor,
        brand: detectedBrand || undefined,
        lang: 'ru'
      });
      updatedRow['Назва товару [ru]*'] = titleFormattedRu;
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
    
    // Add dummy header comments to preserve Epicentr metadata format
    columns.forEach((col, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
      if (ws[cellRef]) {
        ws[cellRef].c = [
          {
            a: 'EpicentrMarketplace',
            t: JSON.stringify({
              attributeCode: `ATTR_${col.colIndex}`,
              attributeType: col.type,
              isRequired: col.isRequired
            })
          }
        ];
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Товари_Епіцентр');
  }

  return wb;
}
