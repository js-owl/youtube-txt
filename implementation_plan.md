# Implementation Plan

[Reference]
**Эталонное видео для ручной проверки:** `https://www.youtube.com/watch?v=c9DIoSNoQNs` — ID `c9DIoSNoQNs`. Именно на нём прогоняются все `curl`-сценарии и UI-проверка из раздела [Testing].

**Переменные окружения (должны быть заданы в `.env.local` для локального дев-сервера и в Vercel → Settings → Environment Variables для прода):**

- `SUPADATA_API_KEY` — ключ Supadata.
- `GEMINI_API_KEY` — ключ Google Gemini.

**Важно по безопасности:** реальные значения ключей **никогда не коммитятся в репозиторий** и **не записываются в файлы плана/исходников** — только локально в `.env.local` (он уже в `.gitignore`). Если ключи где-либо засветились (чаты, скриншоты, логи) — перевыпустите их в личных кабинетах Supadata и Google AI Studio перед продакшен-деплоем.

[Overview]
Добавить в существующий Next.js-проект (App Router, React 19, TS) серверный Route Handler `POST /api/summarize`, который по YouTube-ссылке получает транскрипт через Supadata, передаёт его в Google Gemini и возвращает структурированный JSON с саммари, точно совместимый с текущей формой `Summary` на фронтенде.

Бэкенд реализуется «внутри» Next.js как serverless Route Handler, без отдельного сервера — это позволяет остаться в рамках одного бесплатного проекта Vercel и переиспользовать уже сконфигурированный TypeScript/Tailwind/ShadCN-стек. Все секреты (Supadata, Gemini) хранятся в переменных окружения и не попадают в клиентский бандл. На фронтенде мок-данные в `lib/mock-summary.ts` заменяются реальным вызовом `/api/summarize`; тип `Summary` расширяется полем `source` для прозрачности (mock vs api) и поле `mainIdea` остаётся единственным «главная мысль» (маппится с `mainThought` бэкенда).

[Types]
Единый тип `Summary` (фронт) расширяется и переезжает в `lib/summary.ts`; `lib/mock-summary.ts` остаётся как fallback для дев-режима, но переэкспортирует тип. Дополнительно — узкий тип `SummarizeApiResponse` для безопасного парсинга ответа сервера.

**`lib/summary.ts` (новый файл)**

```ts
export type Summary = {
  title: string;
  channel: string;
  duration: string;
  mainIdea: string;
  keyPoints: string[];
};

export type SummarizeApiSuccess = {
  success: true;
  data: {
    title: string;
    channel: string;
    duration: string;
    mainThought: string;
    keyPoints: string[];
  };
};

export type SummarizeApiError = {
  success: false;
  error: string;
};

export type SummarizeApiResponse = SummarizeApiSuccess | SummarizeApiError;
```

**Бэкенд не типизирует внешние ответы как свои доменные модели.** Ответы Supadata и oEmbed читаются как `unknown` и проходят через узкие локальные type-guard'ы (`isSupadataTranscript`, `isOEmbedResponse`) — защита от поломки при изменениях схемы внешних API.

**`SummarizeRequest` (внутри route.ts):** `{ url: string }` — валидируется вручную (одно поле, простая проверка).

[Files]

**Новые файлы:**

- `app/api/summarize/route.ts` — POST handler, вся серверная логика (валидация URL, oEmbed, Supadata, Gemini, обработка ошибок, маппинг в `Summary`).
- `lib/summary.ts` — общие типы `Summary`, `SummarizeApiResponse` (success/error варианты), type-guards для ответов Supadata и oEmbed.
- `lib/summarize-client.ts` — тонкий клиент-обёртка над `fetch('/api/summarize')` для фронтенда: парсит ответ, нормализует в `Summary`, выбрасывает типизированную ошибку с человекочитаемым сообщением (берётся из бэкенда).
- `.env.example` — шаблон с `SUPADATA_API_KEY=`, `GEMINI_API_KEY=` (реальный `.env.local` остаётся в `.gitignore`).
- `app/api/summarize/README.md` — короткая инструкция по переменным окружения и поведению endpoint'а.

**Изменяемые файлы:**

- `lib/mock-summary.ts` — теперь только массив моков и функция `getMockSummary()`, тип `Summary` импортируется из `lib/summary.ts` и реэкспортируется (для обратной совместимости с импортом в `result-card.tsx` и `summarizer.tsx`).
- `components/summarizer.tsx` — в `handleSubmit` убрать `setTimeout` и мок; вместо этого вызвать `summarizeUrl(url)` из `lib/summarize-client.ts`; на время запроса отображать `LoadingState`; ошибки API показывать через `aria-live` блок под полем ввода (использовать уже существующий `showError`-паттерн). Не откатываться на мок в продакшене, но в `NODE_ENV !== 'production'` оставить fallback на `getMockSummary()`, чтобы дев мог работать без ключей.
- `next.config.mjs` — без изменений (server-runtime настраивается на уровне route).
- `package.json` — добавить зависимость `@google/genai` (требуется по PRD; в текущем `package.json` её нет).

**Удаляемые файлы:** нет.

[Functions]

**Новые функции:**

1. `app/api/summarize/route.ts`
   - `export async function POST(req: Request): Promise<NextResponse>` — основной обработчик.
     - Шаги: парсинг JSON → валидация `url` → извлечение `videoId` (через `extractVideoId` из `lib/youtube.ts`) → параллельные `Promise.all` к YouTube oEmbed и Supadata → проверка длины транскрипта → вызов `ai.models.generateContent` (Gemini 3 Flash) с `responseMimeType: 'application/json'` → парсинг JSON из `response.text` → маппинг в `Summary` → ответ `{ success: true, data }`. Ошибки — оборачиваются в `try/catch`, возвращают `{ success: false, error }` с подходящим `status` (400 для невалидного URL, 404 для «нет субтитров», 429 для rate-limit, 500 для остального).
   - Внутренние хелперы (без экспорта, область файла):
     - `extractVideoId(url: string): string | null` — переэкспорт из `lib/youtube.ts` (или вызов напрямую, чтобы не дублировать).
     - `fetchOEmbed(videoId: string): Promise<{ title: string; channel: string }>` — GET на `https://www.youtube.com/oembed?url=...&format=json`, таймаут через `AbortController` (5 сек), при ошибке возвращает дефолты `{ title: 'YouTube-видео', channel: '' }`.
     - `fetchTranscript(videoId: string): Promise<string>` — GET на `https://api.supadata.ai/v1/youtube/transcript?videoId=...` с заголовком `x-api-key`. Обрабатывает HTTP-ошибки и специфичный код `no_transcript`/`subtitle_disabled` (контракт Supadata нужно сверить с их докой, при необходимости — уточнить). Возвращает склеенный `text` из `content` (Supadata возвращает массив `{ text, offset, duration }`). Если итоговая строка короче ~50 символов — бросает ошибку с понятным сообщением.
     - `buildSummaryPrompt(transcript: string): string` — формирует системный промпт для Gemini с инструкцией вернуть JSON `{ mainThought, keyPoints: string[] }`. Температура 0.2, строго 3–5 пунктов.
     - `safeParseGeminiJson(text: string): { mainThought: string; keyPoints: string[] }` — парсит JSON, валидирует наличие и типы полей; при невалидном ответе бросает `Error('Не удалось разобрать ответ модели')`.

2. `lib/summarize-client.ts`
   - `export async function summarizeUrl(url: string): Promise<Summary>` — POST на `/api/summarize` с `{ url }`. Проверяет `Content-Type: application/json`, парсит тело, делает discriminated-union narrowing по `response.success`. На `success: false` бросает `SummarizeError` с `message` от бэкенда и `status`. На `success: true` маппит `mainThought → mainIdea` и возвращает `Summary`.
   - `export class SummarizeError extends Error` — плюс поле `status: number` для будущей аналитики.

3. `lib/summary.ts`
   - Экспорт `Summary`, `SummarizeApiResponse`, `SummarizeApiSuccess`, `SummarizeApiError`.
   - Type-guards: `isSupadataTranscript(x: unknown): x is SupadataTranscript`, `isOEmbedResponse(x: unknown): x is OEmbedResponse`, `isGeminiSummary(x: unknown): x is GeminiSummary` — помогают безопасно обращаться к полям внешних API.

**Изменяемые функции:**

- `components/summarizer.tsx::handleSubmit` — теперь асинхронно вызывает `summarizeUrl(url)`; в `try/catch` ставит `setError(err.message)` для пользовательской ошибки и не переходит в состояние `result` при провале. В `catch` оставляем `setStatus('idle')`, чтобы форма была готова к повторной отправке. На проде (не в dev) удалить мок-фоллбек.

- `lib/mock-summary.ts` — переписать как pure data file: убрать локальное объявление типа `Summary`, импортировать из `lib/summary.ts`, реэкспортировать его для обратной совместимости. Поведение `getMockSummary()` не меняется.

**Удаляемые функции:** нет.

[Classes]
Новые классы:

- `SummarizeError` (в `lib/summarize-client.ts`) — `class SummarizeError extends Error { status: number; constructor(message: string, status: number) }`. Используется во фронте для показа пользователю текста ошибки, пришедшей с бэкенда, и для будущей обработки специфичных кодов (например, 429 — предложить подождать).

Классов-обёрток для Supadata/Gemini не делаем: они stateless-клиенты SDK, единственный экземпляр `GoogleGenAI` создаётся на модульном уровне в `route.ts` (холодный старт Next.js это нормально переживает).

[Dependencies]

**Добавить:**

- `@google/genai` — официальный SDK для Gemini 3. По PRD устанавливается через `npm install @google/genai`. Версия — последняя стабильная (на момент реализации уточнить `npm view @google/genai version`).

**Не нужно:** отдельных пакетов для работы с Supadata — это REST, идём через `fetch`. Для YouTube oEmbed тоже `fetch`.

**Никаких версион-пинов** в `package.json` руками — ставим через пакетный менеджер, фиксируем в lockfile.

**Dev/peer:** `pnpm-lock.yaml` и `package-lock.json` уже присутствуют в репо; используем тот пакетный менеджер, который активен в проекте (`pnpm` рекомендован — есть `pnpm-lock.yaml`).

[Testing]

**Ручная проверка (минимум, что нужно прогнать):**

1. Локальный дев-сервер: `pnpm dev` (или `npm run dev`).
2. `curl -X POST http://localhost:3000/api/summarize -H "Content-Type: application/json" -d '{"url":"https://www.youtube.com/watch?v=c9DIoSNoQNs"}'` — ожидаем 200 и JSON c `success: true` (это эталонное видео из раздела [Reference]).
3. Невалидный URL (например, `not-a-url`) → 400 + понятный текст.
4. Видео без субтитров → 400/404 + «Для этого видео недоступны текстовые субтитры».
5. Очистка `GEMINI_API_KEY` в `.env.local` и перезапуск — 500 + лог в `console.error`.
6. UI-проверка: вставить эталонную ссылку → увидеть `LoadingState` (с тем же скелетоном) → увидеть `ResultCard` с реальными данными → кнопка «Сделать ещё одно» возвращает к форме.

**Unit-тесты:** проект не использует Jest/Vitest (в `package.json` их нет, в файловой структуре — тоже). Не добавляем новый test-runner в рамках этой задачи — это вне scope PRD. Если потребуется — отдельной задачей.

**Типизация:** прогон `pnpm tsc --noEmit` (или `npx tsc --noEmit`) — бэкенд не должен ломать строгий режим (`strict: true` в `tsconfig.json`). `next.config.mjs` сейчас имеет `ignoreBuildErrors: true`, но это не повод расслабляться.

[Implementation Order]

1. **Установить зависимость** `@google/genai` (`pnpm add @google/genai` или `npm i @google/genai`) — без этого route не скомпилируется.
2. **Создать `lib/summary.ts`** — типы и type-guards. Это база, от которой зависят остальные файлы.
3. **Перевести `lib/mock-summary.ts`** на импорт типа из `lib/summary.ts` (реэкспорт для совместимости с `result-card.tsx` и `summarizer.tsx`).
4. **Создать `lib/summarize-client.ts`** с `summarizeUrl` и `SummarizeError`. На этом этапе бэкенд ещё не нужен — клиент сначала пишем с мок-фоллбеком, чтобы фронт не падал.
5. **Создать `app/api/summarize/route.ts`** — основная серверная логика (POST handler со всеми шагами: валидация → oEmbed → Supadata → Gemini → маппинг в `Summary`).
6. **Добавить `.env.example`** с шаблоном `SUPADATA_API_KEY` и `GEMINI_API_KEY` (без реальных значений).
7. **Обновить `components/summarizer.tsx`** — заменить мок на вызов `summarizeUrl(url)`, обработать ошибки, оставить дев-фоллбек на мок при отсутствии ключей.
8. **Прогнать `tsc --noEmit` и `pnpm dev`** — локальная проверка, что фронт + бэкенд дружат.
9. **Прогнать `curl`-сценарии** из раздела Testing, используя эталонную ссылку `https://www.youtube.com/watch?v=c9DIoSNoQNs`, чтобы убедиться в обработке edge-cases.
10. **Закоммитить**, прописать env-переменные в Vercel (Settings → Environment Variables), задеплоить.

**Дополнительно (опционально, после первого успешного деплоя):**

- Установить `export const maxDuration = 60` в `route.ts`, если начнут приходить таймауты на длинных видео (Vercel Hobby: до 60 сек в платных планах, в Hobby — уточнять в доке).
- Добавить простое in-memory rate-limiting на IP (через `Map` с TTL) — защита от перерасхода квот Supadata/Gemini на бесплатном тарифе.
