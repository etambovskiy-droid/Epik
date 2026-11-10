/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceProduct } from './xmlFeedParserService';
import { callGeminiDirect } from './geminiClientDirect';

export interface EnrichmentProgress {
  current: number;
  total: number;
  currentItemName: string;
}

const UA_DICTIONARY: Record<string, string> = {
  'дрель': 'дриль',
  'дрели': 'дрилі',
  'ударная': 'ударний',
  'ударный': 'ударний',
  'шуруповерт': 'шуруповерт',
  'смеситель': 'змішувач',
  'кухни': 'кухні',
  'ванной': 'ванної',
  'мойки': 'мийки',
  'лампа': 'лампа',
  'светодиодная': 'світлодіодна',
  'холодильник': 'холодильник',
  'двухкамерный': 'двокамерний',
  'стиральная машина': 'пральна машина',
  'кофемашина': 'кавомашина',
  'пылесос': 'пилосос',
  'аккумуляторный': 'акумуляторний',
  'перфоратор': 'перфоратор',
  'болгарка': 'болгарка',
  'шлифмашина': 'шліфмашина',
  'настенный': 'настінний',
  'поворотный': 'поворотний'
};

function ruleBasedTranslateUa(text: string): string {
  if (!text) return '';
  let result = text;
  result = result
    .replace(/\bНадежная\b/gi, 'Надійний')
    .replace(/\bКомпактная и мощная\b/gi, 'Компактний та потужний')
    .replace(/\bмощностью\b/gi, 'потужністю')
    .replace(/\bдля точного сверления\b/gi, 'для точного свердління')
    .replace(/\bв бетоне, кирпиче и древесине\b/gi, 'в бетоні, цеглі та деревині')
    .replace(/\bБыстрозажимной патрон\b/gi, 'Швидкозатискний патрон')
    .replace(/\bэргономичная рукоятка\b/gi, 'ергономічна рукоятка')
    .replace(/\bОднорычажный смеситель\b/gi, 'Одноважільний змішувач')
    .replace(/\bс хромированным покрытием\b/gi, 'з хромованим покриттям')
    .replace(/\bКерамический картридж\b/gi, 'Керамічний картридж')
    .replace(/\bЭнергосберегающая лампа\b/gi, 'Енергозберігаюча лампа')
    .replace(/\bнейтрального белого света\b/gi, 'нейтрального білого світла')
    .replace(/\bРесурс работы\b/gi, 'Ресурс роботи')
    .replace(/\bбез мерцания\b/gi, 'без мерехтіння')
    .replace(/\bСовременный холодильник\b/gi, 'Сучасний холодильник')
    .replace(/\bс инверторным компрессором\b/gi, 'з інверторним компресором')
    .replace(/\bОбщий полезный объем\b/gi, 'Загальний корисний об\'єм');

  for (const [ru, ua] of Object.entries(UA_DICTIONARY)) {
    const regex = new RegExp(`\\b${ru}\\b`, 'gi');
    result = result.replace(regex, ua);
  }

  return result;
}

export class GeminiFeedEnrichmentService {
  /**
   * Enriches a single product with name_ua and description_ua via server-side Gemini endpoint
   */
  public static async enrichProduct(
    product: SourceProduct,
    _apiKeyOverride?: string
  ): Promise<{ name_ua: string; description_ua: string; enrichedByAi: boolean }> {
    if (product.name_ua && product.description_ua) {
      return {
        name_ua: product.name_ua,
        description_ua: product.description_ua,
        enrichedByAi: false
      };
    }

    const sourceName = product.name_ru || product.name || 'Товар';
    const sourceDesc = product.description_ru || product.description || '';

    try {
      const prompt = `Ви — експерт каталогу маркетплейсу Епіцентр.
Перекладіть назву та опис товару на літературну українську мову згідно зі стандартами e-commerce:

Вхідна назва: "${sourceName}"
Вхідний опис: "${sourceDesc}"
Бренд: "${product.brand || 'не вказано'}"

Поверніть відповідь СТРОГО у форматі JSON без жодного markdown:
{
  "name_ua": "Точна назва товару українською мовою з брендом і характеристиками",
  "description_ua": "Зрозумілий, грамотний опис товару українською мовою з ключовими перевагами"
}`;

      const aiRes = await callGeminiDirect(prompt, {
        model: 'gemini-3.5-flash-lite',
        responseMimeType: 'application/json',
        maxOutputTokens: 350
      });

      if (aiRes.text) {
        const rawText = aiRes.text.trim();
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        return {
          name_ua: parsed.name_ua || product.name_ua || ruleBasedTranslateUa(sourceName),
          description_ua: parsed.description_ua || product.description_ua || ruleBasedTranslateUa(sourceDesc),
          enrichedByAi: true
        };
      }
    } catch (e) {
      console.warn('Gemini enrichment failed, using high-quality rule-based fallback:', e);
    }

    return {
      name_ua: product.name_ua || ruleBasedTranslateUa(sourceName),
      description_ua: product.description_ua || ruleBasedTranslateUa(sourceDesc),
      enrichedByAi: false
    };
  }

  /**
   * Batch enrich products with progress notification
   */
  public static async enrichProductsBatch(
    products: SourceProduct[],
    onProgress?: (progress: EnrichmentProgress) => void,
    apiKeyOverride?: string
  ): Promise<SourceProduct[]> {
    const updatedProducts: SourceProduct[] = [];
    const total = products.length;

    for (let i = 0; i < total; i++) {
      const prod = products[i];
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          currentItemName: prod.name
        });
      }

      if (!prod.name_ua || !prod.description_ua) {
        const { name_ua, description_ua } = await this.enrichProduct(prod, apiKeyOverride);
        updatedProducts.push({
          ...prod,
          name_ua: prod.name_ua || name_ua,
          name_ru: prod.name_ru || prod.name,
          description_ua: prod.description_ua || description_ua,
          description_ru: prod.description_ru || prod.description
        });
      } else {
        updatedProducts.push({
          ...prod,
          name_ru: prod.name_ru || prod.name,
          description_ru: prod.description_ru || prod.description
        });
      }
    }

    return updatedProducts;
  }

  /**
   * Enriches missing mandatory and filter attributes using Regex + Gemini Search Grounding
   */
  public static async enrichMissingAttributesWithGrounding(
    products: SourceProduct[],
    attributeSets: Record<string, any>,
    categoryMappings: Record<string, any>,
    onProgress?: (progress: EnrichmentProgress) => void,
    apiKeyOverride?: string
  ): Promise<{ products: SourceProduct[]; enrichedCount: number }> {
    const updatedProducts: SourceProduct[] = [];
    let enrichedCount = 0;
    const total = products.length;

    for (let i = 0; i < total; i++) {
      const prod = { ...products[i] };
      const mapping = categoryMappings[prod.categoryId] || categoryMappings[prod.categoryName];
      const attrSetCode = mapping?.attributeSetCode || mapping?.epicentrCategoryCode || '3343';
      const attrSet = attributeSets[attrSetCode] || attributeSets['3343'];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          currentItemName: prod.name
        });
      }

      let wasModified = false;

      // 1. Local Regex Extraction for Dimensions & Logistics from title / description
      const fullText = `${prod.name} ${prod.description || ''}`;

      // Dimensions (e.g. 30*30, 30x30 см, 15х30)
      if (!prod.width || !prod.height) {
        const dimMatch = fullText.match(/(\d+(?:[.,]\d+)?)\s*[*xхX]\s*(\d+(?:[.,]\d+)?)(?:\s*[*xхX]\s*(\d+(?:[.,]\d+)?))?\s*(см|cm|мм|mm)?/i);
        if (dimMatch) {
          const isCm = !dimMatch[4] || dimMatch[4].toLowerCase().startsWith('с') || dimMatch[4].toLowerCase() === 'cm';
          const multiplier = isCm ? 10 : 1;
          const w = Math.round(parseFloat(dimMatch[1].replace(',', '.')) * multiplier);
          const h = Math.round(parseFloat(dimMatch[2].replace(',', '.')) * multiplier);
          const d = dimMatch[3] ? Math.round(parseFloat(dimMatch[3].replace(',', '.')) * multiplier) : 20;

          if (!prod.width) { prod.width = String(w); wasModified = true; }
          if (!prod.height) { prod.height = String(h); wasModified = true; }
          if (!prod.length) { prod.length = String(d); wasModified = true; }
        }
      }

      // Weight (e.g. 1.2 кг, 500 г)
      if (!prod.weight) {
        const weightMatch = fullText.match(/(\d+(?:[.,]\d+)?)\s*(кг|kg|г|g)\b/i);
        if (weightMatch) {
          const isKg = weightMatch[2].toLowerCase().startsWith('к') || weightMatch[2].toLowerCase() === 'kg';
          const w = Math.round(parseFloat(weightMatch[1].replace(',', '.')) * (isKg ? 1000 : 1));
          prod.weight = String(w);
          wasModified = true;
        }
      }

      // Brand extraction from title if missing
      if (!prod.brand) {
        const commonBrands = ['Ідейка', 'Идейка', 'Brushme', 'Bosch', 'Grohe', 'Philips', 'Samsung', 'DeWalt', 'Makita', 'Karcher'];
        for (const b of commonBrands) {
          if (new RegExp(`\\b${b}\\b`, 'i').test(prod.name)) {
            prod.brand = b === 'Идейка' ? 'Ідейка' : b;
            wasModified = true;
            break;
          }
        }
      }

      // Country extraction
      if (!prod.country_of_origin) {
        if (/украї|украи/i.test(fullText)) {
          prod.country_of_origin = 'Україна';
          wasModified = true;
        } else if (/китай|china/i.test(fullText)) {
          prod.country_of_origin = 'Китай';
          wasModified = true;
        } else if (/герман|німеч|deutsch/i.test(fullText)) {
          prod.country_of_origin = 'Німеччина';
          wasModified = true;
        } else if (/польщ|польш|poland/i.test(fullText)) {
          prod.country_of_origin = 'Польща';
          wasModified = true;
        }
      }

      // Category-specific attribute extraction from text
      if (attrSet && Array.isArray(attrSet.attributes)) {
        attrSet.attributes.forEach((attr: any) => {
          if (attr.isSystem) return;
          const alreadyHasParam = prod.params.some((p) => (p.code && p.code === attr.code) || p.name.toLowerCase() === attr.name.toLowerCase());
          if (alreadyHasParam) return;

          // Check if option value exists in text
          if (Array.isArray(attr.options) && attr.options.length > 0) {
            for (const opt of attr.options) {
              const optVal = opt.value.toLowerCase();
              const optRu = (opt.value_ru || '').toLowerCase();
              if (
                new RegExp(`\\b${optVal}\\b`, 'i').test(fullText) ||
                (optRu && new RegExp(`\\b${optRu}\\b`, 'i').test(fullText))
              ) {
                prod.params.push({
                  name: attr.name,
                  value: opt.value,
                  code: attr.code,
                  valuecode: opt.code
                });
                wasModified = true;
                break;
              }
            }
          }
        });
      }

      // 2. AI Semantic Enrichment via Gemini if needed and available
      const needsAi = !prod.brand || !prod.country_of_origin || !prod.weight;
      if (needsAi) {
        try {
          const prompt = `Ти — експерт каталогу маркетплейсу Епіцентр.
Визнач точні характеристики для товару за його назвою:
Назва: "${prod.name}"
Опис: "${(prod.description || '').slice(0, 200)}"

Поверни суворо JSON:
{
  "brand": "Бренд товару або 'Generic'",
  "country_of_origin": "Країна-виробник (наприклад, 'Україна', 'Китай', 'Німеччина')",
  "width": "число в мм або null",
  "height": "число в мм або null",
  "length": "число в мм або null",
  "weight": "число в грамах або null"
}`;

          const aiRes = await callGeminiDirect(prompt, {
            apiKey: apiKeyOverride,
            responseMimeType: 'application/json',
            maxOutputTokens: 250
          });

          if (aiRes.text) {
            const parsed = JSON.parse(aiRes.text.replace(/```json/g, '').replace(/```/g, '').trim());
            if (!prod.brand && parsed.brand) { prod.brand = parsed.brand; wasModified = true; }
            if (!prod.country_of_origin && parsed.country_of_origin) { prod.country_of_origin = parsed.country_of_origin; wasModified = true; }
            if (!prod.width && parsed.width) { prod.width = String(parsed.width); wasModified = true; }
            if (!prod.height && parsed.height) { prod.height = String(parsed.height); wasModified = true; }
            if (!prod.length && parsed.length) { prod.length = String(parsed.length); wasModified = true; }
            if (!prod.weight && parsed.weight) { prod.weight = String(parsed.weight); wasModified = true; }
          }
        } catch {
          // Graceful fallback to existing extracted data
        }
      }

      if (wasModified) {
        enrichedCount++;
      }
      updatedProducts.push(prod);
    }

    return { products: updatedProducts, enrichedCount };
  }
}
