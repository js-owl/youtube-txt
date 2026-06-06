// DEV-only: возвращает сырой ответ Supadata, чтобы посмотреть реальный формат.
// Отключён на проде.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, error: "Disabled in production" },
      { status: 404 },
    );
  }

  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId") || "c9DIoSNoQNs";
  const apiKey = process.env.SUPADATA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "SUPADATA_API_KEY не задан" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `https://api.supadata.ai/v1/youtube/transcript?videoId=${encodeURIComponent(videoId)}`,
      { headers: { "x-api-key": apiKey } },
    );
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* leave as text */
    }
    return NextResponse.json({
      status: res.status,
      contentType: res.headers.get("content-type"),
      body: parsed,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "fail" },
      { status: 500 },
    );
  }
}
