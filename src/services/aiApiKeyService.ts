/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const AI_STORAGE_KEY = 'epic_ai_key';

export interface ApiKeyStatus {
  hasKey: boolean;
  key: string | null;
  maskedKey: string | null;
  source: 'store' | 'custom' | 'env' | 'none';
}

export function getActiveStoreIdForAiKey(): string {
  if (typeof window === 'undefined') return 'shop-electronics';
  try {
    const authUserRaw = localStorage.getItem('epicentr_auth_user');
    if (authUserRaw) {
      const parsed = JSON.parse(authUserRaw);
      if (parsed && typeof parsed.activeStoreId === 'string' && parsed.activeStoreId.trim()) {
        return parsed.activeStoreId.trim();
      }
    }
    const workspaceId = localStorage.getItem('epicentr_saas_current_workspace');
    if (workspaceId && workspaceId.trim()) {
      return workspaceId.trim();
    }
  } catch {
    // Ignore errors
  }
  return 'shop-electronics';
}

export function getStoreAiStorageKey(storeId?: string): string {
  const resolved = (storeId || getActiveStoreIdForAiKey()).trim();
  return `${AI_STORAGE_KEY}_${resolved}`;
}

export function getGlobalApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(AI_STORAGE_KEY);
    return val && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
}

export function getStoreApiKey(storeId?: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(getStoreAiStorageKey(storeId));
    return val && val.trim() ? val.trim() : null;
  } catch {
    return null;
  }
}

export function getStoredApiKey(storeId?: string): string | null {
  return getStoreApiKey(storeId) || getGlobalApiKey() || 'server-managed';
}

export function getDefaultEnvApiKey(): string | null {
  return 'server-managed';
}

export function getActiveApiKey(storeId?: string): {
  key: string | null;
  source: 'store' | 'custom' | 'env' | 'none';
} {
  const storeKey = getStoreApiKey(storeId);
  if (storeKey) {
    return { key: storeKey, source: 'store' };
  }
  const globalKey = getGlobalApiKey();
  if (globalKey) {
    return { key: globalKey, source: 'custom' };
  }
  return { key: 'server-managed', source: 'env' };
}

export function saveApiKey(
  key: string,
  scope: 'global' | 'store' = 'global',
  storeId?: string
): void {
  if (typeof window === 'undefined') return;
  const trimmed = (key || '').trim();
  try {
    const targetKey = scope === 'store' ? getStoreAiStorageKey(storeId) : AI_STORAGE_KEY;
    if (trimmed && trimmed !== 'server-managed') {
      localStorage.setItem(targetKey, trimmed);
    } else {
      localStorage.removeItem(targetKey);
    }
  } catch {
    // Ignore storage errors
  }
  window.dispatchEvent(
    new CustomEvent('epic_ai_key_changed', {
      detail: { key: getStoredApiKey(storeId), scope, storeId: storeId || getActiveStoreIdForAiKey() }
    })
  );
}

export function removeApiKey(
  scope: 'global' | 'store' | 'all' = 'global',
  storeId?: string
): void {
  if (typeof window === 'undefined') return;
  try {
    if (scope === 'store' || scope === 'all') {
      localStorage.removeItem(getStoreAiStorageKey(storeId));
    }
    if (scope === 'global' || scope === 'all') {
      localStorage.removeItem(AI_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
  window.dispatchEvent(
    new CustomEvent('epic_ai_key_changed', {
      detail: { key: getStoredApiKey(storeId), scope, storeId: storeId || getActiveStoreIdForAiKey() }
    })
  );
}

export function maskApiKey(key: string | null): string {
  if (!key || key === 'server-managed') return 'GEMINI_SERVER_MANAGED';
  if (key.length <= 10) return '••••••••';
  return `${key.slice(0, 6)}••••${key.slice(-4)}`;
}

export function validateApiKeyFormat(_key: string): {
  isValid: boolean;
  message?: string;
  isWarningOnly?: boolean;
} {
  return { isValid: true };
}

export async function testApiKeyConnection(key: string): Promise<{ success: boolean; message: string }> {
  const trimmed = (key || '').trim();
  if (!trimmed) {
    return {
      success: false,
      message: 'Ключ API не вказано. Будь ласка, введіть валідний Google AI Studio API Key.'
    };
  }

  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': trimmed
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
        message: "З'єднання успішно підтверджено! Модель gemini-3.5-flash-lite працює."
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