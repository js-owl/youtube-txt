"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/loading-state";
import { ResultCard } from "@/components/result-card";
import { AuthButton } from "@/components/auth-button";
import { getMockSummary } from "@/lib/mock-summary";
import { summarizeUrl, SummarizeError } from "@/lib/summarize-client";
import { getMe } from "@/lib/auth/client";
import type { MeResponse } from "@/lib/auth/types";
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
  const [me, setMe] = useState<MeResponse | null>(null);

  // Тянем сессию на маунт + после каждого успешного саммари
  async function refreshMe() {
    const res = await getMe();
    setMe(res);
  }
  useEffect(() => {
    refreshMe();
  }, []);

  const isValid = isValidYouTubeUrl(url);
  const showError = touched && url.length > 0 && !isValid;
  const isAuthed = me?.authenticated === true;
  const credits = isAuthed ? me!.profile.credits : 0;
  const noCredits = isAuthed && credits <= 0;
  const canSubmit = isValid && isAuthed && !noCredits;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) {
      setTouched(true);
      return;
    }
    if (!isAuthed) {
      setErrorMessage("Войдите, чтобы создавать саммари");
      return;
    }
    if (noCredits) {
      setErrorMessage("Закончились кредиты");
      return;
    }

    const videoId = extractVideoId(url);
    setThumbnailUrl(videoId ? getThumbnailUrl(videoId) : null);
    setErrorMessage(null);
    setStatus("loading");

    try {
      const data = await summarizeUrl(url);
      setSummary(data);
      setStatus("result");
      // Обновим баланс после успешного саммари
      refreshMe();
    } catch (err) {
      let msg: string;
      if (err instanceof SummarizeError) {
        if (err.code === "AUTH_REQUIRED") {
          msg = "Войдите, чтобы создавать саммари";
        } else if (err.code === "NO_CREDITS") {
          msg = "Закончились кредиты";
        } else {
          msg = err.message;
        }
      } else if (err instanceof Error) {
        msg = err.message;
      } else {
        msg = "Не удалось получить саммари. Попробуйте ещё раз.";
      }
      setErrorMessage(msg);
      setStatus("idle");
      refreshMe();
    }
  }

  function handleReset() {
    setStatus("idle");
    setSummary(null);
    setThumbnailUrl(null);
    setUrl("");
    setTouched(false);
    setErrorMessage(null);
    refreshMe();
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
      <div className="mb-6 flex w-full justify-end">
        <AuthButton onAuthChange={refreshMe} />
      </div>

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
              disabled={!isAuthed}
              className={`glass h-14 w-full rounded-full border px-6 text-foreground placeholder:text-muted-foreground/70 outline-none transition-all focus:border-primary focus:shadow-[0_0_24px] focus:shadow-primary/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                showError || errorMessage
                  ? "border-destructive"
                  : "border-border"
              }`}
            />
          </div>
          <button
            type="submit"
            disabled={!canSubmit}
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

        {!showError && !errorMessage && !isAuthed && (
          <p className="animate-fade-in mt-3 pl-6 text-sm text-muted-foreground">
            Войдите, чтобы создавать саммари.
          </p>
        )}

        {!showError && !errorMessage && isAuthed && noCredits && (
          <p className="animate-fade-in mt-3 pl-6 text-sm text-destructive">
            Закончились кредиты.
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
