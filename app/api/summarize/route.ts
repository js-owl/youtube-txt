// POST /api/summarize
// Полный цикл: валидация URL → YouTube oEmbed (title/channel) → Supadata (транскрипт) →
// Gemini 2.5 Flash (саммари) → маппинг в Summary.

import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { extractVideoId } from "@/lib/youtube";
import { createServerSupabase } from "@/lib/supabase/server";
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

// Сетевые настройки: защита от транзиентных DNS/сетевых ошибок и зависаний.
// На практике Supadata иногда не резолвится с первого раза (особенно в RU),
// а без таймаута fetch может висеть до 5 минут.
const FETCH_TIMEOUT_MS = 15_000;
const FETCH_RETRIES = 2;
const FETCH_RETRY_DELAY_MS = 500;
const GEMINI_TIMEOUT_MS = 30_000;

// fetch с таймаутом и ретраями. Ретраим: любые сетевые ошибки (DNS, ECONNRESET,
// TLS, abort по таймауту) + HTTP 5xx/429.
async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: { timeoutMs?: number; retries?: number; delayMs?: number } = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
  const retries = opts.retries ?? FETCH_RETRIES;
  const delayMs = opts.delayMs ?? FETCH_RETRY_DELAY_MS;

  let lastError: unknown = new Error("fetch failed");
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ac.signal });
      clearTimeout(timer);
      if (res.status >= 500 || res.status === 429) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, delayMs * 2 ** attempt));
          continue;
        }
        return res; // последняя попытка — отдаём как есть
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * 2 ** attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("fetch failed");
}

// Оборачивает произвольный promise в таймаут. Используем для Gemini SDK,
// который сам не принимает httpOptions.timeout на generateContent.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label}: превышен таймаут ${ms} мс`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

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
    const res = await fetchWithRetry(url, {}, { timeoutMs: 5_000, retries: 1 });
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
  const res = await fetchWithRetry(
    url,
    { headers: { "x-api-key": apiKey } },
    { timeoutMs: 15_000, retries: 2 },
  );

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

  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `${SYSTEM_PROMPT}\n\nТранскрипт:\n${transcript}`,
      config: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
    GEMINI_TIMEOUT_MS,
    "Gemini",
  );

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

type ErrorBody = { success: false; error: string; code?: string };

function errorResponse(
  message: string,
  status: number,
  code?: "AUTH_REQUIRED" | "NO_CREDITS",
) {
  const body: ErrorBody = { success: false, error: message, code };
  return NextResponse.json(body, { status });
}

// Превращает внутренние ошибки в человекочитаемые сообщения + HTTP-код.
// Особенно важно мапить безликие undici-ошибки («fetch failed», «aborted»,
// «ENOTFOUND», «таймаут») в понятные формулировки для UI.
function mapError(err: unknown): { message: string; status: number } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  // Валидация ввода
  if (lower.includes("не предоставлен") || lower.includes("неверный формат")) {
    return { message: raw, status: 400 };
  }
  if (lower.includes("субтитры") || lower.includes("мало текста")) {
    return { message: raw, status: 400 };
  }
  if (lower.includes("перегружен") || lower.includes("rate")) {
    return { message: raw, status: 429 };
  }
  if (lower.includes("api_key") || lower.includes("ключ")) {
    return { message: raw, status: 500 };
  }

  // Сетевые / DNS-ошибки от fetch (undici бросает обобщённый «fetch failed»)
  if (
    lower.includes("fetch failed") ||
    lower.includes("enotfound") ||
    lower.includes("econnreset") ||
    lower.includes("econnrefused") ||
    lower.includes("getaddrinfo") ||
    lower.includes("network")
  ) {
    return {
      message:
        "Не удалось связаться с сервисом субтитров. Проверьте интернет-соединение и попробуйте ещё раз.",
      status: 502,
    };
  }

  // Таймауты (AbortController или наш withTimeout)
  if (
    lower.includes("aborted") ||
    lower.includes("превышен таймаут") ||
    lower.includes("timeout")
  ) {
    return {
      message:
        "Сервис не ответил вовремя. Попробуйте ещё раз через пару секунд.",
      status: 504,
    };
  }

  // Специфичные ошибки Gemini SDK — не показываем сырой текст
  if (lower.includes("gemini")) {
    return {
      message:
        "Не удалось сгенерировать краткое содержание. Попробуйте ещё раз.",
      status: 502,
    };
  }

  return {
    message: raw || "Внутренняя ошибка сервера",
    status: 500,
  };
}

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Авторизация
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errorResponse(
      "Войдите, чтобы создавать саммари",
      401,
      "AUTH_REQUIRED",
    );
  }

  // 2. Списание кредита (атомарно). Если 0 кредитов — отказываем.
  const { data: consumed } = await supabase.rpc("consume_credit");
  if (!consumed) {
    return errorResponse("Закончились кредиты", 402, "NO_CREDITS");
  }

  // Возвращаем кредит при любой ошибке (best-effort, не маскируем основную).
  const refund = async () => {
    try {
      await supabase.rpc("refund_credit");
    } catch (e) {
      console.error("[refund_credit] failed:", e);
    }
  };

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      await refund();
      return errorResponse("Некорректный JSON в теле запроса.", 400);
    }

    const url =
      typeof body === "object" && body !== null && "url" in body
        ? (body as { url?: unknown }).url
        : undefined;

    if (typeof url !== "string" || url.trim().length === 0) {
      await refund();
      return errorResponse("URL не предоставлен", 400);
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      await refund();
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
    await refund();
    const { message, status } = mapError(err);
    console.error("[/api/summarize] error:", err);
    return errorResponse(message, status);
  }
}
