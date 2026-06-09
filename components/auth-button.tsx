"use client";

import { LogIn, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { getMe, signOut } from "@/lib/auth/client";
import type { MeResponse } from "@/lib/auth/types";
import { AuthDialog } from "./auth-dialog";

export function AuthButton() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function refresh() {
    const res = await getMe();
    setMe(res);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch {
      // ignore
    } finally {
      setSigningOut(false);
      await refresh();
    }
  }

  if (!me) {
    // первая загрузка — показываем скелетон-кнопку, чтобы layout не дёргался
    return (
      <div className="h-10 w-44 animate-pulse rounded-full bg-secondary/40" />
    );
  }

  if (!me.authenticated) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-secondary/60 px-5 text-sm font-medium text-foreground transition-all hover:bg-secondary hover:shadow-[0_0_20px] hover:shadow-primary/20"
        >
          <LogIn className="size-4" aria-hidden="true" />
          Войти / Создать аккаунт
        </button>
        <AuthDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onAuthChange={refresh}
        />
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 text-sm">
        <span
          className="inline-flex size-6 items-center justify-center rounded-full bg-primary/20 text-primary"
          aria-hidden="true"
        >
          <User className="size-3.5" />
        </span>
        <span className="max-w-[160px] truncate text-foreground/90">
          {me.profile.email}
        </span>
        <span
          className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary"
          title="Остаток кредитов"
        >
          <span aria-hidden="true">💎</span>
          {me.profile.credits}
        </span>
      </div>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        aria-label="Выйти"
        title="Выйти"
        className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-secondary/40 text-muted-foreground transition-all hover:bg-secondary hover:text-foreground disabled:opacity-50"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
