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

    const useVertex = userApiKey.startsWith('AQ.');
    const ai = new GoogleGenAI({
      apiKey: userApiKey,
      ...(useVertex ? { vertexai: true } : {}),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const parts: any[] = [];
    if (sourceImageBase64) {
      parts.push({
        inlineData: {
          data: sourceImageBase64,
          mimeType: sourceImageMimeType || 'image/png'
        }
      });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize
        }
      }
    });

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
    res.status(500).json({ error: error?.message || 'Image generation failed' });
  }
}
