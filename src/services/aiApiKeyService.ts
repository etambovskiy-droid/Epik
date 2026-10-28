/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const AI_STORAGE_KEY = 'epic_ai_key';

export interface ApiKeyStatus {
  hasKey: boolean;
  key: string | null;
  maskedKey: string | null;
  source: 'custom' | 'env' | 'none';
}

export function getStoredApiKey(): string | null {
  return 'server-managed';
}

export function getDefaultEnvApiKey(): string | null {
  return 'server-managed';
}

export function getActiveApiKey(): { key: string | null; source: 'custom' | 'env' | 'none' } {
  return { key: 'server-managed', source: 'env' };
}

export function saveApiKey(_key: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('epic_ai_key_changed', { detail: { key: 'server-managed' } }));
  }
}

export function removeApiKey(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('epic_ai_key_changed', { detail: { key: 'server-managed' } }));
  }
}

export function maskApiKey(_key: string | null): string {
  return 'GEMINI_SERVER_MANAGED';
}

export function validateApiKeyFormat(_key: string): {
  isValid: boolean;
  message?: string;
  isWarningOnly?: boolean;
} {
  return { isValid: true };
}

export async function testApiKeyConnection(_key: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('/api/gemini/title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-3.5-flash-lite',
        prompt: 'Ping test. Reply OK.'
      })
    });
    if (!response.ok) {
      return { success: false, message: 'Серверний маршрут Gemini повернув помилку' };
    }
    return {
      success: true,
      message: "З'єднання з серверним Gemini API успішно підтверджено!"
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Помилка мережі: ${error.message}`
    };
  }
}