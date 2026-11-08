/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getStoredApiKey, testApiKeyConnection } from './aiApiKeyService';

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export function getEffectiveApiKey(_storeId?: string): string | null {
  // All Gemini API calls are managed server-side via process.env.GEMINI_API_KEY
  return 'server-managed';
}

/**
 * Tests Gemini API connection via server endpoint.
 */
export async function testGeminiApiKeyDirect(
  apiKey?: string
): Promise<{ success: boolean; message: string; modelUsed?: string }> {
  const res = await testApiKeyConnection(apiKey || 'server-managed');
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
 * Server-side proxied Gemini API call.
 * Eliminates direct browser API key exposure and ensures uninterrupted access.
 */
export async function callGeminiDirect(
  prompt: string,
  options?: DirectGeminiOptions
): Promise<DirectGeminiResult> {
  const model = options?.model || DEFAULT_GEMINI_MODEL;

  const requestBody: any = {
    prompt,
    model,
    maxOutputTokens: options?.maxOutputTokens || 350
  };

  if (options?.systemInstruction) {
    requestBody.systemInstruction = options.systemInstruction;
  }

  if (options?.tools && options.tools.length > 0) {
    requestBody.tools = options.tools;
  }

  if (options?.temperature !== undefined) {
    requestBody.temperature = options.temperature;
  }

  if (options?.responseMimeType) {
    requestBody.responseMimeType = options.responseMimeType;
  }

  try {
    const response = await fetch('/api/gemini/direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errDetail = '';
      try {
        const errJson = await response.json();
        errDetail = errJson?.message || errJson?.error || JSON.stringify(errJson);
      } catch {
        errDetail = await response.text();
      }

      if (response.status === 402) {
        return {
          text: '',
          sources: [],
          error: 'Кредити Gemini API вичерпано. Локальний PIM-рушій автоматично підхопив обробку.'
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
        error: `Помилка Gemini API (${response.status}): ${errDetail}`
      };
    }

    const data = await response.json();
    return {
      text: data.text || '',
      sources: data.sources || [],
      searchEntryPoint: data.searchEntryPoint || null
    };
  } catch (err: any) {
    return {
      text: '',
      sources: [],
      error: `Помилка звернення до сервера Gemini API: ${err?.message || err}`
    };
  }
}

/**
 * Server-side proxied Gemini Image Generation (gemini-nano-banana-2.1).
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
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: options.prompt,
        aspectRatio: options.aspectRatio || '1:1',
        imageSize: options.imageSize || '1K',
        sourceImageBase64: options.sourceImageBase64,
        sourceImageMimeType: options.sourceImageMimeType
      })
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data?.imageUrl) {
      return {
        imageUrl: data.imageUrl,
        textComment: data.textComment || 'Зображення успішно згенеровано'
      };
    }

    return {
      error: data?.error || data?.message || `Помилка генерації зображення (${response.status})`
    };
  } catch (err: any) {
    return {
      error: `Помилка запиту генерації зображення: ${err?.message || err}`
    };
  }
}

/**
 * Server-Sent Events (SSE) streaming helper for real-time text generation.
 */
export async function streamGeminiDirect(
  prompt: string,
  options?: DirectGeminiOptions,
  onChunk?: (chunkText: string) => void
): Promise<string> {
  const response = await fetch('/api/gemini/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      model: options?.model || DEFAULT_GEMINI_MODEL,
      systemInstruction: options?.systemInstruction,
      maxOutputTokens: options?.maxOutputTokens || 1000
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Streaming failed (${response.status}): ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response stream not readable');
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.text) {
            fullText += parsed.text;
            onChunk?.(parsed.text);
          }
        } catch {}
      }
    }
  }

  return fullText;
}

/**
 * Establishes a WebSocket connection to Gemini Live API bridge on the server.
 */
export function connectGeminiLive(): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/api/gemini/live`;
  return new WebSocket(url);
}
