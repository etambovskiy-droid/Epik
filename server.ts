import express from 'express';
import http from 'http';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Modality, LiveServerMessage } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

dotenv.config();

function extractUserApiKey(req: express.Request): string | null {
  const headerKey = req.headers['x-gemini-api-key'] || req.headers['authorization'];
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

function getAiClient(userApiKey?: string): GoogleGenAI {
  const apiKey = (userApiKey || '').trim();
  if (!apiKey || apiKey === 'server-managed') {
    throw new Error('API_KEY_REQUIRED');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function resolvePort(): number {
  // Check CLI arguments (--port 3000 or -p 3000)
  const portArgIdx = process.argv.findIndex(arg => arg === '--port' || arg === '-p');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const val = parseInt(process.argv[portArgIdx + 1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  // In development, AI Studio dev server MUST run on port 3000
  if (process.env.NODE_ENV !== 'production') {
    return 3000;
  }
  return Number(process.env.PORT) || 3000;
}

async function startServer() {
  const app = express();
  const PORT = resolvePort();
  const httpServer = http.createServer(app);

  // Allow larger payloads for base64 image editing & catalog data
  app.use(express.json({ limit: '25mb' }));

  // 1. Proxy for Epicentr Merchant API
  app.use('/api/epicentr-proxy', async (req, res) => {
    try {
      const targetUrl = `https://merchant-api.epicentrm.com.ua${req.url}`;
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 EpicentrPimClient/1.0'
      };
      if (req.headers.authorization) {
        headers.Authorization = req.headers.authorization;
      }
      if (req.headers['content-type']) {
        headers['Content-Type'] = req.headers['content-type'] as string;
      }

      const fetchOptions: RequestInit = {
        method: req.method,
        headers
      };
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const upstream = await fetch(targetUrl, fetchOptions);
      const text = await upstream.text();
      res.status(upstream.status);
      try {
        res.json(JSON.parse(text));
      } catch {
        res.send(text);
      }
    } catch (error: any) {
      res.status(502).json({
        error: 'Epicentr proxy error',
        message: error?.message || 'Failed to reach Epicentr Merchant API'
      });
    }
  });

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

  function formatEpicentrTitleFallback(rawTitle: string, sku?: string, brand?: string): string {
    const prohibitedRegex = /(?:^|[^\p{L}\p{N}])(акція|акция|знижка|скидка|original|оригінал|оригинал|розпродаж|распродажа|уцінка|уценка|новинка|топ|хіт|хит|супер|super|дешево|дешевий)(?:[^\p{L}\p{N}]|$)/giu;
    let clean = (rawTitle || '')
      .replace(prohibitedRegex, ' ')
      .replace(prohibitedRegex, ' ')
      .replace(/^[!?,.:;\s-]+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!sku) {
      const skuMatch = clean.match(/\(([^)]+)\)$/);
      if (skuMatch) {
        sku = skuMatch[1];
        clean = clean.replace(/\(([^)]+)\)$/, '').trim();
      }
    }

    if (clean.length > 0) {
      clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }

    let finalTitle = clean;
    if (sku && !finalTitle.endsWith(`(${sku})`)) {
      finalTitle = `${finalTitle} (${sku})`;
    }

    if (finalTitle.length > 150) {
      if (sku) {
        const maxBase = 150 - (sku.length + 3);
        finalTitle = `${clean.substring(0, maxBase).trim()} (${sku})`;
      } else {
        finalTitle = clean.substring(0, 147) + '...';
      }
    }

    return finalTitle;
  }

  function parseResilientJson(rawText: string): {
    attributes: Record<string, string>;
    explanations: Record<string, string>;
    suggestedValues: Record<string, string>;
  } {
    const fallback = {
      attributes: {} as Record<string, string>,
      explanations: {} as Record<string, string>,
      suggestedValues: {} as Record<string, string>
    };
    if (!rawText || typeof rawText !== 'string') return fallback;

    // 1. Strip complete or unclosed markdown code fences (e.g. ```json ... ``` or truncated ```json ...)
    let cleaned = rawText.trim();
    const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fencedMatch && fencedMatch[1]) {
      cleaned = fencedMatch[1].trim();
    } else {
      cleaned = cleaned
        .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
        .replace(/\s*```[\s\S]*$/, '')
        .trim();
    }

    const firstBrace = cleaned.indexOf('{');
    if (firstBrace >= 0) {
      cleaned = cleaned.slice(firstBrace);
    }

    // 2. Try standard JSON.parse first
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object') {
        return {
          attributes:
            parsed.attributes && typeof parsed.attributes === 'object'
              ? parsed.attributes
              : {},
          explanations:
            parsed.explanations && typeof parsed.explanations === 'object'
              ? parsed.explanations
              : {},
          suggestedValues:
            parsed.suggestedValues && typeof parsed.suggestedValues === 'object'
              ? parsed.suggestedValues
              : {}
        };
      }
    } catch {
      // Fall through to truncated-JSON recovery
    }

    // 3. Salvage completed "key": "value" pairs from truncated JSON (when cut off by maxOutputTokens: 350)
    const explanationsIdx = cleaned.indexOf('"explanations"');
    const attrSection = explanationsIdx > 0 ? cleaned.slice(0, explanationsIdx) : cleaned;
    const explSection = explanationsIdx > 0 ? cleaned.slice(explanationsIdx) : '';

    const reservedKeys = new Set(['attributes', 'explanations', 'suggestedValues']);
    const pairRegex = /"((?:[^"\\]|\\.)+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;

    let match: RegExpExecArray | null;
    while ((match = pairRegex.exec(attrSection)) !== null) {
      const key = match[1].replace(/\\"/g, '"').trim();
      const val = match[2].replace(/\\"/g, '"').trim();
      if (key && !reservedKeys.has(key)) {
        fallback.attributes[key] = val;
        fallback.suggestedValues[key] = val;
      }
    }

    if (explSection) {
      pairRegex.lastIndex = 0;
      while ((match = pairRegex.exec(explSection)) !== null) {
        const key = match[1].replace(/\\"/g, '"').trim();
        const val = match[2].replace(/\\"/g, '"').trim();
        if (key && !reservedKeys.has(key)) {
          fallback.explanations[key] = val;
        }
      }
    }

    return fallback;
  }

  async function generateTextWithFallback(
    requestedModel: string | undefined,
    contents: any,
    config?: Record<string, any>,
    userApiKey?: string
  ) {
    const ai = getAiClient(userApiKey);
    const candidates = Array.from(
      new Set([
        requestedModel || 'gemini-3.5-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-3.8-flash'
      ])
    );

    let lastError: any = null;
    for (const modelName of candidates) {
      try {
        const mergedConfig: Record<string, any> = {
          ...(config || {})
        };
        if (mergedConfig.maxOutputTokens && !mergedConfig.thinkingConfig) {
          mergedConfig.thinkingConfig = {
            thinkingLevel: modelName === 'gemini-3.1-flash-lite' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW
          };
        }
        return await ai.models.generateContent({
          model: modelName,
          contents,
          config: mergedConfig
        });
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '').toLowerCase();
        if (
          msg.includes('not found') ||
          msg.includes('404') ||
          msg.includes('not supported') ||
          msg.includes('invalid argument')
        ) {
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  // Enforce User's Own API Key (Bring Your Own Key - BYOK) for ALL /api/gemini routes
  // Project owner's server token is NEVER spent on user AI generation!
  app.use('/api/gemini', (req, res, next) => {
    const userApiKey = extractUserApiKey(req);
    if (!userApiKey) {
      res.status(401).json({
        error: 'API_KEY_REQUIRED',
        message: 'Для виконання цієї операції потрібен власний Google AI Studio API Key. Будь ласка, вкажіть ваш ключ у налаштуваннях API.'
      });
      return;
    }
    (req as any).userApiKey = userApiKey;
    next();
  });

  // 2. Gemini: Generate Epicentr Product Title
  app.post('/api/gemini/title', async (req, res) => {
    try {
      const { prompt, systemInstruction, model, rawTitle, sku, brand, maxOutputTokens = 350 } = req.body;
      const response = await generateTextWithFallback(model, prompt, {
        systemInstruction,
        maxOutputTokens
      }, (req as any).userApiKey);
      res.json({ text: response?.text || '' });
    } catch (error: any) {
      const { prompt, rawTitle, sku, brand } = req.body;
      if (isPrepaymentDepletedError(error)) {
        console.warn('[Gemini Quota Notice] Prepayment credits depleted for /api/gemini/title. Applying Epicentr formula fallback.');
      } else {
        console.warn('Notice in /api/gemini/title:', error?.message || error);
      }

      // Extract existing candidate title to run deterministic Epicentr normalization
      let candidateTitle = rawTitle || '';
      if (!candidateTitle && typeof prompt === 'string') {
        const curMatch = prompt.match(/Поточна назва:\s*([^\n\r]+)/i);
        if (curMatch && curMatch[1]) {
          candidateTitle = curMatch[1].trim();
        } else {
          const nameMatch = prompt.match(/Назва товару[^\n:]*:\s*"?([^"\n\r]+)"?/i);
          if (nameMatch && nameMatch[1]) {
            candidateTitle = nameMatch[1].trim();
          }
        }
      }

      if (candidateTitle) {
        const normalized = formatEpicentrTitleFallback(candidateTitle, sku, brand);
        res.json({
          text: normalized,
          isFallback: true,
          warning: isPrepaymentDepletedError(error) ? 'PREPAYMENT_CREDITS_DEPLETED' : 'AI_FALLBACK_APPLIED'
        });
        return;
      }

      if (isPrepaymentDepletedError(error)) {
        res.status(402).json({
          error: 'PREPAYMENT_CREDITS_DEPLETED',
          message: 'Баланс кредитів AI Studio вичерпано. Перейдіть на https://ai.studio/projects для поповнення.'
        });
      } else {
        res.status(500).json({ error: error?.message || 'Failed to generate title' });
      }
    }
  });

  // 3. Gemini: Enrich Mandatory & Optional Product Attributes
  app.post('/api/gemini/enrich-attributes', async (req, res) => {
    try {
      const { prompt, systemInstruction, model, maxOutputTokens = 350 } = req.body;
      const response = await generateTextWithFallback(model, prompt, {
        systemInstruction,
        responseMimeType: 'application/json',
        maxOutputTokens
      }, (req as any).userApiKey);
      res.json({ text: response?.text || '{}' });
    } catch (error: any) {
      if (isPrepaymentDepletedError(error)) {
        console.warn('[Gemini Quota Notice] Prepayment credits depleted for /api/gemini/enrich-attributes. Handing over to local PIM extractor.');
        res.json({
          text: JSON.stringify({ suggestedValues: {} }),
          isFallback: true,
          warning: 'PREPAYMENT_CREDITS_DEPLETED'
        });
      } else {
        console.warn('Notice in /api/gemini/enrich-attributes:', error?.message || error);
        res.status(500).json({ error: error?.message || 'Failed to enrich attributes' });
      }
    }
  });

  // 4. Gemini: XML Feed Enrichment / Ukrainian Translation
  app.post('/api/gemini/enrich-feed', async (req, res) => {
    try {
      const { prompt, model, maxOutputTokens = 350 } = req.body;
      const response = await generateTextWithFallback(model, prompt, {
        responseMimeType: 'application/json',
        maxOutputTokens
      }, (req as any).userApiKey);
      res.json({ text: response?.text || '{}' });
    } catch (error: any) {
      if (isPrepaymentDepletedError(error)) {
        console.warn('[Gemini Quota Notice] Prepayment credits depleted for /api/gemini/enrich-feed.');
        res.json({ text: '{}', isFallback: true, warning: 'PREPAYMENT_CREDITS_DEPLETED' });
      } else {
        console.warn('Notice in /api/gemini/enrich-feed:', error?.message || error);
        res.status(500).json({ error: error?.message || 'Failed to enrich feed product' });
      }
    }
  });

  // 5. Gemini: Google Search Grounding (gemini-3.8-flash with googleSearch tool)
  app.post('/api/gemini/search', async (req, res) => {
    try {
      const { query, productContext, maxOutputTokens = 350 } = req.body;
      if (!query || typeof query !== 'string') {
        res.status(400).json({ error: 'Search query is required' });
        return;
      }

      const ai = getAiClient((req as any).userApiKey);
      const fullPrompt = `Ти — експерт каталогу та PIM-спеціаліст маркетплейсу Епіцентр.
Знайди актуальну та перевірену інформацію в Google Search за запитом користувача і сформуй структуровану відповідь українською мовою.
Якщо запит стосується конкретного товару, бренду, моделі чи артикулу — наведи точні характеристики (матеріал, країна бренду/виробництва, розміри, комплектація, технічні параметри), придатні для заповнення картки товару Епіцентру.

Запит: ${query}
${productContext ? `\nКонтекст товару з таблиці:\n${JSON.stringify(productContext, null, 2)}` : ''}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: fullPrompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          maxOutputTokens
        }
      });

      const candidate = response.candidates?.[0];
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .map((chunk: any) => {
          if (chunk.web?.uri) {
            return {
              uri: chunk.web.uri,
              title: chunk.web.title || chunk.web.uri
            };
          }
          return null;
        })
        .filter(Boolean);

      res.json({
        text: response.text || '',
        sources,
        searchEntryPoint: candidate?.groundingMetadata?.searchEntryPoint?.renderedContent || null
      });
    } catch (error: any) {
      if (isPrepaymentDepletedError(error)) {
        console.warn('[Gemini Quota Notice] Prepayment credits depleted for /api/gemini/search.');
        res.json({
          text: '⚠️ Кредити Google AI Studio вичерпано. Перейдіть на https://ai.studio/projects для поповнення балансу або скористайтеся локальними даними.',
          sources: [],
          warning: 'PREPAYMENT_CREDITS_DEPLETED'
        });
      } else {
        console.warn('Notice in /api/gemini/search:', error?.message || error);
        res.status(500).json({ error: error?.message || 'Search grounding request failed' });
      }
    }
  });

  // 5.1 Gemini: Web Grounded Attribute Research (gemini-3.8-flash with Google Search Grounding)
  app.post('/api/gemini/grounded-attribute-research', async (req, res) => {
    try {
      const {
        searchQuery,
        productTitle,
        brand,
        vendorCode,
        missingAttributes,
        systemInstruction,
        responseMimeType = 'application/json',
        maxOutputTokens = 350
      } = req.body;

      if (!productTitle && !vendorCode && !searchQuery) {
        res.status(400).json({ error: 'Product title or vendor code is required' });
        return;
      }

      if (!Array.isArray(missingAttributes) || missingAttributes.length === 0) {
        res.status(400).json({ error: 'List of missing attributes is required' });
        return;
      }

      const ai = getAiClient((req as any).userApiKey);

      // Clean title noise and build focused search query: "${brand} ${vendorCode || model} характеристики специфікація"
      const cleanedModelTitle = String(productTitle || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/(?:^|[^\p{L}\p{N}])(акція|акция|знижка|скидка|original|оригінал|оригинал|розпродаж|распродажа|уцінка|уценка|новинка|топ|хіт|хит|супер|super|дешево|дешевий)(?:[^\p{L}\p{N}]|$)/giu, ' ')
        .replace(/(?:розмір[иа]?|размер[ыа]?|р\.)\s*[:\-]?\s*[0-9a-zA-Zа-яіїєґА-ЯІЇЄҐ,\s\/;-]+/gi, ' ')
        .replace(/\b(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL)(?:\s*[,\/;-]\s*(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL))+\b/gi, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 5)
        .join(' ')
        .slice(0, 55)
        .trim();

      const conciseQuery =
        (typeof searchQuery === 'string' && searchQuery.trim()) ||
        `${brand || ''} ${vendorCode || cleanedModelTitle} характеристики специфікація`
          .replace(/\s+/g, ' ')
          .trim();

      const attributesPromptSection = missingAttributes
        .map((attr: any, idx: number) => {
          const allowedSnippet =
            Array.isArray(attr.allowedValues) && attr.allowedValues.length > 0
              ? ` | Опції: ${JSON.stringify(attr.allowedValues.slice(0, 60))}`
              : '';
          return `  ${idx + 1}. "${attr.originalName}" (${attr.type || 'text'})${allowedSnippet}`;
        })
        .join('\n');

      const groundingSystemInstruction =
        systemInstruction ||
        `Ти — експертний PIM-аналітик маркетплейсу Епіцентр. Шукай інформацію пріоритетно на офіційних сайтах виробників, офіційних дистриб'юторів та авторитетних каталогах товарів. Повертай виключно валідний JSON без markdown-обгорток.`;

      const prompt = `Знайди у Google Search за запитом "${conciseQuery}" точні характеристики товару (пріоритетно на офіційному сайті виробника та перевірених каталогах) і заповни пропущені поля для шаблону Епіцентр.

Пошуковий запит: ${conciseQuery}
Пропущені колонки:
${attributesPromptSection}

ПРАВИЛА:
1. Одиниці: (мм) -> число в міліметрах (1 см = 10 мм); (г) -> число в грамах; multiselect -> через "; ".
2. Якщо надано Опції — обирай ТОЧНО зі списку дозволених значень (або "", якщо не підходить).
3. Не вигадуй дані. Поверни ЛИШЕ чистий JSON:
{"attributes":{"Назва колонки":"Значення"},"explanations":{"Назва колонки":"Джерело"}}`;

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction: groundingSystemInstruction,
            tools: [{ googleSearch: {} }],
            responseMimeType,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            maxOutputTokens: Math.min(Number(maxOutputTokens) || 350, 350)
          }
        });
      } catch (firstErr: any) {
        const errMsg = String(firstErr?.message || '').toLowerCase();
        if (errMsg.includes('responsemimetype') || errMsg.includes('invalid argument') || errMsg.includes('mime')) {
          response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              systemInstruction: groundingSystemInstruction,
              tools: [{ googleSearch: {} }],
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              maxOutputTokens: Math.min(Number(maxOutputTokens) || 350, 350)
            }
          });
        } else {
          throw firstErr;
        }
      }

      const candidate = response.candidates?.[0];
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .map((chunk: any) => {
          if (chunk.web?.uri) {
            return {
              uri: chunk.web.uri,
              title: chunk.web.title || chunk.web.uri
            };
          }
          return null;
        })
        .filter(Boolean);

      const rawText = response.text || '';
      const parsedPayload = parseResilientJson(rawText);

      res.json({
        attributes: parsedPayload.attributes || {},
        explanations: parsedPayload.explanations || {},
        sources,
        searchEntryPoint: candidate?.groundingMetadata?.searchEntryPoint?.renderedContent || null,
        rawResponse: rawText
      });
    } catch (error: any) {
      if (isPrepaymentDepletedError(error)) {
        console.warn('[Gemini Quota Notice] Prepayment credits depleted for /api/gemini/grounded-attribute-research.');
        res.json({
          attributes: {},
          explanations: {},
          sources: [],
          warning: 'PREPAYMENT_CREDITS_DEPLETED',
          message: 'Баланс кредитів AI Studio вичерпано. Перейдіть на https://ai.studio/projects для управління рахунком.'
        });
      } else {
        console.warn('Notice in /api/gemini/grounded-attribute-research:', error?.message || error);
        res.status(500).json({ error: error?.message || 'Grounded attribute research failed' });
      }
    }
  });

  // 6. Gemini: Create & Edit Product Images (gemini-nano-banana-2.1)
  app.post('/api/gemini/image', async (req, res) => {
    try {
      const {
        prompt,
        aspectRatio = '1:1',
        imageSize = '1K',
        sourceImageBase64,
        sourceImageMimeType
      } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Image prompt is required' });
        return;
      }

      const ai = getAiClient((req as any).userApiKey);
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

      const response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio,
            imageSize
          }
        }
      });

      let generatedImageUrl: string | null = null;
      let textComment = '';

      const respParts = response.candidates?.[0]?.content?.parts || [];
      for (const part of respParts) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType || 'image/png';
          generatedImageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textComment += part.text;
        }
      }

      if (!generatedImageUrl) {
        res.status(500).json({
          error: 'Не вдалося згенерувати зображення. Спробуйте уточнити текстовий опис.',
          textComment
        });
        return;
      }

      res.json({
        imageUrl: generatedImageUrl,
        textComment: textComment.trim()
      });
    } catch (error: any) {
      if (isPrepaymentDepletedError(error)) {
        console.warn('[Gemini Quota Notice] Prepayment credits depleted for /api/gemini/image.');
        res.status(402).json({
          error: 'PREPAYMENT_CREDITS_DEPLETED',
          message: 'Баланс кредитів AI Studio вичерпано. Перейдіть на https://ai.studio/projects для управління рахунком.'
        });
      } else {
        console.warn('Notice in /api/gemini/image:', error?.message || error);
        res.status(500).json({ error: error?.message || 'Image generation failed' });
      }
    }
  });

  // 7. Gemini: Multi-turn Chatbot (gemini-4-argon, gemini-3.8-flash, gemini-3.1-flash-lite)
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const {
        messages,
        model = 'gemini-3.8-flash',
        useSearchGrounding = false,
        catalogSummary
      } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Messages array is required' });
        return;
      }

      const allowedModels = ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
      const selectedModel = allowedModels.includes(model) ? model : 'gemini-3.8-flash';

      const systemInstruction = `Ти — провідний ШІ-консультант та PIM-архітектор маркетплейсу "Епіцентр" (Україна).
Твоя спеціалізація:
1. Формування ідеальних назв товарів за офіційною 7-компонентною формулою Епіцентру: <Тип товару> <Особливість> <Бренд> <Модель> <Ключова характеристика/Розмір> <Колір> (<Артикул>).
2. Допомога селерам у заповненні обов'язкових (*) та додаткових характеристик згідно з офіційним довідником Епіцентру (select, multiselect через "; ", float, string).
3. Перевірка описів та назв на відсутність стоп-слів (Акція, Хіт, Топ, Розпродаж), суржику та мовних невідповідностей між колонками [ua] та [ru].
4. Консультації щодо XML/YML фідів (Prom, Rozetka -> Епіцентр), вимог до предметних фото (мін. 800x800 px, чистий світлий/білий фон без водяних знаків) та правил модерації.
Відповідай чітко, структуровано, доброзичливо та українською мовою.${
        catalogSummary ? `\n\nПоточний контекст відкритого шаблону користувача:\n${catalogSummary}` : ''
      }`;

      const contents = messages.map((m: { role: string; text: string }) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(m.text || '') }]
      }));

      const config: any = {
        systemInstruction
      };

      if (selectedModel === 'gemini-4-argon') {
        config.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH
        };
      }

      if (useSearchGrounding && (selectedModel === 'gemini-3.8-flash' || selectedModel === 'gemini-4-argon')) {
        config.tools = [{ googleSearch: {} }];
      }

      const ai = getAiClient((req as any).userApiKey);
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents,
        config
      });

      const candidate = response.candidates?.[0];
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .map((chunk: any) => {
          if (chunk.web?.uri) {
            return {
              uri: chunk.web.uri,
              title: chunk.web.title || chunk.web.uri
            };
          }
          return null;
        })
        .filter(Boolean);

      res.json({
        text: response.text || '',
        model: selectedModel,
        sources
      });
    } catch (error: any) {
      if (isPrepaymentDepletedError(error)) {
        console.warn('[Gemini Quota Notice] Prepayment credits depleted for /api/gemini/chat.');
        res.json({
          text: '⚠️ Наразі кредити попередньої оплати Gemini API вичерпано в проекті AI Studio (поповнити баланс можна на https://ai.studio/projects). Поки що для заповнення характеристик та перевірки назв надійно діє локальний алгоритмічний PIM-рушій та правила Епіцентру.',
          model: 'local-pim-engine',
          sources: [],
          warning: 'PREPAYMENT_CREDITS_DEPLETED'
        });
      } else {
        console.warn('Notice in /api/gemini/chat:', error?.message || error);
        res.status(500).json({ error: error?.message || 'Chat request failed' });
      }
    }
  });

  // 8. Gemini: Generic Direct Proxy Endpoint (Server-Side)
  app.post('/api/gemini/direct', async (req, res) => {
    try {
      const { prompt, contents, model, systemInstruction, responseMimeType, maxOutputTokens = 350, temperature, tools } = req.body;
      const effectiveInput = prompt || contents;
      if (!effectiveInput) {
        res.status(400).json({ error: 'Prompt or contents are required' });
        return;
      }

      const config: any = {
        maxOutputTokens: Number(maxOutputTokens) || 350,
        temperature: temperature !== undefined ? Number(temperature) : 0.2
      };
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      if (responseMimeType) {
        config.responseMimeType = responseMimeType;
      }
      if (tools && Array.isArray(tools) && tools.length > 0) {
        config.tools = tools;
      }

      const response = await generateTextWithFallback(model || 'gemini-3.8-flash', effectiveInput, config, (req as any).userApiKey);
      const candidate = response?.candidates?.[0];
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .map((chunk: any) => {
          if (chunk.web?.uri) {
            return {
              uri: chunk.web.uri,
              title: chunk.web.title || chunk.web.uri
            };
          }
          return null;
        })
        .filter(Boolean);

      const searchEntryPoint = candidate?.groundingMetadata?.searchEntryPoint?.renderedContent || null;

      res.json({
        text: response?.text || '',
        sources,
        searchEntryPoint
      });
    } catch (error: any) {
      if (isPrepaymentDepletedError(error)) {
        res.status(402).json({
          error: 'PREPAYMENT_CREDITS_DEPLETED',
          message: 'Баланс кредитів AI Studio вичерпано. Перейдіть на https://ai.studio/projects для поповнення.'
        });
      } else {
        res.status(500).json({ error: error?.message || 'Gemini direct request failed' });
      }
    }
  });

  // 8.1 Gemini: Streaming Content Generation Endpoint (Server-Sent Events)
  app.post('/api/gemini/stream', async (req, res) => {
    try {
      const { prompt, contents, model = 'gemini-3.8-flash', systemInstruction, maxOutputTokens = 1000 } = req.body;
      const input = prompt || contents;
      if (!input) {
        res.status(400).json({ error: 'Prompt or contents are required' });
        return;
      }

      const ai = getAiClient((req as any).userApiKey);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const config: any = {
        maxOutputTokens: Number(maxOutputTokens) || 1000
      };
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      const responseStream = await ai.models.generateContentStream({
        model,
        contents: input,
        config
      });

      for await (const chunk of responseStream) {
        const text = chunk.text || '';
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.warn('Error in /api/gemini/stream:', error?.message || error);
      if (!res.headersSent) {
        res.status(500).json({ error: error?.message || 'Streaming failed' });
      } else {
        res.write(`data: ${JSON.stringify({ error: error?.message || 'Stream error' })}\n\n`);
        res.end();
      }
    }
  });

  // 8.2 Gemini Live API: Real-Time Audio & Conversation WebSocket Bridge
  const wss = new WebSocketServer({ server: httpServer, path: '/api/gemini/live' });

  wss.on('connection', async (clientWs: WebSocket, req: http.IncomingMessage) => {
    let session: any = null;
    try {
      const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
      const userApiKey = url.searchParams.get('apiKey') || '';
      if (!userApiKey || userApiKey === 'server-managed') {
        clientWs.send(JSON.stringify({ error: 'API_KEY_REQUIRED' }));
        clientWs.close();
        return;
      }
      const ai = getAiClient(userApiKey);
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: 'Ти — голосовий асистент маркетплейсу Епіцентр. Допомагай селерам у заповненні шаблонів товарів, характеристик та формуванні назв за регламентом.'
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            for (const part of message.serverContent?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                }
              }
              if (part.text) {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ text: part.text }));
                }
              }
            }
            if (message.serverContent?.interrupted) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ interrupted: true }));
              }
            }
          },
          onerror: (err: any) => {
            console.warn('[Gemini Live WS Server notice]:', err?.message || err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ error: err?.message || 'Gemini Live error' }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.close();
            }
          }
        }
      });

      clientWs.on('message', (data: any) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio && session) {
            session.sendRealtimeInput({
              media: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' }
            });
          } else if (parsed.text && session) {
            session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: parsed.text }] }],
              turnComplete: true
            });
          }
        } catch (e: any) {
          console.warn('[Gemini Live client message error]:', e?.message);
        }
      });

      clientWs.on('close', () => {
        try {
          if (session?.close) session.close();
        } catch {}
      });
    } catch (err: any) {
      console.warn('[Gemini Live Connection Failed]:', err?.message || err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: err?.message || 'Could not connect to Gemini Live' }));
        clientWs.close();
      }
    }
  });
  const inMemoryFeedbackStore: any[] = [];

  // 9. Feedback API
  app.post('/api/feedback', (req, res) => {
    try {
      const payload = req.body;
      if (!payload || !payload.id || !payload.type || !payload.comment || !payload.context) {
        res.status(400).json({
          error: 'Invalid feedback payload',
          message: 'Поля id, type, comment та context є обов’язковими'
        });
        return;
      }

      // Store in memory
      inMemoryFeedbackStore.unshift({
        ...payload,
        receivedAt: new Date().toISOString()
      });

      // Keep last 200 items in memory
      if (inMemoryFeedbackStore.length > 200) {
        inMemoryFeedbackStore.pop();
      }

      console.log(`[Feedback Log] New feedback ${payload.id} received for category ${payload.context?.categoryName} (${payload.type})`);
      res.status(201).json({
        success: true,
        id: payload.id,
        message: 'Звіт успішно збережено'
      });
    } catch (err: any) {
      console.error('[Feedback Error]:', err);
      res.status(500).json({
        error: 'Feedback processing failed',
        message: err?.message || 'Помилка збереження фідбеку'
      });
    }
  });

  app.get('/api/feedback', (_req, res) => {
    res.json({
      total: inMemoryFeedbackStore.length,
      items: inMemoryFeedbackStore
    });
  });

  // 10. Super Admin & Approval Flow Configuration
  const SUPER_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'e.tambovskiy@gmail.com').trim().toLowerCase();

  const inMemoryUsers: Map<string, any> = new Map([
    [
      SUPER_ADMIN_EMAIL,
      {
        id: 'usr_super_admin',
        email: SUPER_ADMIN_EMAIL,
        name: 'Евгеній Тамбовський',
        shopName: 'Головний Адміністратор Епіцентр PIM',
        sellerCode: 'EP-ADMIN',
        role: 'admin',
        status: 'approved',
        createdAt: '2026-01-01T00:00:00Z'
      }
    ]
  ]);

  // List all users for Super Admin
  app.get('/api/admin/users', (req, res) => {
    const requesterEmail = String(req.headers['x-admin-email'] || req.query.adminEmail || '').toLowerCase().trim();
    if (requesterEmail !== SUPER_ADMIN_EMAIL) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Доступ заборонено. Панель схвалення мерчантів доступна виключно для головного адміністратора платформи.'
      });
      return;
    }

    res.json({
      superAdmin: 'Головний Адміністратор',
      users: Array.from(inMemoryUsers.values())
    });
  });

  // Admin: 1-Click Approve User
  app.post('/api/admin/approve-user', (req, res) => {
    const requesterEmail = String(req.headers['x-admin-email'] || req.body.adminEmail || '').toLowerCase().trim();
    if (requesterEmail !== SUPER_ADMIN_EMAIL) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Доступ заборонено. Тільки головний адміністратор платформи має право схвалювати мерчантів.'
      });
      return;
    }

    const { email, token } = req.body;
    let targetUser: any = null;

    if (email) {
      targetUser = inMemoryUsers.get(String(email).toLowerCase().trim());
    } else if (token) {
      for (const u of inMemoryUsers.values()) {
        if (u.approvalToken === token) {
          targetUser = u;
          break;
        }
      }
    }

    if (!targetUser) {
      res.status(404).json({ error: 'Користувача з таким email або токеном не знайдено' });
      return;
    }

    targetUser.status = 'approved';
    targetUser.approvedAt = new Date().toISOString();
    inMemoryUsers.set(targetUser.email.toLowerCase().trim(), targetUser);

    console.log(`[Admin Approval] User ${targetUser.email} (${targetUser.shopName}) APPROVED by Super Admin`);

    res.json({
      success: true,
      user: targetUser,
      message: `Користувача ${targetUser.email} успішно схвалено! Доступ до PIM надано.`
    });
  });

  // Admin: Reject User
  app.post('/api/admin/reject-user', (req, res) => {
    const requesterEmail = String(req.headers['x-admin-email'] || req.body.adminEmail || '').toLowerCase().trim();
    if (requesterEmail !== SUPER_ADMIN_EMAIL) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Доступ заборонено. Тільки головний адміністратор платформи має право відхиляти доступ.'
      });
      return;
    }

    const { email, reason } = req.body;
    const targetUser = inMemoryUsers.get(String(email || '').toLowerCase().trim());
    if (!targetUser) {
      res.status(404).json({ error: 'Користувача не знайдено' });
      return;
    }

    targetUser.status = 'rejected';
    targetUser.rejectedAt = new Date().toISOString();
    targetUser.adminNotes = reason || 'Заявку відхилено адміністратором';
    inMemoryUsers.set(targetUser.email.toLowerCase().trim(), targetUser);

    res.json({
      success: true,
      user: targetUser,
      message: `Заявку користувача ${targetUser.email} відхилено.`
    });
  });

  // Notify Admin upon registration
  app.post('/api/auth/notify-registration', (req, res) => {
    const { user, approvalToken } = req.body;
    if (!user || !user.email) {
      res.status(400).json({ error: 'User payload required' });
      return;
    }

    const emailKey = String(user.email).toLowerCase().trim();
    const existing = inMemoryUsers.get(emailKey) || {};
    inMemoryUsers.set(emailKey, {
      ...existing,
      ...user,
      approvalToken: approvalToken || user.approvalToken,
      status: user.status || 'pending_approval'
    });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const tokenVal = approvalToken || user.approvalToken;
    const approveUrl = `${appUrl}?approvalToken=${tokenVal}&action=approve`;
    const rejectUrl = `${appUrl}?approvalToken=${tokenVal}&action=reject`;

    console.log(`[EMAIL NOTIFICATION TO PLATFORM ADMIN]`);
    console.log(`Новий мерчант подав заявку: ${user.name} (${user.shopName}), email: ${user.email}`);
    console.log(`-> 1-Click Approve URL: ${approveUrl}`);
    console.log(`-> Reject URL: ${rejectUrl}`);

    res.json({
      success: true,
      message: 'Заявку передано адміністратору',
      approveUrl,
      rejectUrl
    });
  });

  // 11. Password Reset with 60-Second TTL (1 minute) & Resend Email Delivery
  const inMemoryResetTokens: Map<string, { email: string; token: string; expiresAt: number; used?: boolean }> = new Map();

  function getServerTokenSecret(): string {
    return (
      process.env.AUTH_SECRET ||
      process.env.RESEND_API_KEY ||
      process.env.VITE_RESEND_API_KEY ||
      'epicentr-pim-secure-serverless-secret-2026'
    );
  }

  function createStatelessResetToken(email: string, ttlSeconds: number = 60): { token: string; expiresAt: number } {
    const cleanEmail = email.trim().toLowerCase();
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const randomPart = crypto.randomBytes(16).toString('hex');
    const payload = `${cleanEmail}:${expiresAt}:${randomPart}`;
    const hmac = crypto.createHmac('sha256', getServerTokenSecret()).update(payload).digest('hex');
    const token = Buffer.from(`${payload}:${hmac}`).toString('base64url');
    return { token, expiresAt };
  }

  function verifyStatelessOrMemoryToken(token: string): {
    valid: boolean;
    email?: string;
    remainingSeconds: number;
    statusCode?: number;
    error?: string;
  } {
    const memRecord = inMemoryResetTokens.get(token);
    if (memRecord) {
      if (memRecord.used) {
        return { valid: false, remainingSeconds: 0, statusCode: 400, error: 'Посилання вже використано' };
      }
      const remMs = memRecord.expiresAt - Date.now();
      if (remMs <= 0) {
        inMemoryResetTokens.delete(token);
        return { valid: false, remainingSeconds: 0, statusCode: 410, error: 'Час дії посилання (60 сек) вичерпано. Згенеруйте нове.' };
      }
      return { valid: true, email: memRecord.email, remainingSeconds: Math.max(1, Math.ceil(remMs / 1000)) };
    }

    try {
      const raw = Buffer.from(token, 'base64url').toString('utf-8');
      const parts = raw.split(':');
      if (parts.length !== 4) {
        return { valid: false, remainingSeconds: 0, statusCode: 404, error: 'Посилання не знайдено або недійсне' };
      }
      const [email, expiresAtStr, randomPart, signature] = parts;
      const expiresAt = Number(expiresAtStr);
      const payload = `${email}:${expiresAtStr}:${randomPart}`;
      const expectedHmac = crypto.createHmac('sha256', getServerTokenSecret()).update(payload).digest('hex');
      if (signature !== expectedHmac) {
        return { valid: false, remainingSeconds: 0, statusCode: 400, error: 'Підпис токена недійсний' };
      }
      const remMs = expiresAt - Date.now();
      if (remMs <= 0) {
        return { valid: false, remainingSeconds: 0, statusCode: 410, error: 'Час дії посилання (60 сек) вичерпано. Згенеруйте нове.' };
      }
      return { valid: true, email, remainingSeconds: Math.max(1, Math.ceil(remMs / 1000)) };
    } catch {
      return { valid: false, remainingSeconds: 0, statusCode: 400, error: 'Помилка перевірки токена' };
    }
  }

  function resolveAppOriginFromReq(req: express.Request): string {
    const body = req.body || {};
    // 1. Client-supplied origin or full URL from the active browser tab
    const clientUrl = typeof body?.clientUrl === 'string' ? body.clientUrl.trim() : '';
    if (clientUrl && clientUrl.startsWith('http')) {
      return clientUrl.split('?')[0].replace(/\/$/, '');
    }

    const clientOrigin = typeof body?.clientOrigin === 'string' ? body.clientOrigin.trim() : '';
    if (clientOrigin && clientOrigin.startsWith('http')) {
      return clientOrigin.replace(/\/$/, '');
    }

    const envUrl = (process.env.APP_URL || process.env.VITE_APP_URL || '').trim();
    if (envUrl && envUrl !== 'MY_APP_URL') {
      return envUrl.replace(/\/$/, '');
    }
    const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    if (originHeader && originHeader.startsWith('http') && originHeader !== 'null') {
      return originHeader.replace(/\/$/, '');
    }
    const refererHeader = typeof req.headers.referer === 'string' ? req.headers.referer.trim() : '';
    if (refererHeader && refererHeader.startsWith('http')) {
      try {
        const parsed = new URL(refererHeader);
        return `${parsed.protocol}//${parsed.host}`.replace(/\/$/, '');
      } catch {}
    }
    const fwdHost = req.headers['x-forwarded-host'] || req.headers.host;
    if (typeof fwdHost === 'string' && fwdHost.trim()) {
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      return `${proto}://${fwdHost.trim()}`.replace(/\/$/, '');
    }
    return `http://localhost:${PORT}`;
  }

  async function sendPasswordResetViaResend(
    toEmail: string,
    resetUrl: string,
    token: string,
    ttlSeconds: number = 900,
    fallbackHeaderKey?: string
  ): Promise<{ success: boolean; id?: string; statusCode?: number; errorCode?: string; error?: string; details?: any }> {
    const apiKey = (
      process.env.RESEND_API_KEY ||
      process.env.VITE_RESEND_API_KEY ||
      fallbackHeaderKey ||
      ''
    ).trim();

    if (!apiKey || apiKey === 're_xxxxxxxxx') {
      const missingMsg =
        'Ключ RESEND_API_KEY (або VITE_RESEND_API_KEY) не налаштовано в серверному оточенні.';
      console.error('[Resend Configuration Error]:', missingMsg);
      return {
        success: false,
        statusCode: 500,
        errorCode: 'RESEND_API_KEY_NOT_CONFIGURED',
        error: missingMsg
      };
    }

    const fromAddress = (
      process.env.RESEND_FROM ||
      process.env.VITE_RESEND_FROM ||
      'Epicentr PIM <onboarding@resend.dev>'
    ).trim();

    const ttlMinutes = Math.max(1, Math.round(ttlSeconds / 60));
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Відновлення пароля — Епіцентр Маркетплейс</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b1120; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);">
          <tr>
            <td style="padding: 28px 24px 20px 24px; background-color: #004BB7; text-align: center;">
              <div style="display: inline-block; padding: 4px 12px; background-color: rgba(255, 255, 255, 0.15); border-radius: 9999px; margin-bottom: 10px;">
                <span style="color: #FF6B00; font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Епіцентр Маркетплейс PIM</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800;">Захищене відновлення доступу</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 24px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                Вітаємо! Отримано запит на зміну пароля до вашого облікового запису в системі <strong>Епіцентр PIM Platform</strong>.
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <div style="font-size: 13px; font-weight: 700; color: #fbbf24; margin-bottom: 4px;">
                      ⏱️ Час дії посилання: ${ttlMinutes} хвилин (${ttlSeconds} сек)
                    </div>
                    <div style="font-size: 12px; color: #fde68a; line-height: 1.5;">
                      Посилання є одноразовим та захищеним цифровим підписом HMAC.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Bulletproof Email CTA Button (Gmail / Outlook / Apple Mail compliant) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" bgcolor="#FF6B00" style="background-color: #FF6B00; border-radius: 12px;">
                          <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 800; color: #ffffff !important; text-decoration: none !important; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 12px; border: 1px solid #FF7A00;">
                            Встановити новий пароль &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Explicit Clickable Hyperlink fallback -->
              <p style="margin: 20px 0 6px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                Якщо кнопка вище не відкривається, натисніть на пряме посилання:
              </p>
              <div style="background-color: #0b1120; border: 1px solid #334155; border-radius: 8px; padding: 10px 14px; word-break: break-all; margin-bottom: 16px;">
                <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8 !important; text-decoration: underline !important; font-size: 11px; font-family: monospace; line-height: 1.5;">
                  ${resetUrl}
                </a>
              </div>

              <!-- Manual Token Box -->
              <div style="background-color: #0b1120; border: 1px dashed #475569; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px;">
                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">
                  Або скопіюйте одноразовий токен для ручного введення у кабінеті:
                </div>
                <div style="font-family: monospace; font-size: 11px; color: #fbbf24; word-break: break-all; font-weight: bold;">
                  ${token}
                </div>
              </div>

              <hr style="border: none; border-top: 1px solid #334155; margin: 20px 0;">
              <p style="margin: 0; font-size: 11px; color: #64748b; line-height: 1.5;">
                Якщо ви не надсилали цей запит, просто проігноруйте цей лист. Ваш обліковий запис знаходиться під надійним захистом.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background-color: #0b1120; text-align: center; border-top: 1px solid #334155;">
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

    const plainTextContent =
      `Вітаємо! Отримано запит на зміну пароля до вашого облікового запису в системі Епіцентр PIM Platform.\n\n` +
      `Для встановлення нового пароля перейдіть за посиланням:\n${resetUrl}\n\n` +
      `Або скопіюйте одноразовий токен для ручного введення у кабінеті:\n${token}\n\n` +
      `Час дії посилання: ${ttlMinutes} хвилин.\nЯкщо ви не надсилали цей запит, проігноруйте цей лист.`;

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [toEmail],
          subject: `Відновлення пароля — Епіцентр Маркетплейс (${ttlMinutes} хв)`,
          html,
          text: plainTextContent
        })
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { message: rawText };
      }

      if (response.ok && data?.id) {
        console.log(`[Resend SUCCESS] Email dispatched to ${toEmail} from "${fromAddress}". ID: ${data.id}`);
        return { success: true, id: data.id, statusCode: 200 };
      } else {
        const exactError =
          data?.message || data?.error?.message || data?.error || rawText || `HTTP ${response.status}`;
        console.error('[Resend API Error]:', {
          status: response.status,
          from: fromAddress,
          to: toEmail,
          response: data
        });
        return {
          success: false,
          statusCode: response.status,
          errorCode: data?.name || 'RESEND_DISPATCH_FAILED',
          error: `Помилка Resend (${response.status}): ${exactError}`,
          details: data
        };
      }
    } catch (err: any) {
      console.error('[Resend Network Error]:', err);
      return {
        success: false,
        statusCode: 502,
        errorCode: 'RESEND_NETWORK_ERROR',
        error: err?.message || 'Мережева помилка при зверненні до Resend API'
      };
    }
  }

  async function handlePasswordResetEmailRequest(req: express.Request, res: express.Response) {
    const { email } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      res.status(400).json({
        success: false,
        error: 'INVALID_EMAIL',
        message: 'Введіть коректну адресу електронної пошти'
      });
      return;
    }

    const isSuper = cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase();
    const existing = inMemoryUsers.get(cleanEmail);

    if (!isSuper && existing && existing.status !== 'approved') {
      res.status(403).json({
        success: false,
        error: 'ACCOUNT_NOT_ELIGIBLE',
        message: 'Скидання пароля можливе лише для підтверджених облікових записів або адміністратора.'
      });
      return;
    }

    const ttlSeconds = typeof req.body?.ttlSeconds === 'number' && req.body.ttlSeconds > 0 ? req.body.ttlSeconds : 900;
    const { token, expiresAt } = createStatelessResetToken(cleanEmail, ttlSeconds);
    inMemoryResetTokens.set(token, {
      email: cleanEmail,
      token,
      expiresAt,
      used: false
    });

    const clientOriginHeader = typeof req.body?.clientOrigin === 'string' ? req.body.clientOrigin.trim() : '';
    const appUrl = (clientOriginHeader && clientOriginHeader.startsWith('http') ? clientOriginHeader : resolveAppOriginFromReq(req)).replace(/\/$/, '');
    const resetUrl = `${appUrl}?resetToken=${encodeURIComponent(token)}`;
    const fallbackHeaderKey =
      typeof req.headers['x-resend-api-key'] === 'string'
        ? req.headers['x-resend-api-key'].trim()
        : undefined;

    const dispatchResult = await sendPasswordResetViaResend(cleanEmail, resetUrl, token, ttlSeconds, fallbackHeaderKey);

    if (!dispatchResult.success) {
      res.status(dispatchResult.statusCode || 500).json({
        success: false,
        error: dispatchResult.errorCode || 'RESEND_DISPATCH_FAILED',
        message: dispatchResult.error || 'Не вдалося надіслати лист через Resend',
        details: dispatchResult.details
      });
      return;
    }

    res.json({
      success: true,
      id: dispatchResult.id,
      message:
        'Лист із захищеним посиланням для зміни пароля надіслано на вашу електронну пошту через Resend. Будь ласка, перевірте поштову скриньку.'
    });
  }

  app.post('/api/auth/request-password-reset', handlePasswordResetEmailRequest);

  app.post('/api/auth/verify-reset-token', (req, res) => {
    const { token } = req.body || {};
    if (!token) {
      res.status(400).json({ valid: false, message: 'Токен відсутній' });
      return;
    }

    const verification = verifyStatelessOrMemoryToken(String(token).trim());
    if (!verification.valid) {
      res.status(verification.statusCode || 400).json({
        valid: false,
        error: verification.error,
        message: verification.error
      });
      return;
    }

    res.json({
      valid: true,
      email: verification.email,
      remainingSeconds: verification.remainingSeconds
    });
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const body = req.body || {};
    const action = String(body.action || '').trim().toLowerCase();

    // Support unified /api/auth/reset-password route for email dispatch & verification too
    if (action === 'request' || (body.email && !body.token && !body.newPassword)) {
      await handlePasswordResetEmailRequest(req, res);
      return;
    }

    if (action === 'verify' || body.verifyOnly) {
      const verification = verifyStatelessOrMemoryToken(String(body.token || '').trim());
      if (!verification.valid) {
        res.status(verification.statusCode || 400).json({
          valid: false,
          error: verification.error,
          message: verification.error
        });
        return;
      }
      res.json({
        valid: true,
        email: verification.email,
        remainingSeconds: verification.remainingSeconds
      });
      return;
    }

    const { token, newPassword } = body;
    const cleanToken = String(token || '').trim();
    if (!cleanToken || !newPassword || String(newPassword).length < 6) {
      res.status(400).json({ success: false, error: 'Пароль повинен містити не менше 6 символів' });
      return;
    }

    const verification = verifyStatelessOrMemoryToken(cleanToken);
    if (!verification.valid || !verification.email) {
      res.status(verification.statusCode || 400).json({
        success: false,
        error: verification.error || 'Посилання недійсне або вже використано'
      });
      return;
    }

    const memRecord = inMemoryResetTokens.get(cleanToken);
    if (memRecord) {
      memRecord.used = true;
      inMemoryResetTokens.delete(cleanToken);
    } else {
      // Store consumed stateless token in memory to prevent replay
      inMemoryResetTokens.set(cleanToken, {
        email: verification.email,
        token: cleanToken,
        expiresAt: Date.now() + 60 * 1000,
        used: true
      });
    }

    const emailKey = verification.email.toLowerCase().trim();
    const existing = inMemoryUsers.get(emailKey);
    if (existing) {
      existing.password = String(newPassword).trim();
      inMemoryUsers.set(emailKey, existing);
    }

    console.log(`[PASSWORD UPDATED] Password successfully updated for user: ${verification.email}`);

    res.json({
      success: true,
      email: verification.email,
      message: 'Пароль успішно змінено! Тепер ви можете увійти з новим паролем.'
    });
  });

  // Vite middleware for development, static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.on('error', (err: any) => {
    if (err?.code === 'EADDRINUSE') {
      console.warn(`[Server] Port ${PORT} already in use. Retrying or awaiting release...`);
    } else {
      console.error('[Server error]:', err);
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
