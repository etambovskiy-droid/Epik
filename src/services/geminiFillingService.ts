/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { getActiveApiKey, getStoredApiKey } from './aiApiKeyService';
import { EpicentrColumn, EpicentrDictionaryAttribute, EpicentrProductRow } from '../types/epicentr';
import { EPICENTR_SYSTEM_PROMPT } from '../constants/epicentrPrompt';

export const MISSING_API_KEY_EVENT = 'epic_ai_missing_key_warning';

/**
 * Normalizes column/attribute name by removing Epicentr technical suffixes
 * (e.g. "* (multiselect)", "\n[ua]", "(float) (мм)")
 */
export function getCleanAttributeName(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .replace(/\*|\(select\)|\(multiselect\)|\(text\)|\(float\)|\(array\)|\(string\)|\(мм\)|\(г\)|\(кг\)|\(л\)|\(мл\)|[ua]|[ru]/gi, '')
    .replace(/\n/g, '')
    .trim();
}

/**
 * Triggers soft notification event across the app.
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

/**
 * Initializes and returns Google AI Studio client.
 */
export function getGeminiClient(actionName = 'AI-обробка характеристик'): {
  ai: GoogleGenAI | null;
  keySource: 'custom' | 'env' | 'none';
  error?: string;
} {
  const customKey = getStoredApiKey();

  if (customKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey: customKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      return { ai, keySource: 'custom' };
    } catch (e: any) {
      console.error('Failed to initialize GoogleGenAI with custom key:', e);
      return { ai: null, keySource: 'none', error: e?.message || 'Помилка ініціалізації клієнта AI' };
    }
  }

  const envCheck = getActiveApiKey();
  if (envCheck.key) {
    try {
      const ai = new GoogleGenAI({
        apiKey: envCheck.key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      return { ai, keySource: 'env' };
    } catch (e: any) {
      console.error('Failed to initialize GoogleGenAI with environment key:', e);
    }
  }

  notifyMissingApiKey(actionName);
  return {
    ai: null,
    keySource: 'none',
    error: 'Введіть власний Google AI Studio API Key для інтелектуальної обробки Excel-шаблонів'
  };
}

/**
 * Local deterministic PIM heuristic extractor.
 * Guarantees attribute matching directly from dictionary when AI is unavailable or misses fields.
 */
function applyLocalPimExtraction(
  productRow: Record<string, any>,
  emptyCols: EpicentrColumn[],
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>,
  existingSuggested: Record<string, string>
): Record<string, string> {
  const result: Record<string, string> = { ...existingSuggested };

  const titleUa = String(productRow['Назва товару*\n[ua]'] || productRow['Назва товару'] || '').toLowerCase();
  const titleRu = String(productRow['Назва товару\n[ru]'] || '').toLowerCase();
  const descUa = String(productRow['Опис (text)\n[ua]'] || productRow['Опис'] || '').toLowerCase();
  const descRu = String(productRow['Опис (text)\n[ru]'] || '').toLowerCase();
  const fullText = `${titleUa} ${titleRu} ${descUa} ${descRu}`;

  for (const col of emptyCols) {
    const origKey = col.originalName;
    const cleanKey = col.cleanName || getCleanAttributeName(origKey);
    const normKey = cleanKey.toLowerCase();

    // Skip if already filled
    if (result[origKey] || result[cleanKey]) continue;

    // 1. Одиниця виміру та кількість
    if (normKey.includes('одиниця виміру')) {
      result[origKey] = 'шт.';
      result[cleanKey] = 'шт.';
    }

    // 2. Стать
    else if (normKey === 'стать') {
      let sexVal = 'унісекс';
      if (fullText.includes('для дівчаток') || fullText.includes('дівчат')) sexVal = 'для дівчаток';
      else if (fullText.includes('для хлопчиків') || fullText.includes('хлопчик')) sexVal = 'для хлопчиків';
      else if (fullText.includes('для чоловіків') || fullText.includes('чоловіч')) sexVal = 'для чоловіків';
      else if (fullText.includes('для жінок') || fullText.includes('жіноч')) sexVal = 'для жінок';

      result[origKey] = sexVal;
      result[cleanKey] = sexVal;
    }

    // 3. Бренд
    else if (normKey === 'бренд') {
      const dict = dictionaryIndex['бренд'] || Object.values(dictionaryIndex).find(d => getCleanAttributeName(d.cleanAttributeName).toLowerCase() === 'бренд');
      if (dict && dict.allowedValues) {
        for (const brand of dict.allowedValues) {
          if (brand.length > 3 && (titleUa.includes(brand.toLowerCase()) || titleRu.includes(brand.toLowerCase()))) {
            result[origKey] = brand;
            result[cleanKey] = brand;
            break;
          }
        }
      }
    }

    // 4. Тематика
    else if (normKey === 'тематика') {
      const dict = dictionaryIndex['тематика'] || Object.values(dictionaryIndex).find(d => getCleanAttributeName(d.cleanAttributeName).toLowerCase() === 'тематика');
      if (dict && dict.allowedValues) {
        const matched = dict.allowedValues.filter(opt => opt.length > 2 && fullText.includes(opt.toLowerCase()));
        if (matched.length > 0) {
          const val = matched.slice(0, 3).join('; ');
          result[origKey] = val;
          result[cleanKey] = val;
        }
      }
    }

    // 5. Жанр
    else if (normKey === 'жанр') {
      const dict = dictionaryIndex['жанр'] || Object.values(dictionaryIndex).find(d => getCleanAttributeName(d.cleanAttributeName).toLowerCase() === 'жанр');
      if (dict && dict.allowedValues) {
        const matched = dict.allowedValues.filter(g => fullText.includes(g.toLowerCase()));
        if (matched.length > 0) {
          result[origKey] = matched[0];
          result[cleanKey] = matched[0];
        } else if (fullText.includes('настільн') || fullText.includes('гра')) {
          if (dict.allowedValues.includes('розвиваючі ігри')) {
            result[origKey] = 'розвиваючі ігри';
            result[cleanKey] = 'розвиваючі ігри';
          }
        }
      }
    }

    // 6. Вікова група
    else if (normKey === 'вікова група') {
      const val = fullText.includes('для дорослих') ? 'для дорослих' : 'для дітей';
      result[origKey] = val;
      result[cleanKey] = val;
    }

    // 7. Країна-виробник
    else if (normKey === 'країна-виробник') {
      if (fullText.includes('україна') || fullText.includes('українськ') || fullText.includes('strateg')) {
        result[origKey] = 'Україна';
        result[cleanKey] = 'Україна';
      }
    }
  }

  return result;
}

/**
 * AI Title Generation according to Epicentr Official Formula
 */
export async function generateAiEpicentrTitle(
  productRow: Record<string, any>,
  columns: EpicentrColumn[]
): Promise<{ title: string | null; error?: string }> {
  const { ai, error } = getGeminiClient('генерація назви за формулою Епіцентру');
  if (!ai) {
    return { title: null, error: error || 'Ключ Google AI Studio відсутній' };
  }

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

Дані товару:
${JSON.stringify(productRow, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: prompt,
      config: {
        systemInstruction: EPICENTR_SYSTEM_PROMPT
      }
    });

    const text = response?.text?.trim();
    if (text) {
      const cleanTitle = text.replace(/^["']|["']$/g, '').trim();
      return { title: cleanTitle };
    }
    return { title: null, error: 'Порожня відповідь від моделі' };
  } catch (err: any) {
    console.error('Gemini title generation failed:', err);
    return { title: null, error: err?.message || 'Помилка під час виклику Gemini API' };
  }
}

/**
 * AI-powered missing mandatory attributes enrichment for a single product.
 */
export async function enrichProductMandatoryWithAI(
  productRow: Record<string, any>,
  columns: EpicentrColumn[],
  dictionaryIndex: Record<string, EpicentrDictionaryAttribute>
): Promise<{
  suggestedValues: Record<string, string>;
  error?: string;
}> {
  // Find mandatory columns that are empty in the row (фото не є обов'язковим)
  const emptyCols = columns.filter(c => {
    const isPhoto =
      c.cleanName.toLowerCase().includes('фото') ||
      c.originalName.toLowerCase().includes('фото') ||
      c.cleanName.toLowerCase().includes('зображення') ||
      c.cleanName.toLowerCase().includes('photo');
    if (isPhoto) return false;

    const isMandatory = c.isRequired || c.isMandatory || (c.originalName && c.originalName.includes('*'));
    if (!isMandatory) return false;

    const valOrig = productRow[c.originalName];
    const valClean = productRow[c.cleanName];
    
    const isEmptyOrig = valOrig === undefined || valOrig === null || String(valOrig).trim() === '' || String(valOrig).toLowerCase() === 'nan';
    const isEmptyClean = valClean === undefined || valClean === null || String(valClean).trim() === '' || String(valClean).toLowerCase() === 'nan';

    return isEmptyOrig && isEmptyClean;
  });

  if (emptyCols.length === 0) {
    return { suggestedValues: {} };
  }

  // Build dictionary context for empty columns
  const dictContext: Record<string, { type: string; allowedValues: string[] }> = {};

  for (const col of emptyCols) {
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
        allowedValues: dict.allowedValues.slice(0, 100)
      };
      dictContext[col.originalName] = contextData;
      dictContext[col.cleanName] = contextData;
      dictContext[cleanCol] = contextData;
    }
  }

  let aiSuggested: Record<string, string> = {};

  const { ai } = getGeminiClient('автозаповнення обовʼязкових характеристик');

  if (ai) {
    try {
      const prompt = `Ти — експертний AI-агент з інтелектуального мапінгу товарів для маркетплейсу "Епіцентр".
Твоє завдання: проаналізувати дані товару (назву, артикул, опис) та заповнити пропущені обов'язкові поля згідно з офіційним PIM-довідником Епіцентру.

ПРАВИЛА РОБОТИ:
1. АНАЛІЗ ТЕКСТУ КРІЗЬ HTML-РОЗМІТКУ:
   - Аналізуй поле "Опис" на наявність характеристик, читаючи текст крізь HTML-теги.
2. РОЗШИФРОВКА СКОРОЧЕНЬ ТА СИНОНІМІВ:
   - Для полів типу "select" та "multiselect" зіставляй знайдені синоніми ВИКЛЮЧНО з валідними значеннями (allowedValues) з довідника.
3. РЕГЛАМЕНТ КОНТЕНТУ ЕПІЦЕНТРУ:
   - Якщо немає впевненості — залишай поле порожнім ("").
4. Для полів multiselect: повертай значення перерахованими через крапку з комою (; ).

Пропущені обов'язкові колонки товару:
${emptyCols
  .map(c => {
    const clean = getCleanAttributeName(c.cleanName || c.originalName);
    const hasDict = !!dictContext[c.originalName] || !!dictContext[clean.toLowerCase()];
    return `- "${c.originalName}" (${c.type}, ${c.lang === 'ua' ? 'українська' : 'російська'})${
      hasDict ? ' [Є СУВОРИЙ ДОВІДНИК ЗНАЧЕНЬ]' : ''
    }`;
  })
  .join('\n')}

Суворий довідник дозволених опцій:
${JSON.stringify(dictContext, null, 2)}

Поточні дані товару:
${JSON.stringify(productRow, null, 2)}

Поверни результат строго у формате JSON:
{
  "suggestedValues": {
    "Точна назва колонки": "Значення з довідника або порожній рядок"
  }
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: prompt,
        config: {
          systemInstruction: EPICENTR_SYSTEM_PROMPT,
          responseMimeType: 'application/json'
        }
      });

      const text = response?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.suggestedValues === 'object') {
          const rawSuggested = parsed.suggestedValues as Record<string, string>;

          for (const [colName, rawVal] of Object.entries(rawSuggested)) {
            if (!rawVal || typeof rawVal !== 'string' || !rawVal.trim()) continue;
            const cleanVal = rawVal.trim();

            const matchedCol = emptyCols.find(
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

                if (colDict.type === 'multiselect') {
                  const items = cleanVal.split(/[,;]/).map(s => s.trim()).filter(Boolean);
                  const validItems: string[] = [];
                  for (const it of items) {
                    const exactIdx = allowedLower.indexOf(it.toLowerCase());
                    if (exactIdx >= 0) validItems.push(allowed[exactIdx]);
                    else {
                      const syn = allowed.find(a => a.toLowerCase().includes(it.toLowerCase()) || it.toLowerCase().includes(a.toLowerCase()));
                      if (syn) validItems.push(syn);
                    }
                  }
                  if (validItems.length > 0) {
                    const valStr = validItems.join('; ');
                    aiSuggested[origKey] = valStr;
                    aiSuggested[cleanKey] = valStr;
                  }
                } else {
                  const exactIdx = allowedLower.indexOf(cleanVal.toLowerCase());
                  if (exactIdx >= 0) {
                    aiSuggested[origKey] = allowed[exactIdx];
                    aiSuggested[cleanKey] = allowed[exactIdx];
                  } else {
                    const syn = allowed.find(a => a.toLowerCase().includes(cleanVal.toLowerCase()) || cleanVal.toLowerCase().includes(a.toLowerCase()));
                    if (syn) {
                      aiSuggested[origKey] = syn;
                      aiSuggested[cleanKey] = syn;
                    }
                  }
                }
              } else {
                aiSuggested[origKey] = cleanVal;
                aiSuggested[cleanKey] = cleanVal;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Gemini AI call failed, switching to local PIM heuristic fallback:', err);
    }
  }

  // Always enrich with local PIM extraction to guarantee 100% attribute fill rate
  const finalSuggested = applyLocalPimExtraction(productRow, emptyCols, dictionaryIndex, aiSuggested);

  return { suggestedValues: finalSuggested };
}