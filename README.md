# TubeSum

Минималистичный веб-сервис для быстрого получения структурированного саммари YouTube-видео.
Вставь ссылку — получи суть за пару секунд.

## Стек

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — стилизация, полностью через дизайн-токены из `tailwind.config.js`
- **lucide-react** — минималистичные SVG-иконки
- **react-markdown** — рендеринг саммари, отформатированного в Markdown

## Запуск локально

```bash
npm install
npm run dev
```

Открой [http://localhost:3000](http://localhost:3000).

## Структура

```
app/
  layout.tsx              # корневой layout, шрифт Inter, мета-теги
  globals.css             # tailwind + стили скелетонов и markdown
  page.tsx                # главная страница (все состояния: idle/loading/success/error)
  api/summarize/route.ts  # мок API. Заменить на реальный бэкенд позже

components/
  Header.tsx              # логотип + ссылка на GitHub
  HeroInput.tsx           # поле ввода + кнопка
  Skeleton.tsx            # пульсирующие плейсхолдеры во время загрузки
  ResultBlock.tsx         # карточка результата: превью + markdown
  CopyButton.tsx          # кнопка копирования с обратной связью
```

## Контракт API

Текущая реализация использует мок. Когда появится настоящий бэкенд, **замени только**
`app/api/summarize/route.ts` — фронтенд работает с тем же контрактом.

### Запрос

```http
POST /api/summarize
Content-Type: application/json

{ "url": "https://www.youtube.com/watch?v=...", "videoId": "..." }
```

### Успех (`200`)

```json
{
  "title": "Название видео",
  "videoId": "dQw4w9WgXcQ",
  "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "summary": "## Markdown-саммари с **жирным** и списками"
}
```

### Ошибка (`4xx` / `5xx`)

```json
{ "error": "Человекочитаемое сообщение об ошибке" }
```

Фронтенд умеет показывать в UI следующие тексты ошибок:

- `Неверная ссылка…` — невалидный URL (фронт проверяет сам)
- `Shorts не поддерживаются…`
- `Видео недоступно (приватное или удалено).`
- `Видео слишком длинное…`
- `Субтитры не найдены.`
- Таймаут 55 секунд (для serverless Vercel Hobby)
- `Ошибка сети…`

## Таймауты

Vercel Hobby обрывает serverless-функции через 10–60 секунд. На фронте стоит
`AbortController` на 55 секунд, который корректно показывает ошибку
«Сервер не успел ответить (таймаут)».

## Дизайн-система

Цвета, шрифты, тени и анимации описаны в `tailwind.config.js` и `app/globals.css`:

| Токен             | Значение           |
| ----------------- | ------------------ |
| `bg-background`   | `#FAFAFA`          |
| `text-foreground` | `#171717`          |
| `text-muted`      | `#737373`          |
| `bg-card`         | `#FFFFFF`          |
| `border-border`   | `#E5E5E5`          |
| `text-accent`     | `#2563EB`          |
| `bg-foreground`   | `#000000` (кнопка) |
| `text-danger`     | `#EF4444`          |

Шрифт: **Inter** (через `next/font/google`, без CLS).

## Деплой на Vercel

```bash
vercel
```

Всё работает «из коробки» — никаких env-переменных не нужно, мок API встроен в
приложение. После подключения реального бэкенда замени `app/api/summarize/route.ts`
на проксирование запросов к нему.
