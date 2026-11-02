/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getStoredApiKey } from './aiApiKeyService';

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

  return 'server-managed';
}

/**
 * Tests Gemini API Key via server-side proxy
 */
export async function testGeminiApiKeyDirect(
  apiKey: string
): Promise<{ success: boolean; message: string; modelUsed?: string }> {
  try {
    const response = await fetch('/api/gemini/direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Ping test. Reply with OK.', maxOutputTokens: 10 })
    });

    if (response.ok) {
      return {
        success: true,
        message: "З'єднання успішно підтверджено через серверний AI-ключ!",
        modelUsed: DEFAULT_GEMINI_MODEL
      };
    }

    const errJson = await response.json().catch(() => ({}));
    return {
      success: false,
      message: errJson?.error || 'Не вдалося підтвердити ключ на сервері. Перевірте конфігурацію GEMINI_API_KEY.'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Помилка мережевого з'єднання з сервером: ${error?.message || error}`
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
 * Routes client Gemini requests securely to the backend server API endpoints.
 */
export async function callGeminiDirect(
  prompt: string,
  options?: DirectGeminiOptions
): Promise<DirectGeminiResult> {
  const model = options?.model || DEFAULT_GEMINI_MODEL;
  const isSearchTool = options?.tools && options.tools.some((t: any) => t.googleSearch);
  const proxyEndpoint = isSearchTool ? '/api/gemini/search' : '/api/gemini/direct';

  const proxyBody = isSearchTool
    ? { query: prompt, maxOutputTokens: options?.maxOutputTokens || 350 }
    : {
        model,
        prompt,
        systemInstruction: options?.systemInstruction,
        responseMimeType: options?.responseMimeType,
        maxOutputTokens: options?.maxOutputTokens || 350,
        temperature: options?.temperature,
        tools: options?.tools
      };

  try {
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

    const errJson = await localRes.json().catch(() => ({}));
    return {
      text: '',
      error: errJson?.error || `Server error (${localRes.status})`
    };
  } catch (err: any) {
    return {
      text: '',
      error: `Помилка мережевого запиту до сервера: ${err?.message || err}`
    };
  }
}

/**
 * Routes image generation requests to the backend server API endpoint.
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
  try {
    const response = await fetch('/api/gemini/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options)
    });

    if (response.ok) {
      return await response.json();
    }

    const errJson = await response.json().catch(() => ({}));
    return {
      error: errJson?.error || `Помилка генерації зображення (${response.status})`
    };
  } catch (err: any) {
    return {
      error: err?.message || 'Помилка мережевого з’єднання з сервером'
    };
  }
}
