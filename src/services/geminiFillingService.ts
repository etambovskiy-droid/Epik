/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { getActiveApiKey, getStoredApiKey } from './aiApiKeyService';
import { EpicentrColumn, EpicentrDictionaryAttribute, EpicentrProductRow } from '../types/epicentr';
import { EPICENTR_SYSTEM_PROMPT } from '../constants/epicentrPrompt';

/**
 * Event name dispatched when an AI request cannot proceed due to missing key.
 */
export const MISSING_API_KEY_EVENT = 'epic_ai_missing_key_warning';

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
 * Strictly adheres to requirement:
 * 1. Checks localStorage ('epic_ai_key').
 * 2. If present, uses it over default environment.
 * 3. If missing, returns null and triggers soft warning notification.
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

  // Fallback to default environment if custom key is not configured
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

  // No key available -> trigger soft warning
  notifyMissingApiKey(actionName);
  return {
    ai: null,
    keySource: 'none',
    error: 'Введіть власний Google AI Studio API Key для інтелектуальної обробки Excel-шаблонів'
  };
}

/**
 * AI Title Generation according to Epicentr Official Formula:
 * <Тип товару> <Особливість> <Бренд> <Модель> <Ключова характеристика> <Колір> (<Артикул>)
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
1. За заборонені маркетингові слова (Топ, Акція, Хіт, Дешево, Супер, Новинка, 100%, Якісний тощо).
2. Назва товару українською мовою. Бренд і модель латиницею (як в оригіналі).
3. Перше фото має пріоритет для кольору.
4. Довжина до 150 символів. Наприкінці обов'язково артикул у круглих дужках: (АРТИКУЛ).
5. Поверни ТІЛЬКИ фінальну сформовану назву одним рядком без лапок і коментарів.

Дані товару:
${JSON.stringify(productRow, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        systemInstruction: EPICENTR_SYSTEM_PROMPT
      }
    });

    const text = response?.text?.trim();
    if (text) {
      // Clean up possible markdown or quotes
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
  const { ai, error } = getGeminiClient('автозаповнення обовʼязкових характеристик');
  if (!ai) {
    return { suggestedValues: {}, error: error || 'Ключ Google AI Studio відсутній' };
  }

  // Find mandatory columns that are currently empty
  const mandatoryCols = columns.filter(c => c.isRequired || c.isMandatory);
  const emptyCols = mandatoryCols.filter(c => {
    const val = productRow[c.originalName];
    return val === undefined || val === null || String(val).trim() === '';
  });

  if (emptyCols.length === 0) {
    return { suggestedValues: {} };
  }

  // Build dictionary context for empty columns, distinguishing select and multiselect
  const dictContext: Record<
    string,
    {
      type: string;
      allowedValues: string[];
    }
  > = {};

  for (const col of emptyCols) {
    const dict = dictionaryIndex[col.cleanName.toLowerCase()] ||
      Object.values(dictionaryIndex).find(
        d => d.cleanAttributeName.toLowerCase() === col.cleanName.toLowerCase()
      );
    if (dict && dict.allowedValues && dict.allowedValues.length > 0) {
      dictContext[col.cleanName] = {
        type: col.type === 'multiselect' ? 'multiselect' : 'select',
        allowedValues: dict.allowedValues.slice(0, 100) // Pass full allowed options
      };
    }
  }

  const prompt = `Ти — експертний AI-агент з інтелектуального мапінгу товарів для маркетплейсу "Епіцентр".
Твоє завдання: проаналізувати дані товару (назву, артикул, опис із збереженням HTML-тегів) та заповнити пропущені обов'язкові поля згідно з офіційним PIM-довідником Епіцентру.

ПРАВИЛА РОБОТИ:
1. АНАЛІЗ ТЕКСТУ КРІЗЬ HTML-РОЗМІТКУ (Smart Parsing):
   - Аналізуй поле "Опис" на наявність прихованих характеристик (матеріал, розмір, посадка, сезон, колір, країна-виробник тощо), "читаючи" текст крізь HTML-теги.
   - СУВОРО ЗАБОРОНЕНО видаляти або змінювати існуючі HTML-теги у вихідному тексті опису.
2. РОЗШИФРОВКА СКОРОЧЕНЬ ТА СИНОНІМІВ (Smart Matching):
   - Виявляй і розшифровуй скорочення у назві/описі (наприклад: "ХС/С" -> "XS/S", "рр" -> "розмір", "кот", "котон" -> "бавовна", "демі" -> "осінь-весна", "ПОС" -> "напівобхват стегон", "екошкіра" -> "штучна шкіра", "блютуз" -> "Bluetooth").
   - Для полів типу "select" та "multiselect" зіставляй знайдені синоніми ВИКЛЮЧНО з валідними значеннями (allowedValues) з наданого PIM-довідника Епіцентру.
3. СУВОРИЙ РЕГЛАМЕНТ КОНТЕНТУ ЕПІЦЕНТРУ:
   - Якщо немає впевненості у відповідності значень або інформацію знайти неможливо — залишай поле порожнім ("").
   - КАТЕГОРИЧНО заборонено заповнювати поля приблизними або вигаданими значеннями. Краще порожнє поле, ніж невірне.
4. Для полів типу multiselect: повертай знайдені дозволені характеристики перерахованими через крапку з комою (; ).

Пропущені обов'язкові колонки товару:
${emptyCols
  .map(
    c =>
      `- "${c.cleanName}" (${c.type}, ${c.lang === 'ua' ? 'українська' : 'російська'})${
        dictContext[c.cleanName] ? ' [Є СУВОРИЙ ДОВІДНИК ЗНАЧЕНЬ]' : ''
      }`
  )
  .join('\n')}

Суворий довідник дозволених опцій для кожної колонки:
${JSON.stringify(dictContext, null, 2)}

Поточні дані товару (назва, опис, властивості):
${JSON.stringify(productRow, null, 2)}

Поверни результат строго у форматі валідного JSON:
{
  "suggestedValues": {
    "Точна назва колонки": "Дозволене значення з довідника або порожній рядок"
  }
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
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
        const validatedSuggested: Record<string, string> = {};

        // Client-side strict synonym & allowed value verification
        for (const [colName, rawVal] of Object.entries(rawSuggested)) {
          if (!rawVal || typeof rawVal !== 'string' || !rawVal.trim()) continue;
          const cleanVal = rawVal.trim();

          const matchedCol = emptyCols.find(
            c => c.cleanName.toLowerCase() === colName.toLowerCase() || c.originalName === colName
          );
          const colCleanName = matchedCol ? matchedCol.cleanName : colName;
          const colDict = dictContext[colCleanName];

          if (colDict && colDict.allowedValues.length > 0) {
            const allowed = colDict.allowedValues;
            const allowedLower = allowed.map(a => a.toLowerCase().trim());

            if (colDict.type === 'multiselect') {
              // Multiselect: validate each item
              const items = cleanVal.split(/[,;]/).map(s => s.trim()).filter(Boolean);
              const validItems: string[] = [];
              for (const it of items) {
                const exactIdx = allowedLower.indexOf(it.toLowerCase());
                if (exactIdx >= 0) {
                  validItems.push(allowed[exactIdx]);
                } else {
                  // Check partial / synonym match
                  const synonymMatch = allowed.find(a =>
                    a.toLowerCase().includes(it.toLowerCase()) || it.toLowerCase().includes(a.toLowerCase())
                  );
                  if (synonymMatch) validItems.push(synonymMatch);
                }
              }
              if (validItems.length > 0) {
                validatedSuggested[matchedCol ? matchedCol.originalName : colName] = validItems.join('; ');
              }
            } else {
              // Single select: strict check
              const exactIdx = allowedLower.indexOf(cleanVal.toLowerCase());
              if (exactIdx >= 0) {
                validatedSuggested[matchedCol ? matchedCol.originalName : colName] = allowed[exactIdx];
              } else {
                // Check closest synonym match
                const synonymMatch = allowed.find(a => {
                  const aLow = a.toLowerCase();
                  const cLow = cleanVal.toLowerCase();
                  return aLow.includes(cLow) || cLow.includes(aLow);
                });
                if (synonymMatch) {
                  validatedSuggested[matchedCol ? matchedCol.originalName : colName] = synonymMatch;
                } else {
                  // If no synonym/analog found, leave empty as strictly requested
                  console.info(`[Gemini synonym mapping] No valid analog found in dictionary for "${cleanVal}" in "${colCleanName}". Field left empty.`);
                }
              }
            }
          } else {
            // Free-form text column
            validatedSuggested[matchedCol ? matchedCol.originalName : colName] = cleanVal;
          }
        }

        return { suggestedValues: validatedSuggested };
      }
    }
    return { suggestedValues: {} };
  } catch (err: any) {
    console.error('Gemini attribute enrichment failed:', err);
    return { suggestedValues: {}, error: err?.message || 'Помилка виклику моделі Gemini' };
  }
}