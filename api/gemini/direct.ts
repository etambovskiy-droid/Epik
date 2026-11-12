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

function createGeminiClient(apiKey: string, forceVertex?: boolean): GoogleGenAI {
  const useVertex = forceVertex !== undefined ? forceVertex : apiKey.startsWith('AQ.');
  return new GoogleGenAI({
    apiKey,
    ...(useVertex ? { vertexai: true } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
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
        return [createGeminiClient(userApiKey, true), createGeminiClient(userApiKey, false)];
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
          if (
            msg.includes('not found') ||
            msg.includes('404') ||
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
    const status = error?.status === 400 || error?.status === 401 || error?.status === 403 ? error.status : 500;
    res.status(status).json({ error: error?.message || 'Gemini direct request failed' });
  }
}
