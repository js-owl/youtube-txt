"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { LoadingState } from "@/components/loading-state";
import { ResultCard } from "@/components/result-card";
import { getMockSummary } from "@/lib/mock-summary";
import { summarizeUrl, SummarizeError } from "@/lib/summarize-client";
import {
  extractVideoId,
  getThumbnailUrl,
  isValidYouTubeUrl,
} from "@/lib/youtube";

type Status = "idle" | "loading" | "result";

export function Summarizer() {
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState<ReturnType<
    typeof getMockSummary
  > | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValid = isValidYouTubeUrl(url);
  const showError = touched && url.length > 0 && !isValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setTouched(true);
      return;
    }

    const videoId = extractVideoId(url);
    setThumbnailUrl(videoId ? getThumbnailUrl(videoId) : null);
    setErrorMessage(null);
    setStatus("loading");

    try {
      // На проде — только реальный API. В dev оставлен фоллбек на мок,
      // чтобы фронт можно было гонять без ключей Supadata/Gemini.
      if (process.env.NODE_ENV !== "production") {
        try {
          const data = await summarizeUrl(url);
          setSummary(data);
          setStatus("result");
          return;
        } catch (err) {
          console.warn("summarizeUrl упал в dev, fallback на мок:", err);
        }
      } else {
        const data = await summarizeUrl(url);
        setSummary(data);
        setStatus("result");
        return;
      }

      // dev-фоллбек, если бэкенд недоступен
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSummary(getMockSummary());
      setStatus("result");
    } catch (err) {
      const msg =
        err instanceof SummarizeError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Не удалось получить саммари. Попробуйте ещё раз.";
      setErrorMessage(msg);
      setStatus("idle");
    }
  }

  function handleReset() {
    setStatus("idle");
    setSummary(null);
    setThumbnailUrl(null);
    setUrl("");
    setTouched(false);
    setErrorMessage(null);
  }

  if (status === "loading") {
    return (
      <div className="w-full max-w-2xl">
        <LoadingState />
      </div>
    );
  }

  if (status === "result" && summary) {
    return (
      <div className="w-full max-w-2xl">
        <ResultCard
          summary={summary}
          thumbnailUrl={thumbnailUrl}
          onReset={handleReset}
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-up flex w-full max-w-2xl flex-col items-center">
      <h1 className="text-stroke text-center font-heading text-7xl font-black uppercase leading-none tracking-tight sm:text-8xl md:text-9xl">
        Смысл
      </h1>
      <p className="mt-5 max-w-md text-balance text-center text-base leading-relaxed text-foreground/80 sm:text-lg">
        Вставьте ссылку на YouTube-видео — получите ясное краткое содержание за
        секунды.
      </p>

      <form onSubmit={handleSubmit} className="mt-9 w-full">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="yt-url" className="sr-only">
              Ссылка на YouTube-видео
            </label>
            <input
              id="yt-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              onBlur={() => setTouched(true)}
              placeholder="https://www.youtube.com/watch?v=..."
              aria-invalid={showError || !!errorMessage}
              aria-describedby={
                showError
                  ? "yt-error"
                  : errorMessage
                    ? "yt-server-error"
                    : undefined
              }
              className={`glass h-14 w-full rounded-full border px-6 text-foreground placeholder:text-muted-foreground/70 outline-none transition-all focus:border-primary focus:shadow-[0_0_24px] focus:shadow-primary/30 ${
                showError || errorMessage
                  ? "border-destructive"
                  : "border-border"
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={!isValid}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 font-semibold text-primary-foreground gradient-accent transition-all hover:scale-[1.02] hover:shadow-[0_0_30px] hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            <span>Создать</span>
            <ArrowRight className="size-5" aria-hidden="true" />
          </button>
        </div>

        {showError && (
          <p
            id="yt-error"
            className="animate-fade-in mt-3 pl-6 text-sm text-destructive"
            role="alert"
          >
            Пожалуйста, введите корректную ссылку на YouTube.
          </p>
        )}

        {errorMessage && !showError && (
          <p
            id="yt-server-error"
            className="animate-fade-in mt-3 pl-6 text-sm text-destructive"
            role="alert"
          >
            {errorMessage}
          </p>
        )}
      </form>
    </div>
  );
}
