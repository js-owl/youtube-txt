"use client";

import { LogIn, UserPlus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { signIn, signUp } from "@/lib/auth/client";

type Mode = "signin" | "signup";

type AuthDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAuthChange: () => void;
};

export function AuthDialog({
  open,
  onOpenChange,
  onAuthChange,
}: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Закрытие по Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Сброс стейта при закрытии
  useEffect(() => {
    if (!open) {
      setError(null);
      setLoading(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res =
        mode === "signin"
          ? await signIn(email, password)
          : await signUp(email, password);
      if (res.success) {
        onAuthChange();
        onOpenChange(false);
        setEmail("");
        setPassword("");
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="glass relative w-full max-w-md rounded-3xl border border-border p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Закрыть"
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <h2 className="mb-1 font-heading text-2xl font-bold uppercase tracking-tight">
          {isSignup ? "Создать аккаунт" : "Войти"}
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {isSignup
            ? "Получите 5 бесплатных кредитов на саммари."
            : "Войдите, чтобы продолжить."}
        </p>

        <div className="mb-5 flex rounded-full border border-border bg-secondary/40 p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError(null);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 font-medium transition-all ${
              !isSignup
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogIn className="size-4" aria-hidden="true" />
            Вход
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 font-medium transition-all ${
              isSignup
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="size-4" aria-hidden="true" />
            Регистрация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="auth-email" className="sr-only">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="h-12 w-full rounded-full border border-border bg-background/40 px-5 text-foreground placeholder:text-muted-foreground/70 outline-none transition-all focus:border-primary focus:shadow-[0_0_20px] focus:shadow-primary/30"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="sr-only">
              Пароль
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 8 символов"
              className="h-12 w-full rounded-full border border-border bg-background/40 px-5 text-foreground placeholder:text-muted-foreground/70 outline-none transition-all focus:border-primary focus:shadow-[0_0_20px] focus:shadow-primary/30"
            />
          </div>

          {error && (
            <p
              className="animate-fade-in text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 font-semibold text-primary-foreground gradient-accent transition-all hover:scale-[1.02] hover:shadow-[0_0_30px] hover:shadow-primary/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {loading ? "Подождите..." : isSignup ? "Создать аккаунт" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
