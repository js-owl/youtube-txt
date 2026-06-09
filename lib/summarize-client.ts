// Клиентская обёртка для вызова /api/summarize с фронта.
// Преобразует ответ бэкенда в типизированный Summary, выбрасывает SummarizeError на ошибке.

import type { Summary, SummarizeApiResponse } from "@/lib/summary";

export class SummarizeError extends Error {
  status: number;
  code?: "AUTH_REQUIRED" | "NO_CREDITS" | "INSUFFICIENT_CREDITS" | string;

  constructor(
    message: string,
    status: number,
    code?: "AUTH_REQUIRED" | "NO_CREDITS" | "INSUFFICIENT_CREDITS" | string,
  ) {
    super(message);
    this.name = "SummarizeError";
    this.status = status;
    this.code = code;
  }
}

export async function summarizeUrl(url: string): Promise<Summary> {
  const res = await fetch("/api/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  // Пытаемся распарсить тело как JSON в любом случае — даже при ошибке бэкенд
  // возвращает { success: false, error: string, code?: string }.
  let body: (SummarizeApiResponse & { code?: string }) | null = null;
  try {
    body = (await res.json()) as SummarizeApiResponse & { code?: string };
  } catch {
    throw new SummarizeError(
      "Сервер вернул некорректный ответ. Попробуйте ещё раз.",
      res.status || 500,
    );
  }

  if (!body) {
    throw new SummarizeError("Пустой ответ сервера.", res.status || 500);
  }

  if (body.success === false) {
    throw new SummarizeError(
      body.error || "Не удалось получить саммари.",
      res.status,
      body.code,
    );
  }

  // success === true
  const { title, channel, duration, mainThought, keyPoints } = body.data;
  return {
    title: title || "YouTube-видео",
    channel: channel || "",
    duration: duration || "",
    mainIdea: mainThought,
    keyPoints: Array.isArray(keyPoints) ? keyPoints : [],
  };
}
