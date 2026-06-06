// POST /api/summarize
// Полный цикл: валидация URL → YouTube oEmbed (title/channel) → Supadata (транскрипт) →
// Gemini 2.5 Flash (саммари) → маппинг в Summary.

import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { extractVideoId } from "@/lib/youtube";
import {
  isGeminiSummary,
  isOEmbedResponse,
  isSupadataTranscript,
  extractTranscriptText,
} from "@/lib/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMINI_MODEL = "gemini-2.5-flash";
const SUPADATA_URL = "https://api.supadata.ai/v1/youtube/transcript";
const OEMBED_URL = "https://www.youtube.com/oembed";
const MIN_TRANSCRIPT_LENGTH = 50;

const SYSTEM_PROMPT = `Ты — профессиональный редактор. Проанализируй транскрипт видео и сделай краткую, ёмкую, полезную выжимку.

Правила:
- Главная мысль — 1–2 предложения, отражающие самую суть видео.
- Ключевые тезисы — массив из 3–5 коротких утверждений, каждое до 200 символов.
- Пиши по-русски, в третьем лице, без воды.
- Верни ответ СТРОГО в формате JSON (без Markdown, без пояснений вокруг), со следующей структурой:
{"mainThought": "...", "keyPoints": ["...", "...", "..."]}`;

function getGemini(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY не задан в переменных окружения.");
  }
  return new GoogleGenAI({ apiKey });
}

type OEmbedInfo = { title: string; channel: string };

async function fetchOEmbed(videoId: string): Promise<OEmbedInfo> {
  const url = `${OEMBED_URL}?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`,
  )}&format=json`;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 5000);
    const res = await fetch(url, { signal: ac.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`oEmbed ${res.status}`);
    const data: unknown = await res.json();
    if (!isOEmbedResponse(data)) throw new Error("oEmbed: неожиданный формат");
    return { title: data.title, channel: data.author_name };
  } catch {
    return { title: "YouTube-видео", channel: "" };
  }
}

async function fetchTranscript(videoId: string): Promise<string> {
  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) {
    throw new Error("SUPADATA_API_KEY не задан в переменных окружения.");
  }

  const url = `${SUPADATA_URL}?videoId=${encodeURIComponent(videoId)}`;
  const res = await fetch(url, {
    headers: { "x-api-key": apiKey },
  });

  // Supadata отдаёт 206 Partial Content с телом-ошибкой, если транскрипта нет.
  if (res.status === 206) {
    throw new Error("Для этого видео недоступны текстовые субтитры");
  }
  if (res.status === 404 || res.status === 403) {
    throw new Error("Для этого видео недоступны текстовые субтитры");
  }
  if (res.status === 429) {
    throw new Error("Сервис временно перегружен. Попробуйте позже.");
  }
  if (!res.ok) {
    let detail = "";
    try {
      const errBody = (await res.json()) as {
        message?: string;
        error?: string;
      };
      detail = errBody.message || errBody.error || "";
    } catch {
      /* ignore */
    }
    throw new Error(
      detail || `Не удалось получить субтитры (HTTP ${res.status}).`,
    );
  }

  const data: unknown = await res.json();

  // Supadata при ошибке возвращает { error, message, details } — отлавливаем явно,
  // чтобы не валиться на type-guard с непонятным сообщением.
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
  ) {
    const errCode = (data as { error: string }).error;
    if (errCode === "transcript-unavailable" || errCode === "no-transcript") {
      throw new Error("Для этого видео недоступны текстовые субтитры");
    }
    throw new Error(
      (data as { message?: string }).message || "Supadata: ошибка",
    );
  }

  if (!isSupadataTranscript(data)) {
    throw new Error("Supadata вернула неожиданный формат ответа.");
  }
  const text = extractTranscriptText(data).trim();

  if (text.length < MIN_TRANSCRIPT_LENGTH) {
    throw new Error("В видео слишком мало текста для анализа.");
  }
  return text;
}

async function generateSummary(transcript: string): Promise<{
  mainThought: string;
  keyPoints: string[];
}> {
  const ai = getGemini();

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: `${SYSTEM_PROMPT}\n\nТранскрипт:\n${transcript}`,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const raw = response.text;
  if (!raw) {
    throw new Error("Модель вернула пустой ответ.");
  }

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Не удалось разобрать ответ модели.");
  }

  if (!isGeminiSummary(parsed)) {
    throw new Error("Модель вернула неожиданный формат JSON.");
  }
  return parsed;
}

type ErrorBody = { success: false; error: string };

function errorResponse(message: string, status: number) {
  const body: ErrorBody = { success: false, error: message };
  return NextResponse.json(body, { status });
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Некорректный JSON в теле запроса.", 400);
    }

    const url =
      typeof body === "object" && body !== null && "url" in body
        ? (body as { url?: unknown }).url
        : undefined;

    if (typeof url !== "string" || url.trim().length === 0) {
      return errorResponse("URL не предоставлен", 400);
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return errorResponse("Неверный формат ссылки YouTube", 400);
    }

    const [oembed, transcript] = await Promise.all([
      fetchOEmbed(videoId),
      fetchTranscript(videoId),
    ]);

    const summary = await generateSummary(transcript);

    return NextResponse.json(
      {
        success: true,
        data: {
          title: oembed.title,
          channel: oembed.channel,
          duration: "",
          mainThought: summary.mainThought,
          keyPoints: summary.keyPoints,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Внутренняя ошибка сервера";
    console.error("[/api/summarize] error:", err);

    const lower = message.toLowerCase();
    let status = 500;
    if (
      lower.includes("не предоставлен") ||
      lower.includes("неверный формат")
    ) {
      status = 400;
    } else if (lower.includes("субтитры") || lower.includes("мало текста")) {
      status = 400;
    } else if (lower.includes("перегружен") || lower.includes("rate")) {
      status = 429;
    } else if (lower.includes("api_key") || lower.includes("ключ")) {
      status = 500;
    }
    return errorResponse(message, status);
  }
}
