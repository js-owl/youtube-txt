"use client";

import { useState, FormEvent, KeyboardEvent, useRef } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

type Props = {
  onSubmit: (url: string) => void;
  loading: boolean;
  errorMessage?: string | null;
};

export default function HeroInput({ onSubmit, loading, errorMessage }: Props) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (loading) return;
    const trimmed = value.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    onSubmit(trimmed);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasError = Boolean(errorMessage);

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full"
      noValidate
      aria-label="Форма создания саммари"
    >
      <div
        className={[
          "group flex flex-col sm:flex-row items-stretch gap-2 sm:gap-2",
          "rounded-xl bg-card",
          "p-2",
          hasError
            ? "ring-1 ring-danger/60"
            : "ring-1 ring-border focus-within:ring-2 focus-within:ring-foreground",
          "transition-all duration-200",
          "shadow-soft",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder="https://www.youtube.com/watch?v=..."
          aria-label="Ссылка на YouTube-видео"
          aria-invalid={hasError}
          className={[
            "flex-1 min-w-0",
            "h-12 sm:h-11",
            "px-3 sm:px-4",
            "bg-transparent",
            "text-[16px] font-medium",
            "text-foreground placeholder:text-muted",
            "outline-none",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          ].join(" ")}
        />

        <button
          type="submit"
          disabled={loading}
          aria-label="Сделать саммари"
          className={[
            "h-12 sm:h-11",
            "px-5",
            "rounded-lg",
            "bg-foreground text-background",
            "text-[15px] font-medium",
            "inline-flex items-center justify-center gap-2",
            "transition-all duration-200",
            "hover:opacity-90 active:scale-[0.99]",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "sm:min-w-[180px]",
          ].join(" ")}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Генерация…</span>
            </>
          ) : (
            <>
              <span className="hidden sm:inline">Сделать саммари</span>
              <span className="sm:hidden">Создать</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="mt-2 text-sm text-danger flex items-start gap-1.5 pl-1"
        >
          <span className="leading-5">{errorMessage}</span>
        </p>
      )}
    </form>
  );
}
