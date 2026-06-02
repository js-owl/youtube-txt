"use client";

import { useState, useCallback } from "react";
import Header from "@/components/Header";
import HeroInput from "@/components/HeroInput";
import ResultBlock, { SummaryResult } from "@/components/ResultBlock";
import Skeleton from "@/components/Skeleton";

type Status = "idle" | "loading" | "success" | "error";

// Простая валидация YouTube-ссылки
const YT_REGEX =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{11}([?&].*)?$/i;

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /[\w-]{11}/.test(id) ? id : null;
    }
    if (host.endsWith("youtube.com")) {
      if (u.pathname.startsWith("/watch")) {
        return u.searchParams.get("v");
      }
      const parts = u.pathname.split("/").filter(Boolean);
      // /shorts/<id> | /embed/<id>
      if (["shorts", "embed"].includes(parts[0]) && parts[1]) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }
  return null;
}

export default function HomePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SummaryResult | null>(null);

  const handleSubmit = useCallback(async (rawUrl: string) => {
    setErrorMessage(null);
    setResult(null);

    const url = rawUrl.trim();
    if (!YT_REGEX.test(url)) {
      setStatus("error");
      setErrorMessage(
        "Неверная ссылка. Вставьте корректный URL YouTube-видео.",
      );
      return;
    }

    const videoId = extractVideoId(url);

    setStatus("loading");

    // Контроллер таймаута — Vercel Hobby обрывает serverless-функцию через 10–60с.
    const controller = new AbortController();
    const timeoutMs = 55_000; // 55 секунд
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, videoId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Попробуем достать сообщение с сервера
        let serverMsg = "Не удалось получить саммари. Попробуйте ещё раз.";
        try {
          const data = await res.json();
          if (data?.error) serverMsg = data.error;
        } catch {
          /* ignore */
        }
        setStatus("error");
        setErrorMessage(serverMsg);
        return;
      }

      const data: SummaryResult = await res.json();
      // Лёгкая искусственная задержка не нужна — UX уже отработал скелетоном
      setResult(data);
      setStatus("success");
    } catch (err: any) {
      const aborted = err?.name === "AbortError";
      setStatus("error");
      setErrorMessage(
        aborted
          ? "Сервер не успел ответить (таймаут). Попробуйте более короткое видео."
          : "Ошибка сети. Проверьте подключение и попробуйте ещё раз.",
      );
    } finally {
      window.clearTimeout(timeoutId);
    }
  }, []);

  return (
    <>
      <Header />

      <main className="flex-1 w-full">
        <div className="mx-auto max-w-prose px-4 sm:px-6 py-10 sm:py-16">
          {/* Hero */}
          <section className="text-center mb-8 sm:mb-10">
            <h1 className="text-[34px] sm:text-[44px] font-bold tracking-[-0.02em] text-foreground leading-[1.1] mb-3">
              Суть видео за пару секунд
            </h1>
            <p className="text-[16px] sm:text-[17px] text-muted leading-relaxed max-w-[640px] mx-auto">
              Вставьте ссылку на YouTube-видео, чтобы получить краткое
              содержание. Никаких лишних деталей — только суть.
            </p>
          </section>

          {/* Input */}
          <section className="mb-6 sm:mb-8">
            <HeroInput
              onSubmit={handleSubmit}
              loading={status === "loading"}
              errorMessage={status === "error" ? errorMessage : null}
            />
          </section>

          {/* Output */}
          <section>
            {status === "loading" && (
              <div className="bg-card rounded-2xl ring-1 ring-border shadow-soft p-4 sm:p-6">
                <Skeleton />
              </div>
            )}

            {status === "success" && result && <ResultBlock data={result} />}

            {status === "idle" && <IdleHints />}
          </section>
        </div>
      </main>

      <footer className="w-full border-t border-border mt-auto">
        <div className="mx-auto max-w-prose px-4 sm:px-6 h-14 flex items-center justify-between text-xs text-muted">
          <span>TubeSum — быстрые саммари YouTube-видео</span>
          <span className="hidden sm:inline">Powered by AI</span>
        </div>
      </footer>
    </>
  );
}

function IdleHints() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-2">
      {[
        {
          title: "1. Вставьте ссылку",
          text: "Поддерживаются обычные ссылки, Shorts и youtu.be",
        },
        {
          title: "2. Получите саммари",
          text: "Краткое содержание в виде структурированного текста",
        },
        {
          title: "3. Скопируйте",
          text: "Один клик — и текст в буфере обмена",
        },
      ].map((step) => (
        <div
          key={step.title}
          className="rounded-xl bg-card ring-1 ring-border p-4"
        >
          <p className="text-sm font-semibold text-foreground mb-1">
            {step.title}
          </p>
          <p className="text-[13px] text-muted leading-relaxed">{step.text}</p>
        </div>
      ))}
    </div>
  );
}
