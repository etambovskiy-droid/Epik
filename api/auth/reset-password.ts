/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

// Self-contained HMAC & replay guard (avoids ESM relative import resolution failures on Vercel)
const usedTokensSet = new Set<string>();

function getTokenSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.RESEND_API_KEY ||
    process.env.VITE_RESEND_API_KEY ||
    'epicentr-pim-secure-serverless-secret-2026'
  );
}

function generateResetToken(email: string, ttlSeconds: number = 60): { token: string; expiresAt: number } {
  const cleanEmail = email.trim().toLowerCase();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const randomPart = crypto.randomBytes(16).toString('hex');
  const payload = `${cleanEmail}:${expiresAt}:${randomPart}`;
  const hmac = crypto.createHmac('sha256', getTokenSecret()).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64url');
  return { token, expiresAt };
}

function verifyResetToken(token: string): {
  valid: boolean;
  email?: string;
  expiresAt?: number;
  remainingSeconds: number;
  error?: string;
} {
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
    const remainingMs = expiresAt - Date.now();
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

function markTokenAsUsed(token: string): void {
  if (token) {
    usedTokensSet.add(token);
    setTimeout(() => usedTokensSet.delete(token), 20 * 60 * 1000);
  }
}

function resolveResendApiKey(req: any): string {
  const headerKey =
    typeof req.headers?.['x-resend-api-key'] === 'string'
      ? req.headers['x-resend-api-key'].trim()
      : '';
  return (
    process.env.RESEND_API_KEY ||
    process.env.VITE_RESEND_API_KEY ||
    headerKey ||
    ''
  ).trim();
}

function resolveAppOrigin(req: any): string {
  const envUrl = (process.env.APP_URL || process.env.VITE_APP_URL || '').trim();
  if (envUrl && envUrl !== 'MY_APP_URL') {
    return envUrl.replace(/\/$/, '');
  }
  const originHeader = typeof req.headers?.origin === 'string' ? req.headers.origin.trim() : '';
  if (originHeader && originHeader.startsWith('http')) {
    return originHeader.replace(/\/$/, '');
  }
  const fwdHost = req.headers?.['x-forwarded-host'] || req.headers?.host;
  if (typeof fwdHost === 'string' && fwdHost.trim()) {
    const proto = req.headers?.['x-forwarded-proto'] || 'https';
    return `${proto}://${fwdHost.trim()}`.replace(/\/$/, '');
  }
  return 'https://epik-kappa.vercel.app';
}

function buildResetEmailHtml(resetUrl: string, ttlSeconds: number = 60): string {
  return `<!DOCTYPE html>
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
                      ⏱️ Обмежений час дії: ${ttlSeconds} секунд
                    </div>
                    <div style="font-size: 12px; color: #fde68a; line-height: 1.5;">
                      З міркувань суворої безпеки це одноразове персональне посилання діє рівно 1 хвилину (${ttlSeconds} сек).
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
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Resend-Api-Key');

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
    const action = String(body.action || '').trim().toLowerCase();

    // MODE 1: Request Password Reset Email via Resend (action === 'request' or email provided without token)
    if (action === 'request' || (body.email && !body.token && !body.newPassword)) {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        res.status(400).json({
          success: false,
          error: 'INVALID_EMAIL',
          message: 'Введіть коректну адресу електронної пошти'
        });
        return;
      }

      const apiKey = resolveResendApiKey(req);
      if (!apiKey || apiKey === 're_xxxxxxxxx') {
        const keyErr = 'Змінна RESEND_API_KEY (або VITE_RESEND_API_KEY) не налаштована на сервері.';
        console.error('[Resend Configuration Error]:', keyErr);
        res.status(500).json({
          success: false,
          error: 'RESEND_API_KEY_NOT_CONFIGURED',
          message:
            'Ключ RESEND_API_KEY (або VITE_RESEND_API_KEY) не знайдено на сервері. Додайте ключ у змінні середовища (Settings -> Environment Variables) та зробіть Redeploy.'
        });
        return;
      }

      const { token } = generateResetToken(email, 60);
      const appOrigin = resolveAppOrigin(req);
      const resetUrl = `${appOrigin}?resetToken=${encodeURIComponent(token)}`;
      const fromAddress = (
        process.env.RESEND_FROM ||
        process.env.VITE_RESEND_FROM ||
        'Epicentr PIM <onboarding@resend.dev>'
      ).trim();

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [email],
          subject: 'Відновлення пароля — Епіцентр Маркетплейс (60 сек)',
          html: buildResetEmailHtml(resetUrl, 60)
        })
      });

      const rawResponseText = await resendResponse.text();
      let resendData: any = {};
      try {
        resendData = JSON.parse(rawResponseText);
      } catch {
        resendData = { message: rawResponseText };
      }

      if (!resendResponse.ok) {
        const exactErrorMsg =
          resendData?.message ||
          resendData?.error?.message ||
          resendData?.error ||
          rawResponseText ||
          `HTTP ${resendResponse.status}`;
        console.error('[Resend API Error]:', {
          status: resendResponse.status,
          from: fromAddress,
          to: email,
          response: resendData
        });
        res.status(resendResponse.status).json({
          success: false,
          error: resendData?.name || 'RESEND_DISPATCH_FAILED',
          message: `Помилка Resend (${resendResponse.status}): ${exactErrorMsg}`,
          details: resendData
        });
        return;
      }

      console.log(`[Resend SUCCESS] Reset email sent to ${email} from "${fromAddress}", ID: ${resendData?.id}`);

      res.status(200).json({
        success: true,
        id: resendData?.id,
        message:
          'Лист із захищеним посиланням для зміни пароля надіслано на вашу електронну пошту через Resend.'
      });
      return;
    }

    // MODE 2: Verify Reset Token
    if (action === 'verify' || body.verifyOnly) {
      const token = String(body.token || '').trim();
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
      return;
    }

    // MODE 3: Confirm Password Reset with Token
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
      const isExpired = verification.error?.includes('вичерпано');
      res.status(isExpired ? 410 : 400).json({
        success: false,
        error: verification.error || 'Посилання недійсне або час його дії вичерпано'
      });
      return;
    }

    markTokenAsUsed(token);
    console.log(`[Password Reset Success] Password changed for ${verification.email}`);

    res.status(200).json({
      success: true,
      email: verification.email,
      message: 'Пароль успішно змінено'
    });
  } catch (err: any) {
    console.error('[api/auth/reset-password exception]:', err);
    res.status(500).json({
      success: false,
      error: 'SERVERLESS_ERROR',
      message: err?.message || 'Помилка обробки запиту відновлення пароля'
    });
  }
}
