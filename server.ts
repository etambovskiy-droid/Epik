import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Allow larger payloads for base64 image editing & catalog data
  app.use(express.json({ limit: '25mb' }));

  // 1. Proxy for Epicentr Merchant API
  app.use('/api/epicentr-proxy', async (req, res) => {
    try {
      const targetUrl = `https://merchant-api.epicentrm.com.ua${req.url}`;
      const headers: Record<string, string> = {
        Accept: 'application/json'
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
    config?: Record<string, any>
  ) {
    const ai = getAiClient();
    const candidates = Array.from(
      new Set([
        requestedModel && requestedModel !== 'gemini-3.5-flash-lite' ? requestedModel : 'gemini-3.1-flash-lite',
        'gemini-3.1-flash-lite',
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

  // 2. Gemini: Generate Epicentr Product Title
  app.post('/api/gemini/title', async (req, res) => {
    try {
      const { prompt, systemInstruction, model, rawTitle, sku, brand, maxOutputTokens = 350 } = req.body;
      const response = await generateTextWithFallback(model, prompt, {
        systemInstruction,
        maxOutputTokens
      });
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
      });
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
      });
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

      const ai = getAiClient();
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

      const ai = getAiClient();

      // Build concise search query "<Бренд> <Артикул> <Коротка назва>"
      const shortTitle = String(productTitle || '')
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
        [brand, vendorCode, shortTitle]
          .filter(Boolean)
          .join(' ')
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

      const prompt = `Знайди у Google Search за коротким запитом "${conciseQuery}" характеристики товару та заповни пропущені поля для каталогу Епіцентр.

Пошуковий запит: ${conciseQuery}
Пропущені колонки:
${attributesPromptSection}

ПРАВИЛА:
1. Одиниці: (мм) -> число в міліметрах (1 см = 10 мм); (г) -> число в грамах; multiselect -> через "; ".
2. Якщо надано Опції — обирай ТОЧНО зі списку дозволених значень (або "", якщо не підходить).
3. Не вигадуй дані. Поверни ЛИШЕ чистий JSON без markdown-обгорток:
{"attributes":{"Назва колонки":"Значення"},"explanations":{"Назва колонки":"Джерело"}}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
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

      const ai = getAiClient();
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

      const ai = getAiClient();
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

  // Vite middleware for development, static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
