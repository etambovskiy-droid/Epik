/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { generateResetToken } from '../_tokenUtils';

export default async function handler(req: any, res: any) {
  // Set CORS headers
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
    const email = String(body.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'INVALID_EMAIL', message: 'Введіть коректну адресу електронної пошти' });
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      console.error('[Vercel Serverless Error] RESEND_API_KEY is not configured.');
      res.status(500).json({
        error: 'RESEND_API_KEY_NOT_CONFIGURED',
        message: 'Змінна RESEND_API_KEY не налаштована у Vercel Dashboard (Settings -> Environment Variables). Будь ласка, додайте ваш ключ Resend.'
      });
      return;
    }

    // Generate strict 60-second HMAC token
    const { token } = generateResetToken(email, 60);

    const appUrl = (process.env.APP_URL || 'https://epik-kappa.vercel.app').replace(/\/$/, '');
    const resetUrl = `${appUrl}?resetToken=${token}`;

    const fromAddress = process.env.RESEND_FROM || 'Epicentr PIM Support <onboarding@resend.dev>';
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Відновлення пароля — Епіцентр Маркетплейс</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b1120; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #1e293b; border-radius: 20px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <tr>
            <td style="padding: 32px 32px 20px 32px; background: linear-gradient(135deg, #004BB7 0%, #002e73 100%); text-align: center;">
              <div style="display: inline-block; padding: 6px 14px; background-color: rgba(255, 255, 255, 0.15); border-radius: 9999px; margin-bottom: 12px;">
                <span style="color: #FF6B00; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Епіцентр Маркетплейс PIM</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800;">Захищене відновлення доступу</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                Вітаємо! Отримано запит на зміну пароля до вашого облікового запису в системі <strong>Епіцентр PIM Platform</strong>.
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px;">
                    <div style="font-size: 13px; font-weight: 700; color: #fbbf24; margin-bottom: 4px;">
                      ⏱️ Обмежений час дії: 60 секунд
                    </div>
                    <div style="font-size: 12px; color: #fde68a; line-height: 1.5;">
                      З міркувань суворої безпеки це одноразове персональне посилання діє рівно 1 хвилину (60 сек).
                    </div>
                  </td>
                </tr>
              </table>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #FF6B00 0%, #e05d00 100%); color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 15px rgba(255, 107, 0, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                      Встановити новий пароль &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Якщо кнопка не відкривається, скопіюйте посилання у ваш браузер:
              </p>
              <p style="margin: 0 0 24px 0; font-size: 11px; color: #38bdf8; word-break: break-all; line-height: 1.4; font-family: monospace;">
                ${resetUrl}
              </p>

              <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;">

              <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                Якщо ви не надсилали цей запит, просто проігноруйте цей лист. Ваш обліковий запис знаходиться під надійним захистом.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; background-color: #0b1120; text-align: center; border-top: 1px solid #334155;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                &copy; ${new Date().getFullYear()} Епіцентр Маркетплейс. Система управління PIM-каталогом.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

    // Out-of-band delivery via Resend REST API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: 'Відновлення пароля — Епіцентр Маркетплейс (60 сек)',
        html
      })
    });

    const resendData = await resendResponse.json().catch(() => ({}));

    if (!resendResponse.ok) {
      console.error('[Resend API Error]:', resendData);
      res.status(resendResponse.status).json({
        error: 'RESEND_DISPATCH_FAILED',
        message: resendData?.message || `Помилка сервісу Resend (HTTP ${resendResponse.status})`
      });
      return;
    }

    console.log(`[Resend SUCCESS] Email sent to ${email}, Resend ID: ${resendData?.id}`);

    // ZERO IN-APP TOKEN LEAK: never send the token back to the requesting browser!
    res.status(200).json({
      success: true,
      message: 'Лист із захищеним посиланням для зміни пароля надіслано на вашу електронну пошту через Resend.'
    });
  } catch (err: any) {
    console.error('[request-password-reset error]:', err);
    res.status(500).json({
      error: 'SERVERLESS_ERROR',
      message: err?.message || 'Внутрішня помилка сервера при обробці запиту'
    });
  }
}
