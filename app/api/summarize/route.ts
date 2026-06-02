import { NextRequest, NextResponse } from "next/server";

/**
 * Мок API, имитирующий будущий бэкенд.
 * Пока бэкенда нет — этот роут возвращает фиктивный, но реалистичный результат,
 * чтобы фронтенд можно было полноценно протестировать по всем состояниям.
 *
 * Контракт запроса:
 *   POST /api/summarize
 *   body: { url: string, videoId?: string }
 *
 * Контракт ответа (успех):
 *   200 { title, videoId, thumbnailUrl, summary: string /* markdown *\/ }
 *
 * Контракт ответа (ошибка):
 *   4xx/5xx { error: string }
 */

type Body = {
  url?: string;
  videoId?: string;
};

const YT_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

const MOCK_SUMMARY = `## Краткое содержание

В этом видео разбираются **ключевые идеи** о продуктивности и фокусе на главном. Автор делится практическим опытом и простыми принципами, которые помогают перестать распыляться.

### Главные мысли

- **Фокус на результате**, а не на занятости. Занятость — это враг продуктивности.
- **Правило двух минут**: если задача занимает меньше двух минут — сделайте её сразу.
- **Большие задачи дробите** на маленькие шаги. Каждый завершённый шаг — это дофаминовый «выигрыш» для мозга.
- **Планирование на бумаге** снижает когнитивную нагрузку и освобождает голову для творчества.

### Практические советы

1. Утром определите 3 главные задачи дня — и сфокусируйтесь только на них.
2. Уберите уведомления на телефоне или используйте режим «Не беспокоить» во время глубокой работы.
3. Делайте короткие перерывы каждые 50 минут (техника Помодоро).

> «Главный ресурс — это внимание, а не время» — ключевая мысль выпуска.

### Итог

Видео мотивирует пересмотреть свой подход к задачам: меньше хаоса, больше ясности, больше осознанных действий.`;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Некорректный JSON в теле запроса." },
      { status: 400 },
    );
  }

  const url = (body.url || "").trim();
  const providedId = (body.videoId || "").trim();

  if (!url) {
    return NextResponse.json(
      { error: "Не передана ссылка на видео." },
      { status: 400 },
    );
  }

  // Имитация сетевой задержки и работы бэкенда
  await delay(1800);

  // Специальные ссылки для проверки разных состояний фронтенда
  if (/shorts/i.test(url)) {
    return NextResponse.json(
      { error: "Shorts не поддерживаются. Вставьте ссылку на обычное видео." },
      { status: 400 },
    );
  }
  if (/private|unavailable/i.test(providedId)) {
    return NextResponse.json(
      { error: "Видео недоступно (приватное или удалено)." },
      { status: 404 },
    );
  }

  // videoId либо из тела, либо вычислим из /watch?v=
  let videoId = providedId;
  if (!videoId) {
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      videoId = u.searchParams.get("v") || "dQw4w9WgXcQ";
    } catch {
      videoId = "dQw4w9WgXcQ";
    }
  }
  if (!YT_ID_REGEX.test(videoId)) videoId = "dQw4w9WgXcQ";

  // Имитация очень длинного видео → таймаут
  if (/long|twohour|2h/i.test(url)) {
    await delay(70_000);
  }

  const titleFromId = `Саммари видео ${videoId}`;
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  return NextResponse.json({
    title: titleFromId,
    videoId,
    thumbnailUrl,
    summary: MOCK_SUMMARY,
  });
}

export async function GET() {
  return NextResponse.json(
    {
      info: "TubeSum mock API. Используйте POST /api/summarize с { url, videoId }.",
    },
    { status: 200 },
  );
}

// Edge-runtime отключён: Node даёт корректный setTimeout для имитации задержки.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
