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
  const storeKey = getStoreApiKey(storeId);
  if (storeKey && storeKey !== 'server-managed') return storeKey;

  const globalKey = getGlobalApiKey();
  if (globalKey && globalKey !== 'server-managed') return globalKey;

  if (typeof window !== 'undefined') {
    try {
      const fallback = localStorage.getItem('gemini_api_key');
      if (fallback && fallback.trim() && fallback.trim() !== 'server-managed') {
        return fallback.trim();
      }
    } catch {
      // ignore
    }
  }

  // Strictly NO fallback to server-managed: users must supply their own key
  return null;
}

export function hasUserApiKey(storeId?: string): boolean {
  return Boolean(getStoredApiKey(storeId));
}

export function getDefaultEnvApiKey(): string | null {
  return null;
}

export function getActiveApiKey(storeId?: string): {
  key: string | null;
  source: 'store' | 'custom' | 'none';
} {
  const storeKey = getStoreApiKey(storeId);
  if (storeKey && storeKey !== 'server-managed') {
    return { key: storeKey, source: 'store' };
  }
  const globalKey = getGlobalApiKey();
  if (globalKey && globalKey !== 'server-managed') {
    return { key: globalKey, source: 'custom' };
  }
  return { key: null, source: 'none' };
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
  if (!key || key === 'server-managed') return 'Ключ не встановлено';
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

export async function testApiKeyConnection(keyToTest?: string): Promise<{ success: boolean; message: string }> {
  const effectiveKey = (keyToTest || getStoredApiKey() || '').trim();
  if (!effectiveKey) {
    return {
      success: false,
      message: 'Вкажіть API-ключ перед перевіркою з’єднання.'
    };
  }

  try {
    const response = await fetch('/api/gemini/direct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gemini-api-key': effectiveKey
      },
      body: JSON.stringify({
        prompt: 'Ping test. Reply with OK.',
        model: 'gemini-3.1-flash-lite',
        maxOutputTokens: 10,
        apiKey: effectiveKey
      })
    });

    const rawText = await response.text().catch(() => '');
    let parsedJson: any = null;
    if (rawText) {
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        // Response is plain text or HTML
      }
    }

    if (response.ok) {
      const modelUsed = parsedJson?.modelUsed || 'gemini-3.1-flash-lite';
      return {
        success: true,
        message: `З'єднання з сервером Gemini API підтверджено! Модель ${modelUsed} працює коректно.`
      };
    }

    let errorDetail =
      parsedJson?.message ||
      parsedJson?.error ||
      (rawText && !rawText.trim().startsWith('<') ? rawText.slice(0, 250) : '');

    if (typeof errorDetail === 'string' && errorDetail.trim().startsWith('{')) {
      try {
        const inner = JSON.parse(errorDetail);
        errorDetail = inner?.error?.message || inner?.message || errorDetail;
      } catch {
        // keep original text
      }
    }

    if (response.status === 402) {
      return {
        success: false,
        message: 'Кредити Gemini API вичерпано. Локальний PIM-рушій та правила Епіцентру активні.'
      };
    }

    if (response.status === 404) {
      return {
        success: false,
        message: 'Серверний роут /api/gemini/direct не знайдено (404). Оновіть деплой на Vercel або перезапустіть сервер.'
      };
    }

    return {
      success: false,
      message: `Сервер повернув помилку HTTP ${response.status}${errorDetail ? `: ${errorDetail}` : ''}`
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Помилка мережевого з'єднання з сервером: ${error?.message || error}`
    };
  }
}