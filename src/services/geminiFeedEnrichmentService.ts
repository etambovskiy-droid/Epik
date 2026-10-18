/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { getStoredApiKey, getDefaultEnvApiKey } from './aiApiKeyService';
import { SourceProduct } from './xmlFeedParserService';

export interface EnrichmentProgress {
  current: number;
  total: number;
  currentItemName: string;
}

// Rule-based dictionary for Ukrainian translation fallback
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
  // Common sentence beginnings / words
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
   * Enriches a single product with name_ua and description_ua
   */
  public static async enrichProduct(
    product: SourceProduct,
    apiKeyOverride?: string
  ): Promise<{ name_ua: string; description_ua: string; enrichedByAi: boolean }> {
    // If already has both UA name and description, preserve them
    if (product.name_ua && product.description_ua) {
      return {
        name_ua: product.name_ua,
        description_ua: product.description_ua,
        enrichedByAi: false
      };
    }

    const sourceName = product.name_ru || product.name || 'Товар';
    const sourceDesc = product.description_ru || product.description || '';

    const effectiveKey = apiKeyOverride || getStoredApiKey() || getDefaultEnvApiKey();

    if (effectiveKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: effectiveKey });
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

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });

        const rawText = response.text?.trim() || '{}';
        const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        return {
          name_ua: parsed.name_ua || product.name_ua || ruleBasedTranslateUa(sourceName),
          description_ua: parsed.description_ua || product.description_ua || ruleBasedTranslateUa(sourceDesc),
          enrichedByAi: true
        };
      } catch (e) {
        console.warn('Gemini enrichment failed, using high-quality rule-based fallback:', e);
      }
    }

    // High quality rule-based fallback
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

      // Check if enrichment needed
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
}
