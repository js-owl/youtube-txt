// DEV-эндпоинт: прямой вызов Gemini без Supadata.
// Нужен для локальной проверки, когда api.supadata.ai недоступен.
// НЕ ДЕПЛОИТЬ В ПРОДАКШЕН — доступен только при NODE_ENV !== "production".

import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { isGeminiSummary } from "@/lib/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `Ты — профессиональный редактор. Проанализируй транскрипт видео и сделай краткую, ёмкую, полезную выжимку.

Правила:
- Главная мысль — 1–2 предложения, отражающие самую суть видео.
- Ключевые тезисы — массив из 3–5 коротких утверждений, каждое до 200 символов.
- Пиши по-русски, в третьем лице, без воды.
- Верни ответ СТРОГО в формате JSON (без Markdown, без пояснений вокруг), со следующей структурой:
{"mainThought": "...", "keyPoints": ["...", "...", "..."]}`;

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "Disabled in production" },
      { status: 404 },
    );
  }

  try {
    const body = (await req.json()) as { transcript?: string };
    const transcript = (body.transcript || "").trim();
    if (transcript.length < 50) {
      return NextResponse.json(
        { success: false, error: "transcript слишком короткий" },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY не задан" },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });
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
      return NextResponse.json(
        { success: false, error: "Модель вернула пустой ответ" },
        { status: 500 },
      );
    }

    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return NextResponse.json(
        {
          success: false,
          error: "Не удалось распарсить JSON",
          raw: cleaned,
        },
        { status: 500 },
      );
    }

    if (!isGeminiSummary(parsed)) {
      return NextResponse.json(
        { success: false, error: "Неожиданный формат", parsed },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
