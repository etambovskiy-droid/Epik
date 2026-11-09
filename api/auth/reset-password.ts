/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { verifyResetToken, markTokenAsUsed } from '../_tokenUtils';

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
    const newPassword = String(body.newPassword || '').trim();

    if (!token) {
      res.status(400).json({ success: false, error: 'Токен відсутній' });
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: 'Пароль повинен містити не менше 6 символів' });
      return;
    }

    const verification = verifyResetToken(token);

    if (!verification.valid || !verification.email) {
      res.status(400).json({
        success: false,
        error: verification.error || 'Посилання недійсне або час його дії вичерпано'
      });
      return;
    }

    // Mark token as used to prevent replay attacks
    markTokenAsUsed(token);

    console.log(`[Password Reset Success] Password changed for ${verification.email}`);

    res.status(200).json({
      success: true,
      email: verification.email,
      message: 'Пароль успішно змінено'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err?.message || 'Помилка оновлення пароля'
    });
  }
}
