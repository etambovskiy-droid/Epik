/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getStoredApiKey, testApiKeyConnection } from './aiApiKeyService';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export function getEffectiveApiKey(storeId?: string): string | null {
  const stored = getStoredApiKey(storeId);
  if (stored && stored.trim() && stored !== 'server-managed') {
    return stored.trim();
  }

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
 * Tests Gemini API Key directly with Google Generative Language REST API.
 */
export async function testGeminiApiKeyDirect(
  apiKey: string
): Promise<{ success: boolean; message: string; modelUsed?: string }> {
  const res = await testApiKeyConnection(apiKey);
  return {
    success: res.success,
    message: res.message,
    modelUsed: DEFAULT_GEMINI_MODEL
  };
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
 * Direct client-side Google Generative Language REST API call.
 * Eliminates relative server routes (/api/gemini/...) and 404 errors on static hosts/Vercel.
 */
export async function callGeminiDirect(
  prompt: string,
  options?: DirectGeminiOptions
): Promise<DirectGeminiResult> {
  const apiKey = (options?.apiKey || getEffectiveApiKey(options?.storeId) || '').trim();
  if (!apiKey) {
    return {
      text: '',
      sources: [],
      error: 'Ключ Google AI Studio API не знайдено в localStorage (epic_ai_key). Будь ласка, вкажіть ваш API-ключ у налаштуваннях.'
    };
  }

  const model = options?.model || DEFAULT_GEMINI_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents: any[] = [
    {
      role: 'user',
      parts: [{ text: prompt }]
    }
  ];

  const requestBody: any = {
    contents
  };

  if (options?.systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: options.systemInstruction }]
    };
  }

  // Google Search Grounding tool configuration
  if (options?.tools && options.tools.length > 0) {
    requestBody.tools = options.tools;
  }

  const generationConfig: any = {};
  if (options?.maxOutputTokens) {
    generationConfig.maxOutputTokens = options.maxOutputTokens;
  }
  if (options?.temperature !== undefined) {
    generationConfig.temperature = options.temperature;
  }

  // Only pass responseMimeType when no googleSearch tool is attached
  const hasSearchTool = options?.tools && options.tools.some((t: any) => t.googleSearch);
  if (options?.responseMimeType && !hasSearchTool) {
    generationConfig.responseMimeType = options.responseMimeType;
  }

  if (Object.keys(generationConfig).length > 0) {
    requestBody.generationConfig = generationConfig;
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errDetail = '';
      try {
        const errJson = await response.json();
        errDetail = errJson?.error?.message || JSON.stringify(errJson?.error || errJson);
      } catch {
        errDetail = await response.text();
      }

      if (response.status === 400 && errDetail.includes('API key')) {
        return {
          text: '',
          sources: [],
          error: `Недійсний Google API Key (${response.status}): ${errDetail}`
        };
      }
      if (response.status === 429) {
        return {
          text: '',
          sources: [],
          error: `Перевищено ліміт запитів Gemini API (429 Rate limit): ${errDetail}`
        };
      }

      return {
        text: '',
        sources: [],
        error: `Помилка Google API (${response.status}): ${errDetail}`
      };
    }

    const data = await response.json();
    const candidate = data?.candidates?.[0];

    // Extract raw text
    const text = candidate?.content?.parts?.map((p: any) => p?.text || '').join('') || '';

    // Direct extraction of grounding sources from candidates[0].groundingMetadata
    const grounding = candidate?.groundingMetadata;
    const sources: { uri: string; title: string }[] = [];

    if (grounding?.groundingChunks && Array.isArray(grounding.groundingChunks)) {
      for (const chunk of grounding.groundingChunks) {
        if (chunk?.web?.uri) {
          sources.push({
            uri: chunk.web.uri,
            title: chunk.web.title || chunk.web.uri
          });
        }
      }
    }

    let searchEntryPoint: string | null = null;
    if (grounding?.searchEntryPoint?.renderedContent) {
      searchEntryPoint = grounding.searchEntryPoint.renderedContent;
    }

    return {
      text,
      sources,
      searchEntryPoint
    };
  } catch (err: any) {
    return {
      text: '',
      sources: [],
      error: `Помилка прямого виклику Google Generative Language REST API: ${err?.message || err}`
    };
  }
}

/**
 * Direct client-side Google Imagen REST API call.
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
  const apiKey = (options?.apiKey || getEffectiveApiKey(options?.storeId) || '').trim();
  if (!apiKey) {
    return {
      error: 'Ключ Google AI Studio API не знайдено (epic_ai_key). Вкажіть API-ключ для генерації зображень.'
    };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        instances: [{ prompt: options.prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: options.aspectRatio || '1:1'
        }
      })
    });

    if (response.ok) {
      const data = await response.json();
      const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
      if (b64) {
        return {
          imageUrl: `data:image/jpeg;base64,${b64}`,
          textComment: 'Зображення успішно згенеровано'
        };
      }
    }

    const errJson = await response.json().catch(() => ({}));
    return {
      error: errJson?.error?.message || `Помилка Google Imagen API (${response.status})`
    };
  } catch (err: any) {
    return {
      error: `Помилка запиту генерації зображення: ${err?.message || err}`
    };
  }
}
