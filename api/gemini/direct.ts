/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';

function extractUserApiKey(req: any): string | null {
  const headerKey = req.headers?.['x-gemini-api-key'] || req.headers?.['authorization'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    const clean = headerKey.replace(/^Bearer\s+/i, '').trim();
    if (clean && clean !== 'server-managed') return clean;
  }
  const bodyKey = req.body?.apiKey;
  if (typeof bodyKey === 'string' && bodyKey.trim() && bodyKey !== 'server-managed') {
    return bodyKey.trim();
  }
  return null;
}

function createGeminiClient(apiKey: string, forceVertex = false): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    ...(forceVertex ? { vertexai: true } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function extractRawErrorMessage(err: any): string {
  const raw = err?.message || 'Gemini direct request failed';
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      return parsed?.error?.message || parsed?.message || raw;
    } catch {
      return raw;
    }
  }
  return raw;
}

function formatGeminiErrorForUser(err: any, apiKey: string): string {
  const msg = extractRawErrorMessage(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes('aiplatform.googleapis.com') ||
    lower.includes('service_disabled') ||
    lower.includes('agent platform api has not been used')
  ) {
    const projMatch = msg.match(/project[=\s]+(\d+)/i);
    const projectId = projMatch ? projMatch[1] : '';
    const enableUrl = projectId
      ? `https://console.developers.google.com/apis/api/aiplatform.googleapis.com/overview?project=${projectId}`
      : 'https://console.developers.google.com/apis/library/aiplatform.googleapis.com';
    return (
      `Ключ формату AQ... прив'язано до проєкту Google Cloud${projectId ? ` (${projectId})` : ''}, де не активовано Agent Platform API (aiplatform.googleapis.com). ` +
      `Як вирішити (оберіть один варіант): ` +
      `1) Увімкніть API за посиланням ${enableUrl} та зачекайте 2–3 хв; або ` +
      `2) Створіть безкоштовний стандартний ключ Gemini API (починається на AIzaSy...) у Google AI Studio (aistudio.google.com/app/apikey) — він працює одразу.`
    );
  }

  if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
    return apiKey.startsWith('AQ.')
      ? 'Ключ AQ... не прийнято Gemini API. Спробуйте стандартний ключ Google AI Studio (починається на AIzaSy...) або активуйте Vertex AI / Agent Platform API у Google Cloud Console.'
      : 'Недійсний API-ключ Google AI Studio. Перевірте правильність копіювання або згенеруйте новий ключ на aistudio.google.com/app/apikey.';
  }

  return msg;
}

function isPrepaymentDepletedError(err: any): boolean {
  if (!err) return false;
  const str = (typeof err === 'string' ? err : err.message || JSON.stringify(err) || '').toLowerCase();
  const code = err?.status || err?.error?.code || err?.code;
  return (
    code === 402 ||
    str.includes('402') ||
    str.includes('prepayment credits are depleted') ||
    str.includes('resource_exhausted') ||
    (code === 429 && (str.includes('quota') || str.includes('credits')))
  );
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-gemini-api-key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const userApiKey = extractUserApiKey(req);
  if (!userApiKey) {
    res.status(401).json({
      error: 'API_KEY_REQUIRED',
      message: 'Для виконання цієї операції потрібен власний Google AI Studio API Key.'
    });
    return;
  }

  try {
    const { prompt, contents, model, systemInstruction, responseMimeType, maxOutputTokens = 350, tools } = req.body || {};
    const effectiveInput = prompt || contents;
    if (!effectiveInput) {
      res.status(400).json({ error: 'Prompt or contents are required' });
      return;
    }

    const candidates = Array.from(
      new Set([
        model || 'gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-4-hydrogen'
      ])
    );

    const buildClientList = (): GoogleGenAI[] => {
      if (userApiKey.startsWith('AQ.')) {
        return [createGeminiClient(userApiKey, false), createGeminiClient(userApiKey, true)];
      }
      return [createGeminiClient(userApiKey, false)];
    };

    const clients = buildClientList();
    let lastError: any = null;

    for (const ai of clients) {
      for (const modelName of candidates) {
        try {
          const config: Record<string, any> = {};
          if (maxOutputTokens) config.maxOutputTokens = Number(maxOutputTokens) || 350;
          if (systemInstruction) config.systemInstruction = systemInstruction;
          if (responseMimeType) config.responseMimeType = responseMimeType;
          if (tools && Array.isArray(tools) && tools.length > 0) config.tools = tools;

          if (modelName === 'gemini-3.1-flash-lite') {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
          } else if (modelName === 'gemini-4-hydrogen') {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
          }

          const response = await ai.models.generateContent({
            model: modelName,
            contents: effectiveInput,
            config
          });

          const candidate = response?.candidates?.[0];
          const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
          const sources = groundingChunks
            .map((chunk: any) => (chunk.web?.uri ? { uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri } : null))
            .filter(Boolean);
          const searchEntryPoint = candidate?.groundingMetadata?.searchEntryPoint?.renderedContent || null;

          res.status(200).json({
            text: response?.text || '',
            modelUsed: modelName,
            sources,
            searchEntryPoint
          });
          return;
        } catch (err: any) {
          lastError = err;
          const msg = String(err?.message || '').toLowerCase();
          const status = err?.status || err?.code;
          if (
            status === 400 ||
            status === 401 ||
            status === 403 ||
            status === 404 ||
            msg.includes('not found') ||
            msg.includes('404') ||
            msg.includes('403') ||
            msg.includes('permission_denied') ||
            msg.includes('service_disabled') ||
            msg.includes('not supported') ||
            msg.includes('invalid argument') ||
            msg.includes('api key not valid') ||
            msg.includes('api_key_invalid')
          ) {
            continue;
          }
          throw err;
        }
      }
    }

    throw lastError || new Error('Gemini direct request failed');
  } catch (error: any) {
    if (isPrepaymentDepletedError(error)) {
      res.status(402).json({
        error: 'PREPAYMENT_CREDITS_DEPLETED',
        message: 'Баланс кредитів AI Studio вичерпано. Перейдіть на https://ai.studio/projects для поповнення.'
      });
      return;
    }
    const rawStatus = error?.status || error?.code;
    const msgLower = String(error?.message || '').toLowerCase();
    const status =
      rawStatus === 400 || rawStatus === 401 || rawStatus === 403
        ? rawStatus
        : msgLower.includes('permission_denied') || msgLower.includes('service_disabled') || msgLower.includes('403')
        ? 403
        : msgLower.includes('api_key_invalid') || msgLower.includes('400')
        ? 400
        : 500;
    res.status(status).json({ error: formatGeminiErrorForUser(error, userApiKey) });
  }
}
