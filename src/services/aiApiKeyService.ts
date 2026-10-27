/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';

export const AI_STORAGE_KEY = 'epic_ai_key';

export interface ApiKeyStatus {
  hasKey: boolean;
  key: string | null;
  maskedKey: string | null;
  source: 'custom' | 'env' | 'none';
}

/**
 * Reads custom Google AI Studio API Key from localStorage.
 */
export function getStoredApiKey(): string | null {
  try {
    const key = localStorage.getItem(AI_STORAGE_KEY);
    if (!key) return null;
    const trimmed = key.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (e) {
    console.warn('Unable to access localStorage for epic_ai_key:', e);
    return null;
  }
}

/**
 * Returns default environment API key if configured.
 */
export function getDefaultEnvApiKey(): string | null {
  try {
    const metaEnv = (import.meta as any).env;
    const envKey = metaEnv?.VITE_GEMINI_API_KEY || metaEnv?.GEMINI_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
      return envKey.trim();
    }
  } catch (e) {
    // Ignore environment access errors in browser
  }
  return null;
}

/**
 * Returns active API key prioritizing user's localStorage ('epic_ai_key') over default env.
 */
export function getActiveApiKey(): { key: string | null; source: 'custom' | 'env' | 'none' } {
  const custom = getStoredApiKey();
  if (custom) {
    return { key: custom, source: 'custom' };
  }
  const env = getDefaultEnvApiKey();
  if (env) {
    return { key: env, source: 'env' };
  }
  return { key: null, source: 'none' };
}

/**
 * Saves custom key to localStorage and dispatches change notification event.
 */
export function saveApiKey(key: string): void {
  const cleanKey = key.trim();
  localStorage.setItem(AI_STORAGE_KEY, cleanKey);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('epic_ai_key_changed', { detail: { key: cleanKey } }));
  }
}

/**
 * Clears custom key from localStorage.
 */
export function removeApiKey(): void {
  localStorage.removeItem(AI_STORAGE_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('epic_ai_key_changed', { detail: { key: null } }));
  }
}

/**
 * Mask API key for safe UI display (e.g., "AIzaSy...4x9Q").
 */
export function maskApiKey(key: string | null): string {
  if (!key) return '';
  if (key.length <= 10) return '••••••••';
  const start = key.slice(0, 6);
  const end = key.slice(-4);
  return `${start}••••••••••••${end}`;
}

/**
 * Basic syntax and format validation for Google AI Studio API key.
 */
export function validateApiKeyFormat(key: string): {
  isValid: boolean;
  message?: string;
  isWarningOnly?: boolean;
} {
  const trimmed = key.trim();
  if (!trimmed) {
    return { isValid: false, message: 'Ключ не може бути порожнім' };
  }
  if (trimmed.length < 20) {
    return { isValid: false, message: 'Ключ занадто короткий (має містити щонайменше 20 символів)' };
  }
  if (trimmed.includes(' ')) {
    return { isValid: false, message: 'Ключ не повинен містити пробілів' };
  }
  // Standard Google AI Studio keys typically begin with AIzaSy and are ~39 chars
  if (!trimmed.startsWith('AIza')) {
    return {
      isValid: true,
      isWarningOnly: true,
      message: 'Зазвичай ключ Google AI Studio починається з "AIza", переконайтеся у правильності копіювання'
    };
  }
  return { isValid: true };
}

/**
 * Live validation: performs a lightweight connection test against Google AI Studio (gemini-3.8-flash).
 */
export async function testApiKeyConnection(key: string): Promise<{ success: boolean; message: string }> {
  const trimmed = key.trim();
  if (!trimmed) {
    return { success: false, message: 'Ключ порожній' };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': trimmed
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Ping test. Reply with word OK.' }]
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { 
        success: false, 
        message: `Помилка API: ${data.error?.message || response.statusText}` 
      };
    }

    return {
      success: true,
      message: 'З\'єднання успішно підтверджено! Модель gemini-3.5-flash-lite працює.'
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Помилка мережі: ${error.message}`
    };
  }
}