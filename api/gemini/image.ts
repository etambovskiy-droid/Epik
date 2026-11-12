/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';

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

function extractReadableImageError(err: any, apiKey: string): string {
  let raw = err?.message || 'Image generation failed';
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      raw = parsed?.error?.message || parsed?.message || raw;
    } catch {
      // keep raw
    }
  }
  const lower = String(raw).toLowerCase();
  if (lower.includes('aiplatform.googleapis.com') || lower.includes('service_disabled') || lower.includes('agent platform api')) {
    return 'Ключ AQ... потребує активації Agent Platform API (aiplatform.googleapis.com) у Google Cloud або використання стандартного ключа AIzaSy... з Google AI Studio.';
  }
  if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
    return apiKey.startsWith('AQ.')
      ? 'Ключ AQ... не прийнято для генерації зображень. Використайте стандартний ключ Google AI Studio (AIzaSy...).'
      : 'Недійсний API-ключ Google AI Studio.';
  }
  return raw;
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
      message: 'Для використання ШІ-Фотостудії потрібен власний Google AI Studio API Key.'
    });
    return;
  }

  try {
    const { prompt, aspectRatio = '1:1', imageSize = '1K', sourceImageBase64, sourceImageMimeType } = req.body || {};
    if (!prompt) {
      res.status(400).json({ error: 'Prompt is required' });
      return;
    }

    const parts: any[] = [];
    if (sourceImageBase64 && typeof sourceImageBase64 === 'string') {
      const cleanBase64 = sourceImageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: sourceImageMimeType || 'image/png'
        }
      });
    }
    parts.push({ text: prompt });

    const clients = userApiKey.startsWith('AQ.')
      ? [createGeminiClient(userApiKey, false), createGeminiClient(userApiKey, true)]
      : [createGeminiClient(userApiKey, false)];

    let response: any = null;
    let lastError: any = null;
    for (const ai of clients) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: { parts },
          config: {
            imageConfig: {
              aspectRatio,
              imageSize
            }
          }
        });
        if (response) break;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '').toLowerCase();
        const status = err?.status || err?.code;
        if (
          status === 400 ||
          status === 401 ||
          status === 403 ||
          status === 404 ||
          msg.includes('permission_denied') ||
          msg.includes('service_disabled') ||
          msg.includes('api_key_invalid') ||
          msg.includes('api key not valid')
        ) {
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw lastError || new Error('Image generation failed');
    }

    let imageUrl: string | undefined;
    let textComment = '';

    const candidate = response?.candidates?.[0];
    const respParts = candidate?.content?.parts || [];
    for (const part of respParts) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType || 'image/png';
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
      } else if (part.text) {
        textComment += part.text;
      }
    }

    if (!imageUrl) {
      res.status(422).json({ error: 'Модель не повернула зображення', textComment });
      return;
    }

    res.status(200).json({ imageUrl, textComment });
  } catch (error: any) {
    const status = error?.status === 400 || error?.status === 401 || error?.status === 403 ? error.status : 500;
    res.status(status).json({ error: extractReadableImageError(error, userApiKey) });
  }
}
