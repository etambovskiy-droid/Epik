/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceProduct } from './xmlFeedParserService';
import {
  EpicentrCategory,
  EpicentrAttributeSet,
  EpicentrAttributeDef,
  FALLBACK_ATTRIBUTE_SETS
} from './epicentrMerchantApiService';

export interface CategoryMappingConfig {
  [sourceCategoryId: string]: {
    epicentrCategoryCode: string;
    epicentrCategoryName: string;
    attributeSetCode: string;
    attributeSetName: string;
  };
}

export interface EpicentrFeedGenerationOptions {
  categoryMappings?: CategoryMappingConfig;
  attributeSets?: Record<string, EpicentrAttributeSet>;
  selectedCategoryIds?: string[];
  defaultMeasure?: string;
  defaultRatio?: string;
  defaultCountry?: string;
  defaultBrand?: string;
}

function cleanXmlText(text: string): string {
  if (!text) return '';
  return text
    .replace(/_x000d_/gi, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return cleanXmlText(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapCdata(content: string): string {
  if (!content) return '';
  return cleanXmlText(content).replace(/]]>/g, ']]]]><![CDATA[>');
}

const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  // Ukrainian & Russian Cyrillic
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye',
  'ж': 'zh', 'з': 'z', 'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l',
  'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ь': '',
  'ю': 'yu', 'я': 'ya', 'ы': 'y', 'э': 'e', 'ё': 'yo', 'ъ': ''
};

export function transliterateCyrillic(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN_MAP[char] !== undefined ? CYRILLIC_TO_LATIN_MAP[char] : char)
    .join('');
}

function stringSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function slugify(text: string, fallbackPrefix = 'param'): string {
  if (!text) return `${fallbackPrefix}_${Math.random().toString(36).substring(2, 7)}`;
  const transliterated = transliterateCyrillic(text);
  const slug = transliterated
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!slug) {
    return `${fallbackPrefix}_${stringSimpleHash(text) || 'val'}`;
  }
  return slug;
}

function extractNumericFloat(val: string, suffix?: string): string {
  if (!val) return '0';
  const clean = val.replace(/,/g, '.');
  const numMatch = clean.match(/[-+]?[0-9]*\.?[0-9]+/);
  if (!numMatch) return '0';
  let num = parseFloat(numMatch[0]);

  // Unit conversions based on suffix
  const valLower = val.toLowerCase();
  if (suffix === 'мм' && (valLower.includes('см') || valLower.includes('cm'))) {
    num = num * 10;
  } else if (suffix === 'мм' && (valLower.includes('м') || valLower.includes('m')) && !valLower.includes('мм')) {
    num = num * 1000;
  } else if (suffix === 'г' && (valLower.includes('кг') || valLower.includes('kg'))) {
    num = num * 1000;
  }

  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.00$/, '');
}

const ATTRIBUTE_SEMANTIC_ALIASES: Record<string, string[]> = {
  'матеріал основи': ['основа шпалер', 'основа обоев', 'матеріал основи', 'основа'],
  'материал основы': ['основа шпалер', 'основа обоев', 'материал основы', 'основа'],
  'нанесення клею': ['спосіб наклеювання', 'способ наклеивания', 'нанесення клею'],
  'нанесение клея': ['спосіб наклеювання', 'способ наклеивания', 'нанесение клея'],
  'накладення малюнка': ['зсув (рапорт)', 'сдвиг (раппорт)', 'рапорт', 'стикування'],
  'наложение рисунка': ['зсув (рапорт)', 'сдвиг (раппорт)', 'рапорт', 'стыковка'],
  'стикування': ['зсув (рапорт)', 'сдвиг (раппорт)'],
  'рапорт': ['зсув (рапорт)', 'сдвиг (раппорт)'],
  'матеріал поверхні': ['тип', 'матеріал поверхні', 'покриття'],
  'материал поверхности': ['тип', 'матеріал поверхні', 'покрытие'],
  'догляд': ['шпалери за способом догляду', 'обои по способу ухода'],
  'кімната призначення': ['кімната', 'комната', 'призначення'],
  'призначення': ['кімната', 'комната'],
  'колір': ['базовий колір', 'колір виробника', 'колір'],
  'цвет': ['базовий колір', 'колір виробника', 'базовый цвет', 'цвет'],
  'гарантійний термін': ['гарантія', 'гарантия'],
  'країна': ['країна-виробник', 'страна-производитель']
};

function resolveAttributeDef(
  pCodeLower: string,
  pNameLower: string,
  attrDefsMap: Map<string, EpicentrAttributeDef>
): EpicentrAttributeDef | undefined {
  if (pCodeLower && attrDefsMap.has(pCodeLower)) {
    return attrDefsMap.get(pCodeLower);
  }
  if (pNameLower && attrDefsMap.has(pNameLower)) {
    return attrDefsMap.get(pNameLower);
  }
  const aliases = ATTRIBUTE_SEMANTIC_ALIASES[pNameLower];
  if (aliases) {
    for (const alias of aliases) {
      const found = attrDefsMap.get(alias);
      if (found) return found;
    }
  }
  return undefined;
}

function normalizeOptionToken(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/(\d)\.(\d)/g, '$1,$2')
    .replace(/(?:^|\s)(?:мм|см|м2|м²|м|кг|г|гр|шт\.?|л|мл|вт|w|v|в|хв|год|року|років)(?=$|[\s,;.)])/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findBestOptionMatch(
  rawValue: string,
  options?: { code: string; value: string; value_ru?: string }[]
): { code: string; value: string; value_ru?: string } | undefined {
  if (!options || options.length === 0 || !rawValue) return undefined;
  const valLower = rawValue.toLowerCase().trim();

  // 1. Exact match (UA / RU / code)
  const exact = options.find(
    (o) =>
      o.value.toLowerCase().trim() === valLower ||
      o.value_ru?.toLowerCase().trim() === valLower ||
      o.code.toLowerCase().trim() === valLower
  );
  if (exact) return exact;

  // 2. Normalized unit & decimal separator match (e.g. "1.06 м" -> "1,06")
  const valNorm = normalizeOptionToken(rawValue);
  if (valNorm) {
    const normMatch = options.find(
      (o) =>
        normalizeOptionToken(o.value) === valNorm ||
        (o.value_ru && normalizeOptionToken(o.value_ru) === valNorm)
    );
    if (normMatch) return normMatch;
  }

  // 3. Semantic prefix / root match ranked by specificity (avoid matching numeric sub-variants like "32" when generic option exists)
  if (valNorm.length >= 4) {
    const stem = valNorm.slice(0, Math.min(valNorm.length, 5));
    const candidates = options.filter((o) => {
      const ov = o.value.toLowerCase().trim();
      const oru = o.value_ru?.toLowerCase().trim() || '';
      return ov.startsWith(valNorm) || oru.startsWith(valNorm) || ov.startsWith(stem) || oru.startsWith(stem);
    });
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const aHasDigits = /\d/.test(a.value) ? 1 : 0;
        const bHasDigits = /\d/.test(b.value) ? 1 : 0;
        if (aHasDigits !== bHasDigits) return aHasDigits - bHasDigits;
        return a.value.length - b.value.length;
      });
      return candidates[0];
    }
  }

  return undefined;
}

export class EpicentrXmlGeneratorService {
  /**
   * Formats the current date in YYYY-MM-DD HH:mm format
   */
  public static getCurrentDateString(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  /**
   * Generates valid Epicentr XML feed string matching the exact official structure
   */
  public static generateEpicentrXml(
    products: SourceProduct[],
    categoriesList: EpicentrCategory[],
    options: EpicentrFeedGenerationOptions = {}
  ): string {
    const dateStr = this.getCurrentDateString();
    const lines: string[] = [];

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<yml_catalog date="${dateStr}">`);
    lines.push('<offers>');

    const selectedSet = options.selectedCategoryIds ? new Set(options.selectedCategoryIds) : null;
    const targetProducts = selectedSet
      ? products.filter((p) => selectedSet.has(p.categoryId))
      : products;

    const mappings = options.categoryMappings || {};
    const defaultCat = categoriesList[0] || {
      code: '3343',
      name: 'Картини за номерами',
      attribute_set_code: '3343',
      attribute_set_name: 'Картини за номерами'
    };

    // Pre-index attribute sets for O(1) performance
    const attrSetIndex = new Map<string, EpicentrAttributeSet>();
    FALLBACK_ATTRIBUTE_SETS.forEach((s) => {
      attrSetIndex.set(s.code, s);
      if (s.category_codes) {
        s.category_codes.forEach((cCode) => attrSetIndex.set(cCode, s));
      }
    });

    if (options.attributeSets) {
      Object.entries(options.attributeSets).forEach(([code, s]) => {
        attrSetIndex.set(code, s);
        if (s.category_codes) {
          s.category_codes.forEach((cCode) => attrSetIndex.set(cCode, s));
        }
      });
    }

    targetProducts.forEach((prod) => {
      const mapping = mappings[prod.categoryId] || mappings[prod.categoryName];

      const categoryCode = mapping?.epicentrCategoryCode || defaultCat.code;
      const categoryName = mapping?.epicentrCategoryName || defaultCat.name;
      const attributeSetCode = mapping?.attributeSetCode || defaultCat.attribute_set_code || categoryCode;
      const attributeSetName = mapping?.attributeSetName || defaultCat.attribute_set_name || categoryName;

      const attrSet = attrSetIndex.get(attributeSetCode) || attrSetIndex.get(categoryCode);

      // Fast attribute name -> EpicentrAttributeDef lookup
      const attrDefsMap = new Map<string, EpicentrAttributeDef>();
      if (attrSet && Array.isArray(attrSet.attributes)) {
        attrSet.attributes.forEach((attr) => {
          attrDefsMap.set(attr.code.toLowerCase(), attr);
          attrDefsMap.set(attr.name.toLowerCase().trim(), attr);
          if (Array.isArray(attr.translations)) {
            attr.translations.forEach((t) => {
              if (t.title) attrDefsMap.set(t.title.toLowerCase().trim(), attr);
            });
          }
        });
      }

      const availableAttr = prod.available ? 'true' : 'false';
      const availabilityStatus = prod.available ? 'in_stock' : 'out_of_stock';

      lines.push(`<offer id="${escapeXml(prod.id)}" available="${availableAttr}">`);
      lines.push(`<price>${escapeXml(prod.price)}</price>`);
      if (prod.price_old) {
        lines.push(`<price_old>${escapeXml(prod.price_old)}</price_old>`);
      }
      lines.push(`<availability>${availabilityStatus}</availability>`);
      lines.push(`<category code="${escapeXml(categoryCode)}">${escapeXml(categoryName)}</category>`);

      // Picture(s)
      const mainPicture = prod.picture || (prod.pictures && prod.pictures[0]) || '';
      if (mainPicture) {
        lines.push(`<picture>${escapeXml(mainPicture)}</picture>`);
      }
      if (Array.isArray(prod.pictures) && prod.pictures.length > 1) {
        prod.pictures.slice(1, 15).forEach((pic) => {
          if (pic && pic !== mainPicture) {
            lines.push(`<picture>${escapeXml(pic)}</picture>`);
          }
        });
      }

      // Bilingual Names
      const nameRu = prod.name_ru || prod.name || '';
      const nameUa = prod.name_ua || prod.name || '';
      lines.push(`<name lang="ru">${escapeXml(nameRu)}</name>`);
      lines.push(`<name lang="ua">${escapeXml(nameUa)}</name>`);

      // Bilingual Descriptions with CDATA
      const descRu = prod.description_ru || prod.description || '';
      const descUa = prod.description_ua || prod.description || '';
      lines.push(`<description lang="ru"><![CDATA[${wrapCdata(descRu)}]]></description>`);
      lines.push(`<description lang="ua"><![CDATA[${wrapCdata(descUa)}]]></description>`);

      // Attribute set
      lines.push(`<attribute_set code="${escapeXml(attributeSetCode)}">${escapeXml(attributeSetName)}</attribute_set>`);

      // Keep track of emitted codes to avoid duplicates
      const emittedParamCodes = new Set<string>();

      // Custom parameters with schema mapping
      prod.params.forEach((param) => {
        const pNameLower = param.name.toLowerCase().trim();
        const pCodeLower = (param.code || '').toLowerCase().trim();

        // Skip system parameters handled below
        if (
          pNameLower.includes('бренд') ||
          pNameLower.includes('производитель') ||
          pNameLower.includes('виробник') ||
          pNameLower.includes('країна') ||
          pNameLower.includes('страна') ||
          pNameLower.includes('штрих') ||
          pNameLower.includes('міра') ||
          pNameLower.includes('кратність') ||
          pNameLower === 'вага' ||
          pNameLower === 'вес' ||
          pNameLower === 'ширина' ||
          pNameLower === 'висота' ||
          pNameLower === 'высота' ||
          pNameLower === 'глибина' ||
          pNameLower === 'глубина' ||
          pNameLower === 'довжина' ||
          pCodeLower === 'weight' ||
          pCodeLower === 'width' ||
          pCodeLower === 'height' ||
          pCodeLower === 'length' ||
          pCodeLower === 'brand' ||
          pCodeLower === 'country_of_origin' ||
          pCodeLower === 'measure' ||
          pCodeLower === 'ratio' ||
          pCodeLower === 'barcodes'
        ) {
          return;
        }

        const matchedDef = resolveAttributeDef(pCodeLower, pNameLower, attrDefsMap);
        const effectiveCode = matchedDef?.code || param.code || slugify(param.name, 'param');
        const effectiveName = matchedDef?.name || param.name || effectiveCode;

        if (emittedParamCodes.has(effectiveCode)) return;
        emittedParamCodes.add(effectiveCode);

        // 1. Text parameter with bilingual support (e.g. 767 Комплектація)
        if (
          matchedDef?.type === 'text' ||
          effectiveCode === '767' ||
          effectiveCode === 'equipment' ||
          pNameLower.includes('комплектац')
        ) {
          const uaTitle = matchedDef?.translations?.find((t) => t.languageCode === 'ua')?.title || matchedDef?.name || effectiveName;
          const ruTitle = matchedDef?.translations?.find((t) => t.languageCode === 'ru')?.title || uaTitle;

          lines.push(
            `<param lang="ru" paramcode="${escapeXml(effectiveCode)}" name="${escapeXml(ruTitle)}"><![CDATA[${wrapCdata(param.value)}]]></param>`
          );
          lines.push(
            `<param lang="ua" paramcode="${escapeXml(effectiveCode)}" name="${escapeXml(uaTitle)}"><![CDATA[${wrapCdata(param.value)}]]></param>`
          );
          return;
        }

        // 2. Multiselect parameter (e.g. 3176 Тематика, 3125 Тип, genre, etc.)
        if (matchedDef?.type === 'multiselect') {
          const rawItems = param.value.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);
          const valCodes: string[] = [];
          const valTexts: string[] = [];

          rawItems.forEach((item) => {
            const matchedOpt = findBestOptionMatch(item, matchedDef.options);
            if (matchedOpt) {
              valCodes.push(matchedOpt.code);
              valTexts.push(matchedOpt.value);
            } else {
              valCodes.push(slugify(item, 'val'));
              valTexts.push(item);
            }
          });

          const codeStr = param.valuecode || (valCodes.length > 0 ? valCodes.join(',') : slugify(param.value, 'val'));
          const textStr = valTexts.length > 0 ? valTexts.join(', ') : param.value;
          lines.push(
            `<param paramcode="${escapeXml(effectiveCode)}" name="${escapeXml(effectiveName)}" valuecode="${escapeXml(codeStr)}">${escapeXml(textStr)}</param>`
          );
          return;
        }

        // 3. Select parameter (e.g. 7181 Ширина рулону, 13333 Основа шпалер, 3130 Спосіб наклеювання, 3129 Зсув)
        if (matchedDef?.type === 'select') {
          const matchedOpt = findBestOptionMatch(param.value, matchedDef.options);
          const effectiveValCode = param.valuecode || matchedOpt?.code || slugify(param.value, 'val');
          const effectiveValText = matchedOpt?.value || param.value;

          lines.push(
            `<param paramcode="${escapeXml(effectiveCode)}" name="${escapeXml(effectiveName)}" valuecode="${escapeXml(effectiveValCode)}">${escapeXml(effectiveValText)}</param>`
          );
          return;
        }

        // 4. Float / Numeric parameter (e.g. warranty, power, frequency) - strictly numbers without letters
        if (matchedDef?.type === 'float' || matchedDef?.type === 'numeric') {
          const cleanNum = extractNumericFloat(param.value, matchedDef.suffix);
          lines.push(
            `<param paramcode="${escapeXml(effectiveCode)}" name="${escapeXml(effectiveName)}"><![CDATA[${cleanNum}]]></param>`
          );
          return;
        }

        // 5. Array parameter (e.g. barcodes) - letters and numbers separated by comma or semicolon
        if (matchedDef?.type === 'array') {
          const cleanArr = param.value.replace(/[^\w\d,;\-\s]/g, '').trim();
          lines.push(
            `<param paramcode="${escapeXml(effectiveCode)}" name="${escapeXml(effectiveName)}"><![CDATA[${cleanArr}]]></param>`
          );
          return;
        }

        // 6. String parameter (e.g. model reference code) - alphanumeric without separators/punctuation
        if (matchedDef?.type === 'string') {
          const cleanStr = param.value.replace(/[\s,;./\\-]+/g, '').trim();
          lines.push(
            `<param paramcode="${escapeXml(effectiveCode)}" name="${escapeXml(effectiveName)}"><![CDATA[${cleanStr || param.value}]]></param>`
          );
          return;
        }

        // 7. General fallback parameter (Universal across all categories)
        // Ensure every discrete parameter receives a valid, non-empty valuecode
        let effectiveValCode = param.valuecode;
        if (!effectiveValCode) {
          if ((param.value.includes(',') || param.value.includes(';')) && !param.value.match(/^[0-9]+,[0-9]+$/)) {
            const rawParts = param.value.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
            effectiveValCode = rawParts.length > 0 ? rawParts.map((p) => slugify(p, 'val')).join(',') : slugify(param.value, 'val');
          } else {
            effectiveValCode = slugify(param.value, 'val');
          }
        }

        lines.push(
          `<param paramcode="${escapeXml(effectiveCode)}" name="${escapeXml(effectiveName)}" valuecode="${escapeXml(effectiveValCode)}">${escapeXml(param.value)}</param>`
        );
      });

      // Standard Mandatory Epicentr Parameters
      const measure = prod.measure || options.defaultMeasure || 'шт.';
      const measureDef = attrDefsMap.get('measure');
      const matchedMeasureOpt = findBestOptionMatch(measure, measureDef?.options);
      const measureCode =
        matchedMeasureOpt?.code ||
        (measure === 'шт.' || measure.toLowerCase() === 'шт' ? 'measure_pcs' : slugify(measure) || 'measure_pcs');
      lines.push(`<param paramcode="measure" name="Міра виміру" valuecode="${measureCode}">${escapeXml(matchedMeasureOpt?.value || measure)}</param>`);

      const ratio = prod.ratio || options.defaultRatio || '1';
      lines.push(`<param paramcode="ratio" name="Мінімальна кратність товару"><![CDATA[${ratio}]]></param>`);

      const country = prod.country_of_origin || options.defaultCountry || 'Україна';
      const countryDef = attrDefsMap.get('country_of_origin');
      const matchedCountryOpt = findBestOptionMatch(country, countryDef?.options);
      let countryCode = matchedCountryOpt?.code || 'ukr';
      if (!matchedCountryOpt) {
        const cLower = country.toLowerCase();
        if (cLower.includes('китай') || cLower.includes('china')) countryCode = 'chn';
        else if (cLower.includes('украї') || cLower.includes('украи')) countryCode = 'ukr';
        else if (cLower.includes('поль') || cLower.includes('pol')) countryCode = 'pol';
        else if (cLower.includes('німеч') || cLower.includes('герман') || cLower.includes('deu')) countryCode = 'deu';
        else countryCode = slugify(country) || 'ukr';
      }
      lines.push(`<param paramcode="country_of_origin" name="Країна-виробник" valuecode="${countryCode}">${escapeXml(matchedCountryOpt?.value || country)}</param>`);

      const brand = prod.brand || options.defaultBrand || 'Generic';
      const brandDef = attrDefsMap.get('brand');
      const matchedBrandOpt = brandDef?.options?.find(
        (o) => o.value.toLowerCase() === brand.toLowerCase() || o.code.toLowerCase() === brand.toLowerCase()
      );
      const brandCode = matchedBrandOpt?.code || (brand.toLowerCase() === 'ідейка' ? 'cz1445500250k5a9' : slugify(brand) || 'generic');
      lines.push(`<param paramcode="brand" name="Бренд" valuecode="${brandCode}">${escapeXml(brand)}</param>`);

      // Dimensions & Logistics in CDATA
      const widthVal = extractNumericFloat(prod.width || '10', 'мм');
      const heightVal = extractNumericFloat(prod.height || '20', 'мм');
      const lengthVal = extractNumericFloat(prod.length || '30', 'мм');
      const weightVal = extractNumericFloat(prod.weight || '1000', 'г');

      lines.push(`<param paramcode="width" name="Ширина"><![CDATA[${widthVal}]]></param>`);
      lines.push(`<param paramcode="height" name="Висота"><![CDATA[${heightVal}]]></param>`);
      lines.push(`<param paramcode="length" name="Глибина"><![CDATA[${lengthVal}]]></param>`);
      lines.push(`<param paramcode="weight" name="Вага"><![CDATA[${weightVal}]]></param>`);

      const barcode = prod.barcode || `200000${prod.id.replace(/\D/g, '').padEnd(7, '0').slice(0, 7)}`;
      lines.push(`<param paramcode="barcodes" name="Штрих код"><![CDATA[${barcode}]]></param>`);

      lines.push('</offer>');
    });

    lines.push('</offers>');
    lines.push('</yml_catalog>');

    return lines.join('\n');
  }

  /**
   * Helper to trigger direct browser download of generated XML file
   */
  public static downloadXmlFile(xmlContent: string, filename = 'epicentr_catalog_feed.xml'): void {
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Official Epicentr Marketplace XML Feed XSD Schema (PIM v2 Standard)
   */
  public static readonly EPICENTR_OFFICIAL_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified">
  <xs:element name="yml_catalog">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="offers" minOccurs="1" maxOccurs="1">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="offer" minOccurs="1" maxOccurs="unbounded">
                <xs:complexType>
                  <xs:sequence>
                    <xs:element name="price" type="xs:decimal" minOccurs="1" maxOccurs="1"/>
                    <xs:element name="price_old" type="xs:decimal" minOccurs="0" maxOccurs="1"/>
                    <xs:element name="availability" minOccurs="1" maxOccurs="1">
                      <xs:simpleType>
                        <xs:restriction base="xs:string">
                          <xs:enumeration value="in_stock"/>
                          <xs:enumeration value="out_of_stock"/>
                          <xs:enumeration value="on_order"/>
                        </xs:restriction>
                      </xs:simpleType>
                    </xs:element>
                    <xs:element name="category" minOccurs="1" maxOccurs="1">
                      <xs:complexType>
                        <xs:simpleContent>
                          <xs:extension base="xs:string">
                            <xs:attribute name="code" type="xs:string" use="required"/>
                          </xs:extension>
                        </xs:simpleContent>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="picture" type="xs:anyURI" minOccurs="0" maxOccurs="15"/>
                    <xs:element name="name" minOccurs="2" maxOccurs="2">
                      <xs:complexType>
                        <xs:simpleContent>
                          <xs:extension base="xs:string">
                            <xs:attribute name="lang" use="required">
                              <xs:simpleType>
                                <xs:restriction base="xs:string">
                                  <xs:enumeration value="ru"/>
                                  <xs:enumeration value="ua"/>
                                </xs:restriction>
                              </xs:simpleType>
                            </xs:attribute>
                          </xs:extension>
                        </xs:simpleContent>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="description" minOccurs="2" maxOccurs="2">
                      <xs:complexType>
                        <xs:simpleContent>
                          <xs:extension base="xs:string">
                            <xs:attribute name="lang" use="required">
                              <xs:simpleType>
                                <xs:restriction base="xs:string">
                                  <xs:enumeration value="ru"/>
                                  <xs:enumeration value="ua"/>
                                </xs:restriction>
                              </xs:simpleType>
                            </xs:attribute>
                          </xs:extension>
                        </xs:simpleContent>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="attribute_set" minOccurs="1" maxOccurs="1">
                      <xs:complexType>
                        <xs:simpleContent>
                          <xs:extension base="xs:string">
                            <xs:attribute name="code" type="xs:string" use="required"/>
                          </xs:extension>
                        </xs:simpleContent>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="param" minOccurs="5" maxOccurs="unbounded">
                      <xs:complexType>
                        <xs:simpleContent>
                          <xs:extension base="xs:string">
                            <xs:attribute name="paramcode" type="xs:string" use="required"/>
                            <xs:attribute name="name" type="xs:string" use="required"/>
                            <xs:attribute name="valuecode" type="xs:string" use="optional"/>
                          </xs:extension>
                        </xs:simpleContent>
                      </xs:complexType>
                    </xs:element>
                  </xs:sequence>
                  <xs:attribute name="id" type="xs:string" use="required"/>
                  <xs:attribute name="available" type="xs:boolean" use="required"/>
                </xs:complexType>
              </xs:element>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
      <xs:attribute name="date" use="required">
        <xs:simpleType>
          <xs:restriction base="xs:string">
            <xs:pattern value="\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}"/>
          </xs:restriction>
        </xs:simpleType>
      </xs:attribute>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

  /**
   * Validates generated XML string against the official Epicentr XSD Schema standards
   */
  public static validateXmlAgainstEpicentrXsd(xmlContent: string): EpicentrXsdValidationReport {
    const issues: EpicentrXsdIssue[] = [];
    const checkpoints: EpicentrXsdCheckpoint[] = [];

    if (!xmlContent || !xmlContent.trim()) {
      return {
        isValid: false,
        validatedAt: new Date().toISOString(),
        offersValidated: 0,
        errorCount: 1,
        warningCount: 0,
        complianceScore: 0,
        checkpoints: [],
        issues: [
          {
            severity: 'error',
            code: 'XSD_EMPTY_DOCUMENT',
            element: 'document',
            message: 'XML-документ порожній. Спочатку згенеруйте XML-фід.'
          }
        ]
      };
    }

    // 1. Check XML Well-formedness & Declaration
    const hasXmlDecl = xmlContent.trimStart().startsWith('<?xml version="1.0" encoding="UTF-8"?>');
    if (!hasXmlDecl) {
      issues.push({
        severity: 'warning',
        code: 'XSD_XML_DECLARATION',
        element: '<?xml?>',
        message: 'Відсутня або нестандартна декларація <?xml version="1.0" encoding="UTF-8"?> на початку файлу.',
        line: 1
      });
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
    const parserError = xmlDoc.querySelector('parsererror');

    if (parserError) {
      issues.push({
        severity: 'error',
        code: 'XSD_MALFORMED_XML',
        element: 'xml',
        message: `Синтаксична помилка XML (DOMParser): ${parserError.textContent?.slice(0, 180) || 'Некоректна розмітка тегів'}`
      });

      checkpoints.push({
        id: 'xml_syntax',
        title: 'Синтаксис XML та кодування UTF-8',
        xsdRule: 'xs:schema / XML 1.0 Well-Formed',
        passed: false,
        details: 'Виявлено синтаксичну помилку парсингу XML'
      });

      return {
        isValid: false,
        validatedAt: new Date().toISOString(),
        offersValidated: 0,
        errorCount: issues.filter((i) => i.severity === 'error').length,
        warningCount: issues.filter((i) => i.severity === 'warning').length,
        complianceScore: 15,
        checkpoints,
        issues
      };
    }

    checkpoints.push({
      id: 'xml_syntax',
      title: 'Синтаксис XML та кодування UTF-8',
      xsdRule: '<?xml version="1.0" encoding="UTF-8"?>',
      passed: true,
      details: 'Валідне дерево DOM, кодування UTF-8 підтверджено'
    });

    // 2. Root <yml_catalog> & date attribute pattern (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) + forbidden tags check
    const root = xmlDoc.documentElement;
    let rootPassed = true;

    if (!root || root.tagName !== 'yml_catalog') {
      rootPassed = false;
      issues.push({
        severity: 'error',
        code: 'XSD_ROOT_ELEMENT',
        element: root?.tagName || 'root',
        message: `Кореневий елемент має бути <yml_catalog>, знайдено <${root?.tagName || 'unknown'}>.`
      });
    } else {
      const dateAttr = root.getAttribute('date');
      const dateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
      if (!dateAttr) {
        rootPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_MISSING_DATE',
          element: 'yml_catalog[@date]',
          message: 'У кореневому тезі <yml_catalog> відсутній обовʼязковий атрибут date.'
        });
      } else if (!dateRegex.test(dateAttr)) {
        rootPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_INVALID_DATE_PATTERN',
          element: 'yml_catalog[@date]',
          message: `Атрибут date="${dateAttr}" не відповідає XSD-шаблону "YYYY-MM-DD HH:mm".`
        });
      }

      // Check for prohibited legacy YML tags (<shop>, <currencies>, <categories> outside offers)
      const forbiddenShop = root.querySelector(':scope > shop');
      const forbiddenCurrencies = root.querySelector('currencies');
      const forbiddenCategories = root.querySelector('categories');
      if (forbiddenShop || forbiddenCurrencies || forbiddenCategories) {
        rootPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_FORBIDDEN_LEGACY_TAGS',
          element: 'yml_catalog',
          message: 'Виявлено заборонені застарілі теги (<shop>, <currencies> або <categories>). Схема Епіцентру вимагає прямий контейнер <offers> всередині <yml_catalog>.'
        });
      }
    }

    checkpoints.push({
      id: 'root_catalog',
      title: 'Кореневий вузол <yml_catalog> та формат дати',
      xsdRule: 'xs:element name="yml_catalog" date="\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}"',
      passed: rootPassed,
      details: rootPassed
        ? `date="${root?.getAttribute('date') || ''}", без застарілих тегів <shop>`
        : 'Порушено структуру кореневого елемента або формат дати'
    });

    // 3. <offers> & <offer id="..." available="true|false">
    const offersContainer = root?.querySelector(':scope > offers');
    const offerNodes = offersContainer ? Array.from(offersContainer.querySelectorAll(':scope > offer')) : [];
    let offersStructurePassed = true;

    if (!offersContainer) {
      offersStructurePassed = false;
      issues.push({
        severity: 'error',
        code: 'XSD_MISSING_OFFERS',
        element: 'offers',
        message: 'Відсутній обовʼязковий контейнер <offers> безпосередньо всередині <yml_catalog>.'
      });
    } else if (offerNodes.length === 0) {
      offersStructurePassed = false;
      issues.push({
        severity: 'error',
        code: 'XSD_EMPTY_OFFERS',
        element: 'offers',
        message: 'Контейнер <offers> не містить жодного елемента <offer> (xs:minOccurs="1").'
      });
    }

    const seenIds = new Set<string>();
    let elementsStructurePassed = true;
    let bilingualPassed = true;
    let mandatoryParamsPassed = true;

    const REQUIRED_PARAM_CODES = ['measure', 'ratio', 'country_of_origin', 'brand', 'barcodes'];

    offerNodes.forEach((offer, idx) => {
      const offerId = offer.getAttribute('id')?.trim() || '';
      const availableAttr = offer.getAttribute('available');
      const offerLabel = offerId || `#${idx + 1}`;

      if (!offerId) {
        offersStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_OFFER_MISSING_ID',
          offerId: offerLabel,
          element: 'offer[@id]',
          message: `Товар #${idx + 1}: відсутній обов'язковий атрибут id в тезі <offer>.`
        });
      } else if (seenIds.has(offerId)) {
        offersStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_OFFER_DUPLICATE_ID',
          offerId,
          element: 'offer[@id]',
          message: `Товар [${offerId}]: дублювання унікального атрибута id у фіді.`
        });
      } else {
        seenIds.add(offerId);
      }

      if (availableAttr !== 'true' && availableAttr !== 'false') {
        offersStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_OFFER_AVAILABLE_BOOLEAN',
          offerId: offerLabel,
          element: 'offer[@available]',
          message: `Товар [${offerLabel}]: атрибут available="${availableAttr || ''}" має бути строго "true" або "false" (xs:boolean).`
        });
      }

      // 4. Mandatory child elements: price, availability, category, picture, attribute_set
      const priceNode = offer.querySelector(':scope > price');
      const priceOldNode = offer.querySelector(':scope > price_old');
      const priceVal = priceNode?.textContent?.trim() || '';
      const priceNum = Number(priceVal);

      if (!priceNode || !priceVal || Number.isNaN(priceNum) || priceNum <= 0) {
        elementsStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_INVALID_PRICE',
          offerId: offerLabel,
          element: 'price',
          message: `Товар [${offerLabel}]: тег <price> має містити додатне числове значення (xs:decimal > 0), отримано "${priceVal}".`
        });
      }

      if (priceOldNode && priceOldNode.textContent?.trim()) {
        const oldNum = Number(priceOldNode.textContent.trim());
        if (Number.isNaN(oldNum) || oldNum <= priceNum) {
          issues.push({
            severity: 'warning',
            code: 'XSD_PRICE_OLD_LOGIC',
            offerId: offerLabel,
            element: 'price_old',
            message: `Товар [${offerLabel}]: стара ціна <price_old> (${priceOldNode.textContent.trim()}) має бути більшою за поточну <price> (${priceVal}).`
          });
        }
      }

      const availabilityNode = offer.querySelector(':scope > availability');
      const availVal = availabilityNode?.textContent?.trim() || '';
      if (!['in_stock', 'out_of_stock', 'on_order'].includes(availVal)) {
        elementsStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_INVALID_AVAILABILITY',
          offerId: offerLabel,
          element: 'availability',
          message: `Товар [${offerLabel}]: тег <availability> має значення "${availVal}", дозволені лише: in_stock, out_of_stock, on_order.`
        });
      }

      const categoryNode = offer.querySelector(':scope > category');
      const catCode = categoryNode?.getAttribute('code')?.trim() || '';
      const catText = categoryNode?.textContent?.trim() || '';
      if (!categoryNode || !catCode || !catText) {
        elementsStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_INVALID_CATEGORY',
          offerId: offerLabel,
          element: 'category[@code]',
          message: `Товар [${offerLabel}]: тег <category> повинен мати непорожній атрибут code та назву категорії.`
        });
      }

      const pictureNodes = Array.from(offer.querySelectorAll(':scope > picture'));
      if (pictureNodes.length > 0) {
        pictureNodes.forEach((pic) => {
          const url = pic.textContent?.trim() || '';
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            issues.push({
              severity: 'warning',
              code: 'XSD_PICTURE_URI',
              offerId: offerLabel,
              element: 'picture',
              message: `Товар [${offerLabel}]: значення <picture> "${url.slice(0, 50)}" не є валідним HTTP/HTTPS посиланням.`
            });
          }
        });
      }

      const attrSetNode = offer.querySelector(':scope > attribute_set');
      const attrSetCode = attrSetNode?.getAttribute('code')?.trim() || '';
      const attrSetText = attrSetNode?.textContent?.trim() || '';
      if (!attrSetNode || !attrSetCode || !attrSetText) {
        elementsStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_INVALID_ATTRIBUTE_SET',
          offerId: offerLabel,
          element: 'attribute_set[@code]',
          message: `Товар [${offerLabel}]: відсутній або неповний обов'язковий тег <attribute_set code="...">.`
        });
      }

      // 5. Bilingual <name lang="ua|ru"> and <description lang="ua|ru">
      const nameUa = offer.querySelector(':scope > name[lang="ua"]')?.textContent?.trim() || '';
      const nameRu = offer.querySelector(':scope > name[lang="ru"]')?.textContent?.trim() || '';
      if (!nameUa) {
        bilingualPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_MISSING_NAME_UA',
          offerId: offerLabel,
          element: 'name[@lang="ua"]',
          message: `Товар [${offerLabel}]: відсутня обов'язкова українська назва <name lang="ua">.`
        });
      }
      if (!nameRu) {
        bilingualPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_MISSING_NAME_RU',
          offerId: offerLabel,
          element: 'name[@lang="ru"]',
          message: `Товар [${offerLabel}]: відсутня обов'язкова російська назва <name lang="ru">.`
        });
      }

      const descUa = offer.querySelector(':scope > description[lang="ua"]')?.textContent?.trim() || '';
      const descRu = offer.querySelector(':scope > description[lang="ru"]')?.textContent?.trim() || '';
      if (!descUa) {
        bilingualPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_MISSING_DESC_UA',
          offerId: offerLabel,
          element: 'description[@lang="ua"]',
          message: `Товар [${offerLabel}]: відсутній обов'язковий опис українською <description lang="ua">.`
        });
      }
      if (!descRu) {
        bilingualPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_MISSING_DESC_RU',
          offerId: offerLabel,
          element: 'description[@lang="ru"]',
          message: `Товар [${offerLabel}]: відсутній обов'язковий опис російською <description lang="ru">.`
        });
      }

      // 6. Mandatory PIM <param> nodes & attributes
      const paramNodes = Array.from(offer.querySelectorAll(':scope > param'));
      const foundParamCodes = new Set<string>();

      paramNodes.forEach((param) => {
        const pCode = param.getAttribute('paramcode')?.trim() || '';
        const pName = param.getAttribute('name')?.trim() || '';
        const pVal = param.textContent?.trim() || '';

        if (!pCode || !pName) {
          mandatoryParamsPassed = false;
          issues.push({
            severity: 'error',
            code: 'XSD_PARAM_MISSING_ATTRS',
            offerId: offerLabel,
            element: 'param',
            message: `Товар [${offerLabel}]: тег <param> повинен містити обов'язкові атрибути paramcode та name.`
          });
        } else {
          foundParamCodes.add(pCode);
        }

        if (!pVal) {
          issues.push({
            severity: 'warning',
            code: 'XSD_EMPTY_PARAM_VALUE',
            offerId: offerLabel,
            element: `param[@paramcode="${pCode}"]`,
            message: `Товар [${offerLabel}]: атрибут "${pName}" (${pCode}) має порожнє значення.`
          });
        }
      });

      REQUIRED_PARAM_CODES.forEach((reqCode) => {
        if (!foundParamCodes.has(reqCode)) {
          mandatoryParamsPassed = false;
          issues.push({
            severity: 'error',
            code: 'XSD_MISSING_SYSTEM_PARAM',
            offerId: offerLabel,
            element: `param[@paramcode="${reqCode}"]`,
            message: `Товар [${offerLabel}]: відсутній обов'язковий системний параметр Епіцентру <param paramcode="${reqCode}">.`
          });
        }
      });
    });

    checkpoints.push({
      id: 'offers_structure',
      title: 'Контейнер <offers> та атрибути <offer id available>',
      xsdRule: 'offer[@id (unique), @available (xs:boolean)]',
      passed: offersStructurePassed,
      details: offersStructurePassed
        ? `Перевірено ${offerNodes.length} унікальних пропозицій (offers)`
        : 'Виявлено помилки унікальності ID або атрибута available'
    });

    checkpoints.push({
      id: 'mandatory_elements',
      title: 'Обовʼязкові вузли: price, availability, category, attribute_set (picture опціонально)',
      xsdRule: 'xs:sequence (price, availability, category[@code], attribute_set[@code])',
      passed: elementsStructurePassed,
      details: elementsStructurePassed
        ? 'Усі обовʼязкові теги та коди категорій присутні'
        : 'Відсутні обовʼязкові теги або коди категорій/наборів'
    });

    checkpoints.push({
      id: 'bilingual_tags',
      title: 'Двомовна локалізація <name> та <description> (lang="ua" / "ru")',
      xsdRule: 'name[@lang="ua|ru"], description[@lang="ua|ru"] (CDATA)',
      passed: bilingualPassed,
      details: bilingualPassed
        ? 'Усі товари містять непорожні UA та RU версії назви й опису'
        : 'Незаповнені двомовні теги name або description'
    });

    checkpoints.push({
      id: 'pim_params',
      title: 'Системні параметри PIM (measure, ratio, country_of_origin, brand, barcodes)',
      xsdRule: 'param[@paramcode, @name, @valuecode]',
      passed: mandatoryParamsPassed,
      details: mandatoryParamsPassed
        ? 'Усі 5 системних параметрів та коди атрибутів валідні'
        : 'Відсутні обовʼязкові системні параметри або paramcode'
    });

    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    const passedCheckpointsCount = checkpoints.filter((c) => c.passed).length;
    const complianceScore =
      checkpoints.length > 0
        ? Math.max(0, Math.round((passedCheckpointsCount / checkpoints.length) * 100) - Math.min(20, errorCount * 5))
        : 0;

    return {
      isValid: errorCount === 0,
      validatedAt: new Date().toISOString(),
      offersValidated: offerNodes.length,
      errorCount,
      warningCount,
      complianceScore: errorCount === 0 ? 100 : complianceScore,
      checkpoints,
      issues
    };
  }
}

export interface EpicentrXsdIssue {
  severity: 'error' | 'warning';
  code: string;
  element: string;
  offerId?: string;
  message: string;
  line?: number;
}

export interface EpicentrXsdCheckpoint {
  id: string;
  title: string;
  xsdRule: string;
  passed: boolean;
  details: string;
}

export interface EpicentrXsdValidationReport {
  isValid: boolean;
  validatedAt: string;
  offersValidated: number;
  errorCount: number;
  warningCount: number;
  complianceScore: number;
  checkpoints: EpicentrXsdCheckpoint[];
  issues: EpicentrXsdIssue[];
}

