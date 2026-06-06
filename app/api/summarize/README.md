# POST /api/summarize

Серверный Route Handler, который принимает YouTube-ссылку и возвращает структурированное саммари.

## Контракт

**Запрос**

```json
POST /api/summarize
Content-Type: application/json

{ "url": "https://www.youtube.com/watch?v=..." }
```

**Успех (200)**

```json
{
  "success": true,
  "data": {
    "title": "...",
    "channel": "...",
    "duration": "",
    "mainThought": "...",
    "keyPoints": ["...", "..."]
  }
}
```

**Ошибка (4xx / 5xx)**

```json
{ "success": false, "error": "Текст ошибки" }
```

## Переменные окружения

- `SUPADATA_API_KEY` — для получения транскрипта.
- `GEMINI_API_KEY` — для генерации саммари (модель `gemini-2.5-flash`).

Без этих переменных эндпоинт вернёт `500` с понятным сообщением.

## Локальный запуск

```bash
npm run dev
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=c9DIoSNoQNs"}'
```

## Деплой

В Vercel: Settings → Environment Variables → добавить `SUPADATA_API_KEY` и `GEMINI_API_KEY`, затем redeploy.
