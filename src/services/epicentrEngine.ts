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
 * Normalizes Excel column header names:
 * Strips all carriage returns \r and XML escape sequences like _x000d_ / _x000D_,
 * converting them into canonical clean Unix linebreaks (\n),
 * and trims outer whitespace while preserving the canonical clean linebreak \n.
 * (e.g. "Назва товару*\r\n[ua]" or "Назва товару*_x000d_\n[ua]" -> "Назва товару*\n[ua]")
 */
export function normalizeEpicentrHeaderName(name: string): string {
  if (!name) return '';
  return String(name)
    .replace(/_x000[dD]_\n?/g, '\n')
    .replace(/_x000[dD]_/gi, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n+/g, '\n')
    .trim();
}

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

  // Hex codes starting with 0x (e.g. 0x5b78c0e9)
  if (/^0x[0-9a-f]{6,}$/i.test(s)) {
    return true;
  }

  // Pure hex hashes >= 6 characters with mixed letters and numbers (e.g. "5b78c0e9", "cfd9340c", "cfd9340cf7d5")
  if (/^[0-9a-f]{6,}$/i.test(s) && /\d/.test(s) && /[a-f]/i.test(s)) {
    return true;
  }

  // Pure hex strings of 8+ characters (MD5/SHA or 32-bit hex blocks)
  if (/^[0-9a-f]{8,}$/i.test(s)) {
    return true;
  }

  // System prefixes (opt_, attr_, val_, code_, id_, option_)
  if (/^(opt_|attr_|val_|code_|id_|option_)[a-z0-9_-]+$/i.test(s)) {
    return true;
  }

  // Alphanumeric hashes / option codes >= 8 characters with digits and letters (e.g. "a8xqzwivcojproo", "opt_cfd9340c")
  if (/^[a-z0-9_-]{8,}$/i.test(s) && /\d/.test(s) && /[a-z]/i.test(s) && !/^(bluetooth|wireless|rechargeable|waterproof|mechanical|electronic)/i.test(s)) {
    return true;
  }

  // Specifically check known random alphanumeric hash identifiers like "a8xqzwivcojproo" (base36 hashes)
  if (/^[a-z0-9]{10,}$/i.test(s) && !/^(bluetooth|wireless|rechargeable|waterproof|mechanical|electronic)/i.test(s)) {
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
  'низкая': 'низька',
  'нидерланды': 'Нідерланди',
  'франция': 'Франція',
  'польша': 'Польща',
  'германия': 'Німеччина',
  'италия': 'Італія',
  'испания': 'Іспанія',
  'великобритания': 'Велика Британія',
  'англия': 'Велика Британія',
  'китай': 'Китай',
  'сша': 'США',
  'швеция': 'Швеція',
  'швейцария': 'Швейцарія',
  'турция': 'Туреччина',
  'корея': 'Корея',
  'япония': 'Японія',
  'чехия': 'Чехія',
  'масс-маркет': 'Мас-маркет',
  'массмаркет': 'Мас-маркет',
  'миддл-маркет': 'Мідл-маркет',
  'миддлмаркет': 'Мідл-маркет',
  'мидл-маркет': 'Мідл-маркет',
  'натуральная': 'Натуральна',
  'профессиональная': 'Професійна',
  'органическая': 'Органічна'
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
  'орнамент': 'з візерунком',
  // Косметичні та доглядові характеристики (Призначення, Вид, Склад набору, Стать)
  'об\'єм': 'надання об\'єму',
  'об’єм': 'надання об\'єму',
  'объем': 'надання об\'єму',
  'надання об\'єму': 'для об\'єму',
  'надання блиску': 'блиск',
  'зволоження': 'для зволоження',
  'увлажнение': 'для зволоження',
  'очищення': 'для очищення',
  'очищение': 'для очищення',
  'живлення': 'для живлення',
  'питание': 'для живлення',
  'відновлення': 'для відновлення',
  'восстановление': 'для відновлення',
  'догляд': 'для догляду',
  'уход': 'для догляду',
  'пом\'якшення': 'для пом\'якшення',
  'смягчение': 'для пом\'якшення',
  'зміцнення': 'для зміцнення',
  'укрепление': 'для зміцнення',
  'захист': 'для захисту',
  'защита': 'для захисту',
  'тонізація': 'для тонізації',
  'заспокоєння': 'для заспокоєння',
  'матування': 'для матування',
  'розгладження': 'для розгладження',
  'обличчя': 'для обличчя',
  'лицо': 'для обличчя',
  'тіло': 'для тіла',
  'тело': 'для тіла',
  'волосся': 'для волосся',
  'волосы': 'для волосся',
  'шкіра': 'для шкіри',
  'кожа': 'для шкіри',
  'руки': 'для рук',
  'ноги': 'для ніг',
  'щоденне використання': 'для щоденного використання',
  'щоденний догляд': 'для щоденного використання',
  'косметичний набір': 'набір',
  'набір косметики': 'косметичний набір',
  'подарунковий набір': 'косметичний набір'
};

/**
 * Automatically strips service prefixes and suffixes common across retail catalog specs:
 * Prefixes: "Для ", "для ", "з ", "зі ", "із ", "без ", "від ", "під "
 * Suffixes: " для волосся", " для тіла", " для обличчя", " для шкіри", " для авто", " для дому",
 *           " для ванної", " для кухні", " для рук", " для ніг", " волосся", " шкіри", " тіла", " обличчя"
 * (e.g. "Для очищення" -> "очищення", "Для зволоження волосся" -> "зволоження")
 */
export function stripServiceAffixes(str: string): string {
  if (!str) return '';
  let s = str.trim();

  // Strip prefixes
  s = s.replace(/^(для\s+(?:всіх\s+)?(?:типів\s+)?|для\s+|з\s+|зі\s+|із\s+|без\s+|від\s+|під\s+)/i, '').trim();

  // Strip suffixes
  s = s.replace(
    /(\s+для\s+волосся|\s+для\s+тіла|\s+для\s+обличчя|\s+для\s+шкіри|\s+для\s+авто|\s+для\s+автомобіля|\s+для\s+дому|\s+для\s+ванної|\s+для\s+кухні|\s+для\s+рук|\s+для\s+ніг|\s+волосся|\s+шкіри|\s+тіла|\s+обличчя)$/i,
    ''
  ).trim();

  return s;
}

/**
 * Universal morphological stemmer across Ukrainian & Russian retail catalogs.
 * Handles cases, genders, numbers, materials, and categories:
 * - 'бавовняні' / 'бавовняна' / 'бавовняний' -> 'бавовна'
 * - 'чоловічий' / 'чоловіча' -> 'чоловічі'
 * - 'шампуні' -> 'шампунь'
 * - 'дрелі' / 'дрилі' -> 'дрель' / 'дриль'
 */
export function universalStemWord(word: string): string[] {
  if (!word) return [];
  const lower = word.toLowerCase().trim();
  const results = new Set<string>();
  results.add(lower);

  // Direct known morphological stems & material forms
  if (/^бавовн(ян[а-я]|а|і|и|ою|і|ів)?$/i.test(lower) || /^хлоп(ок|ков[а-я])$/i.test(lower)) {
    results.add('бавовна');
    results.add('бавовняні');
    results.add('хлопок');
  }
  if (/^шовк(ов[а-я]|у)?$/i.test(lower) || /^шелк(ов[а-я])?$/i.test(lower)) {
    results.add('шовк');
  }
  if (/^ль(он|ляний|ляна|ляні|ляного)$/i.test(lower)) {
    results.add('льон');
  }
  if (/^вовн(ян[а-я]|а|и)?$/i.test(lower) || /^шерст(ян[а-я]|ь)?$/i.test(lower)) {
    results.add('вовна');
  }
  if (/^дерев('?ян[а-я]|о|а)?$/i.test(lower)) {
    results.add('дерево');
  }
  if (/^метал(ев[а-я]|ічн[а-я]|л)?$/i.test(lower)) {
    results.add('метал');
  }
  if (/^шкір(ян[а-я]|а|и)?$/i.test(lower) || /^кож(ан[а-я]|а)?$/i.test(lower)) {
    results.add('шкіра');
  }
  if (/^гум(ов[а-я]|а)?$/i.test(lower) || /^резин(ов[а-я]|а)?$/i.test(lower)) {
    results.add('гума');
  }
  if (/^скл(ян[а-я]|о)?$/i.test(lower) || /^стекл(ян[а-я]|о)?$/i.test(lower)) {
    results.add('скло');
  }
  if (/^пластик(ов[а-я])?$/i.test(lower)) {
    results.add('пластик');
  }
  if (/^папер(ов[а-я]|ір)?$/i.test(lower) || /^бумаг(а)?$/i.test(lower)) {
    results.add('папір');
  }
  if (/^текстиль(н[а-я])?$/i.test(lower)) {
    results.add('текстиль');
  }

  // Gender & number canonical targets
  if (/^(чоловіч[а-я]|мужск[а-я]|для\s+чоловіків)$/i.test(lower)) {
    results.add('чоловічі');
  }
  if (/^(жіноч[а-я]|женск[а-я]|для\s+жінок)$/i.test(lower)) {
    results.add('жіночі');
  }
  if (/^(дитяч[а-я]|детск[а-я]|для\s+дітей)$/i.test(lower)) {
    results.add('дитячі');
  }

  // Nouns plural -> singular transformations
  if (lower.endsWith('ні') && lower.length >= 4) {
    results.add(lower.slice(0, -2) + 'нь'); // шампуні -> шампунь
  }
  if ((lower.endsWith('лі') || lower.endsWith('ли')) && lower.length >= 4) {
    results.add(lower.slice(0, -2) + 'ль'); // дрелі -> дрель, дрилі -> дриль
  }
  if (lower.endsWith('ла') && lower.length >= 4) {
    results.add(lower.slice(0, -2) + 'ло'); // крісла -> крісло
  }
  if (lower.endsWith('ки') && lower.length >= 4) {
    results.add(lower.slice(0, -2) + 'ка'); // викрутки -> викрутка, маски -> маска
  }
  if (lower.endsWith('ти') && lower.length >= 4) {
    results.add(lower.slice(0, -2) + 'тка'); // сироватки -> сироватка
  }
  if (lower.endsWith('ри') && lower.length >= 4) {
    results.add(lower.slice(0, -1)); // перфоратори -> перфоратор
  }
  if (lower.endsWith('ти') && lower.length >= 4) {
    results.add(lower.slice(0, -1)); // шурупокрути -> шурупокрут
  }

  // Strip adjectival endings
  const adjStem = lower.replace(
    /(?:ний|на|не|ні|ного|ному|ним|них|ною|ній|овий|ова|ове|ові|ового|овому|овим|ових|овою|овій|ський|ська|ське|ські|ського|ському|ським|ських|ською|ській|яний|яна|яне|яні|яного|яному|яним|яних|яною|яній|ий|ій|а|я|е|є|і|ї|ої|их|ім|им|ою|ому|ям|ях|ів|ой|ей|ом|ем|ам|ами|ями)$/i,
    ''
  );
  if (adjStem && adjStem.length >= 3) {
    results.add(adjStem);
  }

  return Array.from(results);
}

/**
 * Universal Bidirectional Category-Agnostic Option Matcher:
 * Matches a candidate value against allowedValues with:
 * 1. Step A (Exact Match): Checks raw candidate and symmetric entity/apostrophe normalized version in allowedValues.
 * 2. Step B (Bidirectional 'для ' Search):
 *    - If input lacks 'для ', generates counter-variant 'для ${input}' and searches allowedValues.
 *    - If input has 'для ', generates counter-variant without 'для ' and searches allowedValues.
 *    - Bidirectionally tests contextual domain suffixes without blind stripping.
 * 3. Step C (Canonical Selection, Synonyms & Morphology):
 *    - Tests canonical categories (gender/number, return policies, brackets)
 *    - Universal synonyms (COMMON_SYNONYMS) and translations (RU_TO_UA_WORDS) with bidirectional testing
 *    - Universal morphological stemmer
 *    - Standalone token/word boundary matching
 * 4. 100% Dictionary Compliance:
 *    - Returns STRICTLY the exact canonical string from allowedValues, or null if no match is found.
 */
export function matchSingleOptionAgainstAllowed(
  candidate: string,
  allowedValues: string[]
): string | null {
  if (!candidate || !Array.isArray(allowedValues) || allowedValues.length === 0) return null;

  const rawTrimmed = String(candidate).replace(/[\u200b\u200c\u200d\ufeff]/g, '').trim();
  if (!rawTrimmed || rawTrimmed.toLowerCase() === 'nan') return null;

  // Strict check: Forbid internal hex/hash IDs
  if (isInternalHexOrHashId(rawTrimmed)) return null;

  // Strict check: Forbid AI disclaimers / explanations / apologies
  if (isAiDisclaimerOrServiceText(rawTrimmed)) {
    if (/повернен/i.test(rawTrimmed) || /постанов.*кабінет/i.test(rawTrimmed)) {
      const legalMapped = canonicalMapCandidate(rawTrimmed, allowedValues);
      if (legalMapped) return legalMapped;
    }
    return null;
  }

  // Inner helper: Symmetrically test if any entry in allowedValues matches target string
  // Handles HTML entities (&#039; <-> '), Unicode apostrophes (’ ` ʻ ʼ ‘ ´), quotes, case, and whitespace
  const findInAllowed = (testStr: string): string | null => {
    if (!testStr) return null;
    const testTrim = testStr.trim();
    if (!testTrim || isInternalHexOrHashId(testTrim)) return null;

    // 1. Literal exact check
    const literal = allowedValues.find(v => v === testTrim);
    if (literal && !isInternalHexOrHashId(literal)) return literal;

    // 2. Symmetric entity & apostrophe normalization
    const testDecoded = decodeHtmlEntities(testTrim).replace(/[’`ʻʼ']/g, "'").replace(/["«»„“”]/g, '"').trim();
    const testExactNorm = normalizeForDictionaryComparison(testDecoded, 'exact');
    const testRelaxedNorm = normalizeForDictionaryComparison(testDecoded, 'relaxed');
    const testCompactNorm = testExactNorm.replace(/\s+/g, '');

    for (const allowedVal of allowedValues) {
      if (!allowedVal || isInternalHexOrHashId(allowedVal)) continue;

      const aDecoded = decodeHtmlEntities(allowedVal).replace(/[’`ʻʼ']/g, "'").replace(/["«»„“”]/g, '"').trim();
      if (aDecoded.toLowerCase() === testDecoded.toLowerCase()) {
        return allowedVal;
      }

      const aExactNorm = normalizeForDictionaryComparison(allowedVal, 'exact');
      if (aExactNorm === testExactNorm) {
        return allowedVal;
      }

      if (testCompactNorm && aExactNorm.replace(/\s+/g, '') === testCompactNorm) {
        return allowedVal;
      }

      if (testRelaxedNorm && normalizeForDictionaryComparison(allowedVal, 'relaxed') === testRelaxedNorm) {
        return allowedVal;
      }
    }

    return null;
  };

  const decodedRaw = decodeHtmlEntities(rawTrimmed).replace(/[’`ʻʼ']/g, "'").replace(/["«»„“”]/g, '"').trim();

  // =========================================================================
  // Крок А (Точний збіг): Якщо rawValue є у allowedValues — повертай його
  // =========================================================================
  const exactMatch = findInAllowed(decodedRaw);
  if (exactMatch) {
    return exactMatch;
  }

  // =========================================================================
  // Крок Б (Двонаправлений пошук 'для '):
  // Якщо входження не знайдено, генеруємо 2 варіанти: ${rawValue} та для ${rawValue}
  // (і навпаки: якщо у rawValue вже є 'для ' — шукаємо варіант без 'для ')
  // =========================================================================
  const hasDlyaPrefix = /^для\s+/i.test(decodedRaw);
  const variantWithoutDlya = hasDlyaPrefix ? decodedRaw.replace(/^для\s+/i, '').trim() : decodedRaw;
  const variantWithDlya = hasDlyaPrefix ? decodedRaw : `для ${decodedRaw}`;

  if (hasDlyaPrefix) {
    // Вхідне містило 'для ' (наприклад, "Для очищення") -> шукаємо варіант без 'для ' (наприклад, "очищення")
    const matchWithout = findInAllowed(variantWithoutDlya);
    if (matchWithout) {
      return matchWithout;
    }
  } else {
    // Вхідне не містило 'для ' (наприклад, "обличчя") -> шукаємо варіант з 'для ' (наприклад, "для обличчя")
    const matchWith = findInAllowed(variantWithDlya);
    if (matchWith) {
      return matchWith;
    }
  }

  // Двонаправлені семантичні трансформації для полів 'Призначення*' та 'Стать*'
  const lowerDecoded = decodedRaw.toLowerCase();
  if (lowerDecoded.includes("об'єм") || lowerDecoded.includes("об’єм") || lowerDecoded.includes("объем")) {
    const volMatch = findInAllowed("надання об'єму") || findInAllowed("для об'єму") || findInAllowed("для надання об'єму") || findInAllowed("об'єм");
    if (volMatch) return volMatch;
  }
  if (lowerDecoded.startsWith('надання ')) {
    const withoutAction = lowerDecoded.replace(/^надання\s+/i, '').trim();
    const actionMatch = findInAllowed(withoutAction) || findInAllowed(`для ${withoutAction}`);
    if (actionMatch) return actionMatch;
  }
  if (lowerDecoded === 'зволоження') {
    const m = findInAllowed('для зволоження');
    if (m) return m;
  } else if (lowerDecoded === 'для зволоження') {
    const m = findInAllowed('зволоження');
    if (m) return m;
  }
  if (lowerDecoded === 'очищення') {
    const m = findInAllowed('для очищення');
    if (m) return m;
  } else if (lowerDecoded === 'для очищення') {
    const m = findInAllowed('очищення');
    if (m) return m;
  }
  if (lowerDecoded === 'живлення') {
    const m = findInAllowed('для живлення');
    if (m) return m;
  } else if (lowerDecoded === 'для живлення') {
    const m = findInAllowed('живлення');
    if (m) return m;
  }
  if (lowerDecoded === 'відновлення') {
    const m = findInAllowed('для відновлення');
    if (m) return m;
  } else if (lowerDecoded === 'для відновлення') {
    const m = findInAllowed('відновлення');
    if (m) return m;
  }
  if (lowerDecoded === 'догляд') {
    const m = findInAllowed('для догляду') || findInAllowed('для щоденного використання');
    if (m) return m;
  } else if (lowerDecoded === 'для догляду') {
    const m = findInAllowed('догляд');
    if (m) return m;
  }
  if (lowerDecoded === 'обличчя') {
    const m = findInAllowed('для обличчя');
    if (m) return m;
  } else if (lowerDecoded === 'для обличчя') {
    const m = findInAllowed('обличчя');
    if (m) return m;
  }
  if (lowerDecoded === 'тіло') {
    const m = findInAllowed('для тіла');
    if (m) return m;
  } else if (lowerDecoded === 'для тіла') {
    const m = findInAllowed('тіло');
    if (m) return m;
  }
  if (lowerDecoded === 'волосся') {
    const m = findInAllowed('для волосся');
    if (m) return m;
  } else if (lowerDecoded === 'для волосся') {
    const m = findInAllowed('волосся');
    if (m) return m;
  }
  if (lowerDecoded === 'руки') {
    const m = findInAllowed('для рук');
    if (m) return m;
  } else if (lowerDecoded === 'для рук') {
    const m = findInAllowed('руки');
    if (m) return m;
  }
  if (lowerDecoded === 'ноги') {
    const m = findInAllowed('для ніг');
    if (m) return m;
  } else if (lowerDecoded === 'для ніг') {
    const m = findInAllowed('ноги');
    if (m) return m;
  }
  if (lowerDecoded === 'шкіра') {
    const m = findInAllowed('для шкіри');
    if (m) return m;
  } else if (lowerDecoded === 'для шкіри') {
    const m = findInAllowed('шкіра');
    if (m) return m;
  }

  // Трансформації для поля 'Стать*'
  if (lowerDecoded === 'жіночі' || lowerDecoded === 'жіноча' || lowerDecoded === 'жіночий') {
    const m = findInAllowed('для жінок') || findInAllowed('жіночі');
    if (m) return m;
  } else if (lowerDecoded === 'для жінок') {
    const m = findInAllowed('жіночі') || findInAllowed('жіноча');
    if (m) return m;
  }
  if (lowerDecoded === 'чоловічі' || lowerDecoded === 'чоловіча' || lowerDecoded === 'чоловічий') {
    const m = findInAllowed('для чоловіків') || findInAllowed('чоловічі');
    if (m) return m;
  } else if (lowerDecoded === 'для чоловіків') {
    const m = findInAllowed('чоловічі') || findInAllowed('чоловіча');
    if (m) return m;
  }
  if (lowerDecoded === 'дитячі' || lowerDecoded === 'дитяча' || lowerDecoded === 'дитячий') {
    const m = findInAllowed('для дітей') || findInAllowed('дитячі');
    if (m) return m;
  } else if (lowerDecoded === 'для дітей') {
    const m = findInAllowed('дитячі') || findInAllowed('дитяча');
    if (m) return m;
  }
  if (lowerDecoded === 'унісекс') {
    const m = findInAllowed('unisex');
    if (m) return m;
  } else if (lowerDecoded === 'unisex') {
    const m = findInAllowed('унісекс');
    if (m) return m;
  }

  // Також перевіряємо контекстні суфікси двонаправлено (БЕЗ сліпого обрізання):
  const suffixesToTest = [
    ' для волосся',
    ' для тіла',
    ' для обличчя',
    ' для шкіри',
    ' для авто',
    ' для дому',
    ' для ванної',
    ' для кухні',
    ' для рук',
    ' для ніг'
  ];

  for (const suffix of suffixesToTest) {
    if (decodedRaw.toLowerCase().endsWith(suffix)) {
      const withoutSuffix = decodedRaw.slice(0, -suffix.length).trim();
      const matchSuff = findInAllowed(withoutSuffix);
      if (matchSuff) return matchSuff;
    }
  }

  // =========================================================================
  // Крок В (Канонічна вибірка, синоніми, морфологія):
  // =========================================================================
  const candidateForms = [decodedRaw];
  if (hasDlyaPrefix && variantWithoutDlya && !candidateForms.includes(variantWithoutDlya)) {
    candidateForms.push(variantWithoutDlya);
  } else if (!hasDlyaPrefix && variantWithDlya && !candidateForms.includes(variantWithDlya)) {
    candidateForms.push(variantWithDlya);
  }

  // 1. Канонічний мапер (стать, повернення, дужки)
  for (const form of candidateForms) {
    const canonical = canonicalMapCandidate(form, allowedValues);
    if (canonical) return canonical;
  }

  // 2. Синоніми та переклади RU->UA (двонаправлено)
  for (const form of candidateForms) {
    const formNorm = normalizeForDictionaryComparison(form, 'exact');
    const formRelaxed = normalizeForDictionaryComparison(form, 'relaxed');

    const synTargets = [
      COMMON_SYNONYMS[formNorm],
      COMMON_SYNONYMS[formRelaxed],
      RU_TO_UA_WORDS[formNorm],
      RU_TO_UA_WORDS[formRelaxed]
    ].filter(Boolean) as string[];

    for (const syn of synTargets) {
      const synMatch = findInAllowed(syn);
      if (synMatch) return synMatch;

      // Двонаправлена перевірка 'для ' у знайденому синонімі
      if (/^для\s+/i.test(syn)) {
        const synWithoutDlya = syn.replace(/^для\s+/i, '').trim();
        const m = findInAllowed(synWithoutDlya);
        if (m) return m;
      } else {
        const synWithDlya = `для ${syn}`;
        const m = findInAllowed(synWithDlya);
        if (m) return m;
      }
    }
  }

  // 3. Морфологічний стемінг
  for (const form of candidateForms) {
    const stems = universalStemWord(form);
    for (const stem of stems) {
      if (!stem || stem.length < 3) continue;
      for (const allowedVal of allowedValues) {
        if (!allowedVal || isInternalHexOrHashId(allowedVal)) continue;
        const allowedStems = universalStemWord(allowedVal);
        if (allowedStems.some(aStem => aStem === stem)) {
          return allowedVal;
        }
        const allowedNorm = normalizeForDictionaryComparison(allowedVal, 'exact');
        if (allowedNorm === stem || (stem.length >= 4 && allowedNorm.startsWith(stem))) {
          return allowedVal;
        }
      }
    }
  }

  // 4. Пошук точних окремих слів з word boundaries
  for (const form of candidateForms) {
    const formNorm = normalizeForDictionaryComparison(form, 'exact');
    for (const allowedVal of allowedValues) {
      if (!allowedVal || isInternalHexOrHashId(allowedVal)) continue;
      const aNorm = normalizeForDictionaryComparison(allowedVal, 'exact');
      if (aNorm.length >= 3) {
        const escaped = aNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reg = new RegExp(`(?<![а-яіїєґa-z0-9])${escaped}(?![а-яіїєґa-z0-9])`, 'i');
        if (reg.test(formNorm)) {
          return allowedVal;
        }
      }
    }
  }

  return null;
}

/**
 * Strict Category-Agnostic Gatekeeper:
 * The SINGLE control point before writing ANY `select` or `multiselect` cell into the final Excel.
 * - If value or element is not in allowedValues after all normalization attempts -> replaces with `""`.
 * - Categorically forbids any free-form text, hex-codes ("5b78c0e9..."), descriptive quotes, or AI apologies.
 * - For multiselect: splits by `;`, validates each element against allowedValues, and joins valid elements via `; `.
 * - Returns valid value from allowedValues, or `""`.
 */
export function sanitizeValueAgainstDictionary(
  rawValue: any,
  allowedValues: string[],
  isMultiselect: boolean = false
): string {
  if (rawValue === undefined || rawValue === null) return '';
  const s = String(rawValue).replace(/[\u200b\u200c\u200d\ufeff]/g, '').trim();
  if (!s || s.toLowerCase() === 'nan') return '';

  // Strict check: Forbid internal hex/hash IDs
  if (isInternalHexOrHashId(s)) return '';

  // Strict check: Forbid AI disclaimers / apologetic phrases
  if (isAiDisclaimerOrServiceText(s)) {
    if (/повернен/i.test(s) || /постанов.*кабінет/i.test(s)) {
      const legalMatch = matchSingleOptionAgainstAllowed(s, allowedValues);
      if (legalMatch) return legalMatch;
    }
    return '';
  }

  if (!Array.isArray(allowedValues) || allowedValues.length === 0) {
    return '';
  }

  // 1. MULTISELECT: Strict element-by-element validation
  if (isMultiselect || s.includes(';')) {
    const rawElements = s.includes(';')
      ? s.split(';').map(item => item.trim()).filter(Boolean)
      : s.split(/[,\n]+/).map(item => item.trim()).filter(Boolean);

    const validMatches: string[] = [];
    for (const el of rawElements) {
      const match = matchSingleOptionAgainstAllowed(el, allowedValues);
      if (match && !validMatches.includes(match)) {
        validMatches.push(match);
      }
    }

    return validMatches.length > 0 ? validMatches.join('; ') : '';
  }

  // 2. SELECT: Strict single option match
  const singleMatch = matchSingleOptionAgainstAllowed(s, allowedValues);
  return singleMatch || '';
}

/**
 * Deterministic local extractor for high-priority mandatory Epicentr characteristics (*):
 * 1. 'Вид*' (Type): e.g. "набір" / "set" -> "косметичний набір" / "набір" from allowedValues.
 * 2. 'Склад набору*' (Set Components): detects items in title/desc ("шампунь", "кондиціонер", "спрей", "міст", "гель", "олія", etc.) and maps with 100% priority to allowedValues.
 * 3. 'Бренд*' (Brand): maps "Mades Cosmetics" or any brand mentioned in title to allowedValues.
 * 4. 'Стать*' (Gender): bidirectional mapping for women, men, unisex.
 * 5. 'Призначення*' (Purpose): bidirectional mapping ("обличчя" <-> "для обличчя", "зволоження" <-> "для зволоження", "об'єм" <-> "надання об'єму").
 */
export function extractDeterministicMandatoryPimAttribute(
  columnName: string,
  colType: EpicentrColumnType,
  allowedValues: string[],
  fullText: string,
  titleUa: string = '',
  titleRu: string = ''
): string | null {
  if (!columnName || !Array.isArray(allowedValues) || allowedValues.length === 0) return null;

  const normKey = normalizeAttributeKey(columnName, true);
  const textLower = (fullText || '').toLowerCase();
  const titleCombined = `${titleUa} ${titleRu}`.toLowerCase();

  const findAllowed = (target: string): string | null => {
    return matchSingleOptionAgainstAllowed(target, allowedValues);
  };

  // -------------------------------------------------------------------------
  // 1. ВИД* (Type)
  // -------------------------------------------------------------------------
  if (normKey === 'вид' || normKey.startsWith('вид')) {
    // If title or description has "набір" / "набор" / "set"
    if (
      titleCombined.includes('набір') ||
      titleCombined.includes('набор') ||
      /\bset\b/i.test(titleCombined) ||
      textLower.includes('набір') ||
      textLower.includes('набор') ||
      /\bset\b/i.test(textLower) ||
      titleCombined.includes('подарунк')
    ) {
      const match =
        findAllowed('косметичний набір') ||
        findAllowed('набір') ||
        findAllowed('подарунковий набір') ||
        findAllowed('набір косметики') ||
        findAllowed('набір для догляду');
      if (match) return match;

      // Check any option in allowedValues with "набір"
      const anySet = allowedValues.find(v => /набір|набор|set/i.test(v) && !isInternalHexOrHashId(v));
      if (anySet) return anySet;
    }

    // Specific product types if not set
    const typeCandidates = [
      'шампунь', 'кондиціонер', 'крем', 'сироватка', 'маска', 'гель для душу',
      'гель', 'спрей', 'міст', 'бальзам', 'лосьйон', 'олія', 'пінка', 'скраб',
      'мило', 'дезодорант', 'молочко', 'тонік', 'пілінг'
    ];
    for (const typeCand of typeCandidates) {
      if (titleCombined.includes(typeCand) || textLower.includes(typeCand)) {
        const m = findAllowed(typeCand);
        if (m) return m;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. СКЛАД НАБОРУ* (Set Components)
  // -------------------------------------------------------------------------
  if (normKey.includes('склад набору') || normKey === 'склад набору') {
    const COMPONENT_PATTERNS: Array<{ key: string; regex: RegExp }> = [
      { key: 'шампунь', regex: /\bшампун/i },
      { key: 'кондиціонер', regex: /\bкондиц|\bбальзам-ополіскувач/i },
      { key: 'спрей', regex: /\bспре[йя]|\bspray/i },
      { key: 'міст', regex: /\bміст\b|\bміста\b|\bmist\b/i },
      { key: 'гель', regex: /\bгель\b|\bгелю\b|гель\s+для\s+душу/i },
      { key: 'олія', regex: /\bолі[яєї]|\bмасл[оа]|\boil\b/i },
      { key: 'маска', regex: /\bмаск[аиу]|\bmask\b/i },
      { key: 'крем', regex: /\bкрем|\bcream\b/i },
      { key: 'бальзам', regex: /\bбальзам|\bbalm\b/i },
      { key: 'лосьйон', regex: /\bлосьйон|\blotion\b/i },
      { key: 'сироватка', regex: /\bсироватк|\bсерум|\bserum\b/i },
      { key: 'пінка', regex: /\bпінк|\bпіна\b|\bfoam\b/i },
      { key: 'скраб', regex: /\bскраб|\bscrub\b/i },
      { key: 'мило', regex: /\bмил[оа]|\bsoap\b/i },
      { key: 'дезодорант', regex: /\bдезодорант|\bdeodorant\b/i },
      { key: 'молочко', regex: /\bмолочк|\bmilk\b/i },
      { key: 'тонік', regex: /\bтонік|\btoner\b/i },
      { key: 'пілінг', regex: /\bпілінг|\bpeeling\b/i },
      { key: 'емульсія', regex: /\bемульсі/i },
      { key: 'косметичка', regex: /\bкосметичк/i },
      { key: 'губка', regex: /\bгубк|\bмочалк/i }
    ];

    const matchedOptions: string[] = [];

    // Scan title first (100% priority), then description
    for (const comp of COMPONENT_PATTERNS) {
      if (comp.regex.test(titleCombined) || comp.regex.test(textLower)) {
        // Find matching option in allowedValues
        let optMatch = findAllowed(comp.key);
        if (!optMatch) {
          if (comp.key === 'гель') optMatch = findAllowed('гель для душу');
          else if (comp.key === 'шампунь') optMatch = findAllowed('шампунь для волосся');
          else if (comp.key === 'кондиціонер') optMatch = findAllowed('кондиціонер для волосся');
          else if (comp.key === 'олія') optMatch = findAllowed('олія для тіла');
          else if (comp.key === 'крем') optMatch = findAllowed('крем для тіла') || findAllowed('крем для рук');
        }
        if (!optMatch) {
          optMatch = allowedValues.find(v => comp.regex.test(v) && !isInternalHexOrHashId(v)) || null;
        }

        if (optMatch && !matchedOptions.includes(optMatch)) {
          matchedOptions.push(optMatch);
        }
      }
    }

    if (matchedOptions.length > 0) {
      return colType === 'multiselect' ? matchedOptions.join('; ') : matchedOptions[0];
    }
  }

  // -------------------------------------------------------------------------
  // 3. БРЕНД* (Brand)
  // -------------------------------------------------------------------------
  if (normKey === 'бренд' || normKey.includes('бренд') || normKey === 'виробник') {
    // Specifically check "Mades Cosmetics" or "Mades"
    if (titleCombined.includes('mades') || textLower.includes('mades')) {
      const mades = findAllowed('Mades Cosmetics') || findAllowed('Mades') || allowedValues.find(v => /mades/i.test(v));
      if (mades) return mades;
    }

    // Scan all non-"інше" brands in allowedValues (sorted longest first)
    const sortedBrands = [...allowedValues]
      .filter(b => b && normalizeForDictionaryComparison(b, 'exact') !== 'інше' && !isInternalHexOrHashId(b))
      .sort((a, b) => b.length - a.length);

    for (const b of sortedBrands) {
      if (b.length < 2) continue;
      const bNorm = normalizeForDictionaryComparison(b, 'exact');
      const escaped = bNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reg = new RegExp(`(?<![a-z0-9а-яіїєґ])${escaped}(?![a-z0-9а-яіїєґ])`, 'i');
      if (reg.test(titleCombined)) {
        return b;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. СТАТЬ* (Gender)
  // -------------------------------------------------------------------------
  if (normKey === 'стать' || normKey.includes('стать')) {
    const hasWomen = /для\s+жінок|жіноч|женск|дівчат|дівчин|девоч/i.test(titleCombined) || /для\s+жінок|жіноч|женск/i.test(textLower);
    const hasMen = /для\s+чоловіків|чоловіч|мужск|хлопч|хлопц|мальчик/i.test(titleCombined) || /для\s+чоловіків|чоловіч|мужск/i.test(textLower);
    const hasKids = /для\s+дітей|дитяч|детск/i.test(titleCombined) || /для\s+дітей|дитяч|детск/i.test(textLower);
    const hasUnisex = /унісекс|unisex|для\s+всіх|для\s+всієї\s+родини/i.test(titleCombined) || /унісекс|unisex/i.test(textLower);

    if (hasWomen && !hasMen) {
      const res = findAllowed('для жінок') || findAllowed('жіночі') || findAllowed('жіноча');
      if (res) return res;
    }
    if (hasMen && !hasWomen) {
      const res = findAllowed('для чоловіків') || findAllowed('чоловічі') || findAllowed('чоловіча');
      if (res) return res;
    }
    if (hasKids) {
      const res = findAllowed('для дітей') || findAllowed('дитячі') || findAllowed('дитяча');
      if (res) return res;
    }
    if (hasUnisex || (hasWomen && hasMen) || titleCombined.includes('набір')) {
      const res = findAllowed('унісекс') || findAllowed('unisex') || findAllowed('для жінок');
      if (res) return res;
    }
  }

  // -------------------------------------------------------------------------
  // 5. ПРИЗНАЧЕННЯ* (Purpose / Target Benefit)
  // -------------------------------------------------------------------------
  if (normKey.includes('призначення') || normKey === 'призначення') {
    const PURPOSES: Array<{ words: RegExp; candidates: string[] }> = [
      { words: /зволож|увлажн/i, candidates: ['для зволоження', 'зволоження'] },
      { words: /об'?єм|об&#039;єм|об’єм|объем/i, candidates: ['надання об\'єму', 'для об\'єму', 'об\'єм'] },
      { words: /очищ|очист/i, candidates: ['для очищення', 'очищення'] },
      { words: /живлен|питани/i, candidates: ['для живлення', 'живлення'] },
      { words: /відновл|восстанов/i, candidates: ['для відновлення', 'відновлення'] },
      { words: /догляд|уход/i, candidates: ['догляд', 'для догляду', 'для щоденного використання'] },
      { words: /пом'?якш|смягч/i, candidates: ['для пом\'якшення', 'пом\'якшення'] },
      { words: /зміцнен|укрепл/i, candidates: ['для зміцнення', 'зміцнення'] },
      { words: /захист|защит/i, candidates: ['для захисту', 'захист'] },
      { words: /тоніз|тонизир/i, candidates: ['для тонізації', 'тонізація'] },
      { words: /заспоко|успоко/i, candidates: ['для заспокоєння', 'заспокоєння'] },
      { words: /блиск|блеск/i, candidates: ['надання блиску', 'для блиску'] },
      { words: /обличч|лиц/i, candidates: ['для обличчя', 'обличчя'] },
      { words: /тіл|тел/i, candidates: ['для тіла', 'тіло'] },
      { words: /волос/i, candidates: ['для волосся', 'волосся'] },
      { words: /рук/i, candidates: ['для рук', 'руки'] },
      { words: /ніг|стоп/i, candidates: ['для ніг', 'ноги'] },
      { words: /шкір|кож/i, candidates: ['для шкіри', 'шкіра'] },
      { words: /щоденн/i, candidates: ['для щоденного використання', 'щоденний догляд'] }
    ];

    const matchedPurposes: string[] = [];

    for (const p of PURPOSES) {
      if (p.words.test(titleCombined) || p.words.test(textLower)) {
        for (const cand of p.candidates) {
          const m = findAllowed(cand);
          if (m && !matchedPurposes.includes(m)) {
            matchedPurposes.push(m);
            break;
          }
        }
      }
    }

    if (matchedPurposes.length > 0) {
      return colType === 'multiselect' ? matchedPurposes.join('; ') : matchedPurposes[0];
    }
  }

  // -------------------------------------------------------------------------
  // 6. ДІЯ* (Action / Effect)
  // -------------------------------------------------------------------------
  if (normKey === 'дія' || normKey.startsWith('дія') || normKey.includes('действие')) {
    const ACTIONS: Array<{ words: RegExp; candidates: string[] }> = [
      { words: /очищ|очист/i, candidates: ['очищення', 'делікатне очищення', 'для очищення'] },
      { words: /зволож|увлажн/i, candidates: ['зволоження', 'для зволоження', 'глибоке зволоження'] },
      { words: /живлен|питани/i, candidates: ['живлення', 'для живлення', 'інтенсивне живлення'] },
      { words: /тоніз|тонизир/i, candidates: ['тонізування', 'тонізація', 'для тонізації'] },
      { words: /пом'?якш|смягч/i, candidates: ['пом\'якшення', 'для пом\'якшення'] },
      { words: /освіж|освеж/i, candidates: ['освіження', 'освіжає', 'для освіження'] },
      { words: /заспоко|успоко/i, candidates: ['заспокоєння', 'для заспокоєння'] },
      { words: /аромат|пахуч/i, candidates: ['ароматизація', 'дезодорування'] },
      { words: /відновл|восстанов/i, candidates: ['відновлення', 'для відновлення'] },
      { words: /зміцнен|укрепл/i, candidates: ['зміцнення', 'для зміцнення'] },
      { words: /захист|защит/i, candidates: ['захист', 'для захисту'] }
    ];

    const matchedActions: string[] = [];
    for (const act of ACTIONS) {
      if (act.words.test(titleCombined) || act.words.test(textLower)) {
        for (const cand of act.candidates) {
          const m = findAllowed(cand);
          if (m && !matchedActions.includes(m)) {
            matchedActions.push(m);
            break;
          }
        }
      }
    }

    // Cosmetics domain rule: Shower gel, body wash, soap, scrub ALWAYS cleanses and moisturizes
    if (
      matchedActions.length === 0 ||
      !matchedActions.some(a => /очищ/i.test(a))
    ) {
      const isCleansingProduct =
        /гель\s+для\s+душу|мило|шампунь|пінка|скраб|shower\s+gel/i.test(titleCombined) ||
        /гель\s+для\s+душу|мило|шампунь/i.test(textLower);
      if (isCleansingProduct) {
        const cleanMatch = findAllowed('очищення') || findAllowed('делікатне очищення');
        if (cleanMatch && !matchedActions.includes(cleanMatch)) {
          matchedActions.unshift(cleanMatch);
        }
        const moistMatch = findAllowed('зволоження');
        if (moistMatch && !matchedActions.includes(moistMatch)) {
          matchedActions.push(moistMatch);
        }
        const nourishMatch = findAllowed('живлення');
        if (nourishMatch && !matchedActions.includes(nourishMatch)) {
          matchedActions.push(nourishMatch);
        }
      }
    }

    if (matchedActions.length > 0) {
      return colType === 'multiselect' ? matchedActions.join('; ') : matchedActions[0];
    }
  }

  // -------------------------------------------------------------------------
  // 7. ФОРМА ВИПУСКУ* (Packaging / Release Form)
  // -------------------------------------------------------------------------
  if (normKey.includes('форма випуску') || normKey === 'форма випуску' || normKey.includes('форма выпуска')) {
    // Check explicit mentions in text
    if (/дозатор|помп[ао]/i.test(titleCombined) || /дозатор|помп[ао]/i.test(textLower)) {
      const m = findAllowed('флакон з дозатором') || findAllowed('пляшка з дозатором') || findAllowed('флакон');
      if (m) return m;
    }
    if (/тюбик|туб[аи]/i.test(titleCombined) || /тюбик|туб[аи]/i.test(textLower)) {
      const m = findAllowed('тюбик') || findAllowed('туба');
      if (m) return m;
    }
    if (/банк[аи]/i.test(titleCombined) || /банк[аи]/i.test(textLower)) {
      const m = findAllowed('банка');
      if (m) return m;
    }
    if (/дой-пак|дойпак/i.test(titleCombined) || /дой-пак|дойпак/i.test(textLower)) {
      const m = findAllowed('дой-пак') || findAllowed('дойпак');
      if (m) return m;
    }
    if (/спрей|пульверизатор/i.test(titleCombined) || /спрей|пульверизатор/i.test(textLower)) {
      const m = findAllowed('спрей') || findAllowed('флакон');
      if (m) return m;
    }
    if (/флакон/i.test(titleCombined) || /флакон/i.test(textLower)) {
      const m = findAllowed('флакон') || findAllowed('флакон з дозатором');
      if (m) return m;
    }
    if (/пляшк/i.test(titleCombined) || /пляшк/i.test(textLower)) {
      const m = findAllowed('пляшка') || findAllowed('пляшка з дозатором') || findAllowed('флакон');
      if (m) return m;
    }

    // Volume-correlated packaging heuristics for cosmetics
    const volMl = extractVolumeMlFromText(`${titleCombined} ${textLower}`);
    if (volMl && volMl >= 500) {
      const m = findAllowed('флакон з дозатором') || findAllowed('флакон') || findAllowed('пляшка з дозатором');
      if (m) return m;
    } else if (volMl && volMl <= 100) {
      const m = findAllowed('тюбик') || findAllowed('флакон') || findAllowed('туба');
      if (m) return m;
    }

    // Standard liquid cosmetic packaging default from allowed options
    const defaultBottle = findAllowed('флакон') || findAllowed('тюбик') || findAllowed('пляшка');
    if (defaultBottle) return defaultBottle;
  }

  return null;
}

/**
 * Universal Mandatory Field Fallback:
 * If after local analysis and AI, a mandatory field with asterisk (*) remains empty,
 * pulls the most probable category-aware default canonical option from allowedValues.
 */
export function resolveMandatoryFallback(
  columnName: string,
  colType: EpicentrColumnType,
  allowedValues: string[],
  contextText: string = ''
): string | null {
  if (!allowedValues || allowedValues.length === 0) return null;
  const normKey = normalizeAttributeKey(columnName, true);
  const lowerContext = (contextText || '').toLowerCase();

  const findAllowed = (target: string): string | null => {
    return matchSingleOptionAgainstAllowed(target, allowedValues);
  };

  // 1. Вид* (Type)
  if (normKey === 'вид' || normKey.startsWith('вид')) {
    if (lowerContext.includes('набір') || lowerContext.includes('набор') || lowerContext.includes('set') || lowerContext.includes('косметик')) {
      const match =
        findAllowed('косметичний набір') ||
        findAllowed('набір') ||
        findAllowed('подарунковий набір') ||
        findAllowed('набір косметики') ||
        findAllowed('набір для догляду');
      if (match) return match;
    }
    const anySet = allowedValues.find(v => /набір|набор|set/i.test(v) && !isInternalHexOrHashId(v));
    if (anySet) return anySet;

    const setDef = findAllowed('косметичний набір') || findAllowed('набір');
    if (setDef) return setDef;

    const uni = findAllowed('універсальний');
    if (uni) return uni;

    const firstValid = allowedValues.find(v => v && !isInternalHexOrHashId(v) && !isAiDisclaimerOrServiceText(v));
    if (firstValid) return firstValid;
  }

  // 2. Стать* (Gender)
  if (normKey === 'стать' || normKey.includes('стать')) {
    const match =
      findAllowed('унісекс') ||
      findAllowed('unisex') ||
      findAllowed('для жінок') ||
      findAllowed('жіночі') ||
      findAllowed('жіноча') ||
      findAllowed('для чоловіків') ||
      findAllowed('чоловічі') ||
      findAllowed('для дорослих');
    if (match) return match;

    const firstValid = allowedValues.find(v => v && !isInternalHexOrHashId(v) && !isAiDisclaimerOrServiceText(v));
    if (firstValid) return firstValid;
  }

  // 3. Склад набору* (Set Components)
  if (normKey.includes('склад набору') || normKey === 'склад набору') {
    const comps = ['шампунь', 'кондиціонер', 'гель для душу', 'гель', 'спрей', 'міст', 'олія', 'крем', 'маска', 'мило', 'бальзам'];
    const matchedComps: string[] = [];
    for (const c of comps) {
      if (lowerContext.includes(c)) {
        const m = findAllowed(c);
        if (m && !matchedComps.includes(m)) {
          matchedComps.push(m);
        }
      }
    }
    if (matchedComps.length > 0) {
      return colType === 'multiselect' ? matchedComps.join('; ') : matchedComps[0];
    }

    const combo = allowedValues.find(v => (v.includes(';') || v.includes(',') || v.includes('+')) && !isInternalHexOrHashId(v));
    if (combo) return combo;

    const commonComp =
      findAllowed('шампунь') ||
      findAllowed('гель для душу') ||
      findAllowed('крем') ||
      findAllowed('косметичні засоби');
    if (commonComp) return commonComp;

    const firstValid = allowedValues.find(v => v && !isInternalHexOrHashId(v) && !isAiDisclaimerOrServiceText(v));
    if (firstValid) return firstValid;
  }

  // 4. Бренд* (Brand)
  if (normKey === 'бренд' || normKey.includes('бренд') || normKey === 'виробник') {
    if (lowerContext.includes('mades')) {
      const mades = findAllowed('Mades Cosmetics') || findAllowed('Mades');
      if (mades) return mades;
    }
    const other = findAllowed('Інше') || findAllowed('інше') || findAllowed('Other');
    if (other) return other;

    const firstValid = allowedValues.find(v => v && !isInternalHexOrHashId(v) && !isAiDisclaimerOrServiceText(v));
    if (firstValid) return firstValid;
  }

  // 5. Призначення* (Purpose / Target Benefit)
  if (normKey.includes('призначення') || normKey === 'призначення') {
    const match =
      findAllowed('для щоденного використання') ||
      findAllowed('догляд') ||
      findAllowed('для догляду') ||
      findAllowed('для зволоження') ||
      findAllowed('зволоження') ||
      findAllowed('для очищення') ||
      findAllowed('очищення') ||
      findAllowed('для тіла') ||
      findAllowed('для обличчя') ||
      findAllowed('для волосся') ||
      findAllowed('надання об\'єму') ||
      findAllowed('для живлення') ||
      findAllowed('живлення');
    if (match) return match;

    const firstValid = allowedValues.find(v => v && !isInternalHexOrHashId(v) && !isAiDisclaimerOrServiceText(v));
    if (firstValid) return firstValid;
  }

  // 6. Одиниця виміру*
  if (normKey.includes('одиниця виміру') || normKey.includes('одиниці виміру')) {
    const match =
      findAllowed('шт.') ||
      findAllowed('компл.') ||
      findAllowed('уп.');
    if (match) return match;
  }

  // 7. Клас косметики*
  if (normKey.includes('клас косметики') || normKey.includes('клас')) {
    const match =
      findAllowed('мас-маркет') ||
      findAllowed('мідл-маркет') ||
      findAllowed('дерматокосметика') ||
      findAllowed('натуральна') ||
      findAllowed('професійна');
    if (match) return match;
  }

  // 8. Країна*
  if (normKey.includes('країна')) {
    if (lowerContext.includes('mades')) {
      const nl = findAllowed('Нідерланди') || findAllowed('Нидерланды');
      if (nl) return nl;
    }
    const match =
      findAllowed('Нідерланди') ||
      findAllowed('Україна') ||
      findAllowed('Польща') ||
      findAllowed('Франція') ||
      findAllowed('Німеччина');
    if (match) return match;
  }

  // 9. Дія* (Action / Effect)
  if (normKey === 'дія' || normKey.startsWith('дія') || normKey.includes('действие')) {
    const act =
      findAllowed('очищення') ||
      findAllowed('зволоження') ||
      findAllowed('живлення') ||
      findAllowed('тонізування') ||
      findAllowed('делікатне очищення');
    if (act) return act;
  }

  // 10. Форма випуску* (Packaging / Release Form)
  if (normKey.includes('форма випуску') || normKey === 'форма випуску' || normKey.includes('форма выпуска')) {
    const pack =
      findAllowed('флакон') ||
      findAllowed('тюбик') ||
      findAllowed('флакон з дозатором') ||
      findAllowed('пляшка з дозатором') ||
      findAllowed('пляшка');
    if (pack) return pack;
  }

  // Generic fallback for any other mandatory select/multiselect column:
  const genericUni =
    findAllowed('універсальний') ||
    findAllowed('універсальна') ||
    findAllowed('без візерунка (однотонний)') ||
    findAllowed('стандартний');
  if (genericUni) return genericUni;

  const anyValid = allowedValues.find(v => v && !isInternalHexOrHashId(v) && !isAiDisclaimerOrServiceText(v));
  return anyValid || null;
}

/**
 * Normalize an attribute/column name by removing service tags, newlines, and units for flexible dictionary lookup.
 */
export function normalizeAttributeKey(rawName: string, stripUnits = false): string {
  if (!rawName) return '';
  let cleaned = String(rawName)
    .replace(/_x000[dD]_/gi, ' ')
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
          const normV = normalizeEpicentrHeaderName(rawV);
          commentByHeaderName.set(rawV, commentText);
          commentByHeaderName.set(normV, commentText);
        }
      }
    }
  }

  return headers.map((rawHeader, colIndex) => {
    const cleanOrigName = normalizeEpicentrHeaderName(rawHeader);
    const lower = cleanOrigName.toLowerCase();

    // Check if it is a photo / image column (фото не є обов'язковим)
    const isPhoto =
      lower.includes('фото') ||
      lower.includes('зображення') ||
      lower.includes('photo') ||
      lower.includes('image') ||
      lower.includes('picture');

    // Clean human-friendly name (collapse newlines and extra spaces!)
    const cleanName = cleanOrigName
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
    const isId = isExplicitIdColumnName(cleanName) || isExplicitIdColumnName(cleanOrigName);
    const isRequired = isPhoto || isId ? false : cleanOrigName.includes('*');

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
    const unitMatch = cleanOrigName.match(/\((мм|см|м|г|кг|шт|л|мл|вт|v|w)\)/i);
    if (unitMatch) {
      unit = unitMatch[1].toLowerCase();
    }

    // Preserve exact original comment without generating any artificial ATTR_ comments
    let rawComment: string | undefined;
    if (Array.isArray(worksheetOrComments)) {
      rawComment = worksheetOrComments[colIndex];
    } else if (worksheetOrComments) {
      const normHeader = normalizeEpicentrHeaderName(cleanOrigName);
      rawComment =
        commentByHeaderName.get(cleanOrigName) ||
        commentByHeaderName.get(normHeader) ||
        commentByHeaderName.get(rawHeader) ||
        commentByColIdx.get(colIndex);
    }

    return {
      colIndex,
      originalName: cleanOrigName,
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
 * - Cleans headers of carriage returns \r and _x000d_
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
        const s = normalizeEpicentrHeaderName(String(cell || '')).toLowerCase().trim();
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

  // Clean all header cells in ws from \r and _x000d_ into canonical \n
  for (let c = 0; c < 200; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    const cell = ws[cellRef];
    if (cell && cell.v !== undefined && cell.v !== null) {
      cell.v = normalizeEpicentrHeaderName(String(cell.v));
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
    const s = cellVal !== undefined && cellVal !== null ? normalizeEpicentrHeaderName(String(cellVal)) : '';
    if (s && !s.startsWith('__EMPTY')) {
      rawHeaders.push(s);
    }
  });

  // Normalize row keys in rawJson so that row[col.originalName] matches 100% cleanly!
  const normalizedJson = rawJson.map(row => {
    const cleanRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      cleanRow[normalizeEpicentrHeaderName(k)] = v;
    }
    return cleanRow;
  });

  // Fallback to json keys if headerRow was sparse
  const effectiveHeaders = rawHeaders.length > 0
    ? rawHeaders
    : (normalizedJson.length > 0 ? Object.keys(normalizedJson[0]).filter(k => !k.startsWith('__EMPTY')) : []);

  const columns = analyzeEpicentrColumns(effectiveHeaders, ws, headerRowIdx);

  return {
    sheetName,
    jsonData: normalizedJson,
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
      const isSystemCodeOrId =
        h.includes('код') ||
        h.includes('code') ||
        h.includes('id') ||
        h.includes('ід') ||
        h.includes('хеш') ||
        h.includes('hash') ||
        h.includes('сортуван') ||
        h.includes('порядок') ||
        h.includes('позиці') ||
        h.includes('тип') ||
        h.includes('type');

      if (!isSystemCodeOrId) {
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
          h === 'option name' ||
          h === 'значення опції' ||
          h === 'назва значення' ||
          h === 'назва' ||
          h === 'значення' ||
          h === 'опція' ||
          h === 'option' ||
          h === 'value'
        ) {
          // Strictly prioritize "назва опції"
          if (optNameColIdx === -1 || h === 'назва опції' || h === 'option name') {
            optNameColIdx = idx;
          }
        }
      }
    });

    // Fallback if not exact match (strictly avoiding code/id columns):
    if (attrColIdx === -1) {
      attrColIdx = lowerHeaders.findIndex(
        h =>
          !h.includes('код') &&
          !h.includes('id') &&
          !h.includes('code') &&
          (h.includes('характерист') || h.includes('атрибут'))
      );
    }
    if (optNameColIdx === -1) {
      optNameColIdx = lowerHeaders.findIndex(
        (h, i) =>
          i !== attrColIdx &&
          !h.includes('код') &&
          !h.includes('id') &&
          !h.includes('code') &&
          !h.includes('порядок') &&
          !h.includes('сортуван') &&
          !h.includes('позиці') &&
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
      const isSystemCodeOrId =
        h.includes('код') ||
        h.includes('code') ||
        h.includes('id') ||
        h.includes('ід') ||
        h.includes('хеш') ||
        h.includes('hash') ||
        h.includes('сортуван') ||
        h.includes('порядок') ||
        h.includes('позиці') ||
        h.includes('тип') ||
        h.includes('type');

      if (!isSystemCodeOrId) {
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
          h === 'option name' ||
          h === 'значення опції' ||
          h === 'назва значення' ||
          h === 'назва' ||
          h === 'значення' ||
          h === 'опція' ||
          h === 'option' ||
          h === 'value'
        ) {
          // Strictly prioritize "назва опції"
          if (optNameColIdx === -1 || h === 'назва опції' || h === 'option name') {
            optNameColIdx = idx;
          }
        }
      }
    });

    if (attrColIdx === -1) {
      attrColIdx = lowerHeaders.findIndex(
        h =>
          !h.includes('код') &&
          !h.includes('id') &&
          !h.includes('code') &&
          (h.includes('характерист') || h.includes('атрибут'))
      );
    }
    if (optNameColIdx === -1) {
      optNameColIdx = lowerHeaders.findIndex(
        (h, i) =>
          i !== attrColIdx &&
          !h.includes('код') &&
          !h.includes('id') &&
          !h.includes('code') &&
          !h.includes('порядок') &&
          !h.includes('сортуван') &&
          !h.includes('позиці') &&
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
 * Lookup dictionary attribute by column name (supports multiline headers, unit stripping, and fuzzy matching)
 */
export function findDictionaryAttr(
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  colName: string
): EpicentrDictionaryAttribute | undefined {
  if (!dictionaryIndex || !colName) return undefined;
  const keyWithUnit = normalizeAttributeKey(colName, false);
  const keyWithoutUnit = normalizeAttributeKey(colName, true);

  if (dictionaryIndex[keyWithUnit]) return dictionaryIndex[keyWithUnit];
  if (dictionaryIndex[keyWithoutUnit]) return dictionaryIndex[keyWithoutUnit];

  const toFuzzy = (s: string) =>
    normalizeAttributeKey(s, true)
      .toLowerCase()
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const colFuzzy = toFuzzy(colName);

  // 1. Exact match on clean or attribute name
  const exact = Object.values(dictionaryIndex).find(
    d =>
      normalizeAttributeKey(d.cleanAttributeName, true) === keyWithoutUnit ||
      normalizeAttributeKey(d.attributeName, true) === keyWithoutUnit
  );
  if (exact) return exact;

  // 2. Fuzzy match (ignoring hyphens, underscores, extra spaces)
  const fuzzy = Object.values(dictionaryIndex).find(d => {
    const dFuzzy1 = toFuzzy(d.cleanAttributeName || '');
    const dFuzzy2 = toFuzzy(d.attributeName || '');
    return dFuzzy1 === colFuzzy || dFuzzy2 === colFuzzy;
  });
  if (fuzzy) return fuzzy;

  // 3. Domain alias matching for common catalog discrepancies:
  // e.g. "країна-виробник" <-> "країна виробник", "клас косметики" <-> "клас", "одиниця виміру" <-> "одиниці виміру"
  return Object.values(dictionaryIndex).find(d => {
    const dFuzzy = toFuzzy(d.cleanAttributeName || d.attributeName || '');
    if (!dFuzzy || !colFuzzy) return false;
    if (colFuzzy.includes('країн') && dFuzzy.includes('країн')) {
      if (colFuzzy.includes('реєстрац') || dFuzzy.includes('реєстрац')) {
        return colFuzzy.includes('реєстрац') && dFuzzy.includes('реєстрац');
      }
      return !dFuzzy.includes('реєстрац');
    }
    if (colFuzzy.includes('клас') && dFuzzy.includes('клас')) return true;
    if (colFuzzy.includes('одиниц') && dFuzzy.includes('одиниц')) return true;
    if (colFuzzy.includes('форма випуску') && dFuzzy.includes('форма випуску')) return true;
    if (colFuzzy.includes('призначення') && dFuzzy.includes('призначення')) return true;
    if ((colFuzzy === 'вид' || colFuzzy.startsWith('вид')) && (dFuzzy === 'вид' || dFuzzy.startsWith('вид'))) return true;
    if (colFuzzy.includes('бренд') && dFuzzy.includes('бренд')) return true;
    return false;
  });
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
  return matchSingleOptionAgainstAllowed(candidateValue, dictAttr.allowedValues);
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

  // 1. MULTISELECT & SELECT with dictionary
  if (hasDictionary && dictAttr && (colType === 'select' || colType === 'multiselect')) {
    const sanitized = sanitizeValueAgainstDictionary(cleaned, dictAttr.allowedValues, colType === 'multiselect');
    return sanitized || null;
  }

  // 2. Multiselect without fixed dictionary: clean elements
  if (colType === 'multiselect') {
    const parts = cleaned.split(/[;,\n]+/).map(p => p.trim()).filter(p => p && !isInternalHexOrHashId(p) && !isAiDisclaimerOrServiceText(p));
    return parts.length > 0 ? Array.from(new Set(parts)).join('; ') : null;
  }

  // 3. Select without fixed dictionary
  if (colType === 'select') {
    // If no dictionary is loaded for this attribute, allow clean text as long as it's not a hex code or AI disclaimer
    return cleaned || null;
  }

  // 4. ARRAY: Normalize delimiter to "; "
  if (colType === 'array') {
    if (hasDictionary && dictAttr) {
      const sanitized = sanitizeValueAgainstDictionary(cleaned, dictAttr.allowedValues, true);
      return sanitized || null;
    }
    const cleanParts = cleaned.split(/[;,]+/).map(p => p.trim()).filter(p => p && !isInternalHexOrHashId(p) && !isAiDisclaimerOrServiceText(p));
    return cleanParts.length > 0 ? Array.from(new Set(cleanParts)).join('; ') : null;
  }

  // 5. FLOAT: Ensure numeric format
  if (colType === 'float') {
    const numMatch = cleaned.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    return numMatch ? numMatch[0] : null;
  }

  // 6. STRING / TEXT: If a dictionary exists for this attribute, normalize to canonical dictionary value when matched
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

export interface TitleFormulaAnalysis {
  isValid: boolean;
  score: number;
  length: number;
  isLengthValid: boolean;
  hasSkuInBrackets: boolean;
  skuFound?: string;
  hasBrand: boolean;
  hasProhibitedWords: boolean;
  prohibitedWords: string[];
  isCapslock: boolean;
  issues: string[];
}

/**
 * Analyzes whether a product title adheres to Epicentr's official marketplace title formula:
 * <Тип товару> <Особливість> <Бренд> <Модель> <Характеристика/Розмір> <Колір> (<Артикул>)
 * Flags: prohibited marketing words, missing SKU in parentheses at end, length limits, brand omission, capslock.
 */
export function analyzeEpicentrTitleFormula(
  title: string | undefined | null,
  brand?: string,
  _sku?: string
): TitleFormulaAnalysis {
  const cleanTitle = (title || '').trim();
  const length = cleanTitle.length;
  const isLengthValid = length >= 15 && length <= 150;

  const prohibitedRegex = /(?:^|[^\p{L}\p{N}])(акція|акция|знижка|скидка|original|оригінал|оригинал|розпродаж|распродажа|уцінка|уценка|новинка|топ|хіт|хит|супер|super|дешево|дешевий|100%|sale|best|найкращ|лучш)(?:[^\p{L}\p{N}]|$)/giu;
  const matches = Array.from(cleanTitle.matchAll(prohibitedRegex)).map(m => m[1]);
  const prohibitedWords = Array.from(new Set(matches.map(w => w.toLowerCase())));
  const hasProhibitedWords = prohibitedWords.length > 0;

  const skuMatch = cleanTitle.match(/\(([^)]+)\)$/);
  const hasSkuInBrackets = Boolean(skuMatch && skuMatch[1].trim().length > 0);
  const skuFound = skuMatch ? skuMatch[1].trim() : undefined;

  const cleanBrand = (brand || '').replace(/^інше$/i, '').trim().toLowerCase();
  const hasBrand = cleanBrand ? cleanTitle.toLowerCase().includes(cleanBrand) : true;

  const isCapslock = cleanTitle.length > 10 && cleanTitle === cleanTitle.toUpperCase() && /[А-ЯA-Z]/.test(cleanTitle);

  const issues: string[] = [];
  let score = 100;

  if (cleanTitle.length === 0) {
    issues.push('Назва товару порожня');
    return {
      isValid: false,
      score: 0,
      length: 0,
      isLengthValid: false,
      hasSkuInBrackets: false,
      hasBrand: false,
      hasProhibitedWords: false,
      prohibitedWords: [],
      isCapslock: false,
      issues
    };
  }

  if (length > 150) {
    issues.push(`Довжина назви (${length} симв.) перевищує ліміт 150`);
    score -= 30;
  } else if (length < 15) {
    issues.push(`Занадто коротка назва (${length} симв.)`);
    score -= 15;
  }

  if (!hasSkuInBrackets) {
    issues.push('Відсутній артикул у круглих дужках наприкінці: (АРТИКУЛ)');
    score -= 35;
  }

  if (hasProhibitedWords) {
    issues.push(`Містить заборонені маркетингові слова: ${prohibitedWords.join(', ')}`);
    score -= 25;
  }

  if (isCapslock) {
    issues.push('Назва повністю написана великими літерами (Caps Lock)');
    score -= 25;
  }

  if (cleanBrand && !hasBrand) {
    issues.push(`Бренд "${brand}" не вказано в назві`);
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));
  const isValid = issues.length === 0 && hasSkuInBrackets && isLengthValid && !hasProhibitedWords && !isCapslock;

  return {
    isValid,
    score,
    length,
    isLengthValid,
    hasSkuInBrackets,
    skuFound,
    hasBrand,
    hasProhibitedWords,
    prohibitedWords,
    isCapslock,
    issues
  };
}

/**
 * 1-Click heuristic fix for Epicentr title formula:
 * Removes prohibited words, strips brackets, ensures brand & model formatting, and attaches SKU in brackets.
 */
export function autoFixEpicentrTitle(
  currentTitle: string | undefined | null,
  brand?: string,
  sku?: string,
  extra?: { productType?: string; model?: string; color?: string }
): string {
  let cleanTitle = (currentTitle || '').trim();
  const cleanBrand = (brand || '').replace(/^інше$/i, '').trim();
  const cleanSku = (sku || '').trim();

  // If brand is present and completely absent from title, insert brand
  if (cleanBrand && !cleanTitle.toLowerCase().includes(cleanBrand.toLowerCase())) {
    const skuBracketMatch = cleanTitle.match(/\(([^)]+)\)$/);
    if (skuBracketMatch) {
      const base = cleanTitle.replace(/\(([^)]+)\)$/, '').trim();
      cleanTitle = `${base} ${cleanBrand} (${skuBracketMatch[1]})`;
    } else {
      cleanTitle = `${cleanTitle} ${cleanBrand}`;
    }
  }

  return formatEpicentrTitle({
    rawTitle: cleanTitle,
    brand: cleanBrand,
    sku: cleanSku,
    productType: extra?.productType,
    model: extra?.model,
    color: extra?.color,
    lang: 'ua'
  });
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

  // Parse 3D / 2D dimensions, weight, volume & explicit dimensions from text
  const parsedDimensions = extractDimensionsFromText(combinedDesc);
  const parsedWeightGrams = extractWeightGramsFromText(combinedDesc);
  const parsedVolumeMl = extractVolumeMlFromText(combinedDesc);
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
    parsedVolumeMl,
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
 * Extract volume in milliliters (ml) from product title & description.
 * Automatically converts l (літри) -> ml (мілілітри).
 */
export function extractVolumeMlFromText(text: string): number | undefined {
  if (!text) return undefined;

  const parseVol = (numStr: string, unitStr: string): number | undefined => {
    const num = parseFloat(numStr.replace(',', '.'));
    if (isNaN(num) || num <= 0) return undefined;
    const u = unitStr.toLowerCase().trim();
    if (u === 'л' || u === 'l' || u.startsWith('літр') || u.startsWith('литр')) {
      return Math.round(num * 1000);
    }
    return Math.round(num);
  };

  // 1. Labeled volume: "Об'єм: 400 мл", "Объем: 250 мл", "Об'єм: 1 л", "Об'єм товару: 500 мл"
  const labeledMatch = text.match(/(?:об['’ʼ`]?єм|объем|емкость|місткість|мікрооб['’ʼ`]?єм)(?:\s*в\s*упаковці|\s*товару|\s*упаковки|\s*флакона|\s*банки)?[\s:=-]*(\d+(?:[.,]\d+)?)\s*(мл|ml|л|l|літрів|літра|литров|литра)\b/i);
  if (labeledMatch) {
    const v = parseVol(labeledMatch[1], labeledMatch[2]);
    if (v && v >= 1 && v <= 50000) return v;
  }

  // 2. Unlabeled volume with explicit unit in title or text: "400 мл", "100 ml", "0.5 л", "500 мл"
  const generalMatches = Array.from(text.matchAll(/\b(\d+(?:[.,]\d+)?)\s*(мл|ml|л|l)\b/gi));
  for (const m of generalMatches) {
    const v = parseVol(m[1], m[2]);
    if (v && v >= 5 && v <= 20000) {
      return v;
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
 * Extract series / model line key from brand, product title, and vendor code.
 * Used for high-performance Series Level Caching across large catalogs (7000+ items).
 * Example: "Mades Cosmetics Chapter Body Spray" -> "mades_cosmetics__chapter"
 *          "Sony WH-1000XM4 Black" -> "sony__wh_1000xm4"
 */
export function extractProductSeriesKey(
  brand?: string,
  productTitle?: string,
  vendorCode?: string
): string {
  const cleanBrand = (brand || '').replace(/^інше$/i, '').trim().toLowerCase();
  let titleClean = (productTitle || '').toLowerCase().trim();

  // Strip brand from title if present
  if (cleanBrand && titleClean.includes(cleanBrand)) {
    titleClean = titleClean.replace(cleanBrand, ' ').trim();
  }

  // Remove SKU / vendor code if present in title
  if (vendorCode && vendorCode.length >= 3) {
    titleClean = titleClean.replace(vendorCode.toLowerCase(), ' ').trim();
  }

  // Remove parenthesized content (sizes, SKUs, colors)
  titleClean = titleClean.replace(/\([^)]*\)/g, ' ').trim();

  // Remove generic stop-words
  const stopWords = new Set([
    'для', 'від', 'без', 'під', 'та', 'і', 'з', 'зі', 'із', 'в', 'у',
    'набір', 'товар', 'штука', 'шт', 'новинка', 'оригінал', 'косметичний',
    'подарунковий', 'жіночий', 'чоловічий', 'дитячий', 'унісекс',
    'мл', 'г', 'кг', 'л', 'мм', 'см', 'м', 'black', 'white', 'чорний', 'білий'
  ]);

  // Product types and anatomy that should NOT be part of the series name
  const productTypesAndAnatomy = new Set([
    'body', 'hair', 'face', 'skin', 'hands', 'feet', 'lips',
    'тіло', 'тіла', 'волосся', 'обличчя', 'шкіра', 'шкіри', 'руки', 'рук', 'рукам', 'ноги', 'ніг', 'ногам', 'губи', 'губ',
    'спрей', 'міст', 'шампунь', 'кондиціонер', 'бальзам', 'крем', 'гель', 'лосьйон', 'олія', 'маска', 'сироватка', 'мило',
    'парфумований', 'парфумована', 'туалетна', 'вода', 'духи',
    'spray', 'mist', 'shampoo', 'conditioner', 'balm', 'cream', 'gel', 'lotion', 'oil', 'mask', 'serum', 'soap'
  ]);

  const rawTokens = titleClean
    .split(/[\s,./\-_+]+/)
    .filter(t => t.length > 0 && !stopWords.has(t));

  const seriesTokens: string[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const t = rawTokens[i];
    if (productTypesAndAnatomy.has(t)) {
      continue;
    }
    if (seriesTokens.length === 0) {
      if (/^[a-zа-яіїєґ0-9]{2,}$/i.test(t)) {
        seriesTokens.push(t);
        // If next token is a number or sub-model (like "01", "02", "pro", "max", "ultra")
        if (i + 1 < rawTokens.length) {
          const next = rawTokens[i + 1];
          if (/^\d{1,4}$/.test(next) || /^(pro|max|ultra|plus|mini|lite|fe|gt|se|neo)$/i.test(next)) {
            seriesTokens.push(next);
            i++;
          }
        }
      }
    } else if (seriesTokens.length < 3) {
      if (!productTypesAndAnatomy.has(t) && !/^\d{3,}$/.test(t)) {
        seriesTokens.push(t);
      }
    }
    if (seriesTokens.length >= 2) break;
  }

  const seriesPart = seriesTokens.join('_');
  const brandPart = (cleanBrand || 'brand').replace(/[\s,./\-_+]+/g, '_');

  return `${brandPart}__${seriesPart || 'general'}`.replace(/[^a-zA-Z0-9а-яіїєґА-ЯІЇЄҐ_-]/g, '');
}

/**
 * Checks whether a column represents a mandatory characteristic that requires filling.
 * Excludes system/content/media columns (ID, Title, SKU, Price, Description, Photo, Availability, Category).
 */
export function isMandatoryCharacteristicColumn(col: EpicentrColumn): boolean {
  if (!col) return false;
  const cleanLower = (col.cleanName || col.originalName).toLowerCase().trim();
  const origLower = col.originalName.toLowerCase().trim();

  if (
    cleanLower === 'id' ||
    cleanLower.startsWith('id ') ||
    cleanLower === 'артикул' ||
    cleanLower === 'sku' ||
    cleanLower.startsWith('назва товару') ||
    cleanLower.startsWith('опис') ||
    cleanLower === 'ціна' ||
    cleanLower === 'наявність' ||
    cleanLower === 'категорія' ||
    cleanLower.includes('фото') ||
    origLower.includes('фото') ||
    cleanLower.includes('зображення') ||
    cleanLower.includes('photo') ||
    cleanLower.includes('image')
  ) {
    return false;
  }

  return Boolean(col.isRequired || col.originalName.includes('*') || (col.cleanName && col.cleanName.includes('*')));
}

/**
 * Checks whether all mandatory characteristics for a product row have valid non-empty values.
 * Used for Zero-AI cutoff (eliminates unnecessary Gemini / Grounding API calls for 7000+ catalogs).
 */
export function areAllMandatoryCharacteristicsFilled(
  row: Record<string, any>,
  columns: EpicentrColumn[]
): boolean {
  for (const col of columns) {
    if (isMandatoryCharacteristicColumn(col)) {
      const v1 = row[col.originalName];
      const v2 = row[col.cleanName];
      const normKey = normalizeEpicentrHeaderName(col.originalName);
      const v3 = row[normKey];

      const empty1 = v1 === undefined || v1 === null || String(v1).trim() === '' || String(v1).toLowerCase() === 'nan';
      const empty2 = v2 === undefined || v2 === null || String(v2).trim() === '' || String(v2).toLowerCase() === 'nan';
      const empty3 = v3 === undefined || v3 === null || String(v3).trim() === '' || String(v3).toLowerCase() === 'nan';

      if (empty1 && empty2 && empty3) {
        return false;
      }
    }
  }
  return true;
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
        // CRITICAL RULE: Existing non-empty cells MUST NEVER BE CLEARED OR OVERWRITTEN!
        if (hasExistingVal) {
          const rawExisting = String(existingVal).trim();
          let finalExisting = rawExisting;
          let note = col.isRequired
            ? 'Вже заповнено у шаблоні — захищено від змін'
            : 'Необов\'язкове поле — заповнено користувачем';

          if (
            dictAttr &&
            dictAttr.allowedValues.length > 0 &&
            (col.type === 'select' || col.type === 'multiselect')
          ) {
            const enforcedExisting = enforceDictionaryValue(rawExisting, col.type, dictAttr);
            if (enforcedExisting) {
              finalExisting = enforcedExisting;
              note = enforcedExisting !== rawExisting
                ? 'Нормалізовано за офіційним довідником Епіцентру'
                : 'Вже заповнено у шаблоні — валідне за довідником';
            }
          }

          updatedRow[col.originalName] = finalExisting;
          if (col.isRequired) {
            alreadyFilledCount++;
          }
          diffs[col.originalName] = {
            colIndex: col.colIndex,
            columnName: col.originalName,
            isRequired: col.isRequired,
            type: col.type,
            oldValue: rawExisting,
            newValue: finalExisting,
            source: 'already_filled',
            confidence: 1.0,
            note
          };
          return;
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

          // 0. Детермінований локальний витяг для полів зі зірочкою (*) та ключових характеристик зі 100% пріоритетом
          const deterministicVal = extractDeterministicMandatoryPimAttribute(
            col.originalName,
            col.type,
            dictAttr.allowedValues,
            visuals.combinedDesc,
            visuals.titleUa,
            visuals.titleRu
          );
          if (deterministicVal) {
            candidateValue = deterministicVal;
            if (isBrandCol) {
              detectedBrand = deterministicVal;
            }
            note = 'Детерміновано витягнуто за PIM-правилами Епіцентру зі 100% пріоритетом';
          }

          // Sort allowedValues by length descending so more specific multi-word options match before shorter substrings
          const sortedOptions = [...dictAttr.allowedValues].sort((a, b) => b.length - a.length);
          const matchedFromText: string[] = candidateValue ? [candidateValue] : [];

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
          // Volume (ml / l)
          else if (
            normKeyNoUnit.includes("об'єм") ||
            normKeyNoUnit.includes("объем") ||
            normKeyNoUnit.includes("об ем") ||
            normKeyNoUnit.includes("volume")
          ) {
            const volMl = visuals.parsedVolumeMl;
            if (volMl !== undefined && volMl > 0) {
              const isLTarget = col.unit === 'л' || cleanKey.includes('(л)');
              candidateValue = isLTarget
                ? String(Number((volMl / 1000).toFixed(2)))
                : String(Math.round(volMl));
              note = 'Об\'єм витягнуто з опису/назви товару';
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
        let filledValue = enforceDictionaryValue(candidateValue, col.type, dictAttr);

        // Mandatory Fallback: If mandatory column (*) remains empty, pull category-aware default from allowedValues
        if (!filledValue && (col.isRequired || col.originalName.includes('*')) && dictAttr && dictAttr.allowedValues.length > 0) {
          const fallbackVal = resolveMandatoryFallback(
            col.originalName,
            col.type,
            dictAttr.allowedValues,
            visuals.combinedDesc
          );
          if (fallbackVal) {
            filledValue = fallbackVal;
            source = 'description';
            note = 'Базовий дефолтний фолбек для обов\'язкового поля за PIM-довідником категорії';
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

    // 1. Photo column: 1:1 mirror CDN URLs (e.g. https://cdn.27.ua/...)
    const cleanColLower = (col.cleanName || col.originalName).toLowerCase();
    const isPhotoCol =
      cleanColLower.includes('фото') ||
      cleanColLower.includes('зображення') ||
      cleanColLower.includes('photo') ||
      cleanColLower.includes('image');

    const origVal =
      pRow.originalRow && pRow.originalRow[col.originalName] !== undefined
        ? pRow.originalRow[col.originalName]
        : (pRow.originalRow ? pRow.originalRow[col.cleanName] : undefined);

    const hasOriginalNonEmpty =
      origVal !== undefined &&
      origVal !== null &&
      String(origVal).trim() !== '' &&
      String(origVal).toLowerCase() !== 'nan';

    if (isPhotoCol) {
      if (hasOriginalNonEmpty) {
        return origVal;
      }
      return pRow.updatedRow[col.originalName] || '';
    }

    // 2. Existing Non-Empty Cells Inviolability & Dictionary Sanitization
    // Preserve existing valid data, but ensure select/multiselect cells comply with Epicentr dictionary
    if (hasOriginalNonEmpty) {
      const updatedVal = pRow.updatedRow[col.originalName];
      const hasUpdated = updatedVal !== undefined && updatedVal !== null && String(updatedVal).trim() !== '' && String(updatedVal).toLowerCase() !== 'nan';
      const targetStr = String(hasUpdated ? updatedVal : origVal).trim();

      if ((col.type === 'select' || col.type === 'multiselect') && dictionaryIndex) {
        const dictAttr = findDictionaryAttr(dictionaryIndex, col.cleanName || col.originalName);
        if (dictAttr && dictAttr.allowedValues.length > 0) {
          // A. Try direct sanitization
          const sanitized = sanitizeValueAgainstDictionary(targetStr, dictAttr.allowedValues, col.type === 'multiselect');
          if (sanitized) return decodeHtmlEntities(sanitized);

          // B. If targetStr was updatedVal and failed, try origVal
          if (hasUpdated && origVal) {
            const sanitizedOrig = sanitizeValueAgainstDictionary(String(origVal).trim(), dictAttr.allowedValues, col.type === 'multiselect');
            if (sanitizedOrig) return decodeHtmlEntities(sanitizedOrig);
          }

          // C. Brand handling: If brand is not registered in Epicentr's category dictionary, Epicentr requires "Інше"
          const isBrandCol = col.cleanName.toLowerCase().includes('бренд') || col.originalName.toLowerCase().includes('бренд');
          if (isBrandCol) {
            const other = dictAttr.allowedValues.find(v => v.toLowerCase() === 'інше' || v.toLowerCase() === 'інша' || v.toLowerCase() === 'other');
            if (other) return decodeHtmlEntities(other);
          }

          // D. Fallback for mandatory select/multiselect if value was completely invalid in dictionary
          if (col.isRequired || col.originalName.includes('*')) {
            const fallback = resolveMandatoryFallback(col.originalName, col.type, dictAttr.allowedValues, pRow.titleFormattedUa || pRow.titleOriginal || '');
            if (fallback) return decodeHtmlEntities(fallback);
          }

          // E. In Epicentr, writing an invalid string to a select/multiselect column causes "Значення не з довідника" rejection
          return '';
        }
      }

      const rawResult = hasUpdated ? updatedVal : origVal;
      return typeof rawResult === 'string' ? decodeHtmlEntities(rawResult) : rawResult;
    }

    // 3. For cells that were originally EMPTY in the input Excel:
    let candidateVal: any = pRow.updatedRow[col.originalName];
    if (candidateVal === undefined || candidateVal === null || String(candidateVal).trim() === '') {
      candidateVal = pRow.updatedRow[col.cleanName];
    }
    if (candidateVal === undefined || candidateVal === null || String(candidateVal).trim() === '') {
      const normH = normalizeEpicentrHeaderName(col.originalName);
      candidateVal = pRow.updatedRow[normH];
    }
    if ((candidateVal === undefined || candidateVal === null || String(candidateVal).trim() === '') && pRow.diffs) {
      const d = pRow.diffs[col.originalName] || pRow.diffs[col.cleanName];
      if (d && d.newValue !== undefined && d.newValue !== null && String(d.newValue).trim() !== '') {
        candidateVal = d.newValue;
      }
    }

    if (candidateVal === undefined || candidateVal === null || String(candidateVal).trim() === '') {
      if ((col.isRequired || col.originalName.includes('*')) && dictionaryIndex) {
        const dictAttr = findDictionaryAttr(dictionaryIndex, col.cleanName || col.originalName);
        if (dictAttr && dictAttr.allowedValues.length > 0) {
          const fallback = resolveMandatoryFallback(
            col.originalName,
            col.type,
            dictAttr.allowedValues,
            pRow.titleFormattedUa || pRow.titleOriginal || ''
          );
          if (fallback) {
            pRow.updatedRow[col.originalName] = fallback;
            return decodeHtmlEntities(fallback);
          }
        }
      }
      return '';
    }

    const candStr = String(candidateVal).trim();

    // STRICT REQUIREMENT 1 & 2: Categorically forbid writing hex codes, IDs, or AI disclaimers to output Excel
    if (isInternalHexOrHashId(candStr) || isAiDisclaimerOrServiceText(candStr)) {
      return '';
    }

    // Strictly enforce dictionary for any select / multiselect column
    if ((col.type === 'select' || col.type === 'multiselect') && dictionaryIndex) {
      const dictAttr = findDictionaryAttr(dictionaryIndex, col.cleanName || col.originalName);
      if (dictAttr && dictAttr.allowedValues.length > 0) {
        const sanitized = sanitizeValueAgainstDictionary(candStr, dictAttr.allowedValues, col.type === 'multiselect');
        if (sanitized) return decodeHtmlEntities(sanitized);

        // Brand not in category dictionary -> map to "Інше"
        const isBrandCol = col.cleanName.toLowerCase().includes('бренд') || col.originalName.toLowerCase().includes('бренд');
        if (isBrandCol) {
          const other = dictAttr.allowedValues.find(v => v.toLowerCase() === 'інше' || v.toLowerCase() === 'інша' || v.toLowerCase() === 'other');
          if (other) return decodeHtmlEntities(other);
        }

        // For mandatory fields, resolve canonical fallback from allowedValues
        if (col.isRequired || col.originalName.includes('*')) {
          const fallback = resolveMandatoryFallback(col.originalName, col.type, dictAttr.allowedValues, pRow.titleFormattedUa || pRow.titleOriginal || '');
          if (fallback) return decodeHtmlEntities(fallback);
        }

        return '';
      }
      return decodeHtmlEntities(candStr);
    }

    return typeof candidateVal === 'string' ? decodeHtmlEntities(candidateVal) : candidateVal;
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
    const normalizeCellHeader = (s: string) => normalizeEpicentrHeaderName(s);

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

      // Guarantee exact clean original name preserving \n without \r or _x000d_
      const cleanHeader = normalizeEpicentrHeaderName(col.originalName);
      if (!ws[headerCellRef]) {
        ws[headerCellRef] = { t: 's', v: cleanHeader };
      } else {
        ws[headerCellRef].v = cleanHeader;
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
    const headers = columns.map(c => normalizeEpicentrHeaderName(c.originalName));
    const dataRows = processedRows.map(p => {
      return columns.map(c => resolveExportCellValue(p, c));
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    
    // Attach exact original comments to header cells (strictly forbidden to generate ATTR_ codes)
    columns.forEach((col, cIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: cIdx });
      if (ws[cellRef]) {
        ws[cellRef].v = normalizeEpicentrHeaderName(col.originalName);
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

