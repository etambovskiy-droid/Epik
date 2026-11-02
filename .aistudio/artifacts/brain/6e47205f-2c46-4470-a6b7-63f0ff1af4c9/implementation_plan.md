# Виправлення помилки 404 (Not Found) та перехід на прямі REST-запити до Google Generative Language API

Усі сервіси ШІ (`src/services/geminiFillingService.ts`, `src/services/geminiClientDirect.ts` та `src/services/aiApiKeyService.ts`) переведені на 100% прямі клієнтські запити до Google Generative Language REST API без викликів серверних функцій чи відносних бекенд-маршрутів (`/api/gemini/...`).

---

## 1. Прямі запити до Google API без відносних бекенд-маршрутів
- **Усунення 404 помилок на Vercel та статичних хостингах**:
  - Усі виклики `fetch('/api/gemini/search')`, `fetch('/api/gemini/direct')` та `fetch('/api/gemini/image')` вилучені з клієнтського коду.
  - Усі запити до Gemini тепер виконуються безпосередньо з браузера за адресою:
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`
  - Для генерації зображень запит направляється безпосередньо на:
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`
- **Передача API-ключа користувача**:
  - Ключ витягується з `localStorage` (`epic_ai_key` або `epic_ai_key_[storeId]`, з фолбеком на `gemini_api_key` та `VITE_GEMINI_API_KEY`).
  - Ключ передається як у параметрі URL (`?key=${encodeURIComponent(apiKey)}`), так і в HTTP-заголовку `'x-goog-api-key': apiKey` для максимальної надійності.

---

## 2. Конфігурація Google Search Grounding на клієнті
- У функціях `callGeminiSearchRestDirect` (`src/services/geminiFillingService.ts`) та `callGeminiDirect` (`src/services/geminiClientDirect.ts`):
  - Додано інструмент веб-пошуку безпосередньо в тіло POST-запиту:
    ```json
    {
      "tools": [{ "googleSearch": {} }],
      "generationConfig": {
        "maxOutputTokens": 350,
        "temperature": 0.2
      }
    }
    ```
  - Метадані та джерела розшуку витягуються безпосередньо з відповіді:
    - Джерела веб-пошуку: `candidates[0].groundingMetadata.groundingChunks` (із вилученням `chunk.web.uri` та `chunk.web.title`).
    - Пошуковий віджет: `candidates[0].groundingMetadata.searchEntryPoint.renderedContent`.
    - Згенерований текст: `candidates[0].content.parts.map(p => p.text).join('')`.

---

## 3. Повний відхід від серверних функцій Vercel
- Додаток більше не залежить від серверного проксі для роботи Gemini:
  - Сервіси `geminiFillingService.ts`, `geminiClientDirect.ts`, `geminiFeedEnrichmentService.ts`, модальні вікна пошуку специфікацій та генерації фотографій повністю автономні в браузері.
  - Помилки 404 при деплої на Vercel або будь-якому CDN/статичному хостингу повністю усунуто.
