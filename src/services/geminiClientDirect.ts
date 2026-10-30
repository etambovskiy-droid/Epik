/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getStoredApiKey } from './aiApiKeyService';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

/**
 * Returns effective Gemini API key from store/localStorage or environment variables
 */
export function getEffectiveApiKey(storeId?: string): string | null {
  const stored = getStoredApiKey(storeId);
  if (stored && stored.trim() && stored !== 'server-managed') {
    return stored.trim();
  }

  // Check client-side Vite env var if defined
  try {
    const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim()) {
      return envKey.trim();
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Directly tests a Gemini API Key against Google's official Generative Language API
 * without relying on a backend server (works 100% on static Vercel hosts).
 */
export async function testGeminiApiKeyDirect(
  apiKey: string
): Promise<{ success: boolean; message: string; modelUsed?: string }> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return {
      success: false,
      message: 'Ключ API не вказано. Будь ласка, введіть валідний Google AI Studio API Key.'
    };
  }

  const model = DEFAULT_GEMINI_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': cleanKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Ping test. Reply with OK.' }]
          }
        ],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0.1
        }
      })
    });

    if (response.ok) {
      return {
        success: true,
        message: "З'єднання успішно підтверджено! Модель gemini-3.5-flash-lite працює.",
        modelUsed: model
      };
    }

    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson?.error?.message || '';
    } catch {
      // ignore
    }

    if (response.status === 400 || response.status === 403) {
      return {
        success: false,
        message: `Недійсний API Key або доступ заблоковано Google AI Studio (${response.status})${
          errorDetail ? `: ${errorDetail}` : ''
        }`
      };
    }

    if (response.status === 429) {
      return {
        success: false,
        message: `Перевищено ліміт запитів Gemini API (429 Rate limit / Quota exceeded)${
          errorDetail ? `: ${errorDetail}` : ''
        }`
      };
    }

    return {
      success: false,
      message: `Google API повернув помилку HTTP ${response.status}${errorDetail ? `: ${errorDetail}` : ''}`
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Помилка мережевого з'єднання з Google Generative Language API: ${error?.message || error}`
    };
  }
}

export interface DirectGeminiOptions {
  model?: string;
  systemInstruction?: string;
  responseMimeType?: string;
  maxOutputTokens?: number;
  temperature?: number;
  tools?: any[];
  apiKey?: string;
  storeId?: string;
}

export interface DirectGeminiResult {
  text: string;
  sources?: { uri: string; title: string }[];
  searchEntryPoint?: string | null;
  fromCache?: boolean;
  error?: string;
}

/**
 * Universal direct client call to Google Generative Language API.
 * Automatically handles API key, system instructions, tools, and JSON responses.
 */
export async function callGeminiDirect(
  prompt: string,
  options?: DirectGeminiOptions
): Promise<DirectGeminiResult> {
  const key = options?.apiKey || getEffectiveApiKey(options?.storeId);
  const model = options?.model || DEFAULT_GEMINI_MODEL;

  // If no direct key is configured, fallback to backend proxy (/api/gemini/...)
  if (!key) {
    try {
      const isSearchTool = options?.tools && options.tools.some((t: any) => t.googleSearch);
      const proxyEndpoint = isSearchTool ? '/api/gemini/search' : '/api/gemini/title';
      const proxyBody = isSearchTool
        ? { query: prompt, maxOutputTokens: options?.maxOutputTokens || 350 }
        : {
            model,
            prompt,
            systemInstruction: options?.systemInstruction,
            maxOutputTokens: options?.maxOutputTokens || 350
          };

      const localRes = await fetch(proxyEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proxyBody)
      });

      if (localRes.ok) {
        const data = await localRes.json();
        return {
          text: data.text || '',
          sources: data.sources || [],
          searchEntryPoint: data.searchEntryPoint || null
        };
      }
    } catch {
      // Fall through to missing key error
    }

    return {
      text: '',
      error: 'Не вказано Google AI Studio API Key. Будь ласка, вкажіть ваш ключ у налаштуваннях (кнопка з ключем у шапці).'
    };
  }

  // Google Search Grounding requires gemini-3.8-flash for best stability
  const hasTools = Boolean(options?.tools && options.tools.length > 0);
  const effectiveModel = hasTools && model === 'gemini-3.5-flash-lite' ? 'gemini-3.8-flash' : model;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent`;

  const payload: any = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: options?.temperature !== undefined ? options.temperature : 0.2,
      maxOutputTokens: options?.maxOutputTokens || 350
    }
  };

  // Google API throws 400 if responseMimeType is application/json together with tools (e.g. googleSearch)
  if (options?.responseMimeType && !hasTools) {
    payload.generationConfig.responseMimeType = options.responseMimeType;
  }

  if (options?.systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: options.systemInstruction }]
    };
  }

  if (hasTools) {
    payload.tools = options?.tools;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key.trim()
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errText = '';
      try {
        const errJson = await response.json();
        errText = errJson?.error?.message || '';
      } catch {
        errText = await response.text().catch(() => '');
      }

      if (response.status === 400 || response.status === 403) {
        return {
          text: '',
          error: `Недійсний Google AI Studio API Key або відхилено доступ (${response.status}): ${errText}`
        };
      }
      if (response.status === 429) {
        return {
          text: '',
          error: `Перевищено ліміт запитів Gemini API (429 Rate limit). Спробуйте знову через кілька секунд.`
        };
      }

      return {
        text: '',
        error: `Помилка Google Generative API HTTP ${response.status}: ${errText}`
      };
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text || '';

    // Extract Google Search Grounding sources if available
    let sources: { uri: string; title: string }[] | undefined;
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks;
    if (Array.isArray(groundingChunks) && groundingChunks.length > 0) {
      sources = groundingChunks
        .map((chunk: any) => {
          if (chunk.web?.uri) {
            return {
              uri: String(chunk.web.uri),
              title: String(chunk.web.title || chunk.web.uri)
            };
          }
          return null;
        })
        .filter((s): s is { uri: string; title: string } => s !== null);
    }

    const searchEntryPoint = candidate?.groundingMetadata?.searchEntryPoint?.renderedContent || null;

    return {
      text: textPart,
      sources,
      searchEntryPoint
    };
  } catch (err: any) {
    return {
      text: '',
      error: `Помилка мережевого виклику до Google Generative API: ${err?.message || err}`
    };
  }
}

/**
 * Direct Imagen-3 image generation or local dev server fallback
 */
export async function generateImageDirect(options: {
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  sourceImageBase64?: string | null;
  sourceImageMimeType?: string;
  apiKey?: string;
  storeId?: string;
}): Promise<{ imageUrl?: string; textComment?: string; error?: string }> {
  const key = options.apiKey || getEffectiveApiKey(options.storeId);
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // If on localhost without direct key, try dev server proxy
  if (!key && isLocalhost) {
    try {
      const response = await fetch('/api/gemini/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options)
      });
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // fallback
    }
  }

  if (!key) {
    return {
      error: 'Не вказано Google AI Studio API Key. Будь ласка, вкажіть ваш ключ у налаштуваннях.'
    };
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key.trim()
      },
      body: JSON.stringify({
        instances: [{ prompt: options.prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: options.aspectRatio === '1:1' ? '1:1' : options.aspectRatio === '4:3' ? '4:3' : '3:4'
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const b64 = data.predictions?.[0]?.bytesBase64Encoded;
      if (b64) {
        return { imageUrl: `data:image/png;base64,${b64}` };
      }
    }
    const errData = await response.json().catch(() => ({}));
    return { error: errData?.error?.message || `Помилка генерації зображення (${response.status})` };
  } catch (err: any) {
    return { error: err?.message || 'Помилка мережевого з’єднання з сервісом генерації зображень' };
  }
}
