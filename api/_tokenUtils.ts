/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

export function getTokenSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.RESEND_API_KEY ||
    process.env.VITE_RESEND_API_KEY ||
    'epicentr-pim-secure-serverless-secret-2026'
  );
}

// Global in-memory set to prevent replay attacks across single function life
const usedTokensSet = new Set<string>();

export interface DecodedResetToken {
  valid: boolean;
  email?: string;
  expiresAt?: number;
  remainingSeconds: number;
  error?: string;
}

/**
 * Generates an HMAC-SHA256 signed, time-limited token (default 60s TTL)
 * Can be verified statelessly on any Vercel serverless instance.
 */
export function generateResetToken(
  email: string,
  ttlSeconds: number = 60
): { token: string; expiresAt: number } {
  const cleanEmail = email.trim().toLowerCase();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const randomPart = crypto.randomBytes(16).toString('hex');
  const payload = `${cleanEmail}:${expiresAt}:${randomPart}`;
  const hmac = crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64url');
  return { token, expiresAt };
}

/**
 * Validates token signature, expiration (<= 60s) and single-use status
 */
export function verifyResetToken(token: string): DecodedResetToken {
  if (!token || typeof token !== 'string') {
    return { valid: false, remainingSeconds: 0, error: 'Токен відсутній' };
  }

  if (usedTokensSet.has(token)) {
    return { valid: false, remainingSeconds: 0, error: 'Це посилання вже було використано для зміни пароля' };
  }

  try {
    const raw = Buffer.from(token, 'base64url').toString('utf-8');
    const parts = raw.split(':');
    if (parts.length !== 4) {
      return { valid: false, remainingSeconds: 0, error: 'Недійсний формат токена' };
    }

    const [email, expiresAtStr, randomPart, signature] = parts;
    const expiresAt = Number(expiresAtStr);
    const payload = `${email}:${expiresAtStr}:${randomPart}`;
    const expectedHmac = crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('hex');

    if (signature !== expectedHmac) {
      return { valid: false, remainingSeconds: 0, error: 'Підпис токена недійсний або пошкоджений' };
    }

    const now = Date.now();
    const remainingMs = expiresAt - now;
    if (remainingMs <= 0) {
      return {
        valid: false,
        remainingSeconds: 0,
        error: 'Час дії захищеного посилання (60 сек) вичерпано. Згенеруйте нове посилання.'
      };
    }

    return {
      valid: true,
      email,
      expiresAt,
      remainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000))
    };
  } catch {
    return { valid: false, remainingSeconds: 0, error: 'Помилка валідації токена' };
  }
}

/**
 * Marks token as consumed so it cannot be replayed
 */
export function markTokenAsUsed(token: string): void {
  if (token) {
    usedTokensSet.add(token);
    setTimeout(() => usedTokensSet.delete(token), 20 * 60 * 1000);
  }
}
