/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { verifyResetToken } from '../_tokenUtils';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const token = String(body.token || '').trim();

    if (!token) {
      res.status(400).json({ valid: false, error: 'Токен відсутній' });
      return;
    }

    const verification = verifyResetToken(token);

    if (!verification.valid) {
      const isExpired = verification.error?.includes('вичерпано');
      res.status(isExpired ? 410 : 400).json({
        valid: false,
        error: verification.error || 'Посилання недійсне або час його дії вичерпано'
      });
      return;
    }

    res.status(200).json({
      valid: true,
      email: verification.email,
      remainingSeconds: verification.remainingSeconds
    });
  } catch (err: any) {
    res.status(500).json({
      valid: false,
      error: err?.message || 'Помилка валідації токена'
    });
  }
}
