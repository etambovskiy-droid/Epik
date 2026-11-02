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
 * Unifies all apostrophe variants (' ’ ʻ ʼ ‘ ` ´ &#039; &#39; &apos;) into standard ASCII apostrophe "'"
 * and removes zero-width characters (\u200b, \u200c, \u200d, \ufeff).
 */
export function normalizeApostrophes(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/&#0*39;|&apos;|&#x27;/gi, "'")
    .replace(/[\u2018\u2019\u02bb\u02bc\u02b9\u0060\u00b4’ʻʼ‘`´]/g, "'");
}

/**
 * Symmetric HTML entity decoder for all text comparisons:
 * &#039; <-> ', &quot; <-> ", &amp; <-> &, \u200b <-> empty, and unified apostrophes.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return normalizeApostrophes(String(str))
    .replace(/&quot;|&#0*34;/gi, '"')
    .replace(/&amp;|&#0*38;/gi, '&')
    .replace(/&lt;|&#0*60;/gi, '<')
    .replace(/&gt;|&#0*62;/gi, '>')
    .replace(/&nbsp;|\u00a0/gi, ' ');
}

/**
 * Symmetric HTML entity encoder:
 * Converts ' / ’ / ʻ -> &#039;, " -> &quot;, & -> &amp;, \u200b -> empty.
 */
export function encodeHtmlEntities(str: string): string {
  if (!str) return '';
  const decoded = decodeHtmlEntities(str);
  return decoded
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Universal text normalizer for dictionary comparisons:
 * - Case-insensitive
 * - Symmetric HTML entity & apostrophe normalization
 * - Whitespace, bracket, and punctuation normalization
 */
export function normalizeForDictionaryComparison(
  str: string,
  mode: 'exact' | 'relaxed' = 'exact'
): string {
  if (!str) return '';
  let norm = decodeHtmlEntities(str)
    .replace(/["«»„“”]/g, '"')
    .toLowerCase()
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)\s*/g, ') ')
    .replace(/\s+/g, ' ')
    .trim();

  if (mode === 'relaxed') {
    norm = norm
      // Remove apostrophes inside words so e.g. пам'яті <-> памяті and в'єтнам <-> вєтнам match
      .replace(/([а-яіїєґa-z])'([а-яіїєґa-z])/gi, '$1$2')
      // Normalize brackets, quotes, punctuation, and extra spaces
      .replace(/['"()[\]{}.,:;!?/\\+-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return norm;
}

/**
 * Detects whether a string is an internal hex code, base36 hash, UUID, or system identifier
 * (e.g. "cfd9340c", "a8xqzwivcojproo", "opt_123456", "UUID") that must NEVER be treated
 * as an allowed option or written into the final Epicentr Excel sheet.
 */
export function isInternalHexOrHashId(val: any): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  if (!s || s.length < 4) return false;

  // Real option values in Epicentr have Ukrainian/Cyrillic letters or spaces
  if (/[а-яіїєґА-ЯІЇЄҐ]/i.test(s)) return false;

  // Real option values with spaces (e.g. "black and white") are not internal hashes
  if (/\s/.test(s)) return false;

  // Explicitly allow short standard alphanumeric specs/units like "18+", "100%", "5.0", "USB-C", "2.4G", "2.4GHz", "XL", "XXL"
  if (/^(\d+\+|[\d.]+(%|g|ghz|v|w|a|mah|mm|cm|m|kg|г|кг)?|[xsml]{1,4}|\d{2}(?:-\d{2})?)$/i.test(s)) {
    return false;
  }

  // UUID format (e.g. 12345678-1234-1234-1234-123456789abc)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return true;
  }

  // Pure hex hashes >= 8 characters (e.g. cfd9340c, cfd9340cf7d5)
  if (/^[0-9a-f]{8,}$/i.test(s) && /\d/.test(s) && /[a-f]/i.test(s)) {
    return true;
  }

  // Alphanumeric hashes / option codes >= 10 characters without spaces (e.g. "a8xqzwivcojproo", "opt_cfd9340c")
  if (/^(opt_|attr_|val_|code_)?[a-z0-9_-]{10,}$/i.test(s) && /\d/.test(s) && /[a-z]/i.test(s)) {
    return true;
  }

  // Specifically check known random alphanumeric hash identifiers like "a8xqzwivcojproo" (base36 hashes)
  if (/^[a-z0-9]{12,}$/i.test(s) && !/^(bluetooth|wireless|rechargeable|waterproof)/i.test(s)) {
    return true;
  }

  return false;
}

/**
 * Detects whether a string is an AI apology, disclaimer, explanation, or meta-service text
 * (e.g. "відсутнє в довіднику", "немає у відкритому доступі", "Джерело:", "allowedValues",
 * "постановою кабінету міністрів", "не підлягає поверненню відповідно до") that must be
 * automatically stripped and replaced with an empty string.
 */
export function isAiDisclaimerOrServiceText(val: any): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim().toLowerCase();
  if (!s) return false;

  const disclaimerPatterns = [
    /відсутн(є|ьо|я|ій|ого)/i,
    /немає\s+(в|у)?\s*(довідник|відкритому|каталог|доступі|наявності)/i,
    /немає\s+у\s+відкритому/i,
    /не\s+знайдено\s+(в|у)?\s*(довідник|відкритому|інтернет)/i,
    /немає\s+інформації/i,
    /інформація\s+відсутня/i,
    /дані\s+відсутні/i,
    /значення\s+відсутнє/i,
    /не\s+вказано/i,
    /невідомо/i,
    /\b(н\/д|n\/a|null|undefined|nan)\b/i,
    /джерело\s*:/i,
    /\bsource\s*:/i,
    /allowedvalues/i,
    /allowed\s*values/i,
    /наданому\s+довіднику/i,
    /згідно\s+(з\s+)?довідник/i,
    /в\s+довіднику\s+відсутн/i,
    /постанова\s+(кабінету\s+міністрів|кму)/i,
    /кабінет(у)?\s+міністрів/i,
    /закон(ом|у)?\s+україни/i,
    /згідно\s+з\s+законодавством/i,
    /перелік\s+товарів.*не\s+підляга/i,
    /на\s+жаль/i,
    /к\s+сожалению/i,
    /як\s+штучний\s+інтелект/i,
    /не\s+вдалося\s+знайти/i,
    /потрібно\s+уточнити/i,
    /уточніть\s+у\s+виробника/i,
    /https?:\/\//i,
    /\[.*\]\(https?:/i
  ];

  return disclaimerPatterns.some(pattern => pattern.test(s));
}

/**
 * Universal canonical mapper across ANY product category:
 * - Gender & number forms ('Жіноча'/'жіночий' -> 'жіночі', 'чоловіча'/'чоловічий' -> 'чоловічі', 'дитячий' -> 'дитячі', 'унісекс')
 * - Generalized categorical phrases ('Усі типи волосся' / 'Для всіх типів' -> 'усі типи', 'для всіх типів шкіри' -> 'для всіх типів')
 * - Legal/return disclaimers ('обміну та поверненню не підлягає', 'постанова кабміну' -> 'поверненню не підлягає')
 * - Option extraction from descriptive / noisy strings (e.g. '18+' from 'Makeup.ua (18+)', 'з 18 років')
 * - Symmetric HTML entity and apostrophe resolution
 */
export function canonicalMapCandidate(candidate: string, allowedValues: string[]): string | null {
  if (!candidate || !allowedValues || allowedValues.length === 0) return null;
  const rawClean = decodeHtmlEntities(candidate).trim();
  if (!rawClean) return null;
  const lower = rawClean.toLowerCase();

  const findAllowed = (targetNormalized: string): string | null => {
    const targetNorm = normalizeForDictionaryComparison(targetNormalized, 'exact');
    for (const val of allowedValues) {
      if (normalizeForDictionaryComparison(val, 'exact') === targetNorm) {
        return val;
      }
    }
    return null;
  };

  // 1. Bracket extraction: e.g. "Makeup.ua (18+)" -> "18+", "Крісло (штучна шкіра)" -> "штучна шкіра"
  const bracketMatch = rawClean.match(/\(([^)]+)\)/);
  if (bracketMatch) {
    const inside = bracketMatch[1].trim();
    if (inside) {
      const matchInside = findAllowed(inside);
      if (matchInside) return matchInside;
    }
    const outside = rawClean.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    if (outside) {
      const matchOutside = findAllowed(outside);
      if (matchOutside) return matchOutside;
    }
  }

  // 2. Gender & Number forms
  // Women
  if (/^(жіноч(а|ий|е|і)|женск(ая|ий|ое|ие)|для\s+жінок)$/i.test(lower) || lower === 'жіноча' || lower === 'жіночий') {
    const res = findAllowed('жіночі') || findAllowed('жіноча') || findAllowed('жіночий') || findAllowed('для жінок');
    if (res) return res;
  }
  // Men
  if (/^(чоловіч(а|ий|е|і)|мужск(ая|ий|ое|ие)|для\s+чоловіків)$/i.test(lower) || lower === 'чоловіча' || lower === 'чоловічий') {
    const res = findAllowed('чоловічі') || findAllowed('чоловічий') || findAllowed('чоловіча') || findAllowed('для чоловіків');
    if (res) return res;
  }
  // Children
  if (/^(дитяч(ий|а|е|і)|детск(ий|ая|ое|ие)|для\s+дітей)$/i.test(lower) || lower === 'дитячий' || lower === 'дитяча') {
    const res = findAllowed('дитячі') || findAllowed('дитячий') || findAllowed('дитяча') || findAllowed('для дітей');
    if (res) return res;
  }
  // Teens
  if (/^(підлітковий|підліткова|підліткові|подростковый|подростковые)$/i.test(lower)) {
    const res = findAllowed('підліткові') || findAllowed('підлітковий');
    if (res) return res;
  }
  // Unisex
  if (/^(унісекс|унисекс|unisex|для\s+чоловіків\s+та\s+жінок|для\s+жінок\s+і\s+чоловіків)$/i.test(lower)) {
    const res = findAllowed('унісекс') || findAllowed('unisex');
    if (res) return res;
  }
  // Girls / Boys
  if (/^(для\s+дівчаток|для\s+дівчинки|дівчинка|дівчатка)$/i.test(lower)) {
    const res = findAllowed('для дівчаток') || findAllowed('дівчата') || findAllowed('жіночі');
    if (res) return res;
  }
  if (/^(для\s+хлопчиків|для\s+хлопчика|хлопчик|хлопчики)$/i.test(lower)) {
    const res = findAllowed('для хлопчиків') || findAllowed('хлопці') || findAllowed('чоловічі');
    if (res) return res;
  }

  // 3. Generalized categorical phrases (Hair, Skin, All Types across cosmetics & home care)
  if (
    /(усі|всі|для всіх|для будь-якого)\s+тип/i.test(lower) ||
    lower === 'усі типи' ||
    lower === 'всі типи' ||
    lower === 'для всіх типів' ||
    lower === 'універсальний' ||
    lower === 'універсальна' ||
    lower === 'універсальне'
  ) {
    const res =
      findAllowed('усі типи') ||
      findAllowed('для всіх типів') ||
      findAllowed('всі типи') ||
      findAllowed('усі типи волосся') ||
      findAllowed('для всіх типів волосся') ||
      findAllowed('усі типи шкіри') ||
      findAllowed('для всіх типів шкіри') ||
      findAllowed('універсальний') ||
      findAllowed('універсальна');
    if (res) return res;
  }

  // 4. Legal / Return Statements
  if (/повернен/i.test(lower) || /постанов.*кабінет.*міністр/i.test(lower) || /закон.*прав.*споживач/i.test(lower)) {
    if (/не\s+підляга/i.test(lower) || /поверненню\s+не\s+підлягає/i.test(lower) || /не\s+підлягає\s+поверненню/i.test(lower)) {
      const res =
        findAllowed('поверненню не підлягає') ||
        findAllowed('не підлягає поверненню') ||
        findAllowed('обміну та поверненню не підлягає') ||
        findAllowed('обміну та поверненню не підлягає згідно постанови кму') ||
        findAllowed('товар належної якості обміну та поверненню не підлягає');
      if (res) return res;
    }
    if (/14\s+дн/i.test(lower)) {
      const res = findAllowed('14 днів') || findAllowed('обмін та повернення протягом 14 днів');
      if (res) return res;
    }
  }

  // 5. Age extractions (18+, 16+, 12+, 6+, 3+, 0+)
  const ageMatch = lower.match(/\b(18|16|12|6|3|0)\s*\+/);
  if (ageMatch) {
    const ageTag = `${ageMatch[1]}+`;
    const res = findAllowed(ageTag) || findAllowed(`від ${ageMatch[1]} років`);
    if (res) return res;
  }
  const fromAgeMatch = lower.match(/\bвід\s+(\d+)\s*(?:років|року|р\.)/i);
  if (fromAgeMatch) {
    const num = fromAgeMatch[1];
    const res = findAllowed(`${num}+`) || findAllowed(`від ${num} років`) || findAllowed(`від ${num} року`);
    if (res) return res;
  }

  // 6. Check if any allowed option is contained as an exact standalone word/token in the candidate
  for (const allowedVal of allowedValues) {
    if (!allowedVal || isInternalHexOrHashId(allowedVal)) continue;
    const allowedNorm = normalizeForDictionaryComparison(allowedVal, 'exact');
    if (allowedNorm.length >= 3) {
      const escaped = allowedNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`(?<![а-яіїєґa-z0-9])${escaped}(?![а-яіїєґa-z0-9])`, 'i');
      if (reg.test(lower)) {
        return allowedVal;
      }
    }
  }

  return null;
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
 * Safely extracts the exact raw comment text from a SheetJS cell object.
 * Catches all variants: array ws[cellRef].c, string, or cell.comment.
 */
export function extractCellComment(cell: any): string | undefined {
  if (!cell) return undefined;
  if (Array.isArray(cell.c) && cell.c.length > 0) {
    const text = cell.c
      .map((item: any) => (typeof item === 'string' ? item : item?.t || ''))
      .filter(Boolean)
      .join('\n')
      .trim();
    if (text) return text;
  }
  if (typeof cell.c === 'string' && cell.c.trim()) {
    return cell.c.trim();
  }
  if (cell.c && typeof cell.c === 'object' && cell.c.t) {
    return String(cell.c.t).trim();
  }
  if (typeof cell.comment === 'string' && cell.comment.trim()) {
    return cell.comment.trim();
  }
  if (cell.comment && typeof cell.comment === 'object' && cell.comment.t) {
    return String(cell.comment.t).trim();
  }
  return undefined;
}

/**
 * Parse headers to detect column types, mandatory markers, language tags, and units.
 * Preserves exact original column names with newlines (\n) and exact original cell comments.
 */
export function analyzeEpicentrColumns(
  headers: string[],
  worksheetOrComments?: XLSX.WorkSheet | (string | undefined)[],
  headerRowIdx: number = 0
): EpicentrColumn[] {
  // Pre-index worksheet header comments if a worksheet was provided
  const commentByHeaderName = new Map<string, string>();
  const commentByColIdx = new Map<number, string>();

  if (worksheetOrComments && !Array.isArray(worksheetOrComments)) {
    const ws = worksheetOrComments;
    for (let c = 0; c < Math.max(headers.length + 20, 150); c++) {
      const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
      const cell = ws[cellRef];
      if (!cell) continue;
      const commentText = extractCellComment(cell);
      if (commentText) {
        commentByColIdx.set(c, commentText);
        if (cell.v !== undefined && cell.v !== null) {
          const rawV = String(cell.v);
          commentByHeaderName.set(rawV, commentText);
          commentByHeaderName.set(rawV.replace(/\r\n/g, '\n').trim(), commentText);
        }
      }
    }
  }

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

    // Preserve exact original comment without generating any artificial ATTR_ comments
    let rawComment: string | undefined;
    if (Array.isArray(worksheetOrComments)) {
      rawComment = worksheetOrComments[colIndex];
    } else if (worksheetOrComments) {
      const normHeader = rawHeader.replace(/\r\n/g, '\n').trim();
      rawComment =
        commentByHeaderName.get(rawHeader) ||
        commentByHeaderName.get(normHeader) ||
        commentByColIdx.get(colIndex);
    }

    return {
      colIndex,
      originalName: rawHeader,
      cleanName,
      type,
      isRequired,
      lang,
      unit,
      rawComment: rawComment ? rawComment.trim() : undefined
    };
  });
}

/**
 * Fully parses an uploaded Epicentr Excel template workbook:
 * - Detects true header row index (handling merged category titles if present)
 * - Preserves exact original column names with newlines (\n)
 * - Preserves exact original header cell comments (JSON metadata)
 * - Returns clean rows and columns with rawComment preserved
 */
export function parseEpicentrTemplateWorkbook(wb: XLSX.WorkBook): {
  sheetName: string;
  jsonData: Record<string, any>[];
  columns: EpicentrColumn[];
  headerRowIdx: number;
} {
  const sheetName = (wb.SheetNames && wb.SheetNames.length > 0) ? wb.SheetNames[0] : 'Worksheet';
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return { sheetName, jsonData: [], columns: [], headerRowIdx: 0 };
  }

  // Detect header row index
  const rawMatrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
  let headerRowIdx = 0;

  for (let r = 0; r < Math.min(10, rawMatrix.length); r++) {
    const row = rawMatrix[r];
    if (Array.isArray(row)) {
      const isHeaderRow = row.some(cell => {
        const s = String(cell || '').toLowerCase().trim();
        return (
          s === 'id' ||
          s.startsWith('id ') ||
          s.includes('назва товару') ||
          s.includes('артикул') ||
          s.includes('(select)') ||
          s.includes('(multiselect)') ||
          s.includes('*')
        );
      });
      if (isHeaderRow) {
        headerRowIdx = r;
        break;
      }
    }
  }

  // Read data starting from headerRowIdx
  const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
    defval: '',
    range: headerRowIdx
  });

  // Extract raw headers directly from the header row in ws to preserve exact newlines \n
  const headerRow = rawMatrix[headerRowIdx] || [];
  const rawHeaders: string[] = [];
  headerRow.forEach((cellVal: any) => {
    const s = cellVal !== undefined && cellVal !== null ? String(cellVal) : '';
    if (s && !s.startsWith('__EMPTY')) {
      rawHeaders.push(s);
    }
  });

  // Fallback to json keys if headerRow was sparse
  const effectiveHeaders = rawHeaders.length > 0
    ? rawHeaders
    : (rawJson.length > 0 ? Object.keys(rawJson[0]).filter(k => !k.startsWith('__EMPTY')) : []);

  const columns = analyzeEpicentrColumns(effectiveHeaders, ws, headerRowIdx);

  return {
    sheetName,
    jsonData: rawJson,
    columns,
    headerRowIdx
  };
}

/**
 * Generates authentic Epicentr JSON comment metadata for mock/sample category workbooks.
 * Strictly avoids artificial `ATTR_...` codes, using real Epicentr PIM schema patterns.
 */
export function createSampleEpicentrComment(col: EpicentrColumn, colIdx: number): string {
  const norm = (col.cleanName || col.originalName).toLowerCase();
  if (norm.includes('назва')) {
    const lang = col.lang || (col.originalName.toLowerCase().includes('[ru]') ? 'ru' : 'ua');
    return JSON.stringify({ key: `title.${lang}`, languageCode: lang });
  }
  if (norm.includes('опис')) {
    const lang = col.lang || (col.originalName.toLowerCase().includes('[ru]') ? 'ru' : 'ua');
    return JSON.stringify({ key: `description.${lang}`, languageCode: lang });
  }
  if (norm.includes('артикул') || norm === 'sku' || norm.includes('код виробника')) {
    return JSON.stringify({ key: 'externalId' });
  }
  if (norm === 'id' || norm.startsWith('id ')) {
    return JSON.stringify({ key: 'id' });
  }
  if (norm.includes('ціна') || norm.includes('price')) {
    return JSON.stringify({ key: 'price' });
  }
  if (norm.includes('залишок') || norm.includes('кількість')) {
    return JSON.stringify({ key: 'amount' });
  }
  if (norm.includes('фото') || norm.includes('зображення')) {
    return JSON.stringify({ key: 'photos' });
  }
  // Standard Epicentr PIM attribute definition
  return JSON.stringify({
    key: `attribute_${1000 + colIdx}`,
    required: !!col.isRequired
  });
}

/**
 * Universal Epicentr PIM Dictionary Workbook Parser:
 * Supports ANY category and file structure:
 * 1. PIM Attribute Set Export (`export-attribute-set...`):
 *    - Columns: "Назва характеристики", "Код опції", "Назва опції", "Порядок сортування", etc.
 *    - Strictly maps attribute name -> allowed values from "Назва опції" column!
 *    - Strictly ignores and excludes internal hashes from "Код опції", "ID опції", "Код".
 * 2. 2-column key-value tables: ["Характеристика", "Значення"] or ["Атрибут", "Назва опції"].
 * 3. Horizontal column-based tables (each column header is an attribute, rows are allowed values).
 *    - Strictly ignores system columns like "Код опції", "ID", "Позиція", etc.
 * Filters out all internal hex/hash IDs and AI explanation texts from allowedValues.
 */
export function parseDictionaryWorkbook(
  wb: XLSX.WorkBook,
  sheetNames?: string[]
): Record<string, string[]> {
  const dict: Record<string, string[]> = {};
  const targetSheets = sheetNames && sheetNames.length > 0 ? sheetNames : wb.SheetNames;

  for (const sName of targetSheets) {
    const ws = wb.Sheets[sName];
    if (!ws) continue;
    const rawMatrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length < 2) continue;

    // Find the header row (first row with at least 2 non-empty cells)
    let headerRowIdx = -1;
    let headers: string[] = [];
    for (let r = 0; r < Math.min(10, rawMatrix.length); r++) {
      const row = rawMatrix[r];
      if (Array.isArray(row)) {
        const nonEmpty = row.map(c => String(c || '').trim()).filter(Boolean);
        if (nonEmpty.length >= 2) {
          headerRowIdx = r;
          headers = row.map(c => String(c || '').trim());
          break;
        }
      }
    }

    if (headerRowIdx === -1 || headers.length === 0) continue;

    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    // 1. Check for Epicentr PIM export-attribute-set table:
    // Look for Attribute Name column and Option Name column
    let attrColIdx = -1;
    let optNameColIdx = -1;

    lowerHeaders.forEach((h, idx) => {
      if (
        h === 'назва характеристики' ||
        h === 'характеристика' ||
        h === 'назва атрибута' ||
        h === 'назва атрибуту' ||
        h === 'атрибут' ||
        h === 'attribute' ||
        h === 'attribute name'
      ) {
        attrColIdx = idx;
      } else if (
        h === 'назва опції' ||
        h === 'значення опції' ||
        h === 'назва значення' ||
        h === 'назва' ||
        h === 'значення' ||
        h === 'опція' ||
        h === 'option name' ||
        h === 'option' ||
        h === 'value'
      ) {
        optNameColIdx = idx;
      }
    });

    // Fallback if not exact match:
    if (attrColIdx === -1) {
      attrColIdx = lowerHeaders.findIndex(h => h.includes('характерист') || h.includes('атрибут'));
    }
    if (optNameColIdx === -1) {
      optNameColIdx = lowerHeaders.findIndex(
        (h, i) =>
          i !== attrColIdx &&
          (h.includes('назва опці') || h.includes('значен') || (h.includes('опці') && !h.includes('код') && !h.includes('id')))
      );
    }

    const isAttributeSetTable = attrColIdx !== -1 && optNameColIdx !== -1 && attrColIdx !== optNameColIdx;

    if (isAttributeSetTable) {
      // Row-by-row attribute set export
      for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
        const row = rawMatrix[r];
        if (!Array.isArray(row)) continue;

        const attrKey = String(row[attrColIdx] || '').trim();
        const optVal = String(row[optNameColIdx] || '').trim();

        if (!attrKey || !optVal) continue;
        if (isInternalHexOrHashId(optVal)) continue;
        if (isAiDisclaimerOrServiceText(optVal)) continue;

        const cleanKey = normalizeAttributeKey(attrKey, false);
        if (!dict[cleanKey]) dict[cleanKey] = [];
        if (!dict[cleanKey].includes(optVal)) {
          dict[cleanKey].push(optVal);
        }

        if (cleanKey !== attrKey) {
          if (!dict[attrKey]) dict[attrKey] = [];
          if (!dict[attrKey].includes(optVal)) {
            dict[attrKey].push(optVal);
          }
        }
      }
    } else {
      // Horizontal column-based dictionary table
      headers.forEach((colHeader, cIdx) => {
        if (!colHeader) return;
        const lowerH = colHeader.toLowerCase().trim();

        // Skip non-attribute technical columns
        if (
          lowerH === 'код опції' ||
          lowerH === 'id опції' ||
          lowerH === 'код характеристики' ||
          lowerH === 'id характеристики' ||
          lowerH === 'id' ||
          lowerH === 'код' ||
          lowerH === 'сортування' ||
          lowerH === 'порядок сортування' ||
          lowerH === 'позиція' ||
          lowerH.includes('export-attribute-set')
        ) {
          return;
        }

        const cleanKey = normalizeAttributeKey(colHeader, false);
        const values: string[] = [];

        for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
          const row = rawMatrix[r] as any[];
          if (!Array.isArray(row)) continue;
          const cellVal = row[cIdx];
          if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() !== '') {
            const v = String(cellVal).trim();
            if (isInternalHexOrHashId(v)) continue;
            if (isAiDisclaimerOrServiceText(v)) continue;
            if (!values.includes(v)) {
              values.push(v);
            }
          }
        }

        if (values.length > 0) {
          dict[cleanKey] = values;
          if (cleanKey !== colHeader.trim()) {
            dict[colHeader.trim()] = values;
          }
        }
      });
    }
  }

  return dict;
}

/**
 * Asynchronous Chunked Epicentr PIM Dictionary Workbook Parser:
 * Processes massive attribute sets (50k-90k+ rows) in batches of 2500 items,
 * yielding to the browser event loop to maintain silky smooth UI responsiveness.
 */
export async function parseDictionaryWorkbookAsync(
  wb: XLSX.WorkBook,
  sheetNames?: string[],
  onProgress?: (progress: { current: number; total: number; percent: number }) => void
): Promise<{ dict: Record<string, string[]>; rowCount: number }> {
  const dict: Record<string, string[]> = {};
  const targetSheets = sheetNames && sheetNames.length > 0 ? sheetNames : wb.SheetNames;
  let totalProcessedRows = 0;
  const CHUNK_SIZE = 2500;

  let estimatedTotal = 0;
  for (const sName of targetSheets) {
    const ws = wb.Sheets[sName];
    if (ws && ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      estimatedTotal += Math.max(0, range.e.r - range.s.r);
    }
  }
  estimatedTotal = Math.max(estimatedTotal, 1);

  for (const sName of targetSheets) {
    const ws = wb.Sheets[sName];
    if (!ws) continue;
    const rawMatrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    if (!rawMatrix || rawMatrix.length < 2) continue;

    let headerRowIdx = -1;
    let headers: string[] = [];
    for (let r = 0; r < Math.min(10, rawMatrix.length); r++) {
      const row = rawMatrix[r];
      if (Array.isArray(row)) {
        const nonEmpty = row.map(c => String(c || '').trim()).filter(Boolean);
        if (nonEmpty.length >= 2) {
          headerRowIdx = r;
          headers = row.map(c => String(c || '').trim());
          break;
        }
      }
    }

    if (headerRowIdx === -1 || headers.length === 0) continue;

    const lowerHeaders = headers.map(h => h.toLowerCase().trim());
    let attrColIdx = -1;
    let optNameColIdx = -1;

    lowerHeaders.forEach((h, idx) => {
      if (
        h === 'назва характеристики' ||
        h === 'характеристика' ||
        h === 'назва атрибута' ||
        h === 'назва атрибуту' ||
        h === 'атрибут' ||
        h === 'attribute' ||
        h === 'attribute name'
      ) {
        attrColIdx = idx;
      } else if (
        h === 'назва опції' ||
        h === 'значення опції' ||
        h === 'назва значення' ||
        h === 'назва' ||
        h === 'значення' ||
        h === 'опція' ||
        h === 'option name' ||
        h === 'option' ||
        h === 'value'
      ) {
        optNameColIdx = idx;
      }
    });

    if (attrColIdx === -1) {
      attrColIdx = lowerHeaders.findIndex(h => h.includes('характерист') || h.includes('атрибут'));
    }
    if (optNameColIdx === -1) {
      optNameColIdx = lowerHeaders.findIndex(
        (h, i) =>
          i !== attrColIdx &&
          (h.includes('назва опці') || h.includes('значен') || (h.includes('опці') && !h.includes('код') && !h.includes('id')))
      );
    }

    const isAttributeSetTable = attrColIdx !== -1 && optNameColIdx !== -1 && attrColIdx !== optNameColIdx;

    if (isAttributeSetTable) {
      for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
        const row = rawMatrix[r];
        if (Array.isArray(row)) {
          const attrKey = String(row[attrColIdx] || '').trim();
          const optVal = String(row[optNameColIdx] || '').trim();

          if (attrKey && optVal && !isInternalHexOrHashId(optVal) && !isAiDisclaimerOrServiceText(optVal)) {
            const cleanKey = normalizeAttributeKey(attrKey, false);
            if (!dict[cleanKey]) dict[cleanKey] = [];
            dict[cleanKey].push(optVal);

            if (cleanKey !== attrKey) {
              if (!dict[attrKey]) dict[attrKey] = [];
              dict[attrKey].push(optVal);
            }
          }
        }
        totalProcessedRows++;
        if (totalProcessedRows % CHUNK_SIZE === 0) {
          if (onProgress) {
            onProgress({
              current: totalProcessedRows,
              total: estimatedTotal,
              percent: Math.min(99, Math.round((totalProcessedRows / estimatedTotal) * 100))
            });
          }
          await new Promise(res => setTimeout(res, 0));
        }
      }
    } else {
      for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
        const row = rawMatrix[r] as any[];
        if (Array.isArray(row)) {
          headers.forEach((colHeader, cIdx) => {
            if (!colHeader) return;
            const lowerH = colHeader.toLowerCase().trim();
            if (
              lowerH === 'код опції' ||
              lowerH === 'id опції' ||
              lowerH === 'код характеристики' ||
              lowerH === 'id характеристики' ||
              lowerH === 'id' ||
              lowerH === 'код' ||
              lowerH === 'сортування' ||
              lowerH === 'порядок сортування' ||
              lowerH === 'позиція' ||
              lowerH.includes('export-attribute-set')
            ) {
              return;
            }
            const val = row[cIdx];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              const s = String(val).trim();
              if (!isInternalHexOrHashId(s) && !isAiDisclaimerOrServiceText(s)) {
                const key = normalizeAttributeKey(colHeader, false);
                if (!dict[key]) dict[key] = [];
                dict[key].push(s);
              }
            }
          });
        }
        totalProcessedRows++;
        if (totalProcessedRows % CHUNK_SIZE === 0) {
          if (onProgress) {
            onProgress({
              current: totalProcessedRows,
              total: estimatedTotal,
              percent: Math.min(99, Math.round((totalProcessedRows / estimatedTotal) * 100))
            });
          }
          await new Promise(res => setTimeout(res, 0));
        }
      }
    }
  }

  // Deduplicate entries
  for (const k of Object.keys(dict)) {
    dict[k] = Array.from(new Set(dict[k]));
  }

  if (onProgress) {
    onProgress({ current: totalProcessedRows, total: totalProcessedRows, percent: 100 });
  }

  return { dict, rowCount: totalProcessedRows };
}

/**
 * Normalize and build index of dictionary values for fast lookup with symmetric HTML entity & apostrophe support
 */
export function buildDictionaryIndex(
  rawDict: Record<string, string[]>
): Record<string, EpicentrDictionaryAttribute> {
  const result: Record<string, EpicentrDictionaryAttribute> = {};

  for (const [attrName, allowedList] of Object.entries(rawDict)) {
    const cleanAttrName = normalizeAttributeKey(attrName, false);
    const strippedUnitAttrName = normalizeAttributeKey(attrName, true);

    // Skip non-attribute technical headers
    const cleanAttrLower = cleanAttrName.toLowerCase();
    if (
      cleanAttrLower === 'код опції' ||
      cleanAttrLower === 'id опції' ||
      cleanAttrLower === 'код характеристики' ||
      cleanAttrLower === 'id характеристики' ||
      cleanAttrLower === 'id' ||
      cleanAttrLower === 'код' ||
      cleanAttrLower === 'сортування' ||
      cleanAttrLower === 'порядок сортування' ||
      cleanAttrLower === 'позиція' ||
      cleanAttrLower.includes('export-attribute-set')
    ) {
      continue;
    }

    const decodedMap: Record<string, string> = {};
    const synonyms: Record<string, string> = {};
    const sanitizedAllowedList = allowedList
      .map(v => String(v || '').replace(/[\u200b\u200c\u200d\ufeff]/g, '').trim())
      .filter(v => Boolean(v) && !isInternalHexOrHashId(v) && !isAiDisclaimerOrServiceText(v));

    if (sanitizedAllowedList.length === 0) continue;

    for (const rawVal of sanitizedAllowedList) {
      const lowerRaw = rawVal.toLowerCase().trim();
      const exactNorm = normalizeForDictionaryComparison(rawVal, 'exact');
      const relaxedNorm = normalizeForDictionaryComparison(rawVal, 'relaxed');
      const encodedNorm = encodeHtmlEntities(rawVal).toLowerCase().trim();

      decodedMap[lowerRaw] = rawVal;
      decodedMap[exactNorm] = rawVal;
      if (relaxedNorm) {
        decodedMap[relaxedNorm] = rawVal;
      }
      if (encodedNorm) {
        decodedMap[encodedNorm] = rawVal;
      }

      // Also index without spaces around brackets or hyphens
      const compact = exactNorm.replace(/\s+/g, '');
      if (compact && !decodedMap[compact]) {
        decodedMap[compact] = rawVal;
      }

      // Index primary part before parentheses if unambiguous (e.g. "радіоканал (2.4 GHz)" -> "радіоканал")
      const parenMatch = exactNorm.match(/^([^()]+)\(([^()]+)\)$/);
      if (parenMatch) {
        const beforeParen = parenMatch[1].trim();
        const insideParen = parenMatch[2].trim();
        if (beforeParen.length >= 3 && !decodedMap[beforeParen]) {
          decodedMap[beforeParen] = rawVal;
        }
        if (insideParen.length >= 3 && !decodedMap[insideParen]) {
          decodedMap[insideParen] = rawVal;
        }
      }
    }

    const entry: EpicentrDictionaryAttribute = {
      attributeName: attrName,
      cleanAttributeName: cleanAttrName,
      allowedValues: sanitizedAllowedList,
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
 * Chunked Asynchronous Dictionary Indexer:
 * Processes massive Epicentr attribute dictionaries (50k-90k+ rows) in batches of 2500 items
 * yielding to the browser event loop via setTimeout(..., 0) to prevent UI freezing and "Page unresponsive" dialogs.
 */
export async function buildDictionaryIndexAsync(
  rawDict: Record<string, string[]>,
  onProgress?: (progress: { current: number; total: number; percent: number }) => void
): Promise<Record<string, EpicentrDictionaryAttribute>> {
  const result: Record<string, EpicentrDictionaryAttribute> = {};
  const entries = Object.entries(rawDict);

  let totalItems = 0;
  for (const [, list] of entries) {
    totalItems += list.length;
  }
  totalItems = Math.max(totalItems, 1);

  let processedCount = 0;
  let batchCounter = 0;
  const CHUNK_SIZE = 2500;

  for (const [attrName, allowedList] of entries) {
    const cleanAttrName = normalizeAttributeKey(attrName, false);
    const strippedUnitAttrName = normalizeAttributeKey(attrName, true);

    const cleanAttrLower = cleanAttrName.toLowerCase();
    if (
      cleanAttrLower === 'код опції' ||
      cleanAttrLower === 'id опції' ||
      cleanAttrLower === 'код характеристики' ||
      cleanAttrLower === 'id характеристики' ||
      cleanAttrLower === 'id' ||
      cleanAttrLower === 'код' ||
      cleanAttrLower === 'сортування' ||
      cleanAttrLower === 'порядок сортування' ||
      cleanAttrLower === 'позиція' ||
      cleanAttrLower.includes('export-attribute-set')
    ) {
      continue;
    }

    const decodedMap: Record<string, string> = {};
    const synonyms: Record<string, string> = {};
    const sanitizedAllowedList: string[] = [];

    for (const item of allowedList) {
      if (!item) continue;
      const rawVal = String(item).replace(/[\u200b\u200c\u200d\ufeff]/g, '').trim();
      if (!rawVal || isInternalHexOrHashId(rawVal) || isAiDisclaimerOrServiceText(rawVal)) continue;
      sanitizedAllowedList.push(rawVal);

      const lowerRaw = rawVal.toLowerCase().trim();
      const exactNorm = normalizeForDictionaryComparison(rawVal, 'exact');
      const relaxedNorm = normalizeForDictionaryComparison(rawVal, 'relaxed');
      const encodedNorm = encodeHtmlEntities(rawVal).toLowerCase().trim();

      decodedMap[lowerRaw] = rawVal;
      decodedMap[exactNorm] = rawVal;
      if (relaxedNorm) {
        decodedMap[relaxedNorm] = rawVal;
      }
      if (encodedNorm) {
        decodedMap[encodedNorm] = rawVal;
      }

      const compact = exactNorm.replace(/\s+/g, '');
      if (compact && !decodedMap[compact]) {
        decodedMap[compact] = rawVal;
      }

      const parenMatch = exactNorm.match(/^([^()]+)\(([^()]+)\)$/);
      if (parenMatch) {
        const beforeParen = parenMatch[1].trim();
        const insideParen = parenMatch[2].trim();
        if (beforeParen.length >= 3 && !decodedMap[beforeParen]) {
          decodedMap[beforeParen] = rawVal;
        }
        if (insideParen.length >= 3 && !decodedMap[insideParen]) {
          decodedMap[insideParen] = rawVal;
        }
      }

      processedCount++;
      batchCounter++;

      if (batchCounter >= CHUNK_SIZE) {
        batchCounter = 0;
        if (onProgress) {
          const percent = Math.min(99, Math.round((processedCount / totalItems) * 100));
          onProgress({ current: processedCount, total: totalItems, percent });
        }
        // Yield to browser event loop
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    if (sanitizedAllowedList.length === 0) continue;

    const entry: EpicentrDictionaryAttribute = {
      attributeName: attrName,
      cleanAttributeName: cleanAttrName,
      allowedValues: sanitizedAllowedList,
      decodedValuesMap: decodedMap,
      synonymsMap: synonyms
    };

    result[cleanAttrName] = entry;
    if (strippedUnitAttrName && !result[strippedUnitAttrName]) {
      result[strippedUnitAttrName] = entry;
    }
  }

  if (onProgress) {
    onProgress({ current: totalItems, total: totalItems, percent: 100 });
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
 * Universal Category-Agnostic Dictionary Matcher:
 * Matches a candidate value against a dictionary attribute's allowedValues using:
 * 1. Exact & case-insensitive match
 * 2. Symmetric HTML entity & apostrophe normalization (&#039; <-> ', &quot; <-> ", &amp; <-> &, \u200b <-> "")
 * 3. Bracket, whitespace, and punctuation normalization
 * 4. Universal synonym & RU->UA translation resolution
 * 5. Closest unambiguous equivalent in allowedValues (stem & token containment)
 * Returns the exact RAW string from allowedValues (with HTML entities intact), or null if not found.
 */
export function matchDictionaryValue(
  dictAttr: EpicentrDictionaryAttribute | undefined,
  candidateValue: string
): string | null {
  if (!candidateValue || !dictAttr || !Array.isArray(dictAttr.allowedValues) || dictAttr.allowedValues.length === 0) {
    return null;
  }

  const rawTrimmed = String(candidateValue).replace(/[\u200b\u200c\u200d\ufeff]/g, '').trim();
  if (!rawTrimmed || rawTrimmed.toLowerCase() === 'nan') return null;

  // Strict check: Forbid internal hex/hash IDs
  if (isInternalHexOrHashId(rawTrimmed)) return null;

  // Check AI disclaimers / explanations / apologies
  if (isAiDisclaimerOrServiceText(rawTrimmed)) {
    // If the text contains return disclaimer keywords, try to map to official return option
    if (/повернен/i.test(rawTrimmed)) {
      const legalMapped = canonicalMapCandidate(rawTrimmed, dictAttr.allowedValues);
      if (legalMapped) return legalMapped;
    }
    return null;
  }

  // 0. Exact raw match in allowedValues
  const exactAllowed = dictAttr.allowedValues.find(v => v === rawTrimmed);
  if (exactAllowed) return exactAllowed;

  const exactNorm = normalizeForDictionaryComparison(rawTrimmed, 'exact');
  const relaxedNorm = normalizeForDictionaryComparison(rawTrimmed, 'relaxed');
  const encodedNorm = encodeHtmlEntities(rawTrimmed).toLowerCase().trim();
  const compactNorm = exactNorm.replace(/\s+/g, '');

  // 1. Direct normalized lookup in decodedValuesMap
  if (dictAttr.decodedValuesMap) {
    if (dictAttr.decodedValuesMap[exactNorm]) return dictAttr.decodedValuesMap[exactNorm];
    if (dictAttr.decodedValuesMap[encodedNorm]) return dictAttr.decodedValuesMap[encodedNorm];
    if (relaxedNorm && dictAttr.decodedValuesMap[relaxedNorm]) return dictAttr.decodedValuesMap[relaxedNorm];
    if (compactNorm && dictAttr.decodedValuesMap[compactNorm]) return dictAttr.decodedValuesMap[compactNorm];
  }

  // Direct scan across allowedValues with exact/relaxed normalization
  for (const allowedVal of dictAttr.allowedValues) {
    const allowedExact = normalizeForDictionaryComparison(allowedVal, 'exact');
    if (allowedExact === exactNorm || allowedExact.replace(/\s+/g, '') === compactNorm) {
      return allowedVal;
    }
    if (relaxedNorm && normalizeForDictionaryComparison(allowedVal, 'relaxed') === relaxedNorm) {
      return allowedVal;
    }
  }

  // 2. Universal canonical mapper (Gender/number, all types, legal return, bracket extraction like 18+ from Makeup.ua (18+))
  const canonicalMatched = canonicalMapCandidate(rawTrimmed, dictAttr.allowedValues);
  if (canonicalMatched) {
    return canonicalMatched;
  }

  // 3. Universal synonyms & RU->UA word map
  const synonymCandidate =
    COMMON_SYNONYMS[exactNorm] ||
    COMMON_SYNONYMS[relaxedNorm] ||
    RU_TO_UA_WORDS[exactNorm] ||
    RU_TO_UA_WORDS[relaxedNorm];

  if (synonymCandidate) {
    const synExact = normalizeForDictionaryComparison(synonymCandidate, 'exact');
    const synRelaxed = normalizeForDictionaryComparison(synonymCandidate, 'relaxed');
    if (dictAttr.decodedValuesMap?.[synExact]) return dictAttr.decodedValuesMap[synExact];
    if (synRelaxed && dictAttr.decodedValuesMap?.[synRelaxed]) return dictAttr.decodedValuesMap[synRelaxed];

    for (const allowedVal of dictAttr.allowedValues) {
      if (
        normalizeForDictionaryComparison(allowedVal, 'exact') === synExact ||
        (synRelaxed && normalizeForDictionaryComparison(allowedVal, 'relaxed') === synRelaxed)
      ) {
        return allowedVal;
      }
    }
  }

  // 4. Closest equivalent in allowedValues: morphological stem match (e.g. "розважальна" <-> "розважальні")
  if (exactNorm.length >= 4) {
    const stem = exactNorm.replace(/(ий|ій|а|я|е|є|і|ї|ої|их|ім|им|ою|ому|ям|ях|ів)$/i, '');
    if (stem.length >= 4) {
      for (const allowedVal of dictAttr.allowedValues) {
        const allowedDecoded = normalizeForDictionaryComparison(allowedVal, 'exact');
        const allowedStem = allowedDecoded.replace(/(ий|ій|а|я|е|є|і|ї|ої|их|ім|им|ою|ому|ям|ях|ів)$/i, '');
        if (allowedDecoded === stem || allowedStem === stem || allowedDecoded.startsWith(stem)) {
          return allowedVal;
        }
      }
    }
  }

  // 5. Unambiguous substring / token match in allowedValues (e.g. "дихаюча сітка" -> "сітка")
  if (exactNorm.length >= 3) {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const allowedVal of dictAttr.allowedValues) {
      const allowedExact = normalizeForDictionaryComparison(allowedVal, 'exact');
      if (allowedExact.length < 3) continue;

      if (exactNorm.includes(allowedExact) || allowedExact.includes(exactNorm)) {
        const overlapLen = Math.min(exactNorm.length, allowedExact.length);
        const maxLen = Math.max(exactNorm.length, allowedExact.length);
        const score = overlapLen / maxLen;
        if (overlapLen >= 3 && score > bestScore) {
          bestScore = score;
          bestMatch = allowedVal;
        }
      }
    }

    if (bestMatch && bestScore >= 0.35) {
      return bestMatch;
    }
  }

  return null;
}

/**
 * Category-Agnostic Dictionary Enforcer:
 * Strictly validates and normalizes values for ANY column across ANY category:
 * - For `multiselect`: splits input by `;` (or `,`), validates EACH element individually against `allowedValues`,
 *   keeps ONLY valid elements, and joins them back via `; `. If no valid elements remain, returns `null` (deletes value).
 * - For `select`: strictly matches value against `allowedValues` (with universal normalization).
 *   If not found in `allowedValues`, returns `null` (deletes value).
 * - Categorically forbids writing internal hex/hash IDs or AI meta-explanations.
 * - Leaves cell completely empty `""` if no valid allowed option matches.
 */
export function enforceDictionaryValue(
  rawValue: string | null | undefined,
  colType: EpicentrColumnType,
  dictAttr?: EpicentrDictionaryAttribute
): string | null {
  if (rawValue === undefined || rawValue === null) return null;
  const cleaned = String(rawValue).replace(/[\u200b\u200c\u200d\ufeff]/g, '').trim();
  if (!cleaned || cleaned.toLowerCase() === 'nan') return null;

  // Filter internal hex/hash codes immediately
  if (isInternalHexOrHashId(cleaned)) return null;

  // Filter AI disclaimers / apologetic phrases immediately
  if (isAiDisclaimerOrServiceText(cleaned)) {
    if (dictAttr && /повернен/i.test(cleaned)) {
      const legalMatch = matchDictionaryValue(dictAttr, cleaned);
      if (legalMatch) return legalMatch;
    }
    return null;
  }

  const hasDictionary = Boolean(dictAttr && Array.isArray(dictAttr.allowedValues) && dictAttr.allowedValues.length > 0);

  // 1. MULTISELECT: Strict element-by-element validation
  if (colType === 'multiselect') {
    const rawElements = cleaned.includes(';')
      ? cleaned.split(';').map(item => item.trim())
      : cleaned.split(/[,\n]+/).map(item => item.trim());

    if (rawElements.length === 0) return null;

    const validElements: string[] = [];
    for (const element of rawElements) {
      if (!element) continue;
      if (isInternalHexOrHashId(element)) continue;
      if (isAiDisclaimerOrServiceText(element)) {
        if (dictAttr && /повернен/i.test(element)) {
          const lm = matchDictionaryValue(dictAttr, element);
          if (lm && !validElements.includes(lm)) validElements.push(lm);
        }
        continue;
      }

      if (hasDictionary && dictAttr) {
        const matched = matchDictionaryValue(dictAttr, element);
        if (matched && !validElements.includes(matched)) {
          validElements.push(matched);
        }
      } else {
        if (!validElements.includes(element)) {
          validElements.push(element);
        }
      }
    }

    if (hasDictionary) {
      return validElements.length > 0 ? validElements.join('; ') : null;
    }

    return validElements.length > 0 ? validElements.join('; ') : null;
  }

  // 2. SELECT: Strict single-option validation against allowedValues
  if (colType === 'select') {
    if (hasDictionary && dictAttr) {
      const directMatch = matchDictionaryValue(dictAttr, cleaned);
      if (directMatch) return directMatch;

      // If input contains multiple tokens separated by ; or ,, try each
      if (/[;,]/.test(cleaned)) {
        const parts = cleaned.split(/[;,]+/).map(p => p.trim()).filter(Boolean);
        for (const part of parts) {
          if (isInternalHexOrHashId(part) || isAiDisclaimerOrServiceText(part)) continue;
          const matchedPart = matchDictionaryValue(dictAttr, part);
          if (matchedPart) return matchedPart;
        }
      }

      // Guarantee zero import errors: if not in allowedValues, return null (empty cell)
      return null;
    }

    return cleaned;
  }

  // 3. ARRAY: Normalize delimiter to "; " and match against dictionary if available
  if (colType === 'array') {
    const parts = cleaned.split(/[;,]+/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    if (hasDictionary && dictAttr) {
      const validParts: string[] = [];
      for (const part of parts) {
        if (isInternalHexOrHashId(part) || isAiDisclaimerOrServiceText(part)) continue;
        const m = matchDictionaryValue(dictAttr, part);
        if (m && !validParts.includes(m)) validParts.push(m);
      }
      return validParts.length > 0 ? validParts.join('; ') : null;
    }
    const cleanParts = parts.filter(p => !isInternalHexOrHashId(p) && !isAiDisclaimerOrServiceText(p));
    return cleanParts.length > 0 ? Array.from(new Set(cleanParts)).join('; ') : null;
  }

  // 4. FLOAT: Ensure numeric format
  if (colType === 'float') {
    const numMatch = cleaned.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return numMatch ? numMatch[0] : null;
  }

  // 5. STRING / TEXT: If a dictionary exists for this attribute, normalize to canonical dictionary value when matched
  if (hasDictionary && dictAttr) {
    const matched = matchDictionaryValue(dictAttr, cleaned);
    if (matched) return matched;
  }

  return cleaned;
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

  // Find Title columns dynamically (works for "Назва товару*\n[ua]", "Назва товару [ua]*", "Назва товару", etc.)
  const titleUaCol =
    columns.find(c => c.lang === 'ua' && c.cleanName.toLowerCase().includes('назва')) ||
    columns.find(c => !c.lang && c.cleanName.toLowerCase().includes('назва'));
  const titleRuCol = columns.find(c => c.lang === 'ru' && c.cleanName.toLowerCase().includes('назва'));

  const titleUa = titleUaCol ? String(row[titleUaCol.originalName] ?? '').trim() : '';
  const titleRu = titleRuCol ? String(row[titleRuCol.originalName] ?? '').trim() : '';

  // Find Description columns dynamically (works with or without [ua]/[ru] or multiline headers)
  const descUaCol =
    columns.find(c => c.lang === 'ua' && c.cleanName.toLowerCase().includes('опис')) ||
    columns.find(c => !c.lang && c.cleanName.toLowerCase().includes('опис'));
  const descRuCol = columns.find(c => c.lang === 'ru' && c.cleanName.toLowerCase().includes('опис'));

  const descUaRaw = descUaCol ? String(row[descUaCol.originalName] ?? '') : '';
  const descRuRaw = descRuCol ? String(row[descRuCol.originalName] ?? '') : '';

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
    titleUaColName: titleUaCol?.originalName,
    titleRuColName: titleRuCol?.originalName,
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
  const titleUaCol =
    columns.find(c => c.lang === 'ua' && c.cleanName.toLowerCase().includes('назва')) ||
    columns.find(c => !c.lang && c.cleanName.toLowerCase().includes('назва'));
  const titleRuCol = columns.find(c => c.lang === 'ru' && c.cleanName.toLowerCase().includes('назва'));

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

        const cleanKey = normalizeAttributeKey(col.cleanName || col.originalName, false);
        const normKeyNoUnit = normalizeAttributeKey(col.cleanName || col.originalName, true);
        const dictAttr = findDictionaryAttr(dictionaryIndex, col.cleanName || col.originalName);

        // If the cell already has a value in the template, validate/normalize it if it's a select/multiselect with a dictionary
        if (hasExistingVal) {
          const rawExisting = String(existingVal).trim();
          if (
            dictAttr &&
            dictAttr.allowedValues.length > 0 &&
            (col.type === 'select' || col.type === 'multiselect')
          ) {
            const enforcedExisting = enforceDictionaryValue(rawExisting, col.type, dictAttr);
            if (enforcedExisting) {
              updatedRow[col.originalName] = enforcedExisting;
              if (col.isRequired) {
                alreadyFilledCount++;
              }
              diffs[col.originalName] = {
                colIndex: col.colIndex,
                columnName: col.originalName,
                isRequired: col.isRequired,
                type: col.type,
                oldValue: rawExisting,
                newValue: enforcedExisting,
                source: 'already_filled',
                confidence: 1.0,
                note:
                  enforcedExisting !== rawExisting
                    ? 'Нормалізовано за офіційним довідником Епіцентру'
                    : col.isRequired
                    ? 'Вже заповнено у шаблоні — валідне за довідником'
                    : 'Необов\'язкове поле — валідне за довідником'
              };
              return;
            } else {
              // Existing value is NOT in allowedValues and cannot be normalized -> DELETE invalid value!
              updatedRow[col.originalName] = '';
            }
          } else {
            if (col.isRequired) {
              alreadyFilledCount++;
            }
            diffs[col.originalName] = {
              colIndex: col.colIndex,
              columnName: col.originalName,
              isRequired: col.isRequired,
              type: col.type,
              oldValue: rawExisting,
              newValue: rawExisting,
              source: 'already_filled',
              confidence: 1.0,
              note: col.isRequired
                ? 'Вже заповнено у шаблоні — захищено від змін'
                : 'Необов\'язкове поле — заповнено користувачем'
            };
            return;
          }
        }

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

        // ====================================================================
        // UNIVERSAL CATEGORY-AGNOSTIC ATTRIBUTE EXTRACTION & DICTIONARY ENFORCER
        // ====================================================================
        let candidateValue: string | null = null;
        let source: EpicentrValueDiff['source'] = 'description';
        const confidence = 0.95;
        let note = '';

        const normalizedCombinedDesc = normalizeForDictionaryComparison(visuals.combinedDesc, 'exact');

        // 1. UNIVERSAL DICTIONARY-DRIVEN SCANNER (for ANY select / multiselect / dictionary-backed column in ANY category)
        if (dictAttr && dictAttr.allowedValues.length > 0) {
          const isBrandCol =
            normKeyNoUnit.includes('бренд') || normKeyNoUnit.includes('brand') || normKeyNoUnit === 'виробник';

          // Sort allowedValues by length descending so more specific multi-word options match before shorter substrings
          const sortedOptions = [...dictAttr.allowedValues].sort((a, b) => b.length - a.length);
          const matchedFromText: string[] = [];

          for (const allowedVal of sortedOptions) {
            if (isBrandCol && normalizeForDictionaryComparison(allowedVal, 'exact') === 'інше') {
              continue;
            }
            const optExact = normalizeForDictionaryComparison(allowedVal, 'exact');
            if (!optExact) continue;

            // For short tokens (1-2 chars like sizes "S", "M", "L", "42"), require strict word boundaries
            if (optExact.length <= 2) {
              const escapedShort = optExact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const boundaryRegex = new RegExp(
                `(?<![а-яіїєґёъыэa-z0-9])${escapedShort}(?![а-яіїєґёъыэa-z0-9])`,
                'i'
              );
              if (boundaryRegex.test(normalizedCombinedDesc)) {
                if (!matchedFromText.includes(allowedVal)) {
                  matchedFromText.push(allowedVal);
                }
              }
            } else {
              const stem = optExact.replace(/(ий|ій|а|я|е|є|і|ї|ої|их|ім|им|ою|ому)$/i, '');
              if (
                normalizedCombinedDesc.includes(optExact) ||
                (stem.length >= 4 && normalizedCombinedDesc.includes(stem))
              ) {
                if (!matchedFromText.includes(allowedVal)) {
                  matchedFromText.push(allowedVal);
                }
              }
            }

            if (col.type !== 'multiselect' && matchedFromText.length > 0) {
              break;
            }
          }

          // Check universal synonyms & bilingual vocabulary against this attribute's allowedValues
          if (col.type === 'multiselect' || matchedFromText.length === 0) {
            for (const [synKey, synTarget] of Object.entries(COMMON_SYNONYMS)) {
              if (normalizedCombinedDesc.includes(normalizeForDictionaryComparison(synKey, 'exact'))) {
                const resolvedSyn = matchDictionaryValue(dictAttr, synTarget);
                if (resolvedSyn && !matchedFromText.includes(resolvedSyn)) {
                  matchedFromText.push(resolvedSyn);
                  if (col.type !== 'multiselect') break;
                }
              }
            }
          }

          // Context-aware candidate generation mapped strictly through matchDictionaryValue(dictAttr, ...)
          if (matchedFromText.length === 0) {
            const contextCandidates: string[] = [];

            // Brand fallback to "Інше" if present in allowedValues
            if (isBrandCol && col.isRequired && settings.brandFallbackOther) {
              const otherOpt = matchDictionaryValue(dictAttr, 'Інше');
              if (otherOpt) {
                matchedFromText.push(otherOpt);
                isBrandOther = true;
                brandsMarkedOther.push({
                  rowIdx,
                  productId,
                  title: visuals.titleUa || `Товар #${rowIdx + 1}`,
                  originalBrand: 'Не знайдено у довіднику'
                });
                note = 'Бренд відсутній у довіднику — встановлено офіційну опцію "Інше"';
              }
            }

            // Color candidates from visual/text analysis
            if (normKeyNoUnit.includes('колір') && visuals.detectedPrimaryColor) {
              contextCandidates.push(visuals.detectedPrimaryColor);
              source = 'photo';
            }

            // Pattern candidates
            if (
              (normKeyNoUnit.includes('візерунок') || normKeyNoUnit.includes('узор') || normKeyNoUnit.includes('принт')) &&
              visuals.patternType
            ) {
              contextCandidates.push(visuals.patternType);
              source = 'photo';
            }

            // Packaging unit candidates
            if (normKeyNoUnit.includes('одиниця виміру') || normKeyNoUnit.includes('одиниці виміру')) {
              contextCandidates.push(visuals.unitValue, 'шт.');
            }

            // Age candidates
            if (
              (normKeyNoUnit === 'вік' || normKeyNoUnit.includes('вік дитини') || normKeyNoUnit.includes('рекомендований вік')) &&
              visuals.parsedAge.minAge !== undefined
            ) {
              const minAge = visuals.parsedAge.minAge;
              contextCandidates.push(
                `від ${minAge} років`,
                `від ${minAge} року`,
                `${minAge} років`,
                `${minAge} роки`,
                `${minAge} рік`,
                `${minAge}+`
              );
            }

            // Players count candidates
            if (normKeyNoUnit.includes('гравців') && visuals.parsedPlayers.formatted) {
              contextCandidates.push(visuals.parsedPlayers.formatted);
              if (visuals.parsedPlayers.minPlayers && visuals.parsedPlayers.maxPlayers) {
                contextCandidates.push(
                  `від ${visuals.parsedPlayers.minPlayers} до ${visuals.parsedPlayers.maxPlayers}`,
                  `${visuals.parsedPlayers.minPlayers} - ${visuals.parsedPlayers.maxPlayers}`
                );
              }
            }

            // Gender / Sex candidates
            if (normKeyNoUnit === 'стать' || normKeyNoUnit.includes('стать дитини')) {
              const hasGirl = /дівчат|дівчин|девоч/i.test(normalizedCombinedDesc);
              const hasBoy = /хлопч|хлопц|мальчик/i.test(normalizedCombinedDesc);
              const hasWomen = /жіноч|для жінок|женск/i.test(normalizedCombinedDesc);
              const hasMen = /чоловіч|для чоловіків|мужск/i.test(normalizedCombinedDesc);
              if (hasGirl && !hasBoy) contextCandidates.push('для дівчаток', 'дівчинка', 'жіноча');
              else if (hasBoy && !hasGirl) contextCandidates.push('для хлопчиків', 'хлопчик', 'чоловіча');
              else if (hasWomen && !hasMen) contextCandidates.push('для жінок', 'жіноча', 'жіночий');
              else if (hasMen && !hasWomen) contextCandidates.push('для чоловіків', 'чоловіча', 'чоловічий');
              else contextCandidates.push('для хлопчиків; для дівчаток', 'унісекс');
            }

            for (const cand of contextCandidates) {
              const enforcedCand = enforceDictionaryValue(cand, col.type, dictAttr);
              if (enforcedCand) {
                matchedFromText.push(enforcedCand);
                break;
              }
            }
          }

          if (matchedFromText.length > 0) {
            candidateValue = col.type === 'multiselect' ? matchedFromText.join('; ') : matchedFromText[0];
            if (isBrandCol && candidateValue) {
              detectedBrand = candidateValue;
            }
            if (!note) {
              note =
                col.type === 'multiselect'
                  ? 'Мультиселект: елементи перевірено та зібрано за офіційним довідником'
                  : 'Підібрано та нормалізовано за офіційним довідником атрибута';
            }
          }
        }

        // 2. UNIVERSAL METRIC, NUMERIC & TEXT EXTRACTORS (for float/string/text or columns without fixed dictionary)
        if (!candidateValue && (!dictAttr || dictAttr.allowedValues.length === 0)) {
          // Dimensions (mm / cm)
          if (
            normKeyNoUnit.includes('висота') ||
            normKeyNoUnit.includes('ширина') ||
            normKeyNoUnit.includes('глибина') ||
            normKeyNoUnit.includes('довжина') ||
            normKeyNoUnit.includes('розмір упаковки') ||
            normKeyNoUnit.includes('розміри упаковки')
          ) {
            const dims = visuals.parsedDimensions;
            const isCmTarget = col.unit === 'см' || cleanKey.includes('(см)');
            const formatDim = (mmVal?: number): string | null => {
              if (!mmVal || mmVal <= 0) return null;
              return isCmTarget ? String(Number((mmVal / 10).toFixed(1))) : String(Math.round(mmVal));
            };

            if (normKeyNoUnit.includes('висота')) candidateValue = formatDim(dims.heightMm);
            else if (normKeyNoUnit.includes('ширина')) candidateValue = formatDim(dims.widthMm);
            else if (normKeyNoUnit.includes('глибина')) candidateValue = formatDim(dims.depthMm);
            else if (normKeyNoUnit.includes('довжина')) candidateValue = formatDim(dims.lengthMm || dims.heightMm);
            else if (dims.heightMm && dims.widthMm && dims.depthMm) {
              candidateValue = isCmTarget
                ? `${dims.heightMm / 10}х${dims.widthMm / 10}х${dims.depthMm / 10} см`
                : `${dims.heightMm}х${dims.widthMm}х${dims.depthMm} мм`;
            }

            if (candidateValue) {
              note = 'Габарити витягнуто з тексту з автоматичним перерахунком одиниць';
            }
          }
          // Weight (g / kg)
          else if (normKeyNoUnit.includes('вага') || normKeyNoUnit.includes('маса')) {
            const weightG = visuals.parsedWeightGrams;
            if (weightG !== undefined && weightG > 0) {
              const isKgTarget = col.unit === 'кг' || cleanKey.includes('(кг)');
              candidateValue = isKgTarget
                ? String(Number((weightG / 1000).toFixed(3)))
                : String(Math.round(weightG));
              note = 'Вагу витягнуто з опису/назви товару';
            }
          }
          // Manufacturer color (free string)
          else if (normKeyNoUnit.includes('колір виробника') && visuals.detectedManufacturerColor) {
            candidateValue = visuals.detectedManufacturerColor;
            source = 'photo';
            note = 'Точний відтінок за фото та назвою';
          }
          // Primary color when no dictionary file was loaded
          else if (
            (normKeyNoUnit === 'колір' || normKeyNoUnit === 'базовий колір') &&
            visuals.detectedPrimaryColor &&
            col.type !== 'select' &&
            col.type !== 'multiselect'
          ) {
            candidateValue = visuals.detectedPrimaryColor;
            source = 'photo';
          }
          // Generic float extractor by unit or label in description
          else if (col.type === 'float') {
            const escapedLabel = normKeyNoUnit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const labelNumMatch =
              escapedLabel.length >= 3
                ? normalizedCombinedDesc.match(new RegExp(`${escapedLabel}[\\s:=-]*(\\d+(?:[.,]\\d+)?)`, 'i'))
                : null;
            if (labelNumMatch && labelNumMatch[1]) {
              candidateValue = labelNumMatch[1].replace(',', '.');
              note = 'Числове значення витягнуто з тексту опису';
            }
          }
        }

        // 3. STRICT FINAL DICTIONARY ENFORCEMENT GATE
        // For ANY select or multiselect column with allowedValues, validate through enforceDictionaryValue.
        // If not in allowedValues -> DELETE (set to null) so no invalid value ever enters Excel!
        const filledValue = enforceDictionaryValue(candidateValue, col.type, dictAttr);

        // Finalize value check
        if (filledValue) {
          updatedRow[col.originalName] = filledValue;
          newlyFilledCount++;
          diffs[col.originalName] = {
            colIndex: col.colIndex,
            columnName: col.originalName,
            isRequired: col.isRequired,
            type: col.type,
            oldValue: hasExistingVal ? String(existingVal) : '',
            newValue: filledValue,
            source,
            confidence,
            note: note || (col.isRequired ? 'Обов\'язкова характеристика з опису/довідника' : 'Додаткова характеристика з опису/довідника')
          };
        } else if (col.isRequired) {
          // Mandatory field could NOT be filled with a valid dictionary option
          unfilledMandatoryCount++;
          unfilledRequiredFields.push(col.originalName);

          if (!unfilledCountsMap[col.cleanName]) {
            unfilledCountsMap[col.cleanName] = {
              count: 0,
              affectedIds: [],
              reason: 'Інформація відсутня в описі або значення не входить до дозволених опцій довідника (allowedValues)'
            };
          }
          unfilledCountsMap[col.cleanName].count++;
          unfilledCountsMap[col.cleanName].affectedIds.push(productId);
        }
      });

      // Step 4: Product Title Reformatting & strict preservation under col.originalName
      const originalTitleUa = titleUaCol ? String(row[titleUaCol.originalName] ?? '').trim() : visuals.titleUa;
      const originalTitleRu = titleRuCol ? String(row[titleRuCol.originalName] ?? '').trim() : visuals.titleRu;

      let titleFormattedUa = titleUaCol
        ? String(updatedRow[titleUaCol.originalName] ?? originalTitleUa).trim()
        : originalTitleUa;
      let titleFormattedRu = titleRuCol
        ? String(updatedRow[titleRuCol.originalName] ?? originalTitleRu).trim()
        : originalTitleRu;

      if (settings.reformatTitles) {
        if (titleFormattedUa) {
          titleFormattedUa = formatEpicentrTitle({
            rawTitle: titleFormattedUa,
            sku: visuals.sku,
            color: visuals.detectedManufacturerColor || visuals.detectedPrimaryColor,
            brand: detectedBrand || undefined,
            lang: 'ua'
          });
        }

        if (titleFormattedRu) {
          titleFormattedRu = formatEpicentrTitle({
            rawTitle: titleFormattedRu,
            sku: visuals.sku,
            color: visuals.detectedManufacturerColor || visuals.detectedPrimaryColor,
            brand: detectedBrand || undefined,
            lang: 'ru'
          });
        }
      }

      if (titleUaCol) {
        updatedRow[titleUaCol.originalName] = titleFormattedUa || originalTitleUa;
      }
      if (titleRuCol) {
        updatedRow[titleRuCol.originalName] = titleFormattedRu || originalTitleRu;
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
      titleOriginal: originalTitleUa || originalTitleRu || `Товар #${rowIdx + 1}`,
      titleFormattedUa: titleFormattedUa || originalTitleUa,
      titleFormattedRu: titleFormattedRu || originalTitleRu,
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
  columns: EpicentrColumn[],
  dictionaryIndex?: Record<string, EpicentrDictionaryAttribute>
): XLSX.WorkBook {
  const titleUaCol =
    columns.find(c => c.lang === 'ua' && c.cleanName.toLowerCase().includes('назва')) ||
    columns.find(c => !c.lang && c.cleanName.toLowerCase().includes('назва'));
  const titleRuCol = columns.find(c => c.lang === 'ru' && c.cleanName.toLowerCase().includes('назва'));

  // Helper to resolve value for any column while strictly preserving UA and RU product titles in their original template columns
  // and enforcing dictionary rules on select/multiselect columns
  const resolveExportCellValue = (pRow: EpicentrProductRow, col: EpicentrColumn): any => {
    if (titleUaCol && col.originalName === titleUaCol.originalName) {
      const uaVal =
        pRow.updatedRow[titleUaCol.originalName] ||
        pRow.titleFormattedUa ||
        (pRow.originalRow ? pRow.originalRow[titleUaCol.originalName] : '') ||
        pRow.titleOriginal ||
        '';
      pRow.updatedRow[titleUaCol.originalName] = uaVal;
      return uaVal;
    }

    if (titleRuCol && col.originalName === titleRuCol.originalName) {
      const ruVal =
        pRow.updatedRow[titleRuCol.originalName] ||
        pRow.titleFormattedRu ||
        (pRow.originalRow ? pRow.originalRow[titleRuCol.originalName] : '') ||
        '';
      pRow.updatedRow[titleRuCol.originalName] = ruVal;
      return ruVal;
    }

    const hasExplicitUpdatedKey = Object.prototype.hasOwnProperty.call(pRow.updatedRow, col.originalName);
    const candidateVal = hasExplicitUpdatedKey
      ? pRow.updatedRow[col.originalName]
      : pRow.originalRow
      ? pRow.originalRow[col.originalName]
      : '';

    if (candidateVal === undefined || candidateVal === null || String(candidateVal).trim() === '') {
      return '';
    }

    const candStr = String(candidateVal).trim();

    // STRICT REQUIREMENT 1 & 2: Categorically forbid writing hex codes, IDs, or AI disclaimers to output Excel
    if (isInternalHexOrHashId(candStr) || isAiDisclaimerOrServiceText(candStr)) {
      return '';
    }

    if ((col.type === 'select' || col.type === 'multiselect') && dictionaryIndex) {
      const dictAttr = findDictionaryAttr(dictionaryIndex, col.cleanName || col.originalName);
      if (dictAttr && dictAttr.allowedValues.length > 0) {
        const enforced = enforceDictionaryValue(candStr, col.type, dictAttr);
        return enforced ?? '';
      }
    }

    if (col.type === 'multiselect') {
      const enforced = enforceDictionaryValue(candStr, 'multiselect');
      return enforced ?? '';
    }

    if (col.type === 'select' && dictionaryIndex) {
      const dictAttr = findDictionaryAttr(dictionaryIndex, col.cleanName || col.originalName);
      if (dictAttr && dictAttr.allowedValues.length > 0) {
        return '';
      }
    }

    return candidateVal;
  };

  // Determine sheet name: preserve exact original sheet name or default to 'Worksheet'
  const targetSheetName =
    originalWorkbook && originalWorkbook.SheetNames && originalWorkbook.SheetNames.length > 0
      ? originalWorkbook.SheetNames[0]
      : 'Worksheet';

  let wb: XLSX.WorkBook;

  if (originalWorkbook && originalWorkbook.SheetNames.length > 0) {
    wb = JSON.parse(JSON.stringify(originalWorkbook));
    const ws = wb.Sheets[targetSheetName];

    // Detect the actual header row index in the original worksheet (usually row 0, or row 1+ if merged group titles exist)
    let headerRowIdx = 0;
    const colIndexByOriginalName = new Map<string, number>();
    const normalizeCellHeader = (s: string) => String(s || '').replace(/\r\n/g, '\n').trim();

    for (let r = 0; r < 10; r++) {
      let matchCount = 0;
      const candidateMap = new Map<string, number>();
      for (let c = 0; c < Math.max(columns.length + 20, 150); c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        const cellVal = ws[ref]?.v !== undefined ? normalizeCellHeader(String(ws[ref].v)) : '';
        if (!cellVal) continue;
        const matchedCol = columns.find(col => normalizeCellHeader(col.originalName) === cellVal);
        if (matchedCol) {
          matchCount++;
          candidateMap.set(matchedCol.originalName, c);
        }
      }
      if (matchCount >= Math.min(2, columns.length)) {
        headerRowIdx = r;
        candidateMap.forEach((colIdx, origName) => colIndexByOriginalName.set(origName, colIdx));
        break;
      }
    }

    // Mirror exact header names with \n and exact original comments (NO artificial ATTR_ comments)
    columns.forEach((col, cIdx) => {
      const targetColIdx = colIndexByOriginalName.get(col.originalName) ?? col.colIndex ?? cIdx;
      const headerCellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c: targetColIdx });

      // Guarantee exact original name preserving \n
      if (!ws[headerCellRef]) {
        ws[headerCellRef] = { t: 's', v: col.originalName };
      } else {
        ws[headerCellRef].v = col.originalName;
        ws[headerCellRef].t = 's';
      }

      // Restore exact original comment (e.g. {"key":"title.ua","languageCode":"ua"})
      if (col.rawComment) {
        const commentObj: any = {
          a: 'Epicentr',
          t: col.rawComment,
          hidden: true,
          visible: false
        };
        const commentsList: any = [commentObj];
        commentsList.hidden = true;
        ws[headerCellRef].c = commentsList;
      } else if (ws[headerCellRef] && Array.isArray(ws[headerCellRef].c)) {
        (ws[headerCellRef].c as any).hidden = true;
        ws[headerCellRef].c.forEach((comment: any) => {
          comment.hidden = true;
          comment.visible = false;
        });
      }
    });

    // Update cell data only, leaving header row(s) (with comments and JSON metadata) completely intact!
    processedRows.forEach((pRow, rIdx) => {
      const targetRowIdx = headerRowIdx + 1 + rIdx;
      columns.forEach((col, cIdx) => {
        const targetColIdx = colIndexByOriginalName.get(col.originalName) ?? col.colIndex ?? cIdx;
        const cellAddress = XLSX.utils.encode_cell({ r: targetRowIdx, c: targetColIdx });
        const val = resolveExportCellValue(pRow, col);

        if (!ws[cellAddress]) {
          ws[cellAddress] = { t: typeof val === 'number' ? 'n' : 's', v: typeof val === 'number' ? val : String(val) };
        } else {
          ws[cellAddress].v = typeof val === 'number' ? val : String(val);
          ws[cellAddress].t = typeof val === 'number' ? 'n' : 's';
        }
      });
    });

    // Update range
    const maxRow = headerRowIdx + 1 + processedRows.length;
    const maxCol = Math.max(columns.length, ...Array.from(colIndexByOriginalName.values()).map(v => v + 1));
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(0, maxRow - 1), c: Math.max(0, maxCol - 1) }
    });
  } else {
    // Generate new valid workbook if no file was uploaded, preserving exact sheetName 'Worksheet'
    wb = XLSX.utils.book_new();
    const headers = columns.map(c => c.originalName);
    const dataRows = processedRows.map(p => {
      return columns.map(c => resolveExportCellValue(p, c));
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    
    // Attach exact original comments to header cells (strictly forbidden to generate ATTR_ codes)
    columns.forEach((col, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
      if (ws[cellRef]) {
        ws[cellRef].v = col.originalName;
        ws[cellRef].t = 's';

        if (col.rawComment) {
          const commentObj: any = {
            a: 'Epicentr',
            t: col.rawComment,
            hidden: true,
            visible: false
          };
          const commentsList: any = [commentObj];
          commentsList.hidden = true;
          ws[cellRef].c = commentsList;
        } else {
          delete ws[cellRef].c;
        }
      }
    });

    XLSX.utils.book_append_sheet(wb, ws, targetSheetName);
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
